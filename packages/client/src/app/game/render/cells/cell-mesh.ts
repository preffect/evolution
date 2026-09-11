// The one instanced quad every cell is drawn with (docs/RENDERING.md §2.3): a unit quad plus an
// instance-index attribute, the instance rows in a float texture, and the two passes as two
// meshes over one program. The layer packs the rows; this class owns the GPU objects.

import { Container, Geometry, GlProgram, Mesh, Shader, State, UniformGroup, type TextureSource } from 'pixi.js';
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
import { hexToRgb } from '../colour';
import { CELL_INSTANCE_FLOATS, CELL_INSTANCE_TEXELS, createInstanceBuffer } from './cell-instance';
import { CELL_FRAGMENT_SOURCE, CELL_VERTEX_SOURCE } from './cell-shader';
import { CELL_PASS, CELL_UNIFORM } from './cell-shader-source';
import { floatDataTexture } from '../textures/pixi-textures';

export interface CellMeshTextures {
  readonly strip: TextureSource;
  readonly tile: TextureSource;
  readonly palette: TextureSource;
}

function colourUniform(hex: string): { value: readonly number[]; type: 'vec3<f32>' } {
  return { value: hexToRgb(hex), type: 'vec3<f32>' };
}

function createUniforms(pass: number): UniformGroup {
  return new UniformGroup({
    [CELL_UNIFORM.timeSeconds]: { value: 0, type: 'f32' },
    [CELL_UNIFORM.zoom]: { value: 1, type: 'f32' },
    [CELL_UNIFORM.pass]: { value: pass, type: 'f32' },
    [CELL_UNIFORM.white]: colourUniform(WHITE),
    [CELL_UNIFORM.outline]: colourUniform(OUTLINE),
    [CELL_UNIFORM.cilia]: colourUniform(CILIA),
    [CELL_UNIFORM.cellWall]: colourUniform(CELL_WALL),
    [CELL_UNIFORM.cellWallLight]: colourUniform(CELL_WALL_LIGHT),
    [CELL_UNIFORM.ribosome]: colourUniform(RIBOSOME),
    [CELL_UNIFORM.cytoskeleton]: colourUniform(CYTOSKELETON),
    [CELL_UNIFORM.danger]: colourUniform(DANGER),
    [CELL_UNIFORM.chloroLight]: colourUniform(CHLORO_LIGHT),
    [CELL_UNIFORM.toxinGlow]: colourUniform(TOXIN_GLOW),
  });
}

export class CellMesh {
  /** Pass A: the bodies, drawn under the organelle sprites. */
  readonly bodyPass: Mesh<Geometry, Shader>;
  /** Pass B: the membranes and tells, drawn over them. */
  readonly membranePass: Mesh<Geometry, Shader>;
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

  private createPass(program: GlProgram, textures: CellMeshTextures, uniforms: UniformGroup): Mesh<Geometry, Shader> {
    const shader = new Shader({
      glProgram: program,
      resources: {
        [CELL_UNIFORM.instances]: this.instanceSource,
        [CELL_UNIFORM.strip]: textures.strip,
        [CELL_UNIFORM.tile]: textures.tile,
        [CELL_UNIFORM.palette]: textures.palette,
        cellUniforms: uniforms,
      },
    });
    const mesh = new Mesh({ geometry: this.geometry, shader, state: State.for2d() });
    mesh.visible = false;
    return mesh;
  }

  /** The float row for instance `row`, `CELL_INSTANCE_FLOATS` wide. */
  get floatsPerInstance(): number {
    return CELL_INSTANCE_FLOATS;
  }

  /** How many instances the next draw covers; nothing draws at 0. */
  setCount(count: number): void {
    const clamped = Math.min(count, this.capacity);
    this.geometry.instanceCount = clamped;
    this.bodyPass.visible = clamped > 0;
    this.membranePass.visible = clamped > 0;
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

  /** Both passes, so a container can place them around the organelle sprites. */
  get passes(): readonly Container[] {
    return [this.bodyPass, this.membranePass];
  }

  destroy(): void {
    this.bodyPass.destroy();
    this.membranePass.destroy();
    this.geometry.destroy();
    this.instanceSource.destroy();
  }
}
