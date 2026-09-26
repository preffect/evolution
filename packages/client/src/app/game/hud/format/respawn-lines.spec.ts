// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CELL_KIND,
  CELL_STAGE,
  PLAYER_LIFE_STATE,
  TICK_HZ,
  createTestCellView,
  createTestPlayerProgressView,
  entityId,
  playerId,
  type OwnProgressView,
} from '@evolution/shared';
import { respawnLinesFor, type RespawnInput } from './respawn-lines';

const KILLER_CELL_ID = entityId('c9');
const KILLER_PLAYER_ID = playerId('p9');

function spectating(overrides: Partial<OwnProgressView> = {}): OwnProgressView {
  return createTestPlayerProgressView({
    lifeState: PLAYER_LIFE_STATE.spectating,
    spectatingCellId: KILLER_CELL_ID,
    respawnInTicks: 3 * TICK_HZ,
    level: 4,
    ownedTraits: [
      { traitId: 'nucleoid', tier: 1 },
      { traitId: 'cell_wall', tier: 1 },
      { traitId: 'simple_flagellum', tier: 1 },
    ],
    dnaTowardNextLevel: 20,
    ...overrides,
  });
}

function input(overrides: Partial<RespawnInput> = {}): RespawnInput {
  return {
    ownProgress: spectating(),
    cells: [createTestCellView({ id: KILLER_CELL_ID, playerId: KILLER_PLAYER_ID })],
    players: { [KILLER_PLAYER_ID]: { playerId: KILLER_PLAYER_ID, playerName: 'Amoeboid' } },
    lastAliveOwnProgress: createTestPlayerProgressView({ dnaTowardNextLevel: 60 }),
    ...overrides,
  };
}

describe('respawnLinesFor', () => {
  it('names the player whose cell engulfed us, in capitals', () => {
    expect(respawnLinesFor(input()).killer).toBe('ENGULFED BY AMOEBOID');
  });

  it('names a wild killer as a wild cell, whatever its stage', () => {
    for (const stage of [CELL_STAGE.protocell, CELL_STAGE.endosymbiosis, CELL_STAGE.specialised]) {
      const wild = createTestCellView({ id: KILLER_CELL_ID, kind: CELL_KIND.wild, playerId: null, stage });
      expect(respawnLinesFor(input({ cells: [wild] })).killer).toBe('ENGULFED BY A WILD CELL');
    }
  });

  it('cuts a long killer name the way the leaderboard does, so the title stays on one line', () => {
    const players = { [KILLER_PLAYER_ID]: { playerId: KILLER_PLAYER_ID, playerName: 'Amoeboid Supreme Ruler' } };
    expect(respawnLinesFor(input({ players })).killer).toBe('ENGULFED BY AMOEBOID SU…');
  });

  it('says ENGULFED alone once the killer has gone', () => {
    expect(respawnLinesFor(input({ cells: [] })).killer).toBe('ENGULFED');
    expect(respawnLinesFor(input({ ownProgress: spectating({ spectatingCellId: null }) })).killer).toBe('ENGULFED');
    expect(respawnLinesFor(input({ players: {} })).killer).toBe('ENGULFED');
  });

  it('counts down in whole seconds, rounded up', () => {
    expect(respawnLinesFor(input()).countdown).toBe('Respawning in 3');
    expect(respawnLinesFor(input({ ownProgress: spectating({ respawnInTicks: 2 * TICK_HZ + 1 }) })).countdown).toBe(
      'Respawning in 3',
    );
    expect(respawnLinesFor(input({ ownProgress: spectating({ respawnInTicks: 1 }) })).countdown).toBe(
      'Respawning in 1',
    );
  });

  it('never reads 0 on the last spectating tick', () => {
    expect(respawnLinesFor(input({ ownProgress: spectating({ respawnInTicks: 0 }) })).countdown).toBe(
      'Respawning in 1',
    );
  });

  it('says the level and traits kept and the DNA lost since the last alive snapshot', () => {
    expect(respawnLinesFor(input()).kept).toBe('Level 4 and 3 traits kept · 40 DNA lost');
  });

  it('counts one trait in the singular', () => {
    const ownProgress = spectating({ ownedTraits: [{ traitId: 'nucleoid', tier: 1 }] });
    expect(respawnLinesFor(input({ ownProgress })).kept).toBe('Level 4 and 1 trait kept · 40 DNA lost');
  });

  it('says only the level when there are no traits to keep', () => {
    const ownProgress = spectating({ ownedTraits: [] });
    expect(respawnLinesFor(input({ ownProgress })).kept).toBe('Level 4 kept · 40 DNA lost');
  });

  it('leaves the loss out when this client never saw the player alive', () => {
    expect(respawnLinesFor(input({ lastAliveOwnProgress: null })).kept).toBe('Level 4 and 3 traits kept');
  });

  it('never reads a gain as a negative loss', () => {
    const lastAliveOwnProgress = createTestPlayerProgressView({ dnaTowardNextLevel: 10 });
    expect(respawnLinesFor(input({ lastAliveOwnProgress })).kept).toBe('Level 4 and 3 traits kept · 0 DNA lost');
  });
});
