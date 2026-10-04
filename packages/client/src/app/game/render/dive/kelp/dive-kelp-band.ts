// The boulder, the stranded bull kelp, its spray beads and the drop on the GPU (docs/rendering/opening-dive.md §4,
// ticket #802): from where the kelp fades in over the shore (zoom 2.4) down to inside the drop (−2.96), six meshes on
// the dive's own Pixi stage over the shore's quad, the dive keeping one WebGL context. Nothing is baked per view: the
// rock, the ribbons, the bulb, the blade floor and the lenses are shaders over geometry made once and a few textures
// baked once a page (`kelp-bakes.ts`), so any zoom draws its true picture the frame it is reached. Before ticket #802
// the mockup drew all of it on Canvas 2D every frame.

import { RenderTexture, type Container, type Geometry, type Mesh, type Shader } from 'pixi.js';
import { DIVE_KELP_WINDOW } from '../../constants';
import type { DiveView } from '../dive-view';
import type { RenderToTexture } from '../planet/dive-planet-mesh';
import type { ShoreTileSource } from '../shore/shore-tiles';
import { focalRockPlace, type KelpBakes } from './kelp-bakes';
import { isKelpFrameShown, kelpFrameOf, kelpStandInOf, type KelpFrame } from './kelp-frame';
import { createKelpMeshes, lensGeometry, type KelpMeshSet } from './kelp-meshes';
import {
  createBulbProgram,
  createFloorProgram,
  createLensProgram,
  createRibbonProgram,
  createRockProgram,
} from './kelp-programs';
import { kelpTextures, releaseKelpTextures, type KelpTextures } from './kelp-textures';
import { bindBaked, updateFrame, type KelpPrograms } from './kelp-uniforms';

/** The warm-up's target: one pixel compiles and links the programs, and uploads the textures bound to them. */
const WARM_UP_TARGET_PX = 1;

/** Every part hidden. */
const HIDDEN: Pick<
  KelpFrame,
  'isRockShown' | 'hasBlades' | 'isStipeShown' | 'isBulbShown' | 'isFloorShown' | 'hasBeads' | 'isDropShown'
> = {
  isRockShown: false,
  hasBlades: false,
  isStipeShown: false,
  isBulbShown: false,
  isFloorShown: false,
  hasBeads: false,
  isDropShown: false,
};

/** What the band draws from: its own bakes, and the shore's tiles. */
export interface DiveKelpSources {
  readonly bakes: KelpBakes;
  readonly tiles: ShoreTileSource;
}

export class DiveKelpBand {
  private readonly programs: KelpPrograms = {
    rock: createRockProgram(),
    ribbons: createRibbonProgram(),
    bulb: createBulbProgram(),
    floor: createFloorProgram(),
    lenses: createLensProgram(),
  };
  private readonly meshes: KelpMeshSet;
  private textures: KelpTextures | null = null;

  constructor(
    private readonly sources: DiveKelpSources,
    private readonly devicePixelRatio: number,
    private readonly renderToTexture: RenderToTexture,
  ) {
    const { programs } = this;
    this.meshes = createKelpMeshes({
      rock: programs.rock.shader,
      ribbons: programs.ribbons.shader,
      bulb: programs.bulb.shader,
      floor: programs.floor.shader,
      lenses: programs.lenses.shader,
    });
    this.warmUp();
  }

  /**
   * Draws every mesh once, unseen, into a pixel of its own: the programs compile and link, and the textures bound
   * upload, while the dive is in orbit rather than on the frame the fall reaches the kelp.
   */
  private warmUp(): void {
    const target = RenderTexture.create({ width: WARM_UP_TARGET_PX, height: WARM_UP_TARGET_PX });
    const meshes = this.meshList();
    for (const mesh of meshes) mesh.visible = true;
    this.renderToTexture(this.meshes.root, target);
    for (const mesh of meshes) mesh.visible = false;
    target.destroy(true);
  }

  private meshList(): Mesh<Geometry, Shader>[] {
    const { rock, ribbonsBack, bulb, ribbonsFront, floor, lenses } = this.meshes;
    return [rock, ribbonsBack, bulb, ribbonsFront, floor, lenses];
  }

  /** The meshes, for the dive's stage: over the shore's quad, drawn with the dive's frame. */
  get view(): Container {
    return this.meshes.root;
  }

  /** Its bakes and the shore's tiles are done: the dive can fall into the band. */
  get isReady(): boolean {
    return this.sources.bakes.isBaked && this.sources.tiles.isBaked;
  }

  /** Until it is ready a fall waits above the band; then never. */
  get fallFloorZoom(): number {
    return this.isReady ? Number.NEGATIVE_INFINITY : (DIVE_KELP_WINDOW.fadeFromZoom ?? Number.NEGATIVE_INFINITY);
  }

  /** Once ready, the textures are made and bound and the lenses' geometry built, and all of it uploaded at once. */
  private ensureTextures(): boolean {
    if (this.textures !== null) return true;
    const baked = this.sources.bakes.baked;
    if (baked === null || !this.isReady) return false;
    const textures = kelpTextures(baked, this.sources.tiles);
    if (textures === null) return false;
    this.textures = textures;
    bindBaked(this.programs, { baked, textures, place: focalRockPlace() });
    const lenses = this.meshes.lenses;
    const placeholder: Geometry = lenses.geometry;
    lenses.geometry = lensGeometry(baked.beads);
    placeholder.destroy();
    this.warmUp();
    return true;
  }

  /** Each mesh shown as its frame says; `null` hides them all. */
  private show(frame: KelpFrame | null): void {
    const { rock, ribbonsBack, bulb, ribbonsFront, floor, lenses } = this.meshes;
    const shown = frame ?? HIDDEN;
    rock.visible = shown.isRockShown;
    ribbonsBack.visible = shown.hasBlades || shown.isStipeShown;
    bulb.visible = shown.isBulbShown;
    ribbonsFront.visible = shown.hasBlades;
    floor.visible = shown.isFloorShown;
    lenses.visible = shown.hasBeads || shown.isDropShown;
  }

  /** One frame: its parts set up and shown (the stand-in's until it is ready), or all hidden; answers whether any shows. */
  draw(view: DiveView): boolean {
    const whole = kelpFrameOf(view);
    const frame = this.ensureTextures() ? whole : kelpStandInOf(whole);
    if (!isKelpFrameShown(frame)) {
      this.show(null);
      return false;
    }
    updateFrame(this.programs, frame, this.devicePixelRatio);
    this.show(frame);
    return true;
  }

  /** The meshes leave the stage and every GPU object goes; the bakes stay for the page. */
  destroy(): void {
    const geometries = this.meshList().map((mesh) => mesh.geometry);
    this.meshes.root.destroy({ children: true });
    for (const geometry of new Set(geometries)) geometry.destroy();
    for (const program of Object.values(this.programs)) program.shader.destroy();
    if (this.textures !== null) releaseKelpTextures(this.textures);
    this.textures = null;
  }
}
