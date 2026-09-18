// The `zone` preview scene (docs/architecture/encyclopedia.md §12.7): the camera parked inside one zone of the
// dish, with nothing in front of it. The whole picture is the dish layer's own bake — the field's zone tints and
// clouds, the mire strands, the vent crust and risers, the wall — so the entry shows the water the player reads
// the zone by, not a diagram of it.
//
// Each zone's parking point is a `render/constants/preview.ts` constant that `simulation/zones.ts` agrees is in
// that zone (`preview-scene.spec.ts` runs `zoneAt` over every one of them), and the `viscous_gel` point is the
// centre of the one fixture gel patch the preview's texture bundle is baked with.

import { type ZoneId } from '@evolution/shared';
import { PREVIEW_STILL_PERIOD_SECONDS, PREVIEW_ZONE_CENTRE_WU, PREVIEW_ZONE_VIEW_RADIUS_WU } from '../../constants';
import { previewScene, type PreviewScene, type PreviewSceneContent } from '../preview-scene';
import { PREVIEW_SCENE, type PreviewSpec } from '../preview-spec';

type ZonePreviewSpec = Extract<PreviewSpec, { scene: typeof PREVIEW_SCENE.zone }>;

/** A zone scene draws no bodies at all: the dish is the subject. */
const EMPTY_CONTENT: PreviewSceneContent = { cells: [], motes: [], fragments: [] };

export function zonePreviewScene(spec: { readonly zone: ZoneId } & Pick<ZonePreviewSpec, 'scene'>): PreviewScene {
  const centre = PREVIEW_ZONE_CENTRE_WU[spec.zone];
  return previewScene({
    subjectPlayerId: null,
    framing: () => ({
      target: { ...centre, radius: PREVIEW_ZONE_VIEW_RADIUS_WU },
      viewRadiusWu: PREVIEW_ZONE_VIEW_RADIUS_WU,
    }),
    periodSecondsFor: () => PREVIEW_STILL_PERIOD_SECONDS,
    contentAt: () => EMPTY_CONTENT,
  });
}
