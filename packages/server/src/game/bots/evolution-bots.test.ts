// docs/ARCHITECTURE.md §8: the roster the Evolution module drives, fed the full snapshot of the
// tick before and stamping the coming tick as the sequence.
import { describe, expect, it, vi } from 'vitest';
import { BOT_STRATEGY_NAME } from './strategy-constants.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { createEvolutionBotRoster, driveBots } from './evolution-bots.js';

const BOT_SEED = 3;

describe('driveBots', () => {
  it('serialises nothing and submits nothing while the roster is empty', () => {
    const world = createTestWorld();
    const submit = vi.fn();
    driveBots(createEvolutionBotRoster(world), world, submit);
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits every deciding bot an input for the coming tick, from the world as it stands', () => {
    const world = createTestWorld({ isFilled: true });
    const roster = createEvolutionBotRoster(world);
    const bot = roster.spawn({ behavior: BOT_STRATEGY_NAME.grazer, seed: BOT_SEED });
    // The grazer needs a cell: the roster only builds the pilot, the module adds the player. Give it the seeded cell.
    world.players[0]!.playerId = bot.playerId;
    world.cells[0]!.playerId = bot.playerId;
    const submit = vi.fn();
    world.tick = 41;
    driveBots(roster, world, submit);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toBe(bot.playerId);
    expect(submit.mock.calls[0]?.[1]).toMatchObject({ sequence: 42 });
  });
});
