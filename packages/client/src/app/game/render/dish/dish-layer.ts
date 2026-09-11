// The dish layer (docs/RENDERING.md §6, docs/VISUAL-STYLE.md §1): the baked field as one sprite
// scaled to the dish (textures/dish-texture.ts: light pool, caustics, zone tints, gel strands),
// the vent sprite over it at the vent zone (textures/vent-bake.ts), the wall's crisp lines as
// world-scale Graphics (the one hard edge) and the three depth particle layers; the orchestrator
// keeps the screen-space vignette above everything. The vent shimmer (RENDERING §6, the one
// filter) is deferred.

import { DISH_RADIUS, type RandomSource } from '@evolution/shared';
import { Container, Graphics, Particle, ParticleContainer, Sprite, type Texture } from 'pixi.js';
import type { WorldPoint } from '../camera';
import { hexToNumber } from '../colour';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import {
  LIGHT_ACCENT,
  VENT_CENTRE_WU,
  WALL_GLASS,
  WALL_GLASS_INNER,
  WALL_GLASS_INNER_WU,
  WALL_GLASS_OUTER,
  WALL_GLASS_OUTER_WU,
  WALL_GLASS_WU,
  WALL_HAIRLINE_ALPHA,
  WALL_HAIRLINE_WU,
  WALL_RIM_GLOW_ALPHA,
  WALL_RIM_GLOW_WU,
  WALL_RIM_SCATTER_ALPHA,
  WALL_RIM_SCATTER_WU,
  WHITE,
} from '../constants';
import type { RenderTextures } from '../render-textures';
import {
  DEPTH_LAYER,
  depthParticlePosition,
  depthParticleSpecs,
  type DepthLayerKey,
  type DepthParticleSpec,
} from './depth-particles';

export interface DishLayerFrame {
  readonly timeSeconds: number;
  readonly camera: WorldPoint;
}

interface DepthEntry {
  readonly spec: DepthParticleSpec;
  readonly particle: Particle;
}

interface DepthField {
  readonly layer: DepthLayerKey;
  readonly container: ParticleContainer;
  readonly entries: readonly DepthEntry[];
}

/** The dish field sprite: the bake centred on the origin, stretched to the square of `halfExtentWu` it covers. */
export function createDishFieldSprite(textures: Pick<RenderTextures, 'dishField' | 'dishTexture'>): Sprite {
  const sprite = new Sprite(textures.dishTexture);
  sprite.anchor.set(HALF);
  const extent = textures.dishField.halfExtentWu * DIAMETER_PER_RADIUS;
  sprite.width = extent;
  sprite.height = extent;
  return sprite;
}

/** The vent sprite: the bake centred on the vent zone, stretched to the square of `halfExtentWu` it covers. */
export function createVentSprite(textures: Pick<RenderTextures, 'vent' | 'ventTexture'>): Sprite {
  const sprite = new Sprite(textures.ventTexture);
  sprite.anchor.set(HALF);
  const extent = textures.vent.halfExtentWu * DIAMETER_PER_RADIUS;
  sprite.width = extent;
  sprite.height = extent;
  sprite.position.set(VENT_CENTRE_WU.x, VENT_CENTRE_WU.y);
  return sprite;
}

/** The wall (sheet 02 dish-wall table): glass band with its inner and outer glass, rim scatter, rim glow, hairline. */
export function drawDishWall(graphics: Graphics): void {
  graphics.clear();
  const glassOuter = DISH_RADIUS + WALL_GLASS_WU;
  graphics
    .circle(0, 0, glassOuter)
    .stroke({ width: WALL_GLASS_WU, color: hexToNumber(WALL_GLASS), alpha: 1, alignment: 1 });
  graphics
    .circle(0, 0, DISH_RADIUS)
    .stroke({ width: WALL_GLASS_INNER_WU, color: hexToNumber(WALL_GLASS_INNER), alpha: 1, alignment: 1 });
  graphics
    .circle(0, 0, glassOuter)
    .stroke({ width: WALL_GLASS_OUTER_WU, color: hexToNumber(WALL_GLASS_OUTER), alpha: 1, alignment: 0 });
  graphics
    .circle(0, 0, DISH_RADIUS)
    .stroke({ width: WALL_RIM_GLOW_WU, color: hexToNumber(LIGHT_ACCENT), alpha: WALL_RIM_GLOW_ALPHA, alignment: 1 });
  graphics.circle(0, 0, DISH_RADIUS).stroke({
    width: WALL_RIM_SCATTER_WU,
    color: hexToNumber(LIGHT_ACCENT),
    alpha: WALL_RIM_SCATTER_ALPHA,
    alignment: 1,
  });
  graphics
    .circle(0, 0, DISH_RADIUS)
    .stroke({ width: WALL_HAIRLINE_WU, color: hexToNumber(WHITE), alpha: WALL_HAIRLINE_ALPHA, alignment: 0 });
}

export class DishLayer {
  /** World-space: the field, the wall and the far depth particles (under the food). */
  readonly container = new Container();
  /** World-space, above the cells: the near and bokeh particles. */
  readonly nearContainer = new Container();
  private readonly field: Sprite;
  private readonly vent: Sprite;
  private readonly wall = new Graphics();
  private readonly depthFields: DepthField[] = [];

  constructor(
    textures: Pick<RenderTextures, 'dishField' | 'dishTexture' | 'vent' | 'ventTexture' | 'glowTexture' | 'cosmetic'>,
  ) {
    this.field = createDishFieldSprite(textures);
    this.vent = createVentSprite(textures);
    drawDishWall(this.wall);
    this.container.addChild(this.field, this.vent, this.wall);
    for (const layer of [DEPTH_LAYER.far, DEPTH_LAYER.near, DEPTH_LAYER.bokeh]) {
      const field = this.createDepthField(layer, textures.glowTexture, textures.cosmetic);
      (layer === DEPTH_LAYER.far ? this.container : this.nearContainer).addChild(field.container);
      this.depthFields.push(field);
    }
  }

  private createDepthField(layer: DepthLayerKey, texture: Texture, cosmetic: RandomSource): DepthField {
    const specs = depthParticleSpecs(layer, cosmetic);
    const container = new ParticleContainer({
      dynamicProperties: { position: true, color: false, rotation: false, uvs: false, vertex: false },
      texture,
    });
    const entries = specs.map((spec): DepthEntry => {
      const particle = new Particle({
        texture,
        anchorX: HALF,
        anchorY: HALF,
        alpha: spec.alpha,
        tint: hexToNumber(spec.tint),
        scaleX: (spec.radiusWu * DIAMETER_PER_RADIUS) / texture.width,
        scaleY: (spec.radiusWu * DIAMETER_PER_RADIUS) / texture.height,
      });
      container.addParticle(particle);
      return { spec, particle };
    });
    return { layer, container, entries };
  }

  update(frame: DishLayerFrame): void {
    for (const field of this.depthFields) {
      for (const { spec, particle } of field.entries) {
        const position = depthParticlePosition(spec, field.layer, frame.timeSeconds, frame.camera);
        particle.x = position.x;
        particle.y = position.y;
      }
      field.container.update();
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.nearContainer.destroy({ children: true });
  }
}
