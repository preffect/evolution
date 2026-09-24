// Ticket #181: the in-process bots read the live world, and decide exactly as they would on a full snapshot of it
// at exact precision (the wire's quantisation is the one difference the world view drops).
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type GameInput } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { EXACT_SNAPSHOT_VALUES } from '../serialize/quantize.js';
import { runStep } from '../simulation/step.js';
import { createInputRejectionCounters } from '../world/world-state.js';
import { serializeFullSnapshot } from '../serialize/serialize.js';
import { createNamedBotPilot } from './bot-pilot.js';
import {
  EVOLUTION_BINDING_NAME,
  createEvolutionBotBinding,
  createEvolutionWorldBotBinding,
  motesOfWorld,
  ownCellInWorld,
} from './evolution-binding.js';
import { BOT_STRATEGY_NAME } from './strategy-constants.js';

const BOT_SEED = 7;
const DECISION_TICKS = 40;

describe('evolution world bot binding', () => {
  it('finds a player’s own cell and no wild one, and grazes fragments first, then motes', () => {
    const world = createTestWorld({ isFilled: true, hasWildSeats: true });
    const own = world.cells.find((cell) => cell.playerId !== null)!;
    expect(ownCellInWorld(world, own.playerId!)).toBe(own);
    expect(motesOfWorld(world)).toBe(world.dnaFragments.length > 0 ? world.dnaFragments : world.food);
    world.dnaFragments = [];
    expect(motesOfWorld(world)).toBe(world.food);
    const binding = createEvolutionWorldBotBinding(() => DEFAULT_BALANCE);
    expect(binding.name).toBe(EVOLUTION_BINDING_NAME);
    expect(binding.locateCell(world, own.playerId!)).toEqual({ x: own.x, y: own.y, radius: own.radius });
  });

  it.each(Object.values(BOT_STRATEGY_NAME))(
    'a %s bot decides on the world exactly as on a full exact snapshot of it',
    (behavior) => {
      const world = createTestWorld({ isFilled: true, hasWildSeats: true });
      const playerId = world.players[0]!.playerId;
      const pilotOver = <Snapshot>(
        binding: Parameters<typeof createNamedBotPilot<GameInput, Snapshot>>[0]['binding'],
      ) => createNamedBotPilot({ behavior, seed: BOT_SEED, playerIndex: 0, playerId, binding });
      const onWorld = pilotOver(createEvolutionWorldBotBinding(() => DEFAULT_BALANCE));
      const onSnapshot = pilotOver(createEvolutionBotBinding(() => DEFAULT_BALANCE));
      const rejections = createInputRejectionCounters();
      for (let tick = 1; tick <= DECISION_TICKS; tick += 1) {
        const snapshot = serializeFullSnapshot(world, EXACT_SNAPSHOT_VALUES);
        expect(onWorld.decide(world, tick), `tick ${tick}`).toEqual(onSnapshot.decide(snapshot, tick));
        runStep(world, world.balance, rejections);
      }
    },
  );
});
