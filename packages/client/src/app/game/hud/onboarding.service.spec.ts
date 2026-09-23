import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  ROUND_PHASE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestSnapshot,
  createTestTraitOfferView,
  entityId,
  playerId,
  type CellView,
  type GameSnapshot,
} from '@evolution/shared';
import { createTestCellView, createTestEatEffect } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { ONBOARDING_BEAT } from './format/onboarding-beats';
import { STEER_HINT_DISTANCE_WU } from './hud-constants';
import { OnboardingService, onboardingSampleFor } from './onboarding.service';

const OWN_PLAYER_ID = playerId('player-me');
const OWN_CELL_ID = entityId('cell-me');
const OTHER_CELL_ID = entityId('cell-other');
const ROUND_START_TICK = 600;

function ownCell(overrides: Partial<CellView> = {}): CellView {
  return createTestCellView({ id: OWN_CELL_ID, playerId: OWN_PLAYER_ID, ...overrides });
}

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return createTestSnapshot({
    tick: ROUND_START_TICK,
    roundStartTick: ROUND_START_TICK,
    cells: [ownCell()],
    ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID }),
    ...overrides,
  });
}

describe('onboardingSampleFor', () => {
  const source = (overrides: Partial<GameSnapshot> = {}, cell: CellView | null = ownCell()) => {
    const shown = snapshot(overrides);
    return { snapshot: shown, ownCell: cell, ownProgress: shown.ownProgress, indicators: null };
  };

  it('observes an alive own cell in play: round time, DNA, the offer and the stage', () => {
    const sample = onboardingSampleFor(
      source({
        tick: ROUND_START_TICK + 2 * TICK_HZ,
        ownProgress: createTestPlayerProgressView({
          dnaCumulative: 4,
          stage: CELL_STAGE.prokaryote,
          offer: createTestTraitOfferView(),
        }),
      }),
    );
    expect(sample.observation).toEqual({
      tick: ROUND_START_TICK + 2 * TICK_HZ,
      roundElapsedSeconds: 2,
      dnaCumulative: 4,
      hasOffer: true,
      isProkaryote: true,
      hasThreat: false,
    });
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

describe('OnboardingService', () => {
  let multiplayer: MultiplayerService;
  let onboarding: OnboardingService;

  /** A snapshot arrives and change detection runs, with nothing reading the service in between. */
  function receive(overrides: Partial<GameSnapshot> = {}): void {
    multiplayer.snapshot.set(snapshot(overrides));
    TestBed.tick();
  }

  beforeEach(() => {
    multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    onboarding = TestBed.inject(OnboardingService);
  });

  it('has no beat and no reticle before the first snapshot', () => {
    expect(onboarding.current()).toBeNull();
    expect(onboarding.reticleVisible()).toBe(false);
  });

  it('steps on every snapshot: steer with its reticle, then eat once the cell has moved', () => {
    receive();
    expect(onboarding.current()).toBe(ONBOARDING_BEAT.steer);
    expect(onboarding.reticleVisible()).toBe(true);
    receive({ tick: ROUND_START_TICK + 1, cells: [ownCell({ x: STEER_HINT_DISTANCE_WU })] });
    expect(onboarding.current()).toBe(ONBOARDING_BEAT.eat);
    expect(onboarding.reticleVisible()).toBe(false);
  });

  it('keeps the seen beats through a rematch: a new round does not replay steer', () => {
    receive();
    receive({ tick: ROUND_START_TICK + 1, cells: [ownCell({ x: STEER_HINT_DISTANCE_WU })] });
    const rematchTick = ROUND_START_TICK + 100;
    receive({ tick: rematchTick, roundStartTick: rematchTick });
    expect(onboarding.current()).not.toBe(ONBOARDING_BEAT.steer);
  });
});
