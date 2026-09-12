// Absorbed prey keep drawing as ghosts (docs/RENDERING.md §2.3, docs/VISUAL-STYLE.md §5): the
// entity is gone on the payout tick, so the ghost is built from what the cell was last drawn
// with (its view, its organelle slots and its speckle seed, #243) and the `absorbed` clip, which
// also drives the predator's seal bump until the ghost leaves at 600 ms. The trait-pick preview
// ghost (#188) consumes the same registry.

import { MOTION_CLIPS, type CellView, type EntityId } from '@evolution/shared';
import { sampleClipTracks, type ClipTrackValues } from './cell-clips';
import type { OrganelleSlot } from './organelle-layout';

/** What a ghost is built from: the cell's last drawn view, its organelle slots and its speckle seed. */
export interface GhostSource {
  readonly view: CellView;
  readonly slots: readonly OrganelleSlot[];
  readonly speckleSeed: number;
}

export type GhostSourceOf = (cellId: EntityId) => GhostSource | undefined;

export interface Ghost extends GhostSource {
  /** The prey's last view, marked as engulfed by its predator. */
  readonly view: CellView;
  readonly predatorCellId: EntityId;
  readonly tracks: ClipTrackValues;
  /** Where the ghost sits from the predator, cell frame of the predator, radians. */
  readonly angleFromPredator: number;
}

interface GhostEntry extends GhostSource {
  readonly predatorCellId: EntityId;
  readonly angleFromPredator: number;
  readonly startMs: number;
}

/** The predator's seal (VISUAL-STYLE §5 "absorbed") with the angle it bulges at. */
export interface PredatorSeal {
  readonly seal: number;
  readonly angle: number;
}

export class GhostRegistry {
  private readonly ghosts = new Map<EntityId, GhostEntry>();

  /** Starts a ghost for `source` (the prey as last drawn) absorbed by `predator` at `nowMs`. */
  add(source: GhostSource, predator: Pick<CellView, 'id' | 'x' | 'y'>, nowMs: number): void {
    const { view } = source;
    this.ghosts.set(view.id, {
      ...source,
      view: { ...view, engulfedByCellId: predator.id },
      predatorCellId: predator.id,
      angleFromPredator: Math.atan2(view.y - predator.y, view.x - predator.x),
      startMs: nowMs,
    });
  }

  /** Every ghost still dissolving at `nowMs` with its clip tracks; finished ghosts are dropped. */
  active(nowMs: number): Ghost[] {
    const active: Ghost[] = [];
    for (const [id, entry] of this.ghosts) {
      const elapsedMs = nowMs - entry.startMs;
      if (elapsedMs >= MOTION_CLIPS.absorbed.duration) {
        this.ghosts.delete(id);
        continue;
      }
      active.push({ ...entry, tracks: sampleClipTracks(MOTION_CLIPS.absorbed, elapsedMs) });
    }
    return active;
  }

  /** The `seal` track per predator, the largest of the ghosts it is still absorbing. */
  static sealByPredator(ghosts: readonly Ghost[]): Map<EntityId, PredatorSeal> {
    const seals = new Map<EntityId, PredatorSeal>();
    for (const ghost of ghosts) {
      const seal = ghost.tracks['seal'] ?? 0;
      const current = seals.get(ghost.predatorCellId);
      if (current === undefined || seal > current.seal) {
        seals.set(ghost.predatorCellId, { seal, angle: ghost.angleFromPredator });
      }
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
