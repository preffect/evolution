// The slime's floor inside the drop on the GPU (docs/rendering/opening-dive.md §4, ticket #803, the start of the
// mockup's `drawMicro`): a quad over the stage. Past the drop it paints the dark first; while the drop's edge is in
// view the blade outside it darkens and everything else is clipped to it. Inside: the kelp's surface cells as a tiled
// texture along the blade (bright field, then dark field over it), two caustic sheets drifting against each other,
// the water's tint, and as the dish's dark field arrives the game's field with the cells' walls glowing faintly.

import { BG_FIELD } from '../../constants';
import { SLIME_EDGE_SHADE, SLIME_FLOOR, SLIME_PALETTE } from '../../constants/dive-slime';
import { glslFloat } from '../../cells/cell-shader-source';
import { KELP_BLADE_ANGLE } from '../kelp/kelp-ribbons';
import { KELP_FRAGMENT_HEAD, KELP_PAINT_SOURCE, glslHex, glslRgb } from '../kelp/kelp-shader-common';
import { SLIME_DROP_SOURCE, SLIME_FRAME_SOURCE, SLIME_LIGHTER_SOURCE } from './slime-shader-common';

export const SLIME_FLOOR_UNIFORM = {
  cells: 'uCells',
  cellsDark: 'uCellsDark',
  caustic: 'uCaustic',
  /** The cells' alpha, the caustics' alpha, 1 while the drop shows under the slime, 1 once the cells have baked. */
  floor: 'uFloor',
  /** Each caustic sheet's drift (metres), tile (metres) and alpha. */
  caustics: 'uCaustics',
} as const;

export const SLIME_CAUSTIC_SHEETS = SLIME_FLOOR.caustic.sheets.length;

const UNIFORM = SLIME_FLOOR_UNIFORM;
const float = glslFloat;

export const SLIME_FLOOR_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform sampler2D ${UNIFORM.cells};
uniform sampler2D ${UNIFORM.cellsDark};
uniform sampler2D ${UNIFORM.caustic};
uniform vec4 ${UNIFORM.floor};
uniform vec4 ${UNIFORM.caustics}[${SLIME_CAUSTIC_SHEETS}];
in vec2 vWorld;
${KELP_PAINT_SOURCE}${SLIME_FRAME_SOURCE}${SLIME_DROP_SOURCE}${SLIME_LIGHTER_SOURCE}
/** The cells' two looks at \`world\`: bright field (or its stand-in until it bakes) and dark field. */
void cellsAt(vec2 world, out vec4 bright, out vec4 dark) {
  vec2 tile = turn(world, ${float(-KELP_BLADE_ANGLE)}) / ${float(SLIME_FLOOR.cells.tileM)};
  bool isBaked = ${UNIFORM.floor}.w > 0.5;
  float bias = ${float(SLIME_FLOOR.cells.lodBias)};
  bright = isBaked ? texture(${UNIFORM.cells}, tile, bias) : vec4(${glslHex(SLIME_PALETTE.cellBase)}, 1.0);
  dark = isBaked ? texture(${UNIFORM.cellsDark}, tile, bias) : vec4(0.0);
}

vec4 caustics(vec4 colour, vec2 world) {
  for (int sheet = 0; sheet < ${SLIME_CAUSTIC_SHEETS}; sheet++) {
    vec4 drift = ${UNIFORM.caustics}[sheet];
    vec2 tile = turn(world - drift.xy, ${float(-SLIME_FLOOR.caustic.turn)}) / drift.z;
    colour = lighter(colour, texture(${UNIFORM.caustic}, tile) * ${UNIFORM.floor}.y * drift.w);
  }
  return colour;
}

/** Everything inside the drop's clip, over \`colour\`. */
vec4 insideTheDrop(vec4 colour, vec2 world) {
  float slime = slimeAlpha();
  float dark = darkField();
  float cellAlpha = ${UNIFORM.floor}.x;
  vec4 brightCells = vec4(0.0);
  vec4 darkCells = vec4(0.0);
  if (cellAlpha > 0.0) {
    cellsAt(world, brightCells, darkCells);
    if (dark < 1.0) colour = over(colour, brightCells * slime * cellAlpha);
    if (dark > 0.0) colour = over(colour, darkCells * slime * cellAlpha * dark);
  }
  if (${UNIFORM.floor}.y > 0.0) colour = caustics(colour, world);
  colour = over(colour, paint(${glslHex(SLIME_PALETTE.waterTint)}, ${float(SLIME_FLOOR.tint.alpha)} * slime * (1.0 - dark)));
  if (dark > 0.0) {
    colour = over(colour, paint(${glslHex(BG_FIELD)}, dark * ${float(SLIME_FLOOR.darkField.alpha)}));
    if (cellAlpha > 0.0) colour = lighter(colour, darkCells * cellAlpha * dark * ${float(SLIME_FLOOR.darkField.wallGlow)});
  }
  return colour;
}

void main() {
  bool isOverTheDrop = ${UNIFORM.floor}.z > 0.5;
  vec4 base = isOverTheDrop ? vec4(0.0) : vec4(${glslHex(SLIME_PALETTE.dark)}, 1.0);
  float inside = insideDrop(vWorld);
  vec4 outside = over(base, paint(${glslRgb(SLIME_EDGE_SHADE.rgb)}, ${float(SLIME_EDGE_SHADE.alpha)} * slimeAlpha() * (1.0 - inside)));
  fragColour = mix(outside, insideTheDrop(base, vWorld), inside);
}
`;
