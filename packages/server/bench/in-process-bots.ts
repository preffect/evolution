// The in-process bot bench (ticket #181, docs/testing/bots-and-design-tables.md §8.3): how much CPU the bots a module
// drives itself (`debug_spawn_bot`) cost a tick at 60 Hz, next to the step itself. In process, no socket.
//
//   pnpm --filter @evolution/server bench:bots
//
// A filled dish with its wild seats and `BENCH_BOTS` grazers, each given one of the seeded player cells. The world
// steps every tick; the bots decide every tick. Medians and p95 of **CPU time** (`process.cpuUsage`) over
// `BENCH_TICKS` ticks after `BENCH_WARMUP_TICKS`: on a shared box other agents stretch the wall clock, not this.

import { P95_QUANTILE, playerId } from '@evolution/shared';
import { BOT_STRATEGY_NAME } from '../src/game/bots/strategy-constants.js';
import { createEvolutionBotRoster, driveBots } from '../src/game/bots/evolution-bots.js';
import { createInputRejectionCounters } from '../src/game/world/world-state.js';
import { runStep } from '../src/game/simulation/step.js';
import { serializeFullSnapshot } from '../src/game/serialize/serialize.js';
import { createTestWorld } from '../src/testing/world-builders.js';

const BENCH_BOTS = 8;
const BENCH_WARMUP_TICKS = 120;
const BENCH_TICKS = 1200;
const BENCH_SEED = 181;
const HALF = 0.5;
const MICROSECONDS_PER_MILLISECOND = 1000;

function quantile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
}

function cpuMillisecondsOf(work: () => void): number {
  const started = process.cpuUsage();
  work();
  const spent = process.cpuUsage(started);
  return (spent.user + spent.system) / MICROSECONDS_PER_MILLISECOND;
}

const players = Array.from({ length: BENCH_BOTS }, (_unused, index) => ({
  playerId: playerId(`bench-${index}`),
  playerName: `Bench ${index}`,
  avatarIndex: index,
}));
const world = createTestWorld({ players, isFilled: true, hasWildSeats: true, seed: BENCH_SEED });
const roster = createEvolutionBotRoster(world);
for (let index = 0; index < BENCH_BOTS; index += 1) {
  const bot = roster.spawn({ behavior: BOT_STRATEGY_NAME.grazer, seed: BENCH_SEED + index });
  const player = world.players[index]!;
  const cell = world.cells.find((candidate) => candidate.playerId === player.playerId)!;
  player.playerId = bot.playerId;
  cell.playerId = bot.playerId;
}
const rejections = createInputRejectionCounters();
let submitted = 0;
const submit = (): void => {
  submitted += 1;
};
const botSamples: number[] = [];
const stepSamples: number[] = [];
/** What the bots paid before #181 whatever they decided: a full snapshot, for scale. */
const fullSnapshotSamples: number[] = [];
for (let tick = 0; tick < BENCH_WARMUP_TICKS + BENCH_TICKS; tick += 1) {
  const botMs = cpuMillisecondsOf(() => driveBots(roster, world, submit));
  const fullSnapshotMs = cpuMillisecondsOf(() => serializeFullSnapshot(world));
  const stepMs = cpuMillisecondsOf(() => runStep(world, world.balance, rejections));
  if (tick >= BENCH_WARMUP_TICKS) {
    botSamples.push(botMs);
    stepSamples.push(stepMs);
    fullSnapshotSamples.push(fullSnapshotMs);
  }
}
const row = (label: string, samples: readonly number[]): string =>
  `${label}: median ${quantile(samples, HALF).toFixed(3)} ms CPU, p95 ${quantile(samples, P95_QUANTILE).toFixed(3)} ms`;
console.log(`${BENCH_BOTS} bots, ${world.food.length} motes, ${world.cells.length} cells, ${submitted} inputs`);
console.log(row('bots per tick', botSamples));
console.log(row('step per tick', stepSamples));
console.log(row('a full snapshot, for scale', fullSnapshotSamples));
