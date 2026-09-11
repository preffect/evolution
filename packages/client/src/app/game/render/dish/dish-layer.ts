// The dish layer (docs/RENDERING.md §6, docs/VISUAL-STYLE.md §1): the field under everything, the
// wall's crisp lines as world-scale Graphics (the one hard edge) and the three depth particle
// layers; the orchestrator keeps the screen-space vignette above everything. Slice A draws the
// field as the flat dark-field disc; slice B (#206) replaces `drawDishField` with the baked field
// sprite (light pool, caustics, zone tints, gel strands) and adds the vent shimmer.

import { DISH_RADIUS, type RandomSource } from '@evolution/shared';
import { Container, Graphics, Particle, ParticleContainer, type Texture } from 'pixi.js';
import { hexToNumber } from '../colour';
import {
  BG_FIELD,
  DEPTH_FAR_TINTS,
  DEPTH_NEAR,
  LIGHT_ACCENT,
  WALL_GLASS,
  WALL_GLASS_INNER,
  WALL_GLASS_WU,
  WALL_HAIRLINE_ALPHA,
  WALL_HAIRLINE_WU,
  WALL_RIM_GLOW_ALPHA,
  WALL_RIM_GLOW_WU,
  WALL_RIM_SCATTER_ALPHA,
  WALL_RIM_SCATTER_WU,
  WHITE,
  ZONE_GEL,
} from '../constants';
import {
  DEPTH_LAYER,
  depthParticlePosition,
  depthParticleSpecs,
  type DepthLayerKey,
  type DepthParticleSpec,
} from './depth-particles';

export interface DishLayerFrame {
  readonly timeSeconds: number;
  readonly camera: { readonly x: number; readonly y: number };
}

interface DepthField {
  readonly layer: DepthLayerKey;
  readonly container: ParticleContainer;
  readonly specs: readonly DepthParticleSpec[];
  readonly particles: Particle[];
}

const HALF = 0.5;
const DIAMETER_PER_RADIUS = 2;
const DEPTH_TINTS: Readonly<Record<DepthLayerKey, readonly string[]>> = {
  [DEPTH_LAYER.far]: DEPTH_FAR_TINTS,
  [DEPTH_LAYER.near]: [DEPTH_NEAR],
  [DEPTH_LAYER.bokeh]: [ZONE_GEL, LIGHT_ACCENT],
};

/** The field as one flat disc in the field colour; the wall covers its edge. Slice B (#206) bakes the real field. */
export function drawDishField(graphics: Graphics): void {
  graphics.clear().circle(0, 0, DISH_RADIUS).fill(hexToNumber(BG_FIELD));
}

/** The wall (sheet 02 dish-wall table): glass band, inner glass, rim scatter, rim glow, hairline. */
export function drawDishWall(graphics: Graphics): void {
  graphics.clear();
  const glassOuter = DISH_RADIUS + WALL_GLASS_WU;
  graphics
    .circle(0, 0, glassOuter)
    .stroke({ width: WALL_GLASS_WU, color: hexToNumber(WALL_GLASS), alpha: 1, alignment: 1 });
  graphics
    .circle(0, 0, DISH_RADIUS + WALL_GLASS_WU * HALF)
    .stroke({ width: WALL_GLASS_WU * HALF, color: hexToNumber(WALL_GLASS_INNER), alpha: 1 });
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
  private readonly field = new Graphics();
  private readonly wall = new Graphics();
  private readonly depthFields: DepthField[] = [];

  constructor(glowTexture: Texture, cosmetic: RandomSource) {
    drawDishField(this.field);
    drawDishWall(this.wall);
    this.container.addChild(this.field, this.wall);
    for (const layer of [DEPTH_LAYER.far, DEPTH_LAYER.near, DEPTH_LAYER.bokeh]) {
      const field = this.createDepthField(layer, glowTexture, cosmetic);
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
    const tints = DEPTH_TINTS[layer];
    const particles = specs.map((spec) => {
      const particle = new Particle({
        texture,
        anchorX: HALF,
        anchorY: HALF,
        alpha: spec.alpha,
        tint: hexToNumber(tints[spec.tintIndex % tints.length] ?? WHITE),
        scaleX: (spec.radiusWu * DIAMETER_PER_RADIUS) / texture.width,
        scaleY: (spec.radiusWu * DIAMETER_PER_RADIUS) / texture.height,
      });
      container.addParticle(particle);
      return particle;
    });
    return { layer, container, specs, particles };
  }

  update(frame: DishLayerFrame): void {
    for (const field of this.depthFields) {
      field.specs.forEach((spec, index) => {
        const position = depthParticlePosition(spec, field.layer, frame.timeSeconds, frame.camera);
        const particle = field.particles[index]!;
        particle.x = position.x;
        particle.y = position.y;
      });
      field.container.update();
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.nearContainer.destroy({ children: true });
  }
}
