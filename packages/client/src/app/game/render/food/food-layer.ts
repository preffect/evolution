// The food layer (docs/RENDERING.md §6): every mote in one ParticleContainer from the mote atlas
// (positions, scale and rotation only), every DNA fragment as a tag-tinted helix sprite
// rotating 20 °/s. Motes and fragments are all uploaded; only their positions change per snapshot.

import type { DnaFragmentView, DnaTag, EntityId, FoodMoteView } from '@evolution/shared';
import { Container, Particle, ParticleContainer, Sprite, type Texture } from 'pixi.js';
import { DNA_FRAGMENT_ROTATION_DEG_PER_SECOND, MOTE_ATLAS_PX_PER_WU } from '../constants';
import { degreesToRadians } from '../geometry';
import type { MoteAtlas } from '../textures/mote-atlas-textures';
import { nextHeading, type HeadingMemory } from './bacterium-heading';
import { moteAppearance } from './mote-sprites';
import type { MoteSpriteKey } from '../textures/mote-atlas';

export interface FoodLayerFrame {
  readonly motes: readonly FoodMoteView[];
  readonly fragments: readonly DnaFragmentView[];
  readonly timeSeconds: number;
  readonly zoom: number;
}

export interface FoodLayerStats {
  readonly visibleMotes: number;
  readonly fragments: number;
}

const HALF = 0.5;

export class FoodLayer {
  readonly container = new Container();
  private readonly particles: ParticleContainer;
  private readonly fragmentSprites = new Container();
  private readonly headings = new Map<EntityId, HeadingMemory>();
  private readonly particlePool: Particle[] = [];
  private readonly fragmentPool: Sprite[] = [];
  private readonly full: Readonly<Record<MoteSpriteKey, Texture>>;
  private readonly small: Readonly<Record<MoteSpriteKey, Texture>>;
  private readonly fragmentTextures: Readonly<Record<DnaTag, Texture>>;
  private readonly fragmentWidthPx: number;

  constructor(private readonly atlas: MoteAtlas) {
    this.full = atlas.fullTextures;
    this.small = atlas.smallTextures;
    this.fragmentTextures = atlas.fragmentTextures;
    this.fragmentWidthPx = atlas.fragmentTextures.motile.width;
    this.particles = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, uvs: true, vertex: true, color: false },
      texture: this.full.algae,
    });
    this.container.addChild(this.particles, this.fragmentSprites);
  }

  private particleAt(index: number): Particle {
    const existing = this.particlePool[index];
    if (existing !== undefined) return existing;
    const particle = new Particle({ texture: this.full.algae, anchorX: HALF, anchorY: HALF });
    this.particlePool.push(particle);
    this.particles.addParticle(particle);
    return particle;
  }

  private placeMote(particle: Particle, mote: FoodMoteView, frame: FoodLayerFrame): void {
    const memory = nextHeading(this.headings.get(mote.id), mote.x, mote.y);
    this.headings.set(mote.id, memory);
    const appearance = moteAppearance(mote, memory.heading, frame.timeSeconds, frame.zoom);
    const texture = (appearance.isSmallVariant ? this.small : this.full)[appearance.key];
    const pxPerWu = appearance.isSmallVariant ? this.atlas.smallPxPerWu : this.atlas.fullPxPerWu;
    particle.texture = texture;
    particle.x = mote.x;
    particle.y = mote.y;
    particle.rotation = appearance.rotation;
    const scale = appearance.bodyScale / pxPerWu;
    particle.scaleX = scale;
    particle.scaleY = scale;
  }

  private fragmentAt(index: number): Sprite {
    const existing = this.fragmentPool[index];
    if (existing !== undefined) return existing;
    const sprite = new Sprite();
    sprite.anchor.set(HALF);
    this.fragmentPool.push(sprite);
    this.fragmentSprites.addChild(sprite);
    return sprite;
  }

  private placeFragment(sprite: Sprite, fragment: DnaFragmentView, timeSeconds: number): void {
    sprite.texture = this.fragmentTextures[fragment.tag];
    sprite.position.set(fragment.x, fragment.y);
    sprite.rotation = degreesToRadians(DNA_FRAGMENT_ROTATION_DEG_PER_SECOND) * timeSeconds;
    const widthWu = this.fragmentWidthPx / MOTE_ATLAS_PX_PER_WU;
    sprite.width = widthWu;
    sprite.height = widthWu;
    sprite.visible = true;
  }

  update(frame: FoodLayerFrame): FoodLayerStats {
    frame.motes.forEach((mote, index) => this.placeMote(this.particleAt(index), mote, frame));
    for (let index = frame.motes.length; index < this.particlePool.length; index += 1) {
      this.particlePool[index]!.scaleX = 0;
      this.particlePool[index]!.scaleY = 0;
    }
    this.particles.update();
    frame.fragments.forEach((fragment, index) =>
      this.placeFragment(this.fragmentAt(index), fragment, frame.timeSeconds),
    );
    for (let index = frame.fragments.length; index < this.fragmentPool.length; index += 1)
      this.fragmentPool[index]!.visible = false;
    return { visibleMotes: frame.motes.length, fragments: frame.fragments.length };
  }

  destroy(): void {
    this.headings.clear();
    this.container.destroy({ children: true });
  }
}
