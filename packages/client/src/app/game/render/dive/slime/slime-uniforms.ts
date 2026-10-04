// What the slime band's programs are told (docs/rendering/opening-dive.md §4, ticket #803): once, the textures and
// where each diatom picture sits in its atlas; each frame, the view, the fades, the drop's clip, the floor's alphas and
// caustic drift, the pocket's and the skin's widths.

import type { TextureSource } from 'pixi.js';
import { RGBA_CHANNELS } from '../../colour';
import { KELP_DROP } from '../../constants/dive-kelp-drop';
import type { DiatomAtlas } from './slime-atlases';
import type { SlimeFrame } from './slime-frame';
import { bindTexture, everySlimeProgram, uniformVector, type SlimePrograms } from './slime-programs';
import { SLIME_BACTERIA_UNIFORM } from './slime-shader-bacteria';
import { SLIME_COMMON_UNIFORM } from './slime-shader-common';
import { SLIME_DIATOM_UNIFORM } from './slime-shader-diatoms';
import { SLIME_FLOOR_UNIFORM } from './slime-shader-floor';
import { SLIME_POCKET_UNIFORM } from './slime-shader-pocket';
import type { SlimeTextures } from './slime-textures';

const flag = (isOn: boolean): number => (isOn ? 1 : 0);

/** The atlas's pictures' places, packed for `uDiatomEntries`. */
export function diatomEntries(atlas: DiatomAtlas): Float32Array {
  const packed = new Float32Array(atlas.entries.length * RGBA_CHANNELS);
  atlas.entries.forEach((entry, index) => {
    const { x, y, width, height } = entry.rect;
    packed.set([x, y, width, height], index * RGBA_CHANNELS);
  });
  return packed;
}

/** What never changes once the bakes land: the textures and the diatoms' places in their atlas. */
export function bindSlimeBaked(programs: SlimePrograms, textures: SlimeTextures, atlas: DiatomAtlas): void {
  const { floor, diatoms, rods, motes } = programs;
  bindTexture(floor, SLIME_FLOOR_UNIFORM.cells, textures.cells);
  bindTexture(floor, SLIME_FLOOR_UNIFORM.cellsDark, textures.cellsDark);
  bindTexture(diatoms, SLIME_DIATOM_UNIFORM.atlas, textures.diatoms);
  uniformVector(diatoms, SLIME_DIATOM_UNIFORM.entries).set(diatomEntries(atlas));
  for (const program of [rods, motes]) bindTexture(program, SLIME_BACTERIA_UNIFORM.atlas, textures.bacteria);
}

/** The shore's caustic tile, as soon as it has baked (before the band's own bakes, for the stand-in too). */
export function bindSlimeCaustic(programs: SlimePrograms, caustic: TextureSource): void {
  bindTexture(programs.floor, SLIME_FLOOR_UNIFORM.caustic, caustic);
}

/** The frame's numbers into every program. */
export function updateSlimeFrame(
  programs: SlimePrograms,
  frame: SlimeFrame,
  input: { readonly devicePixelRatio: number; readonly hasCells: boolean; readonly hasCaustic: boolean },
): void {
  const view = [frame.stageWidthPx, frame.stageHeightPx, frame.pixelsPerMetre, input.devicePixelRatio];
  const frameVector = [frame.timeSeconds, frame.slimeAlpha, frame.darkField, frame.zoom];
  const drop = [KELP_DROP.x, KELP_DROP.y, KELP_DROP.radiusM, flag(frame.isEdgeShown)];
  const all = everySlimeProgram(programs);
  for (const program of all) {
    uniformVector(program, SLIME_COMMON_UNIFORM.view).set(view);
    uniformVector(program, SLIME_COMMON_UNIFORM.frame).set(frameVector);
    const dropVector = program.uniforms.uniforms[SLIME_COMMON_UNIFORM.drop] as Float32Array | undefined;
    dropVector?.set(drop);
  }
  const causticAlpha = input.hasCaustic ? frame.causticAlpha : 0;
  uniformVector(programs.floor, SLIME_FLOOR_UNIFORM.floor).set([
    frame.cellAlpha,
    causticAlpha,
    flag(frame.isOverTheDrop),
    flag(input.hasCells),
  ]);
  uniformVector(programs.floor, SLIME_FLOOR_UNIFORM.caustics).set(frame.caustics);
  const { pocket, skin } = frame;
  uniformVector(programs.pocket, SLIME_POCKET_UNIFORM.quad).set([0, 0, pocket.reachM]);
  uniformVector(programs.pocket, SLIME_POCKET_UNIFORM.pocket).set([
    pocket.ringRadii,
    pocket.rimRadii,
    pocket.accentRadii,
    pocket.alpha,
  ]);
  uniformVector(programs.skin, SLIME_POCKET_UNIFORM.quad).set([KELP_DROP.x, KELP_DROP.y, skin.reachM]);
  uniformVector(programs.skin, SLIME_POCKET_UNIFORM.skin).set([skin.lineM, skin.bandM, skin.insetM, frame.slimeAlpha]);
  for (const program of all) program.uniforms.update();
}
