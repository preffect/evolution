// docs/TESTING.md §8.4: the Evolution binding over wire snapshots.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  createTestCellView,
  createTestSnapshot,
  entityId,
  playerId,
  type BalanceConfig,
} from '@evolution/shared';
import { toWireInput } from './bot-binding.js';
import { createEvolutionBotBinding, EVOLUTION_BINDING_NAME, evolutionBotBinding } from './evolution-binding.js';

const alice = playerId('alice');
const bob = playerId('bob');

function snapshotWithFood() {
  return createTestSnapshot({
    cells: [
      createTestCellView({ id: entityId('c-1'), playerId: alice, x: 100, y: 0, radius: 18, mass: 20 }),
      createTestCellView({ id: entityId('c-2'), kind: 'wild', playerId: null, x: 300, y: 0, mass: 40 }),
    ],
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

  it('is named and locates a cell by its wire view, never a wild one', () => {
    expect(binding.name).toBe(EVOLUTION_BINDING_NAME);
    expect(binding.locateCell(snapshotWithFood(), alice)).toEqual({ x: 100, y: 0, radius: 18 });
    expect(binding.locateCell(snapshotWithFood(), bob)).toBeUndefined();
    expect(binding.perception.ownCellOf(snapshotWithFood(), alice)?.id).toBe('c-1');
  });

  it('maps a command with the shared wire input mapping', () => {
    const command = { targetX: 3, targetY: 4, isSprinting: true };
    expect(binding.toInput(command, 7)).toEqual(toWireInput(command, 7));
  });

  it('sees every cell, and the fragments while any exist, else the motes (the greedy graze)', () => {
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

  it("the wire client's binding reads the default balance", () => {
    expect(
      evolutionBotBinding.perception.canEngulf(createTestCellView({ mass: 25 }), createTestCellView({ mass: 20 })),
    ).toBe(true);
  });
});
