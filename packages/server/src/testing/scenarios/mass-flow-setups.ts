// E17's conservation check (docs/ecology/acceptance.md §8, #383, #416), shared by the rows of
// `ecology-mass-flow.gameplay.test.ts`. Each tick is checked against the mass captured the tick before, at full
// precision:
//
//   Δmass = Σ ratesPerSecond × TICK_INTERVAL_S + Σ own eat massGained + predatorMassGained − sprintSpent
//           + noDraftBonusGained
//
// Not a test file: the scenario file imports it.

import { EFFECT_KIND, TICK_INTERVAL_S } from '@evolution/shared';
import { cellOf, effectsOfKind, massFlowOf, massOf, type EvolutionView } from '../gameplay/evolution-views.js';
import type { placedSolo } from './shared-setups.js';

/** The causes must explain the change to float precision, far inside the tables' ± 0.01. */
export const CONSERVATION_TOLERANCE = 1e-6;

type RowBuilder = ReturnType<typeof placedSolo>;

const massLabel = (tick: number, playerIndex: number) => `player ${playerIndex} mass after tick ${tick}`;
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Δmass minus everything the snapshot says moved it; `undefined` before a mass was captured or without a cell. */
function unexplainedMass(view: EvolutionView, playerIndex: number): number | undefined {
  const cell = cellOf(view, playerIndex);
  const massBefore = view.captured(massLabel(view.tick - 1, playerIndex));
  if (cell === undefined || typeof massBefore !== 'number') {
    return undefined;
  }
  const flow = massFlowOf(view, playerIndex);
  const applied = sum(Object.values(flow?.ratesPerSecond ?? {})) * TICK_INTERVAL_S;
  const eaten = sum(
    effectsOfKind(view, EFFECT_KIND.eat)
      .filter((effect) => effect.cellId === cell.id)
      .map((effect) => effect.massGained),
  );
  const engulfed = sum(
    effectsOfKind(view, EFFECT_KIND.cellAbsorbed)
      .filter((effect) => effect.predatorCellId === cell.id)
      .map((effect) => effect.predatorMassGained),
  );
  const oneOff = (flow?.noDraftBonusGained ?? 0) - (flow?.sprintSpent ?? 0);
  return cell.mass - massBefore - (applied + eaten + engulfed + oneOff);
}

/** Runs `ticks` and checks every one of them against the mass captured the tick before. */
export function conservedEveryTick(builder: RowBuilder, ticks: number, playerIndex = 0): RowBuilder {
  let row = builder.advance(ticks);
  for (let tick = 1; tick <= ticks; tick += 1) {
    row = row
      .capture(massLabel(tick - 1, playerIndex), (view) => massOf(view, playerIndex))
      .atTick(tick - 1)
      .expect(`Δmass on tick ${tick} is the reported flow`, (view) => unexplainedMass(view, playerIndex))
      .atTick(tick)
      .toBeCloseTo(0, CONSERVATION_TOLERANCE);
  }
  return row;
}
