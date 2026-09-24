// docs/architecture/wire-contract.md §4 "Mass flow" (#383, #416): the own progress's mass flow, its window amounts
// sealed by the broadcast drain, and the meal amounts of the drained effects.
import { describe, expect, it } from 'vitest';
import {
  EFFECT_KIND,
  MASS_RATE_CAUSES,
  MASS_WINDOW_AMOUNT,
  PLAYER_LIFE_STATE,
  SNAPSHOT_MASS_DECIMALS,
  ZONE_ID,
  zeroRecord,
} from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { recordMetabolism, recordWindowAmount } from '../world/mass-flow-ledger.js';
import { MASS_WINDOW, ownProgressOf, serializeBroadcastSnapshot } from './serialize.js';

describe('the own progress mass flow (#383)', () => {
  const record = {
    ratesPerSecond: { ...zeroRecord(MASS_RATE_CAUSES), decay: -0.5 },
    decayTraitShare: 0,
    zone: ZONE_ID.openBroth,
  };
  const sprintSpent = 5;
  const noDraftBonus = 10;

  function worldWithFlow() {
    const world = createTestWorld();
    const player = world.players[0]!;
    recordMetabolism(world.massFlow, player.playerId, record);
    recordWindowAmount(world.massFlow, player.playerId, MASS_WINDOW_AMOUNT.sprintSpent, sprintSpent);
    recordWindowAmount(world.massFlow, player.playerId, MASS_WINDOW_AMOUNT.noDraftBonusGained, noDraftBonus);
    return { world, player };
  }

  it('reports the window amounts only once the broadcast drain seals them, and a game_state none', () => {
    const { world, player } = worldWithFlow();
    const flowOnly = { ratesPerSecond: { decay: -0.5 }, zone: ZONE_ID.openBroth };
    expect(ownProgressOf(world, player.playerId)?.massFlow).toEqual(flowOnly);
    serializeBroadcastSnapshot(world);
    expect(ownProgressOf(world, player.playerId)?.massFlow).toEqual({
      ...flowOnly,
      sprintSpent,
      noDraftBonusGained: noDraftBonus,
    });
    expect(ownProgressOf(world, player.playerId, MASS_WINDOW.omitted)?.massFlow).toEqual(flowOnly);
    serializeBroadcastSnapshot(world);
    expect(ownProgressOf(world, player.playerId)?.massFlow).toEqual(flowOnly);
  });

  it('is null while spectating and before the metabolism step has run', () => {
    const { world, player } = worldWithFlow();
    player.lifeState = PLAYER_LIFE_STATE.spectating;
    expect(ownProgressOf(world, player.playerId)?.massFlow).toBeNull();
    expect(ownProgressOf(createTestWorld(), player.playerId)?.massFlow).toBeNull();
  });

  it('rounds the meal amounts of the drained effects to the wire mass', () => {
    const world = createTestWorld();
    const cellId = world.cells[0]!.id;
    const massGained = 1.26;
    world.effects.push({
      kind: EFFECT_KIND.eat,
      tick: 1,
      x: 0,
      y: 0,
      cellId,
      eatenId: cellId,
      eatenKind: 'food_mote',
      massGained,
      dnaGained: 0,
    });
    const [eaten] = serializeBroadcastSnapshot(world).effects;
    expect(eaten).toMatchObject({ massGained: Number(massGained.toFixed(SNAPSHOT_MASS_DECIMALS)) });
  });
});
