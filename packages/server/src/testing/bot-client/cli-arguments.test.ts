import { describe, expect, it } from 'vitest';
import { DEFAULT_BOT_SEED } from '@evolution/shared';
import {
  BOT_CLI_USAGE,
  DEFAULT_BOT_CLIENT_URL,
  DEFAULT_BOT_COUNT,
  DEFAULT_BOT_STRATEGY,
  parseBotCliArguments,
} from './cli-arguments.js';
import { BotClientError } from './errors.js';

describe('bot client arguments', () => {
  it('needs only the game and fills every other option with its default', () => {
    expect(parseBotCliArguments(['--game', 'g1'])).toEqual({
      gameId: 'g1',
      botCount: DEFAULT_BOT_COUNT,
      strategy: DEFAULT_BOT_STRATEGY,
      seed: DEFAULT_BOT_SEED,
      url: DEFAULT_BOT_CLIENT_URL,
    });
  });

  it('reads every flag, in any order, keeping the last value of a repeated one', () => {
    const parsed = parseBotCliArguments(
      '--bots 4 --strategy hunter --game g1 --seed 42 --prey alice --url ws://h:1/ws --ticks 600 --bots 3'.split(' '),
    );
    expect(parsed).toEqual({
      gameId: 'g1',
      botCount: 3,
      strategy: 'hunter',
      seed: 42,
      preyPlayerId: 'alice',
      url: 'ws://h:1/ws',
      tickLimit: 600,
    });
  });

  it.each([
    [[], /--game is required/],
    [['--game'], /--game needs a value/],
    [['--game', 'g1', '--bogus', '1'], /unknown argument "--bogus"/],
    [['--game', 'g1', '--bots', '0'], /--bots needs a whole number of at least 1, not "0"/],
    [['--game', 'g1', '--bots', 'two'], /--bots needs a whole number/],
    [['--game', 'g1', '--seed', '-1'], /--seed needs a whole number of at least 0/],
    [['--game', 'g1', '--seed', '1.5'], /--seed needs a whole number/],
    [['--game', 'g1', '--ticks', '0'], /--ticks needs a whole number of at least 1/],
    [['--game', 'g1', '--strategy', 'flee'], /--strategy must be one of idle, wander, grazer, hunter, not "flee"/],
    [['--game', 'g1', '--url', 'notaurl'], /--url needs a URL such as ws:\/\/localhost:\d+\/ws, not "notaurl"/],
  ])('refuses %j with the usage text', (commandLineArguments, problem) => {
    expect(() => parseBotCliArguments(commandLineArguments)).toThrow(BotClientError);
    expect(() => parseBotCliArguments(commandLineArguments)).toThrow(problem);
    expect(() => parseBotCliArguments(commandLineArguments)).toThrow(BOT_CLI_USAGE);
  });

  it('names every strategy and every default in the usage text', () => {
    expect(BOT_CLI_USAGE).toContain('idle | wander | grazer | hunter');
    expect(BOT_CLI_USAGE).toContain(DEFAULT_BOT_CLIENT_URL);
    expect(BOT_CLI_USAGE).toContain(`default ${DEFAULT_BOT_SEED}`);
  });
});
