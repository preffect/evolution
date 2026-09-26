// Ticket #367: the engulf's tunables are the three phase seconds (docs/ecology/constants.md §7), so a
// `debug_set_balance` patch of one of them is felt in play, and the base duration and the two progress bands derived
// from them are not patch keys. The E9 pair (`testing/engulf-builders.ts`) at a mass factor of 0.5 pays out on tick 36
// by default; with the wrap stretched from 0.4 s to 1.0 s the whole engulf is 1.8 s, 54 ticks at that factor.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ENGULF_PHASE, engulfPhaseOf, type BalanceConfig } from '@evolution/shared';
import { E9_COVER_TICKS, E9_SEAL_TICK, createEngulfFixture, stepEngulf } from '../../testing/engulf-builders.js';
import { createTestStepContext } from '../../testing/world-builders.js';
import { DebugRequestError } from '../debug/debug-request-error.js';
import { setBalanceForDebug } from '../debug/debug-operations.js';

/** Real balance paths, named through constants because a patch is keyed by constant names. */
const WRAP_SECONDS_LEAF = 'ENGULF_WRAP_SECONDS';
const DERIVED_LEAVES = ['ENGULF_BASE_DURATION_SECONDS', 'ENGULF_WRAP_START_PROGRESS', 'ENGULF_SEAL_PROGRESS'];
const STRETCHED_WRAP_SECONDS = 1.0;
/** Cover 0.2 s of 1.8 s is still six ticks of 54; the seal at 1.2 s of 1.8 s is tick 36, the payout tick 54. */
const STRETCHED_SEAL_TICK = 36;
const STRETCHED_PAYOUT_TICK = 54;

/** The E9 pair in a world whose balance `debug_set_balance` has patched, the step reading the patched copy. */
function patchedFixture() {
  const fixture = createEngulfFixture();
  setBalanceForDebug(fixture.world, { absorption: { [WRAP_SECONDS_LEAF]: STRETCHED_WRAP_SECONDS } });
  fixture.context = createTestStepContext(fixture.world);
  return fixture;
}

describe('an engulf over a patched ENGULF_WRAP_SECONDS (#367)', () => {
  it('keeps the cover span, moves the seal and the payout later', () => {
    const fixture = patchedFixture();
    const absorption = fixture.world.balance.absorption;
    stepEngulf(fixture, E9_COVER_TICKS);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.wrap);
    // The default seal tick: still wrapping, where the unpatched engulf has sealed.
    stepEngulf(fixture, E9_SEAL_TICK - E9_COVER_TICKS);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.wrap);
    expect(fixture.prey.carriedOffsetX).toBeNull();
    stepEngulf(fixture, STRETCHED_SEAL_TICK - 1 - E9_SEAL_TICK);
    expect(fixture.prey.carriedOffsetX).toBeNull();
    stepEngulf(fixture);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.absorb);
    expect(fixture.prey.carriedOffsetX).not.toBeNull();
    stepEngulf(fixture, STRETCHED_PAYOUT_TICK - 1 - STRETCHED_SEAL_TICK);
    expect(fixture.predator.engulfingCellId).toBe(fixture.prey.id);
    stepEngulf(fixture);
    expect(fixture.predator.engulfingCellId).toBeNull();
  });

  it.each(DERIVED_LEAVES)('refuses a patch of the derived %s and keeps the balance', (leaf) => {
    const fixture = createEngulfFixture();
    const before: BalanceConfig = fixture.world.balance;
    expect(() => setBalanceForDebug(fixture.world, { absorption: { [leaf]: 1 } })).toThrow(DebugRequestError);
    expect(fixture.world.balance).toBe(before);
    expect(Object.keys(DEFAULT_BALANCE.absorption)).not.toContain(leaf);
  });
});
