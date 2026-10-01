// What a dive opens with (docs/rendering/opening-dive.md §1): the game's app and the upper bands, then the shore's app;
// any part failing, or the dive closing meanwhile, gives back every part that arrived.

import { describe, expect, it } from 'vitest';
import { fakeDiveBands, fakeUpperBands } from '../../../../testing/dive-session-harness';
import { createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { openDiveParts } from './dive-session-parts';

function openers(
  options: { readonly failApp?: number; readonly isBandsFailing?: boolean; readonly isClosed?: boolean } = {},
) {
  const apps: FakePixiApp[] = [];
  const mockup = fakeDiveBands();
  return {
    apps,
    mockup,
    openers: {
      createApp: () => {
        if (apps.length === options.failApp) return Promise.reject(new Error('no WebGL'));
        const app = createFakePixiApp();
        apps.push(app);
        return Promise.resolve(app);
      },
      loadBands: () =>
        options.isBandsFailing === true ? Promise.reject(new Error('404')) : Promise.resolve(fakeUpperBands(mockup)),
      isClosed: () => options.isClosed === true,
    },
  };
}

describe('openDiveParts', () => {
  it('opens the game’s app first, then the shore’s', async () => {
    const { apps, openers: open } = openers();
    const parts = await openDiveParts(open);
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
    const { apps, mockup, openers: open } = openers(options);
    expect(await openDiveParts(open)).toBeNull();
    expect(apps).toHaveLength(appsMade);
    expect(apps.every((app) => app.lifecycle.isDestroyed)).toBe(true);
    expect(mockup.releases.count).toBe(releases);
  });
});
