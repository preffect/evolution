// The own cell's sprint ring, per frame (docs/ui/hud.md §3.1.2, docs/rendering/own-cell-indicators.md §10): the recharged
// share, the `sprint_ready` brighten played off the render clock on the frame the fill reaches
// ready, and the predator whose warning ring hides while the own cell escapes. The fill and the
// escape are the HUD's `OwnCellIndicators` record's (the fourth HUD crossing, #187), so what the
// ring draws and what the status mirror speaks can never disagree.

import { MOTION_CLIP, MOTION_CLIPS, type EntityId } from '@evolution/shared';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
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

/** The `sprint_ready` track the recharged arc's alpha follows (docs/rendering/contents-and-motion.md §4). */
const BRIGHTNESS_TRACK = 'selfRingBrightness';
/**
 * The escape arc replaces the engulfing predator's warning ring (docs/ui/hud.md §3.1.2): on, now that
 * `own-cell-indicators-layer.ts` draws the arc, so the own cell always has exactly one danger tell.
 */
export const SHOULD_HIDE_PREDATOR_RING_DURING_ESCAPE = true;

/** The ring's source from the HUD's record; `null` without one (spectating, before the first snapshot). */
export function ownCellRingSourceOf(indicators: OwnCellIndicators | null): OwnCellRingSource | null {
  if (indicators === null) return null;
  return {
    sprintFill: indicators.sprintFill,
    isSprinting: indicators.isSprinting,
    escapePredatorCellId: indicators.escape?.predatorCellId ?? null,
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
    // Sprinting draws the full ring (docs/ui/hud.md §3.1.2), so the flash waits for the cooldown after it.
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
