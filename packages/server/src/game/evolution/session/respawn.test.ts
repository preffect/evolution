// docs/GAME-DESIGN.md §5.2 (G8 timing): spectate, then respawn on the tick after the timer hits zero.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, EFFECT_KIND, PLAYER_LIFE_STATE, playerId, secondsToTicks } from '@evolution/shared';
import { setCellMass } from '../simulation/cell-mass.js';
import { createTestStepContext, createTestWorld } from '../testing/builders.js';
import type { CellRecord } from '../world/entities.js';
import { absorbCell } from './death.js';
import { runRespawns } from './respawn.js';

const DEATH_TICK = 30;
const SPECTATE_TICKS = secondsToTicks(DEFAULT_BALANCE.session.RESPAWN_SPECTATE_SECONDS);

function deadVictim() {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  setCellMass(predator, 100, DEFAULT_BALANCE);
  const victim = world.players[1]!;
  victim.level = 3;
  victim.ownedTraits.push({ traitId: 'nucleoid', tier: 1 });
  world.tick = DEATH_TICK;
  absorbCell(world, createTestStepContext(world), prey, predator);
  return { world, victim };
}

describe('runRespawns', () => {
  it('counts down during spectate and respawns on the tick after zero, level and traits kept', () => {
    const { world, victim } = deadVictim();
    for (let tick = DEATH_TICK + 1; tick <= DEATH_TICK + SPECTATE_TICKS; tick += 1) {
      world.tick = tick;
      world.effects = [];
      runRespawns(world, createTestStepContext(world));
      expect(victim.lifeState).toBe(PLAYER_LIFE_STATE.spectating);
      expect(world.cells).toHaveLength(1);
    }
    expect(victim.respawnInTicks).toBe(0);
    world.tick = DEATH_TICK + SPECTATE_TICKS + 1;
    world.effects = [];
    const context = createTestStepContext(world);
    runRespawns(world, context);
    expect(victim.lifeState).toBe(PLAYER_LIFE_STATE.alive);
    expect(victim.spectatingPlayerId).toBeNull();
    const cell = world.cells.find((entry) => entry.playerId === 'b')!;
    expect(cell.mass).toBe(DEFAULT_BALANCE.growth.CELL_STARTING_MASS);
    expect(cell.level).toBe(3);
    expect(cell.traits).toEqual([{ traitId: 'nucleoid', tier: 1 }]);
    expect(context.effects).toEqual([
      { kind: EFFECT_KIND.respawn, tick: world.tick, x: cell.x, y: cell.y, cellId: cell.id, playerId: 'b' },
    ]);
  });

  it('places the respawn safely away from the threat', () => {
    const { world } = deadVictim();
    world.tick = DEATH_TICK + SPECTATE_TICKS + 1;
    const victimRecord = world.players[1]!;
    victimRecord.respawnInTicks = 0;
    runRespawns(world, createTestStepContext(world));
    const predator = world.cells[0]!;
    const cell = world.cells[1]!;
    expect(Math.hypot(cell.x - predator.x, cell.y - predator.y)).toBeGreaterThanOrEqual(
      DEFAULT_BALANCE.world.SAFE_SPAWN_RADIUS,
    );
  });

  it('ignores alive players', () => {
    const world = createTestWorld();
    runRespawns(world, createTestStepContext(world));
    expect(world.cells).toHaveLength(1);
    expect(world.effects).toEqual([]);
  });
});
