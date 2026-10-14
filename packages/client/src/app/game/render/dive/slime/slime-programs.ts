// The slime band's shader programs (docs/rendering/opening-dive.md §4, ticket #803): the floor, the clouds, the
// diatoms, the pocket, the dark past its wall, the rods, the specks, the drop's skin and the plankton's strokes, each a
// Pixi `Shader` over its GLSL with one uniform group holding every uniform it declares (`dive-shader-program.ts`) and
// its samplers bound to an empty texture until the bakes land.

import { SLIME_ORGANISMS, SLIME_PLANKTON_KIND } from '../../constants/dive-slime-plankton';
import { bindTexture, programMaker, uniformVector, type UniformProgram } from '../dive-shader-program';
import { KELP_FLOOR_VERTEX_SOURCE } from '../kelp/kelp-shader-floor';
import {
  SLIME_BACTERIA_FRAGMENT_SOURCE,
  SLIME_BACTERIA_UNIFORM,
  SLIME_MOTE_VERTEX_SOURCE,
  SLIME_ROD_VERTEX_SOURCE,
} from './slime-shader-bacteria';
import { SLIME_CLOUD_FRAGMENT_SOURCE, SLIME_CLOUD_VERTEX_SOURCE } from './slime-shader-clouds';
import { SLIME_COMMON_UNIFORM, SLIME_UNIFORM_GROUP } from './slime-shader-common';
import {
  SLIME_DIATOM_ENTRIES,
  SLIME_DIATOM_FRAGMENT_SOURCE,
  SLIME_DIATOM_UNIFORM,
  SLIME_DIATOM_VERTEX_SOURCE,
} from './slime-shader-diatoms';
import { SLIME_CAUSTIC_SHEETS, SLIME_FLOOR_FRAGMENT_SOURCE, SLIME_FLOOR_UNIFORM } from './slime-shader-floor';
import {
  SLIME_OUTSIDE_FRAGMENT_SOURCE,
  SLIME_POCKET_FRAGMENT_SOURCE,
  SLIME_POCKET_UNIFORM,
  SLIME_QUAD_VERTEX_SOURCE,
  SLIME_SKIN_FRAGMENT_SOURCE,
} from './slime-shader-pocket';
import {
  SLIME_PENNATE_FRAGMENT_SOURCE,
  SLIME_PENNATE_UNIFORM,
  SLIME_PENNATE_VERTEX_SOURCE,
} from './slime-shader-pennate';
import { SLIME_STROKE_FRAGMENT_SOURCE, SLIME_STROKE_VERTEX_SOURCE } from './slime-shader-strokes';

export type SlimeProgram = UniformProgram;

/** Every program the band draws with. */
export interface SlimePrograms {
  readonly floor: SlimeProgram;
  readonly clouds: SlimeProgram;
  readonly diatoms: SlimeProgram;
  readonly pocket: SlimeProgram;
  readonly outside: SlimeProgram;
  readonly rods: SlimeProgram;
  readonly motes: SlimeProgram;
  readonly skin: SlimeProgram;
  readonly strokes: SlimeProgram;
  /** One for each big pennate among the plankton (`SLIME_ORGANISMS`): each binds its own rung's pictures. */
  readonly pennates: readonly SlimeProgram[];
}

const COMMON = SLIME_COMMON_UNIFORM;
const FRAMED = [COMMON.view, COMMON.frame];
const CLIPPED = [...FRAMED, COMMON.drop];

/** The uniform arrays: how many vectors each holds. */
const VECTOR_COUNTS: Readonly<Record<string, number>> = {
  [SLIME_FLOOR_UNIFORM.caustics]: SLIME_CAUSTIC_SHEETS,
  [SLIME_DIATOM_UNIFORM.entries]: SLIME_DIATOM_ENTRIES,
};

const program = programMaker(SLIME_UNIFORM_GROUP, VECTOR_COUNTS);

export function createPennateProgram(): SlimeProgram {
  const { pennate, box, reach, bright, dark } = SLIME_PENNATE_UNIFORM;
  return program(
    { vertex: SLIME_PENNATE_VERTEX_SOURCE, fragment: SLIME_PENNATE_FRAGMENT_SOURCE },
    [...FRAMED, pennate, box, reach],
    [bright, dark],
  );
}

/** Every program, made once a band. */
export function createSlimePrograms(): SlimePrograms {
  const atlas = [SLIME_BACTERIA_UNIFORM.atlas];
  return {
    floor: program(
      { vertex: KELP_FLOOR_VERTEX_SOURCE, fragment: SLIME_FLOOR_FRAGMENT_SOURCE },
      [...CLIPPED, SLIME_FLOOR_UNIFORM.floor, SLIME_FLOOR_UNIFORM.caustics],
      [SLIME_FLOOR_UNIFORM.cells, SLIME_FLOOR_UNIFORM.cellsDark, SLIME_FLOOR_UNIFORM.caustic],
    ),
    clouds: program({ vertex: SLIME_CLOUD_VERTEX_SOURCE, fragment: SLIME_CLOUD_FRAGMENT_SOURCE }, CLIPPED),
    diatoms: program(
      { vertex: SLIME_DIATOM_VERTEX_SOURCE, fragment: SLIME_DIATOM_FRAGMENT_SOURCE },
      [...CLIPPED, SLIME_DIATOM_UNIFORM.entries],
      [SLIME_DIATOM_UNIFORM.atlas],
    ),
    pocket: program({ vertex: SLIME_QUAD_VERTEX_SOURCE, fragment: SLIME_POCKET_FRAGMENT_SOURCE }, [
      ...CLIPPED,
      SLIME_POCKET_UNIFORM.quad,
      SLIME_POCKET_UNIFORM.pocket,
    ]),
    outside: program({ vertex: KELP_FLOOR_VERTEX_SOURCE, fragment: SLIME_OUTSIDE_FRAGMENT_SOURCE }, CLIPPED),
    rods: program({ vertex: SLIME_ROD_VERTEX_SOURCE, fragment: SLIME_BACTERIA_FRAGMENT_SOURCE }, CLIPPED, atlas),
    motes: program({ vertex: SLIME_MOTE_VERTEX_SOURCE, fragment: SLIME_BACTERIA_FRAGMENT_SOURCE }, CLIPPED, atlas),
    skin: program({ vertex: SLIME_QUAD_VERTEX_SOURCE, fragment: SLIME_SKIN_FRAGMENT_SOURCE }, [
      ...CLIPPED,
      SLIME_POCKET_UNIFORM.quad,
      SLIME_POCKET_UNIFORM.skin,
    ]),
    strokes: program({ vertex: SLIME_STROKE_VERTEX_SOURCE, fragment: SLIME_STROKE_FRAGMENT_SOURCE }, FRAMED),
    pennates: SLIME_ORGANISMS.filter((organism) => organism.kind === SLIME_PLANKTON_KIND.pennate).map(() =>
      createPennateProgram(),
    ),
  };
}

/** Every program of the set. */
export function everySlimeProgram(programs: SlimePrograms): SlimeProgram[] {
  const { floor, clouds, diatoms, pocket, outside, rods, motes, skin, strokes, pennates } = programs;
  return [floor, clouds, diatoms, pocket, outside, rods, motes, skin, strokes, ...pennates];
}

export { bindTexture, uniformVector };
