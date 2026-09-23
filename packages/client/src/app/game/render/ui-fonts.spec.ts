// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { UI_FONT_MONO, UI_FONT_SANS } from './constants/ui-type';
import { uiFontsLoaded } from './ui-fonts';

describe('uiFontsLoaded', () => {
  it('asks for both UI faces at the two weights the bitmap fonts bake, and waits for all of them', async () => {
    const load = vi.fn((_spec: string) => Promise.resolve([] as FontFace[]));
    await uiFontsLoaded({ load });
    const specs = load.mock.calls.map(([spec]) => spec);
    for (const family of [UI_FONT_SANS, UI_FONT_MONO]) {
      expect(specs).toContain(`normal 16px ${family}`);
      expect(specs).toContain(`bold 16px ${family}`);
    }
  });

  it('carries on when a face fails to load, so the renderer still starts in the fallback face', async () => {
    const load = vi.fn((_spec: string) => Promise.reject(new Error('404')));
    await expect(uiFontsLoaded({ load })).resolves.toBeUndefined();
  });

  it('resolves at once where there is no font loading API', async () => {
    await expect(uiFontsLoaded(undefined)).resolves.toBeUndefined();
  });
});
