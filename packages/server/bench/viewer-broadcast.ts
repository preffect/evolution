// The per-viewer broadcast bench (ticket #406, docs/architecture/wire-contract.md §4.1): in process, no socket and no
// browser, the path `sendSnapshotToViewers` runs once per broadcast — the shared frame opened once, then every
// viewer's members serialised and the frame closed with them — timed over a filled dish at two camera zooms.
//
//   pnpm --filter @evolution/server bench:broadcast
//
// The dish: `FOOD_CAP_BASE + 8 × FOOD_CAP_PER_PLAYER` motes (half of them bacteria, which move every broadcast) and
// the fragment cap, packed into a disc around the eight cells so a widest-zoom view holds several hundred motes, the
// case the ticket measured. Medians and p95 over `BENCH_BROADCASTS` broadcasts after `BENCH_WARMUP_BROADCASTS`.

import {
  BACTERIUM_VARIANT,
  DNA_FRAGMENT_CAP_BASE,
  DNA_FRAGMENT_CAP_PER_PLAYER,
  DNA_TAGS,
  FOOD_CAP_BASE,
  FOOD_CAP_PER_PLAYER,
  FOOD_KIND,
  P95_QUANTILE,
  SNAPSHOT_EVERY_TICKS,
  playerId,
  type PlayerId,
} from '@evolution/shared';
import { spawnDnaFragment, spawnFoodMote } from '../src/game/simulation/spawn-mote.js';
import { serializeBroadcastSnapshot } from '../src/game/serialize/serialize.js';
import { VIEWER_SNAPSHOT_KEYS } from '../src/game/serialize/viewer-snapshot-keys.js';
import { EvolutionViewerState } from '../src/game/serialize/viewer-state.js';
import { createTestWorld } from '../src/testing/world-builders.js';
import { closeSnapshotFrame, openSnapshotFrame } from '../src/ws/snapshot-frame.js';

const VIEWERS = 8;
const BENCH_WARMUP_BROADCASTS = 30;
const BENCH_BROADCASTS = 300;
const BENCH_SEED = 406;
/** The disc the food is packed into, around the cells (wu). */
const FOOD_DISC_RADIUS_WU = 700;
/** How far a bacterium moves between broadcasts (wu), well past the §4 wire quantum. */
const BACTERIUM_STEP_WU = 3;
/** A cell radius past the one the widest zoom clamps at, and the spawn radius's default. */
const WIDEST_ZOOM_RADIUS_WU = 10_000;
const CELL_SPACING_WU = 40;
const HALF = 0.5;
const FULL_TURN_RADIANS = 2 * Math.PI;
const MICROSECONDS_PER_MILLISECOND = 1000;

/** A seeded LCG in [0, 1): the bench's own, so its dish never depends on the simulation's streams. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function quantile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
}

function filledWorld(isWidestZoom: boolean) {
  const players = Array.from({ length: VIEWERS }, (_unused, index) => ({
    playerId: playerId(`bench-${index}`),
    playerName: `Bench ${index}`,
    avatarIndex: index,
  }));
  const world = createTestWorld({ players });
  const random = seededRandom(BENCH_SEED);
  world.cells.forEach((cell, index) => {
    cell.x = (index - VIEWERS / 2) * CELL_SPACING_WU;
    cell.y = 0;
    if (isWidestZoom) cell.radius = WIDEST_ZOOM_RADIUS_WU;
  });
  const pointInDisc = () => {
    const distance = FOOD_DISC_RADIUS_WU * Math.sqrt(random());
    const angle = FULL_TURN_RADIANS * random();
    return { x: distance * Math.cos(angle), y: distance * Math.sin(angle) };
  };
  for (let index = 0; index < FOOD_CAP_BASE + VIEWERS * FOOD_CAP_PER_PLAYER; index += 1) {
    const isBacterium = random() < HALF;
    spawnFoodMote(world, {
      kind: isBacterium ? FOOD_KIND.bacterium : FOOD_KIND.algae,
      variant: isBacterium ? BACTERIUM_VARIANT.plain : null,
      at: pointInDisc(),
    });
  }
  for (let index = 0; index < DNA_FRAGMENT_CAP_BASE + VIEWERS * DNA_FRAGMENT_CAP_PER_PLAYER; index += 1) {
    spawnDnaFragment(world, { at: pointInDisc(), tag: DNA_TAGS[index % DNA_TAGS.length]!, driftTurn: random() });
  }
  return { world, random, viewers: players.map((player) => player.playerId) };
}

function run(isWidestZoom: boolean): void {
  const { world, random, viewers } = filledWorld(isWidestZoom);
  const viewerState = new EvolutionViewerState(world);
  // What `sendSnapshotToViewers` passes: the module's member writer where it has one (#406), `JSON.stringify` otherwise.
  const { memberJson } = viewerState as { memberJson?: (key: string, value: unknown) => string };
  const writeMember = memberJson?.bind(viewerState);
  const samplesMs: number[] = [];
  let bytes = 0;
  let spawnedAtLast = 0;
  let movedAtLast = 0;
  for (let broadcast = 0; broadcast < BENCH_WARMUP_BROADCASTS + BENCH_BROADCASTS; broadcast += 1) {
    world.tick += SNAPSHOT_EVERY_TICKS;
    for (const mote of world.food) {
      if (mote.kind !== FOOD_KIND.bacterium) continue;
      mote.x += (random() - HALF) * 2 * BACTERIUM_STEP_WU;
      mote.y += (random() - HALF) * 2 * BACTERIUM_STEP_WU;
    }
    const snapshot = serializeBroadcastSnapshot(world);
    const started = process.cpuUsage();
    const frame = openSnapshotFrame(snapshot, VIEWER_SNAPSHOT_KEYS);
    bytes = 0;
    for (const viewer of viewers as PlayerId[]) {
      const members = viewerState.serialize(viewer, snapshot);
      bytes += closeSnapshotFrame(frame, members, writeMember).length;
      if (viewer === viewers[0]) {
        spawnedAtLast = members.food.spawned.length;
        movedAtLast = members.food.moved.length;
      }
    }
    const spent = process.cpuUsage(started);
    if (broadcast >= BENCH_WARMUP_BROADCASTS)
      samplesMs.push((spent.user + spent.system) / MICROSECONDS_PER_MILLISECOND);
  }
  const label = isWidestZoom ? 'widest zoom' : 'spawn zoom ';
  const median = quantile(samplesMs, HALF).toFixed(2);
  const p95 = quantile(samplesMs, P95_QUANTILE).toFixed(2);
  console.log(
    `${label}: median ${median} ms CPU, p95 ${p95} ms per broadcast (${VIEWERS} viewers); viewer 0 moved ${movedAtLast},` +
      ` spawned ${spawnedAtLast}; ${Math.round(bytes / VIEWERS)} B per viewer`,
  );
}

run(false);
run(true);
