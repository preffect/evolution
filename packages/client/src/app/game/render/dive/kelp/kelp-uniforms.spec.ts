// What the kelp band's programs are told (docs/rendering/opening-dive.md §4): the apophyses' ends toward their blades,
// the rock's joints, everything the bakes fix bound once, and each frame's view, fades and switches.

import { BufferImageSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { KELP_BULB } from '../../constants/dive-kelp';
import { SHORE_BOULDER } from '../../constants/dive-shore-boulders';
import { diveViewAt } from '../dive-view';
import { boulderJoint } from '../shore/shore-boulder-surface';
import { focalRockPlace } from './kelp-bakes';
import { kelpFrameOf } from './kelp-frame';
import {
  createBulbProgram,
  createFloorProgram,
  createLensProgram,
  createRibbonProgram,
  createRockProgram,
  uniformVector,
} from './kelp-programs';
import { KELP_BULB_UNIFORM } from './kelp-shader-bulb';
import { KELP_LENS_UNIFORM } from './kelp-shader-lens';
import { KELP_RIBBON_UNIFORM } from './kelp-shader-ribbon';
import { KELP_ROCK_UNIFORM } from './kelp-shader-rock-surface';
import type { KelpTextures } from './kelp-textures';
import { apophysisEnds, bindBaked, jointPoints, updateFrame, type KelpPrograms } from './kelp-uniforms';

function programs(): KelpPrograms {
  return {
    rock: createRockProgram(),
    ribbons: createRibbonProgram(),
    bulb: createBulbProgram(),
    floor: createFloorProgram(),
    lenses: createLensProgram(),
  };
}

const view = (zoom: number) =>
  diveViewAt({ zoom, viewport: { width: 830, height: 467 }, timeSeconds: 3, isMoving: false, globeIdleSpinDegrees: 0 });

describe('apophysisEnds and jointPoints', () => {
  it('reaches each apophysis most of the way from the bulb toward its blade, in the bulb’s unit', () => {
    const ends = apophysisEnds();
    expect(ends).toHaveLength(KELP_BULB.apophyses.blades.length * 2);
    for (let index = 0; index < ends.length; index += 2) {
      const reach = Math.hypot(ends[index]!, ends[index + 1]!);
      expect(reach).toBeGreaterThan(0.5);
      expect(reach).toBeLessThan(KELP_BULB.apophyses.alongM / KELP_BULB.radiusM);
    }
  });

  it('flattens the shore’s joints of the rock, every point of each', () => {
    const place = focalRockPlace();
    const points = jointPoints(place);
    const first = boulderJoint(place, 0);
    expect(points).toHaveLength(first.length * 2 * SHORE_BOULDER.joints.count);
    expect(points[2]).toBeCloseTo(first[1]![0], 5);
  });
});

describe('bindBaked and updateFrame', () => {
  it('binds the bakes’ textures by identity and writes each frame’s numbers where the shaders read them', () => {
    const subject = programs();
    const source = (): BufferImageSource => new BufferImageSource({ resource: new Uint8Array(4), width: 1, height: 1 });
    const means = {
      barnacleFar: [0.1, 0.2, 0.3, 0.4],
      rockweedFar: [0.5, 0.5, 0.5, 0.5],
      foam: [1, 1, 1, 0.2],
    } as const;
    const textures = {
      bladeTile: source(),
      rockDistance: source(),
      seaDistance: source(),
      tiles: Object.fromEntries(
        ['rock', 'grain', 'barnacle', 'barnacleFar', 'rockweed', 'rockweedFar', 'foam', 'caustic'].map((name) => [
          name,
          source(),
        ]),
      ),
      means,
    } as unknown as KelpTextures;
    const bake = { data: new Uint8Array(4), width: 1, height: 1, box: [0, 0, 1, 1] as const, metresPerTexel: 0.5 };
    bindBaked(subject, {
      baked: {
        bladeTile: {} as never,
        rock: bake,
        sea: { ...bake, metresPerTexel: 2 },
        isRockOnLandKept: false,
        beads: [],
      },
      textures,
      place: focalRockPlace(),
    });
    expect(subject.rock.shader.resources[KELP_ROCK_UNIFORM.foamTile]).toBe(textures.tiles.foam);
    expect(subject.ribbons.shader.resources[KELP_RIBBON_UNIFORM.bladeTile]).toBe(textures.bladeTile);
    expect([...uniformVector(subject.ribbons, KELP_RIBBON_UNIFORM.texels).slice(0, 2)]).toEqual([0.5, 2]);
    expect([...uniformVector(subject.rock, KELP_ROCK_UNIFORM.means).slice(0, 4)]).toEqual(
      means.barnacleFar.map(Math.fround),
    );
    expect(uniformVector(subject.bulb, KELP_BULB_UNIFORM.apophyses)[0]).toBe(Math.fround(apophysisEnds()[0]!));

    const frame = kelpFrameOf(view(-2.1));
    updateFrame(subject, frame, 2);
    expect([...uniformVector(subject.lenses, 'uView')]).toEqual([830, 467, Math.fround(frame.pixelsPerMetre), 2]);
    expect([...uniformVector(subject.lenses, KELP_LENS_UNIFORM.lens).slice(0, 3)]).toEqual([
      1,
      1,
      Math.fround(frame.dropInside),
    ]);
    expect(uniformVector(subject.ribbons, KELP_RIBBON_UNIFORM.ribbon)[3]).toBe(0);
    expect([...uniformVector(subject.ribbons, KELP_RIBBON_UNIFORM.shown).slice(0, 2)]).toEqual([0, 0]);
    expect(uniformVector(subject.rock, 'uFrame')[0]).toBe(3);
  });
});
