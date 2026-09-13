// The own cell's sprint ring, per frame (docs/UI.md §3.1.2, docs/RENDERING.md §10): the recharged
// share, the `sprint_ready` brighten played off the render clock on the frame the fill reaches
// ready, and the predator whose warning ring hides while the own cell escapes. The fill and the
// escape belong to the `OwnCellIndicators` record; until the renderer receives it (#187) the source
// is read off the own view through the same `sprintFillFor` the record calls, so the two agree.

import {
  CELL_STATE,
  MOTION_CLIP,
  MOTION_CLIPS,
  type BalanceConfig,
  type CellView,
  type EntityId,
} from '@evolution/shared';
import { sprintFillFor } from '../../hud/format/sprint-fill';
import { SELF_RING_ALPHA } from '../constants';
import { FULL_SELF_RING, REST_OWN_CELL_RING, type OwnCellRing } from '../cells/self-ring';
import { MotionClipPlayer } from './motion-clip-player';

/** The record's fields the ring reads: `sprintFill`, `isSprinting` and `escape?.predatorCellId`, plus the escape switch. */
export interface OwnCellRingSource {
  readonly sprintFill: number;
  readonly isSprinting: boolean;
  readonly escapePredatorCellId: EntityId | null;
  /** `OwnCellRing.shouldHidePredatorRing`: whether the escape arc replaces the predator's warning ring. */
  readonly shouldHidePredatorRing: boolean;
}

/** The `sprint_ready` track the recharged arc's alpha follows (docs/RENDERING.md §4). */
const BRIGHTNESS_TRACK = 'selfRingBrightness';
/** No sprint ticks left: the same bound the record's `ownCellIndicatorsFor` reads `isSprinting` against. */
const EMPTY = 0;

// TODO(#187): flip to true in the PR that draws the escape arc. UI.md §3.1.2 hides the predator's warning ring only while
// the arc shows, so until the arc draws, hiding the ring would leave an engulfed own cell with no danger tell at all.
/** The one switch that lets the escape arc replace the engulfing predator's warning ring (docs/RENDERING.md §10). */
export const SHOULD_HIDE_PREDATOR_RING_DURING_ESCAPE = false;

// TODO(#187): take this from `RenderInputs.ownCellIndicators` once the HUD crossing lands, and delete the derivation.
/** The ring's source read off the own view; `null` without an own cell. */
export function ownCellRingSourceOf(
  ownCell: CellView | null,
  balance: Pick<BalanceConfig, 'controls'>,
): OwnCellRingSource | null {
  if (ownCell === null) return null;
  const isEscaping = ownCell.states.includes(CELL_STATE.beingEngulfed);
  return {
    sprintFill: sprintFillFor(ownCell, balance.controls),
    isSprinting: ownCell.sprintRemainingTicks > EMPTY,
    escapePredatorCellId: isEscaping ? ownCell.engulfedByCellId : null,
    shouldHidePredatorRing: SHOULD_HIDE_PREDATOR_RING_DURING_ESCAPE,
  };
}

/** Plays `sprint_ready` when the own cell's fill reaches ready and hands the cell layer the ring each frame. */
export class OwnCellRingTracker {
  private readonly player = new MotionClipPlayer();
  private cellId: EntityId | null = null;
  /** The previous frame's fill; `null` on the first frame of a cell, which never flashes. */
  private lastFill: number | null = null;

  update(ownCellId: EntityId | null, source: OwnCellRingSource | null, nowMs: number): OwnCellRing {
    if (ownCellId !== this.cellId || source === null) this.reset(ownCellId);
    if (source === null) return REST_OWN_CELL_RING;
    // Sprinting draws the full ring (docs/UI.md §3.1.2), so the flash waits for the cooldown after it.
    const fill = source.isSprinting ? FULL_SELF_RING : source.sprintFill;
    const isReachingReady = this.lastFill !== null && this.lastFill < FULL_SELF_RING && fill >= FULL_SELF_RING;
    if (isReachingReady) this.player.play(MOTION_CLIPS[MOTION_CLIP.sprintReady], nowMs);
    this.lastFill = fill;
    return {
      fill,
      brightness: this.player.sample(nowMs)[BRIGHTNESS_TRACK] ?? SELF_RING_ALPHA,
      escapePredatorCellId: source.escapePredatorCellId,
      shouldHidePredatorRing: source.shouldHidePredatorRing,
    };
  }

  private reset(cellId: EntityId | null): void {
    this.cellId = cellId;
    this.lastFill = null;
    this.player.clear();
  }
}
