// The dive's planet band on the game's renderer (docs/rendering/opening-dive.md §4, ticket #800): the planet, the map
// and the forest from orbit down to the shore, a shader over the real coastlines on the dive's own Pixi app, so the
// dive needs no second WebGL context and never copies the planet into a 2D canvas.
//
// It bakes the coastlines in slices (the world's quick bake first, then the world's and the Salish region's). The
// planet never shows without land: on a cold open it fades in once the quick bake lands, and the world's full bake
// then comes up over the quick one, each across the crossfade (`DiveGlobeCrossfade`), as the mockup's planet came up
// over its flat fallback globe. The bakes are kept for the page (`DivePlanetKeptBakes`), so a return to the lobby
// draws the planet at once.

import type { Clock } from '@evolution/shared';
import type { Container } from 'pixi.js';
import type { DiveBaker } from './dive-bake-pump';
import { DiveGlobeCrossfade } from './dive-globe-crossfade';
import type { DiveView } from './dive-view';
import type { DivePlanetBake, DivePlanetBakeJob, DivePlanetBakePlan } from './planet/dive-planet-bakes';
import { divePlanetFrame } from './planet/dive-planet-frame';
import { DivePlanetMesh, type DivePlanetTextureSlot, type RenderToTexture } from './planet/dive-planet-mesh';
import { DivePlanetResolution } from './planet/dive-planet-resolution';

/** The coastline bakes finished so far, kept for the page by the loader. */
export type DivePlanetKeptBakes = Map<DivePlanetTextureSlot, DivePlanetBake>;

/** What the loader hands the band: the bakes to make, and those already made on an earlier open. */
export interface DivePlanetSource {
  readonly plan: DivePlanetBakePlan;
  readonly kept: DivePlanetKeptBakes;
}

export interface DivePlanetDraw {
  readonly view: DiveView;
  /** The upper bands' ratio cap this frame (`upperBandsDevicePixelRatio`): the planet renders at most at it. */
  readonly bandsRatio: number;
  readonly nowMs: number;
  readonly isMotionReduced: boolean;
}

interface PendingBake {
  readonly slot: DivePlanetTextureSlot;
  readonly make: () => DivePlanetBakeJob;
}

export class DivePlanetBand implements DiveBaker {
  private readonly mesh: DivePlanetMesh;
  private readonly pending: PendingBake[];
  private running: DivePlanetBakeJob | null = null;
  /** The planet itself over the dark, once it has land to draw. */
  private readonly landFade = new DiveGlobeCrossfade();
  /** The world's full coast over its quick one. */
  private readonly crossfade = new DiveGlobeCrossfade();
  private readonly resolution = new DivePlanetResolution();

  constructor(
    private readonly source: DivePlanetSource,
    private readonly clock: Clock,
  ) {
    const { plan, kept } = source;
    this.mesh = new DivePlanetMesh(plan.regionBox);
    for (const [slot, bake] of kept) this.mesh.setBake(slot, bake);
    const order: PendingBake[] = [
      { slot: 'worldPreviewSdf', make: () => plan.worldPreview() },
      { slot: 'worldSdf', make: () => plan.world() },
      { slot: 'regionSdf', make: () => plan.region() },
    ];
    // Once the world's full bake is kept, its quick one is never drawn.
    this.pending = order.filter(({ slot }) => !kept.has(slot) && !(slot === 'worldPreviewSdf' && kept.has('worldSdf')));
  }

  /** The planet on the stage. It and the game's dish are never drawn in the same frame. */
  attachTo(stage: Container): void {
    stage.addChild(this.mesh.view);
  }

  get isBaked(): boolean {
    return this.pending.length === 0;
  }

  /** The planet has land to draw: either of the world's bakes has landed. */
  get hasLand(): boolean {
    return this.source.kept.has('worldPreviewSdf') || this.isPlanetReady;
  }

  /** The world's full bake has landed. */
  get isPlanetReady(): boolean {
    return this.source.kept.has('worldSdf');
  }

  pumpBakes(budgetMs: number): boolean {
    const startedMs = this.clock.nowMilliseconds();
    let hasLanded = false;
    while (this.pending.length > 0 && this.clock.nowMilliseconds() - startedMs < budgetMs) {
      const next = this.pending[0]!;
      this.running ??= next.make();
      const step = this.running.next();
      if (step.done !== true) continue;
      this.source.kept.set(next.slot, step.value);
      this.mesh.setBake(next.slot, step.value);
      this.pending.shift();
      this.running = null;
      hasLanded = true;
    }
    return hasLanded;
  }

  /** Shown while the planet draws under the upper bands; hidden otherwise, and then not drawn. */
  setIsShown(isShown: boolean): void {
    this.mesh.view.visible = isShown;
  }

  /** Draws the planet for this frame into its texture, through the app's renderer. */
  draw(frame: DivePlanetDraw, render: RenderToTexture): void {
    const { view } = frame;
    this.resolution.noteFrame(frame.nowMs);
    const isMotionReduced = frame.isMotionReduced;
    this.mesh.view.alpha = this.landFade.alphaAt({ nowMs: frame.nowMs, isPlanetReady: this.hasLand, isMotionReduced });
    const worldFineWeight = this.crossfade.alphaAt({
      nowMs: frame.nowMs,
      isPlanetReady: this.isPlanetReady,
      isMotionReduced,
    });
    // Until there is land, nothing shows: the shader is not run.
    if (!this.hasLand) return;
    const planetFrame = divePlanetFrame({
      camera: view.camera,
      globeRotation: view.globeRotation,
      timeSeconds: view.timeSeconds,
      ratio: this.resolution.ratioAt(view.camera.zoom, frame.bandsRatio),
      isRegionReady: this.source.kept.has('regionSdf'),
      worldFineWeight,
    });
    this.mesh.draw(planetFrame, view.camera.viewport, render);
  }

  /** The uniforms the last draw set, for a spec. */
  uniformValue(name: string): unknown {
    return this.mesh.uniformValue(name);
  }

  /** The GPU objects go; the kept bakes stay for the next open. A bake in flight starts over then. */
  destroy(): void {
    this.running = null;
    this.mesh.destroy();
  }
}
