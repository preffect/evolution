import { describe, expect, it } from 'vitest';
import { createFakeTextureBaker } from '../../../../testing/fake-pixi-app';
import { INDICATOR_FONT } from '../constants';
import { CUE_RIM } from '../../hud/format/mass-cues';
import { LADDER_SILHOUETTE } from '../../state/own-cell-ladder';
import { createIndicatorTextures, destroyIndicatorTextures } from './indicator-textures';
import { endosymbiontTallies, pipBlockKey } from './pip-block-bake';

/** The role names each bundle's own font names are built on (`bitmap-fonts.ts` suffixes them per bundle). */
const FONT_ROLE_NAMES = [INDICATOR_FONT.value.name, INDICATOR_FONT.label.name];

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

  /**
   * The names are the bundle's own, not the roles': Pixi's `BitmapFont` cache is process-wide, and the
   * encyclopedia preview (#363) is a second bundle standing beside the room's. What must hold is that this bundle
   * installs and uninstalls exactly the names it reports, and that each still names its role.
   */
  it('installs the two fonts once under its own names and uninstalls exactly those', () => {
    const baker = createFakeTextureBaker();
    const textures = createIndicatorTextures(baker, 2);
    const names = Object.values(textures.fonts);
    expect(baker.installedFonts.map((install) => install.name)).toEqual(names);
    for (const [index, roleName] of FONT_ROLE_NAMES.entries()) expect(names[index]).toContain(roleName);
    expect(baker.uninstalledFonts).toEqual([]);
    destroyIndicatorTextures(textures);
    expect(baker.uninstalledFonts).toEqual(names);
    expect(textures.labelPill.texture.destroyed).toBe(true);
    expect(textures.ghosts[LADDER_SILHOUETTE.envelope]!.texture.destroyed).toBe(true);
  });

  it('packs the cue glyphs on the atlas and gives every cue rim role and the zone pill a texture of its own', () => {
    const textures = createIndicatorTextures(createFakeTextureBaker(), 1);
    expect(textures.trendGlyph.texture.source).toBe(textures.source);
    expect(textures.zoneDot.texture.source).toBe(textures.source);
    const pills = [textures.zonePill, ...Object.values(CUE_RIM).map((rim) => textures.cuePills[rim])];
    expect(new Set(pills.map((pill) => pill.texture)).size).toBe(pills.length);
    for (const pill of pills) expect(pill.texture.source).not.toBe(textures.source);
    destroyIndicatorTextures(textures);
    for (const pill of pills) expect(pill.texture.destroyed).toBe(true);
    expect(textures.trendGlyph.texture.destroyed).toBe(true);
  });
});
