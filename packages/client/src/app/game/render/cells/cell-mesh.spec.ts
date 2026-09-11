// No WebGL under jsdom: the GPU objects build, the two passes share the geometry and the program,
// the count and frame uniforms reach both passes, and destroy frees the shaders and the program
// before the textures they bind. Compilation is the Playwright smoke's job.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { CELL_INSTANCE_FLOATS } from './cell-instance';
import { CellMesh } from './cell-mesh';
import { CELL_PASS, CELL_UNIFORM, CELL_UNIFORM_GROUP } from './cell-shader-source';

/** One bundle for the file: the bakes are the slow part (#226). */
const textures = createTestRenderTextures({ seed: 1 });

function mesh(capacity?: number): CellMesh {
  return new CellMesh(textures, capacity);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CellMesh', () => {
  it('builds two passes over one geometry and one program, and an instance buffer of the capacity', () => {
    const subject = mesh(3);
    expect(subject.capacity).toBe(3);
    expect(subject.instances).toHaveLength(3 * CELL_INSTANCE_FLOATS);
    expect(subject.bodyPass.geometry).toBe(subject.membranePass.geometry);
    expect(subject.bodyPass.shader?.glProgram).toBe(subject.membranePass.shader?.glProgram);
    const passOf = (pass: typeof subject.bodyPass): unknown =>
      (pass.shader?.resources[CELL_UNIFORM_GROUP] as { uniforms: Record<string, unknown> }).uniforms[CELL_UNIFORM.pass];
    expect(passOf(subject.bodyPass)).toBe(CELL_PASS.body);
    expect(passOf(subject.membranePass)).toBe(CELL_PASS.membrane);
    expect(subject.bodyPass.shader?.resources[CELL_UNIFORM.instances]).toBeDefined();
    expect(subject.bodyPass.shader?.resources[CELL_UNIFORM.palette]).toBeDefined();
    subject.destroy();
  });

  it('hides both passes at zero instances, shows them otherwise, and clamps to the capacity', () => {
    const subject = mesh(2);
    expect(subject.bodyPass.visible).toBe(false);
    subject.setCount(5);
    expect(subject.count).toBe(2);
    expect(subject.bodyPass.visible).toBe(true);
    expect(subject.membranePass.visible).toBe(true);
    subject.setCount(0);
    expect(subject.membranePass.visible).toBe(false);
    subject.destroy();
  });

  it('sets the frame uniforms on both passes', () => {
    const subject = mesh(1);
    subject.setFrame(2.5, 1.8);
    expect(subject.frame).toEqual({ timeSeconds: 2.5, zoom: 1.8 });
    const membrane = subject.membranePass.shader?.resources[CELL_UNIFORM_GROUP] as { uniforms: Record<string, number> };
    expect(membrane.uniforms[CELL_UNIFORM.zoom]).toBe(1.8);
    subject.upload();
    subject.destroy();
  });

  it('destroys both shaders and their shared program before the instance texture, without a bound-texture warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const subject = mesh(1);
    const body = subject.bodyPass.shader!;
    const membrane = subject.membranePass.shader!;
    const program = body.glProgram!;
    subject.destroy();
    expect(body.glProgram).toBeNull();
    expect(membrane.glProgram).toBeNull();
    expect(program.vertex).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
