// The renderer's two BitmapFonts (docs/rendering/own-cell-indicators.md §10, docs/visual-style/ui-type.md §7): the `value` role
// for the level numeral, white on its callout-backing outline (docs/ui/hud.md §3.1.2), and the `label`
// role for the threat and escape labels, uppercase-tracked white. One shared install each per texture
// bundle, never one per indicator: `BitmapText` names the font by the names `installIndicatorFonts` returns. The
// install goes through the `TextureBaker` seam, so this module stays pure and a test reads the specs.
//
// **Font names are process-wide.** `BitmapFont.install` puts a font into Pixi's cache by name and
// `BitmapFont.uninstall` takes it out, so two bundles under one name would have the second overwrite the first and
// destroying either would uninstall the other's fonts. The encyclopedia preview (docs/architecture/encyclopedia.md
// §12.7) is a second bundle alongside the room's, so every bundle gets its **own** names: `INDICATOR_FONT[role].name`
// with a per-process counter suffixed. Never the seed — two bundles of `PREVIEW_SEED`, or a preview kept alive
// across encyclopedia opens, would collide again.

import {
  CALLOUT_BACKING,
  INDICATOR_BAKE_MAX_DPR,
  INDICATOR_FONT,
  INDICATOR_FONT_PADDING_PX,
  LEVEL_NUMERAL_OUTLINE_ALPHA,
  LEVEL_NUMERAL_OUTLINE_PX,
  UI_LABEL_TRACKING_EM,
  UI_TYPE,
  WHITE,
} from '../constants';
import { DIAMETER_PER_RADIUS } from '../geometry';
import { bakeScaleFor } from './texture-bake';

/** A glyph outline: Pixi strokes centred on the glyph edge under the fill, so the width is twice what shows outside. */
export interface BitmapFontStroke {
  readonly color: string;
  readonly alpha: number;
  readonly width: number;
  readonly join: 'round';
}

export interface BitmapFontStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: 'normal' | 'bold';
  readonly fill: string;
  readonly letterSpacing: number;
  readonly stroke?: BitmapFontStroke;
}

/** What `BitmapFont.install` takes, restricted to the fields the renderer sets. */
export interface BitmapFontInstall {
  readonly name: string;
  readonly style: BitmapFontStyle;
  readonly chars: string;
  readonly resolution: number;
  readonly padding: number;
}

/** The seam the install goes through: Pixi's `BitmapFont` in the app, a recorder in tests. */
export interface BitmapFontInstaller {
  installBitmapFont(install: BitmapFontInstall): void;
  uninstallBitmapFont(name: string): void;
}

export type IndicatorFontRole = keyof typeof INDICATOR_FONT;

/** The installed font names, by role: what a `BitmapText` style's `fontFamily` reads. */
export type IndicatorFontNames = Readonly<Record<IndicatorFontRole, string>>;

function valueFont(resolution: number, name: string): BitmapFontInstall {
  const role = INDICATOR_FONT.value;
  return {
    name,
    style: {
      fontFamily: UI_TYPE.value.font,
      fontSize: UI_TYPE.value.px,
      fontWeight: role.weight,
      fill: WHITE,
      letterSpacing: 0,
      stroke: {
        color: CALLOUT_BACKING,
        alpha: LEVEL_NUMERAL_OUTLINE_ALPHA,
        width: LEVEL_NUMERAL_OUTLINE_PX * DIAMETER_PER_RADIUS,
        join: 'round',
      },
    },
    chars: role.chars,
    resolution,
    padding: INDICATOR_FONT_PADDING_PX,
  };
}

function labelFont(resolution: number, name: string): BitmapFontInstall {
  const role = INDICATOR_FONT.label;
  return {
    name,
    style: {
      fontFamily: UI_TYPE.label.font,
      fontSize: UI_TYPE.label.px,
      fontWeight: role.weight,
      fill: WHITE,
      letterSpacing: UI_TYPE.label.px * UI_LABEL_TRACKING_EM,
    },
    chars: role.chars,
    resolution,
    padding: INDICATOR_FONT_PADDING_PX,
  };
}

/** Separates a role's base name from the bundle number; any character no font family name would contain. */
const BUNDLE_NAME_SEPARATOR = '#';
/** Bundles installed in this process so far. Not the seed: two bundles of one seed must still differ. */
let installedBundleCount = 0;

/** The names bundle number `bundleNumber` installs, one per role. */
export function indicatorFontNamesFor(bundleNumber: number): IndicatorFontNames {
  return {
    value: `${INDICATOR_FONT.value.name}${BUNDLE_NAME_SEPARATOR}${bundleNumber}`,
    label: `${INDICATOR_FONT.label.name}${BUNDLE_NAME_SEPARATOR}${bundleNumber}`,
  };
}

/** Both installs at the device's glyph resolution (rounded up and capped like the indicator bakes). */
export function indicatorFontInstalls(
  devicePixelRatio: number,
  names: IndicatorFontNames,
): readonly BitmapFontInstall[] {
  const resolution = bakeScaleFor(devicePixelRatio, INDICATOR_BAKE_MAX_DPR);
  return [valueFont(resolution, names.value), labelFont(resolution, names.label)];
}

/**
 * Installs both fonts under names no other bundle uses and returns them; `uninstallIndicatorFonts` is the matching
 * teardown, and it uninstalls exactly these names, so one bundle's destruction never touches another's.
 */
export function installIndicatorFonts(installer: BitmapFontInstaller, devicePixelRatio: number): IndicatorFontNames {
  installedBundleCount += 1;
  const names = indicatorFontNamesFor(installedBundleCount);
  for (const install of indicatorFontInstalls(devicePixelRatio, names)) installer.installBitmapFont(install);
  return names;
}

export function uninstallIndicatorFonts(installer: BitmapFontInstaller, names: IndicatorFontNames): void {
  for (const name of Object.values(names)) installer.uninstallBitmapFont(name);
}
