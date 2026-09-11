// The organelle sprite layer (docs/RENDERING.md §3): one pooled Sprite per placement per frame,
// positioned through the deformation, scaled by `r × pulse` and its own motion, tinted where the
// atlas is palette-relative (nucleus, nucleoid). Between pass A and pass B of the cell mesh.

import { Container, Sprite } from 'pixi.js';
import { hexToNumber } from '../colour';
import { ORGANELLE_KIND, WHITE, type OrganelleKind } from '../constants';
import { HALF } from '../geometry';
import type { PlayerPalette } from '../palette';
import type { OrganelleSpriteTexture } from '../render-textures';
import type { CellInstance } from './cell-instance';
import type { OrganellePlacement } from './cell-render-state';
import { organelleMotion } from './organelle-motion';

export interface OrganelleDraw {
  readonly instance: CellInstance;
  readonly organelles: readonly OrganellePlacement[];
  readonly palette: PlayerPalette;
  readonly isSprinting: boolean;
}

export type OrganelleTextures = Readonly<Record<OrganelleKind, OrganelleSpriteTexture>>;

const UNTINTED = hexToNumber(WHITE);

export class OrganelleSprites {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];

  constructor(private readonly textures: OrganelleTextures) {}

  /** The pooled sprite at `index`, created on first use and kept for the layer's lifetime. */
  private spriteAt(index: number): Sprite {
    const existing = this.pool[index];
    if (existing !== undefined) return existing;
    const sprite = new Sprite();
    sprite.anchor.set(HALF);
    this.pool.push(sprite);
    this.container.addChild(sprite);
    return sprite;
  }

  /** The nucleus and nucleoid bakes are white and take the palette's colour here; the rest are baked in colour. */
  private tintFor(kind: OrganelleKind, palette: PlayerPalette): number {
    if (kind === ORGANELLE_KIND.nucleus) return hexToNumber(palette.nucleus);
    if (kind === ORGANELLE_KIND.nucleoid) return hexToNumber(palette.rim);
    return UNTINTED;
  }

  private place(sprite: Sprite, draw: OrganelleDraw, placement: OrganellePlacement, timeSeconds: number): void {
    const entry = this.textures[placement.kind];
    const motion = organelleMotion(placement.kind, placement.slot.phase, timeSeconds, draw.isSprinting);
    const { instance } = draw;
    sprite.texture = entry.texture;
    sprite.position.set(instance.x + placement.point.x, instance.y + placement.point.y + motion.lift * instance.radius);
    const width = entry.widthRadii * instance.radius * instance.pulse * motion.scale;
    sprite.width = width;
    sprite.height = width;
    sprite.alpha = instance.lodBlend * instance.alpha * motion.alpha;
    sprite.tint = this.tintFor(placement.kind, draw.palette);
    sprite.visible = true;
  }

  /** Places every organelle of every drawn cell, in cell order (radius ascending), hiding the rest of the pool. */
  update(draws: readonly OrganelleDraw[], timeSeconds: number): number {
    let used = 0;
    for (const draw of draws) {
      for (const placement of draw.organelles) {
        this.place(this.spriteAt(used), draw, placement, timeSeconds);
        used += 1;
      }
    }
    for (let index = used; index < this.pool.length; index += 1) {
      const sprite = this.pool[index];
      if (sprite !== undefined) sprite.visible = false;
    }
    return used;
  }

  get poolSize(): number {
    return this.pool.length;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
