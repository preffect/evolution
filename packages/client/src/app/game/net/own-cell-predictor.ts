// Prediction and reconciliation of the own cell (docs/architecture/client.md §5, #265). It keeps the inputs this
// client sent, re-bases on every applied snapshot (the authoritative pose after input `S`), replays the ones past
// `S` through `predictOwnPoses`, and draws the result with the reconciliation offset. `WorldStore` owns one; the input
// layer records into it what it sends, so the own cell moves on the frame the input is made.

import {
  MAX_PREDICTION_TICKS,
  PREDICTION_STALL_TICKS,
  TICK_INTERVAL_MS,
  lerp,
  type BalanceConfig,
  type CellView,
  type Clock,
  type GameInput,
  type GameSnapshot,
  type MovementPose,
  type PlayerId,
  type Vec2,
} from '@evolution/shared';
import { isPredictable, predictOwnPoses, type PredictedPoses, type PredictionBase } from './own-cell-prediction';
import { PoseCorrection } from './pose-correction';
import { SNAPSHOT_PUSH, type SnapshotPushOutcome } from './snapshot-buffer';

/** What the dev-only debug hook reports (docs/architecture/client.md §5): the last frame's own cell both ways. */
export interface PredictionDebugState {
  readonly acknowledgedSequence: number;
  readonly newestSequence: number;
  /** Where interpolation alone put the own cell in the last frame: what it was drawn at before #265. */
  readonly interpolated: Vec2 | null;
  /** Where the last frame drew it. */
  readonly displayed: Vec2 | null;
}

export class OwnCellPredictor {
  private inputs: GameInput[] = [];
  private newestSequence = 0;
  /** When the newest input was sent: the drawn pose eases from the tick before it to its tick over one tick. */
  private newestSentAtMs = 0;
  private base: PredictionBase | null = null;
  private acknowledgedSequence = 0;
  /** The newest sequence sent when the base's snapshot arrived: what the stall bound counts from. */
  private newestSequenceAtArrival = 0;
  private readonly correction = new PoseCorrection();
  private lastFrame: Pick<PredictionDebugState, 'interpolated' | 'displayed'> = { interpolated: null, displayed: null };
  private cached: { base: PredictionBase; newestSequence: number; poses: PredictedPoses } | null = null;

  constructor(private readonly clock: Clock) {}

  /**
   * One sent input. Kept only within `MAX_PREDICTION_TICKS` of the acknowledged one, so a room that stops
   * answering (a pause) never grows the list; a sequence missing on replay keeps the latch, as on the server.
   */
  recordInput(input: GameInput): void {
    this.newestSequence = Math.max(this.newestSequence, input.sequence);
    this.newestSentAtMs = this.clock.nowMilliseconds();
    if (input.sequence <= this.acknowledgedSequence + MAX_PREDICTION_TICKS) this.inputs.push(input);
  }

  /**
   * The snapshot just applied is the newest: re-base on its own cell, or stop predicting when there is none. Only an
   * `appended` snapshot is an arrival: a `replaced` one (a debug tool republishing a paused room's tick) re-bases the
   * pose but leaves the stall bound where the last real arrival put it, so the paused cell keeps holding.
   */
  rebase(
    snapshot: GameSnapshot,
    ownPlayerId: PlayerId | null,
    balance: BalanceConfig | null,
    arrival: SnapshotPushOutcome,
  ): void {
    const shown = this.displayedPosition();
    const previousCellId = this.base?.ownCell.id ?? null;
    const ownCell = snapshot.cells.find((cell) => cell.playerId === ownPlayerId);
    if (ownPlayerId === null || balance === null || ownCell === undefined || !isPredictable(ownCell)) {
      this.base = null;
      this.correction.reset();
      return;
    }
    this.base = { snapshot, ownCell, balance };
    this.acknowledgedSequence = snapshot.appliedInputSequenceByPlayer[ownPlayerId] ?? 0;
    this.markArrival(arrival);
    // The acknowledged input stays: it is the target the server holds latched.
    this.inputs = this.inputs.filter((input) => input.sequence >= this.acknowledgedSequence);
    const next = this.easedPosition();
    if (next !== null)
      this.correction.rebase(previousCellId === ownCell.id ? shown : null, next, this.clock.nowMilliseconds());
  }

  /** Moves the stall bound's origin on a real arrival only; never below the acknowledged sequence. */
  private markArrival(arrival: SnapshotPushOutcome): void {
    const arrivedAt = arrival === SNAPSHOT_PUSH.appended ? this.newestSequence : this.newestSequenceAtArrival;
    // Never below the acknowledged one: a fresh store (a `game_state`) has sent nothing yet but still predicts.
    this.newestSequenceAtArrival = Math.max(arrivedAt, this.acknowledgedSequence);
  }

  /** Ticks to replay past the acknowledged input: every unacknowledged one, within the stall and horizon bounds. */
  private stepsToPredict(): number {
    const unacknowledged = this.newestSequence - this.acknowledgedSequence;
    const stallBound = this.newestSequenceAtArrival - this.acknowledgedSequence + PREDICTION_STALL_TICKS;
    return Math.max(0, Math.min(unacknowledged, stallBound, MAX_PREDICTION_TICKS));
  }

  private predictedPoses(): PredictedPoses | null {
    const base = this.base;
    if (base === null) return null;
    const cached = this.cached;
    if (cached?.base === base && cached.newestSequence === this.newestSequence) return cached.poses;
    const poses = predictOwnPoses(base, this.inputs, this.acknowledgedSequence, this.stepsToPredict());
    this.cached = { base, newestSequence: this.newestSequence, poses };
    return poses;
  }

  /** The own cell's predicted pose, uncorrected: what the steer target hangs off. `null` when not predicting. */
  predictedPose(): MovementPose | null {
    return this.predictedPoses()?.current ?? null;
  }

  /**
   * How far the drawn pose is from the tick before the newest input to its tick: 0 when it was just sent, 1 a tick
   * later. 1 when the newest input is past the stall or horizon bound, since then no tick was added for it.
   */
  private easeIntoNewestTick(): number {
    if (this.stepsToPredict() < this.newestSequence - this.acknowledgedSequence) return 1;
    const elapsed = (this.clock.nowMilliseconds() - this.newestSentAtMs) / TICK_INTERVAL_MS;
    return Math.min(1, Math.max(0, elapsed));
  }

  /** The prediction eased into the newest tick, before the reconciliation offset. */
  private easedPosition(): Vec2 | null {
    const poses = this.predictedPoses();
    if (poses === null) return null;
    const ease = this.easeIntoNewestTick();
    return { x: lerp(poses.previous.x, poses.current.x, ease), y: lerp(poses.previous.y, poses.current.y, ease) };
  }

  /** Where the own cell is drawn now: the eased prediction plus what is left of the reconciliation offset. */
  displayedPosition(): Vec2 | null {
    const eased = this.easedPosition();
    return eased === null ? null : this.correction.displayed(eased, this.clock.nowMilliseconds());
  }

  /**
   * The interpolated cells with the own cell at its displayed pose. A cell the own cell carries (engulfing it) moves
   * by the same shift, so the prey stays inside the membrane it is drawn in (docs/ecology/absorption.md §6.1).
   */
  applyTo(cells: readonly CellView[]): readonly CellView[] {
    const predicted = this.predictedPose();
    const displayed = this.displayedPosition();
    const ownCellId = this.base?.ownCell.id;
    const interpolatedOwn = cells.find((cell) => cell.id === ownCellId);
    this.lastFrame = { interpolated: interpolatedOwn ?? null, displayed };
    if (predicted === null || displayed === null || interpolatedOwn === undefined) return cells;
    const shiftX = displayed.x - interpolatedOwn.x;
    const shiftY = displayed.y - interpolatedOwn.y;
    return cells.map((cell) => {
      if (cell.id === ownCellId) {
        return {
          ...cell,
          x: displayed.x,
          y: displayed.y,
          velocityX: predicted.velocityX,
          velocityY: predicted.velocityY,
        };
      }
      return cell.engulfedByCellId === ownCellId ? { ...cell, x: cell.x + shiftX, y: cell.y + shiftY } : cell;
    });
  }

  debugState(): PredictionDebugState {
    const { acknowledgedSequence, newestSequence } = this;
    return { acknowledgedSequence, newestSequence, ...this.lastFrame };
  }

  reset(): void {
    this.inputs = [];
    this.newestSequence = 0;
    this.newestSentAtMs = 0;
    this.base = null;
    this.acknowledgedSequence = 0;
    this.newestSequenceAtArrival = 0;
    this.cached = null;
    this.correction.reset();
  }
}
