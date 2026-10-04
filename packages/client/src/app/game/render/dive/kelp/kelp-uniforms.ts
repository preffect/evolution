// What the kelp band's programs are told (docs/rendering/opening-dive.md §4, ticket #802): once, where the rock and its
// joints are, the bakes' boxes and the textures; each frame, the view, the fades, and which parts draw.

import { RGBA_CHANNELS } from '../../colour';
import { KELP_BLADE_COVER, KELP_BULB, KELP_SPLINE, KELP_VECTOR_LANE } from '../../constants/dive-kelp';
import { KELP_DROP } from '../../constants/dive-kelp-drop';
import { SHORE_BOULDER } from '../../constants/dive-shore-boulders';
import { boulderJoint } from '../shore/shore-boulder-surface';
import type { BlobPlace } from '../shore/shore-shapes';
import type { KelpBaked } from './kelp-bakes';
import type { KelpFrame } from './kelp-frame';
import { boxUniform } from './kelp-outline';
import { bindTexture, uniformVector, type KelpProgram } from './kelp-programs';
import { kelpBlades } from './kelp-ribbons';
import { KELP_BULB_UNIFORM } from './kelp-shader-bulb';
import { KELP_COMMON_UNIFORM } from './kelp-shader-common';
import { KELP_FLOOR_UNIFORM } from './kelp-shader-floor';
import { KELP_LENS_UNIFORM } from './kelp-shader-lens';
import { KELP_RIBBON_UNIFORM } from './kelp-shader-ribbon';
import { KELP_ROCK_MEAN, KELP_ROCK_UNIFORM } from './kelp-shader-rock-surface';
import type { KelpTextures } from './kelp-textures';

export interface KelpPrograms {
  readonly rock: KelpProgram;
  readonly ribbons: KelpProgram;
  readonly bulb: KelpProgram;
  readonly floor: KelpProgram;
  readonly lenses: KelpProgram;
}

const flag = (isOn: boolean): number => (isOn ? 1 : 0);

/** Each apophysis's far end in the bulb's unit (`lerp(x, p.x, .7)` toward sample `.1 / .003` of its blade). */
export function apophysisEnds(): Float32Array {
  const blades = kelpBlades();
  const { apophyses, x, y, radiusM } = KELP_BULB;
  const along = Math.round(apophyses.alongM / KELP_SPLINE.bladeStepM);
  return Float32Array.from(
    apophyses.blades.flatMap((blade) => {
      const samples = blades[blade]?.samples ?? [];
      const sample = samples[Math.min(samples.length - 1, along)];
      if (sample === undefined) return [0, 0];
      return [((sample.x - x) * apophyses.reach) / radiusM, ((sample.y - y) * apophyses.reach) / radiusM];
    }),
  );
}

/** The rock's joints' points, flat. */
export function jointPoints(place: BlobPlace): Float32Array {
  const points: number[] = [];
  for (let joint = 0; joint < SHORE_BOULDER.joints.count; joint += 1) {
    for (const [pointX, pointY] of boulderJoint(place, joint)) points.push(pointX, pointY);
  }
  return Float32Array.from(points);
}

/** What never changes once the bakes land: the rock's place, the boxes, the textures. */
export function bindBaked(
  programs: KelpPrograms,
  input: { readonly baked: KelpBaked; readonly textures: KelpTextures; readonly place: BlobPlace },
): void {
  const { baked, textures, place } = input;
  const { rock, ribbons, bulb, floor, lenses } = programs;
  for (const program of [rock, ribbons]) {
    uniformVector(program, KELP_ROCK_UNIFORM.rockBox).set(boxUniform(baked.rock));
    uniformVector(program, KELP_ROCK_UNIFORM.seaBox).set(boxUniform(baked.sea));
    uniformVector(program, KELP_ROCK_UNIFORM.texels).set([baked.rock.metresPerTexel, baked.sea.metresPerTexel]);
    bindTexture(program, KELP_ROCK_UNIFORM.rockDistance, textures.rockDistance);
    bindTexture(program, KELP_ROCK_UNIFORM.seaDistance, textures.seaDistance);
  }
  uniformVector(rock, KELP_ROCK_UNIFORM.rock).set([place.x, place.y, place.radius, place.squash]);
  const cover = uniformVector(rock, KELP_ROCK_UNIFORM.cover);
  cover.set(boxUniform(baked.bladeCover));
  cover.set([baked.bladeCover.metresPerTexel, KELP_BLADE_COVER.insetM], RGBA_CHANNELS);
  bindTexture(rock, KELP_ROCK_UNIFORM.bladeCover, textures.bladeCover);
  uniformVector(rock, KELP_ROCK_UNIFORM.joints).set(jointPoints(place));
  const means = uniformVector(rock, KELP_ROCK_UNIFORM.means);
  means.set(textures.means.barnacleFar, KELP_ROCK_MEAN.barnacleFar * RGBA_CHANNELS);
  means.set(textures.means.rockweedFar, KELP_ROCK_MEAN.rockweedFar * RGBA_CHANNELS);
  means.set(textures.means.foam, KELP_ROCK_MEAN.foam * RGBA_CHANNELS);
  const tiles = textures.tiles;
  bindTexture(rock, KELP_ROCK_UNIFORM.rockTile, tiles.rock);
  bindTexture(rock, KELP_ROCK_UNIFORM.grainTile, tiles.grain);
  bindTexture(rock, KELP_ROCK_UNIFORM.barnacleTile, tiles.barnacle);
  bindTexture(rock, KELP_ROCK_UNIFORM.barnacleFarTile, tiles.barnacleFar);
  bindTexture(rock, KELP_ROCK_UNIFORM.rockweedTile, tiles.rockweed);
  bindTexture(rock, KELP_ROCK_UNIFORM.rockweedFarTile, tiles.rockweedFar);
  bindTexture(rock, KELP_ROCK_UNIFORM.foamTile, tiles.foam);
  bindTexture(rock, KELP_ROCK_UNIFORM.causticTile, tiles.caustic);
  uniformVector(ribbons, KELP_RIBBON_UNIFORM.ribbon)[KELP_VECTOR_LANE.w] = flag(baked.isRockOnLandKept);
  for (const program of [ribbons, floor, lenses])
    bindTexture(program, KELP_FLOOR_UNIFORM.bladeTile, textures.bladeTile);
  uniformVector(bulb, KELP_BULB_UNIFORM.apophyses).set(apophysisEnds());
}

/** The frame's numbers into every program. */
export function updateFrame(programs: KelpPrograms, frame: KelpFrame, devicePixelRatio: number): void {
  const view = [frame.stageWidthPx, frame.stageHeightPx, frame.pixelsPerMetre, devicePixelRatio];
  for (const [program, alpha] of [
    [programs.rock, frame.kelpAlpha],
    [programs.ribbons, frame.kelpAlpha],
    [programs.bulb, frame.kelpAlpha],
    [programs.floor, frame.dropAlpha],
    [programs.lenses, frame.dropAlpha],
  ] as const) {
    uniformVector(program, KELP_COMMON_UNIFORM.view).set(view);
    uniformVector(program, KELP_COMMON_UNIFORM.frame).set([frame.timeSeconds, alpha, 0, frame.zoom]);
  }
  for (const program of [programs.rock, programs.ribbons, programs.floor, programs.lenses]) {
    uniformVector(program, KELP_COMMON_UNIFORM.octaves).set(frame.octaves);
  }
  const ribbon = uniformVector(programs.ribbons, KELP_RIBBON_UNIFORM.ribbon);
  ribbon.set([frame.ribbonReachM, frame.shadowReachM, frame.bladeWidthPx]);
  uniformVector(programs.ribbons, KELP_RIBBON_UNIFORM.shown).set([flag(frame.hasBlades), flag(frame.isStipeShown)]);
  const texels = uniformVector(programs.rock, KELP_ROCK_UNIFORM.texels);
  texels.set([frame.foamAlpha, frame.barnacleAlpha], KELP_VECTOR_LANE.z);
  updateDrop(programs, frame);
  for (const program of Object.values(programs)) program.uniforms.update();
}

/** The beads' and the drop's switches, and the drop for the floor, which leaves its covered inside undrawn. */
function updateDrop(programs: KelpPrograms, frame: KelpFrame): void {
  const isDropShown = flag(frame.isDropShown);
  uniformVector(programs.lenses, KELP_LENS_UNIFORM.lens).set([flag(frame.hasBeads), isDropShown, frame.dropInside]);
  uniformVector(programs.floor, KELP_FLOOR_UNIFORM.drop).set([
    KELP_DROP.x,
    KELP_DROP.y,
    KELP_DROP.radiusM,
    isDropShown,
  ]);
}
