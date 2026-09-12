// A pool of centred sprites in one container (docs/RENDERING.md §6): a layer that places a
// varying number of sprites per frame (organelles, effects, fragments) takes them by index, so
// no sprite is created or destroyed once the pool has grown, and hides the rest of the pool.

import { Container, Sprite } from 'pixi.js';
import { HALF } from './geometry';

export class SpritePool {
  private readonly sprites: Sprite[] = [];

  constructor(private readonly container: Container) {}

  /** The pooled sprite at `index`, created on first use and kept for the container's lifetime. */
  spriteAt(index: number): Sprite {
    const existing = this.sprites[index];
    if (existing !== undefined) return existing;
    const sprite = new Sprite();
    sprite.anchor.set(HALF);
    this.sprites.push(sprite);
    this.container.addChild(sprite);
    return sprite;
  }

  /** Hides every sprite from `used` on. */
  hideFrom(used: number): void {
    for (let index = used; index < this.sprites.length; index += 1) this.sprites[index]!.visible = false;
  }

  /** Every pooled sprite in index order: a test reads their placement. */
  get all(): readonly Sprite[] {
    return this.sprites;
  }

  get size(): number {
    return this.sprites.length;
  }
}
