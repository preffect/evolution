// The effects layer (docs/RENDERING.md §6, §4): the four catalogued moments as glow-atlas sprites
// — the eat halo pulse, the absorption's DNA streams, the level-up burst and the respawn bloom —
// plus the pointer reticle, all in one sprite batch. Every server effect starts one clip on a
// source built from the subject's view (its last view for a prey that is already gone); the
// source follows the cell while it lives. Placements are `effect-sprites.ts`'s data; this class
// pools sprites and positions them. The cell-side of each clip (pulse, dimple, alpha) is the clip
// tracker's, not this layer's.

import {
  EFFECT_KIND,
  MOTION_CLIP,
  MOTION_CLIPS,
  type CellView,
  type EntityId,
  type GameEffect,
  type MotionClipId,
} from '@evolution/shared';
import { Container, type Sprite } from 'pixi.js';
import { sampleClipTracks } from '../cells/cell-clips';
import { CLIP_BY_EFFECT, type LastViewOf } from '../cells/cell-effects';
import { hexToNumber } from '../colour';
import { EFFECT_FALLBACK_RADIUS_WU, LIGHT_ACCENT } from '../constants';
import { paletteFor } from '../palette';
import type { RenderTextures } from '../render-textures';
import { SpritePool } from '../sprite-pool';
import { effectPlacements, type EffectSource, type EffectSpritePlacement } from './effect-sprites';
import { clipProgress, isClipFinished, type ClipInstance } from './motion-clip-player';
import { reticlePlacements, type ReticleFrame } from './reticle';

export interface EffectsLayerFrame {
  /** This frame's views: a running effect follows its cell; a cell that left keeps its last place. */
  readonly viewOf: LastViewOf;
  readonly nowMs: number;
  readonly reticle: ReticleFrame;
}

export interface EffectsLayerOutputs {
  /** Sprites placed this frame (the bench's effects count, docs/RENDERING.md §6). */
  readonly sprites: number;
  readonly running: number;
}

interface RunningEffect extends ClipInstance {
  readonly subjectId: EntityId;
  /** The predator the DNA streams flow to; `null` for everything but an absorption. */
  readonly predatorId: EntityId | null;
  /** The source as it was last resolved: where the effect stays when its cells leave the frame. */
  source: EffectSource;
}

export type EffectsLayerTextures = Pick<RenderTextures, 'glow'>;

/** The clip an effect plays on the effects layer: the cell clips plus the ghost's `absorbed` (its streams draw here). */
function clipFor(effect: GameEffect): MotionClipId | undefined {
  return effect.kind === EFFECT_KIND.cellAbsorbed ? MOTION_CLIP.absorbed : CLIP_BY_EFFECT[effect.kind];
}

/** The view's centre, radius and rim colour; the effect's own position and a neutral colour when the cell was never drawn. */
function sourceFor(effect: GameEffect & { x: number; y: number }, view: CellView | undefined): EffectSource {
  return {
    x: view?.x ?? effect.x,
    y: view?.y ?? effect.y,
    radius: view?.radius ?? EFFECT_FALLBACK_RADIUS_WU,
    colour: view === undefined ? LIGHT_ACCENT : paletteFor(view.avatarIndex).rim,
    target: null,
  };
}

export class EffectsLayer {
  readonly container = new Container();
  private readonly pool = new SpritePool(this.container);
  private running: RunningEffect[] = [];

  constructor(private readonly textures: EffectsLayerTextures) {}

  /** Starts a clip for every placeable effect; the prey's last view still resolves here, before the cell layer syncs. */
  start(effects: readonly GameEffect[], viewOf: LastViewOf, nowMs: number): number {
    let started = 0;
    for (const effect of effects) {
      const clipId = clipFor(effect);
      if (clipId === undefined || !('cellId' in effect)) continue;
      const isAbsorbed = effect.kind === EFFECT_KIND.cellAbsorbed;
      this.running.push({
        clip: MOTION_CLIPS[clipId],
        startMs: nowMs,
        subjectId: effect.cellId,
        predatorId: isAbsorbed ? effect.predatorCellId : null,
        source: sourceFor(effect, viewOf(effect.cellId)),
      });
      started += 1;
    }
    return started;
  }

  /** The source this frame: the subject's live position when it is still drawn, the predator's as the stream target. */
  private followedSource(effect: RunningEffect, viewOf: LastViewOf): EffectSource {
    const subject = effect.predatorId === null ? viewOf(effect.subjectId) : undefined;
    const predator = effect.predatorId === null ? undefined : viewOf(effect.predatorId);
    return {
      ...effect.source,
      x: subject?.x ?? effect.source.x,
      y: subject?.y ?? effect.source.y,
      target: predator === undefined ? effect.source.target : { x: predator.x, y: predator.y },
    };
  }

  private apply(sprite: Sprite, placement: EffectSpritePlacement): void {
    sprite.texture = this.textures.glow[placement.sprite];
    sprite.position.set(placement.x, placement.y);
    sprite.width = placement.widthWu;
    sprite.height = placement.heightWu;
    sprite.rotation = placement.rotation;
    sprite.tint = hexToNumber(placement.colour);
    sprite.alpha = placement.alpha;
    sprite.visible = true;
  }

  /** Advances the running effects, places their sprites and the reticle's, parks the rest. */
  update(frame: EffectsLayerFrame): EffectsLayerOutputs {
    this.running = this.running.filter((effect) => !isClipFinished(effect, frame.nowMs));
    const placements: EffectSpritePlacement[] = [];
    for (const effect of this.running) {
      effect.source = this.followedSource(effect, frame.viewOf);
      const tracks = sampleClipTracks(effect.clip, frame.nowMs - effect.startMs);
      placements.push(...effectPlacements(effect.clip.id, effect.source, tracks, clipProgress(effect, frame.nowMs)));
    }
    placements.push(...reticlePlacements(frame.reticle));
    placements.forEach((placement, index) => this.apply(this.pool.spriteAt(index), placement));
    this.pool.hideFrom(placements.length);
    return { sprites: placements.length, running: this.running.length };
  }

  /** The pooled sprites in placement order: a test reads them. */
  get sprites(): readonly Sprite[] {
    return this.pool.all;
  }

  destroy(): void {
    this.running = [];
    this.container.destroy({ children: true });
  }
}
