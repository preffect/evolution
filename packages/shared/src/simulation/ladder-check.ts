// The one "valid ladder" rule a fixed build keeps (docs/ecology/wild-cells.md §3.3, docs/ecology/giants.md §3.5.14):
// every pick is in the catalog, picked once, and reachable from the picks before it (its stage reached, its `requires`
// owned, no other owned trait of its exclusion group). The wild builds' test and `giantBalanceProblems` both call it,
// so the two kinds of build cannot be held to different ladders; the server's draft asks `traitPickProblem` of every
// card it offers (docs/PROGRESSION.md §3). Pure: it reads only the balance it is given.

import type { BalanceConfig } from '../constants/balance.js';
import type { TraitId } from '../types/game.js';
import type { TraitDefinition } from '../types/traits.js';
import { stageIndex, stageOf } from './stage-of.js';

/** The catalog and the ladder a build is checked against. */
export type LadderCheckBalance = Pick<BalanceConfig, 'traits' | 'ladder'>;

/** Why `trait` cannot be picked after `before` (the picks ahead of it, or a cell's owned ids); null when it can. */
export function traitPickProblem(
  trait: TraitDefinition,
  before: readonly TraitId[],
  balance: LadderCheckBalance,
): string | null {
  if (before.includes(trait.id)) return `${trait.id} is listed twice`;
  if (stageIndex(trait.stage) > stageIndex(stageOf(before, balance.ladder))) {
    return `${trait.id} needs stage ${trait.stage} before it`;
  }
  const missing = trait.requires.filter((requiredId) => !before.includes(requiredId));
  if (missing.length > 0) return `${trait.id} requires ${missing.join(', ')} before it`;
  return exclusionProblem(trait, before, balance);
}

/** Why `trait` shares its exclusion group with a pick before it; null when it has no group or the group is free. */
function exclusionProblem(
  trait: TraitDefinition,
  before: readonly TraitId[],
  balance: LadderCheckBalance,
): string | null {
  const group = trait.exclusionGroup;
  if (group === undefined) return null;
  const catalog: readonly TraitDefinition[] = balance.traits.TRAIT_CATALOG;
  const rival = before.find((traitId) => catalog.find((row) => row.id === traitId)?.exclusionGroup === group);
  return rival === undefined ? null : `${trait.id} shares exclusion group ${group} with ${rival}`;
}

/** Why `build` (trait ids in pick order) is not a valid ladder, the first broken pick's reason; null when it is one. */
export function ladderProblem(build: readonly TraitId[], balance: LadderCheckBalance): string | null {
  const catalog: readonly TraitDefinition[] = balance.traits.TRAIT_CATALOG;
  for (const [index, traitId] of build.entries()) {
    const trait = catalog.find((row) => row.id === traitId);
    if (trait === undefined) return `${traitId} is not in the trait catalog`;
    const problem = traitPickProblem(trait, build.slice(0, index), balance);
    if (problem !== null) return problem;
  }
  return null;
}
