import { describe, expect, it } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { SpritePool, placeSpriteBatch, type PooledSpritePlacement } from './sprite-pool';

const OPAQUE = 1;

function placementAt(x: number): PooledSpritePlacement {
  return { x, y: 0, widthWu: 4, heightWu: 4, rotation: 0, tint: '#ffffff', texture: { texture: Texture.EMPTY } };
}

/** A pool already holding `size` visible sprites: the pool grows one per `spriteAt`, so it is asked in index order. */
function visiblePoolOf(size: number): SpritePool {
  const pool = new SpritePool(new Container());
  for (let index = 0; index < size; index += 1) pool.spriteAt(index).visible = true;
  return pool;
}

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

describe('placeSpriteBatch', () => {
  it('places every placement at its index with the layer’s alpha and hides the rest of the pool', () => {
    const pool = visiblePoolOf(3);
    placeSpriteBatch(pool, [placementAt(10), placementAt(20)], OPAQUE);
    expect(pool.all[0]).toMatchObject({ visible: true, alpha: OPAQUE });
    expect(pool.all[0]!.position.x).toBe(10);
    expect(pool.all[1]!.position.x).toBe(20);
    expect(pool.all[2]!.visible).toBe(false);
  });

  it('hides the whole pool when a layer has nothing to draw', () => {
    const pool = visiblePoolOf(2);
    placeSpriteBatch(pool, [], OPAQUE);
    expect(pool.all).toHaveLength(2);
    expect(pool.all.every((sprite) => !sprite.visible)).toBe(true);
  });
});
