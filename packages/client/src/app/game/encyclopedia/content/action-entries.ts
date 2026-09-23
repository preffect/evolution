// The actions' copy (docs/architecture/encyclopedia.md §12.4, §12.6; docs/game-design/controls-and-scope.md §6,
// docs/ecology/absorption.md §6.1–§6.2, docs/PROGRESSION.md §4–§5): everything a player does, one page per `ACTION`.
// Key names come from the input layer's own codes (`format/key-names.ts`); every number is a fact over the live
// balance, the engulf's phase times through the shared span the engulf runs on. No number and no arithmetic (lint).

import { CELL_KIND, ENGULF_PHASE } from '@evolution/shared';
import { PREVIEW_MOTION, PREVIEW_SCENE } from '../../render/preview/preview-spec';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { KEY_NAMES } from '../format/key-names';
import { ACTION, type ActionId } from '../model/actions';
import type { WrittenEntryContent } from '../model/entry';
import {
  ENGULF_RATIO_FACT,
  MASS_YIELD_FACT,
  RELEASE_RATIO_FACT,
  SPRINT_COOLDOWN_FACT,
  SPRINT_COST_FACT,
  SPRINT_DURATION_FACT,
  SPRINT_SPEED_FACT,
  STRUGGLE_FACT,
  phaseSpanFact,
} from './action-facts';
import { ENGULF_BONUS_FACT, FIRST_LEVEL_UP_FACT, LAST_LEVEL_UP_FACT, balanceFact } from './fact-builders';

export const ACTION_ENTRY_CONTENT: Readonly<Record<ActionId, WrittenEntryContent>> = {
  [ACTION.steer]: {
    title: 'Steer',
    summary: `Your cell swims toward the pointer, or with ${KEY_NAMES.steerLetters} or the arrow keys. With the pointer, the farther it is from your cell the harder you swim: nothing inside {deadZone} of your centre, full speed from {fullThrottle} out.`,
    facts: [
      balanceFact(
        { key: 'fullThrottle', label: 'Full speed from', unit: QUANTITY_UNIT.radii },
        balancePath('controls', 'STEER_FULL_THROTTLE_RADII'),
      ),
      balanceFact(
        { key: 'deadZone', label: 'Standing still within', unit: QUANTITY_UNIT.radii },
        balancePath('controls', 'STEER_DEAD_ZONE_RADII'),
      ),
    ],
    sections: [],
    seeAlso: ['ability:movement', 'action:sprint'],
    preview: { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.player, traits: [], motion: PREVIEW_MOTION.swimming },
  },
  [ACTION.sprint]: {
    title: 'Sprint',
    summary: `Click, tap or press ${KEY_NAMES.sprint} for a burst at {sprintSpeed} your speed that lasts {sprintDuration}. It costs {sprintCost} of your mass, never below the starting mass, and recharges over {sprintCooldown}: the ring around your cell shows it. Sprinting is how you break away from a cell trying to engulf you.`,
    facts: [SPRINT_SPEED_FACT, SPRINT_DURATION_FACT, SPRINT_COST_FACT, SPRINT_COOLDOWN_FACT],
    sections: [],
    seeAlso: ['ability:sprint', 'hud:self_ring', 'action:escape'],
    preview: { scene: PREVIEW_SCENE.sprint },
  },
  [ACTION.eat]: {
    title: 'Eat',
    summary:
      'Swim over a mote and it is eaten the moment its centre is inside you, whatever your size. Its mass is added at once, and any DNA and tag point it carries go to your progress. [[concept:food]] lists what each kind gives.',
    facts: [
      balanceFact(
        { key: 'tagPoints', label: 'Tag points per mote', unit: QUANTITY_UNIT.points },
        balancePath('ecology', 'FOOD_TAG_POINTS'),
      ),
    ],
    sections: [],
    seeAlso: ['concept:food', 'ability:digestion', 'ability:food_attraction'],
    preview: { scene: PREVIEW_SCENE.eat },
  },
  [ACTION.engulf]: {
    title: 'Engulf',
    summary:
      'Swim over a cell you outweigh by {engulfRatio} until your membrane covers its centre, and you start to swallow it: cover, wrap, then a seal and absorb. In an even contest that takes {coverTime}, {wrapTime} and {absorbTime}; a much heavier predator is quicker. Once sealed the prey rides inside you and cannot swim free. You keep {massYield} of its mass, and a player cell adds {engulfBonus} to your score.',
    facts: [
      ENGULF_RATIO_FACT,
      phaseSpanFact(ENGULF_PHASE.cover),
      phaseSpanFact(ENGULF_PHASE.wrap),
      phaseSpanFact(ENGULF_PHASE.absorb),
      MASS_YIELD_FACT,
      ENGULF_BONUS_FACT,
      balanceFact(
        { key: 'dnaBase', label: 'Base DNA, player prey', unit: QUANTITY_UNIT.dna },
        balancePath('absorption', 'ENGULF_DNA_BASE'),
      ),
    ],
    sections: [],
    seeAlso: ['concept:engulf_ratio', 'ability:engulf_grip', 'action:escape'],
    preview: { scene: PREVIEW_SCENE.engulf },
  },
  [ACTION.escape]: {
    title: 'Escape',
    summary:
      'Caught before the seal, you can still get out. In the cover ({coverTime}) just swim clear. In the wrap ({wrapTime}) break contact and the hold slips away; swimming away also slows the swallow by {struggle}. After the seal only spines or poison free you, by making the predator let go or drop under {releaseRatio} your mass.',
    facts: [phaseSpanFact(ENGULF_PHASE.cover), phaseSpanFact(ENGULF_PHASE.wrap), STRUGGLE_FACT, RELEASE_RATIO_FACT],
    sections: [],
    seeAlso: ['action:sprint', 'ability:engulf_defence', 'ability:spines'],
    preview: { scene: PREVIEW_SCENE.escape },
  },
  [ACTION.pickTrait]: {
    title: 'Pick a trait',
    summary:
      'Each level-up offers {cardsPerOffer} trait cards. Click one or press its number key. If you wait {pickTimeout}, the likeliest card is picked for you. The game never pauses while you choose.',
    facts: [
      balanceFact(
        { key: 'cardsPerOffer', label: 'Cards per offer', unit: QUANTITY_UNIT.count },
        balancePath('progression', 'TRAIT_DRAFT_SIZE'),
      ),
      balanceFact(
        { key: 'pickTimeout', label: 'Picked for you after', unit: QUANTITY_UNIT.seconds },
        balancePath('progression', 'TRAIT_CHOICE_TIMEOUT_SECONDS'),
      ),
    ],
    sections: [],
    seeAlso: ['action:level_up', 'stage:protocell'],
    preview: null,
  },
  [ACTION.levelUp]: {
    title: 'Level up',
    summary:
      'Fill the [[hud:dna_ring|DNA ring]] and you level up: the first costs {firstLevelUp}, the last {lastLevelUp}. Extra DNA carries over, and each level queues a trait offer.',
    facts: [FIRST_LEVEL_UP_FACT, LAST_LEVEL_UP_FACT],
    sections: [],
    seeAlso: ['concept:dna_and_levels', 'action:pick_trait'],
    preview: { scene: PREVIEW_SCENE.levelUp },
  },
  [ACTION.respawn]: {
    title: 'Respawn',
    summary:
      'Engulfed, you watch your killer for {respawnDelay}, then return with your level and traits. You come back at {entryShare} of the world’s average mass, at most {entryMaxMass}, lifted to the world’s level if you had fallen behind. The DNA toward your next level is lost unless a trait keeps some.',
    facts: [
      balanceFact(
        { key: 'respawnDelay', label: 'Back after', unit: QUANTITY_UNIT.seconds },
        balancePath('session', 'RESPAWN_SPECTATE_SECONDS'),
      ),
      balanceFact(
        { key: 'entryShare', label: 'Mass, of the world’s', unit: QUANTITY_UNIT.share },
        balancePath('progression', 'ENTRY_MASS_FRACTION'),
      ),
      balanceFact(
        { key: 'entryMaxMass', label: 'Mass, at most', unit: QUANTITY_UNIT.mass },
        balancePath('progression', 'ENTRY_MAX_MASS'),
      ),
    ],
    sections: [],
    seeAlso: ['cell_kind:player', 'ability:genome'],
    preview: { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.player, traits: [], motion: PREVIEW_MOTION.resting },
  },
};
