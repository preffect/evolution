// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DEFAULT_CELL_MODIFIERS,
  createTestSnapshot,
  entityId,
  movementStepFor,
  stepMovementKernel,
  type CellView,
  type GameInput,
  type MovementCellState,
  type MovementPose,
  type Vec2,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { isPredictable, predictOwnPoses, type PredictionBase } from './own-cell-prediction';

const ACKNOWLEDGED = 10;
const STARTING_RADIUS = 18;
const EAST: Vec2 = { x: 400, y: 0 };
const NORTH: Vec2 = { x: 0, y: -400 };
const PREY_ID = entityId('prey');
/** A `debug_set_balance`-patched grab that slows the predator, unlike the shipped 1. */
const PATCHED_PREDATOR_SPEED_FACTOR = 0.6;
const PREDATOR_SPEED_FACTOR_ROW = 'ENGULF_PREDATOR_SPEED_FACTOR' satisfies keyof typeof DEFAULT_BALANCE.absorption;

function baseWith(ownOverrides: Partial<CellView> = {}, others: CellView[] = []): PredictionBase {
  const ownCell = createTestCellView({ radius: STARTING_RADIUS, ...ownOverrides });
  return {
    snapshot: createTestSnapshot({ tick: 100, cells: [ownCell, ...others] }),
    ownCell,
    balance: DEFAULT_BALANCE,
  };
}

function steer(sequence: number, target: Vec2 | null, shouldSprint = false): GameInput {
  return { sequence, targetX: target?.x ?? null, targetY: target?.y ?? null, shouldSprint, traitChoice: null };
}

/** The server's step for a plain starting cell, driven by hand: what the prediction has to reproduce. */
function handStepped(
  from: MovementPose,
  targets: readonly (Vec2 | null)[],
  overrides: Partial<MovementCellState> = {},
) {
  let pose = from;
  for (const target of targets) {
    const state: MovementCellState = {
      mass: DEFAULT_BALANCE.growth.CELL_STARTING_MASS,
      radiusWu: STARTING_RADIUS,
      sprintRemainingTicks: 0,
      modifiers: DEFAULT_CELL_MODIFIERS,
      isInGel: false,
      engulfFactor: 1,
      ...overrides,
    };
    pose = stepMovementKernel(pose, movementStepFor(state, target ?? pose, DEFAULT_BALANCE));
  }
  return pose;
}

const AT_REST: MovementPose = { x: 0, y: 0, velocityX: 0, velocityY: 0 };

describe('predictOwnPoses', () => {
  it('answers the snapshot pose, twice, when nothing is unacknowledged', () => {
    const poses = predictOwnPoses(baseWith({ x: 3, y: 4, velocityX: 5 }), [], ACKNOWLEDGED, 0);
    expect(poses.current).toEqual({ x: 3, y: 4, velocityX: 5, velocityY: 0 });
    expect(poses.previous).toEqual(poses.current);
  });

  // Parity with the server is the shared `movementStepFor` + `stepMovementKernel`, which the server's `movement.ts` calls
  // (pinned by its own tests there); this pins the replay's order: one step per input, in sequence.
  it('replays one shared movement step per unacknowledged input, in sequence order', () => {
    const inputs = [steer(11, EAST), steer(12, EAST), steer(13, NORTH)];
    const poses = predictOwnPoses(baseWith(), inputs, ACKNOWLEDGED, 3);
    expect(poses.current).toEqual(handStepped(AT_REST, [EAST, EAST, NORTH]));
    expect(poses.previous).toEqual(handStepped(AT_REST, [EAST, EAST]));
  });

  it('keeps the latch through a missing sequence and a non-steering input, as the server does', () => {
    const inputs = [steer(ACKNOWLEDGED, EAST), steer(12, null)];
    const poses = predictOwnPoses(baseWith(), inputs, ACKNOWLEDGED, 3);
    expect(poses.current).toEqual(handStepped(AT_REST, [EAST, EAST, EAST]));
  });

  it('steers at the cell itself before any input steers: throttle 0, the cell coasts to rest', () => {
    const moving = { x: 0, y: 0, velocityX: 100, velocityY: 0 };
    const poses = predictOwnPoses(baseWith({ velocityX: 100 }), [], ACKNOWLEDGED, 2);
    expect(poses.current).toEqual(handStepped(moving, [null, null]));
    expect(poses.current.velocityX).toBeLessThan(100);
  });

  it('starts a predicted sprint on a ready cell, and none while the cooldown runs', () => {
    const plain = predictOwnPoses(baseWith(), [steer(11, EAST)], ACKNOWLEDGED, 1).current;
    const sprinting = predictOwnPoses(baseWith(), [steer(11, EAST, true)], ACKNOWLEDGED, 1).current;
    expect(sprinting).toEqual(handStepped(AT_REST, [EAST], { sprintRemainingTicks: 1 }));
    expect(sprinting.x).toBeGreaterThan(plain.x);
    const cooling = baseWith({ sprintCooldownRemainingTicks: 5 });
    expect(predictOwnPoses(cooling, [steer(11, EAST, true)], ACKNOWLEDGED, 1).current).toEqual(plain);
  });

  it('runs down a reported sprint, then moves at the plain cap', () => {
    const base = baseWith({ sprintRemainingTicks: 1 });
    const poses = predictOwnPoses(base, [steer(11, EAST), steer(12, EAST)], ACKNOWLEDGED, 2);
    const afterSprintTick = handStepped(AT_REST, [EAST], { sprintRemainingTicks: 1 });
    expect(poses.current).toEqual(handStepped(afterSprintTick, [EAST]));
  });

  it('reads the gel from the replayed pose, not the snapshot one', () => {
    // Open broth: past the vent, short of the shallows, where only a gel patch changes the zone.
    const broth = { x: 1000, y: 0, velocityX: 0, velocityY: 0 };
    const farEast = { x: 1400, y: 0 };
    const base = baseWith({ mass: 400, x: broth.x });
    const gelled: PredictionBase = {
      ...base,
      snapshot: { ...base.snapshot, gelPatches: [{ x: broth.x, y: 0, radius: 200 }] },
    };
    const inputs = [steer(11, farEast)];
    const grown = { mass: 400 };
    const inGel = predictOwnPoses(gelled, inputs, ACKNOWLEDGED, 1).current;
    expect(inGel).toEqual(handStepped(broth, [farEast], { ...grown, isInGel: true }));
    const outside = predictOwnPoses(base, inputs, ACKNOWLEDGED, 1).current;
    expect(outside).toEqual(handStepped(broth, [farEast], grown));
    expect(inGel.x).toBeLessThan(outside.x);
  });

  it("slows a predator by its prey's reported phase", () => {
    const prey = createTestCellView({ id: PREY_ID, playerId: null, engulfProgress: 0 });
    // The shipped grab costs the predator nothing (factor 1, #634), so a patched room's factor proves it is read.
    const factor = PATCHED_PREDATOR_SPEED_FACTOR;
    const base = {
      ...baseWith({ engulfingCellId: PREY_ID }, [prey]),
      balance: {
        ...DEFAULT_BALANCE,
        absorption: { ...DEFAULT_BALANCE.absorption, [PREDATOR_SPEED_FACTOR_ROW]: factor },
      },
    };
    expect(predictOwnPoses(base, [steer(11, EAST)], ACKNOWLEDGED, 1).current).toEqual(
      handStepped(AT_REST, [EAST], { engulfFactor: factor }),
    );
    const outOfView = baseWith({ engulfingCellId: PREY_ID });
    expect(predictOwnPoses(outOfView, [steer(11, EAST)], ACKNOWLEDGED, 1).current).toEqual(
      handStepped(AT_REST, [EAST]),
    );
  });
});

describe('isPredictable', () => {
  it('is false only for a cell being engulfed: its predator moves it', () => {
    expect(isPredictable(createTestCellView())).toBe(true);
    expect(isPredictable(createTestCellView({ engulfingCellId: PREY_ID }))).toBe(true);
    expect(isPredictable(createTestCellView({ engulfedByCellId: PREY_ID }))).toBe(false);
  });
});
