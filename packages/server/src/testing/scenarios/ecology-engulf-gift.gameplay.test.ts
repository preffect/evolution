// docs/ecology/acceptance.md §8 E9c (#271): the absorption share reads the prey's earned DNA, never the
// entry-rule gift, so a lifted player is worth the base alone. Run twice and hash-compared. The E9 setup is
// `engulf-setups.ts`; every expected number is derived from the payout constants.

import { describe, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { progressOf } from '../gameplay/evolution-views.js';
import { E9_PAYOUT_TICK, absorption, dnaOfPredator, engulfPairOf } from './engulf-setups.js';

/** "B's player given `dnaCumulative` 140 with `dnaCatchUpGift` 100 at setup", then all gift and none. */
const PREY_DNA = 140;
const PARTIAL_GIFT = 100;
const NO_GIFT = 0;
/** DNA and score are exact sums of the payout constants; this only absorbs the float residue. */
const DNA_TOLERANCE = 1e-9;
const scoreOfPredator = (view: Parameters<typeof dnaOfPredator>[0]) => progressOf(view, 0)?.score;

function expectedPredatorDna(preyGift: number): number {
  return absorption.ENGULF_DNA_BASE + (PREY_DNA - preyGift) * absorption.ENGULF_DNA_SHARE;
}

async function runE9c(name: string, preyGift: number): Promise<void> {
  const predatorDna = expectedPredatorDna(preyGift);
  await engulfPairOf(name, {}, { dnaCumulative: PREY_DNA, dnaCatchUpGift: preyGift })
    .advance(E9_PAYOUT_TICK)
    .expect('A DNA = ENGULF_DNA_BASE + ENGULF_DNA_SHARE × (dnaCumulative − dnaCatchUpGift)', dnaOfPredator)
    .atTick(E9_PAYOUT_TICK)
    .toBeCloseTo(predatorDna, DNA_TOLERANCE)
    .expect('A score = that DNA + SCORE_ABSORPTION_BONUS', scoreOfPredator)
    .atTick(E9_PAYOUT_TICK)
    .toBeCloseTo(predatorDna + DEFAULT_BALANCE.session.SCORE_ABSORPTION_BONUS, DNA_TOLERANCE)
    .runDeterministic();
}

describe('ecology/acceptance.md §8 E9c: the absorption share reads earned DNA (#271)', () => {
  it('E9c: B at 140 DNA, 100 of it gift, pays A 38 DNA and a score of 63', async () => {
    await runE9c('E9c partial gift', PARTIAL_GIFT);
  });

  it('E9c: B all gift (140 / 140) pays A the base alone', async () => {
    await runE9c('E9c all gift', PREY_DNA);
  });

  it('E9c: B with no gift (140 / 0) pays A the full share', async () => {
    await runE9c('E9c no gift', NO_GIFT);
  });
});
