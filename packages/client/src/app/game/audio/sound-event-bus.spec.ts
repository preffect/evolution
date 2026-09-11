import { describe, expect, it, vi } from 'vitest';
import {
  CELL_STAGE,
  ENGULF_PROGRESS_MAX_PLAYBACK_RATE,
  ENTITY_KIND,
  ROUND_PHASE,
  SOUND_EVENT,
  STARTING_STAGE,
  TRAIT_CUE_BY_TRAIT,
  ZONE_ID,
  type GameEffect,
} from '@evolution/shared';
import { GameEventBus, GAME_EVENT_KIND, type GameEvent } from '../state/game-event-bus';
import { SoundEventBus, engulfPlaybackRate, motifVariantKey } from './sound-event-bus';
import type { SoundSink } from './audio.service';
import {
  createTestCellAbsorbedEffect,
  createTestEatEffect,
  createTestLevelUpEffect,
  createTestRespawnEffect,
} from '../../../testing/builders';

function createSink() {
  const sink: SoundSink = {
    play: vi.fn(),
    startLoop: vi.fn(),
    stopLoop: vi.fn(),
    setLoopPlaybackRate: vi.fn(),
    setAmbientStage: vi.fn(),
    setBloom: vi.fn(),
    setZone: vi.fn(),
    stopAmbient: vi.fn(),
    setDanger: vi.fn(),
    stopAll: vi.fn(),
  };
  return sink;
}

function effect(value: GameEffect, isOwn: boolean, isOwnPredator = false): GameEvent {
  return { kind: GAME_EVENT_KIND.effect, effect: value, isOwn, isOwnPredator };
}

function wired() {
  const events = new GameEventBus();
  const sink = createSink();
  const bus = new SoundEventBus(events, sink);
  const disconnect = bus.connect();
  return { events, sink, bus, disconnect };
}

describe('SoundEventBus effects', () => {
  it('plays eat for the own cell only, and dna_absorb for a fragment', () => {
    const { events, sink } = wired();
    events.emit(effect(createTestEatEffect(), true));
    events.emit(effect(createTestEatEffect({ eatenKind: ENTITY_KIND.dnaFragment }), true));
    events.emit(effect(createTestEatEffect(), false));
    expect(sink.play).toHaveBeenNthCalledWith(1, SOUND_EVENT.eat);
    expect(sink.play).toHaveBeenNthCalledWith(2, SOUND_EVENT.dnaAbsorb);
    expect(sink.play).toHaveBeenCalledTimes(2);
  });

  it('plays the level-up motif on the instrument of the organelle count', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.organelleGained, traitId: 'nucleoid', organelleCount: 2 });
    events.emit(effect(createTestLevelUpEffect(), true));
    expect(sink.play).toHaveBeenCalledWith(SOUND_EVENT.levelUp, motifVariantKey(2));
    expect(motifVariantKey(0)).toBe('instrument-0');
  });

  it('plays the payout and ends the engulf loop when the own cell absorbs another', () => {
    const { events, sink } = wired();
    events.emit(effect(createTestCellAbsorbedEffect(), false, true));
    expect(sink.stopLoop).toHaveBeenCalledWith(SOUND_EVENT.engulfProgress);
    expect(sink.play).toHaveBeenCalledWith(SOUND_EVENT.engulfComplete);
  });

  it('drops the bed to the protocell stem on death and brings the stage back on respawn', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.stageChanged, stage: CELL_STAGE.eukaryote });
    events.emit(effect(createTestCellAbsorbedEffect(), true));
    expect(sink.play).toHaveBeenCalledWith(SOUND_EVENT.engulfed);
    expect(sink.setDanger).toHaveBeenCalledWith(false);
    expect(sink.setAmbientStage).toHaveBeenLastCalledWith(STARTING_STAGE);
    events.emit(effect(createTestRespawnEffect(), true));
    expect(sink.play).toHaveBeenCalledWith(SOUND_EVENT.respawn);
    expect(sink.setAmbientStage).toHaveBeenLastCalledWith(CELL_STAGE.eukaryote);
  });

  it("ignores another player's death and respawn", () => {
    const { events, sink } = wired();
    events.emit(effect(createTestCellAbsorbedEffect(), false));
    events.emit(effect(createTestRespawnEffect(), false));
    expect(sink.play).not.toHaveBeenCalled();
  });
});

describe('SoundEventBus transitions', () => {
  it('follows the stage, the zone and the danger flag', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.stageChanged, stage: CELL_STAGE.prokaryote });
    events.emit({ kind: GAME_EVENT_KIND.zoneChanged, zone: ZONE_ID.warmVent });
    events.emit({ kind: GAME_EVENT_KIND.dangerChanged, isDanger: true });
    expect(sink.setAmbientStage).toHaveBeenCalledWith(CELL_STAGE.prokaryote);
    expect(sink.setZone).toHaveBeenCalledWith(ZONE_ID.warmVent);
    expect(sink.setDanger).toHaveBeenCalledWith(true);
  });

  it('runs the engulf loop with a rate that follows progress and stops it at the end', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.engulfProgress, progress: 0.5 });
    expect(sink.startLoop).toHaveBeenCalledWith(SOUND_EVENT.engulfProgress);
    expect(sink.setLoopPlaybackRate).toHaveBeenCalledWith(SOUND_EVENT.engulfProgress, engulfPlaybackRate(0.5));
    expect(engulfPlaybackRate(0)).toBe(1);
    expect(engulfPlaybackRate(1)).toBe(ENGULF_PROGRESS_MAX_PLAYBACK_RATE);
    events.emit({ kind: GAME_EVENT_KIND.engulfEnded });
    expect(sink.stopLoop).toHaveBeenCalledWith(SOUND_EVENT.engulfProgress);
  });

  it('stops everything and plays the cadence at results, then restarts the bed for the next round', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.stageChanged, stage: CELL_STAGE.specialised });
    events.emit({ kind: GAME_EVENT_KIND.roundPhaseChanged, phase: ROUND_PHASE.results });
    expect(sink.stopAll).toHaveBeenCalledTimes(1);
    expect(sink.play).toHaveBeenCalledWith(SOUND_EVENT.roundEnd);
    events.emit({ kind: GAME_EVENT_KIND.roundPhaseChanged, phase: ROUND_PHASE.playing });
    expect(sink.setAmbientStage).toHaveBeenLastCalledWith(CELL_STAGE.specialised);
  });

  it('does not restart a bed it never had a stage for', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.roundPhaseChanged, phase: ROUND_PHASE.playing });
    expect(sink.setAmbientStage).not.toHaveBeenCalled();
  });

  it('pins the full mix from the bloom, drops it for the spectate and brings it back on respawn until results', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.stageChanged, stage: CELL_STAGE.prokaryote });
    events.emit({ kind: GAME_EVENT_KIND.bloomStarted });
    expect(sink.setBloom).toHaveBeenLastCalledWith(true);
    events.emit(effect(createTestCellAbsorbedEffect(), true));
    expect(sink.setBloom).toHaveBeenLastCalledWith(false);
    expect(sink.setAmbientStage).toHaveBeenLastCalledWith(STARTING_STAGE);
    events.emit(effect(createTestRespawnEffect(), true));
    expect(sink.setAmbientStage).toHaveBeenLastCalledWith(CELL_STAGE.prokaryote);
    expect(sink.setBloom).toHaveBeenLastCalledWith(true);
    events.emit({ kind: GAME_EVENT_KIND.roundPhaseChanged, phase: ROUND_PHASE.results });
    events.emit({ kind: GAME_EVENT_KIND.roundPhaseChanged, phase: ROUND_PHASE.playing });
    events.emit(effect(createTestRespawnEffect(), true));
    expect(sink.setBloom).toHaveBeenCalledTimes(3);
  });

  it('plays the bloom sting, the trait pick and the click', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.bloomStarted });
    events.emit({ kind: GAME_EVENT_KIND.traitPicked, traitId: 'cilia' });
    events.emit({ kind: GAME_EVENT_KIND.uiClick });
    expect(vi.mocked(sink.play).mock.calls.map(([id]) => id)).toEqual([
      SOUND_EVENT.bloomStart,
      SOUND_EVENT.traitPick,
      SOUND_EVENT.uiClick,
    ]);
  });

  it('plays a one-shot trait cue on activation only and holds a looping cue while active', () => {
    const { events, sink } = wired();
    events.emit({ kind: GAME_EVENT_KIND.traitCue, traitId: 'simple_flagellum', isActive: true });
    events.emit({ kind: GAME_EVENT_KIND.traitCue, traitId: 'simple_flagellum', isActive: false });
    expect(sink.play).toHaveBeenCalledTimes(1);
    expect(sink.play).toHaveBeenCalledWith(TRAIT_CUE_BY_TRAIT.simple_flagellum);
    events.emit({ kind: GAME_EVENT_KIND.traitCue, traitId: 'cilia', isActive: true });
    events.emit({ kind: GAME_EVENT_KIND.traitCue, traitId: 'cilia', isActive: false });
    expect(sink.startLoop).toHaveBeenCalledWith(TRAIT_CUE_BY_TRAIT.cilia);
    expect(sink.stopLoop).toHaveBeenCalledWith(TRAIT_CUE_BY_TRAIT.cilia);
  });

  it('stops listening once disconnected', () => {
    const { events, sink, disconnect } = wired();
    disconnect();
    events.emit({ kind: GAME_EVENT_KIND.uiClick });
    expect(sink.play).not.toHaveBeenCalled();
  });
});
