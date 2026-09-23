import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  PLAYER_LIFE_STATE,
  ROUND_PHASE,
  TICK_HZ,
  ZONE_ID,
  createTestPlayerProgressView,
  createTestSnapshot,
  createTestTraitOfferView,
  entityId,
  playerId,
  type CellView,
  type GameSnapshot,
  type MassFlowView,
} from '@evolution/shared';
import { createTestCellView, createTestEatEffect } from '../../../../testing/builders';
import { MASS_TREND } from '../../state/mass-trend';
import { COACH_PREY_REACH_RADII } from '../hud-constants';
import { hasPreyInReach, isShrinkingFromDecay, isToxinReaching, onboardingSampleFor } from './onboarding-sample';
import { RELATION_RING, type RelationCandidate } from './relations-for';

const OWN_PLAYER_ID = playerId('player-me');
const OWN_CELL_ID = entityId('cell-me');
const OTHER_CELL_ID = entityId('cell-other');
const PREY_CELL_ID = entityId('cell-prey');
const ROUND_START_TICK = 600;
const ROUND_SECONDS = 100;
const TOXIN_I = [{ traitId: 'toxin_vacuole', tier: 1 }] as CellView['traits'];

function ownCell(overrides: Partial<CellView> = {}): CellView {
  return createTestCellView({ id: OWN_CELL_ID, playerId: OWN_PLAYER_ID, ...overrides });
}

function flow(ratesPerSecond: MassFlowView['ratesPerSecond']): MassFlowView {
  return { ratesPerSecond, zone: ZONE_ID.openBroth };
}

function source(overrides: Partial<GameSnapshot> = {}, cell: CellView | null = ownCell()) {
  const snapshot = createTestSnapshot({
    tick: ROUND_START_TICK,
    roundStartTick: ROUND_START_TICK,
    cells: cell === null ? [] : [cell],
    ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID }),
    ...overrides,
  });
  return {
    snapshot,
    ownCell: cell,
    ownProgress: snapshot.ownProgress,
    indicators: null,
    relations: [],
    balance: DEFAULT_BALANCE,
    roundDurationSeconds: ROUND_SECONDS,
  };
}

describe('onboardingSampleFor', () => {
  it('observes an alive own cell in play: round time, DNA, the offer, the stage and the zone', () => {
    const sample = onboardingSampleFor(
      source({
        tick: ROUND_START_TICK + 2 * TICK_HZ,
        ownProgress: createTestPlayerProgressView({
          dnaCumulative: 4,
          stage: CELL_STAGE.prokaryote,
          offer: createTestTraitOfferView(),
          massFlow: { ratesPerSecond: {}, zone: ZONE_ID.warmVent },
        }),
      }),
    );
    expect(sample.observation).toMatchObject({
      tick: ROUND_START_TICK + 2 * TICK_HZ,
      roundElapsedSeconds: 2,
      dnaCumulative: 4,
      hasOffer: true,
      isProkaryote: true,
      hasThreat: false,
      zone: ZONE_ID.warmVent,
      isBloom: false,
    });
  });

  it('reads the bloom off the round clock', () => {
    const bloomAt = Math.round(ROUND_SECONDS * (1 - DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION));
    const sample = onboardingSampleFor(source({ roundTimeLeftMs: bloomAt * MILLISECONDS_PER_SECOND }));
    expect(sample.observation?.isBloom).toBe(true);
    const before = onboardingSampleFor(source({ roundTimeLeftMs: (bloomAt + 1) * MILLISECONDS_PER_SECOND }));
    expect(before.observation?.isBloom).toBe(false);
  });

  it('observes nothing while spectating, with no own cell, or outside the playing phase', () => {
    const spectating = createTestPlayerProgressView({ lifeState: PLAYER_LIFE_STATE.spectating });
    expect(onboardingSampleFor(source({ ownProgress: spectating })).observation).toBeNull();
    expect(onboardingSampleFor(source({}, null)).observation).toBeNull();
    expect(onboardingSampleFor(source({ roundPhase: ROUND_PHASE.results })).observation).toBeNull();
  });

  it('counts only the own cell’s eats, and a sprint while one is running', () => {
    const others = source({ effects: [createTestEatEffect({ cellId: OTHER_CELL_ID })] });
    expect(onboardingSampleFor(others).hasOwnEat).toBe(false);
    const own = source(
      { effects: [createTestEatEffect({ cellId: OWN_CELL_ID })] },
      ownCell({ sprintRemainingTicks: 3 }),
    );
    expect(onboardingSampleFor(own).hasOwnEat).toBe(true);
    expect(onboardingSampleFor(own).isSprinting).toBe(true);
  });
});

describe('isShrinkingFromDecay', () => {
  it('holds for a falling trend with decay and the vent the only losses', () => {
    expect(isShrinkingFromDecay(MASS_TREND.down, flow({ decay: -0.5, vent: -0.25 }))).toBe(true);
    expect(isShrinkingFromDecay(MASS_TREND.down, flow({ decay: -0.5, light: 0.3 }))).toBe(true);
  });

  it('does not hold with a toxin or swallowed rate present, without a decay loss, or on a steady trend', () => {
    expect(isShrinkingFromDecay(MASS_TREND.down, flow({ decay: -0.5, toxin: -9 }))).toBe(false);
    expect(isShrinkingFromDecay(MASS_TREND.down, flow({ decay: -0.5, swallowed: -23 }))).toBe(false);
    expect(isShrinkingFromDecay(MASS_TREND.down, flow({}))).toBe(false);
    expect(isShrinkingFromDecay(MASS_TREND.steady, flow({ decay: -0.5 }))).toBe(false);
    expect(isShrinkingFromDecay(null, flow({ decay: -0.5 }))).toBe(false);
  });
});

describe('isToxinReaching', () => {
  const touching = flow({ toxin: -3 });
  const prey = createTestCellView({ id: PREY_CELL_ID, playerId: null, traits: TOXIN_I, x: 5 });
  const engulfing = ownCell({ engulfingCellId: PREY_CELL_ID });

  it('holds for any toxin rate while the own cell engulfs nothing: contact or an aura alike', () => {
    expect(isToxinReaching(ownCell(), touching, [], DEFAULT_BALANCE)).toBe(true);
    expect(isToxinReaching(ownCell(), flow({ decay: -1 }), [], DEFAULT_BALANCE)).toBe(false);
  });

  it('does not hold while the own engulf’s prey is the only toxic cell reaching the own cell', () => {
    expect(isToxinReaching(engulfing, touching, [engulfing, prey], DEFAULT_BALANCE)).toBe(false);
  });

  it('holds while engulfing when another toxic cell reaches the own cell too, and not for one out of reach', () => {
    const near = createTestCellView({ id: OTHER_CELL_ID, playerId: null, traits: TOXIN_I, x: -5 });
    expect(isToxinReaching(engulfing, touching, [engulfing, prey, near], DEFAULT_BALANCE)).toBe(true);
    const far = { ...near, x: -10_000 };
    expect(isToxinReaching(engulfing, touching, [engulfing, prey, far], DEFAULT_BALANCE)).toBe(false);
  });
});

describe('hasPreyInReach', () => {
  const own = ownCell({ radius: 20 });
  const preyRadius = 10;

  /** The ring `relationsFor` gives a prey at `gapWu` past the own rim. */
  function ringAt(gapWu: number, ring: RelationCandidate['ring'] = RELATION_RING.edible): RelationCandidate {
    const distance = own.radius + preyRadius + gapWu;
    return {
      cellId: PREY_CELL_ID,
      ring,
      isEdible: true,
      isToxic: ring === RELATION_RING.toxic,
      isSpiny: false,
      distanceSquared: distance * distance,
      x: own.x + distance,
      y: own.y,
      radius: preyRadius,
    };
  }

  it(`holds for a green-ringed cell within ${COACH_PREY_REACH_RADII} own radii, edge to edge, and not past it`, () => {
    expect(hasPreyInReach(own, [ringAt(own.radius * 3)])).toBe(true);
    expect(hasPreyInReach(own, [ringAt(own.radius * COACH_PREY_REACH_RADII)])).toBe(true);
    expect(hasPreyInReach(own, [ringAt(own.radius * COACH_PREY_REACH_RADII + 1)])).toBe(false);
  });

  it('does not hold for an edible cell whose ring is the toxic one, nor with no ring at all', () => {
    expect(hasPreyInReach(own, [ringAt(0, RELATION_RING.toxic)])).toBe(false);
    expect(hasPreyInReach(own, [])).toBe(false);
  });
});
