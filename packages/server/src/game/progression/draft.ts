// The draft (docs/PROGRESSION.md §3): candidates filtered by the ladder, weights biased by the
// DNA tags eaten, the rung card reserved for the next stage's gate, then weighted sampling
// without replacement from the `traitDraft` stream. Pure: the source and the tables are passed in.

import {
  STAGE_GATE_TRAITS,
  type BacteriumVariant,
  type BalanceConfig,
  type CellStage,
  type DnaTag,
  type OwnedTrait,
  type RandomSource,
  type TraitDefinition,
  type TraitTier,
} from '@evolution/shared';
import { hasReachedStage, nextStage, ownsTrait, stageOfOwned } from './ladder.js';

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
  readonly catalog: readonly TraitDefinition[];
  readonly topTier: number;
  /** The stage the owned traits reach, computed once per draft. */
  readonly stage: CellStage;
}

/** The exclusion group of an owned trait, looked up in the catalog it came from. */
function groupOf(owned: OwnedTrait, catalog: readonly TraitDefinition[]): string | undefined {
  return catalog.find((trait) => trait.id === owned.traitId)?.exclusionGroup;
}

function isUnlocked(trait: TraitDefinition, context: CandidateContext): boolean {
  const unlock = trait.unlockedBy;
  return unlock === undefined || context.bacteriaEatenByVariant[unlock.bacteriumVariant] >= unlock.count;
}

function isGroupFree(trait: TraitDefinition, context: CandidateContext): boolean {
  const group = trait.exclusionGroup;
  if (group === undefined) {
    return true;
  }
  return !context.ownedTraits.some((other) => other.traitId !== trait.id && groupOf(other, context.catalog) === group);
}

function isCandidate(trait: TraitDefinition, owned: OwnedTrait | undefined, context: CandidateContext): boolean {
  if (owned !== undefined && owned.tier >= context.topTier) {
    return false;
  }
  return (
    hasReachedStage(context.stage, trait.stage) &&
    trait.requires.every((requiredId) => ownsTrait(context.ownedTraits, requiredId)) &&
    isUnlocked(trait, context) &&
    isGroupFree(trait, context)
  );
}

/** Every trait the player could be offered right now, in catalog order. */
export function listDraftCandidates(input: CandidateInput, balance: BalanceConfig): DraftCandidate[] {
  const catalog: readonly TraitDefinition[] = balance.traits.TRAIT_CATALOG;
  const context: CandidateContext = {
    ...input,
    catalog,
    topTier: balance.traits.TRAIT_TIER_COUNT,
    stage: stageOfOwned(input.ownedTraits, balance),
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

export function computeDraftWeights(
  candidates: readonly DraftCandidate[],
  dnaTagPoints: Record<DnaTag, number>,
  balance: BalanceConfig,
): number[] {
  const { progression } = balance;
  return candidates.map((candidate) => {
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
  });
}

/** The remaining candidates and their weights, parallel; a draw removes from both. */
interface WeightedPool {
  readonly candidates: DraftCandidate[];
  readonly weights: number[];
}

function takeAt(pool: WeightedPool, index: number): DraftCandidate {
  const [taken] = pool.candidates.splice(index, 1);
  pool.weights.splice(index, 1);
  return taken as DraftCandidate;
}

/** The rung card: one of the next stage's gates among the candidates, by weight, or nothing. */
function takeRungCard(
  pool: WeightedPool,
  input: DraftInput,
  random: RandomSource,
  balance: BalanceConfig,
): DraftCandidate | null {
  const next = nextStage(stageOfOwned(input.ownedTraits, balance));
  if (next === null) {
    return null;
  }
  const gates = STAGE_GATE_TRAITS[next];
  const gateIndexes = pool.candidates.flatMap((candidate, index) =>
    gates.includes(candidate.trait.id) ? [index] : [],
  );
  if (gateIndexes.length === 0) {
    return null;
  }
  const chosen = gateIndexes[random.weightedIndex(gateIndexes.map((index) => pool.weights[index] as number))] as number;
  return takeAt(pool, chosen);
}

export function buildDraft(input: DraftInput, random: RandomSource, balance: BalanceConfig): Draft {
  const candidates = listDraftCandidates(input, balance);
  const weights = computeDraftWeights(candidates, input.dnaTagPoints, balance);
  const pool: WeightedPool = { candidates: [...candidates], weights: [...weights] };
  const drawn: DraftCandidate[] = [];
  const rungCard = takeRungCard(pool, input, random, balance);
  if (rungCard !== null) {
    drawn.push(rungCard);
  }
  while (drawn.length < balance.progression.TRAIT_DRAFT_SIZE && pool.candidates.length > 0) {
    drawn.push(takeAt(pool, random.weightedIndex(pool.weights)));
  }
  return {
    cards: drawn.map((candidate) => ({ traitId: candidate.trait.id, tier: candidate.tier })),
    cardWeights: drawn.map((candidate) => weights[candidates.indexOf(candidate)] as number),
    catalogIndexes: drawn.map((candidate) => candidate.catalogIndex),
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
