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
import { BALANCE_MASS, FACT_FORMULA, type FactFormulaCall } from '../facts/formula-table';
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

/** A fresh cell's top speed. */
export const STARTING_SPEED_FACT = formulaFact(
  { key: 'startingSpeed', label: 'Top speed at the start', unit: QUANTITY_UNIT.worldUnitsPerSecond },
  { id: FACT_FORMULA.maxSpeedAtMass, argument: { mass: BALANCE_MASS.starting } },
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
