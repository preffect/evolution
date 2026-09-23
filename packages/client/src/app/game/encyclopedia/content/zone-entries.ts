// The zones' copy (docs/architecture/encyclopedia.md §12.6; docs/ecology/food-and-spawn.md §2–§3.2,
// docs/ecology/mass-and-movement.md §4–§5): what each zone does to a cell, its share of the food and fragment spawns,
// its bacteria's variant row and the tags its fragments carry, each a fact over the live balance. No number and no
// arithmetic here (lint).

import { BACTERIUM_VARIANT, ENTITY_KIND, FOOD_KIND, ZONE_ID, type SpawnZoneId, type ZoneId } from '@evolution/shared';
import { PREVIEW_SCENE } from '../../render/preview/preview-spec';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { DERIVED_LINK } from '../facts/derived-links';
import { BALANCE_MASS, FACT_FORMULA } from '../facts/formula-table';
import type { WrittenEntryContent } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import type { FactDefinition } from '../model/fact';
import { GEL_SPEED_AT_MAX_FACT, balanceFact, formulaFact, linkFact } from './fact-builders';

/** Every zone page links back to the dish it sits in. */
const DISH_ENTRY: EntryId = 'world:dish';

/** The zone's share of every algae, bacterium and fragment spawn; the gel spawns as broth and has none. */
function spawnShareFacts(zone: SpawnZoneId): readonly FactDefinition[] {
  const shareOf = (key: string, label: string, kind: string): FactDefinition =>
    balanceFact(
      { key, label, unit: QUANTITY_UNIT.share },
      balancePath('ecology', 'FOOD_ZONE_WEIGHTS_BY_KIND', kind, zone),
    );
  return [
    shareOf('algaeShare', 'Algae share', FOOD_KIND.algae),
    shareOf('bacteriumShare', 'Bacteria share', FOOD_KIND.bacterium),
    shareOf('fragmentShare', 'Fragment share', ENTITY_KIND.dnaFragment),
  ];
}

function fragmentTagsFact(zone: ZoneId): FactDefinition {
  return linkFact('fragmentTags', 'Fragment tags', { id: DERIVED_LINK.zoneFragmentTags, argument: { zone } });
}

export const ZONE_ENTRY_CONTENT: Readonly<Record<ZoneId, WrittenEntryContent>> = {
  [ZONE_ID.sunlitShallows]: {
    title: 'Sunlit shallows',
    summary:
      'The bright ring around the rim of the dish, {shallowsWidth} wide. Light reaches here, so a [[trait:chloroplast]] feeds you, algae grow thick and [[bacterium:photosynthetic|photosynthetic bacteria]] gather. Safe, but a long swim around. Its fragments carry {fragmentTags} tags.',
    facts: [
      ...spawnShareFacts(ZONE_ID.sunlitShallows),
      balanceFact(
        { key: 'shallowsWidth', label: 'Width', unit: QUANTITY_UNIT.worldUnits },
        balancePath('ecology', 'SHALLOWS_WIDTH'),
      ),
      balanceFact(
        { key: 'photosyntheticShare', label: 'Of its bacteria, photosynthetic', unit: QUANTITY_UNIT.share },
        balancePath(
          'ecology',
          'BACTERIUM_VARIANT_WEIGHTS_BY_ZONE',
          ZONE_ID.sunlitShallows,
          BACTERIUM_VARIANT.photosynthetic,
        ),
      ),
      fragmentTagsFact(ZONE_ID.sunlitShallows),
    ],
    sections: [],
    seeAlso: [DISH_ENTRY, 'bacterium:photosynthetic', 'food:algae'],
    preview: { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.sunlitShallows },
  },
  [ZONE_ID.warmVent]: {
    title: 'Warm vent',
    summary:
      'The hot disc at the centre of the dish, {ventRadius} in radius. Mass decays {ventDecayRate} as fast here, but bacteria crowd in, [[bacterium:aerobic|aerobic bacteria]] most of all. Its fragments carry {fragmentTags} tags.',
    facts: [
      balanceFact(
        { key: 'ventDecayRate', label: 'Mass decay', unit: QUANTITY_UNIT.multiplier },
        balancePath('ecology', 'VENT_DECAY_MULTIPLIER'),
      ),
      balanceFact(
        { key: 'aerobicShare', label: 'Of its bacteria, aerobic', unit: QUANTITY_UNIT.share },
        balancePath('ecology', 'BACTERIUM_VARIANT_WEIGHTS_BY_ZONE', ZONE_ID.warmVent, BACTERIUM_VARIANT.aerobic),
      ),
      balanceFact(
        { key: 'ventRadius', label: 'Radius', unit: QUANTITY_UNIT.worldUnits },
        balancePath('ecology', 'VENT_RADIUS'),
      ),
      ...spawnShareFacts(ZONE_ID.warmVent),
      fragmentTagsFact(ZONE_ID.warmVent),
    ],
    sections: [],
    seeAlso: [DISH_ENTRY, 'concept:mass_decay', 'bacterium:aerobic'],
    preview: { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.warmVent },
  },
  [ZONE_ID.viscousGel]: {
    title: 'Viscous gel',
    summary:
      'Thick patches dotted through the broth that drag on whatever swims in them. A small cell barely notices ({gelSpeedAtStart} speed); a heavy one crawls ({gelSpeedAtMax} speed). Food spawns in the gel as it does in the broth, and its fragments carry {fragmentTags} tags.',
    facts: [
      GEL_SPEED_AT_MAX_FACT,
      formulaFact(
        {
          key: 'gelSpeedAtStart',
          label: 'Speed, new cell',
          unit: QUANTITY_UNIT.multiplier,
          presentation: QUANTITY_PRESENTATION.changeFromOne,
        },
        { id: FACT_FORMULA.gelSpeedFactorAt, argument: { mass: BALANCE_MASS.starting } },
      ),
      balanceFact(
        { key: 'gelPatches', label: 'Patches', unit: QUANTITY_UNIT.count },
        balancePath('ecology', 'GEL_PATCH_COUNT'),
      ),
      balanceFact(
        { key: 'gelRadius', label: 'Patch radius', unit: QUANTITY_UNIT.worldUnits },
        balancePath('ecology', 'GEL_PATCH_RADIUS'),
      ),
      fragmentTagsFact(ZONE_ID.viscousGel),
    ],
    sections: [],
    seeAlso: [DISH_ENTRY, 'concept:mass_and_size', 'zone:open_broth'],
    preview: { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.viscousGel },
  },
  [ZONE_ID.openBroth]: {
    title: 'Open broth',
    summary:
      'Everything that is not shallows, vent or gel: the open water where most of a round is played. Early on its bacteria are all plain; as the [[world:world_clock|world]] ages, aerobic and photosynthetic ones drift in too. Its fragments carry {fragmentTags} tags.',
    facts: [...spawnShareFacts(ZONE_ID.openBroth), fragmentTagsFact(ZONE_ID.openBroth)],
    sections: [],
    seeAlso: [DISH_ENTRY, 'zone:viscous_gel', 'food:bacterium'],
    preview: { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.openBroth },
  },
};
