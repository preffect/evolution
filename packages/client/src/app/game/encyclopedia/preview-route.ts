// The dev-only preview evidence route (docs/architecture/encyclopedia.md §12.7):
// `?preview=<EntryAnchor>&t=<seconds>&opens=<n>`, for graphics-qa screenshots, the Playwright smoke and the
// hardware run the lead files when this lands. It is the one module allowed to join an entry id to its render
// spec — `render/` never imports from `encyclopedia/` — and the one place the preview installs the debug hook
// and asks for `preserveDrawingBuffer`.
//
// **It walks the clock.** Clips and effect sprites start at the frame's `nowMs`, not the effect's tick, so a page
// loaded at `t` is not the frame a live preview shows at `t` unless the ticks in between have been through the
// renderer. The route walks from the loop's start to `t` in `TICK_INTERVAL_S` steps with a **no-op submit** (the
// clips and registries advance, nothing is drawn) and submits only the parked frame. A 3 s loop is 180 frames:
// submitting each would be about 27 minutes of SwiftShader in the container.

import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject, isDevMode } from '@angular/core';
import { BACTERIUM_VARIANT, CELL_KIND, DNA_TAG, FOOD_KIND, ZONE_ID } from '@evolution/shared';
import type { ClientPerformanceReport } from '@evolution/shared';
import type { PreviewOpenTimings } from '../render/preview/preview-timings';
import { PREVIEW_BUDGETS, type PreviewBudgetVerdict } from '../render/preview/preview-timings';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewScene, type PreviewSpec } from '../render/preview/preview-spec';
import { positiveParameter } from '../route-query';
import { entryById } from './registry';
import { splitEntryReference, type EntryId } from './model/entry-id';

const PREVIEW_PARAMETER = 'preview';
const TIME_PARAMETER = 't';
const OPENS_PARAMETER = 'opens';

/** What a `?preview=` with no entry falls back to: a scene every build has, whatever content has landed. */
export const PREVIEW_ROUTE_FALLBACK_SPEC: PreviewSpec = { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.openBroth };

/** The default park: far enough into a loop that a scene's motion has moved, short enough to walk quickly. */
export const PREVIEW_ROUTE_DEFAULT_SECONDS = 1;
/** One open unless `opens=` asks for the measurement loop. */
export const PREVIEW_ROUTE_DEFAULT_OPENS = 1;

export interface PreviewQuery {
  /** The entry anchor asked for, verbatim; `null` when `?preview` carried no value. */
  readonly anchor: string | null;
  /** Seconds into the scene's loop the frame is parked at. */
  readonly parkAtSeconds: number;
  /** Open-and-close cycles run in this one page: the measurement window and the context-leak loop. */
  readonly opens: number;
}

export function parsePreviewQuery(search: string): PreviewQuery {
  const parameters = new URLSearchParams(search);
  const anchor = parameters.get(PREVIEW_PARAMETER);
  return {
    anchor: anchor === null || anchor === '' ? null : anchor,
    parkAtSeconds: positiveParameter(parameters, TIME_PARAMETER, PREVIEW_ROUTE_DEFAULT_SECONDS),
    opens: Math.max(1, Math.trunc(positiveParameter(parameters, OPENS_PARAMETER, PREVIEW_ROUTE_DEFAULT_OPENS))),
  };
}

export function isPreviewRoute(search: string): boolean {
  return new URLSearchParams(search).has(PREVIEW_PARAMETER);
}

/** The gate itself: both halves, so a spec can pin the production one without a production build. */
export function isPreviewRouteEnabled(isDevelopmentBuild: boolean, search: string | null): boolean {
  return isDevelopmentBuild && search !== null && isPreviewRoute(search);
}

export const IS_PREVIEW_ROUTE = new InjectionToken<boolean>('IsPreviewRoute', {
  providedIn: 'root',
  factory: () => isPreviewRouteEnabled(isDevMode(), inject(DOCUMENT).defaultView?.location.search ?? null),
});

/**
 * A default spec per scene family, so `?preview=<scene>` reaches a family the registry has no entry for yet — the
 * whole point of an evidence route is not to wait on content.
 */
export const PREVIEW_ROUTE_SCENE_SPECS: Readonly<Record<PreviewScene, PreviewSpec>> = {
  [PREVIEW_SCENE.cell]: {
    scene: PREVIEW_SCENE.cell,
    cellKind: CELL_KIND.player,
    traits: [],
    motion: PREVIEW_MOTION.swimming,
  },
  [PREVIEW_SCENE.food]: {
    scene: PREVIEW_SCENE.food,
    foodKind: FOOD_KIND.bacterium,
    bacteriumVariant: BACTERIUM_VARIANT.aerobic,
  },
  [PREVIEW_SCENE.dnaFragment]: { scene: PREVIEW_SCENE.dnaFragment, tag: DNA_TAG.motile },
  [PREVIEW_SCENE.zone]: PREVIEW_ROUTE_FALLBACK_SPEC,
  [PREVIEW_SCENE.eat]: { scene: PREVIEW_SCENE.eat },
  [PREVIEW_SCENE.engulf]: { scene: PREVIEW_SCENE.engulf },
  [PREVIEW_SCENE.escape]: { scene: PREVIEW_SCENE.escape },
  [PREVIEW_SCENE.sprint]: { scene: PREVIEW_SCENE.sprint },
  [PREVIEW_SCENE.levelUp]: { scene: PREVIEW_SCENE.levelUp },
};

function sceneSpecNamed(anchor: string): PreviewSpec | null {
  return (PREVIEW_ROUTE_SCENE_SPECS as Record<string, PreviewSpec | undefined>)[anchor] ?? null;
}

/**
 * The spec an anchor shows: a bare `PREVIEW_SCENE` name first, then the anchored section's own preview where it
 * re-points one (a trait's tier tabs), then the entry's, and the fallback where the anchor names neither.
 */
export function previewSpecForAnchor(anchor: string | null): PreviewSpec {
  if (anchor === null) return PREVIEW_ROUTE_FALLBACK_SPEC;
  const named = sceneSpecNamed(anchor);
  if (named !== null) return named;
  const { entryId, sectionKey } = splitEntryReference(anchor);
  let definition;
  try {
    definition = entryById(entryId as EntryId);
  } catch {
    return PREVIEW_ROUTE_FALLBACK_SPEC;
  }
  const section = sectionKey === null ? undefined : definition.sections.find((one) => one.key === sectionKey);
  return section?.preview ?? definition.preview ?? PREVIEW_ROUTE_FALLBACK_SPEC;
}

/** Why the route could not produce a report; written into the same element so a failure is never silence. */
export interface PreviewRouteFailure {
  readonly error: string;
}

export const PREVIEW_ROUTE_FAILURE = {
  noOpenCompleted: 'no open completed: createPixiApp never resolved, or destroy ran first',
  noFrameDrawn: 'no frame drawn: the parked session produced no performance report',
} as const;

export interface PreviewRouteReport {
  readonly anchor: string | null;
  readonly scene: PreviewSpec['scene'];
  readonly parkAtSeconds: number;
  readonly walkFrames: number;
  readonly opens: number;
  /** The first open in the page: a cold context, cold shader compiles. Reported apart, never in the p95. */
  readonly coldOpen: PreviewOpenTimings;
  /** Every open after the cold one, in order; empty when `opens=1`. */
  readonly warmOpens: readonly PreviewOpenTimings[];
  /** The p95 of `openedToFirstFrameMs` over `warmOpens`; `null` when there are none. */
  readonly openP95Ms: number | null;
  /** The parked session's own frame report. */
  readonly frame: ClientPerformanceReport;
  readonly budgets: typeof PREVIEW_BUDGETS;
  /**
   * Whether each measured number is inside its budget, or `null` where nothing could be judged. **Never judged in
   * the container:** its browser is SwiftShader, so the smoke reads this report's *shape* and a hardware run reads
   * its numbers (docs/rendering/budget.md §7).
   */
  readonly verdict: PreviewBudgetVerdict;
}
