// Which clips each cell is playing (docs/rendering/contents-and-motion.md §4, docs/rendering/cells.md §2.1): one `MotionClipPlayer` per cell,
// started from the frame's effects (`cells/cell-effects.ts` names the clip and the mote angle),
// sampled into the frame's `CellDeformations` through `cells/cell-clips.ts` together with the
// engulf terms read off the views (`engulfProgress` remapped onto the clip at the room's seal, never the clock).
// The cell layer merges the result with its contact dents and ghost seals; a cell with nothing playing gets no
// entry and rests.

import {
  MOTION_CLIP,
  MOTION_CLIPS,
  engulfSealProgress,
  type BalanceConfig,
  type CellView,
  type EngulfPhaseSeconds,
  type EntityId,
} from '@evolution/shared';
import { REST_CLIP_INPUT, clipDeformation, engulfClipPosition, type CellClipInput } from '../cells/cell-clips';
import type { CellDeformation, CellDeformations } from '../cells/cell-deformation';
import type { CellClipStart } from '../cells/cell-effects';
import { ArmGripEasing, type ArmLetGo } from './arm-grip-easing';
import { MotionClipPlayer } from './motion-clip-player';

interface CellClipState {
  readonly player: MotionClipPlayer;
  /** Where the last eaten mote was (cell frame, radians), held while the `eat` clip plays. */
  moteAngle: number | null;
  /** The held arm's grip on the prey and the fan's turn to it, eased at the grab, the end and a switch (#768, #771). */
  readonly grip: ArmGripEasing;
}

export type CellViewsById = ReadonlyMap<EntityId, CellView>;

/** The `balance.absorption` rows the engulf's look reads: the phase seconds (the seal) and the body's coverage (the hold). */
export type EngulfLookBalance = EngulfPhaseSeconds & Pick<BalanceConfig['absorption'], 'ENGULF_COVERAGE_FRACTION'>;

type EngulfLookCell = Pick<CellView, 'x' | 'y' | 'radius'>;

/**
 * How far past `predator`'s body an arm must reach to hold `prey` (#753), in the predator's radii: to the prey's centre
 * and on by the coverage share of its radius, the span the server's `inContact` and `inGrab` measure; 0 once the body
 * covers it (ecology/absorption.md §6.1).
 */
export function armHoldRadii(predator: EngulfLookCell, prey: EngulfLookCell, coverageFraction: number): number {
  const reach = Math.hypot(prey.x - predator.x, prey.y - predator.y) + prey.radius * coverageFraction;
  return Math.max(0, reach / predator.radius - 1);
}

type EngulfInput = Pick<CellClipInput, 'preyAngle' | 'engulfClipPosition' | 'armHoldRadii'>;

const NOT_ENGULFING = { preyAngle: null, engulfClipPosition: null, armHoldRadii: REST_CLIP_INPUT.armHoldRadii };

/**
 * The engulf terms of a predator: the angle to its prey, where the prey's progress falls on the clip at the room's
 * seal and how far an arm must reach to hold it (`absorption` is the live balance's, so a patched phase second moves the
 * arms with the HUD); rest when it is not engulfing.
 */
export function engulfClipInput(cell: CellView, cellsById: CellViewsById, absorption: EngulfLookBalance): EngulfInput {
  const prey = cell.engulfingCellId === null ? undefined : cellsById.get(cell.engulfingCellId);
  if (prey === undefined) return NOT_ENGULFING;
  return {
    preyAngle: Math.atan2(prey.y - cell.y, prey.x - cell.x),
    engulfClipPosition: engulfClipPosition(prey.engulfProgress, engulfSealProgress(absorption)),
    armHoldRadii: armHoldRadii(cell, prey, absorption.ENGULF_COVERAGE_FRACTION),
  };
}

export function cellsById(cells: readonly CellView[]): CellViewsById {
  return new Map(cells.map((cell) => [cell.id, cell] as const));
}

export class CellClipTracker {
  private readonly states = new Map<EntityId, CellClipState>();

  private stateFor(cellId: EntityId): CellClipState {
    const existing = this.states.get(cellId);
    if (existing !== undefined) return existing;
    const state: CellClipState = { player: new MotionClipPlayer(), moteAngle: null, grip: new ArmGripEasing() };
    this.states.set(cellId, state);
    return state;
  }

  /** Starts every clip the frame's effects ask for; returns how many actually started. */
  start(starts: readonly CellClipStart[], nowMs: number): number {
    let started = 0;
    for (const { cellId, clipId, angle } of starts) {
      const state = this.stateFor(cellId);
      if (!state.player.play(MOTION_CLIPS[clipId], nowMs)) continue;
      if (clipId === MOTION_CLIP.eat) state.moteAngle = angle;
      started += 1;
    }
    return started;
  }

  /** The held arm's grip while engulfing (never `null` then), or its let-go once the engulf has ended; else `null`. */
  private gripOf(cell: CellView, engulf: EngulfInput, nowMs: number): ArmLetGo | null {
    if (engulf.preyAngle === null || cell.engulfingCellId === null)
      return this.states.get(cell.id)?.grip.letGo(nowMs) ?? null;
    return this.stateFor(cell.id).grip.hold(cell.engulfingCellId, engulf.preyAngle, engulf.armHoldRadii, nowMs);
  }

  /** The cell's running clips: their tracks and, while it eats, where the mote was. */
  private clipsOf(cellId: EntityId, nowMs: number): Pick<CellClipInput, 'tracks' | 'moteAngle'> {
    const state = this.states.get(cellId);
    if (state === undefined) return REST_CLIP_INPUT;
    const isEating = state.player.isPlaying(MOTION_CLIP.eat, nowMs);
    return { tracks: state.player.sample(nowMs), moteAngle: isEating ? state.moteAngle : null };
  }

  private deformationOf(
    cell: CellView,
    views: CellViewsById,
    nowMs: number,
    absorption: EngulfLookBalance,
  ): CellDeformation | null {
    const engulf = engulfClipInput(cell, views, absorption);
    const grip = this.gripOf(cell, engulf, nowMs);
    const clips = this.clipsOf(cell.id, nowMs);
    if (Object.keys(clips.tracks).length === 0 && grip === null) return null;
    const deformation = clipDeformation({ ...clips, absorbedSeal: null, ...engulf });
    return grip === null ? deformation : { ...deformation, ...grip };
  }

  /**
   * This frame's deformation per cell that is playing a clip or engulfing; states of cells no longer in
   * the frame are dropped. `absorption` is the frame's balance (the engulf seal); `views` is the frame's cells by id
   * (the renderer builds it once per frame).
   */
  deformations(
    cells: readonly CellView[],
    nowMs: number,
    absorption: EngulfLookBalance,
    views: CellViewsById = cellsById(cells),
  ): CellDeformations {
    for (const cellId of this.states.keys()) if (!views.has(cellId)) this.states.delete(cellId);
    const deformations = new Map<EntityId, CellDeformation>();
    for (const cell of cells) {
      const deformation = this.deformationOf(cell, views, nowMs, absorption);
      if (deformation !== null) deformations.set(cell.id, deformation);
    }
    return deformations;
  }

  /** How many cells hold a player, for a test or the bench. */
  get size(): number {
    return this.states.size;
  }

  clear(): void {
    this.states.clear();
  }
}
