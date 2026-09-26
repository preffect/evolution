// docs/traits/constants-and-acceptance.md §6, T12: a Nuclear Envelope II prey keeps half its progress toward the next
// level through an engulf death, the spectate and the respawn through the entry rule (docs/game-design/session.md
// §5.2), run twice and hash-compared at every tick. The row names seed 42, so it runs on the table seed with its gel
// patches cleared (`engulfPairOnTableSeedOf`, #402); the pair is E9's, so B dies on E9's payout tick. A traitless
// control on the same death keeps none of it, so the row can only pass on the trait. Traits are fixture-granted.

import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  cumulativeDnaForLevel,
  levelUpCost,
  secondsToTicks,
  type CellStage,
  type OwnedTrait,
} from '@evolution/shared';
import { progressOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { E9_PAYOUT_TICK, engulfPairOnTableSeedOf, lifeStateOfPrey } from './engulf-setups.js';

const { progression, session, traits } = DEFAULT_BALANCE;
/** "Player at level 5 (cost 140, so 40 does not level up on tick 1) ... `dnaTowardNextLevel` 40". */
const T12_LEVEL = 5;
const T12_PROGRESS = 40;
const T12_DNA_CUMULATIVE = cumulativeDnaForLevel(T12_LEVEL, progression) + T12_PROGRESS;
const NUCLEAR_ENVELOPE_TIER = 2;
const ENVELOPE_KEPT_FRACTION = traits.TRAIT_TIERS.nuclear_envelope[NUCLEAR_ENVELOPE_TIER - 1]!.dnaKeptOnDeathFraction!;
const ONE_TICK = 1;
/** A death on tick t is spectated on t too, so the new cell is placed on t + the spectate + 1 (session.md §5.2, #211). */
const T12_RESPAWN_TICK = E9_PAYOUT_TICK + secondsToTicks(session.RESPAWN_SPECTATE_SECONDS) + ONE_TICK;
/** The row reads "respawn+1": the first tick the new cell runs a whole step. */
const T12_READ_TICK = T12_RESPAWN_TICK + ONE_TICK;
/** Nuclear Envelope requires the Nucleoid Coil (docs/traits/catalog-organelles.md §3.7). */
const ENVELOPED_TRAITS: OwnedTrait[] = [
  { traitId: 'nucleoid', tier: 1 },
  { traitId: 'nuclear_envelope', tier: NUCLEAR_ENVELOPE_TIER },
];

const progressTowardNextLevel = (view: EvolutionView): number | undefined => progressOf(view, 1)?.dnaTowardNextLevel;

/** What death must leave alone (session.md §5.2): level, traits and stage. */
const keptThroughDeath = (view: EvolutionView) => {
  const progress = progressOf(view, 1);
  return [progress?.level, progress?.ownedTraits, progress?.stage];
};

/** B, the E9 prey at level 5 with 40 toward level 6, dies on E9's payout tick and is read after its respawn. */
function t12(name: string, traits: OwnedTrait[], stage: CellStage) {
  const kept = [T12_LEVEL, traits, stage];
  return engulfPairOnTableSeedOf(name, {}, { dnaCumulative: T12_DNA_CUMULATIVE, traits })
    .hashEvery(1)
    .advance(T12_READ_TICK)
    .expect('40 toward the next level the tick before the death', progressTowardNextLevel)
    .atTick(E9_PAYOUT_TICK - ONE_TICK)
    .toBe(T12_PROGRESS)
    .expect(`B absorbed on tick ${E9_PAYOUT_TICK}`, lifeStateOfPrey)
    .atTick(E9_PAYOUT_TICK)
    .toBe(PLAYER_LIFE_STATE.spectating)
    .expect(`B respawned on tick ${T12_RESPAWN_TICK}`, lifeStateOfPrey)
    .atTick(T12_RESPAWN_TICK)
    .toBe(PLAYER_LIFE_STATE.alive)
    .expect('level, traits and stage as placed', keptThroughDeath)
    .atTick(E9_PAYOUT_TICK - ONE_TICK)
    .toEqual(kept)
    .expect('level, traits and stage unchanged after the respawn', keptThroughDeath)
    .atTick(T12_READ_TICK)
    .toEqual(kept)
    .expect('no entry lift: B is above the world level', (view) => progressOf(view, 1)?.dnaCatchUpGift)
    .atTick(T12_READ_TICK)
    .toBe(0);
}

describe('traits/constants-and-acceptance.md §6: T12, Nuclear Envelope through an engulf death (#401)', () => {
  it('places B short of a level-up, with a kept share the control can be told apart from', () => {
    expect(T12_PROGRESS).toBeLessThan(levelUpCost(T12_LEVEL, progression));
    expect(ENVELOPE_KEPT_FRACTION).toBeGreaterThan(0);
  });

  it('T12: Nuclear Envelope II keeps its share of the progress through death and respawn', async () => {
    await t12('T12', ENVELOPED_TRAITS, CELL_STAGE.eukaryote)
      .expect('the kept share on the tick of death', progressTowardNextLevel)
      .atTick(E9_PAYOUT_TICK)
      .toBe(T12_PROGRESS * ENVELOPE_KEPT_FRACTION)
      .expect('the kept share after the respawn', progressTowardNextLevel)
      .atTick(T12_READ_TICK)
      .toBe(T12_PROGRESS * ENVELOPE_KEPT_FRACTION)
      .runDeterministic();
  });

  it('T12 control: the same death without the envelope keeps none of the progress', async () => {
    await t12('T12 traitless', [], CELL_STAGE.protocell)
      .expect('nothing kept after the respawn', progressTowardNextLevel)
      .atTick(T12_READ_TICK)
      .toBe(0)
      .runDeterministic();
  });
});
