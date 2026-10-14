// The dive's dish scene (docs/rendering/opening-dive.md §4): a scripted frame the real renderer takes — your cell at
// the dish centre at its true size, seeded bacteria and specks inside the dish, the own-cell record for the ring.

import {
  CELL_KIND,
  DEFAULT_BALANCE,
  DISH_RADIUS,
  TICK_INTERVAL_S,
  radiusForMass,
  type BalanceConfig,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_BACTERIA_COUNT, DIVE_METRES_PER_WU, DIVE_MOTE_COUNT, DIVE_OWN_CELL_DIAMETER_M } from '../constants';
import { DIVE_OWN_CELL_RADIUS_WU, DIVE_OWN_PLAYER_ID, createDiveMicroScene, massForRadius } from './dive-micro-scene';

const DIGITS = 6;

describe('createDiveMicroScene', () => {
  const frame = createDiveMicroScene().frameAt(2, DEFAULT_BALANCE);
  const own = frame.cells.find((cell) => cell.playerId === DIVE_OWN_PLAYER_ID);
  const bacteria = frame.cells.filter((cell) => cell.kind === CELL_KIND.wild);

  it('puts your cell at the dish centre, 1.6 µm across at the dive’s scale', () => {
    expect(own).toBeDefined();
    expect(own).toMatchObject({ x: 0, y: 0, kind: CELL_KIND.player, avatarIndex: 0 });
    expect(own!.radius * 2 * DIVE_METRES_PER_WU).toBeCloseTo(DIVE_OWN_CELL_DIAMETER_M, DIGITS + 6);
  });

  it('derives your mass from that size through the live growth curve', () => {
    const doubled: BalanceConfig = structuredClone(DEFAULT_BALANCE);
    doubled.growth.CELL_RADIUS_SCALE *= 2;
    const patched = createDiveMicroScene().frameAt(0, doubled).cells[0]!;
    expect(patched.radius).toBeCloseTo(DIVE_OWN_CELL_RADIUS_WU, DIGITS);
    expect(radiusForMass(massForRadius(100, DEFAULT_BALANCE), DEFAULT_BALANCE.growth)).toBeCloseTo(100, DIGITS);
  });

  it('scatters its bacteria and specks inside the dish, clear of your cell', () => {
    expect(bacteria).toHaveLength(DIVE_BACTERIA_COUNT);
    expect(frame.motes).toHaveLength(DIVE_MOTE_COUNT);
    for (const body of [...bacteria, ...frame.motes]) {
      const distance = Math.hypot(body.x, body.y);
      expect(distance).toBeLessThan(DISH_RADIUS);
      expect(distance).toBeGreaterThan(DIVE_OWN_CELL_RADIUS_WU);
    }
  });

  it('keeps every bacterium too small to engulf you, so none wears the warning ring', () => {
    const ratio = DEFAULT_BALANCE.absorption.ENGULF_MASS_RATIO;
    for (const bacterium of bacteria) expect(bacterium.mass).toBeLessThan(own!.mass * ratio);
  });

  it('is the same scene every open: seeded, never random', () => {
    const again = createDiveMicroScene().frameAt(2, DEFAULT_BALANCE);
    expect(again.cells).toEqual(frame.cells);
    expect(again.motes).toEqual(frame.motes);
  });

  it('drifts the bacteria with time and holds the specks', () => {
    const later = createDiveMicroScene().frameAt(5, DEFAULT_BALANCE);
    expect(later.cells[1]!.x).not.toBe(frame.cells[1]!.x);
    expect(later.motes).toEqual(frame.motes);
  });

  it('hands the renderer the time in ticks', () => {
    expect(frame.renderTick).toBeCloseTo(2 / TICK_INTERVAL_S, DIGITS);
    expect(frame.timeSeconds).toBeCloseTo(2, DIGITS);
  });

  it('builds your own-cell record, so the self ring draws round you', () => {
    const scene = createDiveMicroScene();
    expect(scene.ownCellIndicators(scene.frameAt(0, DEFAULT_BALANCE))).not.toBeNull();
  });
});
