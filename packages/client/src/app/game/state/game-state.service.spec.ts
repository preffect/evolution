import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ROUND_PHASE,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  playerId,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { GameStateService } from './game-state.service';

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
