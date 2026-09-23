// The food kinds' copy (docs/architecture/encyclopedia.md §12.6; docs/ecology/food-and-spawn.md §1, §3): what each
// mote gives and where it spawns, the zones a derived link over the live spawn weights. The overview they all link
// from is `concept:food`. No number and no arithmetic here (lint).

import { BACTERIUM_VARIANT, FOOD_KIND, type FoodKind } from '@evolution/shared';
import { PREVIEW_SCENE } from '../../render/preview/preview-spec';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath, type BalanceConstantName } from '../facts/balance-path';
import type { FactDefinition } from '../model/fact';
import type { WrittenEntryContent } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import { BACTERIUM_DNA_FACT, balanceFact, foundInFact } from './fact-builders';

/** Every food page links back to the overview they are all read beside. */
const FOOD_OVERVIEW: EntryId = 'concept:food';

/** The mass one mote of a kind gives. */
function moteMassFact(key: string, constant: BalanceConstantName<'ecology'>): FactDefinition {
  return balanceFact({ key, label: 'Mass', unit: QUANTITY_UNIT.mass }, balancePath('ecology', constant));
}

export const FOOD_ENTRY_CONTENT: Readonly<Record<FoodKind, WrittenEntryContent>> = {
  algae: {
    title: 'Algae',
    summary:
      'Green motes that sit still and wait to be eaten. Each gives {algaeMass} and a [[dna_tag:photic]] tag point, but no DNA. Found in {foundIn}.',
    facts: [moteMassFact('algaeMass', 'ALGAE_MASS'), foundInFact(FOOD_KIND.algae)],
    sections: [],
    seeAlso: [FOOD_OVERVIEW, 'zone:sunlit_shallows'],
    preview: { scene: PREVIEW_SCENE.food, foodKind: FOOD_KIND.algae, bacteriumVariant: null },
  },
  bacterium: {
    title: 'Bacterium',
    summary:
      'Small rods that drift together in clusters of {clusterSize}. Each gives {bacteriumMass} and {bacteriumDna}, plus a tag point set by its kind: [[bacterium:plain|plain]], [[bacterium:aerobic|aerobic]] or [[bacterium:photosynthetic|photosynthetic]]. Eating enough aerobic or photosynthetic ones unlocks an organelle. Found in {foundIn}.',
    facts: [
      BACTERIUM_DNA_FACT,
      moteMassFact('bacteriumMass', 'BACTERIUM_MASS'),
      balanceFact(
        { key: 'clusterSize', label: 'Per cluster', unit: QUANTITY_UNIT.count },
        balancePath('ecology', 'BACTERIUM_CLUSTER_SIZE'),
      ),
      foundInFact(FOOD_KIND.bacterium),
    ],
    sections: [],
    seeAlso: [FOOD_OVERVIEW, 'stage:endosymbiosis'],
    preview: { scene: PREVIEW_SCENE.food, foodKind: FOOD_KIND.bacterium, bacteriumVariant: BACTERIUM_VARIANT.plain },
  },
  detritus: {
    title: 'Detritus',
    summary:
      'What a dead cell leaves behind: {detritusShare} of its mass, scattered as motes of {detritusMass}. Detritus gives no DNA and fades after {detritusLifetime}, so eat it while it lasts.',
    facts: [
      moteMassFact('detritusMass', 'DETRITUS_MOTE_MASS'),
      balanceFact(
        { key: 'detritusShare', label: 'Share of a dead cell’s mass', unit: QUANTITY_UNIT.share },
        balancePath('ecology', 'DETRITUS_MASS_FRACTION'),
      ),
      balanceFact(
        { key: 'detritusLifetime', label: 'Lasts', unit: QUANTITY_UNIT.seconds },
        balancePath('ecology', 'DETRITUS_LIFETIME_SECONDS'),
      ),
    ],
    sections: [],
    seeAlso: [FOOD_OVERVIEW, 'concept:engulf_ratio'],
    preview: { scene: PREVIEW_SCENE.food, foodKind: FOOD_KIND.detritus, bacteriumVariant: null },
  },
};
