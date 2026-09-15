// The DNA tags' copy (docs/architecture/encyclopedia.md §12.6, docs/PROGRESSION.md §1, §3). The traits a tag favours
// are a derived link over the live catalog, and the draft weighting reads the live progression leaves. No number and
// no arithmetic here (lint).

import type { DnaTag } from '@evolution/shared';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { DERIVED_LINK } from '../facts/derived-links';
import { FACT_SOURCE, type FactDefinition } from '../model/fact';
import type { ProseTemplate } from '../model/prose';

export interface DnaTagEntryContent {
  readonly title: string;
  readonly summary: ProseTemplate;
}

/**
 * The facts every tag page shows. The single-valued weighting comes first, so the landing tile's headline is not one
 * favoured trait out of several; the favoured traits follow as one row per trait (docs/ui/encyclopedia.md §11.4).
 */
export function dnaTagFacts(tag: DnaTag): readonly FactDefinition[] {
  return [
    {
      key: 'weightPerPoint',
      label: 'Card weight per tag point',
      unit: QUANTITY_UNIT.share,
      presentation: QUANTITY_PRESENTATION.signedChange,
      source: { kind: FACT_SOURCE.balance, path: balancePath('progression', 'TAG_WEIGHT_PER_POINT') },
    },
    {
      key: 'weightCap',
      label: 'Most tags can raise a card',
      unit: QUANTITY_UNIT.multiplier,
      presentation: QUANTITY_PRESENTATION.plain,
      source: { kind: FACT_SOURCE.balance, path: balancePath('progression', 'TAG_WEIGHT_MAX_MULTIPLIER') },
    },
    {
      key: 'favours',
      label: 'Favours',
      source: { kind: FACT_SOURCE.link, link: { id: DERIVED_LINK.tagTraits, argument: { tag } } },
    },
  ];
}

/** How tag points bias a draft, the same for every tag; the numbers are the facts beside it. */
const HOW_TAGS_WEIGH =
  'Tag points are never spent: the more you hold, the likelier cards carrying the tag are drawn. Engulfing a cell also takes a share of its tag points.';

export const DNA_TAG_ENTRY_CONTENT: Readonly<Record<DnaTag, DnaTagEntryContent>> = {
  motile: {
    title: 'Motile',
    summary: `Earned by eating plain bacteria and from DNA fragments in the open broth and the gel. It favours the movers: {favours}. ${HOW_TAGS_WEIGH}`,
  },
  photic: {
    title: 'Photic',
    summary: `Earned by eating algae and photosynthetic bacteria, and from DNA fragments in the sunlit shallows. It favours the light-eaters: {favours}. ${HOW_TAGS_WEIGH}`,
  },
  predatory: {
    title: 'Predatory',
    summary: `Earned by engulfing other cells and from DNA fragments at the warm vent. It favours the hunters: {favours}. ${HOW_TAGS_WEIGH}`,
  },
  armored: {
    title: 'Armored',
    summary: `Earned from DNA fragments in the open broth and the gel. It favours the defences: {favours}. ${HOW_TAGS_WEIGH}`,
  },
  toxic: {
    title: 'Toxic',
    summary: `Earned from DNA fragments at the warm vent. It favours the poisons: {favours}. ${HOW_TAGS_WEIGH}`,
  },
  sensory: {
    title: 'Sensory',
    summary: `Earned from DNA fragments in the sunlit shallows. It favours the senses: {favours}. ${HOW_TAGS_WEIGH}`,
  },
  metabolic: {
    title: 'Metabolic',
    summary: `Earned by eating aerobic bacteria and from DNA fragments at the warm vent. It favours the engines of the cell: {favours}. ${HOW_TAGS_WEIGH}`,
  },
};
