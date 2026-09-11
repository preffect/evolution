// Turns successive snapshots into the state-transition events of the `GameEventBus`
// (docs/ARCHITECTURE.md §6): the own cell's stage, its organelles, danger through the shared
// `canEngulf` predicate, its engulf in progress, the round phase and the bloom. Server effects
// pass through untouched. Pure detection over a small memory; the tracker owns the memory.

import type {
  BalanceConfig,
  CellStage,
  CellView,
  GameEffect,
  GameSnapshot,
  PlayerId,
  RoundPhase,
  TraitId,
} from '@evolution/shared';
import { CELL_STATE, EFFECT_KIND, MILLISECONDS_PER_SECOND, canEngulf } from '@evolution/shared';
import { GAME_EVENT_KIND, type GameEvent, type GameEventBus } from './game-event-bus';

/** What the detector reads of the live balance: the engulf ratios and the bloom fraction. */
export type TransitionBalance = Pick<BalanceConfig, 'absorption' | 'session'>;

export interface TransitionOptions {
  ownPlayerId: PlayerId;
  balance: TransitionBalance;
  roundDurationSeconds: number;
}

/** What the last observed snapshot said; `null` before the first. */
export interface TransitionMemory {
  stage: CellStage | null;
  traitIds: readonly TraitId[];
  isDanger: boolean;
  isEngulfing: boolean;
  roundPhase: RoundPhase;
  isBloom: boolean;
}

export interface TransitionResult {
  events: GameEvent[];
  memory: TransitionMemory;
}

function ownCellOf(snapshot: GameSnapshot, ownPlayerId: PlayerId): CellView | null {
  return snapshot.cells.find((cell) => cell.playerId === ownPlayerId) ?? null;
}

function isThreatened(ownCell: CellView, snapshot: GameSnapshot, balance: TransitionBalance): boolean {
  return snapshot.cells.some((other) => other.id !== ownCell.id && canEngulf(other, ownCell, balance.absorption));
}

function isInBloom(snapshot: GameSnapshot, options: TransitionOptions): boolean {
  const roundDurationMs = options.roundDurationSeconds * MILLISECONDS_PER_SECOND;
  const bloomStartsAtMsLeft = roundDurationMs * (1 - options.balance.session.ROUND_BLOOM_START_FRACTION);
  return snapshot.roundTimeLeftMs <= bloomStartsAtMsLeft;
}

/** Whose effect: the own cell's (by cell id, or by player id where the cell is already gone) and whether the own cell was the predator. */
function effectEvent(effect: GameEffect, ownCell: CellView | null, ownPlayerId: PlayerId): GameEvent {
  // A world-wide effect (`world_level_up`) names no cell: it is nobody's own; the sound bus ignores it for now.
  const isOwn =
    'playerId' in effect ? effect.playerId === ownPlayerId : 'cellId' in effect && effect.cellId === ownCell?.id;
  const isOwnPredator = effect.kind === EFFECT_KIND.cellAbsorbed && effect.predatorCellId === ownCell?.id;
  return { kind: GAME_EVENT_KIND.effect, effect, isOwn, isOwnPredator };
}

function engulfProgressOf(ownCell: CellView, snapshot: GameSnapshot): number | null {
  if (!ownCell.states.includes(CELL_STATE.engulfing)) return null;
  const prey = snapshot.cells.find((cell) => cell.engulfedByCellId === ownCell.id);
  return prey?.engulfProgress ?? 0;
}

function ladderEvents(ownCell: CellView, previous: TransitionMemory | null): GameEvent[] {
  const events: GameEvent[] = [];
  if (ownCell.stage !== previous?.stage) events.push({ kind: GAME_EVENT_KIND.stageChanged, stage: ownCell.stage });
  const knownTraitIds = previous?.traitIds ?? [];
  for (const owned of ownCell.traits) {
    if (knownTraitIds.includes(owned.traitId)) continue;
    events.push({
      kind: GAME_EVENT_KIND.organelleGained,
      traitId: owned.traitId,
      organelleCount: ownCell.traits.length,
    });
  }
  return events;
}

function contactEvents(
  ownCell: CellView,
  previous: TransitionMemory | null,
  next: TransitionMemory,
  snapshot: GameSnapshot,
): GameEvent[] {
  const events: GameEvent[] = [];
  if (next.isDanger !== (previous?.isDanger ?? false)) {
    events.push({ kind: GAME_EVENT_KIND.dangerChanged, isDanger: next.isDanger });
  }
  const progress = engulfProgressOf(ownCell, snapshot);
  if (progress !== null) events.push({ kind: GAME_EVENT_KIND.engulfProgress, progress });
  return events;
}

/** What to carry forward; a spectating player keeps the last stage and traits so a respawned cell reports only real changes. */
function memoryAfter(
  ownCell: CellView | null,
  previous: TransitionMemory | null,
  snapshot: GameSnapshot,
  options: TransitionOptions,
): TransitionMemory {
  return {
    stage: ownCell?.stage ?? previous?.stage ?? null,
    traitIds: ownCell ? ownCell.traits.map((owned) => owned.traitId) : (previous?.traitIds ?? []),
    isDanger: ownCell !== null && isThreatened(ownCell, snapshot, options.balance),
    isEngulfing: ownCell !== null && engulfProgressOf(ownCell, snapshot) !== null,
    roundPhase: snapshot.roundPhase,
    isBloom: isInBloom(snapshot, options),
  };
}

function roundEvents(
  previous: TransitionMemory | null,
  snapshot: GameSnapshot,
  options: TransitionOptions,
): GameEvent[] {
  const events: GameEvent[] = [];
  if (snapshot.roundPhase !== previous?.roundPhase) {
    events.push({ kind: GAME_EVENT_KIND.roundPhaseChanged, phase: snapshot.roundPhase });
  }
  // The first observation only remembers the bloom: a late joiner hears no sting for a bloom already under way.
  if (previous && isInBloom(snapshot, options) && !previous.isBloom)
    events.push({ kind: GAME_EVENT_KIND.bloomStarted });
  return events;
}

/** The events between `previous` and `snapshot`, and the memory to carry to the next call. */
export function detectTransitions(
  previous: TransitionMemory | null,
  snapshot: GameSnapshot,
  options: TransitionOptions,
): TransitionResult {
  const ownCell = ownCellOf(snapshot, options.ownPlayerId);
  const memory = memoryAfter(ownCell, previous, snapshot, options);
  const events = snapshot.effects.map((effect) => effectEvent(effect, ownCell, options.ownPlayerId));
  if (ownCell) events.push(...ladderEvents(ownCell, previous), ...contactEvents(ownCell, previous, memory, snapshot));
  // A spectator is in no danger: the drone ends here, not only through the `cell_absorbed` effect.
  if (!ownCell && previous?.isDanger) events.push({ kind: GAME_EVENT_KIND.dangerChanged, isDanger: false });
  if (previous?.isEngulfing && !memory.isEngulfing) events.push({ kind: GAME_EVENT_KIND.engulfEnded });
  events.push(...roundEvents(previous, snapshot, options));
  return { events, memory };
}

/** Feeds every observed snapshot through `detectTransitions` onto the bus; `reset()` on a new round or room. */
export class SnapshotTransitionTracker {
  private memory: TransitionMemory | null = null;

  constructor(
    private readonly bus: Pick<GameEventBus, 'emitAll'>,
    private options: TransitionOptions,
  ) {}

  /** `balance_updated` and a rematch change the numbers the detector reads. */
  updateOptions(patch: Partial<TransitionOptions>): void {
    this.options = { ...this.options, ...patch };
  }

  observe(snapshot: GameSnapshot): void {
    const { events, memory } = detectTransitions(this.memory, snapshot, this.options);
    this.memory = memory;
    this.bus.emitAll(events);
  }

  reset(): void {
    this.memory = null;
  }
}
