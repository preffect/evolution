// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GIANT_SPECIES,
  entityId,
  type CellAbsorbedEffect,
  type GiantSpecies,
} from '@evolution/shared';
import { createTestCellAbsorbedEffect, createTestEatEffect } from '../../../../testing/builders';
import { UI_EFFECT } from '../../../ui-kit/ui-effect-mark.component';
import { GIANT_DISPLAY_NAME_BY_SPECIES, GIANT_REAL_LIFE_LINES } from './giant-facts';
import { GIANT_POPUP_KICKER_TEXT, giantPopupsIn } from './giant-popups';
import { UPGRADE_POPUP_KIND } from './upgrade-popup-kinds';

const OWN_CELL_ID = entityId('c-own');
const RIVAL_CELL_ID = entityId('c-rival');
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

describe('giantPopupsIn (docs/ui/overlays.md §3.8, docs/ecology/giants.md §3.5.8)', () => {
  it('fires for each giant the own cell swallowed: its name, the DNA it paid and its real-life line', () => {
    for (const species of Object.values(GIANT_SPECIES)) {
      expect(giantPopupsIn([swallowed(species)], OWN_CELL_ID)).toEqual([
        {
          kind: UPGRADE_POPUP_KIND.giant,
          kicker: GIANT_POPUP_KICKER_TEXT,
          traitId: null,
          giantSpecies: species,
          title: GIANT_DISPLAY_NAME_BY_SPECIES[species],
          effects: [`+${GIANT_DNA} DNA`],
          effectTones: [UI_EFFECT.benefit],
          realLifeLine: GIANT_REAL_LIFE_LINES[species],
        },
      ]);
    }
  });

  it('shows the DNA the payout measured, a Nucleoid’s share included', () => {
    const [popup] = giantPopupsIn(
      [swallowed(GIANT_SPECIES.diatom, { predatorDnaGained: NUCLEOID_GIANT_DNA })],
      OWN_CELL_ID,
    );
    expect(popup?.effects).toEqual([`+${NUCLEOID_GIANT_DNA} DNA`]);
  });

  it('fires nothing for a giant another cell ate, for a prey that was not a giant, or for another effect', () => {
    const effects = [
      swallowed(GIANT_SPECIES.amoeba, { predatorCellId: RIVAL_CELL_ID }),
      swallowed(null),
      createTestEatEffect(),
    ];
    expect(giantPopupsIn(effects, OWN_CELL_ID)).toEqual([]);
  });
});
