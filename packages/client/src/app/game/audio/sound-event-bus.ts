// Maps game events to sound events (docs/ARCHITECTURE.md §7, docs/AUDIO.md §2): the one place
// that knows which moment plays which cue. Server effects are filtered to the own cell; the bed
// follows the stage; the level-up motif picks its instrument from the organelle count. Nothing
// but this bus calls the audio layer.

import {
  EFFECT_KIND,
  ENGULF_PROGRESS_MAX_PLAYBACK_RATE,
  ENTITY_KIND,
  ROUND_PHASE,
  SOUND_EVENT,
  STARTING_STAGE,
  TRAIT_CUE_BY_TRAIT,
  motifInstrumentFor,
  soundEventRule,
  type CellStage,
  type GameEffect,
  type TraitId,
} from '@evolution/shared';
import { GAME_EVENT_KIND, type GameEvent, type GameEventBus, type Unsubscribe } from '../state/game-event-bus';

/** The events `handle` does not consume itself; `handleMoment` must name every one of them. */
type MomentEvent = Exclude<
  GameEvent,
  {
    kind:
      | typeof GAME_EVENT_KIND.effect
      | typeof GAME_EVENT_KIND.stageChanged
      | typeof GAME_EVENT_KIND.organelleGained
      | typeof GAME_EVENT_KIND.dangerChanged
      | typeof GAME_EVENT_KIND.zoneChanged;
  }
>;
import type { SoundSink } from './audio.service';

const MOTIF_VARIANT_PREFIX = 'instrument-';
const UNITY_RATE = 1;

/** What the mapping remembers between events. */
export interface SoundBusState {
  stage: CellStage | null;
  organelleCount: number;
  /** The bloom holds from `bloom_started` until the round phase changes. */
  isBloom: boolean;
}

export function motifVariantKey(organelleCount: number): string {
  return `${MOTIF_VARIANT_PREFIX}${motifInstrumentFor(organelleCount)}`;
}

export class SoundEventBus {
  private state: SoundBusState = { stage: null, organelleCount: 0, isBloom: false };

  constructor(
    private readonly events: Pick<GameEventBus, 'subscribe'>,
    private readonly sink: SoundSink,
  ) {}

  connect(): Unsubscribe {
    return this.events.subscribe((event) => this.handle(event));
  }

  handle(event: GameEvent): void {
    switch (event.kind) {
      case GAME_EVENT_KIND.effect:
        this.handleEffect(event.effect, event.isOwn, event.isOwnPredator);
        return;
      case GAME_EVENT_KIND.stageChanged:
        this.state.stage = event.stage;
        this.sink.setAmbientStage(event.stage);
        return;
      case GAME_EVENT_KIND.organelleGained:
        this.state.organelleCount = event.organelleCount;
        return;
      case GAME_EVENT_KIND.dangerChanged:
        this.sink.setDanger(event.isDanger);
        return;
      case GAME_EVENT_KIND.zoneChanged:
        this.sink.setZone(event.zone);
        return;
      default:
        this.handleMoment(event);
    }
  }

  private handleMoment(event: MomentEvent): void {
    switch (event.kind) {
      case GAME_EVENT_KIND.engulfProgress:
        this.sink.startLoop(SOUND_EVENT.engulfProgress);
        this.sink.setLoopPlaybackRate(SOUND_EVENT.engulfProgress, engulfPlaybackRate(event.progress));
        return;
      case GAME_EVENT_KIND.engulfEnded:
        this.sink.stopLoop(SOUND_EVENT.engulfProgress);
        return;
      case GAME_EVENT_KIND.roundPhaseChanged:
        this.handleRoundPhase(event.phase === ROUND_PHASE.results);
        return;
      case GAME_EVENT_KIND.bloomStarted:
        // #140 B: the sting, then the full mix until results.
        this.state.isBloom = true;
        this.sink.setBloom(true);
        this.sink.play(SOUND_EVENT.bloomStart);
        return;
      case GAME_EVENT_KIND.traitPicked:
        this.sink.play(SOUND_EVENT.traitPick);
        return;
      case GAME_EVENT_KIND.traitCue:
        this.handleTraitCue(event.traitId, event.isActive);
        return;
      case GAME_EVENT_KIND.uiClick:
        this.sink.play(SOUND_EVENT.uiClick);
        return;
      default: {
        // A new `GameEventKind` fails here at compile time instead of clicking.
        const unhandled: never = event;
        return unhandled;
      }
    }
  }

  private handleEffect(effect: GameEffect, isOwn: boolean, isOwnPredator: boolean): void {
    if (effect.kind === EFFECT_KIND.cellAbsorbed && isOwnPredator) {
      this.sink.stopLoop(SOUND_EVENT.engulfProgress);
      this.sink.play(SOUND_EVENT.engulfComplete);
      return;
    }
    if (!isOwn) return;
    switch (effect.kind) {
      case EFFECT_KIND.eat:
        this.sink.play(effect.eatenKind === ENTITY_KIND.dnaFragment ? SOUND_EVENT.dnaAbsorb : SOUND_EVENT.eat);
        return;
      case EFFECT_KIND.levelUp:
        this.sink.play(SOUND_EVENT.levelUp, motifVariantKey(this.state.organelleCount));
        return;
      case EFFECT_KIND.cellAbsorbed:
        this.handleOwnDeath();
        return;
      case EFFECT_KIND.respawn:
        this.handleOwnRespawn();
    }
  }

  /** The bed drops to the protocell stem for the spectate; `respawn` brings the stage's stem (and the bloom) back. */
  private handleOwnDeath(): void {
    this.sink.stopLoop(SOUND_EVENT.engulfProgress);
    this.sink.setDanger(false);
    this.sink.play(SOUND_EVENT.engulfed);
    this.sink.setBloom(false);
    this.sink.setAmbientStage(STARTING_STAGE);
  }

  private handleOwnRespawn(): void {
    this.sink.play(SOUND_EVENT.respawn);
    if (this.state.stage) this.sink.setAmbientStage(this.state.stage);
    if (this.state.isBloom) this.sink.setBloom(true);
  }

  private handleRoundPhase(isResults: boolean): void {
    this.state.isBloom = false;
    if (isResults) {
      this.sink.stopAll();
      this.sink.play(SOUND_EVENT.roundEnd);
      return;
    }
    if (this.state.stage) this.sink.setAmbientStage(this.state.stage);
  }

  private handleTraitCue(traitId: TraitId, isActive: boolean): void {
    const cue = TRAIT_CUE_BY_TRAIT[traitId];
    if (!soundEventRule(cue).isLoop) {
      if (isActive) this.sink.play(cue);
      return;
    }
    if (isActive) this.sink.startLoop(cue);
    else this.sink.stopLoop(cue);
  }
}

/** The engulf loop rises in pitch with progress (#140 option B "pitch follows progress"). */
export function engulfPlaybackRate(progress: number): number {
  return UNITY_RATE + progress * (ENGULF_PROGRESS_MAX_PLAYBACK_RATE - UNITY_RATE);
}
