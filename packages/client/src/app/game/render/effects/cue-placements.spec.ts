import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ZONE_ID, createTestPlayerProgressView, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { FAKE_CUE_CHAR_PX } from '../../../../testing/fake-cue-text';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { CUE_RIM, rateTagsFor } from '../../hud/format/mass-cues';
import { MASS_TREND } from '../../state/mass-trend';
import { ownCellIndicatorsFor, type OwnCellIndicators } from '../../state/own-cell-indicators';
import {
  CUE_GAP_PX,
  CUE_PILL_HEIGHT_PX,
  CUE_PILL_PAD_PX,
  CUE_SEGMENT_GAP_PX,
  DANGER,
  LABEL_PILL_HEIGHT_PX,
  WHITE,
  ZONE_CUE,
} from '../constants';
import { CUE_TEXT_ROLE } from './cue-text';
import { cueLayoutOf, cuePlacements, cueRowsFor, type CueFrame } from './cue-placements';
import { selfRingRadiusPx } from './own-cell-geometry';

const textures = createTestRenderTextures().indicators;
const ZOOM = 2;
const OWN = createTestCellView({ id: entityId('own'), x: 100, y: 50, radius: 24, mass: 312 });

function record(overrides: Partial<OwnCellIndicators> = {}): OwnCellIndicators {
  const base = ownCellIndicatorsFor({
    ownCell: OWN,
    ownProgress: createTestPlayerProgressView(),
    balance: DEFAULT_BALANCE,
    threats: [],
    previewTraitId: null,
  });
  return { ...base, ...overrides };
}

function frameOf(indicators: OwnCellIndicators, overrides: Partial<CueFrame> = {}): CueFrame {
  return {
    indicators,
    ownCell: OWN,
    zoom: ZOOM,
    textures,
    measurePx: (text) => text.length * FAKE_CUE_CHAR_PX,
    rateTags: indicators.rateTags,
    labelBoxes: [],
    ...overrides,
  };
}

function placementsOf(frame: CueFrame) {
  const rows = cueRowsFor(frame);
  const layout = cueLayoutOf(frame, rows);
  return { rows, layout, placements: cuePlacements(frame, rows, layout, []) };
}

describe('cuePlacements: the mass chip', () => {
  it('draws the mass alone on the unrimmed cue pill, CUE_GAP_PX above the self ring, while steady', () => {
    const { layout, placements } = placementsOf(frameOf(record()));
    expect(placements.backings).toHaveLength(1);
    expect(placements.backings[0]).toMatchObject({ texture: textures.cuePills.none, heightPx: CUE_PILL_HEIGHT_PX });
    expect(placements.backings[0]?.y).toBeCloseTo(OWN.y + layout.chip.y / ZOOM);
    expect(layout.chip.y + CUE_PILL_HEIGHT_PX / 2).toBeCloseTo(-(selfRingRadiusPx(OWN.radius * ZOOM) + CUE_GAP_PX));
    expect(placements.texts.map((text) => [text.text, text.role, text.tint])).toEqual([
      ['312', CUE_TEXT_ROLE.value, WHITE],
    ]);
    expect(placements.sprites).toEqual([]);
  });

  it('adds the trend triangle, tinted DANGER and turned half a turn, and the unsigned rate while shrinking', () => {
    const chip = { mass: 312, trend: MASS_TREND.down, ratePerSecond: -9.36, rateText: '9.4/s' };
    const { rows, placements } = placementsOf(frameOf(record({ massChip: chip })));
    expect(placements.texts.map((text) => text.text)).toEqual(['312', '9.4/s']);
    expect(placements.sprites[0]).toMatchObject({ texture: textures.trendGlyph, tint: DANGER, rotation: Math.PI });
    const content = 3 * FAKE_CUE_CHAR_PX + textures.trendGlyph.widthPx + 5 * FAKE_CUE_CHAR_PX + 2 * CUE_SEGMENT_GAP_PX;
    expect(rows.chip.contentPx).toBe(content);
    expect(rows.chip.widthPx).toBe(content + 2 * CUE_PILL_PAD_PX);
  });

  it('places the parts left to right from the pill’s content edge', () => {
    const chip = { mass: 312, trend: MASS_TREND.up, ratePerSecond: 3, rateText: '3/s' };
    const { rows, placements } = placementsOf(frameOf(record({ massChip: chip })));
    const backing = placements.backings[0]!;
    const [mass, rate] = placements.texts;
    const firstCentrePx = -rows.chip.contentPx / 2 + (3 * FAKE_CUE_CHAR_PX) / 2;
    expect(mass!.x).toBeCloseTo(backing.x + firstCentrePx / ZOOM);
    expect(placements.sprites[0]!.x).toBeGreaterThan(mass!.x);
    expect(rate!.x).toBeGreaterThan(placements.sprites[0]!.x);
  });
});

describe('cuePlacements: the rate tags and the zone pill', () => {
  it('draws each tag on its rim pill with its uppercased cause, and the DECAY tag’s ghost and share', () => {
    const tags = rateTagsFor(
      { ratesPerSecond: { toxin: -9.36, decay: -0.5 }, decayTraitShare: -0.15, zone: ZONE_ID.warmVent },
      [{ traitId: 'mitochondrion', tier: 1 }],
      DEFAULT_BALANCE,
    );
    const { placements } = placementsOf(frameOf(record({ rateTags: tags })));
    expect(placements.backings.map((backing) => backing.texture)).toEqual([
      textures.cuePills.none,
      textures.cuePills[CUE_RIM.danger],
      textures.cuePills[CUE_RIM.none],
    ]);
    expect(placements.texts.map((text) => text.text)).toEqual(['312', '−9.4/s', 'TOXIN', '−0.5/s', 'DECAY', '−15 %']);
    expect(placements.sprites[0]).toMatchObject({ texture: textures.ghosts.mitochondrion, tint: WHITE });
  });

  it('draws the zone pill on the unrimmed label pill with its tinted dot, and not while a label covers it', () => {
    const zone = { zone: ZONE_ID.warmVent, pillText: 'Warm vent · decay ×1.5' };
    const frame = frameOf(record({ zone }));
    const { layout, placements } = placementsOf(frame);
    const pill = placements.backings.find((backing) => backing.texture === textures.zonePill);
    expect(pill?.heightPx).toBe(LABEL_PILL_HEIGHT_PX);
    expect(placements.sprites[0]).toMatchObject({ texture: textures.zoneDot, tint: ZONE_CUE[ZONE_ID.warmVent] });
    expect(placements.texts.at(-1)?.text).toBe('WARM VENT · DECAY ×1.5');
    const covered = placementsOf(frameOf(record({ zone }), { labelBoxes: [layout.zonePill!] }));
    expect(covered.placements.backings.some((backing) => backing.texture === textures.zonePill)).toBe(false);
  });
});

describe('cuePlacements: the floaters', () => {
  it('draws a floater from its left and bottom edges on its rim pill, at its alpha', () => {
    const frame = frameOf(record());
    const rows = cueRowsFor(frame);
    const floater = {
      cause: 'food',
      amountText: '+3',
      causeLabel: 'Food',
      rim: CUE_RIM.gain,
      leftPx: 40,
      bottomPx: -CUE_GAP_PX,
      alpha: 0.5,
    } as const;
    const placements = cuePlacements(frame, rows, cueLayoutOf(frame, rows), [floater]);
    const backing = placements.backings.at(-1)!;
    const widthPx = 2 * FAKE_CUE_CHAR_PX + 4 * FAKE_CUE_CHAR_PX + CUE_SEGMENT_GAP_PX + 2 * CUE_PILL_PAD_PX;
    expect(backing).toMatchObject({ texture: textures.cuePills.gain, alpha: 0.5, widthPx });
    expect(backing.x).toBeCloseTo(OWN.x + (40 + widthPx / 2) / ZOOM);
    expect(backing.y).toBeCloseTo(OWN.y + (-CUE_GAP_PX - CUE_PILL_HEIGHT_PX / 2) / ZOOM);
    expect(placements.texts.slice(-2).map((text) => [text.text, text.alpha])).toEqual([
      ['+3', 0.5],
      ['FOOD', 0.5],
    ]);
  });
});
