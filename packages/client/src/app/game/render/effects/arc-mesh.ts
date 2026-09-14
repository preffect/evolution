// The arc primitive's GPU objects (docs/RENDERING.md §10): one unit quad drawn once per arc row with an
// instance-index attribute, the rows in a small float texture, and one mesh over one program — the
// cell mesh's pattern (`cells/cell-mesh.ts`). Every arc of a frame is one instanced draw call whatever
// the count; at zero rows the mesh hides and draws nothing. The layer that owns the mesh adds `mesh` to
// its container and calls `draw` once per frame.

import { Geometry, GlProgram, Mesh, Shader, State, UniformGroup, type TextureSource } from 'pixi.js';
import { ARC_INSTANCE_CAPACITY, ARC_INSTANCE_TEXELS } from '../constants';
import { createInstancedQuadGeometry } from '../instanced-quad';
import { floatDataTexture } from '../textures/pixi-textures';
import { ARC_INSTANCE_FLOATS, packArcInstances, type ArcInstance } from './arc-instance';
import { ARC_FRAGMENT_SOURCE, ARC_UNIFORM, ARC_UNIFORM_GROUP, ARC_VERTEX_SOURCE } from './arc-shader';

const FLOAT_TYPE = 'f32';
const REST_ZOOM = 1;

export class ArcMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  /** The rows `draw` packs, `ARC_INSTANCE_FLOATS` each. */
  readonly instances: Float32Array;
  private readonly instanceSource: TextureSource;
  private readonly geometry: Geometry;
  private readonly uniforms: UniformGroup;

  constructor(readonly capacity: number = ARC_INSTANCE_CAPACITY) {
    this.instances = new Float32Array(capacity * ARC_INSTANCE_FLOATS);
    this.instanceSource = floatDataTexture(this.instances, ARC_INSTANCE_TEXELS, capacity);
    this.geometry = createInstancedQuadGeometry(capacity);
    this.uniforms = new UniformGroup({ [ARC_UNIFORM.zoom]: { value: REST_ZOOM, type: FLOAT_TYPE } });
    const shader = new Shader({
      glProgram: new GlProgram({ vertex: ARC_VERTEX_SOURCE, fragment: ARC_FRAGMENT_SOURCE }),
      resources: { [ARC_UNIFORM.instances]: this.instanceSource, [ARC_UNIFORM_GROUP]: this.uniforms },
    });
    this.mesh = new Mesh({ geometry: this.geometry, shader, state: State.for2d() });
    this.mesh.visible = false;
  }

  /** Packs the frame's arcs (up to the capacity), uploads them and sets the zoom: one draw call, or none at zero. */
  draw(arcs: readonly ArcInstance[], zoom: number): void {
    const count = packArcInstances(arcs, zoom, this.instances, this.capacity);
    this.geometry.instanceCount = count;
    this.mesh.visible = count > 0;
    this.uniforms.uniforms[ARC_UNIFORM.zoom] = zoom;
    this.uniforms.update();
    this.instanceSource.update();
  }

  /** The rows the next render draws. */
  get count(): number {
    return this.geometry.instanceCount;
  }

  get zoom(): number {
    return this.uniforms.uniforms[ARC_UNIFORM.zoom] as number;
  }

  /** The shader (and its program) before the instance texture it binds, then the mesh and the geometry. */
  destroy(): void {
    this.mesh.shader?.destroy(true);
    this.mesh.destroy();
    this.geometry.destroy();
    this.instanceSource.destroy();
  }
}
