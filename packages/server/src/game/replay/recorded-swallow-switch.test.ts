// docs/game-design/early-life.md §15.10 ("Old recordings"), docs/determinism/replay-tests-and-traps.md §6: a recording
// made under ticket #907's stage switch replays under the trait switch when it ran at `protocell`, and is refused by
// name before the replay starts under any other stage. Both pinned recordings were exported on main between tickets
// #907 and #948 (the balance carries `SWALLOW_FROM_STAGE: 'protocell'`): the 240-tick room of `recorded-before-907`, in
// which a protocell player engulfs another (debug-staged), and the same room with a recorded `set_balance` patch of
// the stage switch on tick 1, before the engulf starts. A wrong mapping changes who swallows, and so the final hash.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, STAGE_ORDER, type BalanceConfig } from '@evolution/shared';
import {
  ReplayStageSwitchError,
  recordedBalanceUnderTraitSwitch,
  recordedEventsUnderTraitSwitch,
} from './recorded-swallow-switch.js';
import { DEBUG_PATCH_KIND, REPLAY_EVENT_KIND, type Replay, type ReplayDebugPatchEvent } from './replay-format.js';
import { replay } from './replay-runner.js';

const RECORDED_BETWEEN_907_AND_948 = new URL('./fixtures/recorded-between-907-and-948.replay.json', import.meta.url);
const RECORDED_STAGE_SWITCH_PATCH = new URL('./fixtures/recorded-stage-switch-patch.replay.json', import.meta.url);
/** What both pinned recordings carry, read back so the tests fail loudly if a fixture is swapped. */
const RECORDED_FINAL_HASH = '44cbc5984ecd6514';
const RECORDED_ABSORPTIONS = 1;
const SWITCH_PATCH_TICK = 1;
/** The swallow switches (#907's, then #948's), named through constants because a balance is keyed by names. */
const STAGE_SWITCH_LEAF = 'SWALLOW_FROM_STAGE';
const TRAIT_SWITCH_LEAF = 'SWALLOW_GATE_TRAITS';
/** Every stage but `protocell`: the stage switch at any of them ran a game the trait switch cannot replay. */
const UNREPLAYABLE_STAGES = STAGE_ORDER.filter((stage) => stage !== CELL_STAGE.protocell);

type LooseRecord = Record<string, unknown>;

function read(fixture: URL): Replay {
  return JSON.parse(readFileSync(fixture, 'utf8')) as Replay;
}

/** The recorded absorption domain as the file holds it: keyed by names no balance type has any more. */
function absorptionOf(balance: BalanceConfig): LooseRecord {
  return balance.absorption as unknown as LooseRecord;
}

/** The pinned recording with its balance's stage switch moved to `stage`. */
function recordedUnderStage(stage: unknown): Replay {
  const recording = read(RECORDED_BETWEEN_907_AND_948);
  absorptionOf(recording.balance)[STAGE_SWITCH_LEAF] = stage;
  return recording;
}

/** The recorded stage switch patch, whichever tick it sits on. */
function switchPatchOf(recording: Replay): ReplayDebugPatchEvent {
  const event = recording.events.find(
    (candidate): candidate is ReplayDebugPatchEvent =>
      candidate.kind === REPLAY_EVENT_KIND.debugPatch && candidate.patch.kind === DEBUG_PATCH_KIND.setBalance,
  );
  if (event === undefined) throw new Error('the pinned recording lost its set_balance patch');
  return event;
}

/** The patch recording with its stage switch patch set to `stage` and stamped at `tick`. */
function patchRecordingUnderStage(stage: unknown, tick: number): Replay {
  const recording = read(RECORDED_STAGE_SWITCH_PATCH);
  const event = switchPatchOf(recording) as { tick: number; patch: { patch: Record<string, LooseRecord> } };
  event.tick = tick;
  event.patch.patch['absorption']![STAGE_SWITCH_LEAF] = stage;
  return recording;
}

describe('a recording made between tickets #907 and #948', () => {
  it('is the recording this file pins: format version 2, the stage switch at protocell, a protocell engulf', () => {
    const recording = read(RECORDED_BETWEEN_907_AND_948);
    expect(absorptionOf(recording.balance)[STAGE_SWITCH_LEAF]).toBe(CELL_STAGE.protocell);
    expect(recording.balance.absorption).not.toHaveProperty(TRAIT_SWITCH_LEAF);
    expect(recording.finalHash).toBe(RECORDED_FINAL_HASH);
  });

  it('maps protocell to the empty gate and drops the stale leaf before any fill, the recording untouched', () => {
    const recording = read(RECORDED_BETWEEN_907_AND_948);
    const mapped = recordedBalanceUnderTraitSwitch(recording.balance);
    expect(mapped.absorption.SWALLOW_GATE_TRAITS).toEqual([]);
    expect(mapped.absorption).not.toHaveProperty(STAGE_SWITCH_LEAF);
    expect(absorptionOf(recording.balance)[STAGE_SWITCH_LEAF]).toBe(CELL_STAGE.protocell);
  });

  it('leaves a balance without the stage leaf as it is', () => {
    const current = recordedBalanceUnderTraitSwitch(read(RECORDED_BETWEEN_907_AND_948).balance);
    expect(recordedBalanceUnderTraitSwitch(current)).toBe(current);
  });

  it('replays to the final hash main recorded, under the empty gate', () => {
    const replayed = replay(read(RECORDED_BETWEEN_907_AND_948));
    expect(replayed.world.balance.absorption.SWALLOW_GATE_TRAITS).toEqual([]);
    expect(replayed.world.balance.absorption).not.toHaveProperty(STAGE_SWITCH_LEAF);
    expect(replayed.world.players.map((player) => player.absorptions)).toContain(RECORDED_ABSORPTIONS);
    expect(replayed.hash).toBe(RECORDED_FINAL_HASH);
  });

  it.each(UNREPLAYABLE_STAGES)('is refused by name when it ran under the stage switch at %s', (stage) => {
    expect(() => replay(recordedUnderStage(stage))).toThrow(
      new ReplayStageSwitchError(
        `recorded under the stage switch at "${stage}" (its balance), which the trait switch cannot replay`,
      ),
    );
  });
});

describe('a recording with a recorded set_balance patch of the stage switch', () => {
  it('is the recording this file pins: the patch sets protocell on tick 1, before the engulf', () => {
    const recording = read(RECORDED_STAGE_SWITCH_PATCH);
    const event = switchPatchOf(recording);
    expect(event.tick).toBe(SWITCH_PATCH_TICK);
    expect(event.patch).toEqual({
      kind: DEBUG_PATCH_KIND.setBalance,
      patch: { absorption: { [STAGE_SWITCH_LEAF]: CELL_STAGE.protocell } },
    });
    expect(recording.finalHash).toBe(RECORDED_FINAL_HASH);
  });

  it('maps the patch to the empty gate and keeps every other event as recorded', () => {
    const recording = read(RECORDED_STAGE_SWITCH_PATCH);
    const mapped = recordedEventsUnderTraitSwitch(recording.events);
    expect(switchPatchOf({ ...recording, events: mapped }).patch).toEqual({
      kind: DEBUG_PATCH_KIND.setBalance,
      patch: { absorption: { [TRAIT_SWITCH_LEAF]: [] } },
    });
    const untouched = recording.events.filter((event) => event !== switchPatchOf(recording));
    for (const event of untouched) expect(mapped).toContain(event);
  });

  it('replays to the final hash main recorded: the patch never reaches applyBalancePatch as recorded', () => {
    const replayed = replay(read(RECORDED_STAGE_SWITCH_PATCH));
    expect(replayed.world.balance.absorption.SWALLOW_GATE_TRAITS).toEqual([]);
    expect(replayed.world.players.map((player) => player.absorptions)).toContain(RECORDED_ABSORPTIONS);
    expect(replayed.hash).toBe(RECORDED_FINAL_HASH);
  });

  it.each(UNREPLAYABLE_STAGES)('is refused by name when the patch sets %s', (stage) => {
    expect(() => replay(patchRecordingUnderStage(stage, SWITCH_PATCH_TICK))).toThrow(
      new ReplayStageSwitchError(
        `recorded under the stage switch at "${stage}" (a set_balance patch at tick ${SWITCH_PATCH_TICK}), which the trait switch cannot replay`,
      ),
    );
  });

  it('is refused before the replay starts: a patch stamped after the last tick the replay applies still refuses it', () => {
    const recording = read(RECORDED_STAGE_SWITCH_PATCH);
    const neverApplied = recording.finalTick + 2;
    expect(() => replay(patchRecordingUnderStage(CELL_STAGE.eukaryote, neverApplied))).toThrow(ReplayStageSwitchError);
  });
});
