// The shore's quad (docs/rendering/opening-dive.md §4): one mesh, every uniform and sampler the GLSL declares bound,
// the level's textures swapped in and out, the frame's numbers packed where the shader reads them.

import { BufferImageSource, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { SHORE_SURF } from '../../constants/dive-shore-live';
import { shoreLiveFrame } from './shore-live';
import { ShoreMesh, type ShoreLevelTextures, type ShoreTileTextures } from './shore-mesh';
import { SHORE_SHADER, SHORE_UNIFORM_GROUP } from './shore-shader-names';
import { SHORE_FRAGMENT_SOURCE, SHORE_VERTEX_SOURCE } from './shore-shader-source';

const PIXI_MATRICES = new Set(['uProjectionMatrix', 'uWorldTransformMatrix', 'uTransformMatrix']);

function source(): BufferImageSource {
  return new BufferImageSource({ resource: new Uint8Array(4), width: 1, height: 1 });
}

function level(halfWidthM: number): ShoreLevelTextures {
  return {
    colour: source(),
    distances: source(),
    stones: null,
    ramp: source(),
    rampScale: { entries: 10, stepM: 0.5 },
    grid: { width: 20, height: 12, cellsPerMetre: 3 },
    halfWidthM,
    halfHeightM: halfWidthM / 2,
  };
}

function tiles(): ShoreTileTextures {
  return {
    caustic: source(),
    swell: source(),
    ripple: source(),
    glint: source(),
    foam: source(),
    floor: source(),
    foamMean: [0.9, 0.95, 0.9, 0.4],
  };
}

function uniformsOf(mesh: ShoreMesh): Record<string, unknown> {
  return (mesh.mesh.shader!.resources[SHORE_UNIFORM_GROUP] as { uniforms: Record<string, unknown> }).uniforms;
}

const COLOURS = { foam: [1, 1, 1], land: [0.1, 0.2, 0.1], sea: [0.05, 0.2, 0.3] };

describe('ShoreMesh', () => {
  it('binds every uniform and sampler the GLSL declares', () => {
    const subject = new ShoreMesh(COLOURS);
    const declared = [
      ...(SHORE_VERTEX_SOURCE + SHORE_FRAGMENT_SOURCE).matchAll(/uniform (?:float|vec[34]|sampler2D|mat3) (\w+)/g),
    ]
      .map((match) => match[1]!)
      .filter((name) => !PIXI_MATRICES.has(name));
    const resources = subject.mesh.shader!.resources;
    const uniforms = uniformsOf(subject);
    for (const name of declared) expect(resources[name] ?? uniforms[name], name).toBeDefined();
    subject.destroy();
  });

  it('is hidden with no level, and shows the level once one is set', () => {
    const subject = new ShoreMesh(COLOURS);
    expect(subject.mesh.visible).toBe(false);
    const coarse = level(100);
    subject.setLevels(coarse, null);
    expect(subject.mesh.visible).toBe(true);
    const resources = subject.mesh.shader!.resources;
    expect(resources[SHORE_SHADER.coarseTexture]).toBe(coarse.colour);
    // with no next level, its slot repeats the level, so nothing of a level let go stays bound
    expect(resources[SHORE_SHADER.fineTexture]).toBe(coarse.colour);
    expect(resources[SHORE_SHADER.stonesTexture]).toBe(Texture.EMPTY.source);
    subject.setLevels(null, null);
    expect(subject.mesh.visible).toBe(false);
    expect(resources[SHORE_SHADER.coarseTexture]).toBe(Texture.EMPTY.source);
    subject.destroy();
  });

  it('packs the level’s numbers where the shader reads them', () => {
    const subject = new ShoreMesh(COLOURS);
    subject.setLevels(level(100), level(70));
    const uniforms = uniformsOf(subject);
    expect([...(uniforms[SHORE_SHADER.coarse] as Float32Array)]).toEqual([100, 50, 70, 35]);
    expect([...(uniforms[SHORE_SHADER.data] as Float32Array)]).toEqual([20, 12, 3, 0]);
    expect([...(uniforms[SHORE_SHADER.level] as Float32Array)].slice(2)).toEqual([0.5, 10]);
    subject.destroy();
  });

  it('packs the frame: the sheets, their strengths, the breakers and the swash', () => {
    const subject = new ShoreMesh(COLOURS);
    subject.setTiles(tiles());
    const live = shoreLiveFrame({ zoom: 1.5, pixelsPerMetre: 26, timeSeconds: 0 });
    subject.update(
      {
        stageWidthPx: 830,
        stageHeightPx: 467,
        pixelsPerMetre: 26,
        landFillWeight: 1,
        bandAlpha: 0.5,
        fineWeight: 0.3,
        live,
      },
      false,
    );
    const uniforms = uniformsOf(subject);
    expect([...(uniforms[SHORE_SHADER.view] as Float32Array)]).toEqual([830, 467, 26, 1]);
    expect(uniforms[SHORE_SHADER.fineWeight]).toBe(0);
    expect(uniforms[SHORE_SHADER.bandAlpha]).toBe(0.5);
    const alphas = uniforms[SHORE_SHADER.sheetAlphas] as Float32Array;
    expect(alphas[7]).toBeCloseTo(live.floor.alpha, 6);
    expect(alphas[2]).toBeCloseTo(live.swell.alpha, 6);
    const breakers = uniforms[SHORE_SHADER.breakers] as Float32Array;
    expect(breakers).toHaveLength(SHORE_SURF.breakers * 4);
    expect(breakers[3 * 4]).toBeCloseTo(live.breakers[3]!.distanceM, 6);
    expect((uniforms[SHORE_SHADER.swash] as Float32Array)[1]).toBeCloseTo(live.breakerReachM, 6);
    expect([...(uniforms[SHORE_SHADER.foamMean] as Float32Array)]).toEqual([0.9, 0.95, 0.9, 0.4].map(Math.fround));
    subject.update(
      {
        stageWidthPx: 830,
        stageHeightPx: 467,
        pixelsPerMetre: 26,
        landFillWeight: 0,
        bandAlpha: 1,
        fineWeight: 0.3,
        live,
      },
      true,
    );
    expect(uniforms[SHORE_SHADER.fineWeight]).toBe(0.3);
    subject.destroy();
  });
});
