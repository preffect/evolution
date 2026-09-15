import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ZONE_ID, entityId, gelSpeedFactor, secondsToTicks } from '@evolution/shared';
import { ZONE_PILL_COOLDOWN_SECONDS, ZONE_PILL_SECONDS } from '../../render/constants';
import { isZonePillUp, zoneEntryFor, zonePillText, type ZoneEntrySample } from './zone-pill';

const OWN = entityId('own');
const PILL_TICKS = secondsToTicks(ZONE_PILL_SECONDS);
const COOLDOWN_TICKS = secondsToTicks(ZONE_PILL_COOLDOWN_SECONDS);

function sampleAt(tick: number, zone: ZoneEntrySample['zone'], cellId = OWN): ZoneEntrySample {
  return { cellId, zone, tick };
}

describe('zonePillText', () => {
  const base = { mass: 312, traits: [], balance: DEFAULT_BALANCE };

  it('says the vent multiplier and its rods from the live balance', () => {
    expect(zonePillText({ ...base, zone: ZONE_ID.warmVent })).toBe(
      `Warm vent · decay ×${DEFAULT_BALANCE.ecology.VENT_DECAY_MULTIPLIER} · orange rods`,
    );
    const patched = structuredClone(DEFAULT_BALANCE);
    patched.ecology.VENT_DECAY_MULTIPLIER = 2;
    expect(zonePillText({ ...base, balance: patched, zone: ZONE_ID.warmVent })).toBe(
      'Warm vent · decay ×2 · orange rods',
    );
  });

  it('names the shallows light and its green rods', () => {
    expect(zonePillText({ ...base, zone: ZONE_ID.sunlitShallows })).toBe('Sunlit shallows · light · green rods');
  });

  it('gives the gel speed at the own mass with one decimal and names no rods', () => {
    const factor = gelSpeedFactor(312, DEFAULT_BALANCE.growth, 0);
    expect(zonePillText({ ...base, zone: ZONE_ID.viscousGel })).toBe(
      `Viscous gel · your speed ×${Number(factor.toFixed(1))}`,
    );
  });

  it('has no pill in the open broth', () => {
    expect(zonePillText({ ...base, zone: ZONE_ID.openBroth })).toBeNull();
  });
});

describe('zoneEntryFor / isZonePillUp', () => {
  it(`shows the pill for ${ZONE_PILL_SECONDS} s on entering a zone`, () => {
    const broth = zoneEntryFor(null, sampleAt(0, ZONE_ID.openBroth));
    expect(isZonePillUp(broth, 0)).toBe(false);
    const vent = zoneEntryFor(broth, sampleAt(10, ZONE_ID.warmVent));
    expect(isZonePillUp(vent, 10)).toBe(true);
    expect(isZonePillUp(zoneEntryFor(vent, sampleAt(10 + PILL_TICKS - 1, ZONE_ID.warmVent)), 10 + PILL_TICKS - 1)).toBe(
      true,
    );
    expect(isZonePillUp(zoneEntryFor(vent, sampleAt(10 + PILL_TICKS, ZONE_ID.warmVent)), 10 + PILL_TICKS)).toBe(false);
  });

  it('counts the first alive snapshot of a (re)spawn inside a zone as an entry', () => {
    expect(isZonePillUp(zoneEntryFor(null, sampleAt(5, ZONE_ID.warmVent)), 5)).toBe(true);
  });

  it(`shows nothing on a re-entry within ${ZONE_PILL_COOLDOWN_SECONDS} s, and again after it`, () => {
    const entered = zoneEntryFor(null, sampleAt(0, ZONE_ID.warmVent));
    const left = zoneEntryFor(entered, sampleAt(5, ZONE_ID.openBroth));
    expect(isZonePillUp(left, 5)).toBe(false);
    const back = zoneEntryFor(left, sampleAt(COOLDOWN_TICKS - 1, ZONE_ID.warmVent));
    expect(isZonePillUp(back, COOLDOWN_TICKS - 1)).toBe(false);
    const away = zoneEntryFor(back, sampleAt(COOLDOWN_TICKS, ZONE_ID.openBroth));
    const later = zoneEntryFor(away, sampleAt(2 * COOLDOWN_TICKS, ZONE_ID.warmVent));
    expect(isZonePillUp(later, 2 * COOLDOWN_TICKS)).toBe(true);
  });

  it('forgets the cooldown on a new own cell, so a respawn in the vent is told', () => {
    const entered = zoneEntryFor(null, sampleAt(0, ZONE_ID.warmVent));
    const respawned = zoneEntryFor(entered, sampleAt(1, ZONE_ID.warmVent, entityId('respawned')));
    expect(isZonePillUp(respawned, 1)).toBe(true);
  });

  it('drops the pill when the cell leaves the zone it was shown for', () => {
    const entered = zoneEntryFor(null, sampleAt(0, ZONE_ID.warmVent));
    expect(isZonePillUp(zoneEntryFor(entered, sampleAt(1, ZONE_ID.openBroth)), 1)).toBe(false);
  });
});
