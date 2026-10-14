// The planet's GPU objects (docs/rendering/opening-dive.md §4): one quad with the planet shader, drawn into a render
// texture at the planet's own resolution (the sphere's limb at up to 1.5×, the forest at 1×, as the mockup drew them),
// and a sprite that lays that texture over the view on the dive's Pixi stage. The coastline bakes go in as byte
// textures as they land; until then each slot holds one texel of open sea.

import {
  BufferImageSource,
  Geometry,
  GlProgram,
  Mesh,
  RenderTexture,
  Shader,
  Sprite,
  State,
  UniformGroup,
  type Container,
  type TextureSource,
} from 'pixi.js';
import type { ViewportPx } from '../../camera';
import {
  DIVE_PLANET_OPEN_SEA_TEXEL,
  DIVE_PLANET_QUAD,
  DIVE_PLANET_WORLD_BAKE_PX,
  DIVE_PLANET_WORLD_PREVIEW_BAKE_PX,
} from '../../constants';
import { degreesToRadians } from '../../geometry';
import type { DivePlanetBake, DiveRegionBox } from './dive-planet-bakes';
import {
  DIVE_PLANET_FOCUS_EARTH,
  DIVE_PLANET_FOCUS_RADIANS,
  DIVE_PLANET_SUN,
  diveWorldTexelMetres,
  type DivePlanetFrame,
} from './dive-planet-frame';
import {
  DIVE_PLANET_FRAGMENT_SOURCE,
  DIVE_PLANET_UNIFORM as UNIFORM,
  DIVE_PLANET_UNIFORM_GROUP,
  DIVE_PLANET_VERTEX_SOURCE,
} from './dive-planet-shader';

/** Draws `container` into `target`, cleared first: the app's renderer (`PixiAppHandle.renderToTexture`). */
export type RenderToTexture = (container: Container, target: RenderTexture) => void;

/** The three coastline textures the shader reads. */
export type DivePlanetTextureSlot = 'worldSdf' | 'worldPreviewSdf' | 'regionSdf';
const TEXEL_METRES_UNIFORM: Readonly<Record<DivePlanetTextureSlot, string>> = {
  worldSdf: UNIFORM.worldTexelMetres,
  worldPreviewSdf: UNIFORM.worldPreviewTexelMetres,
  regionSdf: UNIFORM.regionTexelMetres,
};
const TEXTURE_SLOTS = Object.keys(TEXEL_METRES_UNIFORM) as DivePlanetTextureSlot[];

const ONE_TEXEL = 1;
const RENDER_RESOLUTION = 1;

const FLOAT = 'f32';
const VEC2 = 'vec2<f32>';
const VEC3 = 'vec3<f32>';
const VEC4 = 'vec4<f32>';
const MAT3 = 'mat3x3<f32>';

function byteTexture(data: Uint8Array, width: number, height: number, slot: DivePlanetTextureSlot): TextureSource {
  return new BufferImageSource({
    resource: data,
    width,
    height,
    format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'linear',
    // The world's bakes wrap round the antimeridian; the region's stops at its box.
    addressModeU: slot === 'regionSdf' ? 'clamp-to-edge' : 'repeat',
    addressModeV: 'clamp-to-edge',
    autoGenerateMipmaps: false,
  });
}

function createUniforms(): UniformGroup {
  return new UniformGroup({
    [UNIFORM.resolutionPx]: { value: [1, 1], type: VEC2 },
    [UNIFORM.radiusPx]: { value: 1, type: FLOAT },
    [UNIFORM.metresPerPixel]: { value: 1, type: FLOAT },
    [UNIFORM.isPlane]: { value: 0, type: FLOAT },
    [UNIFORM.timeSeconds]: { value: 0, type: FLOAT },
    [UNIFORM.landEdge]: { value: 0, type: FLOAT },
    [UNIFORM.clouds]: { value: 0, type: FLOAT },
    [UNIFORM.regionDetail]: { value: 0, type: FLOAT },
    [UNIFORM.crowns]: { value: 0, type: FLOAT },
    [UNIFORM.reliefExaggeration]: { value: 1, type: FLOAT },
    [UNIFORM.viewToEarth]: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), type: MAT3 },
    [UNIFORM.isRegionReady]: { value: 0, type: FLOAT },
    [UNIFORM.worldFineWeight]: { value: 0, type: FLOAT },
    [UNIFORM.focusRadians]: { value: [...DIVE_PLANET_FOCUS_RADIANS], type: VEC2 },
    [UNIFORM.focusEarth]: { value: [...DIVE_PLANET_FOCUS_EARTH], type: VEC3 },
    [UNIFORM.sun]: { value: [...DIVE_PLANET_SUN], type: VEC3 },
    [UNIFORM.regionBoxRadians]: { value: [0, 0, 1, 1], type: VEC4 },
    // Each slot's open-sea placeholder reads as open sea only at a real texel's scale: at 1 m it would read as shallows.
    [UNIFORM.worldTexelMetres]: { value: diveWorldTexelMetres(DIVE_PLANET_WORLD_BAKE_PX.width), type: FLOAT },
    [UNIFORM.worldPreviewTexelMetres]: {
      value: diveWorldTexelMetres(DIVE_PLANET_WORLD_PREVIEW_BAKE_PX.width),
      type: FLOAT,
    },
    [UNIFORM.regionTexelMetres]: { value: diveWorldTexelMetres(DIVE_PLANET_WORLD_BAKE_PX.width), type: FLOAT },
  });
}

export class DivePlanetMesh {
  /** The planet on the stage: the render texture over the whole view. */
  readonly view = new Sprite();
  private readonly geometry = new Geometry({
    attributes: { aPosition: { buffer: new Float32Array(DIVE_PLANET_QUAD.positions), format: 'float32x2' } },
    indexBuffer: new Uint16Array(DIVE_PLANET_QUAD.indices),
  });
  private readonly uniforms = createUniforms();
  private readonly shader: Shader;
  private readonly quad: Mesh<Geometry, Shader>;
  private target: RenderTexture | null = null;

  constructor(regionBox: DiveRegionBox) {
    const resources: Record<string, TextureSource | UniformGroup> = { [DIVE_PLANET_UNIFORM_GROUP]: this.uniforms };
    for (const slot of TEXTURE_SLOTS) {
      resources[UNIFORM[slot]] = byteTexture(new Uint8Array(DIVE_PLANET_OPEN_SEA_TEXEL), ONE_TEXEL, ONE_TEXEL, slot);
    }
    this.shader = new Shader({
      glProgram: new GlProgram({ vertex: DIVE_PLANET_VERTEX_SOURCE, fragment: DIVE_PLANET_FRAGMENT_SOURCE }),
      resources,
    });
    this.quad = new Mesh({ geometry: this.geometry, shader: this.shader, state: State.for2d() });
    this.uniforms.uniforms[UNIFORM.regionBoxRadians] = [
      degreesToRadians(regionBox.west),
      degreesToRadians(regionBox.south),
      degreesToRadians(regionBox.east),
      degreesToRadians(regionBox.north),
    ];
  }

  /** A bake landed: it replaces its slot's texture, and the shader learns its texel's size on the ground. */
  setBake(slot: DivePlanetTextureSlot, bake: DivePlanetBake): void {
    const previous = this.shader.resources[UNIFORM[slot]] as TextureSource;
    this.shader.resources[UNIFORM[slot]] = byteTexture(bake.data, bake.width, bake.height, slot);
    previous.destroy();
    this.uniforms.uniforms[TEXEL_METRES_UNIFORM[slot]] = bake.metresPerTexel;
    this.uniforms.update();
  }

  /** The texture a slot holds now. */
  textureOf(slot: DivePlanetTextureSlot): TextureSource {
    return this.shader.resources[UNIFORM[slot]] as TextureSource;
  }

  /** The frame's uniforms, as set. */
  uniformValue(name: string): unknown {
    return this.uniforms.uniforms[name];
  }

  private setFrame(frame: DivePlanetFrame): void {
    const values = this.uniforms.uniforms;
    values[UNIFORM.resolutionPx] = [...frame.resolutionPx];
    values[UNIFORM.radiusPx] = frame.radiusPx;
    values[UNIFORM.metresPerPixel] = frame.metresPerPixel;
    values[UNIFORM.isPlane] = frame.isPlane;
    values[UNIFORM.timeSeconds] = frame.timeSeconds;
    values[UNIFORM.landEdge] = frame.landEdge;
    values[UNIFORM.clouds] = frame.clouds;
    values[UNIFORM.regionDetail] = frame.regionDetail;
    values[UNIFORM.crowns] = frame.crowns;
    values[UNIFORM.reliefExaggeration] = frame.reliefExaggeration;
    values[UNIFORM.viewToEarth] = frame.viewToEarth;
    values[UNIFORM.isRegionReady] = frame.isRegionReady;
    values[UNIFORM.worldFineWeight] = frame.worldFineWeight;
    this.uniforms.update();
  }

  /** The render texture at the frame's size, made again only when that changes. */
  private targetOf(widthPx: number, heightPx: number): RenderTexture {
    const current = this.target;
    if (current !== null && current.width === widthPx && current.height === heightPx) return current;
    current?.destroy(true);
    this.target = RenderTexture.create({ width: widthPx, height: heightPx, resolution: RENDER_RESOLUTION });
    this.view.texture = this.target;
    return this.target;
  }

  /** Draws the planet for `frame` into its texture and lays that over `viewport`. */
  draw(frame: DivePlanetFrame, viewport: ViewportPx, render: RenderToTexture): void {
    this.setFrame(frame);
    const [widthPx, heightPx] = frame.resolutionPx;
    const target = this.targetOf(widthPx, heightPx);
    this.quad.scale.set(widthPx, heightPx);
    render(this.quad, target);
    this.view.setSize(viewport.width, viewport.height);
  }

  /**
   * The sprite leaves the stage; the quad, its program, the textures and the render target are freed. The shader goes
   * before the textures it binds, or each would warn that it was destroyed while still bound.
   */
  destroy(): void {
    this.view.removeFromParent();
    this.view.destroy();
    const textures = TEXTURE_SLOTS.map((slot) => this.textureOf(slot));
    this.quad.destroy();
    this.shader.destroy(true);
    for (const texture of textures) texture.destroy();
    this.geometry.destroy();
    this.target?.destroy(true);
    this.target = null;
  }
}
