// Client test builders (docs/TESTING.md §4): the views the state layer reads, with defaults so a
// test names only what it asserts on. Builder defaults are the only tolerated inline numbers.

import {
  AUDIO_MANIFEST_VERSION,
  CELL_KIND,
  CELL_STAGE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENTITY_KIND,
  ROUND_DURATION_SECONDS,
  SOUND_EVENT,
  FOOD_KIND,
  SOUND_EVENT_IDS,
  STAGE_ORDER,
  ZONE_ID,
  createTestSnapshot,
  entityId,
  playerId,
  soundEventRule,
  type CellView,
  type EatEffect,
  type CellAbsorbedEffect,
  type FoodMoteView,
  type LevelUpEffect,
  type RespawnEffect,
} from '@evolution/shared';
import type { RenderFrame } from '../app/game/net/world-store';
import type { GhostSource } from '../app/game/render/cells/ghost-cells';

/** An algae mote at the origin; a layer or store test names only what it changes. */
export function createTestFoodMoteView(overrides: Partial<FoodMoteView> = {}): FoodMoteView {
  return { id: entityId('mote'), kind: FOOD_KIND.algae, bacteriumVariant: null, x: 0, y: 0, ...overrides };
}
import type { TransitionOptions } from '../app/game/state/snapshot-transitions';

export const TEST_OWN_PLAYER_ID = playerId('player-own');
export const TEST_OTHER_PLAYER_ID = playerId('player-other');
export const TEST_OWN_CELL_ID = entityId('c-1');
export const TEST_OTHER_CELL_ID = entityId('c-2');

const DEFAULT_MASS = 20;
const DEFAULT_RADIUS = 4;

export function createTestCellView(overrides: Partial<CellView> = {}): CellView {
  return {
    id: TEST_OWN_CELL_ID,
    kind: CELL_KIND.player,
    playerId: TEST_OWN_PLAYER_ID,
    organismId: TEST_OWN_CELL_ID,
    avatarIndex: 0,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    mass: DEFAULT_MASS,
    radius: DEFAULT_RADIUS,
    level: 1,
    stage: CELL_STAGE.protocell,
    traits: [],
    membraneRatioBonus: 0,
    states: [],
    engulfProgress: 0,
    engulfingCellId: null,
    engulfedByCellId: null,
    sprintRemainingTicks: 0,
    sprintCooldownRemainingTicks: 0,
    ...overrides,
  };
}

/** A render frame at tick 0 holding `cells`, so a layer test names only the cells it places. */
export function createTestRenderFrame(overrides: Partial<RenderFrame> = {}): RenderFrame {
  const cells = overrides.cells ?? [createTestCellView()];
  return {
    renderTick: 0,
    timeSeconds: 0,
    cells,
    motes: [],
    fragments: [],
    effects: [],
    latest: createTestSnapshot({ cells: [...cells] }),
    balance: DEFAULT_BALANCE,
    ...overrides,
  };
}

export function createTestTransitionOptions(overrides: Partial<TransitionOptions> = {}): TransitionOptions {
  return {
    ownPlayerId: TEST_OWN_PLAYER_ID,
    balance: DEFAULT_BALANCE,
    roundDurationSeconds: ROUND_DURATION_SECONDS,
    ...overrides,
  };
}

export function createTestEatEffect(overrides: Partial<EatEffect> = {}): EatEffect {
  return {
    kind: EFFECT_KIND.eat,
    tick: 0,
    x: 0,
    y: 0,
    cellId: TEST_OWN_CELL_ID,
    eatenId: entityId('m-1'),
    eatenKind: ENTITY_KIND.foodMote,
    ...overrides,
  };
}

export function createTestLevelUpEffect(overrides: Partial<LevelUpEffect> = {}): LevelUpEffect {
  return {
    kind: EFFECT_KIND.levelUp,
    tick: 0,
    x: 0,
    y: 0,
    cellId: TEST_OWN_CELL_ID,
    playerId: TEST_OWN_PLAYER_ID,
    level: 2,
    ...overrides,
  };
}

/** What a ghost is built from (render/cells/ghost-cells.ts): a bare view, no slots, seed 0 unless named. */
export function createTestGhostSource(overrides: Partial<GhostSource> = {}): GhostSource {
  return { view: createTestCellView(), slots: [], speckleSeed: 0, ...overrides };
}

export function createTestCellAbsorbedEffect(overrides: Partial<CellAbsorbedEffect> = {}): CellAbsorbedEffect {
  return {
    kind: EFFECT_KIND.cellAbsorbed,
    tick: 0,
    x: 0,
    y: 0,
    cellId: TEST_OTHER_CELL_ID,
    playerId: TEST_OTHER_PLAYER_ID,
    predatorCellId: TEST_OWN_CELL_ID,
    ...overrides,
  };
}

export function createTestRespawnEffect(overrides: Partial<RespawnEffect> = {}): RespawnEffect {
  return {
    kind: EFFECT_KIND.respawn,
    tick: 0,
    x: 0,
    y: 0,
    cellId: TEST_OWN_CELL_ID,
    playerId: TEST_OWN_PLAYER_ID,
    ...overrides,
  };
}

/** A valid manifest naming one file per event, plus the stage stems, the motif instruments, the eat notes and the zone overlays. */
export function createTestAudioManifest(): { version: number; events: Record<string, unknown> } {
  const events: Record<string, unknown> = {};
  for (const id of SOUND_EVENT_IDS) {
    events[id] = {
      mood: 'wet, soft',
      lengthSeconds: 1,
      isLoop: soundEventRule(id).isLoop,
      promptHint: `prompt for ${id}`,
      files: [{ key: 'default', path: `${id}.mp3` }],
    };
  }
  const withFiles = (id: string, keys: readonly string[]) => {
    (events[id] as { files: unknown[] }).files = keys.map((key) => ({ key, path: `${id}-${key}.mp3` }));
  };
  withFiles(SOUND_EVENT.ambientBed, STAGE_ORDER);
  withFiles(SOUND_EVENT.levelUp, ['instrument-0', 'instrument-1', 'instrument-2', 'instrument-3', 'instrument-4']);
  withFiles(SOUND_EVENT.eat, ['note-1', 'note-2', 'note-3']);
  withFiles(SOUND_EVENT.zoneLayer, [ZONE_ID.sunlitShallows, ZONE_ID.warmVent, ZONE_ID.viscousGel]);
  return { version: AUDIO_MANIFEST_VERSION, events };
}

/** Every file name the test manifest refers to. */
export function testManifestFileNames(): Set<string> {
  const manifest = createTestAudioManifest();
  const names = new Set<string>();
  for (const entry of Object.values(manifest.events) as { files: { path: string }[] }[]) {
    for (const file of entry.files) names.add(file.path);
  }
  return names;
}
