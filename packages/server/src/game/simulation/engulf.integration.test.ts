// The engulf lifecycle end to end (docs/ARCHITECTURE.md §3, §4, §8; docs/DETERMINISM.md §7): two
// players in a real `GameRoom` on the Evolution module, placed through the debug handle the way a
// QA agent drives one (`debug_set_player`: mass and position), stepped under manual timing, and
// read back off the broadcast snapshot — not off the records. Two runs of the same seed and the
// same inputs hash equal at every tick of the engulf. Run with `./validate.sh integration`.

import { describe, expect, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  TICK_INTERVAL_MS,
  createTestGameInput,
  createTestSessionConfig,
  playerId,
  type CellView,
  type GameSnapshot,
  type PlayerId,
  type StateHash,
} from '@evolution/shared';
import { GameRoom } from '../../lobby/game-room.js';
import {
  createManualRoomTiming,
  createTestConnection,
  createTestRoomInitOptions,
  type SentLog,
} from '../../testing/builders.js';
import { createEvolutionModule } from '../evolution-module.js';

const SEED = 42;
const PREDATOR = playerId('predator');
const PREY = playerId('prey');
const PREDATOR_MASS = 100;
const PREY_MASS = 20;
const PREDATOR_POSITION = { x: 0, y: 0 };
const PREY_POSITION = { x: 10, y: 0 };
/** E9's timings: ratio 5 runs at 1/36 a tick, so the seal is tick 18 and the engulf ends on tick 36. */
const SEAL_TICK = 18;
const END_TICK = 36;
const absorption = DEFAULT_BALANCE.absorption;
const PROGRESS_TOLERANCE = 6;
/** Far enough east that the prey is out of the predator's cover reach within a few ticks. */
const ESCAPE_TARGET = { x: 2000, y: 0 };

interface DrivenRoom {
  snapshot(): GameSnapshot;
  /** Every `cell_released` reason the room has broadcast so far, in broadcast order. */
  releaseReasons(): string[];
  hash(): StateHash;
  stepOne(preyTarget?: { x: number; y: number }): void;
  stop(): void;
}

/** A room with both players placed by `debug_set_player`, exactly as the debug MCP tool would. */
function startRoom(seed: number): DrivenRoom {
  const options = createTestRoomInitOptions([PREDATOR, PREY], { config: createTestSessionConfig({ seed }) });
  const module = createEvolutionModule(options);
  const timing = createManualRoomTiming();
  const room = new GameRoom(module, options, timing);
  const sent: SentLog = {};
  room.addPlayer(createTestConnection({ playerId: PREDATOR, sent }));
  room.start();
  const handle = room.getDebugHandle();
  if (handle?.setPlayer === undefined || handle.computeStateHash === undefined) {
    throw new Error('the Evolution debug handle implements setPlayer and computeStateHash');
  }
  handle.setPlayer(PREDATOR, { mass: PREDATOR_MASS, position: PREDATOR_POSITION });
  handle.setPlayer(PREY, { mass: PREY_MASS, position: PREY_POSITION });
  let sequence = 0;
  return {
    snapshot: () => room.getFullState().snapshot as GameSnapshot,
    releaseReasons: () =>
      (sent[PREDATOR] ?? []).flatMap((message) => {
        const snapshot = (message as { snapshot?: GameSnapshot }).snapshot;
        return (snapshot?.effects ?? [])
          .filter((effect) => effect.kind === EFFECT_KIND.cellReleased)
          .map((effect) => (effect.kind === EFFECT_KIND.cellReleased ? effect.reason : ''));
      }),
    hash: () => handle.computeStateHash!(),
    stepOne: (preyTarget) => {
      sequence += 1;
      if (preyTarget !== undefined) {
        room.submitInput(PREY, createTestGameInput({ sequence, targetX: preyTarget.x, targetY: preyTarget.y }));
      }
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    },
    stop: () => room.stop(),
  };
}

const cellOf = (snapshot: GameSnapshot, player: PlayerId): CellView | undefined =>
  snapshot.cells.find((cell) => cell.playerId === player);

describe('an engulf through the room loop and onto the snapshot', () => {
  it('carries cover, wrap, seal and the end of the engulf on the cells the snapshot serialises', () => {
    const room = startRoom(SEED);
    const seen: { tick: number; states: readonly string[]; progress: number }[] = [];
    for (let tick = 1; tick <= END_TICK; tick += 1) {
      room.stepOne();
      const prey = cellOf(room.snapshot(), PREY);
      seen.push({ tick, states: prey?.states ?? [], progress: prey?.engulfProgress ?? 0 });
    }
    room.stop();

    const atTick = (tick: number) => seen[tick - 1]!;
    expect(atTick(1).states).toEqual([CELL_STATE.beingEngulfed]);
    expect(atTick(1).progress).toBeCloseTo(1 / END_TICK, PROGRESS_TOLERANCE);
    expect(atTick(SEAL_TICK).progress).toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE);
    expect(atTick(END_TICK).states).toEqual([]);
    expect(atTick(END_TICK).progress).toBe(0);
  });

  it('marks the predator engulfing and links both cells by id while the engulf runs', () => {
    const room = startRoom(SEED);
    room.stepOne();
    const snapshot = room.snapshot();
    const predator = cellOf(snapshot, PREDATOR);
    const prey = cellOf(snapshot, PREY);
    room.stop();
    expect(predator?.states).toEqual([CELL_STATE.engulfing]);
    expect(predator?.engulfingCellId).toBe(prey?.id);
    expect(prey?.engulfedByCellId).toBe(predator?.id);
  });

  it('broadcasts cell_released with its reason when the prey steers out of contact', () => {
    const room = startRoom(SEED);
    for (let tick = 1; tick <= END_TICK; tick += 1) {
      room.stepOne(ESCAPE_TARGET);
    }
    const reasons = room.releaseReasons();
    const prey = cellOf(room.snapshot(), PREY);
    room.stop();
    expect(reasons).toEqual([ENGULF_RELEASE_REASON.escaped]);
    expect(prey?.states).toEqual([]);
    expect(prey?.engulfProgress).toBe(0);
  });
});

describe('engulf determinism (docs/DETERMINISM.md §7)', () => {
  function hashesThrough(seed: number, preyTarget?: { x: number; y: number }): StateHash[] {
    const room = startRoom(seed);
    const hashes = [room.hash()];
    for (let tick = 1; tick <= END_TICK; tick += 1) {
      room.stepOne(preyTarget);
      hashes.push(room.hash());
    }
    room.stop();
    return hashes;
  }

  it('two rooms on one seed hash equal at every tick of a completed engulf', () => {
    const first = hashesThrough(SEED);
    expect(hashesThrough(SEED)).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it('two rooms on one seed hash equal at every tick of an escape', () => {
    const first = hashesThrough(SEED, ESCAPE_TARGET);
    expect(hashesThrough(SEED, ESCAPE_TARGET)).toEqual(first);
  });

  it('an escaping prey diverges from an idle one: the hash covers the engulf record', () => {
    expect(hashesThrough(SEED, ESCAPE_TARGET)).not.toEqual(hashesThrough(SEED));
  });
});
