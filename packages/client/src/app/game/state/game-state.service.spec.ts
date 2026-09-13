import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  ROUND_PHASE,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  entityId,
  playerId,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { GameStateService } from './game-state.service';
import { LADDER_KIND } from './own-cell-indicators';

const OWN_PLAYER_ID = playerId('player-me');

describe('GameStateService', () => {
  let multiplayer: MultiplayerService;
  let gameState: GameStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    multiplayer = TestBed.inject(MultiplayerService);
    gameState = TestBed.inject(GameStateService);
  });

  it('answers safe emptiness before the first snapshot, so the chrome can mount on join', () => {
    expect(gameState.ownPlayerId()).toBeNull();
    expect(gameState.leaderboard()).toEqual([]);
    expect(gameState.players()).toEqual({});
    expect(gameState.roundTimeLeftMs()).toBeNull();
    expect(gameState.balance()).toBeNull();
    expect(gameState.roundPhase()).toBe(ROUND_PHASE.playing);
  });

  it('derives the round, the ranking and the roster from the newest snapshot', () => {
    const row = { rank: 1, playerId: OWN_PLAYER_ID, score: 40, mass: 30, level: 2, absorptions: 1 };
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.snapshot.set(
      createTestSnapshot({
        roundPhase: ROUND_PHASE.results,
        roundTimeLeftMs: 0,
        leaderboard: [row],
        players: { [OWN_PLAYER_ID]: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, playerName: 'Me' }) },
      }),
    );

    expect(gameState.ownPlayerId()).toBe(OWN_PLAYER_ID);
    expect(gameState.roundPhase()).toBe(ROUND_PHASE.results);
    expect(gameState.roundTimeLeftMs()).toBe(0);
    expect(gameState.leaderboard()).toEqual([row]);
    expect(gameState.players()[OWN_PLAYER_ID]?.playerName).toBe('Me');
  });

  it('finds the own cell and the own progress, and neither before the room names us', () => {
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [
          createTestCellView({ playerId: OWN_PLAYER_ID, mass: 64 }),
          createTestCellView({ id: entityId('other') }),
        ],
        players: { [OWN_PLAYER_ID]: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, level: 2 }) },
      }),
    );
    expect(gameState.ownCell()).toBeNull();
    expect(gameState.ownProgress()).toBeNull();

    multiplayer.playerId.set(OWN_PLAYER_ID);
    expect(gameState.ownCell()?.mass).toBe(64);
    expect(gameState.ownProgress()?.level).toBe(2);
  });

  it('builds the indicators once the cell, the progress and the balance are all in', () => {
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID, stage: CELL_STAGE.prokaryote })],
        players: { [OWN_PLAYER_ID]: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID }) },
      }),
    );
    // No balance yet: nothing to compute a DNA fraction or an engulf phase against.
    expect(gameState.ownCellIndicators()).toBeNull();

    multiplayer.balance.set(DEFAULT_BALANCE);
    expect(gameState.ownCellIndicators()?.ladder.kind).toBe(LADDER_KIND.counters);
  });

  it('has no indicators while spectating, which is what stands the mirror down', () => {
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID })],
        players: {
          [OWN_PLAYER_ID]: createTestPlayerProgressView({
            playerId: OWN_PLAYER_ID,
            lifeState: PLAYER_LIFE_STATE.spectating,
          }),
        },
      }),
    );
    expect(gameState.ownCellIndicators()).toBeNull();
  });

  it('answers no threats until the render loop has written a camera extent', () => {
    const predator = createTestCellView({
      id: entityId('predator'),
      playerId: playerId('rival'),
      mass: 400,
      radius: 20,
      x: 10,
    });
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID }), predator],
        players: { [OWN_PLAYER_ID]: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID }) },
      }),
    );
    expect(gameState.threats()).toEqual([]);

    gameState.setCameraExtent({ minX: -500, minY: -500, maxX: 500, maxY: 500 });
    expect(gameState.threats().map((threat) => threat.cellId)).toEqual([predator.id]);
    expect(gameState.ownCellIndicators()?.nearestThreat?.cellId).toBe(predator.id);
  });

  it('treats an identical camera rectangle as no change, so a still camera stops the cascade', () => {
    // The regression this pins (#282 review): `cameraExtent(...)` allocates a fresh object every
    // frame, so with the default `Object.is` a motionless camera re-ran `threatsFor`, rebuilt the
    // record and dirtied the HUD sixty times a second. Identity of the derived value is the proof
    // that nothing downstream recomputed.
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID })],
        players: { [OWN_PLAYER_ID]: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID }) },
      }),
    );
    gameState.setCameraExtent({ minX: -500, minY: -500, maxX: 500, maxY: 500 });
    const first = gameState.ownCellIndicators();

    gameState.setCameraExtent({ minX: -500, minY: -500, maxX: 500, maxY: 500 });
    expect(gameState.ownCellIndicators()).toBe(first);

    gameState.setCameraExtent({ minX: -499, minY: -500, maxX: 500, maxY: 500 });
    expect(gameState.ownCellIndicators()).not.toBe(first);
  });

  it('mirrors the room’s seats, config and live balance', () => {
    multiplayer.avatarAssignments.set({ [OWN_PLAYER_ID]: 3 });
    multiplayer.sessionConfig.set(createTestSessionConfig({ roundDurationSeconds: 300 }));
    multiplayer.balance.set(DEFAULT_BALANCE);

    expect(gameState.avatarAssignments()[OWN_PLAYER_ID]).toBe(3);
    expect(gameState.sessionConfig()?.roundDurationSeconds).toBe(300);
    expect(gameState.balance()?.session.ROUND_BLOOM_START_FRACTION).toBe(
      DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION,
    );
  });
});
