// The pointer reticle (docs/UI.md §5, docs/RENDERING.md §6): a small dotted ring at the pointer's
// world position while onboarding asks for it; a glow-atlas sprite ring, hidden otherwise.

import { Container, Sprite, type Texture } from 'pixi.js';
import { hexToNumber } from '../colour';
import { LIGHT_ACCENT, RETICLE_ALPHA, RETICLE_RADIUS_PX } from '../constants';

export interface ReticleFrame {
  readonly isVisible: boolean;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

const HALF = 0.5;
const DIAMETER_PER_RADIUS = 2;

export class Reticle {
  readonly container = new Container();
  private readonly ring: Sprite;

  constructor(ringTexture: Texture) {
    this.ring = new Sprite(ringTexture);
    this.ring.anchor.set(HALF);
    this.ring.tint = hexToNumber(LIGHT_ACCENT);
    this.ring.alpha = RETICLE_ALPHA;
    this.ring.visible = false;
    this.container.addChild(this.ring);
  }

  update(frame: ReticleFrame): void {
    this.ring.visible = frame.isVisible;
    if (!frame.isVisible) return;
    const sizeWu = (RETICLE_RADIUS_PX * DIAMETER_PER_RADIUS) / frame.zoom;
    this.ring.position.set(frame.x, frame.y);
    this.ring.width = sizeWu;
    this.ring.height = sizeWu;
  }
}
