// The core rules' copy (docs/architecture/encyclopedia.md §12.4, §12.6; docs/ecology/mass-and-movement.md §4–§5,
// docs/PROGRESSION.md §1, docs/ecology/food-and-spawn.md §1, §3.1): the pages prose links "mass", "DNA" and "score" to.
// Every number is a fact bound to the live balance. No number and no arithmetic here (lint).

import { CELL_KIND, FOOD_KIND } from '@evolution/shared';
import { PREVIEW_MOTION, PREVIEW_SCENE } from '../../render/preview/preview-spec';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { BALANCE_MASS, FACT_FORMULA, LEVEL_SELECTOR } from '../facts/formula-table';
import { CONCEPT, type ConceptId } from '../model/concepts';
import type { WrittenEntryContent } from '../model/entry';
import {
  ENGULF_BONUS_FACT,
  FIRST_LEVEL_UP_FACT,
  STARTING_MASS_FACT,
  STARTING_SPEED_FACT,
  balanceFact,
  formulaFact,
} from './fact-builders';

const NO_SECTIONS: WrittenEntryContent['sections'] = [];

/** How far outside the world's average mass still reads as level with it; the standing sections all quote it. */
const STANDING_BAND = balanceFact(
  { key: 'standingBand', label: 'Mass band', unit: QUANTITY_UNIT.share },
  balancePath('worldClock', 'WORLD_STANDING_MASS_TOLERANCE'),
);

/** One written section with no facts or preview of its own: a world standing. */
function standingSection(key: string, heading: string, body: string): WrittenEntryContent['sections'][number] {
  return { key, heading, body, facts: [], preview: null, tier: null };
}

export const CONCEPT_ENTRY_CONTENT: Readonly<Record<ConceptId, WrittenEntryContent>> = {
  [CONCEPT.massAndSize]: {
    title: 'Mass and size',
    summary:
      'Mass is how much of you there is, and your size shows it: a heavier cell is wider and slower. You start at {startingMass} and grow to at most {maxMass}. Past that, any mass you gain turns into DNA instead.',
    facts: [
      STARTING_MASS_FACT,
      balanceFact(
        { key: 'maxMass', label: 'Largest mass', unit: QUANTITY_UNIT.mass },
        balancePath('growth', 'CELL_MAX_MASS'),
      ),
      STARTING_SPEED_FACT,
      formulaFact(
        { key: 'largestSpeed', label: 'Top speed at the largest mass', unit: QUANTITY_UNIT.worldUnitsPerSecond },
        { id: FACT_FORMULA.maxSpeedAtMass, argument: { mass: BALANCE_MASS.max } },
      ),
      formulaFact(
        { key: 'startingRadius', label: 'Radius at the start', unit: QUANTITY_UNIT.worldUnits },
        { id: FACT_FORMULA.radiusAtMass, argument: { mass: BALANCE_MASS.starting } },
      ),
      formulaFact(
        { key: 'largestRadius', label: 'Radius at the largest mass', unit: QUANTITY_UNIT.worldUnits },
        { id: FACT_FORMULA.radiusAtMass, argument: { mass: BALANCE_MASS.max } },
      ),
      balanceFact(
        { key: 'overflowDna', label: 'DNA per mass gained at the largest mass', unit: QUANTITY_UNIT.dna },
        balancePath('growth', 'MASS_OVERFLOW_DNA_PER_MASS'),
      ),
    ],
    sections: NO_SECTIONS,
    seeAlso: ['concept:mass_decay', 'concept:engulf_ratio', 'concept:food'],
    preview: { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.player, traits: [], motion: PREVIEW_MOTION.swimming },
  },
  [CONCEPT.massDecay]: {
    title: 'Mass decay',
    summary:
      'Mass above your starting size slowly wastes away, and the more you carry the faster it goes, so a big cell has to keep eating. Decay never takes you below {decayFloor}. In the [[zone:warm_vent]] it runs {ventDecayRate} as fast.',
    facts: [
      balanceFact(
        { key: 'decayFloor', label: 'Never below', unit: QUANTITY_UNIT.mass },
        balancePath('growth', 'CELL_STARTING_MASS'),
      ),
      balanceFact(
        { key: 'ventDecayRate', label: 'Decay in the warm vent', unit: QUANTITY_UNIT.multiplier },
        balancePath('ecology', 'VENT_DECAY_MULTIPLIER'),
      ),
    ],
    sections: NO_SECTIONS,
    seeAlso: ['concept:mass_and_size', 'zone:warm_vent'],
    preview: { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.player, traits: [], motion: PREVIEW_MOTION.resting },
  },
  [CONCEPT.engulfRatio]: {
    title: 'Engulf ratio',
    summary:
      'You can swallow a cell once you weigh at least {engulfRatio} its mass, and anything that much heavier than you can swallow you. A swallow already under way holds as long as the predator stays {releaseRatio} the prey’s mass. A [[trait:cell_wall]] raises the ratio needed to swallow you.',
    facts: [
      balanceFact(
        { key: 'engulfRatio', label: 'To engulf', unit: QUANTITY_UNIT.multiplier },
        balancePath('absorption', 'ENGULF_MASS_RATIO'),
      ),
      balanceFact(
        { key: 'releaseRatio', label: 'To keep hold', unit: QUANTITY_UNIT.multiplier },
        balancePath('absorption', 'ENGULF_RELEASE_RATIO'),
      ),
    ],
    sections: NO_SECTIONS,
    seeAlso: ['concept:mass_and_size', 'cell_kind:wild'],
    preview: null,
  },
  [CONCEPT.dnaAndLevels]: {
    title: 'DNA and levels',
    summary:
      'DNA is your experience. You earn it from bacteria, [[entity:dna_fragment|DNA fragments]], the cells you engulf and mass you gain at your largest. Each level costs more than the one before, from {firstLevelUp} up to {lastLevelUp}, until {maxLevel}. Every level-up offers you {cardsPerOffer} traits to pick from. When you die you keep your level, but the DNA toward the next one is lost unless a trait keeps some of it.',
    facts: [
      FIRST_LEVEL_UP_FACT,
      formulaFact(
        { key: 'lastLevelUp', label: 'Last level-up', unit: QUANTITY_UNIT.dna },
        { id: FACT_FORMULA.levelUpCostAt, argument: { level: LEVEL_SELECTOR.last } },
      ),
      balanceFact(
        { key: 'maxLevel', label: 'Highest level', unit: QUANTITY_UNIT.level },
        balancePath('progression', 'MAX_LEVEL'),
      ),
      balanceFact(
        { key: 'cardsPerOffer', label: 'Traits offered per level', unit: QUANTITY_UNIT.count },
        balancePath('progression', 'TRAIT_DRAFT_SIZE'),
      ),
    ],
    sections: NO_SECTIONS,
    seeAlso: ['concept:score', 'stage:protocell'],
    preview: null,
  },
  [CONCEPT.score]: {
    title: 'Score',
    summary:
      'Your score is all the DNA you earned this round, plus {engulfBonus} for every player cell you engulf. It is kept when you die, and the highest score wins the [[world:round|round]]. DNA handed to a late joiner to catch up never counts, and a [[cell_kind:wild|wild cell]] gives DNA but no bonus.',
    facts: [ENGULF_BONUS_FACT],
    sections: NO_SECTIONS,
    seeAlso: ['concept:dna_and_levels', 'world:round'],
    preview: null,
  },
  [CONCEPT.worldStanding]: {
    title: 'World standing',
    summary:
      'How you compare with the world’s average cell, which the [[world:world_clock|world clock]] grows as the round goes on. Level is compared first; at the world’s level, mass decides.',
    facts: [STANDING_BAND],
    sections: [
      standingSection(
        'ahead',
        'Ahead',
        'Your level is above the world’s, or you are at its level and heavier than its average cell by more than {standingBand}. [[cell_kind:wild|Wild cells]] light enough for you to engulf are your prey.',
      ),
      standingSection(
        'with',
        'With the world',
        'You are at the world’s level, and your mass is within {standingBand} of its average cell. Some wild cells can eat you, and you can eat some.',
      ),
      standingSection(
        'behind',
        'Behind',
        'Your level is below the world’s, or your mass is short of its average cell by more than {standingBand}. Wild cells heavy enough to engulf you are a threat: eat and level up to catch up.',
      ),
    ],
    seeAlso: ['world:world_clock', 'cell_kind:wild'],
    preview: null,
  },
  [CONCEPT.food]: {
    title: 'Food',
    summary:
      'Anything you swallow without a fight. Swim over a mote and it is eaten at once, whatever your size. [[food:algae|Algae]] gives mass, [[food:bacterium|bacteria]] give mass and DNA, [[food:detritus|detritus]] is what dead cells leave, and [[entity:dna_fragment|DNA fragments]] give DNA alone. In the [[world:bloom|bloom]] food spawns {bloomFood} as fast.',
    facts: [
      balanceFact(
        { key: 'bloomFood', label: 'In the bloom', unit: QUANTITY_UNIT.multiplier },
        balancePath('ecology', 'FOOD_BLOOM_SPAWN_MULTIPLIER'),
      ),
    ],
    sections: NO_SECTIONS,
    seeAlso: ['food:algae', 'food:bacterium', 'food:detritus', 'entity:dna_fragment'],
    preview: { scene: PREVIEW_SCENE.food, foodKind: FOOD_KIND.algae, bacteriumVariant: null },
  },
};
