// The giant-cell rules a balance must keep (docs/ecology/giants.md §3.5.14): every build a valid ladder ending in a form,
// every born range ordered and inside [`CELL_STARTING_MASS`, `GIANT_MASS_CEILING`], every species speed multiplier at
// most 1. One home for the checks the balance test pins on `DEFAULT_BALANCE` (acceptance G14) and the server's
// `debug_set_balance` refuses a patch on, so the two cannot disagree. Pure: it reads only the balance it is given.

import type { BalanceConfig } from '../constants/balance.js';
import { GIANT_SPECIES, type GiantSpecies, type TraitId } from '../types/game.js';
import { TRAIT_CATEGORY } from '../types/traits.js';
import { stageIndex, stageOf } from './stage-of.js';
import { FIRST_TIER } from './trait-tiers.js';

type GiantBuildEntry = BalanceConfig['giants']['GIANT_BUILDS_BY_SPECIES'][GiantSpecies][number];

/** The species the giant records are keyed by, in declaration order. */
const EVERY_GIANT_SPECIES: readonly GiantSpecies[] = Object.values(GIANT_SPECIES);
/** A species speed multiplier above this would break `interestMaxCellSpeedFor`'s bound (giants.md §3.5.14). */
const MAX_GIANT_SPEED_MULTIPLIER = 1;

/** Why one entry of a build cannot be owned after the entries before it; null when it can. */
function buildEntryProblem(entry: GiantBuildEntry, before: readonly TraitId[], balance: BalanceConfig): string | null {
  const trait = balance.traits.TRAIT_CATALOG.find((row) => row.id === entry.traitId);
  if (trait === undefined) return `${entry.traitId} is not in the trait catalog`;
  if (before.includes(entry.traitId)) return `${entry.traitId} is listed twice`;
  if (entry.tier < FIRST_TIER || entry.tier > balance.traits.TRAIT_TIER_COUNT) {
    return `${entry.traitId} tier ${entry.tier} is outside ${FIRST_TIER}..${balance.traits.TRAIT_TIER_COUNT}`;
  }
  if (stageIndex(trait.stage) > stageIndex(stageOf(before, balance.ladder))) {
    return `${entry.traitId} needs stage ${trait.stage} before it`;
  }
  const missing = trait.requires.filter((requiredId) => !before.includes(requiredId));
  return missing.length === 0 ? null : `${entry.traitId} requires ${missing.join(', ')} before it`;
}

/** Why the species' build is not a valid ladder ending in a form; null when it is. */
function buildProblem(species: GiantSpecies, balance: BalanceConfig): string | null {
  const build = balance.giants.GIANT_BUILDS_BY_SPECIES[species];
  for (const [index, entry] of build.entries()) {
    const problem = buildEntryProblem(
      entry,
      build.slice(0, index).map(({ traitId }) => traitId),
      balance,
    );
    if (problem !== null) return `${species} build: ${problem}`;
  }
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
  return EVERY_GIANT_SPECIES.flatMap((species) =>
    [
      buildProblem(species, balance),
      bornRangeProblem(species, balance),
      speedMultiplierProblem(species, balance),
    ].filter((problem): problem is string => problem !== null),
  );
}
