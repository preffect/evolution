// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, GIANT_SPECIES, type GiantSpecies, type OwnedTrait } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { GIANT_DIATOM_PLASTID_COUNT, LIPID_DROPLET, ORGANELLE_KIND, PROTOCELL_GRANULE_COUNT } from '../constants';
import { summariseCellTraits } from './cell-traits';
import { NUCLEUS_KINDS, ORGANELLE_KIND_ORDER, organelleCounts } from './organelle-kinds';

describe('organelleCounts', () => {
  it('gives a protocell its granules and nothing else', () => {
    const counts = organelleCounts(summariseCellTraits(createTestCellView({ stage: CELL_STAGE.protocell })));
    expect(counts[ORGANELLE_KIND.protocellGranule]).toBe(PROTOCELL_GRANULE_COUNT);
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(PROTOCELL_GRANULE_COUNT);
  });

  it('gives a prokaryote the nucleoid and the lipids until the envelope makes it a nucleus', () => {
    const prokaryote = organelleCounts(
      summariseCellTraits(createTestCellView({ stage: CELL_STAGE.prokaryote, traits: [] })),
    );
    expect(prokaryote[ORGANELLE_KIND.nucleoid]).toBe(1);
    expect(prokaryote[ORGANELLE_KIND.nucleus]).toBe(0);
    expect(prokaryote[ORGANELLE_KIND.lipid]).toBe(LIPID_DROPLET.count);
    const eukaryote = organelleCounts(
      summariseCellTraits(
        createTestCellView({ stage: CELL_STAGE.eukaryote, traits: [{ traitId: 'nuclear_envelope', tier: 1 }] }),
      ),
    );
    expect(eukaryote[ORGANELLE_KIND.nucleoid]).toBe(0);
    expect(eukaryote[ORGANELLE_KIND.nucleus]).toBe(1);
  });

  it('reads the tiered organelle counts from the trait tables', () => {
    const counts = organelleCounts(
      summariseCellTraits(
        createTestCellView({
          stage: CELL_STAGE.eukaryote,
          traits: [
            { traitId: 'mitochondrion', tier: 3 },
            { traitId: 'chloroplast', tier: 1 },
            { traitId: 'food_vacuole', tier: 2 },
            { traitId: 'toxin_vacuole', tier: 3 },
          ],
        }),
      ),
    );
    expect(counts[ORGANELLE_KIND.mitochondrion]).toBe(3);
    expect(counts[ORGANELLE_KIND.chloroplast]).toBe(1);
    expect(counts[ORGANELLE_KIND.foodVacuole]).toBe(3);
    expect(counts[ORGANELLE_KIND.toxinVacuole]).toBe(1);
  });

  describe('the giant diatom’s golden-brown plastids (docs/ecology/giants.md §3.5.11)', () => {
    const diatomBuild: OwnedTrait[] = [
      { traitId: 'nuclear_envelope', tier: 1 },
      { traitId: 'chloroplast', tier: 1 },
      { traitId: 'diatom_shell', tier: 1 },
    ];
    const countsFor = (giantSpecies: GiantSpecies | null, traits: OwnedTrait[] = diatomBuild) =>
      organelleCounts(summariseCellTraits(createTestCellView({ stage: CELL_STAGE.specialised, traits, giantSpecies })));

    it('shows the giant diatom’s chloroplasts as its plastids, a fixed handful at tier I', () => {
      const giant = countsFor(GIANT_SPECIES.diatom);
      expect(giant[ORGANELLE_KIND.chloroplast]).toBe(0);
      expect(giant[ORGANELLE_KIND.diatomPlastid]).toBe(GIANT_DIATOM_PLASTID_COUNT);
    });

    it('keeps a player diatom’s chloroplast green, and gives no other giant plastids', () => {
      const player = countsFor(null);
      expect(player[ORGANELLE_KIND.chloroplast]).toBe(1);
      expect(player[ORGANELLE_KIND.diatomPlastid]).toBe(0);
      const amoeba = countsFor(GIANT_SPECIES.amoeba, [
        ...diatomBuild.slice(0, 2),
        { traitId: 'amoeba_pseudopods', tier: 2 },
      ]);
      expect(amoeba[ORGANELLE_KIND.chloroplast]).toBe(1);
      expect(amoeba[ORGANELLE_KIND.diatomPlastid]).toBe(0);
    });

    it('shows no plastids on a giant diatom without the chloroplast', () => {
      const giant = countsFor(GIANT_SPECIES.diatom, [{ traitId: 'diatom_shell', tier: 1 }]);
      expect(giant[ORGANELLE_KIND.diatomPlastid]).toBe(0);
      expect(giant[ORGANELLE_KIND.chloroplast]).toBe(0);
    });
  });

  it('lays the nucleus kinds out first and covers every kind once', () => {
    expect(NUCLEUS_KINDS.has(ORGANELLE_KIND_ORDER[0]!)).toBe(true);
    expect(NUCLEUS_KINDS.has(ORGANELLE_KIND_ORDER[1]!)).toBe(true);
    expect([...ORGANELLE_KIND_ORDER].sort()).toEqual(Object.values(ORGANELLE_KIND).sort());
  });
});
