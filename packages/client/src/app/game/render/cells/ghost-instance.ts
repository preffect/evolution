// A ghost's frame (docs/rendering/cells.md §2.3): the prey's last view at rest, drawn under the film
// with the `absorbed` clip's dissolve (the cytoplasm alpha) and rim dash, no motion, no clips of
// its own, no warning ring. Its organelle sprites stay at their rest slots (no lag, no drift,
// mapped through the rest profile) and fade with the body through the instance alpha (#243), so
// the nucleus sprite, the nucleus disc (the shader's ramp, #231) and the filaments all sit at the
// rest nucleus slot. The disc's anchor comes off the mapped nucleus placement, exactly as the
// living path derives it, so the two cannot separate once a form's `B(Δ)` stops being the circle.

import { REST_DEFORMATION } from './cell-deformation';
import { buildCellInstance } from './cell-instance-builder';
import { cellLodFor } from './cell-lod';
import { nucleusOffsetOf, type CellFrameOutput, type OrganellePlacement } from './cell-render-state';
import { summariseCellTraits } from './cell-traits';
import type { Ghost } from './ghost-cells';
import { mapSlot } from './organelle-mapper';
import { REST_OWN_CELL_RING } from './self-ring';
import { buildShapeTerms, type ShapeTerms } from './shape-terms';
import { witherOf } from './starving-wither';
import { RELATION_RING } from '../../hud/format/relations-for';

const AT_REST = 0;
const NO_STRIP = { stripRow: 0, phase: 0 } as const;
const FULL = 1;

/** Every slot of the ghost at rest, mapped through the rest profile; none below the far threshold. */
function restPlacements(ghost: Ghost, terms: ShapeTerms, isFarDot: boolean): OrganellePlacement[] {
  if (isFarDot) return [];
  return ghost.slots.map((slot) => ({ kind: slot.kind, slot, point: mapSlot(slot.x, slot.y, terms) }));
}

/** `starvedOutMass` keeps a starving prey as withered as it was drawn alive (`starving-wither.ts`). */
export function ghostFrame(ghost: Ghost, zoom: number, starvedOutMass: number): CellFrameOutput {
  const { view } = ghost;
  const traits = summariseCellTraits(view);
  const wither = witherOf(view, starvedOutMass);
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
    wither,
  });
  const lod = cellLodFor(view.radius * zoom);
  const organelles = restPlacements(ghost, terms, lod.isFarDot);
  const instance = buildCellInstance({
    view,
    traits,
    terms,
    lod,
    speedRatio: AT_REST,
    nucleusOffset: nucleusOffsetOf(organelles, view.radius),
    isOwn: false,
    cosmetic: { ...NO_STRIP, speckleSeed: ghost.speckleSeed },
    alpha: ghost.tracks['cytoplasmAlpha'] ?? FULL,
    warningRingPx: 0,
    ciliaPhase: AT_REST,
    rimDash: ghost.tracks['rimDash'] ?? 0,
    ownCellRing: REST_OWN_CELL_RING,
    relationRing: RELATION_RING.none,
    wither,
  });
  return { instance, terms, lod, organelles, traits };
}
