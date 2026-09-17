// A preview scene (docs/architecture/encyclopedia.md §12.7): a pure function from the preview's local tick to the
// bodies on screen, replacing the store a room's session reads. A scene owns where the camera parks and how wide
// the lens looks; it never knows the lens is round, and it never reads a clock — the session hands it the tick.
//
// Every scene **loops** on its own period. The session's local time is monotonic and never wraps (the clip
// tracker, the ghost registry and the sprint-ring tracker key on `nowMs`, and a backwards jump would strand their
// clips), so a loop is taken modulo the period here and each loop's effects are emitted at their absolute ticks.
// `frameAt` looks back at most one period, so a tab hidden for minutes emits one loop's effects on its return
// instead of hundreds at one `nowMs`.

import {
  TICK_INTERVAL_S,
  ZONE_ID,
  type BalanceConfig,
  type CameraTarget,
  type CellView,
  type DnaFragmentView,
  type FoodMoteView,
  type GameEffect,
  type PlayerId,
} from '@evolution/shared';
import { PREVIEW_SCENE, type PreviewSpec } from './preview-spec';
import { cellPreviewScene } from './scenes/cell-scene';
import { dnaFragmentPreviewScene, foodPreviewScene } from './scenes/food-scene';
import { zonePreviewScene } from './scenes/zone-scene';

/** The bodies a scene puts on screen at one tick; `preview-frame.ts` wraps them into a `RenderFrame`. */
export interface PreviewSceneContent {
  readonly cells: readonly CellView[];
  readonly motes: readonly FoodMoteView[];
  readonly fragments: readonly DnaFragmentView[];
}

export interface PreviewSceneFrame extends PreviewSceneContent {
  /** The effects whose tick lies in `(previousTick, tick]`: the clip tracker starts each of them once. */
  readonly effects: readonly GameEffect[];
}

/** Where the camera parks and how much world the lens's radius covers. */
export interface PreviewFraming {
  readonly target: CameraTarget;
  /**
   * The world radius the lens's radius spans (wu). The session turns it into the fixed `zoom` px per wu for the
   * canvas it actually has — `zoom = (canvasSidePx / 2) / viewRadiusWu` — so a `--ui-scale` resize reframes
   * nothing. A scene authored at a px-per-wu zoom instead would shrink its subject on a smaller lens.
   */
  readonly viewRadiusWu: number;
}

export interface PreviewScene {
  /**
   * Read every frame, so a `balance_updated` reframes a scene whose subject's size the patch changed (a growth
   * curve moves `radiusForMass`, and the lens is authored in the subject's radii).
   */
  framing(balance: BalanceConfig): PreviewFraming;
  /**
   * The cell the camera follows as `ownPlayerId` (the sprint ring, the warning ring), or `null`. Every scene in
   * ticket #363 is `null`: the camera holds on `framing.target` (`stepCamera` holds without a target) and the
   * subject moves inside the lens, which is what the framing bands are measured against.
   */
  readonly subjectPlayerId: PlayerId | null;
  /** One loop of this scene, in ticks; balance-driven where the pacing is the simulation's. */
  periodTicks(balance: BalanceConfig): number;
  /** Monotonic `tick`; the scene loops internally on its period. */
  frameAt(tick: number, previousTick: number, balance: BalanceConfig): PreviewSceneFrame;
}

/** One effect of a scene's loop, at its tick inside `(0, periodTicks]` — an effect at tick 0 is never emitted. */
export interface ScheduledPreviewEffect {
  readonly atLoopTick: number;
  readonly effect: GameEffect;
}

/** What a scene file supplies; `previewScene` wraps it with the loop, the clamp and the effect emission. */
export interface PreviewSceneDefinition {
  framing(balance: BalanceConfig): PreviewFraming;
  readonly subjectPlayerId: PlayerId | null;
  /** One loop in seconds. Read from the balance wherever the simulation, not the framing, sets the pace. */
  periodSecondsFor(balance: BalanceConfig): number;
  /** The bodies at `loopSeconds` into one loop. */
  contentAt(loopSeconds: number, balance: BalanceConfig): PreviewSceneContent;
  /** This loop's effects at their loop ticks; a scene with none supplies nothing. */
  schedule?(balance: BalanceConfig): readonly ScheduledPreviewEffect[];
}

const NO_SCHEDULE: readonly ScheduledPreviewEffect[] = [];
const NO_EFFECTS: readonly GameEffect[] = [];

/**
 * Every scheduled effect whose absolute tick lies in `(fromTick, toTick]`, oldest first, across as many loops as
 * that span covers. Bounding the result to one loop's worth is the caller's clamp on `fromTick`, not this.
 */
export function previewLoopEffects(
  schedule: readonly ScheduledPreviewEffect[],
  fromTick: number,
  toTick: number,
  periodTicks: number,
): readonly GameEffect[] {
  if (schedule.length === 0) return NO_EFFECTS;
  const emitted: GameEffect[] = [];
  const firstLoop = Math.floor(fromTick / periodTicks);
  const lastLoop = Math.floor(toTick / periodTicks);
  for (let loop = firstLoop; loop <= lastLoop; loop += 1) {
    for (const entry of schedule) {
      const tick = loop * periodTicks + entry.atLoopTick;
      if (tick > fromTick && tick <= toTick) emitted.push({ ...entry.effect, tick });
    }
  }
  return emitted.sort((first, second) => first.tick - second.tick);
}

/** Wraps a definition into a scene: the loop, the one-period look-back clamp and the effect emission. */
export function previewScene(definition: PreviewSceneDefinition): PreviewScene {
  const periodTicks = (balance: BalanceConfig): number => definition.periodSecondsFor(balance) / TICK_INTERVAL_S;
  return {
    framing: (balance) => definition.framing(balance),
    subjectPlayerId: definition.subjectPlayerId,
    periodTicks,
    frameAt(tick, previousTick, balance) {
      const period = periodTicks(balance);
      // The one-period clamp: a return from a hidden tab emits one loop's effects, not every loop it slept through.
      const fromTick = Math.max(previousTick, tick - period);
      const loopSeconds = (((tick % period) + period) % period) * TICK_INTERVAL_S;
      return {
        ...definition.contentAt(loopSeconds, balance),
        effects: previewLoopEffects(definition.schedule?.(balance) ?? NO_SCHEDULE, fromTick, tick, period),
      };
    },
  };
}

/** What an unbuilt action family shows until ticket #364 lands: the open broth, with nothing in it. */
const ACTION_SCENE_STAND_IN = { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.openBroth } as const;

/** The families ticket #364 still owes a builder; `previewSceneFor` shows the stand-in for each. */
export const PREVIEW_SCENES_AWAITING_BUILDERS = [
  PREVIEW_SCENE.eat,
  PREVIEW_SCENE.engulf,
  PREVIEW_SCENE.escape,
  PREVIEW_SCENE.sprint,
  PREVIEW_SCENE.levelUp,
] as const;

/**
 * The scene for a spec; the balance is not read here, because a scene reads it per frame (its framing, its period
 * and its content), so a `balance_updated` retimes and reframes the open preview without a rebuild.
 *
 * The five families in `PREVIEW_SCENES_AWAITING_BUILDERS` are ticket #364's and resolve to
 * the stand-in until it lands, so the lens shows the dish rather than nothing; `preview-scene.spec.ts` names
 * exactly those five, so landing a builder for one of them flips that spec.
 */
export function previewSceneFor(spec: PreviewSpec): PreviewScene {
  switch (spec.scene) {
    case PREVIEW_SCENE.cell:
      return cellPreviewScene(spec);
    case PREVIEW_SCENE.food:
      return foodPreviewScene(spec);
    case PREVIEW_SCENE.dnaFragment:
      return dnaFragmentPreviewScene(spec);
    case PREVIEW_SCENE.zone:
      return zonePreviewScene(spec);
    default:
      return zonePreviewScene(ACTION_SCENE_STAND_IN);
  }
}
