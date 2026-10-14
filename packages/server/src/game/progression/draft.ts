// The draft (docs/PROGRESSION.md §3): candidates filtered by the ladder (the shared per-pick rule,
// `traitPickProblem`, the wild and giant builds' rule too), weights biased by the DNA tags eaten, the rung card
// reserved for the next stage's gate, then weighted sampling without replacement from the `traitDraft` stream.
// Pure: the source and the tables are passed in.

import {
  STAGE_GATE_TRAITS,
  nextStage,
  traitPickProblem,
  type BacteriumVariant,
  type BalanceConfig,
  type CellStage,
  type DnaTag,
  type LadderCheckBalance,
  type OwnedTrait,
  type RandomSource,
  type TraitDefinition,
  type TraitId,
  type TraitTier,
} from '@evolution/shared';
import { pickWeighted } from '../simulation/pick-weighted.js';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
import { stageOfOwned } from './ladder.js';

export interface DraftCandidate {
  readonly trait: TraitDefinition;
  /** The tier the card would grant: I for a new trait, the next one for an upgrade. */
  readonly tier: TraitTier;
  readonly isUpgrade: boolean;
  readonly catalogIndex: number;
}

/** What the candidate rule reads of a player; a `PlayerRecord` satisfies it. */
export interface CandidateInput {
  readonly ownedTraits: readonly OwnedTrait[];
  readonly bacteriaEatenByVariant: Record<BacteriumVariant, number>;
}

/** What a whole draft reads: the candidate input plus the tag points that bias the weights. */
export interface DraftInput extends CandidateInput {
  readonly dnaTagPoints: Record<DnaTag, number>;
}

export interface Draft {
  readonly cards: OwnedTrait[];
  /** Parallel to `cards`: what the timeout pick compares. */
  readonly cardWeights: number[];
  readonly catalogIndexes: number[];
}

interface CandidateContext extends CandidateInput {
  readonly topTier: number;
  /** The owned ids a trait is picked after, and the balance its per-pick rule reads. */
  readonly ownedTraitIds: readonly TraitId[];
  readonly balance: LadderCheckBalance;
}

function isUnlocked(trait: TraitDefinition, context: CandidateContext): boolean {
  const unlock = trait.unlockedBy;
  return unlock === undefined || context.bacteriaEatenByVariant[unlock.bacteriumVariant] >= unlock.count;
}

/** A new trait: unlocked, and a valid pick (stage, requires, exclusion group) after the owned traits. */
function isNewTraitCandidate(trait: TraitDefinition, context: CandidateContext): boolean {
  return isUnlocked(trait, context) && traitPickProblem(trait, context.ownedTraitIds, context.balance) === null;
}

/** An upgrade: below the top tier, unlocked, and still a valid pick after the other owned traits. */
function isUpgradeCandidate(trait: TraitDefinition, owned: OwnedTrait, context: CandidateContext): boolean {
  const otherOwnedIds = context.ownedTraitIds.filter((traitId) => traitId !== trait.id);
  return (
    owned.tier < context.topTier &&
    isUnlocked(trait, context) &&
    traitPickProblem(trait, otherOwnedIds, context.balance) === null
  );
}

function isCandidate(trait: TraitDefinition, owned: OwnedTrait | undefined, context: CandidateContext): boolean {
  return owned === undefined ? isNewTraitCandidate(trait, context) : isUpgradeCandidate(trait, owned, context);
}

/** Every trait the player could be offered right now, in catalog order. */
export function listDraftCandidates(input: CandidateInput, balance: BalanceConfig): DraftCandidate[] {
  const catalog: readonly TraitDefinition[] = balance.traits.TRAIT_CATALOG;
  const context: CandidateContext = {
    ...input,
    topTier: balance.traits.TRAIT_TIER_COUNT,
    ownedTraitIds: input.ownedTraits.map((owned) => owned.traitId),
    balance,
  };
  const candidates: DraftCandidate[] = [];
  catalog.forEach((trait, catalogIndex) => {
    const owned = input.ownedTraits.find((entry) => entry.traitId === trait.id);
    if (isCandidate(trait, owned, context)) {
      const tier = (owned === undefined ? 1 : owned.tier + 1) as TraitTier;
      candidates.push({ trait, tier, isUpgrade: owned !== undefined, catalogIndex });
    }
  });
  return candidates;
}

/** One candidate's weight (docs/PROGRESSION.md §3): rarity × the tag bias (capped) × the upgrade bonus. */
function draftWeightOf(
  candidate: DraftCandidate,
  dnaTagPoints: Record<DnaTag, number>,
  balance: BalanceConfig,
): number {
  const { progression } = balance;
  let tagScore = 0;
  for (const tag of candidate.trait.tags) {
    tagScore += dnaTagPoints[tag];
  }
  const tagMultiplier = Math.min(
    progression.TAG_WEIGHT_MAX_MULTIPLIER,
    1 + progression.TAG_WEIGHT_PER_POINT * tagScore,
  );
  const upgradeMultiplier = candidate.isUpgrade ? progression.UPGRADE_CARD_WEIGHT_MULTIPLIER : 1;
  return progression.RARITY_WEIGHT[candidate.trait.rarity] * tagMultiplier * upgradeMultiplier;
}

export function computeDraftWeights(
  candidates: readonly DraftCandidate[],
  dnaTagPoints: Record<DnaTag, number>,
  balance: BalanceConfig,
): number[] {
  return candidates.map((candidate) => draftWeightOf(candidate, dnaTagPoints, balance));
}

/** A candidate with the weight it was drawn under; the pool and the drawn cards are lists of these. */
interface WeightedCandidate {
  readonly candidate: DraftCandidate;
  readonly weight: number;
}

function takeAt(pool: WeightedCandidate[], index: number): WeightedCandidate {
  const [taken] = pool.splice(index, 1);
  if (taken === undefined) {
    throw new SimulationInvariantError(`the draft pool has no candidate at ${index}`);
  }
  return taken;
}

/** The rung card: one of the next stage's gates among the candidates, by weight, or nothing. */
function takeRungCard(pool: WeightedCandidate[], stage: CellStage, random: RandomSource): WeightedCandidate | null {
  const next = nextStage(stage);
  if (next === null) {
    return null;
  }
  const gates = STAGE_GATE_TRAITS[next];
  const gateEntries = pool.flatMap((entry, index) =>
    gates.includes(entry.candidate.trait.id) ? [{ entry, index }] : [],
  );
  if (gateEntries.length === 0) {
    return null;
  }
  return takeAt(pool, pickWeighted(random, gateEntries, (gate) => gate.entry.weight).index);
}

export function buildDraft(input: DraftInput, random: RandomSource, balance: BalanceConfig): Draft {
  const stage = stageOfOwned(input.ownedTraits, balance);
  const pool: WeightedCandidate[] = listDraftCandidates(input, balance).map((candidate) => ({
    candidate,
    weight: draftWeightOf(candidate, input.dnaTagPoints, balance),
  }));
  const drawn: WeightedCandidate[] = [];
  const rungCard = takeRungCard(pool, stage, random);
  if (rungCard !== null) {
    drawn.push(rungCard);
  }
  while (drawn.length < balance.progression.TRAIT_DRAFT_SIZE && pool.length > 0) {
    drawn.push(takeAt(pool, random.weightedIndex(pool.map((entry) => entry.weight))));
  }
  return {
    cards: drawn.map(({ candidate }) => ({ traitId: candidate.trait.id, tier: candidate.tier })),
    cardWeights: drawn.map((entry) => entry.weight),
    catalogIndexes: drawn.map(({ candidate }) => candidate.catalogIndex),
  };
}

/** The timeout pick (docs/PROGRESSION.md §4): highest weight; ties break by lowest catalog index. */
export function timeoutCardIndex(draft: Draft): number {
  let best = 0;
  for (let index = 1; index < draft.cards.length; index += 1) {
    const weight = draft.cardWeights[index] as number;
    const bestWeight = draft.cardWeights[best] as number;
    const isHeavier = weight > bestWeight;
    const isEarlierTie =
      weight === bestWeight && (draft.catalogIndexes[index] as number) < (draft.catalogIndexes[best] as number);
    if (isHeavier || isEarlierTie) {
      best = index;
    }
  }
  return best;
}
