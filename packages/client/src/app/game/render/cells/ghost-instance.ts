// A ghost's instance row (docs/RENDERING.md §2.3): the prey's last view at rest, drawn under the
// film with the `absorbed` clip's dissolve (the cytoplasm alpha) and rim dash, no motion, no
// clips of its own, no warning ring.

import { REST_DEFORMATION } from './cell-deformation';
import { buildCellInstance } from './cell-instance-builder';
import type { CellInstance } from './cell-instance';
import { cellLodFor } from './cell-lod';
import { summariseCellTraits } from './cell-traits';
import type { Ghost } from './ghost-cells';
import { buildShapeTerms } from './shape-terms';

const AT_REST = 0;
const ORIGIN = { x: 0, y: 0 } as const;
const NO_STRIP = { stripRow: 0, phase: 0 } as const;
const FULL = 1;

export function ghostInstance(ghost: Ghost, zoom: number): CellInstance {
  const { view } = ghost;
  const traits = summariseCellTraits(view);
  const terms = buildShapeTerms({
    view: { ...view, sprintRemainingTicks: 0 },
    traits,
    timeSeconds: AT_REST,
    speedRatio: AT_REST,
    heading: AT_REST,
    phase: NO_STRIP.phase,
    stripRow: NO_STRIP.stripRow,
    strip: null,
    deformation: REST_DEFORMATION,
  });
  return buildCellInstance({
    view,
    traits,
    terms,
    lod: cellLodFor(view.radius * zoom),
    speedRatio: AT_REST,
    nucleusOffset: ORIGIN,
    isOwn: false,
    cosmetic: NO_STRIP,
    alpha: ghost.tracks['cytoplasmAlpha'] ?? FULL,
    warningRingPx: 0,
    ciliaPhase: AT_REST,
    rimDash: ghost.tracks['rimDash'] ?? 0,
  });
}
