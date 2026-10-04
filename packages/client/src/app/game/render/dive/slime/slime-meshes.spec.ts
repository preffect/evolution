// The slime band's meshes and what its programs are told (docs/rendering/opening-dive.md §4, ticket #803): the meshes
// in the mockup's order by identity, a quad an instance with the instance's vectors on each corner, the scatters'
// quads swapped in for the empty ones, the frame's numbers written where each program reads them, and the textures
// made from the bakes and given back.

import { Container, Texture } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { KELP_DROP } from '../../constants/dive-kelp-drop';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { quickSlimeBake, runBake, testSlimeScatters } from '../../../../../testing/slime-builder';
import { diveViewAt } from '../dive-view';
import { slimeFrameOf } from './slime-frame';
import { createSlimeMeshes, instanceQuadGeometry, slimeMeshList, swapScatterGeometries } from './slime-meshes';
import { createSlimePrograms, uniformVector } from './slime-programs';
import { SLIME_COMMON_UNIFORM } from './slime-shader-common';
import { SLIME_DIATOM_UNIFORM } from './slime-shader-diatoms';
import { SLIME_FLOOR_UNIFORM } from './slime-shader-floor';
import { SLIME_POCKET_UNIFORM } from './slime-shader-pocket';
import { glowTexture, releaseSlimeTextures, slimeTextures } from './slime-textures';
import { bindSlimeBaked, diatomEntries, updateSlimeFrame } from './slime-uniforms';

const EMPTY = { clouds: [], diatoms: [], rods: [], motes: [] };
const frameAt = (zoom: number) =>
  slimeFrameOf(
    diveViewAt({
      zoom,
      viewport: { width: 830, height: 467 },
      timeSeconds: 2,
      isMoving: false,
      globeIdleSpinDegrees: 0,
    }),
  );

describe('createSlimeMeshes', () => {
  it('lays the meshes in the mockup’s order under one root, the plankton between the pocket and the dark past it', () => {
    const programs = createSlimePrograms();
    const plankton = new Container();
    const set = createSlimeMeshes(programs, EMPTY, plankton);
    const order = [
      set.floor,
      set.clouds,
      set.diatoms,
      set.pocket,
      plankton,
      set.outside,
      set.rods,
      set.motes,
      set.skin,
    ];
    expect(set.root.children).toHaveLength(order.length);
    // by identity: the meshes are alike, so `toEqual` would pass any order
    order.forEach((child, index) => expect(set.root.children[index]).toBe(child));
    expect(slimeMeshList(set).every((mesh) => !mesh.visible)).toBe(true);
    // the floor, the pocket, the dark past it and the skin share one unit quad
    expect(set.pocket.geometry).toBe(set.floor.geometry);
    expect(set.skin.geometry).toBe(set.floor.geometry);
    expect(set.floor.shader).toBe(programs.floor.shader);
  });

  it('swaps the scatters’ quads in for the empty ones, destroying those', () => {
    const set = createSlimeMeshes(createSlimePrograms(), EMPTY, new Container());
    const destroyEmpty = vi.spyOn(set.diatoms.geometry, 'destroy');
    swapScatterGeometries(set, testSlimeScatters());
    expect(destroyEmpty).toHaveBeenCalledOnce();
    expect(set.diatoms.geometry.indexBuffer.data).toHaveLength(2 * 6);
    expect(set.motes.geometry.indexBuffer.data).toHaveLength(6);
  });
});

describe('instanceQuadGeometry', () => {
  it('gives each instance four corners, each carrying its vectors, and two triangles', () => {
    const geometry = instanceQuadGeometry([1, 2], [['aThing', (value: number) => [value, value * 10, 0, 0]]]);
    const corners = geometry.getAttribute('aCorner').buffer.data as Float32Array;
    const things = geometry.getAttribute('aThing').buffer.data as Float32Array;
    expect(Array.from(corners.slice(0, 8))).toEqual([-1, -1, 1, -1, 1, 1, -1, 1]);
    expect(Array.from(things.slice(16, 18))).toEqual([2, 20]);
    expect(Array.from(things.slice(28, 30))).toEqual([2, 20]);
    expect(Array.from(geometry.indexBuffer.data)).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  });
});

describe('the slime’s uniforms', () => {
  it('writes the view, the frame and the drop into every program, and the floor’s, the pocket’s and the skin’s own', () => {
    const programs = createSlimePrograms();
    const frame = frameAt(-2.6);
    updateSlimeFrame(programs, frame, { devicePixelRatio: 2, hasCells: false, hasCaustic: true });
    expect(Array.from(uniformVector(programs.rods, SLIME_COMMON_UNIFORM.view))).toEqual(
      [830, 467, frame.pixelsPerMetre, 2].map((value) => Math.fround(value)),
    );
    expect(uniformVector(programs.pennates[0]!, SLIME_COMMON_UNIFORM.frame)[2]).toBe(0);
    expect(Array.from(uniformVector(programs.clouds, SLIME_COMMON_UNIFORM.drop))).toEqual(
      [KELP_DROP.x, KELP_DROP.y, KELP_DROP.radiusM, 1].map((value) => Math.fround(value)),
    );
    const floor = uniformVector(programs.floor, SLIME_FLOOR_UNIFORM.floor);
    expect(Array.from(floor)).toEqual([frame.cellAlpha, frame.causticAlpha, 1, 0].map((value) => Math.fround(value)));
    expect(uniformVector(programs.pocket, SLIME_POCKET_UNIFORM.quad)[2]).toBeCloseTo(frame.pocket.reachM, 9);
    updateSlimeFrame(programs, frame, { devicePixelRatio: 2, hasCells: true, hasCaustic: false });
    expect(Array.from(uniformVector(programs.floor, SLIME_FLOOR_UNIFORM.floor).slice(1))).toEqual([0, 1, 1]);
  });

  it('binds the bakes’ textures by identity and packs each diatom picture’s place', () => {
    const programs = createSlimePrograms();
    const baked = runBake(quickSlimeBake()({ factory: createFakeShoreCanvasFactory(), devicePixelRatio: 1 })).result;
    const textures = slimeTextures(baked);
    bindSlimeBaked(programs, textures, baked.diatoms);
    expect(programs.floor.shader.resources[SLIME_FLOOR_UNIFORM.cells]).toBe(textures.cells);
    expect(programs.diatoms.shader.resources[SLIME_DIATOM_UNIFORM.atlas]).toBe(textures.diatoms);
    const entries = diatomEntries(baked.diatoms);
    expect(Array.from(entries.slice(4, 8))).toEqual([1, 0, 1, 1]);
    expect(Array.from(uniformVector(programs.diatoms, SLIME_DIATOM_UNIFORM.entries))).toEqual(Array.from(entries));
    releaseSlimeTextures(textures);
    expect(textures.cells.destroyed).toBe(true);
    expect(textures.plankton.pennate[0]!.texture.destroyed).toBe(true);
  });

  it('draws the halos’ white glow at once, on a canvas of its own', () => {
    const factory = createFakeShoreCanvasFactory();
    const glow = glowTexture(factory);
    expect(glow).toBeInstanceOf(Texture);
    expect(factory.canvases[0]!.context.ops).toContain('fillRect');
    glow.destroy(true);
  });
});
