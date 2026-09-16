import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  CELL_STAGE,
  DEFAULT_BALANCE,
  ENDOSYMBIOSIS_BACTERIA_REQUIRED,
  stageOf,
  type BacteriumVariant,
  type CellStage,
  type OwnedTrait,
  type TraitId,
} from '@evolution/shared';
import { LADDER_ORBIT_ANGLES_PAIR_DEG, LADDER_ORBIT_ANGLE_SINGLE_DEG } from '../render/constants';
import { LADDER_SILHOUETTE, ladderFor } from './own-cell-ladder';

const NO_TRAITS = [] as const;
const NOTHING_EATEN: Record<BacteriumVariant, number> = { plain: 0, aerobic: 0, photosynthetic: 0 };

function eaten(overrides: Partial<Record<BacteriumVariant, number>>): Record<BacteriumVariant, number> {
  return { ...NOTHING_EATEN, ...overrides };
}

function owned(...traitIds: TraitId[]): OwnedTrait[] {
  return traitIds.map((traitId) => ({ traitId, tier: 1 }));
}

/** The stage a loadout really reaches, so a fixture never pairs traits with a stage the server would not send. */
function stageOfLoadout(traits: readonly OwnedTrait[]): CellStage {
  return stageOf(
    traits.map((trait) => trait.traitId),
    DEFAULT_BALANCE.ladder,
  );
}

describe('ladderFor', () => {
  it('shows the nucleoid ghost at the protocell, which is the first rung, and no counter yet', () => {
    expect(ladderFor(CELL_STAGE.protocell, NO_TRAITS, eaten({ aerobic: 4 }), null)).toEqual({
      ghost: { silhouette: LADDER_SILHOUETTE.nucleoid, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG },
      counters: [],
    });
  });

  it('shows the envelope then the form ghost as the stages climb, and no ghost at the top', () => {
    const ghostOf = (...traitIds: TraitId[]): unknown => {
      const traits = owned(...traitIds);
      return ladderFor(stageOfLoadout(traits), traits, NOTHING_EATEN, null).ghost?.silhouette ?? null;
    };
    const endosymbiosis: TraitId[] = ['nucleoid', 'mitochondrion', 'chloroplast'];
    expect(ghostOf(...endosymbiosis)).toBe(LADDER_SILHOUETTE.envelope);
    // Five forms gate `specialised`, so the ghost is keyed by the stage and never by one trait.
    expect(ghostOf(...endosymbiosis, 'nuclear_envelope')).toBe(LADDER_SILHOUETTE.form);
    expect(ghostOf(...endosymbiosis, 'nuclear_envelope', 'euglena_eyespot')).toBeNull();
  });

  it('shows both endosymbiosis counters at the prokaryote, on the angles §9 sets, and no ghost', () => {
    // The prokaryote's next rung *is* the counters: there is no silhouette for it to ghost.
    const ladder = ladderFor(CELL_STAGE.prokaryote, owned('nucleoid'), eaten({ aerobic: 3 }), null);
    expect(ladder.ghost).toBeNull();
    expect(ladder.counters.map((counter) => [counter.traitId, counter.variant, counter.angleDeg])).toEqual([
      ['mitochondrion', BACTERIUM_VARIANT.aerobic, LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic],
      ['chloroplast', BACTERIUM_VARIANT.photosynthetic, LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic],
    ]);
  });

  it('tallies each counter from its own variant, which is what makes the vent trip visible', () => {
    // gameplay-qa's finding on this ticket: without a counter, "eat ten aerobic bacteria" is a
    // hidden requirement. The tally and the unlock flag are the whole of that signal.
    const ladder = ladderFor(CELL_STAGE.prokaryote, NO_TRAITS, eaten({ aerobic: 4, photosynthetic: 1 }), null);
    const [aerobic, photosynthetic] = ladder.counters;
    expect(aerobic).toMatchObject({ eaten: 4, required: ENDOSYMBIOSIS_BACTERIA_REQUIRED, isUnlocked: false });
    expect(photosynthetic).toMatchObject({ eaten: 1, isUnlocked: false });
  });

  it('tops the tally out at the requirement, because the orbit has no eleventh pip', () => {
    // The regression this pins (#282 review): a counter stays up until the trait is *picked*, so
    // the raw tally kept climbing while the player was still at the vent — `12/10` in the mirror,
    // a number §3.1.2's two rows of five cannot draw, and a fresh announce on every bacterium.
    const overflowing = eaten({ aerobic: ENDOSYMBIOSIS_BACTERIA_REQUIRED + 2 });
    const ladder = ladderFor(CELL_STAGE.prokaryote, NO_TRAITS, overflowing, null);
    expect(ladder.counters[0]).toMatchObject({ eaten: ENDOSYMBIOSIS_BACTERIA_REQUIRED, isUnlocked: true });
  });

  it('marks a counter unlocked at the requirement, so the player is told to go and pick it', () => {
    const full = eaten({ aerobic: ENDOSYMBIOSIS_BACTERIA_REQUIRED });
    const ladder = ladderFor(CELL_STAGE.prokaryote, NO_TRAITS, full, null);
    expect(ladder.counters[0]?.isUnlocked).toBe(true);
    expect(ladder.counters[1]?.isUnlocked).toBe(false);
  });

  it('keeps the unclaimed endosymbiont’s counter on its own angle beside the envelope ghost (#285 B)', () => {
    // The state decision #285 was about: the chloroplast promoted the cell to `endosymbiosis` while
    // ten aerobic bacteria were already banked toward the mitochondrion. The ladder used to take its
    // counters branch only at the prokaryote, so the promotion dropped both counters — and with them
    // the only sign that a second card was waiting.
    const traits = owned('nucleoid', 'chloroplast');
    const stage = stageOfLoadout(traits);
    expect(stage).toBe(CELL_STAGE.endosymbiosis);
    const ladder = ladderFor(stage, traits, eaten({ aerobic: ENDOSYMBIOSIS_BACTERIA_REQUIRED }), null);
    expect(ladder.ghost).toEqual({ silhouette: LADDER_SILHOUETTE.envelope, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG });
    expect(ladder.counters).toHaveLength(1);
    expect(ladder.counters[0]).toMatchObject({
      traitId: 'mitochondrion',
      variant: BACTERIUM_VARIANT.aerobic,
      angleDeg: LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic,
      eaten: ENDOSYMBIOSIS_BACTERIA_REQUIRED,
      isUnlocked: true,
    });
  });

  it('carries that counter up the ladder until the endosymbiont is owned too', () => {
    // The draft keeps offering an unowned endosymbiont at every stage from its own (`hasReachedStage`),
    // so the counter has to outlive the next promotion as well.
    const eukaryote = owned('nucleoid', 'chloroplast', 'nuclear_envelope');
    const ladder = ladderFor(stageOfLoadout(eukaryote), eukaryote, eaten({ aerobic: 3 }), null);
    expect(ladder.ghost?.silhouette).toBe(LADDER_SILHOUETTE.form);
    expect(ladder.counters.map((counter) => counter.traitId)).toEqual(['mitochondrion']);

    const both = owned('nucleoid', 'chloroplast', 'nuclear_envelope', 'mitochondrion');
    expect(ladderFor(stageOfLoadout(both), both, eaten({ aerobic: 3 }), null).counters).toEqual([]);
  });

  it('shows nothing at the top of the ladder with both endosymbionts owned', () => {
    const top = owned('nucleoid', 'mitochondrion', 'chloroplast', 'nuclear_envelope', 'euglena_eyespot');
    expect(ladderFor(stageOfLoadout(top), top, NOTHING_EATEN, null)).toEqual({ ghost: null, counters: [] });
  });

  it('hides the ghost while the picker previews that rung, so the card shows the real organelle', () => {
    expect(ladderFor(CELL_STAGE.protocell, NO_TRAITS, NOTHING_EATEN, 'nucleoid').ghost).toBeNull();
    // A preview of something else leaves the ghost alone.
    expect(ladderFor(CELL_STAGE.protocell, NO_TRAITS, NOTHING_EATEN, 'simple_flagellum').ghost).not.toBeNull();
  });

  it('hides only the previewed counter’s ghost and keeps its pips', () => {
    const ladder = ladderFor(CELL_STAGE.prokaryote, NO_TRAITS, eaten({ aerobic: 6 }), 'mitochondrion');
    expect(ladder.counters[0]).toMatchObject({ isGhostHidden: true, eaten: 6 });
    expect(ladder.counters[1]?.isGhostHidden).toBe(false);
  });
});
