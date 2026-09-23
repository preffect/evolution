// The world topics' copy (docs/architecture/encyclopedia.md §12.6; docs/ecology/food-and-spawn.md §3.1,
// docs/game-design/constants-and-acceptance.md §12): the dish, the world clock, the bloom and the round. No number
// and no arithmetic here (lint).

import { ZONE_ID } from '@evolution/shared';
import { PREVIEW_SCENE } from '../../render/preview/preview-spec';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { FACT_FORMULA, ROUND_MOMENT } from '../facts/formula-table';
import type { WrittenEntryContent } from '../model/entry';
import { WORLD_TOPIC, type WorldTopicId } from '../model/world-topics';
import { balanceFact, formulaFact } from './fact-builders';

export const WORLD_ENTRY_CONTENT: Readonly<Record<WorldTopicId, WrittenEntryContent>> = {
  [WORLD_TOPIC.dish]: {
    title: 'The dish',
    summary:
      'The whole world is one round petri dish, {dishRadius} from its centre to the wall. The [[zone:warm_vent]] sits at the centre, the [[zone:sunlit_shallows]] ring the rim, and patches of [[zone:viscous_gel]] dot the [[zone:open_broth]] between.',
    facts: [
      balanceFact(
        { key: 'dishRadius', label: 'Radius', unit: QUANTITY_UNIT.worldUnits },
        balancePath('world', 'DISH_RADIUS'),
      ),
    ],
    sections: [],
    seeAlso: ['zone:warm_vent', 'zone:sunlit_shallows', 'zone:viscous_gel', 'zone:open_broth'],
    preview: { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.openBroth },
  },
  [WORLD_TOPIC.worldClock]: {
    title: 'World clock',
    summary:
      'The dish evolves on its own. As the round runs, the world’s average cell gains {worldMassGain} and a level every {worldLevelTime}. The [[cell_kind:wild|wild cells]] follow it, and the food grows richer. A round of the default length ends with the world at {worldLevelAtEnd}, near {worldMassAtEnd}. Your aim is to stay ahead of it.',
    facts: [
      balanceFact(
        { key: 'worldLevelTime', label: 'Time per world level', unit: QUANTITY_UNIT.clock },
        balancePath('worldClock', 'WORLD_LEVEL_SECONDS'),
      ),
      balanceFact(
        { key: 'worldMassGain', label: 'World mass gain', unit: QUANTITY_UNIT.massPerSecond },
        balancePath('worldClock', 'WORLD_MASS_GAIN_PER_SECOND'),
      ),
      formulaFact(
        { key: 'worldLevelAtEnd', label: 'World level at the end of a default round', unit: QUANTITY_UNIT.level },
        { id: FACT_FORMULA.worldLevelAt, argument: { moment: ROUND_MOMENT.defaultRoundEnd } },
      ),
      formulaFact(
        { key: 'worldMassAtEnd', label: 'World mass at the end of a default round', unit: QUANTITY_UNIT.mass },
        { id: FACT_FORMULA.worldMassAt, argument: { moment: ROUND_MOMENT.defaultRoundEnd } },
      ),
    ],
    sections: [],
    seeAlso: ['concept:world_standing', 'cell_kind:wild', 'world:round'],
    preview: null,
  },
  [WORLD_TOPIC.bloom]: {
    title: 'Bloom',
    summary:
      'The last stretch of the round. From {bloomStart} of the way through, food spawns {bloomFood} as fast and DNA fragments {bloomFragments} as fast, though the dish holds no more than before. The round clock turns gold and reads BLOOM.',
    facts: [
      balanceFact(
        { key: 'bloomStart', label: 'Starts this far into the round', unit: QUANTITY_UNIT.share },
        balancePath('session', 'ROUND_BLOOM_START_FRACTION'),
      ),
      balanceFact(
        { key: 'bloomFood', label: 'Food spawning', unit: QUANTITY_UNIT.multiplier },
        balancePath('ecology', 'FOOD_BLOOM_SPAWN_MULTIPLIER'),
      ),
      balanceFact(
        { key: 'bloomFragments', label: 'DNA fragment spawning', unit: QUANTITY_UNIT.multiplier },
        balancePath('ecology', 'DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER'),
      ),
    ],
    sections: [],
    seeAlso: ['world:round', 'concept:food', 'entity:dna_fragment'],
    preview: null,
  },
  [WORLD_TOPIC.round]: {
    title: 'Round',
    summary:
      'A timed match in one dish, {roundLength} unless the room chose otherwise. When the clock runs out the highest [[concept:score|score]] wins, the results show for {resultsTime}, and a rematch begins in a fresh dish with everyone back at the start.',
    facts: [
      balanceFact(
        { key: 'roundLength', label: 'Default length', unit: QUANTITY_UNIT.clock },
        balancePath('session', 'ROUND_DURATION_SECONDS'),
      ),
      balanceFact(
        { key: 'resultsTime', label: 'Results shown for', unit: QUANTITY_UNIT.seconds },
        balancePath('session', 'RESULTS_SCREEN_SECONDS'),
      ),
    ],
    sections: [],
    seeAlso: ['world:bloom', 'world:world_clock', 'concept:score'],
    preview: null,
  },
};
