// The cell profile walks the reach-bound specs share (`cell-draw-extent*.spec.ts`, #192): a unit-radius cell view of
// some traits at some speed, the shape terms the renderer builds for it at a moment, and the membrane it actually
// draws there, walked round the ring — measured on the profile itself, never on a bound of it.

import {
  DEFAULT_BALANCE,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  createSeededRandom,
  stageOf,
  type CellView,
  type OwnedTrait,
} from '@evolution/shared';
import { REST_DEFORMATION } from '../app/game/render/cells/cell-deformation';
import { summariseCellTraits } from '../app/game/render/cells/cell-traits';
import { sampleProfileRing } from '../app/game/render/cells/radial-profile';
import { buildShapeTerms, type ShapeTerms } from '../app/game/render/cells/shape-terms';
import { PREVIEW_SEED } from '../app/game/render/constants';
import { buildNoiseStrip } from '../app/game/render/noise/noise-strip';
import { createTestCellView } from './builders';

export const PROFILE_WALK_STRIP = buildNoiseStrip(createSeededRandom(PREVIEW_SEED).fork(RANDOM_STREAM.cosmetic));

/** Any row: `cell-draw-extent.spec.ts` pins that the reach does not depend on which one a cell rolled. */
export const PROFILE_WALK_STRIP_ROW = 0;
/** One breathing period is under a second, so a few seconds sweep every phase of every term. */
export const PROFILE_WALK_TICKS = Math.ceil(4 / TICK_INTERVAL_S);
/** Every second degree and every fifth tick: still several periods of every term, at a fraction of the cost. */
export const PROFILE_WALK_RING_SAMPLES = 180;
export const PROFILE_WALK_TICK_STRIDE = 5;
/** The walks take about a second alone, and past vitest's 5 s default on a shared machine under load. */
export const PROFILE_WALK_TIMEOUT_MS = 30_000;

/** A unit radius, so every reach the specs compare is already in radii; the velocity only sets the heading. */
export function profileWalkView(traits: readonly OwnedTrait[], speedRatio: number, isSprinting: boolean): CellView {
  return createTestCellView({
    radius: 1,
    velocityX: speedRatio * 100,
    velocityY: 0,
    sprintRemainingTicks: isSprinting ? 1 : 0,
    traits: traits.map((owned) => ({ ...owned })),
    stage: stageOf(
      traits.map((owned) => owned.traitId),
      DEFAULT_BALANCE.ladder,
    ),
  });
}

/** The shape terms the renderer builds at `timeSeconds`, heading 0, phase 0, nothing deforming it. */
export function profileWalkTerms(
  view: CellView,
  timeSeconds: number,
  speedRatio: number,
  stripRow = PROFILE_WALK_STRIP_ROW,
): ShapeTerms {
  return buildShapeTerms({
    view,
    traits: summariseCellTraits(view),
    timeSeconds,
    speedRatio,
    heading: 0,
    phase: 0,
    stripRow,
    strip: PROFILE_WALK_STRIP,
    deformation: REST_DEFORMATION,
  });
}

/** The membrane drawn at `timeSeconds` at its widest round the ring, and the quad's reach without the halo. */
export function drawnMembraneAt(
  view: CellView,
  timeSeconds: number,
  speedRatio: number,
): { readonly widest: number; readonly quadMembrane: number } {
  const terms = profileWalkTerms(view, timeSeconds, speedRatio);
  const widest = Math.max(...sampleProfileRing(terms, PROFILE_WALK_RING_SAMPLES));
  return { widest, quadMembrane: terms.maxRadii / terms.haloOuterRadii };
}
