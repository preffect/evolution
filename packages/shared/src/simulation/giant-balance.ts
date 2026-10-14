// The giant-cell rules a balance must keep (docs/ecology/giants.md §3.5.14): every build a valid ladder (`ladderProblem`,
// the wild builds' rule too) ending in a form at real tiers, every born range ordered and inside [`CELL_STARTING_MASS`,
// `GIANT_MASS_CEILING`], every species speed multiplier at most 1. One home for the checks the balance test pins on
// `DEFAULT_BALANCE` (acceptance G14) and the server's `debug_set_balance` refuses a patch on, so the two cannot disagree;
// and, since those checks are what make it safe, the one reading of a build as owned traits, which the server seats a
// giant with and the encyclopedia quotes and previews.
// Pure: it reads only the balance it is given.

import type { BalanceConfig } from '../constants/balance.js';
import { GIANT_SPECIES_ORDER, type GiantSpecies, type OwnedTrait, type TraitTier } from '../types/game.js';
import { TRAIT_CATEGORY } from '../types/traits.js';
import { ladderProblem } from './ladder-check.js';
import { FIRST_TIER } from './trait-tiers.js';

type GiantBuildEntry = BalanceConfig['giants']['GIANT_BUILDS_BY_SPECIES'][GiantSpecies][number];

/** A species speed multiplier above this would break `interestMaxCellSpeedFor`'s bound (giants.md §3.5.14). */
const MAX_GIANT_SPEED_MULTIPLIER = 1;

/** Why an entry of the build has a tier no trait has; null when every tier is in `FIRST_TIER..TRAIT_TIER_COUNT`. */
function buildTierProblem(build: readonly GiantBuildEntry[], balance: BalanceConfig): string | null {
  const topTier = balance.traits.TRAIT_TIER_COUNT;
  const entry = build.find(({ tier }) => tier < FIRST_TIER || tier > topTier);
  return entry === undefined ? null : `${entry.traitId} tier ${entry.tier} is outside ${FIRST_TIER}..${topTier}`;
}

/** Why the species' build is not a valid ladder (`ladderProblem`) ending in a form, at real tiers; null when it is. */
function buildProblem(species: GiantSpecies, balance: BalanceConfig): string | null {
  const build = balance.giants.GIANT_BUILDS_BY_SPECIES[species];
  const gap = [...build.keys()].find((index) => build[index] === undefined);
  if (gap !== undefined) return `${species} build: entry ${gap} is missing`;
  const traitIds = build.map(({ traitId }) => traitId);
  const problem = ladderProblem(traitIds, balance) ?? buildTierProblem(build, balance);
  if (problem !== null) return `${species} build: ${problem}`;
  const last = build[build.length - 1];
  const lastTrait = balance.traits.TRAIT_CATALOG.find((row) => row.id === last?.traitId);
  return lastTrait?.category === TRAIT_CATEGORY.form ? null : `${species} build does not end in a form`;
}

/** Why the species' born range is unordered or outside [`CELL_STARTING_MASS`, `GIANT_MASS_CEILING`]; null when fine. */
function bornRangeProblem(species: GiantSpecies, balance: BalanceConfig): string | null {
  const minimum = balance.giants.GIANT_BORN_MASS_MIN_BY_SPECIES[species];
  const maximum = balance.giants.GIANT_BORN_MASS_MAX_BY_SPECIES[species];
  const floor = balance.growth.CELL_STARTING_MASS;
  const ceiling = balance.giants.GIANT_MASS_CEILING;
  if (minimum > maximum) return `${species} born mass minimum ${minimum} is above its maximum ${maximum}`;
  if (minimum < floor || maximum > ceiling) {
    return `${species} born mass [${minimum}, ${maximum}] is outside [CELL_STARTING_MASS ${floor}, GIANT_MASS_CEILING ${ceiling}]`;
  }
  return null;
}

function speedMultiplierProblem(species: GiantSpecies, balance: BalanceConfig): string | null {
  const multiplier = balance.giants.GIANT_SPEED_MULTIPLIER_BY_SPECIES[species];
  return multiplier > MAX_GIANT_SPEED_MULTIPLIER
    ? `${species} speed multiplier ${multiplier} is above ${MAX_GIANT_SPEED_MULTIPLIER}`
    : null;
}

/** Every giant rule `balance` breaks, one message each, by species; empty for a balance the giants can live on. */
export function giantBalanceProblems(balance: BalanceConfig): string[] {
  return GIANT_SPECIES_ORDER.flatMap((species) =>
    [
      buildProblem(species, balance),
      bornRangeProblem(species, balance),
      speedMultiplierProblem(species, balance),
    ].filter((problem): problem is string => problem !== null),
  );
}

/**
 * The species' build from the live balance as owned traits. The balance types a tier as a number; every tier is one a
 * trait has, since `debug_set_balance` refuses a patch that breaks a build (`giantBalanceProblems`).
 */
export function giantBuildOf(species: GiantSpecies, balance: BalanceConfig): OwnedTrait[] {
  return balance.giants.GIANT_BUILDS_BY_SPECIES[species].map(({ traitId, tier }) => ({
    traitId,
    tier: tier as TraitTier,
  }));
}
