// @vitest-environment node
// The giant cells' pages (docs/ui/encyclopedia.md §11.4, docs/ecology/giants.md §3.5, ticket #831): one per species,
// named as the HUD names it, under Cells & food; their numbers follow the live balance, and the mass that swallows one
// is the engulf rule's own bound, the Cell Wall the diatom's build gives it included.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_ROLE, GIANT_SPECIES, type BalanceConfig, type GiantSpecies } from '@evolution/shared';
import { UI_CHIP_TONE } from '../../ui-kit/ui-chip.component';
import { GIANT_DISPLAY_NAME_BY_SPECIES, GIANT_REAL_LIFE_LINES, GIANT_REAL_SIZES } from '../giants/giant-facts';
import { formatQuantity } from '../quantities/format-quantity';
import { QUANTITY_UNIT } from '../quantities/quantity-unit';
import { factContextFor } from './encyclopedia-context';
import { entryChips } from './format/entry-view';
import { ENCYCLOPEDIA_CATEGORY } from './model/categories';
import type { ResolvedEntry } from './model/entry';
import { ENTRY_SUBJECT, ENTRY_SUBJECT_LABEL, entryIdOf } from './model/entry-id';
import { GIANT_ROLE_LABEL } from './model/giant-roles';
import { ENTRY_GROUP } from './model/groups';
import { entriesIn, entryTitle, resolveEntry } from './registry';

const SPECIES = Object.values(GIANT_SPECIES);
const shipped = factContextFor(null);

type MutableBalance = { -readonly [Domain in keyof BalanceConfig]: Record<string, unknown> };

function giantEntry(species: GiantSpecies, balance: BalanceConfig = DEFAULT_BALANCE): ResolvedEntry {
  return resolveEntry(entryIdOf(ENTRY_SUBJECT.giant, species), { balance });
}

function factText(entry: ResolvedEntry, key: string): string | undefined {
  return entry.facts.find((fact) => fact.key === key)?.text;
}

function mass(value: number): string {
  return formatQuantity(value, QUANTITY_UNIT.mass);
}

describe('the giant cells’ encyclopedia entries', () => {
  it('holds one page per species, titled as the HUD names it, under Cells & food’s Giant cells', () => {
    const group = entriesIn(ENCYCLOPEDIA_CATEGORY.entities).find((one) => one.group === ENTRY_GROUP.giants);
    expect(group?.entries).toEqual(
      SPECIES.map((species) => ({
        entryId: entryIdOf(ENTRY_SUBJECT.giant, species),
        title: GIANT_DISPLAY_NAME_BY_SPECIES[species],
      })),
    );
  });

  it('lists the giants between the cells and the food', () => {
    const groups = entriesIn(ENCYCLOPEDIA_CATEGORY.entities).map((one) => one.group);
    expect(groups).toEqual([ENTRY_GROUP.cells, ENTRY_GROUP.giants, ENTRY_GROUP.food]);
  });

  /**
   * The design's own figures (giants.md §3.5.3, §3.5.4): the smallest amoeba or paramecium (900) is swallowed from
   * 900 × 1.25, any of them from the ceiling's 1 500 × 1.25 = 1 875, and a diatom from 1.40 × its mass with its Cell Wall
   * I: 1 400 for the smallest, 2 100 for any.
   */
  it.each([
    [GIANT_SPECIES.amoeba, 1125, 1875],
    [GIANT_SPECIES.paramecium, 1125, 1875],
    [GIANT_SPECIES.diatom, 1400, 2100],
  ])('quotes the mass that swallows the %s: the smallest from %d, any from %d', (species, smallest, any) => {
    const entry = giantEntry(species);
    expect(factText(entry, 'swallowSmallest')).toBe(mass(smallest));
    expect(factText(entry, 'swallowAny')).toBe(mass(any));
  });

  it('rounds a swallow mass up, so the page never names a mass the engulf rule refuses', () => {
    const balance = structuredClone(DEFAULT_BALANCE) as BalanceConfig;
    const patch = balance as unknown as MutableBalance;
    const bornMin = patch.giants['GIANT_BORN_MASS_MIN_BY_SPECIES'] as Record<GiantSpecies, number>;
    // 901 × 1.25 = 1126.25: a 1126-mass player cannot swallow it yet.
    bornMin[GIANT_SPECIES.amoeba] = 901;
    expect(factText(giantEntry(GIANT_SPECIES.amoeba, balance), 'swallowSmallest')).toBe(mass(1127));
  });

  it('quotes each species’ own birth range and the one ceiling, read from the balance', () => {
    for (const species of SPECIES) {
      const entry = giantEntry(species);
      expect(factText(entry, 'bornMin')).toBe(mass(DEFAULT_BALANCE.giants.GIANT_BORN_MASS_MIN_BY_SPECIES[species]));
      expect(factText(entry, 'bornMax')).toBe(mass(DEFAULT_BALANCE.giants.GIANT_BORN_MASS_MAX_BY_SPECIES[species]));
      expect(factText(entry, 'massCeiling')).toBe(mass(DEFAULT_BALANCE.giants.GIANT_MASS_CEILING));
    }
  });

  it('gives the hunt window to the amoeba alone, and leads its page and tile with it', () => {
    const amoeba = giantEntry(GIANT_SPECIES.amoeba);
    expect(amoeba.headline?.key).toBe('huntShare');
    expect(factText(amoeba, 'huntShare')).toBe(
      formatQuantity(DEFAULT_BALANCE.giants.GIANT_HUNT_MIN_PREY_MASS_FRACTION, QUANTITY_UNIT.shareOfItsMass),
    );
    for (const species of [GIANT_SPECIES.paramecium, GIANT_SPECIES.diatom]) {
      expect(factText(giantEntry(species), 'huntShare')).toBeUndefined();
      expect(giantEntry(species).headline?.key).toBe('swallowSmallest');
    }
  });

  it('follows a patched balance: the ceiling, the engulf ratio and the hunt window move the page', () => {
    const balance = structuredClone(DEFAULT_BALANCE) as BalanceConfig;
    const patch = balance as unknown as MutableBalance;
    patch.giants['GIANT_MASS_CEILING'] = DEFAULT_BALANCE.giants.GIANT_MASS_CEILING * 2;
    patch.giants['GIANT_HUNT_MIN_PREY_MASS_FRACTION'] = DEFAULT_BALANCE.giants.GIANT_HUNT_MIN_PREY_MASS_FRACTION * 2;
    patch.absorption['ENGULF_MASS_RATIO'] = 1;
    const before = giantEntry(GIANT_SPECIES.amoeba);
    const after = giantEntry(GIANT_SPECIES.amoeba, balance);
    for (const key of ['swallowSmallest', 'swallowAny', 'massCeiling', 'huntShare']) {
      expect(factText(after, key), key).not.toBe(factText(before, key));
    }
    expect(factText(after, 'swallowSmallest')).toBe(
      mass(DEFAULT_BALANCE.giants.GIANT_BORN_MASS_MIN_BY_SPECIES.giant_amoeba),
    );
  });

  it('previews the giant itself: a wild cell owning its species’ build, in its species’ palette', () => {
    for (const species of SPECIES) {
      expect(giantEntry(species).preview).toEqual({
        scene: 'cell',
        cellKind: 'wild',
        traits: DEFAULT_BALANCE.giants.GIANT_BUILDS_BY_SPECIES[species],
        motion: 'swimming',
        giantSpecies: species,
      });
    }
  });

  it('carries the real-life line the giant popup teaches, and the real size, as its real-life note', () => {
    for (const species of SPECIES) {
      expect(giantEntry(species).realLife).toEqual({
        line: GIANT_REAL_LIFE_LINES[species],
        size: GIANT_REAL_SIZES[species],
      });
    }
    expect(resolveEntry('cell_kind:wild', shipped).realLife).toBeNull();
  });

  it('wears its kind and its role as chips, the hunter’s in the danger tone', () => {
    const chipsOf = (species: GiantSpecies) => entryChips(giantEntry(species).subject, null, entryTitle);
    expect(chipsOf(GIANT_SPECIES.amoeba).map(({ text, tone }) => ({ text, tone }))).toEqual([
      { text: ENTRY_SUBJECT_LABEL[ENTRY_SUBJECT.giant], tone: UI_CHIP_TONE.neutral },
      { text: GIANT_ROLE_LABEL[GIANT_ROLE.hunter], tone: UI_CHIP_TONE.danger },
    ]);
    expect(chipsOf(GIANT_SPECIES.paramecium).map(({ text, tone }) => ({ text, tone }))[1]).toEqual({
      text: GIANT_ROLE_LABEL[GIANT_ROLE.grazer],
      tone: UI_CHIP_TONE.neutral,
    });
    expect(chipsOf(GIANT_SPECIES.diatom).map(({ text }) => text)[1]).toBe(GIANT_ROLE_LABEL[GIANT_ROLE.drifter]);
  });
});
