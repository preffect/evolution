// The bacterium variants' copy (docs/architecture/encyclopedia.md §12.6; docs/ecology/food-and-spawn.md §1, §3.2): the
// endosymbiosis hook. What a variant unlocks is a derived link over the live catalog's `unlockedBy`, never a trait
// written here. No number and no arithmetic here (lint).

import { BACTERIUM_VARIANT, FOOD_KIND, type BacteriumVariant } from '@evolution/shared';
import { PREVIEW_SCENE, type PreviewSpec } from '../../render/preview/preview-spec';
import { DERIVED_LINK } from '../facts/derived-links';
import type { WrittenEntryContent } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import type { FactDefinition } from '../model/fact';
import { BACTERIUM_DNA_FACT, linkFact } from './fact-builders';

/** The organelle a variant unlocks first (the landing tile's headline; none for plain), then the DNA each gives. */
function variantFacts(variant: BacteriumVariant): readonly FactDefinition[] {
  return [
    linkFact('unlocks', 'Unlocks', { id: DERIVED_LINK.variantUnlocks, argument: { variant } }),
    BACTERIUM_DNA_FACT,
  ];
}

function variantPreview(variant: BacteriumVariant): PreviewSpec {
  return { scene: PREVIEW_SCENE.food, foodKind: FOOD_KIND.bacterium, bacteriumVariant: variant };
}

/** Every variant page links back to the food it is a kind of. */
const BACTERIUM_ENTRY: EntryId = 'food:bacterium';

/** How the unlock is earned, the same for both organelle carriers. */
const HOW_UNLOCKS_COUNT =
  'Eat enough of them and {unlocks} can be offered to you as a trait. The count is kept when you die.';

export const BACTERIUM_ENTRY_CONTENT: Readonly<Record<BacteriumVariant, WrittenEntryContent>> = {
  plain: {
    title: 'Plain bacterium',
    summary:
      'The common pale rod. It feeds you like any [[food:bacterium|bacterium]] and adds a [[dna_tag:motile]] tag point, but unlocks nothing.',
    facts: variantFacts(BACTERIUM_VARIANT.plain),
    sections: [],
    seeAlso: [BACTERIUM_ENTRY, 'bacterium:aerobic', 'bacterium:photosynthetic'],
    preview: variantPreview(BACTERIUM_VARIANT.plain),
  },
  aerobic: {
    title: 'Aerobic bacterium',
    summary: `An orange-red rod that burns its food hot, crowded around the [[zone:warm_vent]] and, later in the round, scattered through the broth. Each adds a [[dna_tag:metabolic]] tag point. ${HOW_UNLOCKS_COUNT}`,
    facts: variantFacts(BACTERIUM_VARIANT.aerobic),
    sections: [],
    seeAlso: [BACTERIUM_ENTRY, 'stage:endosymbiosis', 'bacterium:photosynthetic'],
    preview: variantPreview(BACTERIUM_VARIANT.aerobic),
  },
  photosynthetic: {
    title: 'Photosynthetic bacterium',
    summary: `A green, banded rod that lives on light, gathered in the [[zone:sunlit_shallows]] and, later in the round, scattered through the broth. Each adds a [[dna_tag:photic]] tag point. ${HOW_UNLOCKS_COUNT}`,
    facts: variantFacts(BACTERIUM_VARIANT.photosynthetic),
    sections: [],
    seeAlso: [BACTERIUM_ENTRY, 'stage:endosymbiosis', 'bacterium:aerobic'],
    preview: variantPreview(BACTERIUM_VARIANT.photosynthetic),
  },
};
