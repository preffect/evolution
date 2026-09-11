// docs/ECOLOGY.md §3.2: the trip rows never change; the broth and gel row is derived from the
// stage's share (every broth cluster is plain in the protocell era, 0.4 / 0.3 / 0.3 by the eukaryote era).

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { STAGE_ORDER } from '../constants/ladder.js';
import { CELL_STAGE, ZONE_ID } from '../types/game.js';
import { bacteriumVariantWeightsForZone, brothVariantWeights } from './bacterium-variant-weights.js';

const balance = DEFAULT_BALANCE.ecology;
const WEIGHT_TOLERANCE_DIGITS = 10;
const ENDOSYMBIOSIS_BROTH_ROW = { plain: 0.6, aerobic: 0.2, photosynthetic: 0.2 };
const EUKARYOTE_BROTH_ROW = { plain: 0.4, aerobic: 0.3, photosynthetic: 0.3 };

describe('bacteriumVariantWeightsForZone', () => {
  it.each(STAGE_ORDER)('keeps the trip rows fixed in the %s era', (stage) => {
    expect(bacteriumVariantWeightsForZone(ZONE_ID.warmVent, stage, balance)).toBe(
      balance.BACTERIUM_VARIANT_WEIGHTS_BY_ZONE[ZONE_ID.warmVent],
    );
    expect(bacteriumVariantWeightsForZone(ZONE_ID.sunlitShallows, stage, balance)).toBe(
      balance.BACTERIUM_VARIANT_WEIGHTS_BY_ZONE[ZONE_ID.sunlitShallows],
    );
  });

  it('makes every broth cluster plain in the protocell era', () => {
    expect(bacteriumVariantWeightsForZone(ZONE_ID.openBroth, CELL_STAGE.protocell, balance)).toEqual({
      plain: 1,
      aerobic: 0,
      photosynthetic: 0,
    });
  });

  it('gives the broth the quoted 0.6 / 0.2 / 0.2 in the endosymbiosis era and 0.4 / 0.3 / 0.3 by the eukaryote era', () => {
    expect(bacteriumVariantWeightsForZone(ZONE_ID.openBroth, CELL_STAGE.endosymbiosis, balance)).toEqual(
      ENDOSYMBIOSIS_BROTH_ROW,
    );
    expect(bacteriumVariantWeightsForZone(ZONE_ID.openBroth, CELL_STAGE.eukaryote, balance)).toEqual(
      EUKARYOTE_BROTH_ROW,
    );
  });

  it.each(STAGE_ORDER)('gives the gel the broth row in the %s era', (stage) => {
    expect(bacteriumVariantWeightsForZone(ZONE_ID.viscousGel, stage, balance)).toEqual(
      bacteriumVariantWeightsForZone(ZONE_ID.openBroth, stage, balance),
    );
  });

  it.each(STAGE_ORDER)('keeps the derived row a distribution in the %s era', (stage) => {
    const row = bacteriumVariantWeightsForZone(ZONE_ID.openBroth, stage, balance);
    expect(row.plain + row.aerobic + row.photosynthetic).toBeCloseTo(1, WEIGHT_TOLERANCE_DIGITS);
  });
});

describe('brothVariantWeights', () => {
  it('splits the share evenly between the two organelle variants', () => {
    expect(brothVariantWeights(0.5)).toEqual({ plain: 0.5, aerobic: 0.25, photosynthetic: 0.25 });
  });
});
