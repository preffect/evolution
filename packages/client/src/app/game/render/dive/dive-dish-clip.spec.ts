// The game renderer's clip and fade on the dive (docs/rendering/opening-dive.md §3): clipped to the dish's wall while
// the slime shows, unclipped inside the dish; faded in over the slime as a group of its own (an alpha filter over the
// stage's area) while it is under 1, drawing straight on at 1, and set back when the dive closes.

import { AlphaFilter, Container, Graphics, Rectangle } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { DiveDishFade, clipDiveRendererToDish } from './dive-dish-clip';
import { diveViewAt } from './dive-view';

const viewAt = (zoom: number) =>
  diveViewAt({ zoom, viewport: { width: 830, height: 467 }, timeSeconds: 0, isMoving: false, globeIdleSpinDegrees: 0 });

describe('clipDiveRendererToDish', () => {
  it('masks the renderer’s root with the clip while the slime shows, and lifts it inside the dish', () => {
    const root = new Container();
    const clip = new Graphics();
    clipDiveRendererToDish(root, clip, viewAt(-4.1));
    expect(root.mask).toBe(clip);
    clipDiveRendererToDish(root, clip, viewAt(-4.75));
    expect(root.mask ?? null).toBeNull();
  });
});

describe('DiveDishFade', () => {
  it('fades the root as a group under 1, over the stage’s area, and draws it straight on at 1', () => {
    const root = new Container();
    const fade = new DiveDishFade();
    const screen = new Rectangle(0, 0, 830, 467);
    fade.apply(root, 0.25, screen);
    const [filter] = root.filters as readonly unknown[];
    expect(filter).toBeInstanceOf(AlphaFilter);
    expect(fade.alpha).toBe(0.25);
    expect(root.filterArea).toBe(screen);
    fade.apply(root, 0.75, screen);
    expect((root.filters as readonly unknown[])[0]).toBe(filter);
    expect(fade.alpha).toBe(0.75);
    fade.apply(root, 1, screen);
    expect(root.filters ?? null).toBeNull();
  });

  it('sets the root back to drawing straight on when it is released', () => {
    const root = new Container();
    const fade = new DiveDishFade();
    fade.apply(root, 0.5);
    fade.release(root);
    expect(root.filters ?? null).toBeNull();
  });
});
