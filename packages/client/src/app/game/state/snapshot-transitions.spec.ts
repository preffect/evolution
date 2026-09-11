import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  CELL_STATE,
  DEFAULT_BALANCE,
  ENTITY_KIND,
  MILLISECONDS_PER_SECOND,
  ROUND_PHASE,
  createTestSnapshot,
  entityId,
  type CellView,
  type GameSnapshot,
} from '@evolution/shared';
import { GAME_EVENT_KIND, type GameEvent } from './game-event-bus';
import { SnapshotTransitionTracker, detectTransitions, type TransitionMemory } from './snapshot-transitions';
import {
  TEST_OTHER_CELL_ID,
  TEST_OTHER_PLAYER_ID,
  TEST_OWN_CELL_ID,
  createTestCellAbsorbedEffect,
  createTestCellView,
  createTestEatEffect,
  createTestLevelUpEffect,
  createTestTransitionOptions,
} from '../../../testing/builders';

const OPTIONS = createTestTransitionOptions();
const ROUND_MS = OPTIONS.roundDurationSeconds * MILLISECONDS_PER_SECOND;
const BLOOM_MS_LEFT = ROUND_MS * (1 - DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION);
/** Heavy enough to engulf the default cell under `ENGULF_MASS_RATIO`. */
const PREDATOR_MASS = 100;

function otherCell(overrides: Partial<CellView> = {}): CellView {
  return createTestCellView({
    id: TEST_OTHER_CELL_ID,
    playerId: TEST_OTHER_PLAYER_ID,
    organismId: TEST_OTHER_CELL_ID,
    ...overrides,
  });
}

function snapshotWith(cells: CellView[], overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return createTestSnapshot({ cells, ...overrides });
}

function kindsOf(events: GameEvent[]): string[] {
  return events.map((event) => event.kind);
}

/** Runs the detector over consecutive snapshots and returns the events of the last one. */
function eventsAfter(...snapshots: GameSnapshot[]): GameEvent[] {
  let memory: TransitionMemory | null = null;
  let events: GameEvent[] = [];
  for (const snapshot of snapshots) ({ events, memory } = detectTransitions(memory, snapshot, OPTIONS));
  return events;
}

describe('detectTransitions', () => {
  it('reports the stage and the round phase on the first snapshot so the bed can start', () => {
    const events = eventsAfter(snapshotWith([createTestCellView()]));
    expect(events).toEqual([
      { kind: GAME_EVENT_KIND.stageChanged, stage: CELL_STAGE.protocell },
      { kind: GAME_EVENT_KIND.roundPhaseChanged, phase: ROUND_PHASE.playing },
    ]);
  });

  it('reports nothing while nothing changes', () => {
    const snapshot = snapshotWith([createTestCellView()]);
    expect(eventsAfter(snapshot, snapshot)).toEqual([]);
  });

  it('reports a stage change once', () => {
    const before = snapshotWith([createTestCellView()]);
    const after = snapshotWith([createTestCellView({ stage: CELL_STAGE.prokaryote })]);
    expect(eventsAfter(before, after)).toEqual([{ kind: GAME_EVENT_KIND.stageChanged, stage: CELL_STAGE.prokaryote }]);
    expect(eventsAfter(before, after, after)).toEqual([]);
  });

  it('reports each organelle gained with the new count', () => {
    const before = snapshotWith([createTestCellView({ traits: [{ traitId: 'nucleoid', tier: 1 }] })]);
    const after = snapshotWith([
      createTestCellView({
        traits: [
          { traitId: 'nucleoid', tier: 2 },
          { traitId: 'cell_wall', tier: 1 },
        ],
      }),
    ]);
    expect(eventsAfter(before, after)).toEqual([
      { kind: GAME_EVENT_KIND.organelleGained, traitId: 'cell_wall', organelleCount: 2 },
    ]);
  });

  it('turns danger on when a cell that can engulf the own cell appears and off when it goes', () => {
    const safe = snapshotWith([createTestCellView(), otherCell()]);
    const threatened = snapshotWith([createTestCellView(), otherCell({ mass: PREDATOR_MASS })]);
    expect(eventsAfter(safe, threatened)).toEqual([{ kind: GAME_EVENT_KIND.dangerChanged, isDanger: true }]);
    expect(eventsAfter(safe, threatened, threatened)).toEqual([]);
    expect(eventsAfter(safe, threatened, safe)).toEqual([{ kind: GAME_EVENT_KIND.dangerChanged, isDanger: false }]);
  });

  it('never counts the own cell as its own threat', () => {
    const heavy = snapshotWith([createTestCellView({ mass: PREDATOR_MASS })]);
    expect(kindsOf(eventsAfter(heavy))).not.toContain(GAME_EVENT_KIND.dangerChanged);
  });

  it('reports engulf progress every snapshot while engulfing and the end once', () => {
    const idle = snapshotWith([createTestCellView(), otherCell()]);
    const engulfing = snapshotWith([
      createTestCellView({ states: [CELL_STATE.engulfing], engulfingCellId: TEST_OTHER_CELL_ID }),
      otherCell({ states: [CELL_STATE.beingEngulfed], engulfedByCellId: TEST_OWN_CELL_ID, engulfProgress: 0.4 }),
    ]);
    expect(eventsAfter(idle, engulfing)).toEqual([{ kind: GAME_EVENT_KIND.engulfProgress, progress: 0.4 }]);
    expect(eventsAfter(idle, engulfing, engulfing)).toEqual([{ kind: GAME_EVENT_KIND.engulfProgress, progress: 0.4 }]);
    expect(eventsAfter(idle, engulfing, idle)).toEqual([{ kind: GAME_EVENT_KIND.engulfEnded }]);
  });

  it('reads progress as zero when the engulfing flag is set before the prey view carries it', () => {
    const engulfing = snapshotWith([createTestCellView({ states: [CELL_STATE.engulfing] })]);
    expect(eventsAfter(engulfing)).toContainEqual({ kind: GAME_EVENT_KIND.engulfProgress, progress: 0 });
  });

  it('reports the bloom once when the clock crosses the bloom fraction, never on the first snapshot', () => {
    const early = snapshotWith([createTestCellView()], { roundTimeLeftMs: ROUND_MS });
    const bloom = snapshotWith([createTestCellView()], { roundTimeLeftMs: BLOOM_MS_LEFT });
    expect(eventsAfter(early, bloom)).toEqual([{ kind: GAME_EVENT_KIND.bloomStarted }]);
    expect(eventsAfter(early, bloom, bloom)).toEqual([]);
    expect(kindsOf(eventsAfter(bloom))).not.toContain(GAME_EVENT_KIND.bloomStarted);
  });

  it('reports the round phase change to results', () => {
    const playing = snapshotWith([createTestCellView()]);
    const results = snapshotWith([createTestCellView()], { roundPhase: ROUND_PHASE.results });
    expect(eventsAfter(playing, results)).toEqual([
      { kind: GAME_EVENT_KIND.roundPhaseChanged, phase: ROUND_PHASE.results },
    ]);
  });

  it('attributes effects to the own cell by cell id or player id and marks the own predator', () => {
    const ownEat = createTestEatEffect();
    const otherEat = createTestEatEffect({ cellId: TEST_OTHER_CELL_ID, eatenKind: ENTITY_KIND.dnaFragment });
    const ownLevelUp = createTestLevelUpEffect();
    const ownKill = createTestCellAbsorbedEffect();
    const events = eventsAfter(
      snapshotWith([createTestCellView()], { effects: [ownEat, otherEat, ownLevelUp, ownKill] }),
    );
    expect(events.slice(0, 4)).toEqual([
      { kind: GAME_EVENT_KIND.effect, effect: ownEat, isOwn: true, isOwnPredator: false },
      { kind: GAME_EVENT_KIND.effect, effect: otherEat, isOwn: false, isOwnPredator: false },
      { kind: GAME_EVENT_KIND.effect, effect: ownLevelUp, isOwn: true, isOwnPredator: false },
      { kind: GAME_EVENT_KIND.effect, effect: ownKill, isOwn: false, isOwnPredator: true },
    ]);
  });

  it('keeps the stage and traits through a spectate so the respawned cell reports no change', () => {
    const alive = snapshotWith([
      createTestCellView({ stage: CELL_STAGE.prokaryote, traits: [{ traitId: 'nucleoid', tier: 1 }] }),
    ]);
    const spectating = snapshotWith([]);
    const respawned = snapshotWith([
      createTestCellView({
        id: entityId('c-9'),
        stage: CELL_STAGE.prokaryote,
        traits: [{ traitId: 'nucleoid', tier: 1 }],
      }),
    ]);
    expect(eventsAfter(alive, spectating)).toEqual([]);
    expect(eventsAfter(alive, spectating, respawned)).toEqual([]);
  });

  it('ends danger when the own cell is gone so the respawn starts calm', () => {
    const threatened = snapshotWith([createTestCellView(), otherCell({ mass: PREDATOR_MASS })]);
    const spectating = snapshotWith([otherCell({ mass: PREDATOR_MASS })]);
    const calm = snapshotWith([createTestCellView()]);
    expect(eventsAfter(threatened, spectating)).toEqual([{ kind: GAME_EVENT_KIND.dangerChanged, isDanger: false }]);
    expect(kindsOf(eventsAfter(threatened, spectating, calm))).not.toContain(GAME_EVENT_KIND.dangerChanged);
  });
});

describe('SnapshotTransitionTracker', () => {
  it('emits the detected events onto the bus and forgets on reset', () => {
    const emitted: GameEvent[][] = [];
    const tracker = new SnapshotTransitionTracker({ emitAll: (events) => emitted.push([...events]) }, OPTIONS);
    const snapshot = snapshotWith([createTestCellView()]);
    tracker.observe(snapshot);
    tracker.observe(snapshot);
    expect(emitted.map((batch) => batch.length)).toEqual([2, 0]);
    tracker.reset();
    tracker.observe(snapshot);
    expect(emitted[2]).toHaveLength(2);
  });

  it('applies updated options to the next observation', () => {
    const emitted: GameEvent[] = [];
    const tracker = new SnapshotTransitionTracker({ emitAll: (events) => emitted.push(...events) }, OPTIONS);
    tracker.observe(snapshotWith([createTestCellView()], { roundTimeLeftMs: ROUND_MS }));
    // Half the round: the bloom's 20 % left is now 60 s, so 120 s left is not the bloom yet.
    tracker.updateOptions({ roundDurationSeconds: OPTIONS.roundDurationSeconds / 2 });
    tracker.observe(snapshotWith([createTestCellView()], { roundTimeLeftMs: BLOOM_MS_LEFT }));
    expect(kindsOf(emitted)).not.toContain(GAME_EVENT_KIND.bloomStarted);
  });
});
