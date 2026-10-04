// The kelp band's five shader programs and their uniforms (docs/rendering/opening-dive.md §4, ticket #802): the rock,
// the ribbons (back and front share one), the bulb, the blade floor and the lenses. Each is one Pixi `Shader` over its
// GLSL with one uniform group holding every uniform it declares, and every sampler bound to an empty texture until
// the bakes land.

import { bindTexture, programMaker, uniformVector, type UniformProgram } from '../dive-shader-program';
import { KELP_BULB_APOPHYSIS_VECTORS, KELP_BULB_FRAGMENT_SOURCE, KELP_BULB_UNIFORM } from './kelp-shader-bulb';
import { KELP_COMMON_UNIFORM, KELP_OCTAVE_SLOTS, KELP_WORLD_VERTEX_SOURCE } from './kelp-shader-common';
import { KELP_FLOOR_FRAGMENT_SOURCE, KELP_FLOOR_UNIFORM, KELP_FLOOR_VERTEX_SOURCE } from './kelp-shader-floor';
import { KELP_LENS_FRAGMENT_SOURCE, KELP_LENS_UNIFORM, KELP_LENS_VERTEX_SOURCE } from './kelp-shader-lens';
import { KELP_RIBBON_FRAGMENT_SOURCE, KELP_RIBBON_UNIFORM, KELP_RIBBON_VERTEX_SOURCE } from './kelp-shader-ribbon';
import { KELP_ROCK_FRAGMENT_SOURCE } from './kelp-shader-rock';
import {
  KELP_ROCK_COVER_VECTORS,
  KELP_ROCK_JOINT_VECTORS,
  KELP_ROCK_MEAN,
  KELP_ROCK_UNIFORM,
} from './kelp-shader-rock-surface';

/** The resource name every kelp shader's uniform group goes under. */
export const KELP_UNIFORM_GROUP = 'kelpUniforms';

export type KelpProgram = UniformProgram;

/** The uniform arrays: how many vectors each holds. */
const VECTOR_COUNTS: Readonly<Record<string, number>> = {
  [KELP_ROCK_UNIFORM.joints]: KELP_ROCK_JOINT_VECTORS,
  [KELP_ROCK_UNIFORM.means]: Object.keys(KELP_ROCK_MEAN).length,
  [KELP_ROCK_UNIFORM.cover]: KELP_ROCK_COVER_VECTORS,
  [KELP_BULB_UNIFORM.apophyses]: KELP_BULB_APOPHYSIS_VECTORS,
  [KELP_COMMON_UNIFORM.octaves]: KELP_OCTAVE_SLOTS,
};

const program = programMaker(KELP_UNIFORM_GROUP, VECTOR_COUNTS, [KELP_COMMON_UNIFORM.view, KELP_COMMON_UNIFORM.frame]);

const ROCK = KELP_ROCK_UNIFORM;
const RIBBON = KELP_RIBBON_UNIFORM;

export function createRockProgram(): KelpProgram {
  return program(
    { vertex: KELP_WORLD_VERTEX_SOURCE, fragment: KELP_ROCK_FRAGMENT_SOURCE },
    [
      ROCK.rock,
      ROCK.rockBox,
      ROCK.seaBox,
      ROCK.texels,
      ROCK.joints,
      ROCK.means,
      ROCK.cover,
      KELP_COMMON_UNIFORM.octaves,
    ],
    [
      ROCK.rockDistance,
      ROCK.seaDistance,
      ROCK.rockTile,
      ROCK.grainTile,
      ROCK.barnacleTile,
      ROCK.barnacleFarTile,
      ROCK.rockweedTile,
      ROCK.rockweedFarTile,
      ROCK.foamTile,
      ROCK.causticTile,
      ROCK.bladeCover,
    ],
  );
}

export function createRibbonProgram(): KelpProgram {
  return program(
    { vertex: KELP_RIBBON_VERTEX_SOURCE, fragment: KELP_RIBBON_FRAGMENT_SOURCE },
    [RIBBON.ribbon, RIBBON.shown, RIBBON.rockBox, RIBBON.seaBox, RIBBON.texels, KELP_COMMON_UNIFORM.octaves],
    [RIBBON.bladeTile, RIBBON.rockDistance, RIBBON.seaDistance],
  );
}

export function createBulbProgram(): KelpProgram {
  return program(
    { vertex: KELP_WORLD_VERTEX_SOURCE, fragment: KELP_BULB_FRAGMENT_SOURCE },
    [KELP_BULB_UNIFORM.apophyses],
    [],
  );
}

export function createFloorProgram(): KelpProgram {
  return program(
    { vertex: KELP_FLOOR_VERTEX_SOURCE, fragment: KELP_FLOOR_FRAGMENT_SOURCE },
    [KELP_FLOOR_UNIFORM.drop, KELP_COMMON_UNIFORM.octaves],
    [KELP_FLOOR_UNIFORM.bladeTile],
  );
}

export function createLensProgram(): KelpProgram {
  return program(
    { vertex: KELP_LENS_VERTEX_SOURCE, fragment: KELP_LENS_FRAGMENT_SOURCE },
    [KELP_LENS_UNIFORM.lens, KELP_COMMON_UNIFORM.octaves],
    [KELP_LENS_UNIFORM.bladeTile],
  );
}

export { bindTexture, uniformVector };
