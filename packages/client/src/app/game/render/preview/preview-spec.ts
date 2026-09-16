// What an encyclopedia preview shows (docs/architecture/encyclopedia.md §12.7): data only. The encyclopedia's content
// imports it as a type; the preview seam (#363) turns a spec into a scene. `render/` imports nothing from
// `encyclopedia/`.

import type { BacteriumVariant, CellKind, DnaTag, FoodKind, OwnedTrait, ValueOf, ZoneId } from '@evolution/shared';

export const PREVIEW_SCENE = {
  /** One cell of a kind with owned traits, resting or swimming. */
  cell: 'cell',
  /** A cluster of one food kind (and variant), drifting as in play. */
  food: 'food',
  /** Fragments of one tag. */
  dnaFragment: 'dna_fragment',
  /** The camera parked inside one zone of the dish. */
  zone: 'zone',
  /** A cell swimming through motes: eat clips and effects. */
  eat: 'eat',
  /** Predator, prey, the three phases, absorbed ghost, prey respawn. */
  engulf: 'engulf',
  /** An engulf that ends in `cell_released`. */
  escape: 'escape',
  /** A sprint and its cooldown ring. */
  sprint: 'sprint',
  levelUp: 'level_up',
} as const;
export type PreviewScene = ValueOf<typeof PREVIEW_SCENE>;

export const PREVIEW_MOTION = { resting: 'resting', swimming: 'swimming' } as const;
export type PreviewMotion = ValueOf<typeof PREVIEW_MOTION>;

export type PreviewSpec =
  | {
      readonly scene: typeof PREVIEW_SCENE.cell;
      readonly cellKind: CellKind;
      readonly traits: readonly OwnedTrait[];
      readonly motion: PreviewMotion;
    }
  | {
      readonly scene: typeof PREVIEW_SCENE.food;
      readonly foodKind: FoodKind;
      readonly bacteriumVariant: BacteriumVariant | null;
    }
  | { readonly scene: typeof PREVIEW_SCENE.dnaFragment; readonly tag: DnaTag }
  | { readonly scene: typeof PREVIEW_SCENE.zone; readonly zone: ZoneId }
  | {
      readonly scene: Exclude<
        PreviewScene,
        | typeof PREVIEW_SCENE.cell
        | typeof PREVIEW_SCENE.food
        | typeof PREVIEW_SCENE.dnaFragment
        | typeof PREVIEW_SCENE.zone
      >;
    };
