// What a dive opens with (docs/rendering/opening-dive.md §1): the game's app and the upper bands, then the shore's app;
// any part failing, or the dive closing meanwhile, gives back every part that arrived.

import { describe, expect, it } from 'vitest';
import { fakeDiveBands, fakeUpperBands } from '../../../../testing/dive-session-harness';
import { createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { openDiveHalves } from './dive-session-open';

function opening(
  options: { readonly failApp?: number; readonly isBandsFailing?: boolean; readonly isClosed?: boolean } = {},
) {
  const apps: FakePixiApp[] = [];
  const mockup = fakeDiveBands();
  const source = {
    host: document.createElement('div'),
    createPixiApp: () => {
      if (apps.length === options.failApp) return Promise.reject(new Error('no WebGL'));
      const app = createFakePixiApp();
      apps.push(app);
      return Promise.resolve(app);
    },
    loadUpperBands: () =>
      options.isBandsFailing === true ? Promise.reject(new Error('404')) : Promise.resolve(fakeUpperBands(mockup)),
  };
  const open = () => openDiveHalves(source, 1, { nowMs: () => 0, isCancelled: () => options.isClosed === true });
  return { apps, mockup, open };
}

describe('openDiveHalves', () => {
  it('opens the game’s app first, then the shore’s', async () => {
    const { apps, open } = opening();
    const parts = await open();
    expect(parts).not.toBeNull();
    expect(parts!.pixi).toBe(apps[0]);
    expect(parts!.shorePixi).toBe(apps[1]);
  });

  it.each([
    ['the game’s app', { failApp: 0 }, 0, 1],
    ['the bands', { isBandsFailing: true }, 1, 0],
    ['the shore’s app', { failApp: 1 }, 1, 1],
    ['nothing, but the dive closed', { isClosed: true }, 1, 1],
  ] as const)('gives back what arrived when %s fails', async (_label, options, appsMade, releases) => {
    const { apps, mockup, open } = opening(options);
    expect(await open()).toBeNull();
    expect(apps).toHaveLength(appsMade);
    expect(apps.every((app) => app.lifecycle.isDestroyed)).toBe(true);
    expect(mockup.releases.count).toBe(releases);
  });
});
