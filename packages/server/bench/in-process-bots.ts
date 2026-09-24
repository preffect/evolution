// The in-process bot bench (ticket #181, docs/PERFORMANCE.md): in process, no socket and no browser, the Evolution
// module's 60 Hz step (`reduceGameState`: the bots decide, then the recorded step runs) timed in a room of eight
// `debug_spawn_bot` bots, against the floor: the same room with eight silent human seats in their place (the same food
// cap, nobody deciding).
//
//   pnpm --filter @evolution/server bench:bots
//
// The room: the module as the lobby builds it, one human seat that sends nothing, and eight bots cycling through the
// deciding strategies. The room plays `BENCH_MINUTES` minutes of ticks; the first minute after `BENCH_WARMUP_TICKS`
// (the dish filling) and the last minute are timed, because a cost that grows with the room's age shows only in the
// second. Figures are the
// process's CPU time (user + system) per tick, not wall time: other agents' runs on the shared box stretch the wall
// clock. The mean is reported beside the median and p95 because garbage collection lands in few ticks.

import { P95_QUANTILE, createTestSessionConfig, gameId, playerId } from '@evolution/shared';
import { createEvolutionModule } from '../src/game/evolution-module.js';
import { BOT_STRATEGY_NAME, type BotStrategyName } from '../src/game/bots/strategy-constants.js';

const BOTS = 8;
const BENCH_WARMUP_TICKS = 600;
const TICKS_PER_MINUTE = 3600;
const BENCH_MINUTES = 10;
const BENCH_TOTAL_TICKS = BENCH_MINUTES * TICKS_PER_MINUTE;
const BENCH_SEED = 181;
const HALF = 0.5;
const MICROSECONDS_PER_MILLISECOND = 1000;
const BOT_BEHAVIORS: readonly BotStrategyName[] = [
  BOT_STRATEGY_NAME.grazer,
  BOT_STRATEGY_NAME.hunter,
  BOT_STRATEGY_NAME.flee,
  BOT_STRATEGY_NAME.wander,
];
const HOST = playerId('bench-host');

function quantile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
}

function run(botCount: number): void {
  const silentSeats = Array.from({ length: BOTS - botCount }, (_unused, index) => playerId(`bench-seat-${index}`));
  const module = createEvolutionModule({
    gameId: gameId('bench'),
    creatorId: HOST,
    playerIds: [HOST, ...silentSeats],
    gameName: 'bench',
    config: createTestSessionConfig({ seed: BENCH_SEED }),
    avatarAssignments: { [HOST]: 0 },
    playerNames: { [HOST]: 'Host' },
  });
  for (let index = 0; index < botCount; index += 1) {
    const behavior = BOT_BEHAVIORS[index % BOT_BEHAVIORS.length]!;
    module.getDebugHandle().spawnBot?.({ behavior, seed: BENCH_SEED + index }, () => {});
  }
  const firstMinuteMs: number[] = [];
  const lastMinuteMs: number[] = [];
  for (let tick = 0; tick < BENCH_TOTAL_TICKS; tick += 1) {
    const started = process.cpuUsage();
    module.reduceGameState();
    const spent = process.cpuUsage(started);
    const spentMs = (spent.user + spent.system) / MICROSECONDS_PER_MILLISECOND;
    if (tick >= BENCH_WARMUP_TICKS && tick < BENCH_WARMUP_TICKS + TICKS_PER_MINUTE) firstMinuteMs.push(spentMs);
    if (tick >= BENCH_TOTAL_TICKS - TICKS_PER_MINUTE) lastMinuteMs.push(spentMs);
  }
  const { world } = module;
  const label = `${botCount} bots, ${silentSeats.length} silent seats`;
  console.log(`${label}, first minute: ${summary(firstMinuteMs)}`);
  console.log(
    `${label}, minute ${BENCH_MINUTES}: ${summary(lastMinuteMs)}` +
      ` (${world.cells.length} cells, ${world.food.length} motes, ${world.dnaFragments.length} fragments at the end)`,
  );
}

function summary(samplesMs: readonly number[]): string {
  const mean = samplesMs.reduce((sum, sample) => sum + sample, 0) / samplesMs.length;
  return (
    `mean ${mean.toFixed(3)} ms, median ${quantile(samplesMs, HALF).toFixed(3)} ms,` +
    ` p95 ${quantile(samplesMs, P95_QUANTILE).toFixed(3)} ms CPU per step`
  );
}

run(BOTS);
run(0);
