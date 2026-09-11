// The effects layer (docs/RENDERING.md §6): glow-atlas sprites for the catalogued moments, driven
// by the same clip player the cells use, plus the pointer reticle. Every placement is data from
// `effect-sprites.ts`; this class pools sprites and positions them. The own-cell indicators of
// §10 join with #100 on this container.

import { EFFECT_KIND, MOTION_CLIPS, type CellView, type GameEffect, type MotionClipId } from '@evolution/shared';
import { Container, Sprite, type Texture } from 'pixi.js';
import { hexToNumber } from '../colour';
import { paletteFor } from '../palette';
import { GLOW_SPRITE, type GlowAtlas, type GlowSpriteKey } from '../textures/glow-atlas';
import { textureFromBake } from '../textures/pixi-textures';
import { effectPlacements, type EffectSource, type EffectSpritePlacement } from './effect-sprites';
import { clipProgress, isClipFinished, sampleClip, type ClipInstance } from './motion-clip-player';

interface RunningEffect extends ClipInstance {
  readonly source: EffectSource;
}

export interface EffectsLayerFrame {
  readonly effects: readonly GameEffect[];
  readonly cells: readonly CellView[];
  readonly nowMs: number;
}

const HALF = 0.5;
const CLIP_BY_EFFECT: Partial<Record<GameEffect['kind'], MotionClipId>> = {
  [EFFECT_KIND.eat]: MOTION_CLIPS.eat.id,
  [EFFECT_KIND.levelUp]: MOTION_CLIPS.level_up.id,
  [EFFECT_KIND.respawn]: MOTION_CLIPS.respawn.id,
  [EFFECT_KIND.cellAbsorbed]: MOTION_CLIPS.absorbed.id,
};

export class EffectsLayer {
  readonly container = new Container();
  private readonly textures: Readonly<Record<GlowSpriteKey, Texture>>;
  private readonly pool: Sprite[] = [];
  private running: RunningEffect[] = [];

  constructor(atlas: GlowAtlas) {
    const textures = {} as Record<GlowSpriteKey, Texture>;
    for (const key of Object.values(GLOW_SPRITE)) textures[key] = textureFromBake(atlas[key]);
    this.textures = textures;
  }

  private subjectOf(
    effect: GameEffect,
    cells: readonly CellView[],
  ): { cell: CellView | null; predator: CellView | null } {
    if (effect.kind === EFFECT_KIND.worldLevelUp) return { cell: null, predator: null };
    const cell = cells.find((candidate) => candidate.id === effect.cellId) ?? null;
    if (effect.kind !== EFFECT_KIND.cellAbsorbed) return { cell, predator: null };
    return { cell, predator: cells.find((candidate) => candidate.id === effect.predatorCellId) ?? null };
  }

  private sourceFor(effect: GameEffect, cells: readonly CellView[]): EffectSource | null {
    if (effect.kind === EFFECT_KIND.worldLevelUp) return null;
    const { cell, predator } = this.subjectOf(effect, cells);
    const subject = cell ?? predator;
    return {
      x: effect.x,
      y: effect.y,
      radius: subject?.radius ?? 1,
      colour: paletteFor(subject?.avatarIndex ?? 0).rim,
      targetX: predator?.x,
      targetY: predator?.y,
    };
  }

  private start(effects: readonly GameEffect[], cells: readonly CellView[], nowMs: number): void {
    for (const effect of effects) {
      const clipId = CLIP_BY_EFFECT[effect.kind];
      const source = this.sourceFor(effect, cells);
      if (clipId === undefined || source === null) continue;
      this.running.push({ clip: MOTION_CLIPS[clipId], startMs: nowMs, source });
    }
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

  private apply(sprite: Sprite, placement: EffectSpritePlacement): void {
    sprite.texture = this.textures[placement.sprite];
    sprite.position.set(placement.x, placement.y);
    sprite.width = placement.widthWu;
    sprite.height = placement.heightWu;
    sprite.rotation = placement.rotation;
    sprite.tint = hexToNumber(placement.colour);
    sprite.alpha = placement.alpha;
    sprite.visible = true;
  }

  /** Starts this frame's effects, advances the running ones and places their sprites; returns the sprite count. */
  update(frame: EffectsLayerFrame): number {
    this.start(frame.effects, frame.cells, frame.nowMs);
    this.running = this.running.filter((effect) => !isClipFinished(effect, frame.nowMs));
    let used = 0;
    for (const effect of this.running) {
      const tracks = sampleClip(effect.clip, frame.nowMs - effect.startMs);
      for (const placement of effectPlacements(
        effect.clip.id,
        effect.source,
        tracks,
        clipProgress(effect, frame.nowMs),
      )) {
        this.apply(this.spriteAt(used), placement);
        used += 1;
      }
    }
    for (let index = used; index < this.pool.length; index += 1) this.pool[index]!.visible = false;
    return used;
  }

  get runningCount(): number {
    return this.running.length;
  }

  destroy(): void {
    this.running = [];
    this.container.destroy({ children: true });
  }
}
