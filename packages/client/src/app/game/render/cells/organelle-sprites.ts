// The organelle sprite layer (docs/RENDERING.md §3): one pooled Sprite per placement per frame,
// positioned through the deformation, scaled by `r × pulse` and its own motion, tinted where the
// atlas is palette-relative (nucleus, nucleoid). Between pass A and pass B of the cell mesh.

import { Container, Sprite, type Texture } from 'pixi.js';
import { hexToNumber } from '../colour';
import type { PlayerPalette } from '../palette';
import type { OrganelleAtlas } from '../textures/organelle-atlas';
import { textureFromBake } from '../textures/pixi-textures';
import type { CellInstance } from './cell-instance';
import type { OrganellePlacement } from './cell-render-state';
import { ORGANELLE_KIND, type OrganelleKind } from './organelle-kinds';
import { organelleMotion } from './organelle-motion';

export interface OrganelleDraw {
  readonly instance: CellInstance;
  readonly organelles: readonly OrganellePlacement[];
  readonly palette: PlayerPalette;
  readonly isSprinting: boolean;
}

interface SpriteEntry {
  readonly texture: Texture;
  readonly widthRadii: number;
}

const WHITE_TINT = 0xffffff;
const HALF = 0.5;

export class OrganelleSprites {
  readonly container = new Container();
  private readonly entries: Readonly<Record<OrganelleKind, SpriteEntry>>;
  private readonly pool: Sprite[] = [];

  constructor(atlas: OrganelleAtlas) {
    const entries = {} as Record<OrganelleKind, SpriteEntry>;
    for (const kind of Object.values(ORGANELLE_KIND)) {
      entries[kind] = { texture: textureFromBake(atlas[kind].canvas), widthRadii: atlas[kind].widthRadii };
    }
    this.entries = entries;
  }

  private spriteAt(index: number): Sprite {
    const existing = this.pool[index];
    if (existing !== undefined) return existing;
    const sprite = new Sprite();
    sprite.anchor.set(HALF);
    this.pool.push(sprite);
    this.container.addChild(sprite);
    return sprite;
  }

  private tintFor(kind: OrganelleKind, palette: PlayerPalette): number {
    if (kind === ORGANELLE_KIND.nucleus) return hexToNumber(palette.nucleus);
    if (kind === ORGANELLE_KIND.nucleoid) return hexToNumber(palette.rim);
    return WHITE_TINT;
  }

  private place(sprite: Sprite, draw: OrganelleDraw, placement: OrganellePlacement, timeSeconds: number): void {
    const entry = this.entries[placement.kind];
    const motion = organelleMotion(placement.kind, placement.slot.phase, timeSeconds, draw.isSprinting);
    const { instance } = draw;
    sprite.texture = entry.texture;
    sprite.position.set(instance.x + placement.point.x, instance.y + placement.point.y + motion.lift * instance.radius);
    const width = entry.widthRadii * instance.radius * instance.pulse * motion.scale;
    sprite.width = width;
    sprite.height = width;
    sprite.alpha = instance.lodBlend * instance.alpha * instance.passBAlpha * motion.alpha;
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
    for (let index = used; index < this.pool.length; index += 1) this.pool[index]!.visible = false;
    return used;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
