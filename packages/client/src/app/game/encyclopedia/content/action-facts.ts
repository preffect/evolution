// The facts an ability page and an action page both quote (docs/architecture/encyclopedia.md §12.3): the sprint's
// tunables, the engulf's ratios and phase spans. One definition each, so the two pages can never read differently.
// No number and no arithmetic here (lint).

import { ENGULF_PHASE, type EngulfPhase } from '@evolution/shared';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { DERIVED_LINK } from '../facts/derived-links';
import { FACT_FORMULA } from '../facts/formula-table';
import type { AbilityId } from '../model/abilities';
import type { FactDefinition } from '../model/fact';
import { balanceFact, formulaFact, linkFact } from './fact-builders';

/** The traits that grant an ability: every ability page leads with them. */
export function grantedByFact(abilityId: AbilityId): FactDefinition {
  return linkFact('grantedBy', 'Granted by', { id: DERIVED_LINK.abilityTraits, argument: { abilityId } });
}

export const SPRINT_SPEED_FACT = balanceFact(
  { key: 'sprintSpeed', label: 'Sprint speed', unit: QUANTITY_UNIT.multiplier },
  balancePath('controls', 'SPRINT_SPEED_MULTIPLIER'),
);

export const SPRINT_DURATION_FACT = balanceFact(
  { key: 'sprintDuration', label: 'Lasts', unit: QUANTITY_UNIT.seconds },
  balancePath('controls', 'SPRINT_DURATION_SECONDS'),
);

export const SPRINT_COOLDOWN_FACT = balanceFact(
  { key: 'sprintCooldown', label: 'Recharge', unit: QUANTITY_UNIT.seconds },
  balancePath('controls', 'SPRINT_COOLDOWN_SECONDS'),
);

export const SPRINT_COST_FACT = balanceFact(
  { key: 'sprintCost', label: 'Mass spent', unit: QUANTITY_UNIT.share },
  balancePath('controls', 'SPRINT_MASS_COST_FRACTION'),
);

export const ENGULF_RATIO_FACT = balanceFact(
  { key: 'engulfRatio', label: 'To engulf', unit: QUANTITY_UNIT.multiplier },
  balancePath('absorption', 'ENGULF_MASS_RATIO'),
);

export const RELEASE_RATIO_FACT = balanceFact(
  { key: 'releaseRatio', label: 'To keep hold', unit: QUANTITY_UNIT.multiplier },
  balancePath('absorption', 'ENGULF_RELEASE_RATIO'),
);

export const STRUGGLE_FACT = balanceFact(
  { key: 'struggle', label: 'Struggling slows it by', unit: QUANTITY_UNIT.share },
  balancePath('absorption', 'ENGULF_STRUGGLE_SLOWDOWN'),
);

export const MASS_YIELD_FACT = balanceFact(
  { key: 'massYield', label: 'Mass kept from prey', unit: QUANTITY_UNIT.share },
  balancePath('absorption', 'ENGULF_MASS_YIELD'),
);

const PHASE_FACT_KEY: Readonly<Record<EngulfPhase, string>> = {
  [ENGULF_PHASE.cover]: 'coverTime',
  [ENGULF_PHASE.wrap]: 'wrapTime',
  [ENGULF_PHASE.absorb]: 'absorbTime',
};

const PHASE_FACT_LABEL: Readonly<Record<EngulfPhase, string>> = {
  [ENGULF_PHASE.cover]: 'Cover',
  [ENGULF_PHASE.wrap]: 'Wrap',
  [ENGULF_PHASE.absorb]: 'Absorb',
};

/** One phase's time in an even contest, from the shared span the engulf itself runs on. */
export function phaseSpanFact(phase: EngulfPhase): FactDefinition {
  return formulaFact(
    { key: PHASE_FACT_KEY[phase], label: PHASE_FACT_LABEL[phase], unit: QUANTITY_UNIT.seconds },
    { id: FACT_FORMULA.engulfPhaseSpan, argument: { phase } },
  );
}

/** How much slower a held prey swims while wrapped. */
export const HELD_SPEED_FACT = balanceFact(
  {
    key: 'heldSpeed',
    label: 'Speed while wrapped',
    unit: QUANTITY_UNIT.multiplier,
    presentation: QUANTITY_PRESENTATION.changeFromOne,
  },
  balancePath('absorption', 'ENGULF_PREY_SPEED_FACTOR'),
);
