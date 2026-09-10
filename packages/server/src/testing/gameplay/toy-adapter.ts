// A two-rule "world" for the framework's own unit tests, never for a scenario table: every
// player is a point that moves one world unit per tick toward its last target, starting at
// `x = seed`. It gives the tests a module whose snapshot has cells, whose hash moves every
// tick and whose state depends on the seed and the inputs — what the echo module cannot offer.

import { DEFAULT_BALANCE, hashText, type PlayerId, type StateHash, type Vec2 } from '@evolution/shared';
import type { GameModule } from '../../game/game-module.js';
import type { CellLocation, PlayerCommand, ScenarioAdapter } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import { createScenarioDsl } from './scenario.js';

export interface ToyInput extends PlayerCommand {
  readonly sequence: number;
}

export interface ToyCell extends Vec2 {
  readonly targetX: number;
  readonly targetY: number;
}

export interface ToySnapshot {
  readonly tick: number;
  readonly cells: Readonly<Record<string, ToyCell>>;
}

/** Puts a player's point somewhere before the tick it is stamped with (setup or scheduled). */
export interface ToyFixture {
  readonly playerIndex: number;
  readonly at: Vec2;
}

export interface ToyModule extends GameModule<ToyInput, ToySnapshot> {
  readonly snapshot: ToySnapshot;
  place(playerId: PlayerId, point: Vec2): void;
}

export const TOY_SPEED_WU_PER_TICK = 1;
export const TOY_RADIUS_WU = 10;

function stepToward(cell: ToyCell): ToyCell {
  const deltaX = cell.targetX - cell.x;
  const deltaY = cell.targetY - cell.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= TOY_SPEED_WU_PER_TICK) {
    return { ...cell, x: cell.targetX, y: cell.targetY };
  }
  const fraction = TOY_SPEED_WU_PER_TICK / distance;
  return { ...cell, x: cell.x + deltaX * fraction, y: cell.y + deltaY * fraction };
}

function retarget(cell: ToyCell, input: ToyInput): ToyCell {
  return { ...cell, targetX: input.targetX ?? cell.targetX, targetY: input.targetY ?? cell.targetY };
}

function placed(cell: ToyCell, point: Vec2): ToyCell {
  return { ...cell, ...point, targetX: point.x, targetY: point.y };
}

function requireCell(cells: ReadonlyMap<string, ToyCell>, playerId: PlayerId): ToyCell {
  const cell = cells.get(playerId);
  if (cell === undefined) {
    throw new ScenarioSetupError(`toy module has no cell for player ${playerId}`);
  }
  return cell;
}

export function createToyModule(playerIds: readonly PlayerId[], seed: number): ToyModule {
  let tick = 0;
  const cells = new Map<string, ToyCell>();
  const spawn = (playerId: PlayerId): void => {
    cells.set(playerId, { x: seed, y: 0, targetX: seed, targetY: 0 });
  };
  playerIds.forEach(spawn);
  return {
    get snapshot(): ToySnapshot {
      return { tick, cells: Object.fromEntries(cells) };
    },
    submitInput: (playerId, payload) => {
      cells.set(playerId, retarget(requireCell(cells, playerId), payload));
    },
    reduceGameState: () => {
      tick += 1;
      for (const [playerId, cell] of cells) {
        cells.set(playerId, stepToward(cell));
      }
    },
    serializeRoomState() {
      return this.snapshot;
    },
    serializeFullState() {
      return { snapshot: this.snapshot, balance: DEFAULT_BALANCE };
    },
    addPlayer: spawn,
    removePlayer: (playerId) => {
      cells.delete(playerId);
    },
    place: (playerId, point) => {
      cells.set(playerId, placed(requireCell(cells, playerId), point));
    },
  };
}

const asToyModule = (module: GameModule<ToyInput, ToySnapshot>): ToyModule => module as ToyModule;

export const toyAdapter: ScenarioAdapter<ToyInput, ToySnapshot, ToyFixture> = {
  name: 'toy',
  createModule: (options) => createToyModule(options.playerIds, options.config.seed),
  readSnapshot: (module) => asToyModule(module).snapshot,
  hashState: (module): StateHash => hashText(JSON.stringify(asToyModule(module).snapshot)),
  toInput: (playerCommand, sequence) => ({ ...playerCommand, sequence }),
  locateCell: (snapshot, playerId): CellLocation | undefined => {
    const cell = snapshot.cells[playerId];
    return cell === undefined ? undefined : { x: cell.x, y: cell.y, radiusWu: TOY_RADIUS_WU };
  },
  applyFixture: (module, fixture, context) =>
    asToyModule(module).place(context.playerId(fixture.playerIndex), fixture.at),
};

export const toyScenario = createScenarioDsl(toyAdapter);
