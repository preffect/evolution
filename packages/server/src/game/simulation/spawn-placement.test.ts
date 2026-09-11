// docs/GAME-DESIGN.md §5.2 (G3): safe placement.
import { describe, expect, it } from 'vitest';
import { createSeededRandom, DEFAULT_BALANCE, type RandomSource } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { drawSpawnCandidate, findSafeSpawnPoint, isThreat, nearestThreatDistance } from './spawn-placement.js';

const SEED = 42;
const { world: worldBalance, growth } = DEFAULT_BALANCE;

describe('drawSpawnCandidate', () => {
  it('draws inside the disc shrunk by the spawn edge margin, two draws each', () => {
    const random = createSeededRandom(SEED);
    for (let draw = 0; draw < 50; draw += 1) {
      const point = drawSpawnCandidate(random, DEFAULT_BALANCE);
      expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(
        worldBalance.DISH_RADIUS - worldBalance.SPAWN_EDGE_MARGIN,
      );
    }
    expect(random.getState().position).toBe(100);
  });
});

describe('isThreat / nearestThreatDistance', () => {
  it('counts a cell of at least the ratio × starting mass as a threat', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    cell.mass = worldBalance.SAFE_SPAWN_THREAT_MASS_RATIO * growth.CELL_STARTING_MASS - 0.01;
    expect(isThreat(cell, DEFAULT_BALANCE)).toBe(false);
    expect(nearestThreatDistance({ x: cell.x, y: cell.y }, world.cells, DEFAULT_BALANCE)).toBe(
      Number.POSITIVE_INFINITY,
    );
    cell.mass += 0.01;
    expect(isThreat(cell, DEFAULT_BALANCE)).toBe(true);
    expect(nearestThreatDistance({ x: cell.x + 3, y: cell.y + 4 }, world.cells, DEFAULT_BALANCE)).toBe(5);
  });
});

describe('findSafeSpawnPoint', () => {
  it('rejects a candidate with a threat within SAFE_SPAWN_RADIUS and takes the next safe one', () => {
    const world = createTestWorld();
    const threat = world.cells[0]!;
    threat.mass = 100;
    const first = drawSpawnCandidate(createSeededRandom(SEED), DEFAULT_BALANCE);
    threat.x = first.x + 100;
    threat.y = first.y;
    const chosen = findSafeSpawnPoint(createSeededRandom(SEED), world.cells, DEFAULT_BALANCE);
    expect(chosen).not.toEqual(first);
    expect(Math.hypot(chosen.x - threat.x, chosen.y - threat.y)).toBeGreaterThanOrEqual(worldBalance.SAFE_SPAWN_RADIUS);
  });

  it('accepts the first candidate when nothing threatens', () => {
    const world = createTestWorld();
    const first = drawSpawnCandidate(createSeededRandom(SEED), DEFAULT_BALANCE);
    expect(findSafeSpawnPoint(createSeededRandom(SEED), world.cells, DEFAULT_BALANCE)).toEqual(first);
  });

  it('falls back to the candidate farthest from the nearest threat after the attempts are exhausted', () => {
    const world = createTestWorld();
    const threat = world.cells[0]!;
    threat.mass = 100;
    threat.x = 0;
    threat.y = 0;
    // Every candidate lands within 300 wu of the origin: none is safe, the farthest is chosen.
    const candidates = [50, 250, 120, 300, 10];
    let index = 0;
    const stub: RandomSource = {
      ...createSeededRandom(SEED),
      nextFloat: () => {
        const radius = candidates[index % candidates.length]!;
        index += 1;
        // Two draws per candidate: the radial draw encodes the radius, the angle is 0.
        return index % 2 === 1 ? (radius / (worldBalance.DISH_RADIUS - worldBalance.SPAWN_EDGE_MARGIN)) ** 2 : 0;
      },
    };
    const chosen = findSafeSpawnPoint(stub, world.cells, DEFAULT_BALANCE);
    expect(Math.hypot(chosen.x, chosen.y)).toBeCloseTo(300, 6);
    expect(index).toBe(worldBalance.SAFE_SPAWN_MAX_ATTEMPTS * 2);
  });
});
