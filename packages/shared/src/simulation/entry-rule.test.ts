// docs/PROGRESSION.md §5 and the entry rows of its scenarios: W5 (a respawn in the first minutes
// stays at the starting mass), G13 (the cap from 6:20), G14 and P7 (the median term of a late join).

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { entryDnaFloor, entryMass } from './entry-rule.js';
import { worldReference } from './world-clock.js';

const balance = DEFAULT_BALANCE;
const STARTING_MASS = balance.growth.CELL_STARTING_MASS;
const ENTRY_CAP = balance.progression.ENTRY_MAX_MASS;
/** W5: a respawn at 3.62 s reads 0.5 × 23.62 = 11.81 < 20. */
const W5_SECONDS = 3.62;
/** G14: at 5:00 solo the world floor is level 2 and `worldMass` 320. */
const G14_SECONDS = 300;
const G14_MASS = 160;
const G14_DNA = 60;
/** G13: at 393.017 s, 0.5 × 413.017 clamps to the cap. */
const G13_SECONDS = 393.017;
const G13_DNA = 140;
/** P7: a median mass of 400 clamps to the cap; a median DNA of 90 floors at 45. */
const P7_MEDIAN_MASS = 400;
const P7_MEDIAN_DNA = 90;
const P7_DNA_FLOOR = 45;
const ODD_MEDIAN_DNA = 91;

describe('entryMass', () => {
  it('is the starting mass in the first minutes (W5)', () => {
    expect(entryMass(null, worldReference(0, balance), balance)).toBe(STARTING_MASS);
    expect(entryMass(null, worldReference(W5_SECONDS, balance), balance)).toBe(STARTING_MASS);
  });

  it('is half the world mass at 5:00 solo (G14)', () => {
    expect(entryMass(null, worldReference(G14_SECONDS, balance), balance)).toBe(G14_MASS);
  });

  it('clamps to ENTRY_MAX_MASS from 6:20 on (G13)', () => {
    expect(entryMass(null, worldReference(G13_SECONDS, balance), balance)).toBe(ENTRY_CAP);
  });

  it('takes the larger of the median and the world for a late joiner (P7, G14)', () => {
    expect(entryMass(P7_MEDIAN_MASS, worldReference(0, balance), balance)).toBe(ENTRY_CAP);
    expect(entryMass(STARTING_MASS, worldReference(G14_SECONDS, balance), balance)).toBe(G14_MASS);
  });
});

describe('entryDnaFloor', () => {
  it('leaves an early joiner fresh: no median, world floor 0 (P8)', () => {
    expect(entryDnaFloor(0, null, worldReference(0, balance), balance)).toBe(0);
  });

  it('floors a respawn at the world DNA and never lowers a player above it (G13)', () => {
    const reference = worldReference(G13_SECONDS, balance);
    expect(entryDnaFloor(0, null, reference, balance)).toBe(G13_DNA);
    expect(entryDnaFloor(200, null, reference, balance)).toBe(200);
  });

  it('takes the larger of the median term and the world floor for a late joiner (G14, P7)', () => {
    expect(entryDnaFloor(0, 0, worldReference(G14_SECONDS, balance), balance)).toBe(G14_DNA);
    expect(entryDnaFloor(0, P7_MEDIAN_DNA, worldReference(0, balance), balance)).toBe(P7_DNA_FLOOR);
  });

  it('floors the median share to whole DNA', () => {
    expect(entryDnaFloor(0, ODD_MEDIAN_DNA, worldReference(0, balance), balance)).toBe(P7_DNA_FLOOR);
  });
});
