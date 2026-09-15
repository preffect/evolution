// What the engulf trait rows share (docs/traits/constants-and-acceptance.md §6: T3, T4, T6, T13–T19, T21): the
// predator's mass under decay plus the contact drain and the swallowed dose, tick for tick as the metabolism
// step takes them (docs/ecology/mass-and-movement.md §4.1). Not a test file: the trait scenario files import it.

import { DEFAULT_BALANCE, TICK_INTERVAL_S } from '@evolution/shared';

const { growth, ecology } = DEFAULT_BALANCE;

/** The prey a dose is read against (#154): its start-of-span mass, decaying in the broth, and its fraction. */
export interface PreyDose {
  readonly preyMass: number;
  readonly fractionPerSecond: number;
}

/** A run of ticks at one contact drain (a share of the cell's own mass) and one prey-set dose. */
export interface DrainSpan {
  readonly ticks: number;
  readonly contactFractionPerSecond?: number;
  readonly dose?: PreyDose;
}

/** One tick of broth metabolism on `mass`: surplus decay plus `drainMassPerSecond`, floored. */
function afterOneTick(mass: number, drainMassPerSecond: number): number {
  const decay = Math.max(0, mass - growth.CELL_STARTING_MASS) * ecology.MASS_DECAY_RATE_PER_SECOND;
  return Math.max(growth.CELL_STARTING_MASS, mass - (decay + drainMassPerSecond) * TICK_INTERVAL_S);
}

/**
 * The mass after `spans` of broth metabolism: each tick removes the decay of the surplus, the contact drain of
 * the whole start-of-tick mass and the dose on the prey's start-of-tick mass, which decays as it goes.
 */
export function drainedMass(mass: number, spans: readonly DrainSpan[]): number {
  let current = mass;
  for (const span of spans) {
    let preyMass = span.dose?.preyMass ?? 0;
    for (let tick = 0; tick < span.ticks; tick += 1) {
      const dose = preyMass * (span.dose?.fractionPerSecond ?? 0);
      current = afterOneTick(current, current * (span.contactFractionPerSecond ?? 0) + dose);
      preyMass = afterOneTick(preyMass, 0);
    }
  }
  return current;
}
