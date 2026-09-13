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
  installIndicatorFonts,
  uninstallIndicatorFonts,
  type BitmapFontInstall,
  type BitmapFontInstaller,
} from './bitmap-fonts';

/** The label texts UI.md §3.1.2 names: the escape arc's two readings and the threat label. */
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

describe('indicatorFontInstalls', () => {
  const [value, label] = indicatorFontInstalls(1);

  it('installs the `value` role for the numeral: mono 20, white on a callout-backing outline 2 px outside the glyph', () => {
    expect(value!.name).toBe(INDICATOR_FONT.value.name);
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
    expect(label!.name).toBe(INDICATOR_FONT.label.name);
    expect(label!.style).toMatchObject({ fontFamily: UI_TYPE.label.font, fontSize: UI_TYPE.label.px, fill: WHITE });
    expect(label!.style.letterSpacing).toBeCloseTo(UI_TYPE.label.px * UI_LABEL_TRACKING_EM, 9);
    expect(label!.style.stroke).toBeUndefined();
    for (const text of LABEL_TEXTS) for (const glyph of text) expect(label!.chars).toContain(glyph);
  });

  it('renders glyphs at the device pixel ratio rounded up, to the indicator bakes cap', () => {
    expect(indicatorFontInstalls(1)[0]!.resolution).toBe(1);
    expect(indicatorFontInstalls(1.5)[0]!.resolution).toBe(2);
    expect(indicatorFontInstalls(3)[1]!.resolution).toBe(INDICATOR_BAKE_MAX_DPR);
  });
});

describe('installIndicatorFonts', () => {
  it('installs each role once, names them for BitmapText, and uninstalls the same names', () => {
    const { installer, installed, uninstalled } = recordingInstaller();
    const names = installIndicatorFonts(installer, 2);
    expect(installed.map((install) => install.name)).toEqual([INDICATOR_FONT.value.name, INDICATOR_FONT.label.name]);
    expect(names).toEqual({ value: INDICATOR_FONT.value.name, label: INDICATOR_FONT.label.name });
    uninstallIndicatorFonts(installer, names);
    expect(uninstalled).toEqual([INDICATOR_FONT.value.name, INDICATOR_FONT.label.name]);
  });
});
