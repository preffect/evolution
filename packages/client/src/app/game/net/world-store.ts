// The single client model (docs/ARCHITECTURE.md §5): applies `game_state` and `game_snapshot`
// messages (food deltas idempotently), estimates the server tick through the injected clock and
// answers one interpolated `RenderFrame` per rendered frame (`nextFrame`, which consumes the effects due). Framework-free; the Angular facade and
// the renderer both read it, nothing else writes it. Prediction and reconciliation of the own
// cell join with the input ticket (#100): every cell is interpolated here.

import {
  MILLISECONDS_PER_SECOND,
  TICK_INTERVAL_S,
  type BalanceConfig,
  type CellView,
  type Clock,
  type DnaFragmentView,
  type FoodMoteView,
  type GameEffect,
  type GameSnapshot,
  type PlayerId,
} from '@evolution/shared';
import { FoodStore } from './food-store';
import {
  ServerTickEstimator,
  extrapolateCells,
  interpolateCells,
  interpolateFragments,
  interpolationWeight,
  renderTickFor,
} from './interpolation';
import { SNAPSHOT_PUSH, SnapshotBuffer } from './snapshot-buffer';

/** What the renderer draws for one frame: the interpolated world at `renderTick`. */
export interface RenderFrame {
  readonly renderTick: number;
  /** `renderTick × TICK_INTERVAL_S`: the only time the renderer sees (docs/RENDERING.md §1). */
  readonly timeSeconds: number;
  readonly cells: readonly CellView[];
  readonly motes: readonly FoodMoteView[];
  readonly fragments: readonly DnaFragmentView[];
  /** The effects whose tick the render tick has reached since the last frame, oldest first. */
  readonly effects: readonly GameEffect[];
  /** The newest snapshot, for everything that is not interpolated (players, leaderboard, round). */
  readonly latest: GameSnapshot;
  /** The live balance of `game_state` / `balance_updated`: what `speedRatio` and `canEngulf` read. */
  readonly balance: BalanceConfig;
}

export interface GameStateApplied {
  readonly snapshot: GameSnapshot;
  readonly balance: BalanceConfig;
  readonly playerId: PlayerId;
  readonly avatarAssignments: Readonly<Record<string, number>>;
}

export class WorldStore {
  private readonly snapshots = new SnapshotBuffer();
  private readonly estimator = new ServerTickEstimator();
  private readonly food = new FoodStore();
  private pendingEffects: GameEffect[] = [];
  private balanceValue: BalanceConfig | null = null;
  private ownPlayerIdValue: PlayerId | null = null;
  private avatarAssignmentsValue: Readonly<Record<string, number>> = {};

  constructor(private readonly clock: Clock) {}

  /** Join, late join and reconnect: the full state replaces everything (docs/ARCHITECTURE.md §4). */
  applyGameState(state: GameStateApplied): void {
    this.reset();
    this.balanceValue = state.balance;
    this.ownPlayerIdValue = state.playerId;
    this.avatarAssignmentsValue = state.avatarAssignments;
    this.applySnapshot(state.snapshot);
  }

  /**
   * A broadcast delta; a stale tick is ignored so a late frame never rewinds the world. A republished
   * tick replaces the latest frame without touching the tick estimate: it is a new world, not a new arrival.
   */
  applySnapshot(snapshot: GameSnapshot): boolean {
    const outcome = this.snapshots.push(snapshot);
    if (outcome === SNAPSHOT_PUSH.stale) return false;
    if (outcome === SNAPSHOT_PUSH.appended) this.estimator.observe(snapshot.tick, this.clock.nowMilliseconds());
    this.food.applyDelta(snapshot.food, snapshot.tick);
    this.pendingEffects.push(...snapshot.effects);
    return true;
  }

  applyBalance(balance: BalanceConfig): void {
    this.balanceValue = balance;
  }

  get balance(): BalanceConfig | null {
    return this.balanceValue;
  }

  get ownPlayerId(): PlayerId | null {
    return this.ownPlayerIdValue;
  }

  get avatarAssignments(): Readonly<Record<string, number>> {
    return this.avatarAssignmentsValue;
  }

  latestSnapshot(): GameSnapshot | null {
    return this.snapshots.latest();
  }

  /** The render tick for the clock's now against the buffered snapshots, or `null` before the first one. */
  private renderTickNow(): { renderTick: number; latest: GameSnapshot } | null {
    const latest = this.snapshots.latest();
    const oldest = this.snapshots.oldest();
    const serverTick = this.estimator.serverTickAt(this.clock.nowMilliseconds());
    if (latest === null || oldest === null || serverTick === null) return null;
    return { renderTick: renderTickFor(serverTick, oldest.tick, latest.tick), latest };
  }

  /**
   * The world at the render tick for the clock's now, or `null` before the first `game_state`.
   * Consumes the effects due at that tick: the session calls it once per rendered frame, never to peek.
   */
  nextFrame(): RenderFrame | null {
    const position = this.renderTickNow();
    const balance = this.balanceValue;
    if (position === null || balance === null) return null;
    const { renderTick, latest } = position;
    const { older, newer } = this.snapshots.bracket(renderTick);
    // `renderTickFor` never answers before the oldest snapshot, so `bracket` always finds an older one.
    const from = older ?? latest;
    const target = newer ?? latest;
    const weight = interpolationWeight(from.tick, target.tick, renderTick);
    const cells =
      newer === null
        ? extrapolateCells(from.cells, renderTick - from.tick)
        : interpolateCells(from.cells, target.cells, weight);
    return {
      renderTick,
      timeSeconds: renderTick * TICK_INTERVAL_S,
      cells,
      motes: this.food.motesAt(renderTick),
      fragments: interpolateFragments(from.dnaFragments, target.dnaFragments, weight),
      effects: this.drainEffects(renderTick),
      latest,
      balance,
    };
  }

  /** Effects fire when the render tick reaches theirs, so a burst lines up with the interpolated cell. */
  private drainEffects(renderTick: number): GameEffect[] {
    const due = this.pendingEffects.filter((effect) => effect.tick <= renderTick);
    if (due.length === 0) return due;
    this.pendingEffects = this.pendingEffects.filter((effect) => effect.tick > renderTick);
    return due.sort((first, second) => first.tick - second.tick);
  }

  /** Milliseconds the render tick lags the newest snapshot: what a HUD may show as latency. A read: consumes nothing. */
  renderLagMs(): number | null {
    const position = this.renderTickNow();
    if (position === null) return null;
    return (position.latest.tick - position.renderTick) * TICK_INTERVAL_S * MILLISECONDS_PER_SECOND;
  }

  reset(): void {
    this.snapshots.clear();
    this.estimator.reset();
    this.food.reset();
    this.pendingEffects = [];
  }
}
