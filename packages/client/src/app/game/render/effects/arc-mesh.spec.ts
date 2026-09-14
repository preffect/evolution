// No WebGL under jsdom: the GPU objects build, every uniform the GLSL declares is bound, `draw` packs,
// counts and shows, and every arc of a frame stays one instanced quad (one index buffer of six, one
// mesh, one program) at zero, one and many rows. Compilation and pixels are the contact sheet's job.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARC_INSTANCE_CAPACITY, ARC_INSTANCE_FIELD, CELL_QUAD_INDICES, DNA } from '../constants';
import { RGBA_CHANNELS } from '../colour';
import { ARC_CAP, ARC_INSTANCE_FLOATS, type ArcInstance } from './arc-instance';
import { ArcMesh } from './arc-mesh';
import { ARC_FRAGMENT_SOURCE, ARC_UNIFORM, ARC_UNIFORM_GROUP, ARC_VERTEX_SOURCE, arcRead } from './arc-shader';

/** Pixi binds these itself for every mesh. */
const PIXI_MATRICES = new Set(['uProjectionMatrix', 'uWorldTransformMatrix', 'uTransformMatrix']);

function arcs(count: number): ArcInstance[] {
  return Array.from({ length: count }, (_entry, index) => ({
    x: index,
    y: 0,
    radiusPx: 17,
    strokePx: 4,
    startDeg: 0,
    sweep: 0.5,
    cap: ARC_CAP.round,
    colour: DNA,
    alpha: 1,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ArcMesh', () => {
  it('builds one mesh over a unit quad with an instance index, and a row buffer of the capacity', () => {
    const subject = new ArcMesh();
    expect(subject.capacity).toBe(ARC_INSTANCE_CAPACITY);
    expect(subject.instances).toHaveLength(ARC_INSTANCE_CAPACITY * ARC_INSTANCE_FLOATS);
    expect(Array.from(subject.mesh.geometry.indexBuffer.data)).toEqual([...CELL_QUAD_INDICES]);
    expect(subject.mesh.geometry.attributes['aInstanceIndex']?.instance).toBe(true);
    expect(subject.mesh.visible).toBe(false);
    subject.destroy();
  });

  it('binds every uniform the GLSL declares (an unbound sampler or zoom draws nothing)', () => {
    const subject = new ArcMesh(1);
    const declared = [...(ARC_VERTEX_SOURCE + ARC_FRAGMENT_SOURCE).matchAll(/uniform (?:float|sampler2D) (\w+);/g)]
      .map((match) => match[1]!)
      .filter((name) => !PIXI_MATRICES.has(name));
    expect(new Set(declared)).toEqual(new Set([ARC_UNIFORM.instances, ARC_UNIFORM.zoom]));
    const resources = subject.mesh.shader!.resources;
    expect(resources[ARC_UNIFORM.instances]).toBeDefined();
    expect((resources[ARC_UNIFORM_GROUP] as { uniforms: Record<string, unknown> }).uniforms[ARC_UNIFORM.zoom]).toBe(1);
    subject.destroy();
  });

  it.each([
    ['zero', 0, 0],
    ['one', 1, 1],
    ['many', ARC_INSTANCE_CAPACITY + 3, ARC_INSTANCE_CAPACITY],
  ])('stays one instanced draw at %s rows: the same mesh, a count and visibility', (_label, rows, drawn) => {
    const subject = new ArcMesh();
    const { mesh } = subject;
    const geometry = mesh.geometry;
    const shader = mesh.shader;
    subject.draw(arcs(rows), 1.8);
    expect(subject.mesh).toBe(mesh);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.shader).toBe(shader);
    expect(mesh.geometry.indexBuffer.data).toHaveLength(CELL_QUAD_INDICES.length);
    expect(subject.count).toBe(drawn);
    expect(mesh.visible).toBe(drawn > 0);
    expect(subject.zoom).toBe(1.8);
    subject.destroy();
  });

  it('reads each row field from the texel and channel the packer writes it to', () => {
    for (const [field, offset] of Object.entries(ARC_INSTANCE_FIELD)) {
      const texel = Math.floor(offset / RGBA_CHANNELS);
      const channel = 'xyzw'[offset % RGBA_CHANNELS];
      expect(arcRead(field as keyof typeof ARC_INSTANCE_FIELD)).toBe(
        `texelFetch(${ARC_UNIFORM.instances}, ivec2(${texel}, vInstance), 0).${channel}`,
      );
    }
  });

  it('destroys the shader and its program before the instance texture, without a bound-texture warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const subject = new ArcMesh(1);
    const shader = subject.mesh.shader!;
    subject.destroy();
    expect(shader.glProgram).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
