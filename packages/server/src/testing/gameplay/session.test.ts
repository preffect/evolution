import { describe, expect, it } from 'vitest';
import { ScenarioSetupError } from './errors.js';
import { ScenarioSession, type ScenarioPlayer } from './session.js';
import { toyAdapter } from './toy-adapter.js';
import { scenarioPlayerId } from './scenario.js';

const SEED = 42;

function scenarioPlayer(playerIndex: number, joinTick = 0): ScenarioPlayer {
  return {
    playerIndex,
    playerId: scenarioPlayerId(playerIndex),
    playerName: `Player ${playerIndex}`,
    avatarIndex: playerIndex,
    joinTick,
    leaveTick: null,
  };
}

function createSession(players: ScenarioPlayer[]) {
  return new ScenarioSession(toyAdapter, {
    scenarioName: 'session',
    seed: SEED,
    config: { maxPlayers: 8 },
    players,
    fixtures: [],
  });
}

describe('ScenarioSession', () => {
  it('needs at least one player at tick 0', () => {
    expect(() => createSession([scenarioPlayer(0, 5)])).toThrow(ScenarioSetupError);
    expect(() => createSession([])).toThrow(/no player present at tick 0/);
  });

  it('starts at tick 0 with the roster present and the seed exposed', () => {
    const session = createSession([scenarioPlayer(0), scenarioPlayer(1, 5)]);
    expect(session.tick).toBe(0);
    expect(session.seed).toBe(SEED);
    expect(Object.keys(session.currentSnapshot().cells)).toEqual([scenarioPlayerId(0)]);
    expect(session.view().cell(0)).toEqual({ x: SEED, y: 0, radiusWu: 10 });
    expect(session.view().cell(1)).toBeUndefined();
  });

  it('rejects an unknown player index', () => {
    expect(() => createSession([scenarioPlayer(0)]).playerId(2)).toThrow(/player 2 is not in scenario "session"/);
  });

  it('numbers sequences per player from 1 and stamps inputs with the next tick', () => {
    const session = createSession([scenarioPlayer(0), scenarioPlayer(1)]);
    expect(session.submitCommand(scenarioPlayerId(0), { targetX: 1 })).toEqual({ targetX: 1, sequence: 1 });
    expect(session.submitCommand(scenarioPlayerId(0), { targetX: 2 })).toEqual({ targetX: 2, sequence: 2 });
    expect(session.submitCommand(scenarioPlayerId(1), { targetX: 3 })).toEqual({ targetX: 3, sequence: 1 });
    session.step();
    session.submitCommand(scenarioPlayerId(1), { targetX: 4 });
    expect(session.toReplay().inputs.map((input) => [input.tick, input.playerId])).toEqual([
      [1, scenarioPlayerId(0)],
      [1, scenarioPlayerId(0)],
      [1, scenarioPlayerId(1)],
      [2, scenarioPlayerId(1)],
    ]);
  });

  it('gives a script the current tick, the step tick and the player cell', () => {
    const session = createSession([scenarioPlayer(0)]);
    session.step();
    const context = session.scriptContext(0);
    expect(context).toMatchObject({ tick: 1, stepTick: 2, playerIndex: 0, playerId: scenarioPlayerId(0) });
    expect(context.cell).toEqual({ x: SEED, y: 0, radiusWu: 10 });
  });

  it('logs joins and leaves at the next step tick and lists only tick-0 players in the roster', () => {
    const late = scenarioPlayer(1, 3);
    const session = createSession([scenarioPlayer(0), late]);
    session.step();
    session.step();
    session.join(late);
    session.leave(scenarioPlayer(0));
    const replay = session.toReplay();
    expect(replay.membership).toEqual([
      { tick: 3, kind: 'join', playerId: scenarioPlayerId(1), playerName: 'Player 1', avatarIndex: 1 },
      { tick: 3, kind: 'leave', playerId: scenarioPlayerId(0), playerName: 'Player 0', avatarIndex: 0 },
    ]);
    expect(replay.roster.map((member) => member.playerId)).toEqual([scenarioPlayerId(0)]);
    expect(Object.keys(session.currentSnapshot().cells)).toEqual([scenarioPlayerId(0)]);
    session.step();
    expect(Object.keys(session.currentSnapshot().cells)).toEqual([scenarioPlayerId(1)]);
  });

  it('records checkpoints with the current tick and hash', () => {
    const session = createSession([scenarioPlayer(0)]);
    const first = session.recordCheckpoint();
    session.step();
    const second = session.recordCheckpoint();
    expect(first.tick).toBe(0);
    expect(second.tick).toBe(1);
    expect(second.hash).toBe(session.hash());
    expect(session.toReplay().checkpoints).toEqual([first, second]);
  });
});
