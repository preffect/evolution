import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  createTestCellView,
  createTestSnapshot,
  entityId,
  playerId,
  type BalanceConfig,
} from '@evolution/shared';
import { toWireInput } from '../gameplay/wire-input.js';
import { createEvolutionBotBinding, EVOLUTION_BINDING_NAME } from './evolution-binding.js';

const alice = playerId('alice');
const bob = playerId('bob');

function snapshotWithFood() {
  return createTestSnapshot({
    cells: [createTestCellView({ playerId: alice, x: 100, y: 0, radius: 18, mass: 20 })],
    dnaFragments: [{ id: entityId('f-1'), x: 5, y: 5, tag: 'motile' }],
    food: {
      spawned: [{ id: entityId('m-1'), kind: 'algae', bacteriumVariant: null, x: 1, y: 1 }],
      removedIds: [],
      moved: [],
    },
  });
}

describe('evolution bot binding', () => {
  const binding = createEvolutionBotBinding(() => DEFAULT_BALANCE);

  it('is named and locates a cell by its wire view', () => {
    expect(binding.name).toBe(EVOLUTION_BINDING_NAME);
    expect(binding.locateCell(snapshotWithFood(), alice)).toEqual({ x: 100, y: 0, radiusWu: 18 });
    expect(binding.locateCell(snapshotWithFood(), bob)).toBeUndefined();
  });

  it("maps a command with the Evolution adapter's input mapping", () => {
    const command = { targetX: 3, targetY: 4, isSprinting: true };
    expect(binding.toInput(command, 7)).toEqual(toWireInput(command, 7));
  });

  it('sees the cells, and the fragments while any exist, else the motes (the greedy graze)', () => {
    const snapshot = snapshotWithFood();
    expect(binding.perception.cellsOf(snapshot)).toBe(snapshot.cells);
    expect(binding.perception.motesOf(snapshot).map((mote) => mote.id)).toEqual(['f-1']);
    expect(binding.perception.motesOf({ ...snapshot, dnaFragments: [] }).map((mote) => mote.id)).toEqual(['m-1']);
  });

  it('closes the shared engulf predicate over the balance it is handed, read at every call', () => {
    let balance: BalanceConfig = DEFAULT_BALANCE;
    const live = createEvolutionBotBinding(() => balance);
    const predator = createTestCellView({ mass: 30 });
    const prey = createTestCellView({ mass: 20 });
    expect(live.perception.canEngulf(predator, prey)).toBe(true);
    balance = structuredClone(DEFAULT_BALANCE);
    balance.absorption.ENGULF_MASS_RATIO = 2;
    expect(live.perception.canEngulf(predator, prey)).toBe(false);
  });
});
