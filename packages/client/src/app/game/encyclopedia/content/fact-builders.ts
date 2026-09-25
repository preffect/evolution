// The fact shapes the written entries repeat (docs/architecture/encyclopedia.md §12.3): one balance leaf, one formula
// row or one derived link, each named by its key and label. A builder only assembles the definition; the value is
// still read from the live balance at resolve time. No number and no arithmetic here (lint).

import {
  QUANTITY_PRESENTATION,
  QUANTITY_UNIT,
  type QuantityPresentation,
  type QuantityUnit,
} from '../../quantities/quantity-unit';
import { balancePath, type BalancePath } from '../facts/balance-path';
import { DERIVED_LINK, type DerivedLinkCall } from '../facts/derived-links';
import { BALANCE_MASS, FACT_FORMULA, LEVEL_SELECTOR, type FactFormulaCall } from '../facts/formula-table';
import type { SpawnedKind } from '@evolution/shared';
import { FACT_SOURCE, type LinkFactDefinition, type ValueFactDefinition } from '../model/fact';

/** What names a fact and how its value reads: its key, label, unit and presentation (plain by default). */
export interface FactLabel {
  readonly key: string;
  readonly label: string;
  readonly unit: QuantityUnit;
  readonly presentation?: QuantityPresentation;
}

/** A value fact named by `label`, its value read from `source` at resolve time. */
function valueFact(label: FactLabel, source: ValueFactDefinition['source']): ValueFactDefinition {
  return {
    key: label.key,
    label: label.label,
    unit: label.unit,
    presentation: label.presentation ?? QUANTITY_PRESENTATION.plain,
    source,
  };
}

export function balanceFact(label: FactLabel, path: BalancePath): ValueFactDefinition {
  return valueFact(label, { kind: FACT_SOURCE.balance, path });
}

export function formulaFact(label: FactLabel, formula: FactFormulaCall): ValueFactDefinition {
  return valueFact(label, { kind: FACT_SOURCE.formula, formula });
}

export function linkFact(key: string, label: string, link: DerivedLinkCall): LinkFactDefinition {
  return { key, label, source: { kind: FACT_SOURCE.link, link } };
}

/** The mass every cell starts at and decay stops at: quoted by the mass pages and the player cell. */
export const STARTING_MASS_FACT = balanceFact(
  { key: 'startingMass', label: 'Starting mass', unit: QUANTITY_UNIT.mass },
  balancePath('growth', 'CELL_STARTING_MASS'),
);

/** Every cell's top speed, whatever its mass (#677). */
export const TOP_SPEED_FACT = balanceFact(
  { key: 'topSpeed', label: 'Top speed', unit: QUANTITY_UNIT.worldUnitsPerSecond },
  balancePath('growth', 'CELL_BASE_SPEED'),
);

/** The DNA a bacterium gives, whatever its variant. */
export const BACTERIUM_DNA_FACT = balanceFact(
  { key: 'bacteriumDna', label: 'DNA', unit: QUANTITY_UNIT.dna },
  balancePath('ecology', 'BACTERIUM_DNA'),
);

/** The zones a spawned kind can appear in. */
export function foundInFact(foodKind: SpawnedKind): LinkFactDefinition {
  return linkFact('foundIn', 'Found in', { id: DERIVED_LINK.foodZones, argument: { foodKind } });
}

/** What the first level-up costs: the DNA pages and the DNA ring both lead with it. */
export const FIRST_LEVEL_UP_FACT = formulaFact(
  { key: 'firstLevelUp', label: 'First level-up', unit: QUANTITY_UNIT.dna },
  { id: FACT_FORMULA.levelUpCostAt, argument: { level: LEVEL_SELECTOR.first } },
);

/** The score a player engulfed adds: the score page and the leaderboard quote it. */
export const ENGULF_BONUS_FACT = balanceFact(
  { key: 'engulfBonus', label: 'Per engulf', unit: QUANTITY_UNIT.points },
  balancePath('session', 'SCORE_ABSORPTION_BONUS'),
);

/** What the last level-up costs. */
export const LAST_LEVEL_UP_FACT = formulaFact(
  { key: 'lastLevelUp', label: 'Last level-up', unit: QUANTITY_UNIT.dna },
  { id: FACT_FORMULA.levelUpCostAt, argument: { level: LEVEL_SELECTOR.last } },
);

/** The gel's drag on the largest cell: the gel page and gel resistance quote it. */
export const GEL_SPEED_AT_MAX_FACT = formulaFact(
  {
    key: 'gelSpeedAtMax',
    label: 'Gel speed, largest cell',
    unit: QUANTITY_UNIT.multiplier,
    presentation: QUANTITY_PRESENTATION.changeFromOne,
  },
  { id: FACT_FORMULA.gelSpeedFactorAt, argument: { mass: BALANCE_MASS.max } },
);
