import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  canEngulf,
  createTestPlayerProgressView,
  entityId,
  playerId,
  type CellView,
  type PlayerProgressView,
} from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import type { CameraExtent } from '../../render/camera';
import { WILD_CELL_THREAT_NAME, threatsFor } from './threats-for';

const ON_SCREEN: CameraExtent = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
const OWN = createTestCellView({ id: entityId('own'), mass: 20, radius: 4, x: 0, y: 0 });

/** Big enough to eat the own cell on the live ratio, so `canEngulf` holds without hard-coding it. */
function predatorAt(id: string, x: number, y: number, overrides: Partial<CellView> = {}): CellView {
  return createTestCellView({
    id: entityId(id),
    playerId: playerId(`player-${id}`),
    mass: OWN.mass * 10,
    radius: 20,
    x,
    y,
    ...overrides,
  });
}

function playersFor(cells: readonly CellView[]): Record<string, PlayerProgressView> {
  return Object.fromEntries(
    cells
      .filter((cell) => cell.playerId !== null)
      .map((cell) => [
        cell.playerId,
        createTestPlayerProgressView({ playerId: cell.playerId!, playerName: `Name ${cell.id}` }),
      ]),
  );
}

function inputWith(cells: readonly CellView[], cameraExtent: CameraExtent | null = ON_SCREEN) {
  return { cells: [OWN, ...cells], ownCell: OWN, cameraExtent, players: playersFor(cells), balance: DEFAULT_BALANCE };
}

describe('threatsFor', () => {
  it('answers the cells the shared canEngulf says can eat us, and no others', () => {
    const predator = predatorAt('big', 50, 0);
    const harmless = createTestCellView({
      id: entityId('small'),
      playerId: playerId('p-small'),
      mass: 5,
      radius: 2,
      x: 10,
    });
    expect(canEngulf(predator, OWN, DEFAULT_BALANCE.absorption)).toBe(true);
    expect(canEngulf(harmless, OWN, DEFAULT_BALANCE.absorption)).toBe(false);

    const threats = threatsFor(inputWith([predator, harmless]));
    expect(threats.map((threat) => threat.cellId)).toEqual([predator.id]);
  });

  it('never reports the own cell, whatever its mass', () => {
    expect(threatsFor(inputWith([]))).toEqual([]);
  });

  it('orders nearest first, so the record can take the head', () => {
    const near = predatorAt('near', 10, 0);
    const far = predatorAt('far', 300, 0);
    const threats = threatsFor(inputWith([far, near]));
    expect(threats.map((threat) => threat.cellId)).toEqual([near.id, far.id]);
  });

  it('breaks a tie on id, so an equidistant pair cannot make the label flicker', () => {
    const west = predatorAt('aaa', -40, 0);
    const east = predatorAt('bbb', 40, 0);
    expect(threatsFor(inputWith([east, west])).map((threat) => threat.cellId)).toEqual([west.id, east.id]);
    expect(threatsFor(inputWith([west, east])).map((threat) => threat.cellId)).toEqual([west.id, east.id]);
  });

  it('drops a predator that is off screen, since its label would point at nothing', () => {
    const offScreen = predatorAt('far-away', 5000, 5000);
    expect(threatsFor(inputWith([offScreen]))).toEqual([]);
  });

  it('answers empty before the renderer has given us a camera', () => {
    expect(threatsFor(inputWith([predatorAt('big', 10, 0)], null))).toEqual([]);
  });

  it('names a player threat by its player name and a wild cell by its stand-in', () => {
    const player = predatorAt('rival', 10, 0);
    const wild = predatorAt('wild', 20, 0, { playerId: null });
    const threats = threatsFor(inputWith([player, wild]));
    expect(threats.map((threat) => threat.name)).toEqual([`Name ${player.id}`, WILD_CELL_THREAT_NAME]);
  });
});
