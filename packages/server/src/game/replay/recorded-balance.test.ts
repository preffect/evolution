// docs/determinism/replay-tests-and-traps.md §6: a recording replays under its own numbers, any leaf it lacks at its
// shipping default. The pinned recording was exported on main before ticket #907 (no `SWALLOW_FROM_STAGE`, no
// `earlyLife`): a 240-tick room in which a protocell player engulfs another (debug-staged), so it reproduces its
// `finalHash` only while the walk hashes a world with no held bacteria as main did and the filled switch lets a
// protocell swallow, as main did.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, REPLAY_FORMAT_VERSION, type BalanceConfig } from '@evolution/shared';
import { recordedBalanceWithShippingDefaults } from './recorded-balance.js';
import type { Replay } from './replay-format.js';
import { replay } from './replay-runner.js';

const RECORDED_BEFORE_907 = new URL('./fixtures/recorded-before-907.replay.json', import.meta.url);
/** What the pinned recording carries, read back so the test fails loudly if the fixture is swapped. */
const RECORDED_FINAL_HASH = '44cbc5984ecd6514';
const RECORDED_ABSORPTIONS = 1;
/** A recorded number that differs from its default, so "the recording wins" is observable. */
const RECORDED_DISH_RADIUS = 1234;
/** The leaf ticket #907 added to an existing domain, named through a constant because a balance is keyed by names. */
const SWALLOW_LEAF = 'SWALLOW_FROM_STAGE';

function recordingBefore907(): Replay {
  return JSON.parse(readFileSync(RECORDED_BEFORE_907, 'utf8')) as Replay;
}

/** The default balance without the leaves ticket #907 added: the shape a recording from before it carries. */
function balanceBefore907(): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE) as unknown as Record<string, Record<string, unknown>>;
  delete balance['earlyLife'];
  delete balance['absorption']![SWALLOW_LEAF];
  return balance as unknown as BalanceConfig;
}

describe('recordedBalanceWithShippingDefaults', () => {
  it('fills the leaves a recording lacks from their shipping defaults, a whole missing domain included', () => {
    const filled = recordedBalanceWithShippingDefaults(balanceBefore907());
    expect(filled.absorption.SWALLOW_FROM_STAGE).toBe(DEFAULT_BALANCE.absorption.SWALLOW_FROM_STAGE);
    expect(filled.earlyLife).toEqual(DEFAULT_BALANCE.earlyLife);
    expect(filled).toEqual(DEFAULT_BALANCE);
  });

  it('keeps every leaf the recording carries and never writes the recording', () => {
    const recorded = balanceBefore907();
    recorded.world.DISH_RADIUS = RECORDED_DISH_RADIUS;
    const filled = recordedBalanceWithShippingDefaults(recorded);
    expect(filled.world.DISH_RADIUS).toBe(RECORDED_DISH_RADIUS);
    expect(recorded).not.toHaveProperty('earlyLife');
    expect(filled.earlyLife).not.toBe(DEFAULT_BALANCE.earlyLife);
  });
});

describe('a recording exported before ticket #907', () => {
  it('is the recording this file pins: format version 2, no swallow switch, a protocell engulf', () => {
    const recording = recordingBefore907();
    expect(recording.version).toBe(REPLAY_FORMAT_VERSION);
    expect(recording.balance.absorption).not.toHaveProperty(SWALLOW_LEAF);
    expect(recording.balance).not.toHaveProperty('earlyLife');
    expect(recording.finalHash).toBe(RECORDED_FINAL_HASH);
  });

  it('replays to the final hash main recorded, under the protocell switch it is filled with', () => {
    const replayed = replay(recordingBefore907());
    expect(replayed.world.balance.absorption.SWALLOW_FROM_STAGE).toBe(CELL_STAGE.protocell);
    expect(replayed.world.players.map((player) => player.absorptions)).toContain(RECORDED_ABSORPTIONS);
    expect(replayed.hash).toBe(RECORDED_FINAL_HASH);
  });
});
