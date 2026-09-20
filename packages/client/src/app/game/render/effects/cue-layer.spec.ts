import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ZONE_ID,
  createTestPlayerProgressView,
  entityId,
  type CellView,
  type MassFlowView,
} from '@evolution/shared';
import { createTestCellView, createTestEatEffect } from '../../../../testing/builders';
import { createFakeCueText } from '../../../../testing/fake-cue-text';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { rateTagsFor } from '../../hud/format/mass-cues';
import { MASS_TREND } from '../../state/mass-trend';
import { ownCellIndicatorsFor, type OwnCellIndicators } from '../../state/own-cell-indicators';
import { FLOATER_LIFETIME_MS, RATE_TAG_REFRESH_MS } from '../constants';
import { CueLayer, type CueLayerFrame } from './cue-layer';

const textures = createTestRenderTextures().indicators;
const OWN = createTestCellView({ id: entityId('own'), radius: 24, mass: 312 });

function record(cell: CellView, overrides: Partial<OwnCellIndicators> = {}): OwnCellIndicators {
  const base = ownCellIndicatorsFor({
    ownCell: cell,
    ownProgress: createTestPlayerProgressView(),
    balance: DEFAULT_BALANCE,
    threats: [],
    previewTraitId: null,
  });
  return { ...base, ...overrides };
}

function tagsOf(ratesPerSecond: MassFlowView['ratesPerSecond']) {
  return rateTagsFor({ ratesPerSecond, zone: ZONE_ID.openBroth }, [], DEFAULT_BALANCE);
}

function frameAt(
  nowMs: number,
  indicators: OwnCellIndicators | null,
  overrides: Partial<CueLayerFrame> = {},
): CueLayerFrame {
  return { indicators, ownCell: OWN, zoom: 1, nowMs, effects: [], labelBoxes: [], ...overrides };
}

function layer() {
  const text = createFakeCueText();
  return { subject: new CueLayer(textures, text.factory), text };
}

function drawnTexts(text: ReturnType<typeof createFakeCueText>): string[] {
  return text.drawn.texts.map((drawn) => drawn.text);
}

describe('CueLayer', () => {
  it('draws nothing, and builds no text, without a record or an own cell', () => {
    const { subject } = layer();
    expect(subject.update(frameAt(0, null))).toEqual({ pills: 0, texts: 0, sprites: 0 });
    expect(subject.update(frameAt(0, record(OWN), { ownCell: null }))).toEqual({ pills: 0, texts: 0, sprites: 0 });
    expect(subject.container.children).toHaveLength(1);
    subject.destroy();
  });

  it('applies the placements: pills and texts through the text view, glyphs from its sprite pool', () => {
    const { subject, text } = layer();
    const chip = { mass: 312, trend: MASS_TREND.up, ratePerSecond: 3, rateText: '3/s' };
    expect(subject.update(frameAt(0, record(OWN, { massChip: chip })))).toEqual({ pills: 1, texts: 2, sprites: 1 });
    expect(drawnTexts(text)).toEqual(['312', '3/s']);
    expect(subject.sprites[0]?.visible).toBe(true);
    subject.update(frameAt(1, record(OWN)));
    expect(subject.sprites[0]?.visible).toBe(false);
    subject.destroy();
  });

  it('spawns a floater for the own eat, and the sprint cost once per tick', () => {
    const { subject, text } = layer();
    const eat = createTestEatEffect({ cellId: OWN.id, massGained: 3, dnaGained: 0 });
    subject.update(frameAt(0, record(OWN), { effects: [eat] }));
    expect(drawnTexts(text)).toEqual(['312', '+3', 'FOOD']);
    const sprinting = record(OWN, { sprintSpent: { amount: 16, tick: 5 } });
    subject.update(frameAt(10, sprinting));
    subject.update(frameAt(20, sprinting));
    expect(drawnTexts(text)).toContain('−16');
    expect(drawnTexts(text)).not.toContain('−32');
    subject.destroy();
  });

  it('adds a later eat to the FOOD floater already drawn rather than drawing a second one (#443)', () => {
    const { subject, text } = layer();
    const eat = createTestEatEffect({ cellId: OWN.id, massGained: 3, dnaGained: 0 });
    subject.update(frameAt(0, record(OWN), { effects: [eat] }));
    expect(drawnTexts(text)).toEqual(['312', '+3', 'FOOD']);
    // One FOOD row, its amount climbing: two rows here would be the clutter the ticket removes.
    subject.update(frameAt(FLOATER_LIFETIME_MS - 1, record(OWN), { effects: [eat] }));
    expect(drawnTexts(text)).toEqual(['312', '+6', 'FOOD']);
    subject.destroy();
  });

  it(`holds a tag's text for ${RATE_TAG_REFRESH_MS} ms while the same causes show, and changes at once when one leaves`, () => {
    const { subject, text } = layer();
    subject.update(frameAt(0, record(OWN, { rateTags: tagsOf({ toxin: -9.36 }) })));
    subject.update(frameAt(RATE_TAG_REFRESH_MS - 1, record(OWN, { rateTags: tagsOf({ toxin: -8 }) })));
    expect(drawnTexts(text)).toContain('−9.4/s');
    subject.update(frameAt(RATE_TAG_REFRESH_MS, record(OWN, { rateTags: tagsOf({ toxin: -8 }) })));
    expect(drawnTexts(text)).toContain('−8/s');
    subject.update(frameAt(RATE_TAG_REFRESH_MS + 1, record(OWN, { rateTags: tagsOf({ decay: -0.5 }) })));
    expect(drawnTexts(text)).toEqual(['312', '−0.5/s', 'DECAY']);
    subject.destroy();
  });

  it('starts fresh on a new own cell: its floaters do not carry over', () => {
    const { subject, text } = layer();
    const eat = createTestEatEffect({ cellId: OWN.id, massGained: 3, dnaGained: 0 });
    subject.update(frameAt(0, record(OWN), { effects: [eat] }));
    const respawned = createTestCellView({ id: entityId('respawned'), radius: 24, mass: 20 });
    subject.update(frameAt(1, record(respawned), { ownCell: respawned }));
    expect(drawnTexts(text)).toEqual(['20']);
    subject.destroy();
  });

  it('measures each distinct string once and places every part at that width on later frames', () => {
    const { subject, text } = layer();
    const indicators = record(OWN, { rateTags: tagsOf({ toxin: -9.36 }) });
    subject.update(frameAt(0, indicators));
    // `312`, `−9.4/s`, `TOXIN`: one measure each, even though sizing and placing both read the widths.
    expect(text.counts.measures).toBe(3);
    subject.update(frameAt(RATE_TAG_REFRESH_MS, indicators));
    expect(text.counts.measures).toBe(3);
    expect(drawnTexts(text)).toEqual(['312', '−9.4/s', 'TOXIN']);
    subject.destroy();
  });
});
