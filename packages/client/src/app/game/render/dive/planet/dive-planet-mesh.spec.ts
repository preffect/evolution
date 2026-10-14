// No WebGL under jsdom: the planet's GPU objects build, a bake landing replaces its slot's texture and tells the shader
// its texel's size, a frame's uniforms reach the shader, the planet is drawn into a texture at its own resolution and
// laid over the view, and destroy frees all of it. Compilation is checked in the browser (the dive's evidence run).

import { BufferImageSource, Container, type RenderTexture, type TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { diveCameraAt, diveGlobeRotation } from '../dive-camera';
import { DIVE_PLANET_WORLD_BAKE_PX, DIVE_PLANET_WORLD_PREVIEW_BAKE_PX } from '../../constants';
import { diveWorldTexelMetres, divePlanetFrame } from './dive-planet-frame';
import { DivePlanetMesh } from './dive-planet-mesh';
import { DIVE_PLANET_UNIFORM as UNIFORM } from './dive-planet-shader';

const REGION_BOX = { west: -180, south: 0, east: 180, north: 90 };
const VIEWPORT = { width: 400, height: 200 };

function frameAt(zoom: number, ratio: number) {
  return divePlanetFrame({
    camera: diveCameraAt(zoom, VIEWPORT),
    globeRotation: diveGlobeRotation(zoom),
    timeSeconds: 4,
    ratio,
    isRegionReady: false,
    worldFineWeight: 0.25,
  });
}

function recordingRender(): {
  renders: { container: Container; target: RenderTexture }[];
  render: (container: Container, target: RenderTexture) => void;
} {
  const renders: { container: Container; target: RenderTexture }[] = [];
  return { renders, render: (container, target) => renders.push({ container, target }) };
}

describe('DivePlanetMesh', () => {
  it('starts every coastline slot on one texel of open sea, the world’s wrapping round the antimeridian', () => {
    const mesh = new DivePlanetMesh(REGION_BOX);
    for (const slot of ['worldSdf', 'worldPreviewSdf', 'regionSdf'] as const) {
      const texture = mesh.textureOf(slot) as BufferImageSource;
      expect([texture.width, texture.height]).toEqual([1, 1]);
      expect([...(texture.resource as Uint8Array)]).toEqual([0, 0, 0, 255]);
    }
    expect(mesh.textureOf('worldSdf').style.addressModeU).toBe('repeat');
    expect(mesh.textureOf('regionSdf').style.addressModeU).toBe('clamp-to-edge');
    expect(mesh.uniformValue(UNIFORM.regionBoxRadians)).toEqual([-Math.PI, 0, Math.PI, Math.PI / 2]);
    mesh.destroy();
  });

  it('puts a landed bake in its slot, frees the one it replaces and tells the shader its texel’s size', () => {
    const mesh = new DivePlanetMesh(REGION_BOX);
    const before: TextureSource = mesh.textureOf('worldSdf');
    mesh.setBake('worldSdf', { width: 2, height: 1, data: new Uint8Array(8), metresPerTexel: 19_500 });
    expect(before.destroyed).toBe(true);
    expect([mesh.textureOf('worldSdf').width, mesh.textureOf('worldSdf').height]).toEqual([2, 1]);
    expect(mesh.uniformValue(UNIFORM.worldTexelMetres)).toBe(19_500);
    // The other slots keep their placeholder's real scale, so their open sea reads as deep water, not shallows.
    expect(mesh.uniformValue(UNIFORM.regionTexelMetres)).toBe(diveWorldTexelMetres(DIVE_PLANET_WORLD_BAKE_PX.width));
    expect(mesh.uniformValue(UNIFORM.worldPreviewTexelMetres)).toBe(
      diveWorldTexelMetres(DIVE_PLANET_WORLD_PREVIEW_BAKE_PX.width),
    );
    mesh.destroy();
  });

  it('draws the frame into a texture at its resolution, over the whole view, and sets the frame’s uniforms', () => {
    const mesh = new DivePlanetMesh(REGION_BOX);
    const { renders, render } = recordingRender();
    const frame = frameAt(7, 1.5);
    mesh.draw(frame, VIEWPORT, render);
    expect(renders).toHaveLength(1);
    const [{ container, target }] = renders as [{ container: Container; target: RenderTexture }];
    expect([target.width, target.height]).toEqual([600, 300]);
    expect([container.scale.x, container.scale.y]).toEqual([600, 300]);
    expect(mesh.view.texture).toBe(target);
    expect([mesh.view.width, mesh.view.height]).toEqual([400, 200]);
    expect(mesh.uniformValue(UNIFORM.radiusPx)).toBe(frame.radiusPx);
    expect(mesh.uniformValue(UNIFORM.worldFineWeight)).toBe(0.25);
    expect(mesh.uniformValue(UNIFORM.viewToEarth)).toBe(frame.viewToEarth);
    expect(mesh.uniformValue(UNIFORM.resolutionPx)).toEqual([600, 300]);
    mesh.destroy();
  });

  it('keeps its texture while the size holds, and makes it again (freeing the old) when the resolution changes', () => {
    const mesh = new DivePlanetMesh(REGION_BOX);
    const { renders, render } = recordingRender();
    mesh.draw(frameAt(7, 1.5), VIEWPORT, render);
    mesh.draw(frameAt(6.9, 1.5), VIEWPORT, render);
    expect(renders[1]!.target).toBe(renders[0]!.target);
    mesh.draw(frameAt(4, 1), VIEWPORT, render);
    expect(renders[2]!.target).not.toBe(renders[0]!.target);
    expect(renders[0]!.target.destroyed).toBe(true);
    expect([mesh.view.width, mesh.view.height]).toEqual([400, 200]);
    mesh.destroy();
  });

  it('leaves the stage and frees its textures, its target and its quad on destroy', () => {
    const mesh = new DivePlanetMesh(REGION_BOX);
    const stage = new Container();
    stage.addChild(mesh.view);
    const { renders, render } = recordingRender();
    mesh.draw(frameAt(7, 1), VIEWPORT, render);
    const region = mesh.textureOf('regionSdf');
    mesh.destroy();
    expect(stage.children).toHaveLength(0);
    expect(region.destroyed).toBe(true);
    expect(renders[0]!.target.destroyed).toBe(true);
    expect(renders[0]!.container.destroyed).toBe(true);
  });
});
