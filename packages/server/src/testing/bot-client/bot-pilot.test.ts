import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@evolution/shared';
import { TEST_PLAYER_ID, TEST_SEED, createTestBotIdentity, createTestPerception } from '../bot-builders.js';
import { createScriptedStrategy } from '../gameplay/bots.js';
import { idle, targetPoint } from '../gameplay/scripts.js';
import { UnknownBotStrategyError } from '../gameplay/strategies/strategy-catalog.js';
import { echoBotBinding } from './bot-binding.js';
import { createBotPilot, createNamedBotPilot } from './bot-pilot.js';

const SNAPSHOT = { players: {} };

function pilotRunning(script: typeof idle) {
  return createBotPilot({
    playerIndex: 0,
    playerId: TEST_PLAYER_ID,
    seed: TEST_SEED,
    random: createSeededRandom(TEST_SEED),
    binding: echoBotBinding,
    createStrategy: createScriptedStrategy('scripted', script),
  });
}

describe('bot pilot', () => {
  it('stamps the client tick as the sequence of every input it produces', () => {
    const pilot = pilotRunning(targetPoint(5, 6));
    expect(pilot.decide(SNAPSHOT, 3)).toMatchObject({ sequence: 3, targetX: 5, targetY: 6 });
    expect(pilot.decide(SNAPSHOT, 4)).toMatchObject({ sequence: 4 });
    expect(pilot.stats()).toEqual({ decisions: 2, inputsProduced: 2, lastSequence: 4 });
  });

  it('answers null and keeps the last sequence when the strategy holds', () => {
    const pilot = pilotRunning(idle);
    expect(pilot.decide(SNAPSHOT, 1)).toBeNull();
    expect(pilot.stats()).toEqual({ decisions: 1, inputsProduced: 0, lastSequence: 0 });
    expect(pilot.strategyName).toBe('scripted');
  });

  it('hands the strategy the binding-located cell and its own stream', () => {
    const seen: { cell: unknown; random: unknown }[] = [];
    const random = createSeededRandom(TEST_SEED);
    const pilot = createBotPilot({
      playerIndex: 2,
      playerId: TEST_PLAYER_ID,
      seed: TEST_SEED,
      random,
      binding: { ...echoBotBinding, locateCell: () => ({ x: 1, y: 2, radiusWu: 3 }) },
      createStrategy: () => ({
        name: 'probe',
        decide: (context) => {
          seen.push({ cell: context.cell, random: context.random });
          return null;
        },
      }),
    });
    pilot.decide(SNAPSHOT, 1);
    expect(seen).toEqual([{ cell: { x: 1, y: 2, radiusWu: 3 }, random }]);
  });
});

describe('named bot pilot', () => {
  it('builds the same decisions in-process and over the wire from one seed and index', () => {
    const build = () =>
      createNamedBotPilot({
        behavior: 'wander',
        seed: 7,
        playerIndex: 1,
        playerId: TEST_PLAYER_ID,
        binding: echoBotBinding,
      });
    const first = build();
    const second = build();
    const inputs = (pilot: ReturnType<typeof build>) => [1, 2, 3].map((tick) => pilot.decide(SNAPSHOT, tick));
    expect(inputs(first)).toEqual(inputs(second));
  });

  it('gives two bots of one swarm different streams', () => {
    const pilotAt = (playerIndex: number) =>
      createNamedBotPilot({
        behavior: 'wander',
        seed: 7,
        playerIndex,
        playerId: TEST_PLAYER_ID,
        binding: echoBotBinding,
      });
    expect(pilotAt(0).decide(SNAPSHOT, 1)).not.toEqual(pilotAt(1).decide(SNAPSHOT, 1));
  });

  it('threads the prey option into the hunter', () => {
    const identity = createTestBotIdentity();
    const pilot = createNamedBotPilot({
      behavior: 'hunter',
      seed: 1,
      playerIndex: 0,
      playerId: identity.playerId,
      binding: {
        name: 'test',
        locateCell: () => undefined,
        toInput: echoBotBinding.toInput,
        perception: createTestPerception(),
      },
      preyPlayerId: TEST_PLAYER_ID,
    });
    expect(pilot.strategyName).toBe('hunter');
  });

  it('rejects a name outside the catalogue before building anything', () => {
    expect(() =>
      createNamedBotPilot({
        behavior: 'flee',
        seed: 1,
        playerIndex: 0,
        playerId: TEST_PLAYER_ID,
        binding: echoBotBinding,
      }),
    ).toThrow(UnknownBotStrategyError);
  });
});
