// Which clips each cell is playing (docs/RENDERING.md §4, §2.1): one `MotionClipPlayer` per cell,
// started from the frame's effects (`cells/cell-effects.ts` names the clip and the mote angle),
// sampled into the frame's `CellDeformations` through `cells/cell-clips.ts` together with the
// engulf terms read off the views (`engulfProgress`, never the clock). The cell layer merges the
// result with its contact dents and ghost seals; a cell with nothing playing gets no entry and rests.

import { MOTION_CLIP, MOTION_CLIPS, type CellView, type EntityId } from '@evolution/shared';
import { clipDeformation, type CellClipInput } from '../cells/cell-clips';
import type { CellDeformation, CellDeformations } from '../cells/cell-deformation';
import type { CellClipStart } from '../cells/cell-effects';
import { MotionClipPlayer } from './motion-clip-player';

interface CellClipState {
  readonly player: MotionClipPlayer;
  /** Where the last eaten mote was (cell frame, radians), held while the `eat` clip plays. */
  moteAngle: number | null;
}

export type CellViewsById = ReadonlyMap<EntityId, CellView>;

/** The engulf terms of a predator: the angle to its prey and the prey's progress; rest when it is not engulfing. */
export function engulfClipInput(
  cell: CellView,
  cellsById: CellViewsById,
): Pick<CellClipInput, 'preyAngle' | 'engulfProgress'> {
  const prey = cell.engulfingCellId === null ? undefined : cellsById.get(cell.engulfingCellId);
  if (prey === undefined) return { preyAngle: null, engulfProgress: null };
  return { preyAngle: Math.atan2(prey.y - cell.y, prey.x - cell.x), engulfProgress: prey.engulfProgress };
}

export function cellsById(cells: readonly CellView[]): CellViewsById {
  return new Map(cells.map((cell) => [cell.id, cell] as const));
}

export class CellClipTracker {
  private readonly states = new Map<EntityId, CellClipState>();

  private stateFor(cellId: EntityId): CellClipState {
    const existing = this.states.get(cellId);
    if (existing !== undefined) return existing;
    const state: CellClipState = { player: new MotionClipPlayer(), moteAngle: null };
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

  private deformationOf(
    cell: CellView,
    state: CellClipState | undefined,
    views: CellViewsById,
    nowMs: number,
  ): CellDeformation | null {
    const tracks = state?.player.sample(nowMs) ?? {};
    const isEating = state?.player.isPlaying(MOTION_CLIP.eat, nowMs) ?? false;
    const engulf = engulfClipInput(cell, views);
    if (Object.keys(tracks).length === 0 && engulf.preyAngle === null) return null;
    return clipDeformation({
      tracks,
      moteAngle: isEating ? (state?.moteAngle ?? null) : null,
      absorbedSeal: null,
      ...engulf,
    });
  }

  /** This frame's deformation per cell that is playing a clip or engulfing; states of cells no longer in the frame are dropped. */
  deformations(cells: readonly CellView[], nowMs: number): CellDeformations {
    const views = cellsById(cells);
    for (const cellId of this.states.keys()) if (!views.has(cellId)) this.states.delete(cellId);
    const deformations = new Map<EntityId, CellDeformation>();
    for (const cell of cells) {
      const deformation = this.deformationOf(cell, this.states.get(cell.id), views, nowMs);
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
