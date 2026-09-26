// The predation measurement of ticket #376 (#119 item 3): in process, faster than real time, the Evolution module's
// step with 4 `hunter` and 4 `forager` bots spawned through `debug_spawn_bot`'s handle, one full default round per
// seed. The lobby's host seat is removed once the bots are in, so every player cell is a bot's. It prints the
// absorptions of a player's cell per minute by round phase (docs/game-design/session.md §5.1), the share of started
// engulfs of a player's cell that ended `escaped`, and who ate whom (`src/testing/predation-tally.ts`).
//
//   pnpm --filter @evolution/server bench:predation [seed ...]      (default seeds 1 2 3, run one after another)

import { createTestSessionConfig, gameId, playerId, secondsToTicks, ticksToSeconds } from '@evolution/shared';
import { createEvolutionModule, type EvolutionModule } from '../src/game/evolution-module.js';
import { BOT_STRATEGY_NAME, type BotStrategyName } from '../src/game/bots/strategy-constants.js';
import {
  ROUND_PHASES,
  ROUND_PHASE_ENDS_SECONDS,
  UNSEATED_ROLE,
  UNSEEN_ROLE,
  WILD_ROLE,
  createPredationTally,
  roundPhaseMinutes,
  tallyEffects,
  type PhaseCounts,
  type PredationTally,
  type RoundPhase,
} from '../src/testing/predation-tally.js';

const BOTS_PER_ROLE = 4;
const DEFAULT_SEEDS = [1, 2, 3];
const ROLES: readonly BotStrategyName[] = [BOT_STRATEGY_NAME.hunter, BOT_STRATEGY_NAME.forager];
const HOST = playerId('bench-host');
const PERCENT = 100;
const DECIMALS = 2;

function createRoom(seed: number): { module: EvolutionModule; roleOfPlayer: Map<string, string> } {
  const module = createEvolutionModule({
    gameId: gameId('predation'),
    creatorId: HOST,
    playerIds: [HOST],
    gameName: 'predation',
    config: createTestSessionConfig({ seed }),
    avatarAssignments: { [HOST]: 0 },
    playerNames: { [HOST]: 'Host' },
  });
  const roleOfPlayer = new Map<string, string>();
  ROLES.forEach((behavior, roleIndex) => {
    for (let index = 0; index < BOTS_PER_ROLE; index += 1) {
      const botSeed = seed * ROLES.length * BOTS_PER_ROLE + roleIndex * BOTS_PER_ROLE + index;
      const bot = module.getDebugHandle().spawnBot?.({ behavior, seed: botSeed }, () => {});
      if (bot !== undefined) roleOfPlayer.set(bot.playerId, behavior);
    }
  });
  module.removePlayer(HOST);
  return { module, roleOfPlayer };
}

function runRound(seed: number): PredationTally {
  const { module, roleOfPlayer } = createRoom(seed);
  const { world } = module;
  const roleOfCell = new Map<string, string>();
  const tally = createPredationTally();
  const roundTicks = secondsToTicks(ROUND_PHASE_ENDS_SECONDS.bloom);
  while (world.tick - world.roundStartTick < roundTicks) {
    for (const cell of world.cells) {
      roleOfCell.set(cell.id, cell.playerId === null ? WILD_ROLE : (roleOfPlayer.get(cell.playerId) ?? UNSEATED_ROLE));
    }
    module.reduceGameState();
    const roundSeconds = ticksToSeconds(world.tick - world.roundStartTick);
    tallyEffects(tally, world.effects.splice(0), roundSeconds, (cellId) => roleOfCell.get(cellId) ?? UNSEEN_ROLE);
  }
  return tally;
}

function phaseCells(byPhase: Record<RoundPhase, PhaseCounts>): string[] {
  return ROUND_PHASES.map((phase) => {
    const { absorbed, started, escaped } = byPhase[phase];
    const perMinute = (absorbed / roundPhaseMinutes(phase)).toFixed(DECIMALS);
    const escapedShare = started === 0 ? '-' : `${((escaped / started) * PERCENT).toFixed(0)}%`;
    return `${absorbed} (${perMinute}/min; esc ${escaped}/${started} ${escapedShare})`;
  });
}

/** One markdown row per predator>prey pair and one for every player prey, ready to paste on the ticket. */
function report(seed: number, tally: PredationTally): void {
  const rows = [
    ['all player prey', tally.byPhase] as const,
    ...[...tally.byRoles].sort(([left], [right]) => left.localeCompare(right)),
  ];
  for (const [roles, byPhase] of rows) {
    console.log(`| ${seed} | ${roles} | ${phaseCells(byPhase).join(' | ')} |`);
  }
}

const seeds = process.argv.slice(2).map(Number);
console.log(`| seed | predator>prey | ${ROUND_PHASES.join(' | ')} |`);
for (const seed of seeds.length > 0 ? seeds : DEFAULT_SEEDS) {
  report(seed, runRound(seed));
}
