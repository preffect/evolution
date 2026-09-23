import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  MAX_PREDICTION_TICKS,
  MILLISECONDS_PER_SECOND,
  ManualClock,
  PREDICTION_STALL_TICKS,
  RECONCILE_BLEND_SECONDS,
  RECONCILE_SNAP_DISTANCE_WU,
  TICK_INTERVAL_MS,
  createTestSnapshot,
  entityId,
  type CellView,
  type GameInput,
  type GameSnapshot,
} from '@evolution/shared';
import {
  TEST_OTHER_CELL_ID,
  TEST_OWN_CELL_ID,
  TEST_OWN_PLAYER_ID,
  createTestCellView,
} from '../../../testing/builders';
import { predictOwnPoses } from './own-cell-prediction';
import { OwnCellPredictor } from './own-cell-predictor';

const STARTING_RADIUS = 18;
const EAST = { x: 400, y: 0 };
const BLEND_MS = RECONCILE_BLEND_SECONDS * MILLISECONDS_PER_SECOND;

function snapshotAt(acknowledged: number, own: Partial<CellView> = {}, others: CellView[] = []): GameSnapshot {
  return createTestSnapshot({
    tick: 100 + acknowledged,
    cells: [createTestCellView({ radius: STARTING_RADIUS, ...own }), ...others],
    appliedInputSequenceByPlayer: { [TEST_OWN_PLAYER_ID]: acknowledged },
  });
}

function eastInput(sequence: number): GameInput {
  return { sequence, targetX: EAST.x, targetY: EAST.y, shouldSprint: false, traitChoice: null };
}

function predictorAt(acknowledged: number, own: Partial<CellView> = {}) {
  const clock = new ManualClock(0);
  const predictor = new OwnCellPredictor(clock);
  const snapshot = snapshotAt(acknowledged, own);
  predictor.rebase(snapshot, TEST_OWN_PLAYER_ID, DEFAULT_BALANCE);
  return { clock, predictor, snapshot };
}

/** Sends `count` east inputs after `from`, one tick apart on the clock, as the controller does. */
function sendEast(predictor: OwnCellPredictor, clock: ManualClock, from: number, count: number): GameInput[] {
  const sent: GameInput[] = [];
  for (let sequence = from + 1; sequence <= from + count; sequence += 1) {
    clock.advanceMilliseconds(TICK_INTERVAL_MS);
    const input = eastInput(sequence);
    predictor.recordInput(input);
    sent.push(input);
  }
  return sent;
}

function expectedAfter(snapshot: GameSnapshot, inputs: readonly GameInput[], acknowledged: number, steps: number) {
  const ownCell = snapshot.cells[0]!;
  return predictOwnPoses({ snapshot, ownCell, balance: DEFAULT_BALANCE }, inputs, acknowledged, steps);
}

describe('OwnCellPredictor', () => {
  it('predicts nothing before a snapshot, and leaves the cells alone', () => {
    const predictor = new OwnCellPredictor(new ManualClock());
    const cells = [createTestCellView()];
    expect(predictor.predictedPose()).toBeNull();
    expect(predictor.displayedPosition()).toBeNull();
    expect(predictor.applyTo(cells)).toBe(cells);
  });

  it('steps the prediction through every input sent since the acknowledged one', () => {
    const { clock, predictor, snapshot } = predictorAt(10);
    expect(predictor.predictedPose()).toEqual({ x: 0, y: 0, velocityX: 0, velocityY: 0 });
    const sent = sendEast(predictor, clock, 10, 4);
    expect(predictor.predictedPose()).toEqual(expectedAfter(snapshot, sent, 10, 4).current);
    expect(predictor.predictedPose()!.x).toBeGreaterThan(0);
  });

  it('draws the newest tick eased in over one tick from the one before', () => {
    const { clock, predictor, snapshot } = predictorAt(10);
    const sent = sendEast(predictor, clock, 10, 3);
    const poses = expectedAfter(snapshot, sent, 10, 3);
    expect(predictor.displayedPosition()!.x).toBe(poses.previous.x);
    clock.advanceMilliseconds(TICK_INTERVAL_MS / 2);
    expect(predictor.displayedPosition()!.x).toBeCloseTo((poses.previous.x + poses.current.x) / 2, 9);
    clock.advanceMilliseconds(TICK_INTERVAL_MS);
    expect(predictor.displayedPosition()!.x).toBe(poses.current.x);
  });

  it('holds once the room stops answering: no further than the stall bound past the last arrival', () => {
    const { clock, predictor, snapshot } = predictorAt(10);
    const sent = sendEast(predictor, clock, 10, PREDICTION_STALL_TICKS + 20);
    const held = expectedAfter(snapshot, sent, 10, PREDICTION_STALL_TICKS).current;
    expect(predictor.predictedPose()).toEqual(held);
    expect(predictor.displayedPosition()!.x).toBe(held.x);
  });

  it('never replays more than the horizon, however far behind the acknowledgement is', () => {
    const { clock, predictor } = predictorAt(10);
    const sent = sendEast(predictor, clock, 10, MAX_PREDICTION_TICKS + 20);
    // The room answers, still acknowledging 10: every input was sent before this arrival.
    const snapshot = snapshotAt(10);
    predictor.rebase(snapshot, TEST_OWN_PLAYER_ID, DEFAULT_BALANCE);
    expect(predictor.predictedPose()).toEqual(expectedAfter(snapshot, sent, 10, MAX_PREDICTION_TICKS).current);
  });

  it('blends a small correction out from where the cell was drawn', () => {
    const { clock, predictor } = predictorAt(10);
    sendEast(predictor, clock, 10, 3);
    clock.advanceMilliseconds(TICK_INTERVAL_MS);
    const shown = predictor.displayedPosition()!;
    const pushedSouth = snapshotAt(11, { y: 5 });
    predictor.rebase(pushedSouth, TEST_OWN_PLAYER_ID, DEFAULT_BALANCE);
    expect(predictor.displayedPosition()!.y).toBeCloseTo(shown.y, 9);
    clock.advanceMilliseconds(BLEND_MS);
    expect(predictor.displayedPosition()!.y).toBeCloseTo(predictor.predictedPose()!.y, 9);
    expect(predictor.predictedPose()!.y).toBeGreaterThan(4);
  });

  it('snaps a large correction, and a new cell of its own', () => {
    const { predictor } = predictorAt(10);
    predictor.rebase(snapshotAt(10, { x: RECONCILE_SNAP_DISTANCE_WU }), TEST_OWN_PLAYER_ID, DEFAULT_BALANCE);
    expect(predictor.displayedPosition()!.x).toBe(RECONCILE_SNAP_DISTANCE_WU);
    const respawned = snapshotAt(10, { id: entityId('c-respawned'), x: RECONCILE_SNAP_DISTANCE_WU + 1 });
    predictor.rebase(respawned, TEST_OWN_PLAYER_ID, DEFAULT_BALANCE);
    expect(predictor.displayedPosition()!.x).toBe(RECONCILE_SNAP_DISTANCE_WU + 1);
  });

  it('stops predicting while the own cell is engulfed, dead, or before the balance', () => {
    const { predictor } = predictorAt(10);
    predictor.rebase(snapshotAt(10, { engulfedByCellId: TEST_OTHER_CELL_ID }), TEST_OWN_PLAYER_ID, DEFAULT_BALANCE);
    expect(predictor.predictedPose()).toBeNull();
    predictor.rebase(createTestSnapshot({ tick: 200 }), TEST_OWN_PLAYER_ID, DEFAULT_BALANCE);
    expect(predictor.predictedPose()).toBeNull();
    predictor.rebase(snapshotAt(10), TEST_OWN_PLAYER_ID, null);
    expect(predictor.predictedPose()).toBeNull();
  });

  it('draws the own cell at its displayed pose and moves the prey it carries by the same shift', () => {
    const { clock, predictor } = predictorAt(10);
    sendEast(predictor, clock, 10, 5);
    clock.advanceMilliseconds(TICK_INTERVAL_MS);
    const own = createTestCellView({ x: -3, y: 1 });
    const carried = createTestCellView({
      id: entityId('prey'),
      playerId: null,
      x: 2,
      y: 1,
      engulfedByCellId: TEST_OWN_CELL_ID,
    });
    const bystander = createTestCellView({ id: TEST_OTHER_CELL_ID, playerId: null, x: 50, y: 50 });
    const [drawnOwn, drawnPrey, drawnBystander] = predictor.applyTo([own, carried, bystander]);
    const displayed = predictor.displayedPosition()!;
    expect(drawnOwn).toMatchObject({ x: displayed.x, y: displayed.y, velocityX: predictor.predictedPose()!.velocityX });
    expect(drawnPrey!.x - carried.x).toBeCloseTo(displayed.x - own.x, 9);
    expect(drawnPrey!.y - carried.y).toBeCloseTo(displayed.y - own.y, 9);
    expect(drawnBystander).toBe(bystander);
    expect(predictor.debugState()).toEqual({
      acknowledgedSequence: 10,
      newestSequence: 15,
      interpolated: own,
      displayed,
    });
  });

  it('forgets everything on reset', () => {
    const { clock, predictor } = predictorAt(10);
    sendEast(predictor, clock, 10, 3);
    predictor.reset();
    expect(predictor.predictedPose()).toBeNull();
  });
});
