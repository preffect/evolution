// The kelp band's meshes on the dive's Pixi stage (docs/rendering/opening-dive.md §4, ticket #802), in the mockup's
// order: the rock, the stipe and blades 4 to 1 (each after its shadow), the bulb, blade 0, the blade floor, then the
// beads and the drop. Six draw calls at most a frame; their geometry is uploaded once and only uniforms change.

import { Container, Geometry, type Mesh, type Shader } from 'pixi.js';
import { hiddenMesh } from '../dive-shader-program';
import { CELL_QUAD_INDICES, CELL_QUAD_POSITIONS } from '../../constants';
import { KELP_BEADS, KELP_DROP } from '../../constants/dive-kelp-drop';
import { KELP_BLADE_LOOK, KELP_BULB, KELP_QUAD_REACH, KELP_STIPE_LOOK } from '../../constants/dive-kelp';
import { SHORE_FOCAL_ROCK } from '../../constants/dive-shore-objects';
import { POINT_STRIDE } from '../shore/shore-points';
import type { KelpBead } from './kelp-beads';
import { KELP_RIBBON_KIND, kelpRibbonGeometry, type KelpRibbonDraw } from './kelp-ribbon-geometry';
import { kelpBlades, kelpStipe, type Ribbon } from './kelp-ribbons';
import { KELP_LENS_ATTRIBUTE } from './kelp-shader-lens';

/** The six meshes, each over its program's shader. */
export interface KelpMeshSet {
  readonly root: Container;
  readonly rock: Mesh<Geometry, Shader>;
  readonly ribbonsBack: Mesh<Geometry, Shader>;
  readonly bulb: Mesh<Geometry, Shader>;
  readonly ribbonsFront: Mesh<Geometry, Shader>;
  readonly floor: Mesh<Geometry, Shader>;
  readonly lenses: Mesh<Geometry, Shader>;
}

/** The shaders the meshes draw with: the two ribbon meshes share one. */
export interface KelpShaders {
  readonly rock: Shader;
  readonly ribbons: Shader;
  readonly bulb: Shader;
  readonly floor: Shader;
  readonly lenses: Shader;
}

const QUAD_CORNERS = CELL_QUAD_POSITIONS.length / POINT_STRIDE;
/** Blades alternate between two fills (`R.bi % 2`). */
const FILL_CYCLE = 2;
const BLADE_SHADOW = [KELP_BLADE_LOOK.shadow.offsetX, KELP_BLADE_LOOK.shadow.offsetY] as const;
const STIPE_SHADOW = [KELP_STIPE_LOOK.shadow.offsetX, KELP_STIPE_LOOK.shadow.offsetY] as const;

/** A square of half-size `reach` round `(x, y)`, as an upright quad in metres. */
function squareGeometry(x: number, y: number, reach: number): Geometry {
  const positions = Float32Array.from(
    CELL_QUAD_POSITIONS,
    (corner, index) => (index % POINT_STRIDE === 0 ? x : y) + corner * reach,
  );
  return new Geometry({
    attributes: { aPosition: { buffer: positions, format: 'float32x2' } },
    indexBuffer: new Uint16Array(CELL_QUAD_INDICES),
  });
}

function bladeDraw(ribbon: Ribbon, index: number): KelpRibbonDraw {
  const kind = index % FILL_CYCLE === 0 ? KELP_RIBBON_KIND.bladeEven : KELP_RIBBON_KIND.bladeOdd;
  return { ribbon, kind, shadowOffset: BLADE_SHADOW };
}

/** The stipe, then blades 4 to 1 (`for (i = BLADES.length − 1; i >= 1; i--)`), each after its shadow. */
export function backRibbonDraws(): KelpRibbonDraw[] {
  const blades = kelpBlades();
  const behind = blades.map(bladeDraw).slice(1).reverse();
  return [{ ribbon: kelpStipe(), kind: KELP_RIBBON_KIND.stipe, shadowOffset: STIPE_SHADOW }, ...behind];
}

/** Blade 0 after its shadow, over the bulb. */
export function frontRibbonDraws(): KelpRibbonDraw[] {
  const blade = kelpBlades()[0];
  return blade === undefined ? [] : [bladeDraw(blade, 0)];
}

/** A quad round each bead in the mockup's order, then the drop: corners in metres and each lens's own numbers. */
export function lensGeometry(beads: readonly KelpBead[]): Geometry {
  const lenses = [
    ...beads.map((bead) => ({ x: bead.x, y: bead.y, radiusM: bead.radiusM, isDrop: 0 })),
    { x: KELP_DROP.x, y: KELP_DROP.y, radiusM: KELP_DROP.radiusM, isDrop: 1 },
  ];
  const positions: number[] = [];
  const shapes: number[] = [];
  const indices: number[] = [];
  lenses.forEach((lens, index) => {
    const reach = lens.radiusM * KELP_BEADS.reachRadii;
    for (let corner = 0; corner < QUAD_CORNERS; corner += 1) {
      const [cornerX = 0, cornerY = 0] = CELL_QUAD_POSITIONS.slice(corner * POINT_STRIDE, (corner + 1) * POINT_STRIDE);
      positions.push(lens.x + cornerX * reach, lens.y + cornerY * reach);
      shapes.push(lens.x, lens.y, lens.radiusM, lens.isDrop);
    }
    indices.push(...CELL_QUAD_INDICES.map((corner) => corner + index * QUAD_CORNERS));
  });
  return new Geometry({
    attributes: {
      [KELP_LENS_ATTRIBUTE.position]: { buffer: Float32Array.from(positions), format: 'float32x2' },
      [KELP_LENS_ATTRIBUTE.lens]: { buffer: Float32Array.from(shapes), format: 'float32x4' },
    },
    indexBuffer: new Uint32Array(indices),
  });
}

/** Every mesh, hidden, in its place under `root`; the lenses wait for the beads (`lensGeometry`, swapped in). */
export function createKelpMeshes(shaders: KelpShaders): KelpMeshSet {
  const rockReach = SHORE_FOCAL_ROCK.radiusM * KELP_QUAD_REACH.rockRadii;
  const set: KelpMeshSet = {
    root: new Container(),
    rock: hiddenMesh(squareGeometry(SHORE_FOCAL_ROCK.x, SHORE_FOCAL_ROCK.y, rockReach), shaders.rock),
    ribbonsBack: hiddenMesh(kelpRibbonGeometry(backRibbonDraws()), shaders.ribbons),
    bulb: hiddenMesh(squareGeometry(KELP_BULB.x, KELP_BULB.y, KELP_QUAD_REACH.bulbM), shaders.bulb),
    ribbonsFront: hiddenMesh(kelpRibbonGeometry(frontRibbonDraws()), shaders.ribbons),
    floor: hiddenMesh(squareGeometry(0, 0, 1), shaders.floor),
    lenses: hiddenMesh(lensGeometry([]), shaders.lenses),
  };
  set.root.addChild(set.rock, set.ribbonsBack, set.bulb, set.ribbonsFront, set.floor, set.lenses);
  return set;
}
