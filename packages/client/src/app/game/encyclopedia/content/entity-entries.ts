// The DNA fragment's copy (docs/architecture/encyclopedia.md §12.6; docs/ecology/food-and-spawn.md §1–§3): the one
// `ENTITY_KIND` with no subject of its own. It has one section per DNA tag, built by `build-entries.ts` in the
// balance's tag order; the zones a tag's fragments form in are a derived link over the live tag tables. No number and
// no arithmetic here (lint).

import { DNA_TAG, ENTITY_KIND, type DnaTag } from '@evolution/shared';
import { PREVIEW_SCENE } from '../../render/preview/preview-spec';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { DERIVED_LINK } from '../facts/derived-links';
import type { SectionDefinition, WrittenEntryContent } from '../model/entry';
import { balanceFact, foundInFact, linkFact } from './fact-builders';
import { DNA_TAG_ENTRY_CONTENT } from './dna-tag-entries';

/** The entry without its tag sections, which `fragmentTagSection` writes one per tag. */
export const DNA_FRAGMENT_ENTRY_CONTENT: WrittenEntryContent = {
  title: 'DNA fragment',
  summary:
    'A loose strand of genetic code, drifting slowly. It has no mass but gives {fragmentDna}, and a tag point drawn from the zone it formed in, so where you feed shapes the traits you are offered. Found in {foundIn}. In the [[world:bloom|bloom]] fragments spawn {bloomFragments} as fast.',
  facts: [
    balanceFact(
      { key: 'fragmentDna', label: 'DNA', unit: QUANTITY_UNIT.dna },
      balancePath('ecology', 'DNA_FRAGMENT_DNA'),
    ),
    foundInFact(ENTITY_KIND.dnaFragment),
    balanceFact(
      { key: 'bloomFragments', label: 'Spawning in the bloom', unit: QUANTITY_UNIT.multiplier },
      balancePath('ecology', 'DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER'),
    ),
  ],
  sections: [],
  seeAlso: ['concept:dna_and_levels', 'concept:food'],
  preview: { scene: PREVIEW_SCENE.dnaFragment, tag: DNA_TAG.motile },
};

/** One tag's section: the zones whose fragments can carry it, and the tag page it feeds. */
export function fragmentTagSection(tag: DnaTag): SectionDefinition {
  return {
    key: tag,
    heading: DNA_TAG_ENTRY_CONTENT[tag].title,
    body: `Fragments that form in {tagZones} can carry this tag. [[dna_tag:${tag}]] lists the traits it favours.`,
    facts: [linkFact('tagZones', 'Formed in', { id: DERIVED_LINK.fragmentTagZones, argument: { tag } })],
    preview: { scene: PREVIEW_SCENE.dnaFragment, tag },
    tier: null,
  };
}
