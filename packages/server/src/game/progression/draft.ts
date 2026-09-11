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
import { pickWeighted } from '../simulation/pick-weighted.js';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
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
  return listCandidatesAtStage(input, stageOfOwned(input.ownedTraits, balance), balance);
}

/** The candidates once the stage is known: `buildDraft` computes it once for the list and the rung card. */
function listCandidatesAtStage(input: CandidateInput, stage: CellStage, balance: BalanceConfig): DraftCandidate[] {
  const catalog: readonly TraitDefinition[] = balance.traits.TRAIT_CATALOG;
  const context: CandidateContext = { ...input, catalog, topTier: balance.traits.TRAIT_TIER_COUNT, stage };
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
  const pool: WeightedCandidate[] = listCandidatesAtStage(input, stage, balance).map((candidate) => ({
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
