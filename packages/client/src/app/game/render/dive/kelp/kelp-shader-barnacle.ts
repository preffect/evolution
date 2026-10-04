// Single barnacles on the focal rock (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `closeBarnacles` and
// `barnacle`): on the world-stable grid the mockup scatters them on, each found from the pixel's own cell and its
// neighbours, drawn in the mockup's order (by column, then row): its shadow, a shell of six plates on a lit gradient,
// the plates' ribs, the dark opening and its lit lip. GLSL ES 3.00; the rock shader clips them to the stone.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  KELP_BARNACLE_LOOK,
  KELP_BARNACLE_MIN_PX,
  KELP_CLOSE_BARNACLES,
  KELP_GRID_SALT,
  KELP_TURN,
} from '../../constants/dive-kelp';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { glslFloat } from '../../cells/cell-shader-source';
import { HALF } from '../../geometry';
import { KELP_COMMON_UNIFORM, glslHex, glslRgb } from './kelp-shader-common';

const LOOK = KELP_BARNACLE_LOOK;
const GRID = KELP_CLOSE_BARNACLES;
const float = glslFloat;
/** How far a barnacle paints, in its radii: its shadow's offset and radius, or its shell's widest corner. */
const REACH_RADII = Math.max(
  Math.hypot(LOOK.shadow.x, LOOK.shadow.y) + Math.max(LOOK.shadow.radiusX, LOOK.shadow.radiusY),
  LOOK.shell.base + LOOK.shell.wobble,
);
/** How far the largest barnacle paints from its centre, in metres. */
const REACH_M = (GRID.radiusM.min + GRID.radiusM.span) * REACH_RADII;
/** The shell's corners: one per plate and one more where the mockup's loop closes back near the first. */
const SHELL_CORNERS = LOOK.shell.plates + 1;

/** One barnacle in its own unit (its radius 1), over `colour`; `unitPx` device px a unit, `roll` its turn. */
export const KELP_BARNACLE_SOURCE = /* glsl */ `
vec2 shellCorner(int corner, float roll) {
  float angle = float(corner) / ${float(LOOK.shell.plates)} * ${float(KELP_TURN)} + roll * ${float(LOOK.turn)};
  float reach = ${float(LOOK.shell.base)} + ${float(LOOK.shell.wobble)} * cos(float(corner) * ${float(LOOK.shellWobble.perPlate)} + roll * ${float(LOOK.shellWobble.perTurn)});
  return vec2(cos(angle), sin(angle)) * reach;
}

/** The shell's coverage: its corners joined straight, filled by the nonzero rule, antialiased on its nearest edge. */
float shellCover(vec2 point, float roll, float unitPx) {
  float nearest = 1e9;
  int winding = 0;
  for (int corner = 0; corner < ${SHELL_CORNERS}; corner++) {
    vec2 from = shellCorner(corner, roll);
    vec2 to = shellCorner((corner + 1) % ${SHELL_CORNERS}, roll);
    nearest = min(nearest, segmentDistance(point, from, to));
    if ((from.y <= point.y) != (to.y <= point.y)) {
      float crossX = from.x + (point.y - from.y) / (to.y - from.y) * (to.x - from.x);
      if (crossX > point.x) winding += to.y > from.y ? 1 : -1;
    }
  }
  return clamp((winding != 0 ? nearest : -nearest) * unitPx + 0.5, 0.0, 1.0);
}

vec4 barnacle(vec4 colour, vec2 point, float unitPx, float roll) {
  vec2 shadowRadii = vec2(${float(LOOK.shadow.radiusX)}, ${float(LOOK.shadow.radiusY)});
  float shadowLevel = length((point - vec2(${float(LOOK.shadow.x)}, ${float(LOOK.shadow.y)})) / shadowRadii);
  colour = over(colour, paint(${glslRgb(LOOK.shadow.colour)}, ${float(LOOK.shadow.alpha)} * clamp((1.0 - shadowLevel) * unitPx + 0.5, 0.0, 1.0)));
  float t = conicT(point, vec3(${float(LOOK.shell.lightX)}, ${float(LOOK.shell.lightY)}, ${float(LOOK.shell.inner)}), vec3(0.0, 0.0, 1.0));
  vec4 shell = stops3(vec4(${glslHex(SHORE_PALETTE.barnacleLight)}, 1.0), vec4(${glslHex(SHORE_PALETTE.barnacleBase)}, 1.0), vec4(${glslHex(SHORE_PALETTE.barnacleDark)}, 1.0), ${float(LOOK.shell.middleStop)}, t);
  colour = over(colour, shell * shellCover(point, roll, unitPx));
  float ribs = 0.0;
  for (int plate = 0; plate < ${LOOK.shell.plates}; plate++) {
    float angle = float(plate) / ${float(LOOK.shell.plates)} * ${float(KELP_TURN)} + roll * ${float(LOOK.turn)};
    vec2 along = vec2(cos(angle), sin(angle));
    float gap = segmentDistance(point, along * ${float(LOOK.ribs.inner)}, along * ${float(LOOK.ribs.outer)});
    ribs = max(ribs, clamp((${float(LOOK.ribs.width * HALF)} - gap) * unitPx + 0.5, 0.0, 1.0));
  }
  colour = over(colour, paint(${glslRgb(LOOK.ribs.colour)}, ${float(LOOK.ribs.alpha)} * ribs));
  vec2 radii = vec2(${float(LOOK.opening.radiusX)}, ${float(LOOK.opening.radiusY)});
  vec2 local = turn(point, -roll * ${float(LOOK.turn)});
  float level = length(local / radii);
  float edgeGap = (level - 1.0) * level / max(length(local / (radii * radii)), 1e-6);
  colour = over(colour, paint(${glslHex(LOOK.opening.colour)}, clamp(-edgeGap * unitPx + 0.5, 0.0, 1.0)));
  float angle = atan(local.y / radii.y, local.x / radii.x);
  float onArc = step(angle + ${float(RADIANS_PER_FULL_TURN)}, ${float(LOOK.lip.to)}) * step(${float(LOOK.lip.from)}, angle + ${float(RADIANS_PER_FULL_TURN)});
  float lip = clamp((${float(LOOK.lip.width * HALF)} - abs(edgeGap)) * unitPx + 0.5, 0.0, 1.0) * onArc;
  return over(colour, paint(${glslRgb(LOOK.lip.colour)}, ${float(LOOK.lip.alpha)} * lip));
}

/**
 * The barnacles over \`world\`, from its cell and the eight round it, by column then row as the mockup draws them. A
 * neighbour is looked at only when the pixel lies within the largest barnacle's reach of the shared edge, and a
 * barnacle is drawn only when the pixel lies within its own reach and it is big enough to see: every other one
 * paints nothing, so skipping it changes no pixel.
 */
vec4 barnacles(vec4 colour, vec2 world, float lowestY) {
  ivec2 cell = ivec2(floor(world / ${float(GRID.cellM)}));
  vec2 inCell = world - vec2(cell) * ${float(GRID.cellM)};
  float margin = px(1.0) / ${KELP_COMMON_UNIFORM.view}.w;
  ivec2 first = ivec2(inCell.x < ${float(REACH_M)} + margin ? -1 : 0, inCell.y < ${float(REACH_M)} + margin ? -1 : 0);
  ivec2 last = ivec2(inCell.x > ${float(GRID.cellM - REACH_M)} - margin ? 1 : 0, inCell.y > ${float(GRID.cellM - REACH_M)} - margin ? 1 : 0);
  for (int column = -1; column <= 1; column++) {
    if (column < first.x || column > last.x) continue;
    for (int row = -1; row <= 1; row++) {
      if (row < first.y || row > last.y) continue;
      ivec2 at = cell + ivec2(column, row);
      float roll = coordinateHash(at.x, at.y, ${GRID.salt + KELP_GRID_SALT.first});
      if (roll > ${float(GRID.keepAtOrBelow)}) continue;
      vec2 centre = (vec2(at) + vec2(coordinateHash(at.x, at.y, ${GRID.salt + KELP_GRID_SALT.x}), coordinateHash(at.x, at.y, ${GRID.salt + KELP_GRID_SALT.y}))) * ${float(GRID.cellM)};
      if (centre.y > lowestY) continue;
      float size = coordinateHash(at.x, at.y, ${GRID.salt + KELP_GRID_SALT.second});
      float radius = ${float(GRID.radiusM.min)} + size * ${float(GRID.radiusM.span)};
      if (radius * pixelsPerMetre() < ${float(KELP_BARNACLE_MIN_PX)}) continue;
      if (length(world - centre) > radius * ${float(REACH_RADII)} + margin) continue;
      colour = barnacle(colour, (world - centre) / radius, radius * pixelsPerMetre(), roll * ${float(GRID.turnPerRoll)});
    }
  }
  return colour;
}
`;
