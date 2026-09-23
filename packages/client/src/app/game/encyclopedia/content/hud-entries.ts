// How to read each HUD element (docs/architecture/encyclopedia.md §12.4, §12.6; docs/ui/hud.md §3.1.1–§3.1.4): one
// page per `HUD_TOPIC`, in the words the screen itself uses. What each page explains is anchored by
// `HUD_ELEMENT_BY_TOPIC`; the numbers the elements show are facts over the live balance. No number and no arithmetic
// here (lint).

import { CELL_KIND } from '@evolution/shared';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from '../../render/preview/preview-spec';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { CATALOG_QUANTITY } from '../facts/catalog-quantities';
import { FACT_FORMULA, LEVEL_SELECTOR } from '../facts/formula-table';
import type { WrittenEntryContent } from '../model/entry';
import { FACT_SOURCE } from '../model/fact';
import { HUD_TOPIC, type HudTopicId } from '../model/hud-topics';
import { balanceFact, formulaFact } from './fact-builders';

/** The own cell swimming: every indicator page shows the cell its indicator is drawn on. */
const OWN_CELL: PreviewSpec = {
  scene: PREVIEW_SCENE.cell,
  cellKind: CELL_KIND.player,
  traits: [],
  motion: PREVIEW_MOTION.swimming,
};

const MAX_LEVEL_FACT = balanceFact(
  { key: 'maxLevel', label: 'Highest level', unit: QUANTITY_UNIT.level },
  balancePath('progression', 'MAX_LEVEL'),
);

export const HUD_ENTRY_CONTENT: Readonly<Record<HudTopicId, WrittenEntryContent>> = {
  [HUD_TOPIC.dnaRing]: {
    title: 'DNA ring',
    summary:
      'The ring inside your cell fills with [[concept:dna_and_levels|DNA]] toward your next level, clockwise from the top. When it is full you level up: it flashes gold and starts again. Your first level costs {firstLevelUp}. At {maxLevel} it stays full, in gold.',
    facts: [
      formulaFact(
        { key: 'firstLevelUp', label: 'First level-up', unit: QUANTITY_UNIT.dna },
        { id: FACT_FORMULA.levelUpCostAt, argument: { level: LEVEL_SELECTOR.first } },
      ),
      MAX_LEVEL_FACT,
    ],
    sections: [],
    seeAlso: ['hud:level_numeral', 'concept:dna_and_levels'],
    preview: OWN_CELL,
  },
  [HUD_TOPIC.levelNumeral]: {
    title: 'Level numeral',
    summary:
      'The figure at the centre of the DNA ring is your level. It flashes with the ring when you level up, and you keep it when you die. The highest is {maxLevel}. The leaderboard shows it too.',
    facts: [MAX_LEVEL_FACT],
    sections: [],
    seeAlso: ['hud:dna_ring', 'hud:leaderboard', 'concept:dna_and_levels'],
    preview: OWN_CELL,
  },
  [HUD_TOPIC.ladderOrbit]: {
    title: 'Ladder orbit',
    summary:
      'The arc outside your cell shows your next step up the ladder of {stageCount} stages: a dashed outline of the organelle that takes you there. From the [[stage:prokaryote]] stage on, it also shows a counter for each bacterium that unlocks an organelle, [[bacterium:aerobic]] and [[bacterium:photosynthetic]]: {bacteriaToUnlock} pips, laid out in short rows. A pip lights for each one you eat; once every pip is lit, the outline rings gold until you pick that trait.',
    facts: [
      {
        key: 'bacteriaToUnlock',
        label: 'Pips to fill',
        unit: QUANTITY_UNIT.count,
        presentation: QUANTITY_PRESENTATION.plain,
        source: {
          kind: FACT_SOURCE.catalog,
          quantity: { id: CATALOG_QUANTITY.unlockCount, argument: { traitId: 'mitochondrion' } },
        },
      },
      {
        key: 'stageCount',
        label: 'Stages on the ladder',
        unit: QUANTITY_UNIT.count,
        presentation: QUANTITY_PRESENTATION.plain,
        source: { kind: FACT_SOURCE.catalog, quantity: { id: CATALOG_QUANTITY.stageCount, argument: {} } },
      },
    ],
    sections: [],
    seeAlso: ['stage:protocell', 'bacterium:aerobic', 'bacterium:photosynthetic'],
    preview: OWN_CELL,
  },
  [HUD_TOPIC.selfRing]: {
    title: 'Self ring',
    summary:
      'The dashed ring around your cell marks which cell is yours. It is also your sprint: full means ready. After a sprint it empties and refills over {sprintCooldown}.',
    facts: [
      balanceFact(
        { key: 'sprintCooldown', label: 'Sprint recharge', unit: QUANTITY_UNIT.seconds },
        balancePath('controls', 'SPRINT_COOLDOWN_SECONDS'),
      ),
    ],
    sections: [],
    seeAlso: ['cell_kind:player', 'hud:threat_ring'],
    preview: OWN_CELL,
  },
  [HUD_TOPIC.threatRing]: {
    title: 'Threat ring',
    summary:
      'A red ring around another cell means it can engulf you: it weighs at least {engulfRatio} your mass. The nearest one on screen is named beside its ring. Swim away, or grow until the ring is gone.',
    facts: [
      balanceFact(
        { key: 'engulfRatio', label: 'Threat at', unit: QUANTITY_UNIT.multiplier },
        balancePath('absorption', 'ENGULF_MASS_RATIO'),
      ),
    ],
    sections: [],
    seeAlso: ['concept:engulf_ratio', 'hud:self_ring'],
    preview: { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.wild, traits: [], motion: PREVIEW_MOTION.swimming },
  },
  [HUD_TOPIC.leaderboard]: {
    title: 'Leaderboard',
    summary:
      'Top right: the leading players by [[concept:score|score]], each with a swatch that matches their cell, their level and their score. Your own row is always shown. Hold Tab for the full list, which adds mass and cells engulfed. Every player cell you engulf adds {engulfBonus}.',
    facts: [
      balanceFact(
        { key: 'engulfBonus', label: 'Per engulf', unit: QUANTITY_UNIT.points },
        balancePath('session', 'SCORE_ABSORPTION_BONUS'),
      ),
    ],
    sections: [],
    seeAlso: ['concept:score', 'hud:round_clock'],
    preview: null,
  },
  [HUD_TOPIC.roundClock]: {
    title: 'Round clock',
    summary:
      'Bottom right: the time left in the [[world:round|round]]. Once the [[world:bloom|bloom]] starts, {bloomStart} of the way through, it turns gold and its caption says how much faster food and DNA spawn.',
    facts: [
      balanceFact(
        { key: 'roundLength', label: 'Default round', unit: QUANTITY_UNIT.clock },
        balancePath('session', 'ROUND_DURATION_SECONDS'),
      ),
      balanceFact(
        { key: 'bloomStart', label: 'Bloom starts this far in', unit: QUANTITY_UNIT.share },
        balancePath('session', 'ROUND_BLOOM_START_FRACTION'),
      ),
    ],
    sections: [],
    seeAlso: ['world:round', 'world:bloom', 'hud:leaderboard'],
    preview: null,
  },
};
