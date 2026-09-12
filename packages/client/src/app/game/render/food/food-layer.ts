// The food layer (docs/RENDERING.md §6, docs/ARCHITECTURE.md §6): every mote in one
// `ParticleContainer` over the one mote-atlas source (position, rotation, scale and frame per
// particle), every DNA fragment a tag-tinted helix sprite in its own container above the motes.
// One render state per mote (its cosmetic draws and a bacterium's held heading) lives in a
// `ViewRegistry`, so a mote breathes the same way every frame and a rod keeps its heading between
// snapshots. Motes and fragments are all uploaded; the decisions are the pure modules beside this.

import type { DnaFragmentView, FoodMoteView } from '@evolution/shared';
import { Container, Particle, ParticleContainer, type Sprite } from 'pixi.js';
import { HALF } from '../geometry';
import type { RenderTextures } from '../render-textures';
import { SpritePool } from '../sprite-pool';
import { ViewRegistry } from '../view-registry';
import { nextHeading, type HeadingMemory } from './bacterium-heading';
import { drawFragmentSpinPhase, fragmentAppearance } from './dna-fragment-sprites';
import { drawMoteCosmetics, moteAppearance, type MoteCosmetics } from './mote-sprites';

export interface FoodLayerFrame {
  readonly motes: readonly FoodMoteView[];
  readonly fragments: readonly DnaFragmentView[];
  readonly timeSeconds: number;
  /** Screen px per wu, for the px floors and the small-variant swap. */
  readonly zoom: number;
}

export interface FoodLayerOutputs {
  readonly motes: number;
  readonly fragments: number;
}

export type FoodLayerTextures = Pick<RenderTextures, 'motes' | 'cosmetic'>;

interface MoteRenderState {
  readonly cosmetics: MoteCosmetics;
  heading: HeadingMemory | null;
}

interface FragmentRenderState {
  readonly spinPhase: number;
}

/** A particle past this frame's mote count is parked at zero scale: cheaper than removing it. */
const PARKED_SCALE = 0;

export class FoodLayer {
  /** World-space, the `food` layer: the mote particles. */
  readonly container = new Container();
  /** World-space, the `fragments` layer above the motes. */
  readonly fragmentContainer = new Container();
  private readonly particles: ParticleContainer;
  private readonly particlePool: Particle[] = [];
  private readonly fragmentPool = new SpritePool(this.fragmentContainer);
  private readonly moteStates: ViewRegistry<FoodMoteView, MoteRenderState>;
  private readonly fragmentStates: ViewRegistry<DnaFragmentView, FragmentRenderState>;

  constructor(private readonly textures: FoodLayerTextures) {
    this.particles = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, uvs: true, vertex: true, color: false },
      texture: textures.motes.full.algae,
    });
    this.container.addChild(this.particles);
    this.moteStates = new ViewRegistry({
      create: (mote) => ({ cosmetics: drawMoteCosmetics(textures.cosmetic, mote.id), heading: null }),
      destroy: () => undefined,
    });
    this.fragmentStates = new ViewRegistry({
      create: (fragment) => ({ spinPhase: drawFragmentSpinPhase(textures.cosmetic, fragment.id) }),
      destroy: () => undefined,
    });
  }

  /** The mote particles in pool order: a test or the bench reads their placement. */
  get moteParticles(): readonly Particle[] {
    return this.particlePool;
  }

  get fragmentSprites(): readonly Sprite[] {
    return this.fragmentPool.all;
  }

  private particleAt(index: number): Particle {
    const existing = this.particlePool[index];
    if (existing !== undefined) return existing;
    const particle = new Particle({ texture: this.textures.motes.full.algae, anchorX: HALF, anchorY: HALF });
    this.particlePool.push(particle);
    this.particles.addParticle(particle);
    return particle;
  }

  private placeMote(particle: Particle, mote: FoodMoteView, state: MoteRenderState, frame: FoodLayerFrame): void {
    state.heading = nextHeading(state.heading, mote.x, mote.y);
    const appearance = moteAppearance({
      mote,
      cosmetics: state.cosmetics,
      heading: state.heading.heading,
      timeSeconds: frame.timeSeconds,
      zoom: frame.zoom,
    });
    const { motes } = this.textures;
    const variant = appearance.isSmallVariant ? motes.small : motes.full;
    const pxPerWu = appearance.isSmallVariant ? motes.smallPxPerWu : motes.fullPxPerWu;
    particle.texture = variant[appearance.key];
    particle.x = mote.x;
    particle.y = mote.y;
    particle.rotation = appearance.rotation;
    const scale = appearance.bodyScale / pxPerWu;
    particle.scaleX = scale;
    particle.scaleY = scale;
  }

  private placeFragment(sprite: Sprite, fragment: DnaFragmentView, spinPhase: number, timeSeconds: number): void {
    const texture = this.textures.motes.fragments[fragment.tag];
    const appearance = fragmentAppearance(spinPhase, timeSeconds, texture.frame);
    sprite.texture = texture;
    sprite.position.set(fragment.x, fragment.y);
    sprite.rotation = appearance.rotation;
    sprite.width = appearance.widthWu;
    sprite.height = appearance.heightWu;
    sprite.visible = true;
  }

  /** One frame: sync the states, place every mote and fragment, park the spare particles and sprites. */
  update(frame: FoodLayerFrame): FoodLayerOutputs {
    const motes = this.moteStates.sync(frame.motes);
    motes.pairs.forEach(([mote, state], index) => this.placeMote(this.particleAt(index), mote, state, frame));
    for (let index = frame.motes.length; index < this.particlePool.length; index += 1) {
      this.particlePool[index]!.scaleX = PARKED_SCALE;
      this.particlePool[index]!.scaleY = PARKED_SCALE;
    }
    this.particles.update();
    const fragments = this.fragmentStates.sync(frame.fragments);
    fragments.pairs.forEach(([fragment, state], index) =>
      this.placeFragment(this.fragmentPool.spriteAt(index), fragment, state.spinPhase, frame.timeSeconds),
    );
    this.fragmentPool.hideFrom(frame.fragments.length);
    return { motes: frame.motes.length, fragments: frame.fragments.length };
  }

  destroy(): void {
    this.moteStates.clear();
    this.fragmentStates.clear();
    this.container.destroy({ children: true });
    this.fragmentContainer.destroy({ children: true });
  }
}
