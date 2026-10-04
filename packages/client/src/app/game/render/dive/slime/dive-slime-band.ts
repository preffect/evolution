// The slime inside the drop on the GPU (docs/rendering/opening-dive.md §4, ticket #803): from where it fades in over
// the drop (zoom −1.95) down to inside the dish, meshes on the dive's own Pixi stage, the dive keeping one WebGL
// context. The kelp's surface cells are a tiled texture, the slime and the caustics a shader, the diatoms, bacteria and
// plankton sprites drawn once a page at a ladder of sizes, and the plankton's moving limbs, cilia and flagella strokes
// laid each frame. Before ticket #803 the mockup drew all of it on a Canvas 2D canvas of its own every frame.

import {
  Mesh,
  RenderTexture,
  State,
  Sprite,
  type Container,
  type Geometry,
  type Texture,
  type TextureSource,
} from 'pixi.js';
import { DIVE_SLIME_WINDOW } from '../../constants';
import type { DiveView } from '../dive-view';
import type { RenderToTexture } from '../planet/dive-planet-mesh';
import type { ShoreCanvasFactory } from '../shore/shore-canvas';
import { canvasSource } from '../shore/shore-textures';
import type { ShoreTileSource } from '../shore/shore-tiles';
import type { SlimeBakes } from './slime-bakes';
import { SLIME_MESH_NAMES, SLIME_NOTHING_SHOWN, slimeFrameOf, slimeShownOf, type SlimeShown } from './slime-frame';
import {
  createSlimeMeshes,
  slimeMeshList,
  swapScatterGeometries,
  unitQuadGeometry,
  type SlimeMesh,
  type SlimeMeshSet,
} from './slime-meshes';
import type { SlimeScatters } from './slime-scatter';
import { SlimeOrganisms } from './slime-organisms';
import { createSlimePrograms, everySlimeProgram } from './slime-programs';
import { glowTexture, releaseSlimeTextures, slimeTextures, type SlimeTextures } from './slime-textures';
import { bindSlimeBaked, bindSlimeCaustic, updateSlimeFrame } from './slime-uniforms';

/** The warm-up's target: one pixel compiles and links the programs, and uploads the textures bound to them. */
const WARM_UP_TARGET_PX = 1;

/** What the band draws from: its own bakes (its scatters among them), the shore's caustic tile, a canvas factory. */
export interface DiveSlimeSources {
  readonly bakes: SlimeBakes;
  readonly tiles: ShoreTileSource;
  readonly factory: ShoreCanvasFactory;
}

const NO_SCATTERS: SlimeScatters = { clouds: [], diatoms: [], rods: [], motes: [] };

export class DiveSlimeBand {
  private readonly programs = createSlimePrograms();
  private readonly glow: Texture;
  private readonly pennateQuad: Geometry = unitQuadGeometry();
  private readonly pennates: SlimeMesh[];
  private readonly organisms: SlimeOrganisms;
  private readonly meshes: SlimeMeshSet;
  private textures: SlimeTextures | null = null;
  private caustic: TextureSource | null = null;
  private hasScatters = false;

  constructor(
    private readonly sources: DiveSlimeSources,
    private readonly devicePixelRatio: number,
    private readonly renderToTexture: RenderToTexture,
  ) {
    this.glow = glowTexture(sources.factory);
    const pennates = this.programs.pennates.map((program) => ({
      mesh: new Mesh({ geometry: this.pennateQuad, shader: program.shader, state: State.for2d() }),
      program,
    }));
    this.pennates = pennates.map((pennate) => pennate.mesh);
    this.organisms = new SlimeOrganisms(this.programs.strokes, pennates, this.glow);
    this.meshes = createSlimeMeshes(this.programs, NO_SCATTERS, this.organisms.view);
    this.warmUp([]);
  }

  /**
   * Draws every mesh once, unseen, into a pixel of its own, with a sprite of each of `textures`: the programs compile
   * and link, and the textures upload, while the dive is in orbit rather than on the frame the fall reaches the slime.
   */
  private warmUp(textures: readonly Texture[]): void {
    const target = RenderTexture.create({ width: WARM_UP_TARGET_PX, height: WARM_UP_TARGET_PX });
    const meshes = [...slimeMeshList(this.meshes), ...this.pennates];
    const sprites = textures.map((texture) => new Sprite({ texture }));
    for (const sprite of sprites) this.meshes.root.addChild(sprite);
    for (const mesh of meshes) mesh.visible = true;
    this.renderToTexture(this.meshes.root, target);
    for (const mesh of meshes) mesh.visible = false;
    for (const sprite of sprites) sprite.destroy();
    target.destroy(true);
  }

  /** The meshes, for the dive's stage: over the kelp band's while the drop shows, under the dish. */
  get view(): Container {
    return this.meshes.root;
  }

  /** Its bakes and the shore's caustic tile are done: the dive can fall into the band. */
  get isReady(): boolean {
    return this.sources.bakes.isBaked && this.sources.tiles.get('caustic') !== null;
  }

  /** Until it is ready a fall waits above the band; then never. */
  get fallFloorZoom(): number {
    return this.isReady ? Number.NEGATIVE_INFINITY : (DIVE_SLIME_WINDOW.fadeFromZoom ?? Number.NEGATIVE_INFINITY);
  }

  /** The shore's caustic tile, bound once it has baked: the stand-in's caustics too. */
  private ensureCaustic(): void {
    if (this.caustic !== null) return;
    const tile = this.sources.tiles.get('caustic');
    if (tile === null) return;
    this.caustic = canvasSource(tile.canvas, true);
    bindSlimeCaustic(this.programs, this.caustic);
  }

  /** Once the scatters are made, their quads take the place of the empty ones the band opened with. */
  private ensureScatters(): void {
    const scatters = this.sources.bakes.scatters;
    if (this.hasScatters || scatters === null) return;
    this.hasScatters = true;
    swapScatterGeometries(this.meshes, scatters);
  }

  /** Once ready, the textures are made and bound, and all of them uploaded at once. */
  private ensureTextures(): void {
    const baked = this.sources.bakes.baked;
    if (this.textures !== null || baked === null || !this.isReady) return;
    const textures = slimeTextures(baked);
    this.textures = textures;
    bindSlimeBaked(this.programs, textures, baked.diatoms);
    this.organisms.bind(textures.plankton);
    this.warmUp(Object.values(textures.plankton).flatMap((rungs) => rungs.map((rung) => rung.texture)));
  }

  /** Each mesh shown as `shown` says. */
  private show(shown: SlimeShown): void {
    const meshes = this.meshes;
    for (const name of SLIME_MESH_NAMES) meshes[name].visible = shown[name];
  }

  /** One frame: its parts set up and shown (the stand-in's until it is ready), or all hidden; answers whether it shows. */
  draw(view: DiveView): boolean {
    const frame = slimeFrameOf(view);
    if (!frame.isShown) {
      this.show(SLIME_NOTHING_SHOWN);
      return false;
    }
    this.ensureCaustic();
    this.ensureScatters();
    this.ensureTextures();
    updateSlimeFrame(this.programs, frame, {
      devicePixelRatio: this.devicePixelRatio,
      hasCells: this.textures !== null,
      hasCaustic: this.caustic !== null,
    });
    this.organisms.update(frame);
    this.show(slimeShownOf(frame, this.textures !== null));
    return true;
  }

  /** The meshes leave the stage and every GPU object goes; the bakes and scatters stay for the page. */
  destroy(): void {
    const geometries = [...slimeMeshList(this.meshes), ...this.pennates].map((mesh) => mesh.geometry);
    this.organisms.destroy();
    this.meshes.root.destroy({ children: true });
    for (const geometry of new Set(geometries)) geometry.destroy();
    for (const program of everySlimeProgram(this.programs)) program.shader.destroy();
    if (this.textures !== null) releaseSlimeTextures(this.textures);
    this.textures = null;
    this.caustic?.destroy();
    this.caustic = null;
    this.glow.destroy(true);
  }
}
