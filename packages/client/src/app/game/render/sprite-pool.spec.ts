import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import { SpritePool } from './sprite-pool';

describe('SpritePool', () => {
  it('creates a centred sprite per index once, keeps it, and hides the tail past the used count', () => {
    const container = new Container();
    const pool = new SpritePool(container);
    const first = pool.spriteAt(0);
    expect(pool.spriteAt(0)).toBe(first);
    expect(first.anchor.x).toBe(0.5);
    expect(pool.spriteAt(2)).not.toBe(first);
    expect(pool.size).toBe(2);
    expect(container.children).toHaveLength(2);
    pool.all.forEach((sprite) => (sprite.visible = true));
    pool.hideFrom(1);
    expect(pool.all[0]!.visible).toBe(true);
    expect(pool.all[1]!.visible).toBe(false);
  });
});
