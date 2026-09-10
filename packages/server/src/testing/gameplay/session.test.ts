import { describe, expect, it } from 'vitest';
import { createTestSessionConfig } from '@evolution/shared';
import type { ScenarioAdapter } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import { scenarioPlayerId } from './players.js';
import { isPlayerPresentAt, ScenarioSession, type ScenarioPlayer } from './session.js';
import { toyAdapter, type ToyFixture, type ToyInput, type ToySnapshot } from './toy-adapter.js';

const SEED = 42;
const PLACED = { x: 7, y: 7 };

function scenarioPlayer(playerIndex: number, joinTick = 0, leaveTick: number | null = null): ScenarioPlayer {
  return {
    playerIndex,
    playerId: scenarioPlayerId(playerIndex),
    playerName: `Player ${playerIndex}`,
    avatarIndex: playerIndex,
    joinTick,
    leaveTick,
  };
}

function createSession(
  players: ScenarioPlayer[],
  fixtures: ToyFixture[] = [],
  adapter: ScenarioAdapter<ToyInput, ToySnapshot, ToyFixture> = toyAdapter,
) {
  return new ScenarioSession(adapter, {
    scenarioName: 'session',
    seed: SEED,
    config: createTestSessionConfig({ maxPlayers: 8 }),
    players,
    fixtures,
  });
}

describe('isPlayerPresentAt', () => {
  it('is present from the join step until the step before the leave', () => {
    const player = scenarioPlayer(0, 3, 6);
    expect([2, 3, 5, 6, 7].map((tick) => isPlayerPresentAt(player, tick))).toEqual([false, true, true, false, false]);
    expect(isPlayerPresentAt(scenarioPlayer(0), 1_000_000)).toBe(true);
  });
});

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
    expect(session.isPresentAt(1, 4)).toBe(false);
    expect(session.isPresentAt(1, 5)).toBe(true);
  });

  it('rejects an unknown player index', () => {
    expect(() => createSession([scenarioPlayer(0)]).playerId(2)).toThrow(/player 2 is not in scenario "session"/);
  });

  it('applies setup fixtures through a context that resolves player ids, stamped tick 0', () => {
    const seen: number[] = [];
    const spying: ScenarioAdapter<ToyInput, ToySnapshot, ToyFixture> = {
      ...toyAdapter,
      applyFixture: (module, fixture, context) => {
        seen.push(context.tick);
        toyAdapter.applyFixture(module, fixture, context);
      },
    };
    const session = createSession([scenarioPlayer(0)], [{ playerIndex: 0, at: PLACED }], spying);
    expect(seen).toEqual([0]);
    expect(session.view().cell(0)).toMatchObject(PLACED);
  });

  it('applies a patch before the next step and logs it at that step tick', () => {
    const session = createSession([scenarioPlayer(0)]);
    session.step();
    session.patch({ playerIndex: 0, at: PLACED });
    expect(session.currentSnapshot().cells[scenarioPlayerId(0)]).toMatchObject({ x: SEED });
    session.step();
    expect(session.currentSnapshot().cells[scenarioPlayerId(0)]).toMatchObject(PLACED);
    expect(session.toReplay().patches).toEqual([{ tick: 2, fixture: { playerIndex: 0, at: PLACED } }]);
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

  it('gives a script the current tick, the step tick, the seed and the player cell', () => {
    const session = createSession([scenarioPlayer(0)]);
    session.step();
    const context = session.scriptContext(0);
    expect(context).toMatchObject({ tick: 1, stepTick: 2, playerIndex: 0, playerId: scenarioPlayerId(0), seed: SEED });
    expect(context.cell).toEqual({ x: SEED, y: 0, radiusWu: 10 });
  });

  it('looks the cell up only when a script reads it', () => {
    let lookups = 0;
    const counting: ScenarioAdapter<ToyInput, ToySnapshot, ToyFixture> = {
      ...toyAdapter,
      locateCell: (snapshot, playerId) => {
        lookups += 1;
        return toyAdapter.locateCell(snapshot, playerId);
      },
    };
    const context = createSession([scenarioPlayer(0)], [], counting).scriptContext(0);
    expect(lookups).toBe(0);
    expect(context.cell).toBeDefined();
    expect(lookups).toBe(1);
  });

  it('forks one stream per player from the seed, the same in every session of that seed', () => {
    const first = createSession([scenarioPlayer(0), scenarioPlayer(1)]);
    const second = createSession([scenarioPlayer(0), scenarioPlayer(1)]);
    const draw = (session: typeof first, playerIndex: number) => session.scriptContext(playerIndex).random.nextFloat();
    expect(draw(first, 0)).toBe(draw(second, 0));
    expect(draw(first, 1)).toBe(draw(second, 1));
    expect(draw(first, 0)).not.toBe(draw(first, 1));
    expect(first.scriptContext(0).random).toBe(first.scriptContext(0).random);
  });

  it('stores captures for the view', () => {
    const session = createSession([scenarioPlayer(0)]);
    expect(session.view().captured('mass')).toBeUndefined();
    session.capture('mass', 99);
    expect(session.view().captured('mass')).toBe(99);
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
