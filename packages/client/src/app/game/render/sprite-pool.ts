// A pool of centred sprites in one container (docs/rendering/budget.md §6): a layer that places a
// varying number of sprites per frame (organelles, effects, fragments) takes them by index, so
// no sprite is created or destroyed once the pool has grown, and hides the rest of the pool.

import { Container, Sprite, type Texture } from 'pixi.js';
import { hexToNumber } from './colour';
import { HALF } from './geometry';

/** Where and how a pooled sprite draws this frame: its centre, size and rotation in world units, its tint and alpha. */
export interface SpritePaint {
  readonly x: number;
  readonly y: number;
  readonly widthWu: number;
  readonly heightWu: number;
  readonly rotation: number;
  readonly tint: string;
  readonly alpha: number;
}

/** Shows `sprite` with `texture` placed and painted as `paint` says: the one placement every pooled layer uses. */
export function placeSprite(sprite: Sprite, texture: Texture, paint: SpritePaint): void {
  sprite.texture = texture;
  sprite.position.set(paint.x, paint.y);
  sprite.width = paint.widthWu;
  sprite.height = paint.heightWu;
  sprite.rotation = paint.rotation;
  sprite.tint = hexToNumber(paint.tint);
  sprite.alpha = paint.alpha;
  sprite.visible = true;
}

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
