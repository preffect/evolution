// The `food` and `dna_fragment` preview scenes (docs/architecture/encyclopedia.md §12.7): a cluster of one food
// kind (and bacterium variant), or fragments of one DNA tag, framed close enough that a single mote's bake reads.
//
// Both clusters are seeded from `PREVIEW_SEED` through the preview fork of the cosmetic stream
// (docs/rendering/cells.md §1), so the same entry draws the same cluster every open and a screenshot is
// reproducible. Only bacteria move in play, and they move here at the balance's `BACTERIUM_DRIFT_SPEED`: each one
// walks a small circle, so the scene closes its loop without anything ever leaving the lens.

import {
  COSMETIC_SUB_STREAM,
  DNA_FRAGMENT_RADIUS,
  FOOD_KIND,
  RADIANS_PER_FULL_TURN,
  RANDOM_STREAM,
  ZONE_ID,
  createSeededRandom,
  entityId,
  type BalanceConfig,
  type DnaFragmentView,
  type FoodMoteView,
  type RandomSource,
} from '@evolution/shared';
import {
  PREVIEW_FOOD_CLUSTER_RADIUS_WU,
  PREVIEW_FOOD_COUNT,
  PREVIEW_FOOD_DRIFT_RADIUS_WU,
  PREVIEW_FOOD_VIEW_RADIUS_WU,
  PREVIEW_FRAGMENT_CLUSTER_RADIUS_WU,
  PREVIEW_FRAGMENT_COUNT,
  PREVIEW_FRAGMENT_VIEW_RADIUS_WU,
  PREVIEW_SEED,
  PREVIEW_STILL_PERIOD_SECONDS,
  PREVIEW_ZONE_CENTRE_WU,
} from '../../constants';
import { previewScene, type PreviewFraming, type PreviewScene } from '../preview-scene';
import { PREVIEW_SCENE, type PreviewSpec } from '../preview-spec';

/** The preview's fork of the cosmetic stream: `cosmetic:preview`, the pattern of docs/rendering/cells.md §1. */
export const PREVIEW_STREAM_LABEL = `${RANDOM_STREAM.cosmetic}:${COSMETIC_SUB_STREAM.preview}`;

/** Food and fragments sit in the open broth, where both actually spawn and neither zone tints them. */
const CLUSTER_CENTRE = PREVIEW_ZONE_CENTRE_WU[ZONE_ID.openBroth];

const NO_CELLS = [] as const;
const NO_MOTES = [] as const;
const NO_FRAGMENTS = [] as const;

type FoodPreviewSpec = Extract<PreviewSpec, { scene: typeof PREVIEW_SCENE.food }>;
type DnaFragmentPreviewSpec = Extract<PreviewSpec, { scene: typeof PREVIEW_SCENE.dnaFragment }>;

interface ClusterPoint {
  readonly x: number;
  readonly y: number;
  /** Where this body starts on its drift circle, in turns. */
  readonly phase: number;
}

/** `count` points spread evenly over the disc of `radiusWu` (√u, so the density is uniform), each with a phase. */
function clusterPoints(count: number, radiusWu: number, random: RandomSource): readonly ClusterPoint[] {
  return Array.from({ length: count }, () => {
    const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
    const distance = Math.sqrt(random.nextFloat()) * radiusWu;
    return {
      x: CLUSTER_CENTRE.x + Math.cos(angle) * distance,
      y: CLUSTER_CENTRE.y + Math.sin(angle) * distance,
      phase: random.nextFloat(),
    };
  });
}

function previewRandom(label: string): RandomSource {
  return createSeededRandom(PREVIEW_SEED).fork(PREVIEW_STREAM_LABEL).fork(label);
}

function framingAt(viewRadiusWu: number, bodyRadiusWu: number): () => PreviewFraming {
  return () => ({ target: { ...CLUSTER_CENTRE, radius: bodyRadiusWu }, viewRadiusWu });
}

/** One trip around a bacterium's drift circle at the balance's drift speed: `2πR / BACTERIUM_DRIFT_SPEED`. */
function driftPeriodSeconds(balance: BalanceConfig): number {
  return (RADIANS_PER_FULL_TURN * PREVIEW_FOOD_DRIFT_RADIUS_WU) / balance.ecology.BACTERIUM_DRIFT_SPEED;
}

export function foodPreviewScene(spec: FoodPreviewSpec): PreviewScene {
  const points = clusterPoints(PREVIEW_FOOD_COUNT, PREVIEW_FOOD_CLUSTER_RADIUS_WU, previewRandom(spec.foodKind));
  // Algae and detritus do not move in play, so their scene only needs a period for the effect look-back.
  const isDrifting = spec.foodKind === FOOD_KIND.bacterium;
  return previewScene({
    subjectPlayerId: null,
    framing: framingAt(PREVIEW_FOOD_VIEW_RADIUS_WU, PREVIEW_FOOD_CLUSTER_RADIUS_WU),
    periodSecondsFor: (balance) => (isDrifting ? driftPeriodSeconds(balance) : PREVIEW_STILL_PERIOD_SECONDS),
    contentAt: (loopSeconds, balance) => ({
      cells: NO_CELLS,
      motes: points.map((point, index) => moteView(spec, point, index, { loopSeconds, balance, isDrifting })),
      fragments: NO_FRAGMENTS,
    }),
  });
}

interface MoteDrift {
  readonly loopSeconds: number;
  readonly balance: BalanceConfig;
  /** Only bacteria move in play; the other kinds hold their seeded places at every tick of the loop. */
  readonly isDrifting: boolean;
}

function moteView(spec: FoodPreviewSpec, point: ClusterPoint, index: number, motion: MoteDrift): FoodMoteView {
  const { loopSeconds, balance, isDrifting } = motion;
  const angle = RADIANS_PER_FULL_TURN * (point.phase + loopSeconds / driftPeriodSeconds(balance));
  const drift = isDrifting ? PREVIEW_FOOD_DRIFT_RADIUS_WU : 0;
  return {
    id: entityId(`preview-mote-${index}`),
    kind: spec.foodKind,
    bacteriumVariant: spec.bacteriumVariant,
    x: point.x + Math.cos(angle) * drift,
    y: point.y + Math.sin(angle) * drift,
  };
}

export function dnaFragmentPreviewScene(spec: DnaFragmentPreviewSpec): PreviewScene {
  const points = clusterPoints(PREVIEW_FRAGMENT_COUNT, PREVIEW_FRAGMENT_CLUSTER_RADIUS_WU, previewRandom(spec.tag));
  // Fragments hold their places; the renderer spins each helix off `timeSeconds`, which never stops.
  const fragments: readonly DnaFragmentView[] = points.map((point, index) => ({
    id: entityId(`preview-fragment-${index}`),
    x: point.x,
    y: point.y,
    tag: spec.tag,
  }));
  return previewScene({
    subjectPlayerId: null,
    framing: framingAt(PREVIEW_FRAGMENT_VIEW_RADIUS_WU, DNA_FRAGMENT_RADIUS),
    periodSecondsFor: () => PREVIEW_STILL_PERIOD_SECONDS,
    contentAt: () => ({ cells: NO_CELLS, motes: NO_MOTES, fragments }),
  });
}
