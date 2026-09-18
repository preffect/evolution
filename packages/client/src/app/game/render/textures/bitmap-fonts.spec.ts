import { describe, expect, it } from 'vitest';
import {
  CALLOUT_BACKING,
  INDICATOR_BAKE_MAX_DPR,
  INDICATOR_FONT,
  LEVEL_NUMERAL_OUTLINE_ALPHA,
  LEVEL_NUMERAL_OUTLINE_PX,
  UI_LABEL_TRACKING_EM,
  UI_TYPE,
  WHITE,
} from '../constants';
import {
  indicatorFontInstalls,
  indicatorFontNamesFor,
  installIndicatorFonts,
  uninstallIndicatorFonts,
  type BitmapFontInstall,
  type BitmapFontInstaller,
} from './bitmap-fonts';

/** The label texts ui/hud.md §3.1.2 names: the escape arc's two readings and the threat label. */
const LABEL_TEXTS = ['SPRINT TO ESCAPE', 'SEALED', 'AMOEBOID CAN ENGULF YOU'];
const MAX_LEVEL_TEXT = '12';

function recordingInstaller() {
  const installed: BitmapFontInstall[] = [];
  const uninstalled: string[] = [];
  const installer: BitmapFontInstaller = {
    installBitmapFont: (install) => installed.push(install),
    uninstallBitmapFont: (name) => uninstalled.push(name),
  };
  return { installer, installed, uninstalled };
}

/** One bundle's worth of names, so the spec can talk about an install without owning the counter. */
const FIRST_BUNDLE_NAMES = indicatorFontNamesFor(1);

describe('indicatorFontInstalls', () => {
  const [value, label] = indicatorFontInstalls(1, FIRST_BUNDLE_NAMES);

  it('installs the `value` role for the numeral: mono 20, white on a callout-backing outline 2 px outside the glyph', () => {
    expect(value!.name).toBe(FIRST_BUNDLE_NAMES.value);
    expect(value!.name).toContain(INDICATOR_FONT.value.name);
    expect(value!.style).toMatchObject({ fontFamily: UI_TYPE.value.font, fontSize: UI_TYPE.value.px, fill: WHITE });
    expect(value!.style.stroke).toEqual({
      color: CALLOUT_BACKING,
      alpha: LEVEL_NUMERAL_OUTLINE_ALPHA,
      // Pixi centres the stroke on the glyph edge, under the fill: half of it shows outside.
      width: LEVEL_NUMERAL_OUTLINE_PX * 2,
      join: 'round',
    });
    for (const digit of MAX_LEVEL_TEXT) expect(value!.chars).toContain(digit);
  });

  it('installs the `label` role: sans 12, white, tracked 0.08 em, holding every label text UI.md names', () => {
    expect(label!.name).toBe(FIRST_BUNDLE_NAMES.label);
    expect(label!.name).toContain(INDICATOR_FONT.label.name);
    expect(label!.style).toMatchObject({ fontFamily: UI_TYPE.label.font, fontSize: UI_TYPE.label.px, fill: WHITE });
    expect(label!.style.letterSpacing).toBeCloseTo(UI_TYPE.label.px * UI_LABEL_TRACKING_EM, 9);
    expect(label!.style.stroke).toBeUndefined();
    for (const text of LABEL_TEXTS) for (const glyph of text) expect(label!.chars).toContain(glyph);
  });

  it('renders glyphs at the device pixel ratio rounded up, to the indicator bakes cap', () => {
    expect(indicatorFontInstalls(1, FIRST_BUNDLE_NAMES)[0]!.resolution).toBe(1);
    expect(indicatorFontInstalls(1.5, FIRST_BUNDLE_NAMES)[0]!.resolution).toBe(2);
    expect(indicatorFontInstalls(3, FIRST_BUNDLE_NAMES)[1]!.resolution).toBe(INDICATOR_BAKE_MAX_DPR);
  });
});

describe('installIndicatorFonts', () => {
  it('installs each role once, names them for BitmapText, and uninstalls exactly those names', () => {
    const { installer, installed, uninstalled } = recordingInstaller();
    const names = installIndicatorFonts(installer, 2);
    expect(installed.map((install) => install.name)).toEqual([names.value, names.label]);
    expect(names.value).toContain(INDICATOR_FONT.value.name);
    expect(names.label).toContain(INDICATOR_FONT.label.name);
    uninstallIndicatorFonts(installer, names);
    expect(uninstalled).toEqual([names.value, names.label]);
  });

  /**
   * The trap docs/architecture/encyclopedia.md §12.7 names: Pixi's `BitmapFont` cache is keyed by name and is
   * process-wide, so the encyclopedia preview's bundle standing beside the room's must not share a name with it.
   * Both bundles here are built at the same DPR — the room's and a preview's of `PREVIEW_SEED` would be — so the
   * only thing that can separate them is the per-process counter.
   */
  it('gives every bundle its own names, at the same device pixel ratio', () => {
    const room = recordingInstaller();
    const preview = recordingInstaller();
    const roomNames = installIndicatorFonts(room.installer, 2);
    const previewNames = installIndicatorFonts(preview.installer, 2);
    expect(previewNames.value).not.toBe(roomNames.value);
    expect(previewNames.label).not.toBe(roomNames.label);
    expect(new Set([roomNames.value, roomNames.label, previewNames.value, previewNames.label]).size).toBe(4);
  });

  /** Destroying the preview's bundle must leave the room's fonts installed, or the room's labels vanish. */
  it('uninstalls only the names the destroyed bundle installed', () => {
    const shared = recordingInstaller();
    const roomNames = installIndicatorFonts(shared.installer, 2);
    const previewNames = installIndicatorFonts(shared.installer, 2);
    uninstallIndicatorFonts(shared.installer, previewNames);
    expect(shared.uninstalled).toEqual([previewNames.value, previewNames.label]);
    expect(shared.uninstalled).not.toContain(roomNames.value);
    expect(shared.uninstalled).not.toContain(roomNames.label);
  });
});
