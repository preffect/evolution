import { describe, expect, it } from 'vitest';
import { createFakeTextureBaker } from '../../../../testing/fake-pixi-app';
import { INDICATOR_FONT } from '../constants';
import { LADDER_SILHOUETTE } from '../../state/own-cell-indicators';
import { createIndicatorTextures, destroyIndicatorTextures } from './indicator-textures';
import { endosymbiontTallies, pipBlockKey } from './pip-block-bake';

const FONT_NAMES = [INDICATOR_FONT.value.name, INDICATOR_FONT.label.name];

describe('createIndicatorTextures', () => {
  it('packs every ghost and pip block on one source and gives the label pill its own texture', () => {
    const textures = createIndicatorTextures(createFakeTextureBaker(), 1);
    const [tally] = endosymbiontTallies();
    const frames = [
      textures.ghosts[LADDER_SILHOUETTE.nucleoid]!,
      textures.ghosts[tally!.traitId]!,
      textures.pipBlocks[pipBlockKey(tally!.variant, tally!.required, tally!.required)]!,
    ];
    for (const frame of frames) {
      expect(frame.texture.source).toBe(textures.source);
      expect(frame.widthPx).toBeGreaterThan(0);
    }
    expect(textures.labelPill.texture.source).not.toBe(textures.source);
    expect(textures.labelPill.capWidthPx).toBeGreaterThan(0);
    expect(textures.bakeScale).toBe(1);
  });

  it('installs the two fonts once and uninstalls them when the textures are destroyed', () => {
    const baker = createFakeTextureBaker();
    const textures = createIndicatorTextures(baker, 2);
    expect(baker.installedFonts.map((install) => install.name)).toEqual(FONT_NAMES);
    expect(Object.values(textures.fonts)).toEqual(FONT_NAMES);
    expect(baker.uninstalledFonts).toEqual([]);
    destroyIndicatorTextures(textures);
    expect(baker.uninstalledFonts).toEqual(FONT_NAMES);
    expect(textures.labelPill.texture.destroyed).toBe(true);
    expect(textures.ghosts[LADDER_SILHOUETTE.envelope]!.texture.destroyed).toBe(true);
  });
});
