// The status mirror's legibility-cue half (docs/ui/hud.md §3.1.4): the four attributes, the spoken trend and zone,
// and what makes them re-announce. Its own file beside `own-cell-status.spec.ts`, which holds the ladder, sprint and
// threat half and is at the size limit.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ZONE_ID, createTestPlayerProgressView } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { MASS_TREND } from '../../state/mass-trend';
import { ownCellIndicatorsFor, type OwnCellIndicators } from '../../state/own-cell-indicators';
import { rateTagsFor } from './mass-cues';
import { formatOwnCellStatus, shouldAnnounce } from './own-cell-status';

const steady = ownCellIndicatorsFor({
  ownCell: createTestCellView({ mass: 312 }),
  ownProgress: createTestPlayerProgressView(),
  balance: DEFAULT_BALANCE,
  threats: [],
  previewTraitId: null,
});

const shrinking: OwnCellIndicators = {
  ...steady,
  massChip: { mass: 312, trend: MASS_TREND.down, ratePerSecond: -9.36, rateText: '9.4/s' },
  rateTags: rateTagsFor(
    { ratesPerSecond: { toxin: -9.36, decay: -0.5, vent: -0.25 }, zone: ZONE_ID.warmVent },
    [],
    DEFAULT_BALANCE,
  ),
  zone: { zone: ZONE_ID.warmVent, pillText: 'Warm vent · decay ×1.5 · orange rods' },
};

describe('formatOwnCellStatus: the legibility cues', () => {
  it('carries the trend, the net rate, the shown causes in drawn order and the zone, with ASCII minus', () => {
    const { attributes } = formatOwnCellStatus(shrinking);
    expect(attributes['data-mass-trend']).toBe('down');
    expect(attributes['data-mass-rate']).toBe('-9.4');
    expect(attributes['data-mass-causes']).toBe('toxin:-9.4 decay:-0.5 vent:-0.3');
    expect(attributes['data-zone']).toBe('warm_vent');
  });

  it('omits the causes and the zone when there are none', () => {
    const { attributes } = formatOwnCellStatus(steady);
    expect(attributes['data-mass-trend']).toBe('steady');
    expect(attributes['data-mass-causes']).toBeNull();
    expect(attributes['data-zone']).toBeNull();
  });

  it('speaks the trend and the zone pill’s line, with the multiplier said as a word', () => {
    const { text } = formatOwnCellStatus(shrinking);
    expect(text).toContain('Shrinking 9.4 a second');
    expect(text).toContain('Warm vent · decay times 1.5 · orange rods');
    expect(formatOwnCellStatus(steady).text).not.toContain('a second');
  });

  it('speaks again when the trend word or the pill changes, and stays silent while only the rate drifts', () => {
    const drifting: OwnCellIndicators = { ...shrinking, massChip: { ...shrinking.massChip, ratePerSecond: -8 } };
    expect(shouldAnnounce(formatOwnCellStatus(shrinking).announceKey, formatOwnCellStatus(drifting))).toBe(false);
    expect(shouldAnnounce(formatOwnCellStatus(steady).announceKey, formatOwnCellStatus(shrinking))).toBe(true);
    const pillDown: OwnCellIndicators = { ...shrinking, zone: { zone: ZONE_ID.warmVent, pillText: null } };
    expect(shouldAnnounce(formatOwnCellStatus(shrinking).announceKey, formatOwnCellStatus(pillDown))).toBe(true);
  });
});
