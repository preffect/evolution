// The abilities' copy (docs/architecture/encyclopedia.md §12.4, §12.6; docs/traits/model.md §2): what a trait grants,
// one page per `ABILITY`. Each page leads with the traits that grant it, a derived link over the live tier tables
// through `ABILITY_BY_MODIFIER`, then the base values the traits change. No number and no arithmetic here (lint).

import { CELL_KIND, ENGULF_PHASE, FIRST_TIER, type OwnedTrait } from '@evolution/shared';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from '../../render/preview/preview-spec';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { ABILITY, type AbilityId } from '../model/abilities';
import type { WrittenEntryContent } from '../model/entry';
import {
  ENGULF_RATIO_FACT,
  HELD_SPEED_FACT,
  MASS_YIELD_FACT,
  SPRINT_COOLDOWN_FACT,
  SPRINT_SPEED_FACT,
  STRUGGLE_FACT,
  grantedByFact,
  phaseSpanFact,
} from './action-facts';
import { GEL_SPEED_AT_MAX_FACT, STARTING_MASS_FACT, STARTING_SPEED_FACT, balanceFact } from './fact-builders';

/** A cell showing the ability: the first tier of a trait that grants it, or a bare cell where none is drawn. */
function cellShowing(traits: readonly OwnedTrait[]): PreviewSpec {
  return { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.player, traits, motion: PREVIEW_MOTION.swimming };
}

function firstTierOf(traitId: OwnedTrait['traitId']): readonly OwnedTrait[] {
  return [{ traitId, tier: FIRST_TIER }];
}

export const ABILITY_ENTRY_CONTENT: Readonly<Record<AbilityId, WrittenEntryContent>> = {
  [ABILITY.movement]: {
    title: 'Movement',
    summary:
      'How fast you swim and how quickly you turn. Every cell slows as it grows, from {startingSpeed} at the start; these traits push back.',
    facts: [
      grantedByFact(ABILITY.movement),
      STARTING_SPEED_FACT,
      balanceFact(
        { key: 'turnTime', label: 'Time to reach speed', unit: QUANTITY_UNIT.seconds },
        balancePath('growth', 'CELL_ACCELERATION_SECONDS'),
      ),
    ],
    sections: [],
    seeAlso: ['action:steer', 'concept:mass_and_size'],
    preview: cellShowing(firstTierOf('simple_flagellum')),
  },
  [ABILITY.sprint]: {
    title: 'Sprint',
    summary:
      'A burst of speed at {sprintSpeed} your top speed, ready again after {sprintCooldown}. These traits make the burst stronger or the wait shorter.',
    facts: [grantedByFact(ABILITY.sprint), SPRINT_SPEED_FACT, SPRINT_COOLDOWN_FACT],
    sections: [],
    seeAlso: ['action:sprint', 'hud:self_ring'],
    preview: { scene: PREVIEW_SCENE.sprint },
  },
  [ABILITY.engulfDefence]: {
    title: 'Engulf defence',
    summary:
      'What keeps you from being eaten. A predator needs {engulfRatio} your mass to start; once wrapped you swim at {heldSpeed} speed, and swimming away slows the swallow by {struggle}. These traits raise the ratio, loosen the grip, strengthen the struggle or slow your absorption.',
    facts: [grantedByFact(ABILITY.engulfDefence), ENGULF_RATIO_FACT, HELD_SPEED_FACT, STRUGGLE_FACT],
    sections: [],
    seeAlso: ['action:escape', 'concept:engulf_ratio'],
    preview: cellShowing(firstTierOf('cell_wall')),
  },
  [ABILITY.engulfGrip]: {
    title: 'Engulf grip',
    summary:
      'How well you hold and digest what you catch. An even wrap takes {wrapTime} and you keep {massYield} of your prey’s mass. These traits wrap faster, grip harder, absorb sooner or keep more.',
    facts: [grantedByFact(ABILITY.engulfGrip), phaseSpanFact(ENGULF_PHASE.wrap), MASS_YIELD_FACT],
    sections: [],
    seeAlso: ['action:engulf', 'concept:engulf_ratio'],
    preview: { scene: PREVIEW_SCENE.engulf },
  },
  [ABILITY.digestion]: {
    title: 'Digestion',
    summary:
      'How much you get from food and how slowly you lose it. These traits add mass to every mote you eat or slow your [[concept:mass_decay|decay]], which never takes you below {startingMass}.',
    facts: [grantedByFact(ABILITY.digestion), STARTING_MASS_FACT],
    sections: [],
    seeAlso: ['action:eat', 'concept:mass_decay'],
    preview: { scene: PREVIEW_SCENE.eat },
  },
  [ABILITY.photosynthesis]: {
    title: 'Photosynthesis',
    summary:
      'Growing on light. In the [[zone:sunlit_shallows]] these traits add mass every second without eating; anywhere else they do nothing.',
    facts: [grantedByFact(ABILITY.photosynthesis)],
    sections: [],
    seeAlso: ['zone:sunlit_shallows', 'bacterium:photosynthetic'],
    preview: cellShowing(firstTierOf('chloroplast')),
  },
  [ABILITY.spines]: {
    title: 'Spines',
    summary:
      'Spikes that make you a bad meal. A predator holding you loses mass to them every second, and may spit you out; it then cannot swallow you again for {spitOutRefractory}.',
    facts: [
      grantedByFact(ABILITY.spines),
      balanceFact(
        { key: 'spitOutRefractory', label: 'Safe after a spit-out', unit: QUANTITY_UNIT.seconds },
        balancePath('absorption', 'ENGULF_SPIT_OUT_REFRACTORY_SECONDS'),
      ),
    ],
    sections: [],
    seeAlso: ['action:escape', 'ability:toxin'],
    preview: cellShowing(firstTierOf('diatom_shell')),
  },
  [ABILITY.toxin]: {
    title: 'Toxin',
    summary:
      'Poison that drains the cells around you. Anything touching you loses a share of its mass every second, and a predator that swallows you takes a dose {swallowedDose} as strong. It never kills: it stops at the starting mass.',
    facts: [
      grantedByFact(ABILITY.toxin),
      balanceFact(
        { key: 'swallowedDose', label: 'Dose when swallowed', unit: QUANTITY_UNIT.multiplier },
        balancePath('absorption', 'ENGULF_SWALLOWED_TOXIN_MULTIPLIER'),
      ),
    ],
    sections: [],
    seeAlso: ['ability:spines', 'dna_tag:toxic'],
    preview: cellShowing(firstTierOf('toxin_vacuole')),
  },
  [ABILITY.foodAttraction]: {
    title: 'Food attraction',
    summary: 'Motes near you drift toward you on their own, so you gather food without chasing every one.',
    facts: [grantedByFact(ABILITY.foodAttraction)],
    sections: [],
    seeAlso: ['action:eat', 'concept:food'],
    preview: { scene: PREVIEW_SCENE.eat },
  },
  [ABILITY.genome]: {
    title: 'Genome',
    summary:
      'How your genes grow. These traits make every DNA gain bigger, or keep some of your progress toward the next level when you die.',
    facts: [grantedByFact(ABILITY.genome)],
    sections: [],
    seeAlso: ['concept:dna_and_levels', 'action:level_up'],
    preview: cellShowing(firstTierOf('nucleoid')),
  },
  [ABILITY.gelResistance]: {
    title: 'Gel resistance',
    summary:
      'Keeping your speed in the [[zone:viscous_gel]]. Without it a large cell crawls there ({gelSpeedAtMax} speed); these traits set a floor under that slowdown.',
    facts: [grantedByFact(ABILITY.gelResistance), GEL_SPEED_AT_MAX_FACT],
    sections: [],
    seeAlso: ['zone:viscous_gel', 'ability:movement'],
    preview: cellShowing(firstTierOf('amoeba_pseudopods')),
  },
};
