// The words on the relation rings (docs/ui/hud.md §3.1.5, the relation rings row): at most one label per kind, on
// the nearest cell of that kind. The ring already says edible or toxic by its shape; the label says it in words while
// the ring is new, and says what the ring cannot: that an edible cell is also toxic, or spiny (#154, the PR #389
// ruling). Pure over `relationsFor`'s nearest-first list, so the label always sits on a ring that is drawn.

import { EFFECT_KIND, type CellView, type EntityId, type GameEffect } from '@evolution/shared';
import { joinFacts } from './fact-line';
import type { Relation } from './relations-for';

/** The label pill's rim role: `GAIN` on the edible label, `DANGER` on the toxic one. */
export const RELATION_LABEL_RIM = { gain: 'gain', danger: 'danger' } as const;
export type RelationLabelRim = (typeof RELATION_LABEL_RIM)[keyof typeof RELATION_LABEL_RIM];

/** The label's words, uppercased by the `label` role when drawn. */
export const RELATION_LABEL_WORD = { edible: 'Edible', spiny: 'Spiny', toxic: 'Toxic' } as const;

export interface RelationLabel {
  readonly cellId: EntityId;
  /** `Edible`, `Edible · Spiny`, `Toxic`, `Edible · Toxic` or `Edible · Spiny · Toxic`. */
  readonly text: string;
  readonly rim: RelationLabelRim;
}

/** One label per kind; the threat's label stays the indicators' own (§3.1.2). */
export interface RelationLabels {
  readonly edible: RelationLabel | null;
  readonly toxic: RelationLabel | null;
}

export const NO_RELATION_LABELS: RelationLabels = { edible: null, toxic: null };

export interface RelationLabelsInput {
  /** `relationsFor`'s output, nearest first. */
  readonly relations: readonly Relation[];
  readonly ownCell: CellView;
  /** The player has engulfed a cell this session: the plain green line is learnt and `Edible` alone is not said again. */
  readonly hasEngulfed: boolean;
}

/** Whether `effects` carry an engulf the own cell completed: the `cell_absorbed` naming it as the predator. */
export function hasEngulfedIn(effects: readonly GameEffect[], ownCellId: EntityId): boolean {
  return effects.some((effect) => effect.kind === EFFECT_KIND.cellAbsorbed && effect.predatorCellId === ownCellId);
}

/** `Edible`, then `Spiny` when eating it drains the eater; a spine on a cell you cannot eat is not your problem. */
function edibleWords(relation: Relation): string[] {
  if (!relation.isEdible) return [];
  return relation.isSpiny ? [RELATION_LABEL_WORD.edible, RELATION_LABEL_WORD.spiny] : [RELATION_LABEL_WORD.edible];
}

function labelOf(
  relation: Relation | undefined,
  words: (found: Relation) => string[],
  rim: RelationLabelRim,
): RelationLabel | null {
  return relation === undefined ? null : { cellId: relation.cellId, text: joinFacts(words(relation)), rim };
}

/**
 * The toxic label on the nearest toxic cell, and the edible label on the nearest edible, non-toxic one. Once the player
 * has engulfed, the edible label is kept only for a spiny prey (the spine is not in the ring), so it moves to the
 * nearest spiny one. No label on the prey the own cell is already engulfing: it is known.
 */
export function relationLabelsFor(input: RelationLabelsInput): RelationLabels {
  const labelled = input.relations.filter((relation) => relation.cellId !== input.ownCell.engulfingCellId);
  const toxic = labelled.find((relation) => relation.isToxic);
  const edible = labelled.find(
    (relation) => relation.isEdible && !relation.isToxic && (!input.hasEngulfed || relation.isSpiny),
  );
  return {
    toxic: labelOf(toxic, (found) => [...edibleWords(found), RELATION_LABEL_WORD.toxic], RELATION_LABEL_RIM.danger),
    edible: labelOf(edible, edibleWords, RELATION_LABEL_RIM.gain),
  };
}
