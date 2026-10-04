// The slime band's meshes on the dive's Pixi stage (docs/rendering/opening-dive.md §4, ticket #803), in the mockup's
// order: the floor, the clouds, the diatoms, the pocket, the plankton (their own container, `slime-organisms.ts`), the
// dark past the pocket's wall, the rods, the specks and the drop's skin. The scatters' quads are made once from their
// grids and only uniforms change; the floor, the dark past the wall, the pocket and the skin share one unit quad.

import { Container, Geometry, type Mesh, type Shader } from 'pixi.js';
import { hiddenMesh } from '../dive-shader-program';
import { CELL_QUAD_INDICES, CELL_QUAD_POSITIONS } from '../../constants';
import { POINT_STRIDE } from '../shore/shore-points';
import type { SlimePrograms } from './slime-programs';
import type { FloorDiatom, SlimeCloud, SlimeMote, SlimeRod, SlimeScatters } from './slime-scatter';
import { SLIME_BACTERIA_ATTRIBUTE } from './slime-shader-bacteria';
import { SLIME_CLOUD_ATTRIBUTE } from './slime-shader-clouds';
import { SLIME_CORNER_ATTRIBUTE } from './slime-shader-common';
import { SLIME_DIATOM_ATTRIBUTE } from './slime-shader-diatoms';
import { SLIME_LICMOPHORA } from '../../constants/dive-slime-diatoms';

export type SlimeMesh = Mesh<Geometry, Shader>;

/** The band's meshes, each over its program's shader; `plankton` holds the organisms. */
export interface SlimeMeshSet {
  readonly root: Container;
  readonly floor: SlimeMesh;
  readonly clouds: SlimeMesh;
  readonly diatoms: SlimeMesh;
  readonly pocket: SlimeMesh;
  readonly plankton: Container;
  readonly outside: SlimeMesh;
  readonly rods: SlimeMesh;
  readonly motes: SlimeMesh;
  readonly skin: SlimeMesh;
}

const QUAD_CORNERS = CELL_QUAD_POSITIONS.length / POINT_STRIDE;
const VECTOR = 4;

/** The ±1 unit quad: the stage's (the floor shaders read it as the stage's corners) and the scaled ones'. */
export function unitQuadGeometry(): Geometry {
  return new Geometry({
    attributes: { aPosition: { buffer: Float32Array.from(CELL_QUAD_POSITIONS), format: 'float32x2' } },
    indexBuffer: new Uint16Array(CELL_QUAD_INDICES),
  });
}

/** A quad an instance, each of its four corners carrying the instance's vectors (`vectorsOf` gives each attribute's). */
export function instanceQuadGeometry<T>(
  instances: readonly T[],
  attributes: readonly (readonly [string, (instance: T) => readonly number[]])[],
): Geometry {
  const corners = new Float32Array(instances.length * CELL_QUAD_POSITIONS.length);
  const values = attributes.map(() => new Float32Array(instances.length * QUAD_CORNERS * VECTOR));
  const indices = new Uint32Array(instances.length * CELL_QUAD_INDICES.length);
  instances.forEach((instance, index) => {
    corners.set(CELL_QUAD_POSITIONS, index * CELL_QUAD_POSITIONS.length);
    attributes.forEach(([, vectorOf], attribute) => {
      const vector = vectorOf(instance);
      for (let corner = 0; corner < QUAD_CORNERS; corner += 1) {
        values[attribute]?.set(vector, (index * QUAD_CORNERS + corner) * VECTOR);
      }
    });
    indices.set(
      CELL_QUAD_INDICES.map((corner) => corner + index * QUAD_CORNERS),
      index * CELL_QUAD_INDICES.length,
    );
  });
  const buffers: Record<string, { buffer: Float32Array; format: 'float32x2' | 'float32x4' }> = {
    [SLIME_CORNER_ATTRIBUTE]: { buffer: corners, format: 'float32x2' },
  };
  attributes.forEach(([name], attribute) => {
    buffers[name] = { buffer: values[attribute] ?? new Float32Array(0), format: 'float32x4' };
  });
  return new Geometry({ attributes: buffers, indexBuffer: indices });
}

const flag = (isOn: boolean): number => (isOn ? 1 : 0);

/** The clouds' quads. */
export function cloudGeometry(clouds: readonly SlimeCloud[]): Geometry {
  return instanceQuadGeometry(clouds, [
    [SLIME_CLOUD_ATTRIBUTE, (cloud) => [cloud.x, cloud.y, cloud.radiusM, cloud.alpha]],
  ]);
}

/** The floor diatoms' quads: each its place, length, heading, kind and sway phase. */
export function diatomGeometry(diatoms: readonly FloorDiatom[]): Geometry {
  return instanceQuadGeometry(diatoms, [
    [SLIME_DIATOM_ATTRIBUTE.diatom, (diatom) => [diatom.x, diatom.y, diatom.lengthM, diatom.angle]],
    [SLIME_DIATOM_ATTRIBUTE.kind, (diatom) => [diatom.kind, diatom.x * SLIME_LICMOPHORA.sway.phasePerMetre, 0, 0]],
  ]);
}

/** The rods' quads. */
export function rodGeometry(rods: readonly SlimeRod[]): Geometry {
  return instanceQuadGeometry(rods, [
    [SLIME_BACTERIA_ATTRIBUTE.body, (rod) => [rod.x, rod.y, rod.lengthM, rod.widthM]],
    [SLIME_BACTERIA_ATTRIBUTE.motion, (rod) => [rod.angle, rod.phase, rod.kind, flag(rod.isInDish)]],
  ]);
}

/** The food specks' quads. */
export function moteGeometry(motes: readonly SlimeMote[]): Geometry {
  return instanceQuadGeometry(motes, [
    [SLIME_BACTERIA_ATTRIBUTE.body, (mote) => [mote.x, mote.y, mote.radiusM, flag(mote.isLipid)]],
    [SLIME_BACTERIA_ATTRIBUTE.motion, (mote) => [mote.column, mote.row, flag(mote.isInDish), 0]],
  ]);
}

/** Every mesh, hidden, in its place under `root`; the plankton's container is filled by `SlimeOrganisms`. */
export function createSlimeMeshes(programs: SlimePrograms, scatters: SlimeScatters, plankton: Container): SlimeMeshSet {
  const quad = unitQuadGeometry();
  const set: SlimeMeshSet = {
    root: new Container(),
    floor: hiddenMesh(quad, programs.floor.shader),
    clouds: hiddenMesh(cloudGeometry(scatters.clouds), programs.clouds.shader),
    diatoms: hiddenMesh(diatomGeometry(scatters.diatoms), programs.diatoms.shader),
    pocket: hiddenMesh(quad, programs.pocket.shader),
    plankton,
    outside: hiddenMesh(quad, programs.outside.shader),
    rods: hiddenMesh(rodGeometry(scatters.rods), programs.rods.shader),
    motes: hiddenMesh(moteGeometry(scatters.motes), programs.motes.shader),
    skin: hiddenMesh(quad, programs.skin.shader),
  };
  set.root.addChild(
    set.floor,
    set.clouds,
    set.diatoms,
    set.pocket,
    set.plankton,
    set.outside,
    set.rods,
    set.motes,
    set.skin,
  );
  return set;
}

/** The scatters' quads in place of what the meshes had (the empty set the band opens with), which are destroyed. */
export function swapScatterGeometries(set: SlimeMeshSet, scatters: SlimeScatters): void {
  const swaps: readonly (readonly [SlimeMesh, Geometry])[] = [
    [set.clouds, cloudGeometry(scatters.clouds)],
    [set.diatoms, diatomGeometry(scatters.diatoms)],
    [set.rods, rodGeometry(scatters.rods)],
    [set.motes, moteGeometry(scatters.motes)],
  ];
  for (const [mesh, geometry] of swaps) {
    const old = mesh.geometry;
    mesh.geometry = geometry;
    old.destroy();
  }
}

/** The meshes of the set, in their order. */
export function slimeMeshList(set: SlimeMeshSet): SlimeMesh[] {
  return [set.floor, set.clouds, set.diatoms, set.pocket, set.outside, set.rods, set.motes, set.skin];
}
