// The kelp band (docs/rendering/opening-dive.md §4): six meshes for the dive's own Pixi stage (one WebGL context), its
// programs compiled unseen into a pixel of their own as it opens; hidden, and a fall held above its band, until its
// bakes and the shore's tiles have landed; then its textures made once and uploaded unseen; each frame only the parts
// its frame shows; and every GPU object given back on destroy, the bakes kept.

import type { TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { DIVE_KELP_WINDOW } from '../../constants';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { quickKelpBake } from '../../../../../testing/kelp-builder';
import { TEST_SHORE_LAND, bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { diveViewAt } from '../dive-view';
import type { ShoreTileSource } from '../shore/shore-tiles';
import { DiveKelpBand } from './dive-kelp-band';
import { KelpBakes } from './kelp-bakes';
import { KELP_UNIFORM_GROUP } from './kelp-programs';
import { KELP_ROCK_UNIFORM } from './kelp-shader-rock-surface';

const VIEWPORT = { width: 830, height: 467 };
const view = (zoom: number) =>
  diveViewAt({ zoom, viewport: VIEWPORT, timeSeconds: 0, isMoving: false, globeIdleSpinDegrees: 0 });

function band(tiles: ShoreTileSource = bakedTestTiles()) {
  const pixi = createFakePixiApp(VIEWPORT);
  const bakes = new KelpBakes({ land: TEST_SHORE_LAND, factory: createFakeShoreCanvasFactory() }, quickKelpBake());
  const subject = new DiveKelpBand({ bakes, tiles }, (container, target) => pixi.renderToTexture(container, target));
  pixi.app.stage.addChild(subject.view);
  return { subject, pixi, bakes };
}

function bake(bakes: KelpBakes): void {
  while (!bakes.isBaked) bakes.pump(Number.POSITIVE_INFINITY, () => 0);
}

describe('DiveKelpBand', () => {
  it('compiles its programs once, unseen, into a pixel of its own, every mesh drawn and then hidden again', () => {
    const { subject, pixi } = band();
    expect(pixi.textureRenders).toHaveLength(1);
    expect(pixi.textureRenders[0]!.container).toBe(subject.view);
    expect([pixi.textureRenders[0]!.target.width, pixi.textureRenders[0]!.target.height]).toEqual([1, 1]);
    expect(subject.view.children.every((mesh) => !mesh.visible)).toBe(true);
    subject.destroy();
  });

  it('holds a fall above its band until its bakes and the shore’s tiles land, showing only what needs no bake', () => {
    const tiles = { ...bakedTestTiles(), isBaked: false } as ShoreTileSource;
    const { subject, bakes } = band(tiles);
    expect(subject.isReady).toBe(false);
    expect(subject.fallFloorZoom).toBe(DIVE_KELP_WINDOW.fadeFromZoom);
    const visible = (): boolean[] => subject.view.children.map((mesh) => mesh.visible);
    // a scrub to 10 m before the bakes: the blades and the bulb, not the rock (its outline is a bake)
    expect(subject.draw(view(1))).toBe(true);
    expect(visible()).toEqual([false, true, true, true, false, false]);
    bake(bakes);
    expect(subject.isReady).toBe(false);
    // inside the blade: the floor and the drop, which need no bake either
    expect(subject.draw(view(-2))).toBe(true);
    expect(visible()).toEqual([false, false, false, false, true, true]);
    expect(subject.draw(view(3))).toBe(false);
    subject.destroy();
  });

  it('once ready, makes and binds its textures once and uploads them unseen, then never holds a fall', () => {
    const { subject, pixi, bakes } = band();
    bake(bakes);
    expect(subject.isReady).toBe(true);
    expect(subject.fallFloorZoom).toBe(Number.NEGATIVE_INFINITY);
    subject.draw(view(6));
    expect(pixi.textureRenders).toHaveLength(2);
    const rock = subject.view.children[0] as unknown as { shader: { resources: Record<string, unknown> } };
    const bound = rock.shader.resources[KELP_ROCK_UNIFORM.rockDistance];
    subject.draw(view(1));
    expect(pixi.textureRenders).toHaveLength(2);
    expect(rock.shader.resources[KELP_ROCK_UNIFORM.rockDistance]).toBe(bound);
    subject.destroy();
  });

  it('shows only the parts its frame shows: the rock and the kelp at 10 m, the floor and the drop inside the blade', () => {
    const { subject, bakes } = band();
    bake(bakes);
    const [rock, back, bulb, front, floor, lenses] = subject.view.children;
    expect(subject.draw(view(3))).toBe(false);
    expect(subject.draw(view(1))).toBe(true);
    expect([rock, back, bulb, front, floor, lenses].map((mesh) => mesh!.visible)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(subject.draw(view(-2))).toBe(true);
    expect([rock, back, bulb, front, floor, lenses].map((mesh) => mesh!.visible)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(subject.draw(view(-3.2))).toBe(false);
    expect(lenses!.visible).toBe(false);
    subject.destroy();
  });

  it('writes the frame into its programs: the view, and the band’s fade', () => {
    const { subject, bakes } = band();
    bake(bakes);
    subject.draw(view(2.3));
    const rock = subject.view.children[0] as unknown as {
      shader: { resources: Record<string, { uniforms: Record<string, Float32Array> }> };
    };
    const uniforms = rock.shader.resources[KELP_UNIFORM_GROUP]!.uniforms;
    expect(uniforms['uView']![0]).toBe(VIEWPORT.width);
    expect(uniforms['uFrame']![1]).toBeCloseTo(view(2.3).bands.kelp.weight, 6);
    subject.destroy();
  });

  it('gives back its meshes and textures on destroy', () => {
    const { subject, pixi, bakes } = band();
    bake(bakes);
    subject.draw(view(1));
    const rock = subject.view.children[0] as unknown as { shader: { resources: Record<string, TextureSource> } };
    const texture = rock.shader.resources[KELP_ROCK_UNIFORM.rockDistance]!;
    subject.destroy();
    expect(subject.view.destroyed).toBe(true);
    expect(texture.destroyed).toBe(true);
    expect(pixi.app.stage.children).not.toContain(subject.view);
    expect(bakes.isBaked).toBe(true);
  });
});
