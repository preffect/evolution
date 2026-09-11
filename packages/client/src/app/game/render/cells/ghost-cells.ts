// Absorbed prey keep drawing as ghosts (docs/RENDERING.md §2.3, docs/VISUAL-STYLE.md §5): the
// entity is gone on the payout tick, so the ghost is built from the cell's last view and the
// `absorbed` clip, which also drives the predator's seal bump until the ghost leaves at 600 ms.

import { MOTION_CLIPS, type CellView, type EntityId } from '@evolution/shared';
import { MotionClipPlayer, type ClipTrackValues } from '../effects/motion-clip-player';

export interface Ghost {
  readonly view: CellView;
  readonly predatorCellId: EntityId;
  readonly tracks: ClipTrackValues;
}

interface GhostEntry {
  readonly view: CellView;
  readonly predatorCellId: EntityId;
  readonly clips: MotionClipPlayer;
}

export class GhostRegistry {
  private readonly ghosts = new Map<EntityId, GhostEntry>();

  /** Starts a ghost for `view` (its last view) absorbed by `predatorCellId` at `nowMs`. */
  add(view: CellView, predatorCellId: EntityId, nowMs: number): void {
    const clips = new MotionClipPlayer();
    clips.play(MOTION_CLIPS.absorbed, nowMs);
    this.ghosts.set(view.id, { view: { ...view, engulfedByCellId: predatorCellId }, predatorCellId, clips });
  }

  /** Every ghost still dissolving at `nowMs` with its clip tracks; finished ghosts are dropped. */
  active(nowMs: number): Ghost[] {
    const active: Ghost[] = [];
    for (const [id, entry] of this.ghosts) {
      const tracks = entry.clips.sample(nowMs);
      if (entry.clips.activeCount === 0) {
        this.ghosts.delete(id);
        continue;
      }
      active.push({ view: entry.view, predatorCellId: entry.predatorCellId, tracks });
    }
    return active;
  }

  /** The `seal` track per predator, from the ghosts it is still absorbing. */
  sealByPredator(ghosts: readonly Ghost[]): Map<EntityId, number> {
    const seals = new Map<EntityId, number>();
    for (const ghost of ghosts) {
      const seal = ghost.tracks['seal'];
      if (seal !== undefined) seals.set(ghost.predatorCellId, Math.max(seal, seals.get(ghost.predatorCellId) ?? 0));
    }
    return seals;
  }

  get size(): number {
    return this.ghosts.size;
  }

  clear(): void {
    this.ghosts.clear();
  }
}
