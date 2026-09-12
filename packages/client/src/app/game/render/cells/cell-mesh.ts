// The one instanced quad every cell is drawn with (docs/RENDERING.md §2.3): a unit quad plus an
// instance-index attribute, the instance rows in a float texture, and the two passes as two
// meshes over one program. The layer packs the rows; this class owns the GPU objects.

import { Geometry, GlProgram, Mesh, Shader, State, UniformGroup, type TextureSource } from 'pixi.js';
import { hexToRgb } from '../colour';
import {
  CELL_INSTANCE_CAPACITY,
  CELL_QUAD_INDICES,
  CELL_QUAD_POSITIONS,
  CELL_WALL,
  CELL_WALL_LIGHT,
  CHLORO_LIGHT,
  CILIA,
  CYTOSKELETON,
  DANGER,
  OUTLINE,
  RIBOSOME,
  TOXIN_GLOW,
  WHITE,
} from '../constants';
import { floatDataTexture } from '../textures/pixi-textures';
import { CELL_INSTANCE_TEXELS, createInstanceBuffer } from './cell-instance';
import { CELL_FRAGMENT_SOURCE, CELL_VERTEX_SOURCE } from './cell-shader';
import { CELL_PASS, CELL_UNIFORM, CELL_UNIFORM_GROUP } from './cell-shader-source';

export interface CellMeshTextures {
  readonly stripTexture: TextureSource;
  readonly tileTexture: TextureSource;
  readonly paletteTexture: TextureSource;
}

export type CellPassMesh = Mesh<Geometry, Shader>;

const FLOAT_TYPE = 'f32';
const COLOUR_TYPE = 'vec3<f32>';
const REST_ZOOM = 1;

function colourUniform(hex: string): { value: readonly number[]; type: typeof COLOUR_TYPE } {
  return { value: hexToRgb(hex), type: COLOUR_TYPE };
}

/** The VISUAL-STYLE §2 colours the bands paint, one uniform each (the palette shades come from the texture). */
const COLOUR_UNIFORMS: Readonly<Record<string, string>> = {
  [CELL_UNIFORM.white]: WHITE,
  [CELL_UNIFORM.outline]: OUTLINE,
  [CELL_UNIFORM.chloroLight]: CHLORO_LIGHT,
  [CELL_UNIFORM.toxinGlow]: TOXIN_GLOW,
  [CELL_UNIFORM.ribosome]: RIBOSOME,
  [CELL_UNIFORM.cytoskeleton]: CYTOSKELETON,
  [CELL_UNIFORM.cellWall]: CELL_WALL,
  [CELL_UNIFORM.cellWallLight]: CELL_WALL_LIGHT,
  [CELL_UNIFORM.cilia]: CILIA,
  [CELL_UNIFORM.danger]: DANGER,
};

function createUniforms(pass: number): UniformGroup {
  const colours = Object.fromEntries(Object.entries(COLOUR_UNIFORMS).map(([name, hex]) => [name, colourUniform(hex)]));
  return new UniformGroup({
    [CELL_UNIFORM.timeSeconds]: { value: 0, type: FLOAT_TYPE },
    [CELL_UNIFORM.zoom]: { value: REST_ZOOM, type: FLOAT_TYPE },
    [CELL_UNIFORM.pass]: { value: pass, type: FLOAT_TYPE },
    ...colours,
  });
}

export class CellMesh {
  /** Pass A: the bodies, drawn under the organelle sprites. */
  readonly bodyPass: CellPassMesh;
  /** Pass B: the membranes and tells, drawn over them. */
  readonly membranePass: CellPassMesh;
  /** The instance rows the layer packs, `CELL_INSTANCE_FLOATS` wide each. */
  readonly instances: Float32Array;
  private readonly instanceSource: TextureSource;
  private readonly geometry: Geometry;
  private readonly bodyUniforms: UniformGroup;
  private readonly membraneUniforms: UniformGroup;

  constructor(
    textures: CellMeshTextures,
    readonly capacity: number = CELL_INSTANCE_CAPACITY,
  ) {
    this.instances = createInstanceBuffer(capacity);
    this.instanceSource = floatDataTexture(this.instances, CELL_INSTANCE_TEXELS, capacity);
    const indices = Float32Array.from({ length: capacity }, (_unused, index) => index);
    this.geometry = new Geometry({
      attributes: {
        aPosition: { buffer: new Float32Array(CELL_QUAD_POSITIONS), format: 'float32x2' },
        aInstanceIndex: { buffer: indices, format: 'float32', instance: true },
      },
      indexBuffer: new Uint16Array(CELL_QUAD_INDICES),
      instanceCount: 0,
    });
    const program = new GlProgram({ vertex: CELL_VERTEX_SOURCE, fragment: CELL_FRAGMENT_SOURCE });
    this.bodyUniforms = createUniforms(CELL_PASS.body);
    this.membraneUniforms = createUniforms(CELL_PASS.membrane);
    this.bodyPass = this.createPass(program, textures, this.bodyUniforms);
    this.membranePass = this.createPass(program, textures, this.membraneUniforms);
  }

  private createPass(program: GlProgram, textures: CellMeshTextures, uniforms: UniformGroup): CellPassMesh {
    const shader = new Shader({
      glProgram: program,
      resources: {
        [CELL_UNIFORM.instances]: this.instanceSource,
        [CELL_UNIFORM.strip]: textures.stripTexture,
        [CELL_UNIFORM.tile]: textures.tileTexture,
        [CELL_UNIFORM.palette]: textures.paletteTexture,
        [CELL_UNIFORM_GROUP]: uniforms,
      },
    });
    const mesh = new Mesh({ geometry: this.geometry, shader, state: State.for2d() });
    mesh.visible = false;
    return mesh;
  }

  /** How many instances the next draw covers; nothing draws at 0. */
  setCount(count: number): void {
    const clamped = Math.min(count, this.capacity);
    this.geometry.instanceCount = clamped;
    this.bodyPass.visible = clamped > 0;
    this.membranePass.visible = clamped > 0;
  }

  get count(): number {
    return this.geometry.instanceCount;
  }

  /** Re-uploads the instance rows after the layer wrote them. */
  upload(): void {
    this.instanceSource.update();
  }

  setFrame(timeSeconds: number, zoom: number): void {
    for (const uniforms of [this.bodyUniforms, this.membraneUniforms]) {
      uniforms.uniforms[CELL_UNIFORM.timeSeconds] = timeSeconds;
      uniforms.uniforms[CELL_UNIFORM.zoom] = zoom;
      uniforms.update();
    }
  }

  /** The frame uniforms as set, for a test or the bench. */
  get frame(): { readonly timeSeconds: number; readonly zoom: number } {
    return {
      timeSeconds: this.bodyUniforms.uniforms[CELL_UNIFORM.timeSeconds] as number,
      zoom: this.bodyUniforms.uniforms[CELL_UNIFORM.zoom] as number,
    };
  }

  /** Shaders first (they bind the textures; the shared program goes with the first), then the geometry and the instance texture. */
  destroy(): void {
    this.bodyPass.shader?.destroy(true);
    this.membranePass.shader?.destroy();
    this.bodyPass.destroy();
    this.membranePass.destroy();
    this.geometry.destroy();
    this.instanceSource.destroy();
  }
}
