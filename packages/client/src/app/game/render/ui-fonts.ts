// The UI faces the renderer bakes with (docs/visual-style/ui-type.md §7, #436). `BitmapFont.install` draws its glyphs
// onto a canvas once, and a canvas draws a web font that has not finished loading in the fallback face, for good:
// the atlas would keep the fallback glyphs even after the font arrives. So the one place a Pixi app is made waits for
// both faces first. A face that fails to load is not fatal: the bake then uses the fallback, as it did before.

import { UI_FONT_MONO, UI_FONT_SANS } from './constants/ui-type';

/** Any size loads a variable face whole; the weights are the two the bitmap fonts install (`indicator-bakes.ts`). */
const UI_FONT_LOAD_SPECS: readonly string[] = [UI_FONT_SANS, UI_FONT_MONO].flatMap((family) => [
  `normal 16px ${family}`,
  `bold 16px ${family}`,
]);

/** Resolves once the UI faces are loaded, or failed to; at once where the document has no font loading API. */
export async function uiFontsLoaded(fonts: Pick<FontFaceSet, 'load'> | undefined): Promise<void> {
  if (fonts === undefined) return;
  await Promise.all(UI_FONT_LOAD_SPECS.map((spec) => fonts.load(spec).catch(() => [])));
}
