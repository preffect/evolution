// docs/PROGRESSION.md §3 and §7 P4, P9, P12, P14: the pure draft rules.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TRAIT_CATEGORY, createSeededRandom, type OwnedTrait, type TraitId } from '@evolution/shared';
import { zeroBacteriaCounters, zeroTagPoints } from '../session/players.js';
import {
  buildDraft,
  computeDraftWeights,
  listDraftCandidates,
  timeoutCardIndex,
  type Draft,
  type DraftInput,
} from './draft.js';

const balance = DEFAULT_BALANCE;
const REQUIRED = balance.ladder.ENDOSYMBIOSIS_BACTERIA_REQUIRED;
const SEEDS = Array.from({ length: 100 }, (_unused, index) => index + 1);
const FORM_IDS: TraitId[] = balance.traits.TRAIT_CATALOG.filter((trait) => trait.category === TRAIT_CATEGORY.form).map(
  (trait) => trait.id,
);

function input(overrides: Partial<DraftInput> = {}): DraftInput {
  return {
    ownedTraits: [],
    bacteriaEatenByVariant: zeroBacteriaCounters(),
    dnaTagPoints: zeroTagPoints(),
    ...overrides,
  };
}

function owned(...ids: TraitId[]): OwnedTrait[] {
  return ids.map((traitId) => ({ traitId, tier: 1 }));
}

function idsOf(draft: Draft): TraitId[] {
  return draft.cards.map((card) => card.traitId);
}

describe('listDraftCandidates', () => {
  it('offers exactly the three protocell picks to a fresh cell', () => {
    const candidates = listDraftCandidates(input(), balance);
    expect(candidates.map((candidate) => candidate.trait.id)).toEqual(['nucleoid', 'simple_flagellum', 'cell_wall']);
    expect(candidates.every((candidate) => candidate.tier === 1 && !candidate.isUpgrade)).toBe(true);
  });

  it('P12: gates the endosymbionts on their counters and the rest on the stage', () => {
    const candidates = listDraftCandidates(
      input({
        ownedTraits: owned('nucleoid'),
        bacteriaEatenByVariant: { plain: 0, aerobic: REQUIRED - 1, photosynthetic: REQUIRED },
      }),
      balance,
    );
    const ids = candidates.map((candidate) => candidate.trait.id);
    expect(ids).toContain('chloroplast');
    expect(ids).toContain('ribosomes');
    expect(ids).not.toContain('mitochondrion');
    expect(ids).not.toContain('nuclear_envelope');
    expect(ids).not.toContain('cilia');
    for (const form of FORM_IDS) expect(ids).not.toContain(form);
  });

  it('turns an owned trait into its upgrade card and drops it at tier III', () => {
    const upgrade = listDraftCandidates(input({ ownedTraits: [{ traitId: 'nucleoid', tier: 2 }] }), balance).find(
      (candidate) => candidate.trait.id === 'nucleoid',
    );
    expect(upgrade).toMatchObject({ tier: 3, isUpgrade: true, catalogIndex: 0 });
    const maxed = listDraftCandidates(input({ ownedTraits: [{ traitId: 'nucleoid', tier: 3 }] }), balance);
    expect(maxed.map((candidate) => candidate.trait.id)).not.toContain('nucleoid');
  });

  it('requires every prerequisite and excludes other members of an owned group', () => {
    const eukaryote = owned('nucleoid', 'chloroplast', 'nuclear_envelope');
    const withoutCilia = listDraftCandidates(input({ ownedTraits: eukaryote }), balance);
    expect(withoutCilia.map((candidate) => candidate.trait.id)).not.toContain('paramecium_cilia');
    expect(withoutCilia.map((candidate) => candidate.trait.id)).toContain('euglena_eyespot');
    const withForm = listDraftCandidates(input({ ownedTraits: [...eukaryote, ...owned('euglena_eyespot')] }), balance);
    const ids = withForm.map((candidate) => candidate.trait.id);
    expect(ids).toContain('euglena_eyespot');
    expect(ids.filter((id) => FORM_IDS.includes(id))).toEqual(['euglena_eyespot']);
  });
});

describe('computeDraftWeights (P4)', () => {
  it('weights cilia 4.0, simple_flagellum 2.0 and cell_wall 1.0 with 30 motile points', () => {
    const catalog = balance.traits.TRAIT_CATALOG;
    const candidates = (['cilia', 'simple_flagellum', 'cell_wall'] as const).map((id) => {
      const catalogIndex = catalog.findIndex((trait) => trait.id === id);
      return { trait: catalog[catalogIndex]!, tier: 1 as const, isUpgrade: false, catalogIndex };
    });
    const weights = computeDraftWeights(candidates, { ...zeroTagPoints(), motile: 30 }, balance);
    expect(weights).toEqual([4, 2, 1]);
  });

  it('multiplies an upgrade card', () => {
    const catalog = balance.traits.TRAIT_CATALOG;
    const candidate = { trait: catalog[0]!, tier: 2 as const, isUpgrade: true, catalogIndex: 0 };
    expect(computeDraftWeights([candidate], zeroTagPoints(), balance)).toEqual([
      balance.progression.UPGRADE_CARD_WEIGHT_MULTIPLIER,
    ]);
  });
});

describe('buildDraft', () => {
  it('P14: reserves the rung card for a protocell and for a prokaryote with the counter met', () => {
    for (const seed of SEEDS) {
      expect(idsOf(buildDraft(input(), createSeededRandom(seed), balance))).toContain('nucleoid');
      const prokaryote = input({
        ownedTraits: owned('nucleoid'),
        bacteriaEatenByVariant: { plain: 0, aerobic: 0, photosynthetic: REQUIRED },
      });
      expect(idsOf(buildDraft(prokaryote, createSeededRandom(seed), balance))).toContain('chloroplast');
    }
  });

  it('P9: never offers a second form and offers owned traits only as upgrades', () => {
    const eukaryote = input({
      ownedTraits: owned('nucleoid', 'mitochondrion', 'nuclear_envelope', 'cytoskeleton', 'amoeba_pseudopods'),
    });
    for (const seed of SEEDS) {
      const draft = buildDraft(eukaryote, createSeededRandom(seed), balance);
      for (const card of draft.cards) {
        if (FORM_IDS.includes(card.traitId)) expect(card).toEqual({ traitId: 'amoeba_pseudopods', tier: 2 });
        if (card.traitId === 'cytoskeleton') expect(card.tier).toBe(2);
      }
    }
  });

  it('draws distinct cards up to the draft size and offers what exists when fewer', () => {
    const draft = buildDraft(input(), createSeededRandom(7), balance);
    expect(new Set(idsOf(draft)).size).toBe(balance.progression.TRAIT_DRAFT_SIZE);
    expect(draft.cardWeights).toHaveLength(draft.cards.length);
    expect(draft.catalogIndexes).toHaveLength(draft.cards.length);
    const nearlyDone = input({
      ownedTraits: [
        { traitId: 'nucleoid', tier: 3 },
        { traitId: 'cell_wall', tier: 3 },
      ],
    });
    const few = buildDraft(nearlyDone, createSeededRandom(7), balance);
    expect(idsOf(few).sort()).toEqual(['ribosomes', 'simple_flagellum']);
  });

  it('is empty when nothing is a candidate', () => {
    const maxed = input({
      ownedTraits: balance.traits.TRAIT_CATALOG.map((trait) => ({ traitId: trait.id, tier: 3 as const })),
    });
    expect(buildDraft(maxed, createSeededRandom(1), balance).cards).toEqual([]);
  });

  it('is deterministic for a seed', () => {
    expect(buildDraft(input(), createSeededRandom(5), balance)).toEqual(
      buildDraft(input(), createSeededRandom(5), balance),
    );
  });
});

describe('timeoutCardIndex', () => {
  it('picks the heaviest card and breaks ties by lowest catalog index (nucleoid over cell_wall)', () => {
    const draft: Draft = {
      cards: [
        { traitId: 'cell_wall', tier: 1 },
        { traitId: 'simple_flagellum', tier: 1 },
        { traitId: 'nucleoid', tier: 1 },
      ],
      cardWeights: [1, 0.5, 1],
      catalogIndexes: [2, 1, 0],
    };
    expect(timeoutCardIndex(draft)).toBe(2);
    expect(timeoutCardIndex({ ...draft, cardWeights: [1, 4, 1] })).toBe(1);
  });
});
