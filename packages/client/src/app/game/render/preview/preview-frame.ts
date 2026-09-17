// A scene frame as the renderer takes it (docs/architecture/encyclopedia.md §12.7): the `RenderFrame` a room's
// `WorldStore` would have produced, built here instead from a scene and the live balance. Production code never
// imports `testing/`, so the fixture `GameSnapshot` the frame carries is built here.
//
// The two derivations that keep a preview honest live here, so no scene can invent either: a cell's `radius` is
// `radiusForMass` over the live balance, and its `stage` is `stageOf` over its owned traits, so a trait preview's
// silhouette is exactly the ladder's.

import {
  MILLISECONDS_PER_SECOND,
  ROUND_DURATION_SECONDS,
  ROUND_PHASE,
  TICK_INTERVAL_S,
  WORLD_ORGANISM_ID,
  entityId,
  radiusForMass,
  stageOf,
  type BalanceConfig,
  type CellKind,
  type CellState,
  type CellView,
  type EntityId,
  type OwnedTrait,
  type PlayerId,
} from '@evolution/shared';
import { CELL_STATE } from '@evolution/shared';
import type { RenderFrame } from '../../net/world-store';
import { PREVIEW_GEL_PATCHES, PREVIEW_SEED } from '../constants';
import type { PreviewSceneFrame } from './preview-scene';

/** What a scene says about one cell; `radius` and `stage` are derived here, never supplied. */
export interface PreviewCellSpec {
  readonly id: string;
  readonly kind: CellKind;
  /** `null` for a wild cell; the preview's subject id for a player one. */
  readonly playerId: PlayerId | null;
  readonly avatarIndex: number;
  readonly mass: number;
  readonly traits: readonly OwnedTrait[];
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly states?: readonly CellState[];
  readonly engulfProgress?: number;
  readonly engulfingCellId?: string | null;
  readonly engulfedByCellId?: string | null;
  readonly sprintRemainingTicks?: number;
  readonly sprintCooldownRemainingTicks?: number;
}

const FREE: readonly CellState[] = [CELL_STATE.free];
const NO_ENGULF_PROGRESS = 0;
const NO_SPRINT_TICKS = 0;
/** The membrane bonus a trait grants is already in the ladder's silhouette; a preview adds none of its own. */
const NO_MEMBRANE_RATIO_BONUS = 0;

function optionalEntityId(id: string | null | undefined): EntityId | null {
  return id === undefined || id === null ? null : entityId(id);
}

/** The `CellView` a scene's cell spec becomes, with `radius` and `stage` derived from the live balance. */
export function previewCellView(spec: PreviewCellSpec, balance: BalanceConfig): CellView {
  return {
    id: entityId(spec.id),
    kind: spec.kind,
    playerId: spec.playerId,
    organismId: spec.playerId === null ? WORLD_ORGANISM_ID : entityId(spec.id),
    avatarIndex: spec.avatarIndex,
    x: spec.x,
    y: spec.y,
    velocityX: spec.velocityX,
    velocityY: spec.velocityY,
    mass: spec.mass,
    radius: radiusForMass(spec.mass, balance.growth),
    // The own-cell indicators are the only thing that draws a level, and they stand down in a preview
    // (`NO_HUD_INPUTS`), so this is the owned-trait count and nothing on the lens reads it.
    level: spec.traits.length,
    stage: stageOf(
      spec.traits.map((owned) => owned.traitId),
      balance.ladder,
    ),
    traits: spec.traits.map((owned) => ({ ...owned })),
    membraneRatioBonus: NO_MEMBRANE_RATIO_BONUS,
    states: [...(spec.states ?? FREE)],
    engulfProgress: spec.engulfProgress ?? NO_ENGULF_PROGRESS,
    engulfingCellId: optionalEntityId(spec.engulfingCellId),
    engulfedByCellId: optionalEntityId(spec.engulfedByCellId),
    sprintRemainingTicks: spec.sprintRemainingTicks ?? NO_SPRINT_TICKS,
    sprintCooldownRemainingTicks: spec.sprintCooldownRemainingTicks ?? NO_SPRINT_TICKS,
  };
}

export interface PreviewFrameInput {
  readonly tick: number;
  readonly scene: PreviewSceneFrame;
  readonly balance: BalanceConfig;
}

/**
 * The scene frame as a `RenderFrame`. `renderTick` is the preview's monotonic local tick and `timeSeconds` is
 * `renderTick × TICK_INTERVAL_S`, the only time the renderer sees (docs/rendering/cells.md §1); `latest` is the
 * fixture snapshot everything that is not interpolated (the round, the roster, the leaderboard) reads.
 */
export function previewRenderFrame(input: PreviewFrameInput): RenderFrame {
  const { tick, scene, balance } = input;
  return {
    renderTick: tick,
    timeSeconds: tick * TICK_INTERVAL_S,
    cells: scene.cells,
    motes: scene.motes,
    fragments: scene.fragments,
    effects: scene.effects,
    latest: {
      tick: Math.floor(tick),
      seed: PREVIEW_SEED,
      roundStartTick: 0,
      roundPhase: ROUND_PHASE.playing,
      roundTimeLeftMs: ROUND_DURATION_SECONDS * MILLISECONDS_PER_SECOND,
      gelPatches: PREVIEW_GEL_PATCHES.map((patch) => ({ ...patch })),
      cells: [...scene.cells],
      dnaFragments: [...scene.fragments],
      food: { spawned: [], removedIds: [], moved: [] },
      players: {},
      ownProgress: null,
      leaderboard: [],
      appliedInputSequenceByPlayer: {},
      effects: [...scene.effects],
    },
    balance,
  };
}
