// The ladder orbit (docs/ui/hud.md §3.1.2): the next rung's ghost and the endosymbiont counters that
// ride the orbit around the player's own cell. One half of the `OwnCellIndicators` record, beside the
// legibility cues (`legibility-cues.ts`), kept here because the rung rules, the catalog gate and the
// orbit angles are a sub-domain of their own — the record just asks for `ladderFor(...)`.
//
// Pure and DOM-free: the renderer computes geometry from what this returns and nothing else
// (docs/rendering/own-cell-indicators.md §10).

import {
  CELL_STAGE,
  STAGE_GATE_TRAITS,
  TRAIT_CATALOG,
  hasReachedStage,
  nextStage,
  type BacteriumVariant,
  type CellStage,
  type OwnedTrait,
  type TraitDefinition,
  type TraitId,
  type ValueOf,
} from '@evolution/shared';
import { LADDER_ORBIT_ANGLES_PAIR_DEG, LADDER_ORBIT_ANGLE_SINGLE_DEG } from '../render/constants';

/** The pair angles of docs/ui/components-and-constants.md §9, reachable by any variant; `plain` has no counter of its own. */
const ORBIT_ANGLE_BY_VARIANT: Partial<Record<BacteriumVariant, number>> = LADDER_ORBIT_ANGLES_PAIR_DEG;

/** What the next rung draws, by stage (docs/ui/hud.md §3.1.4). */
export const LADDER_SILHOUETTE = { nucleoid: 'nucleoid', envelope: 'envelope', form: 'form' } as const;
export type LadderSilhouette = ValueOf<typeof LADDER_SILHOUETTE>;

export interface LadderCounter {
  /** `mitochondrion` or `chloroplast`: the endosymbiont this tally unlocks. */
  readonly traitId: TraitId;
  readonly variant: BacteriumVariant;
  readonly eaten: number;
  readonly required: number;
  /** From `LADDER_ORBIT_ANGLES_PAIR_DEG`; clockwise from 12 o'clock (docs/ui/hud.md §3.1.2). */
  readonly angleDeg: number;
  /** The picker is previewing this endosymbiont, so its ghost hides and its pips stay. */
  readonly isGhostHidden: boolean;
  /** `eaten >= required`: the ghost takes its unlock ring until the trait is picked. */
  readonly isUnlocked: boolean;
}

/** The next rung's dashed silhouette, at `LADDER_ORBIT_ANGLE_SINGLE_DEG`. */
export interface LadderGhost {
  readonly silhouette: LadderSilhouette;
  readonly angleDeg: number;
}

/**
 * The ladder orbit (docs/ui/hud.md §3.1.2): the next rung's ghost when that rung draws one, and a
 * counter for every endosymbiont the cell could still be offered. The two are independent
 * (decision #285 B): a cell promoted by one endosymbiont keeps the other's tally beside the
 * envelope ghost, and up the ladder, until it owns that one too. Both empty is the top.
 */
export interface Ladder {
  readonly ghost: LadderGhost | null;
  readonly counters: readonly LadderCounter[];
}

/**
 * The silhouette a rung draws as a ghost; `null` for the `endosymbiosis` rung, whose gate is drawn
 * as its counters instead.
 */
function silhouetteForRung(rung: CellStage): LadderSilhouette | null {
  if (rung === CELL_STAGE.prokaryote) return LADDER_SILHOUETTE.nucleoid;
  if (rung === CELL_STAGE.eukaryote) return LADDER_SILHOUETTE.envelope;
  // `specialised` holds five forms, so the ghost is keyed by the stage, never by one trait (§3.1.2).
  if (rung === CELL_STAGE.specialised) return LADDER_SILHOUETTE.form;
  return null;
}

function isTraitOwned(traits: readonly OwnedTrait[], traitId: TraitId): boolean {
  return traits.some((owned) => owned.traitId === traitId);
}

/**
 * One counter per endosymbiont the `endosymbiosis` gate names, in catalog order, for as long as the
 * draft could still offer it: from the stage the catalog opens it at (the server's draft filters by
 * the same `hasReachedStage`) until it is owned. So an owned endosymbiont drops its counter and the
 * other keeps its angle, whatever stage the first one promoted the cell to (decision #285 B). The
 * variant and the tally it needs come from the catalog's own `unlockedBy`, so the pairing has one home.
 */
function endosymbiosisCounters(
  stage: CellStage,
  traits: readonly OwnedTrait[],
  bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>>,
  previewTraitId: TraitId | null,
): readonly LadderCounter[] {
  const gate = STAGE_GATE_TRAITS[CELL_STAGE.endosymbiosis];
  const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
  return catalog
    .filter(
      (trait) => gate.includes(trait.id) && hasReachedStage(stage, trait.stage) && !isTraitOwned(traits, trait.id),
    )
    .flatMap((trait): LadderCounter[] => {
      const unlock = trait.unlockedBy;
      // Every endosymbiont in the gate has an `unlockedBy`; a future one that does not simply has
      // no tally to show, which is a missing counter rather than a wrong one.
      if (unlock === undefined) return [];
      // No angle for this variant means the orbit has nowhere to put it; falling back to the lone
      // ghost's 180 would stack two items on one spot with every constant still reading right.
      // Dropping it is the same treatment as the missing `unlockedBy` above: a missing counter.
      const angleDeg = ORBIT_ANGLE_BY_VARIANT[unlock.bacteriumVariant];
      if (angleDeg === undefined) return [];
      // A counter stays on the orbit until the trait is *picked*, not when it unlocks, so the raw
      // tally keeps climbing while the player is still at the vent. Clamp here rather than in the
      // display string: §3.1.2 draws exactly `required` pips in rows of five, so an unclamped
      // number is one the drawing side has no geometry for, and this record exists so the two
      // consumers cannot disagree. `isUnlocked` still reads the raw count, so topping out at
      // `10/10` does not lose the fact that the requirement is met.
      const rawEaten = bacteriaEatenByVariant[unlock.bacteriumVariant];
      return [
        {
          traitId: trait.id,
          variant: unlock.bacteriumVariant,
          eaten: Math.min(rawEaten, unlock.count),
          required: unlock.count,
          angleDeg,
          isGhostHidden: previewTraitId === trait.id,
          isUnlocked: rawEaten >= unlock.count,
        },
      ];
    });
}

/**
 * The next rung's ghost, or `null` at the top, on the counters' rung, or while the picker previews
 * a card whose trait is that rung's gate (the card shows the real organelle instead).
 */
function rungGhostFor(stage: CellStage, previewTraitId: TraitId | null): LadderGhost | null {
  const rung = nextStage(stage);
  const silhouette = rung === null ? null : silhouetteForRung(rung);
  if (rung === null || silhouette === null) return null;
  const isPreviewingThisRung = previewTraitId !== null && STAGE_GATE_TRAITS[rung].includes(previewTraitId);
  return isPreviewingThisRung ? null : { silhouette, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG };
}

/** The ladder orbit for a stage (docs/ui/hud.md §3.1.2): the rung ghost and the open counters. */
export function ladderFor(
  stage: CellStage,
  traits: readonly OwnedTrait[],
  bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>>,
  previewTraitId: TraitId | null,
): Ladder {
  return {
    ghost: rungGhostFor(stage, previewTraitId),
    counters: endosymbiosisCounters(stage, traits, bacteriaEatenByVariant, previewTraitId),
  };
}
