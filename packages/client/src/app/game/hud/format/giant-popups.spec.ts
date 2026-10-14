// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GIANT_SPECIES,
  TICK_HZ,
  entityId,
  type CellAbsorbedEffect,
  type GiantSpecies,
} from '@evolution/shared';
import { createTestCellAbsorbedEffect, createTestEatEffect } from '../../../../testing/builders';
import { UI_EFFECT } from '../../../ui-kit/ui-effect-mark.component';
import { GIANT_DISPLAY_NAME_BY_SPECIES, GIANT_REAL_LIFE_LINES } from '../../giants/giant-facts';
import { FORM_POPUP_DURATION_SECONDS } from '../upgrade-popup-constants';
import {
  GIANT_POPUP_KICKER_TEXT,
  giantPopupsIn,
  giantSwallowOf,
  giantSwallowsKeptAt,
  withGiantSwallow,
  type GiantSwallow,
} from './giant-popups';
import { UPGRADE_POPUP_KIND } from './upgrade-popup-kinds';
import { unbroken } from '../../../../testing/unbroken-quantity';

const OWN_CELL_ID = entityId('c-own');
const SEAT = 'game-1/player-me';
const OTHER_SEAT = 'game-2/player-me';
const SWALLOW_TICK = 900;
/** How long a swallow waits to be folded: a giant popup's life. */
const KEPT_TICKS = FORM_POPUP_DURATION_SECONDS * TICK_HZ;
/** The payout with no Nucleoid: the bonus alone (docs/ecology/giants.md §3.5.8). */
const GIANT_DNA = DEFAULT_BALANCE.giants.GIANT_DNA_BONUS;
/** A Nucleoid I eater's payout, the bonus × 1.05: the line shows what the effect measured, not the bonus. */
const NUCLEOID_GIANT_DNA = 210;

function swallowed(species: GiantSpecies | null, overrides: Partial<CellAbsorbedEffect> = {}): CellAbsorbedEffect {
  return createTestCellAbsorbedEffect({
    playerId: null,
    predatorCellId: OWN_CELL_ID,
    predatorDnaGained: GIANT_DNA,
    preyGiantSpecies: species,
    ...overrides,
  });
}

/** The amoeba swallowed on `tick`, as the bus reported it to `seatKey`. */
function swallowOn(tick: number, seatKey: string = SEAT): GiantSwallow {
  return { seatKey, tick, species: GIANT_SPECIES.amoeba, dnaGained: GIANT_DNA };
}

describe('giantSwallowOf (docs/ecology/giants.md §3.5.8)', () => {
  it('reads a giant the own cell swallowed: the seat, the tick it happened, the giant and the DNA it paid', () => {
    const effect = swallowed(GIANT_SPECIES.paramecium, { tick: SWALLOW_TICK });
    expect(giantSwallowOf(effect, true, SEAT)).toEqual({
      seatKey: SEAT,
      tick: SWALLOW_TICK,
      species: GIANT_SPECIES.paramecium,
      dnaGained: GIANT_DNA,
    });
  });

  it('reads nothing from a giant another cell ate, a prey that was not a giant, or another effect', () => {
    expect(giantSwallowOf(swallowed(GIANT_SPECIES.amoeba), false, SEAT)).toBeNull();
    expect(giantSwallowOf(swallowed(null), true, SEAT)).toBeNull();
    expect(giantSwallowOf(createTestEatEffect(), true, SEAT)).toBeNull();
  });
});

describe('withGiantSwallow', () => {
  it('keeps the swallows of the seat that are waiting, and lets go of another seat’s, a later one’s and a past one', () => {
    const waiting = swallowOn(SWALLOW_TICK - KEPT_TICKS + 1);
    const kept = [
      swallowOn(SWALLOW_TICK - KEPT_TICKS),
      swallowOn(SWALLOW_TICK, OTHER_SEAT),
      swallowOn(SWALLOW_TICK + 1),
    ];
    const added = swallowOn(SWALLOW_TICK);
    expect(withGiantSwallow([...kept, waiting], added)).toEqual([waiting, added]);
  });
});

describe('giantSwallowsKeptAt', () => {
  it('lets go of another seat’s swallow and one after the folded tick, the clock having gone back past it', () => {
    const before = swallowOn(SWALLOW_TICK - 1);
    const onFold = swallowOn(SWALLOW_TICK);
    const kept = [before, onFold, swallowOn(SWALLOW_TICK + 1), swallowOn(SWALLOW_TICK, OTHER_SEAT)];
    expect(giantSwallowsKeptAt(kept, { seatKey: SEAT, tick: SWALLOW_TICK })).toEqual([before, onFold]);
  });

  it('keeps nothing without a snapshot, and hands back the same array when nothing leaves', () => {
    const kept = [swallowOn(SWALLOW_TICK)];
    expect(giantSwallowsKeptAt(kept, { seatKey: null, tick: null })).toEqual([]);
    expect(giantSwallowsKeptAt(kept, { seatKey: SEAT, tick: SWALLOW_TICK })).toBe(kept);
  });
});

describe('giantPopupsIn (docs/ui/overlays.md §3.8, docs/ecology/giants.md §3.5.8)', () => {
  it('fires for each giant the own cell swallowed: its name, the DNA it paid and its real-life line', () => {
    for (const species of Object.values(GIANT_SPECIES)) {
      const swallow = giantSwallowOf(swallowed(species, { tick: SWALLOW_TICK }), true, SEAT);
      expect(giantPopupsIn(swallow === null ? [] : [swallow], SEAT, SWALLOW_TICK - 1, SWALLOW_TICK)).toEqual([
        {
          kind: UPGRADE_POPUP_KIND.giant,
          kicker: GIANT_POPUP_KICKER_TEXT,
          traitId: null,
          giantSpecies: species,
          title: GIANT_DISPLAY_NAME_BY_SPECIES[species],
          effects: [unbroken(`+${GIANT_DNA} DNA`)],
          effectTones: [UI_EFFECT.benefit],
          realLifeLine: GIANT_REAL_LIFE_LINES[species],
        },
      ]);
    }
  });

  it('shows the DNA the payout measured, a Nucleoid’s share included', () => {
    const swallow = { ...swallowOn(SWALLOW_TICK), dnaGained: NUCLEOID_GIANT_DNA };
    const [popup] = giantPopupsIn([swallow], SEAT, SWALLOW_TICK - 1, SWALLOW_TICK);
    expect(popup?.effects).toEqual([unbroken(`+${NUCLEOID_GIANT_DNA} DNA`)]);
  });

  it('fires only the seat’s swallows after the last fold and by this one, in their order', () => {
    const swallows = [
      swallowOn(SWALLOW_TICK - 1),
      { ...swallowOn(SWALLOW_TICK), species: GIANT_SPECIES.diatom },
      swallowOn(SWALLOW_TICK, OTHER_SEAT),
      { ...swallowOn(SWALLOW_TICK + 1), species: GIANT_SPECIES.paramecium },
      swallowOn(SWALLOW_TICK + 2),
    ];
    const fired = giantPopupsIn(swallows, SEAT, SWALLOW_TICK - 1, SWALLOW_TICK + 1);
    expect(fired.map((popup) => popup.giantSpecies)).toEqual([GIANT_SPECIES.diatom, GIANT_SPECIES.paramecium]);
  });
});
