// The shore's one quad on the GPU (docs/rendering/opening-dive.md §4, ticket #801): a mesh over the stage with the
// shore shader, the current level's textures (and the next level's colour, crossfading), the sea's tiles and the
// frame's numbers in one uniform group. One draw call a frame, whatever the zoom.

import { Geometry, GlProgram, Mesh, Shader, State, Texture, UniformGroup, type TextureSource } from 'pixi.js';
import { CELL_QUAD_INDICES, CELL_QUAD_POSITIONS } from '../../constants';
import { SHORE_SURF } from '../../constants/dive-shore-live';
import { RGBA_CHANNELS } from '../../colour';
import type { LiveSheet, ShoreLiveFrame } from './shore-live';
import { SHORE_SHADER, SHORE_SHEET_ALPHA_VECTORS, SHORE_SHEET_COUNT, SHORE_UNIFORM_GROUP } from './shore-shader-names';
import { SHORE_FRAGMENT_SOURCE, SHORE_VERTEX_SOURCE } from './shore-shader-source';

const VEC4 = 'vec4<f32>';
const VEC3 = 'vec3<f32>';
const FLOAT = 'f32';

/** A baked level on the GPU: its colour, its distance grid and stones, and the numbers the shader reads it by. */
export interface ShoreLevelTextures {
  readonly colour: TextureSource;
  readonly distances: TextureSource;
  readonly stones: TextureSource | null;
  /** The water's colour and the floor's share by distance (`shore-sea-ramp.ts`), `entries` texels `stepM` apart. */
  readonly ramp: TextureSource;
  readonly rampScale: { readonly entries: number; readonly stepM: number };
  readonly grid: { readonly width: number; readonly height: number; readonly cellsPerMetre: number };
  readonly halfWidthM: number;
  readonly halfHeightM: number;
}

/** The sea's tiles on the GPU, repeating. */
export interface ShoreTileTextures {
  readonly caustic: TextureSource;
  readonly swell: TextureSource;
  readonly ripple: TextureSource;
  readonly glint: TextureSource;
  readonly foam: TextureSource;
  readonly floor: TextureSource;
  /** The foam tile's mean colour (0–1) and coverage. */
  readonly foamMean: readonly [number, number, number, number];
}

/** What the quad draws this frame besides the live sea. */
export interface ShoreMeshFrame {
  readonly stageWidthPx: number;
  readonly stageHeightPx: number;
  readonly pixelsPerMetre: number;
  readonly landFillWeight: number;
  readonly bandAlpha: number;
  readonly fineWeight: number;
  readonly live: ShoreLiveFrame;
}

/** The colours the shader lays: the foam, the flat forest and the deep sea, 0–1. */
export interface ShoreMeshColours {
  readonly foam: readonly number[];
  readonly land: readonly number[];
  readonly sea: readonly number[];
}

function vector(size: number): Float32Array {
  return new Float32Array(size * RGBA_CHANNELS);
}

function createUniforms(colours: ShoreMeshColours): UniformGroup {
  return new UniformGroup({
    [SHORE_SHADER.view]: { value: vector(1), type: VEC4 },
    [SHORE_SHADER.coarse]: { value: vector(1), type: VEC4 },
    [SHORE_SHADER.fineWeight]: { value: 0, type: FLOAT },
    [SHORE_SHADER.bandAlpha]: { value: 0, type: FLOAT },
    [SHORE_SHADER.data]: { value: vector(1), type: VEC4 },
    [SHORE_SHADER.level]: { value: vector(1), type: VEC4 },
    [SHORE_SHADER.sheets]: { value: vector(SHORE_SHEET_COUNT), type: VEC4, size: SHORE_SHEET_COUNT },
    [SHORE_SHADER.sheetAlphas]: {
      value: vector(SHORE_SHEET_ALPHA_VECTORS),
      type: VEC4,
      size: SHORE_SHEET_ALPHA_VECTORS,
    },
    [SHORE_SHADER.breakers]: { value: vector(SHORE_SURF.breakers), type: VEC4, size: SHORE_SURF.breakers },
    [SHORE_SHADER.surf]: { value: vector(1), type: VEC4 },
    [SHORE_SHADER.swash]: { value: vector(1), type: VEC4 },
    [SHORE_SHADER.foamMean]: { value: vector(1), type: VEC4 },
    [SHORE_SHADER.foamColour]: { value: Float32Array.from(colours.foam), type: VEC3 },
    [SHORE_SHADER.landColour]: { value: Float32Array.from(colours.land), type: VEC3 },
    [SHORE_SHADER.seaColour]: { value: Float32Array.from(colours.sea), type: VEC3 },
  });
}

/** The sheets in the shader's order: two caustics, the swell, two ripples, two glints, the floor. */
function sheetsOf(live: ShoreLiveFrame): readonly LiveSheet[] {
  return [...live.caustics, live.swell, ...live.ripples, ...live.glints, live.floor];
}

const LEVEL_TEXTURE_NAMES = [
  SHORE_SHADER.coarseTexture,
  SHORE_SHADER.fineTexture,
  SHORE_SHADER.dataTexture,
  SHORE_SHADER.stonesTexture,
  SHORE_SHADER.rampTexture,
];

const TEXTURE_NAMES = [
  ...LEVEL_TEXTURE_NAMES,
  SHORE_SHADER.causticTexture,
  SHORE_SHADER.swellTexture,
  SHORE_SHADER.rippleTexture,
  SHORE_SHADER.glintTexture,
  SHORE_SHADER.foamTexture,
  SHORE_SHADER.floorTexture,
];

export class ShoreMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  private readonly uniforms: UniformGroup;
  private readonly geometry: Geometry;
  private readonly shader: Shader;

  constructor(colours: ShoreMeshColours) {
    this.geometry = new Geometry({
      attributes: { aPosition: { buffer: new Float32Array(CELL_QUAD_POSITIONS), format: 'float32x2' } },
      indexBuffer: new Uint16Array(CELL_QUAD_INDICES),
    });
    this.uniforms = createUniforms(colours);
    const resources: Record<string, UniformGroup | TextureSource> = { [SHORE_UNIFORM_GROUP]: this.uniforms };
    for (const name of TEXTURE_NAMES) resources[name] = Texture.EMPTY.source;
    this.shader = new Shader({
      glProgram: new GlProgram({ vertex: SHORE_VERTEX_SOURCE, fragment: SHORE_FRAGMENT_SOURCE }),
      resources,
    });
    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader, state: State.for2d() });
    this.mesh.visible = false;
  }

  private bind(name: string, source: TextureSource): void {
    (this.shader.resources as Record<string, unknown>)[name] = source;
  }

  private vector(name: string): Float32Array {
    return this.uniforms.uniforms[name] as Float32Array;
  }

  /** The sea's tiles, once they have baked. */
  setTiles(tiles: ShoreTileTextures): void {
    this.bind(SHORE_SHADER.causticTexture, tiles.caustic);
    this.bind(SHORE_SHADER.swellTexture, tiles.swell);
    this.bind(SHORE_SHADER.rippleTexture, tiles.ripple);
    this.bind(SHORE_SHADER.glintTexture, tiles.glint);
    this.bind(SHORE_SHADER.foamTexture, tiles.foam);
    this.bind(SHORE_SHADER.floorTexture, tiles.floor);
    this.vector(SHORE_SHADER.foamMean).set(tiles.foamMean);
  }

  /** The level to draw and the next one crossfading in (`null` when it has not baked); hidden with no level. */
  setLevels(coarse: ShoreLevelTextures | null, fine: ShoreLevelTextures | null): void {
    this.mesh.visible = coarse !== null;
    if (coarse === null) {
      // nothing of a level the camera has left stays bound: its textures are about to be given back
      for (const name of LEVEL_TEXTURE_NAMES) this.bind(name, Texture.EMPTY.source);
      return;
    }
    this.bind(SHORE_SHADER.coarseTexture, coarse.colour);
    this.bind(SHORE_SHADER.dataTexture, coarse.distances);
    this.bind(SHORE_SHADER.stonesTexture, coarse.stones ?? Texture.EMPTY.source);
    this.bind(SHORE_SHADER.rampTexture, coarse.ramp);
    // with no next level the crossfade's weight is 0 and its slot repeats the level, so nothing stale stays bound
    const next = fine ?? coarse;
    this.bind(SHORE_SHADER.fineTexture, next.colour);
    this.vector(SHORE_SHADER.coarse).set([coarse.halfWidthM, coarse.halfHeightM, next.halfWidthM, next.halfHeightM]);
    const grid = coarse.grid;
    this.vector(SHORE_SHADER.data).set([grid.width, grid.height, grid.cellsPerMetre, coarse.stones === null ? 0 : 1]);
    this.vector(SHORE_SHADER.level).set([0, 0, coarse.rampScale.stepM, coarse.rampScale.entries]);
  }

  /** The frame's numbers; the quad spans the stage. */
  update(frame: ShoreMeshFrame, hasFine: boolean): void {
    const uniforms = this.uniforms.uniforms;
    this.vector(SHORE_SHADER.view).set([
      frame.stageWidthPx,
      frame.stageHeightPx,
      frame.pixelsPerMetre,
      frame.landFillWeight,
    ]);
    uniforms[SHORE_SHADER.fineWeight] = hasFine ? frame.fineWeight : 0;
    uniforms[SHORE_SHADER.bandAlpha] = frame.bandAlpha;
    const live = frame.live;
    const sheets = sheetsOf(live);
    const placements = this.vector(SHORE_SHADER.sheets);
    sheets.forEach((sheet, index) =>
      placements.set([sheet.tileM, sheet.turn, sheet.offsetX, sheet.offsetY], index * RGBA_CHANNELS),
    );
    this.vector(SHORE_SHADER.sheetAlphas).set(sheets.map((sheet) => sheet.alpha));
    const breakers = this.vector(SHORE_SHADER.breakers);
    live.breakers.forEach((breaker, index) =>
      breakers.set([breaker.distanceM, breaker.alpha, breaker.widthM, breaker.dashOffsetM], index * RGBA_CHANNELS),
    );
    this.vector(SHORE_SHADER.surf).set([
      live.isSurfOn ? 1 : 0,
      live.laceTileWeight,
      live.swash.distanceM,
      live.swash.laceWidthM,
    ]);
    this.vector(SHORE_SHADER.swash).set([live.swash.laceTileWeight, live.breakerReachM, 0, 0]);
    this.uniforms.update();
  }

  destroy(): void {
    this.mesh.destroy();
    this.shader.destroy(true);
    this.geometry.destroy();
  }
}
