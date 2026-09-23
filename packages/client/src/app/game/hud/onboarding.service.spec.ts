import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  createTestPlayerProgressView,
  createTestSnapshot,
  entityId,
  playerId,
  type CellView,
  type GameSnapshot,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { ONBOARDING_BEAT } from './format/onboarding-beats';
import { STEER_HINT_DISTANCE_WU } from './hud-constants';
import { OnboardingService } from './onboarding.service';

const OWN_PLAYER_ID = playerId('player-me');
const OWN_CELL_ID = entityId('cell-me');
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
