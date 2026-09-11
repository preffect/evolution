// The client's one event seam (docs/ARCHITECTURE.md §6, §7): server-owned moments arrive as the
// snapshot's `GameEffect`s, state transitions are detected by `SnapshotTransitionTracker`, and
// the renderer (#99) and HUD (#100) raise the local moments (a click, a card, a trait cue).
// Subscribers (the sound bus, later the toast and onboarding services) never see each other.

import { Injectable } from '@angular/core';
import type { CellStage, GameEffect, RoundPhase, TraitId, ValueOf, ZoneId } from '@evolution/shared';

export const GAME_EVENT_KIND = {
  effect: 'effect',
  stageChanged: 'stage_changed',
  organelleGained: 'organelle_gained',
  dangerChanged: 'danger_changed',
  zoneChanged: 'zone_changed',
  engulfProgress: 'engulf_progress',
  engulfEnded: 'engulf_ended',
  roundPhaseChanged: 'round_phase_changed',
  bloomStarted: 'bloom_started',
  traitPicked: 'trait_picked',
  traitCue: 'trait_cue',
  uiClick: 'ui_click',
} as const;
export type GameEventKind = ValueOf<typeof GAME_EVENT_KIND>;

export type GameEvent =
  /** One server effect, every player's: `isOwn` when it happened to the own cell, `isOwnPredator` when the own cell absorbed the prey. */
  | { kind: typeof GAME_EVENT_KIND.effect; effect: GameEffect; isOwn: boolean; isOwnPredator: boolean }
  | { kind: typeof GAME_EVENT_KIND.stageChanged; stage: CellStage }
  /** The own cell owns `organelleCount` traits after gaining `traitId`. */
  | { kind: typeof GAME_EVENT_KIND.organelleGained; traitId: TraitId; organelleCount: number }
  /** A cell that can engulf the own cell exists (the shared `canEngulf` predicate). */
  | { kind: typeof GAME_EVENT_KIND.dangerChanged; isDanger: boolean }
  /** Raised by the renderer, which owns the dish geometry (#99). */
  | { kind: typeof GAME_EVENT_KIND.zoneChanged; zone: ZoneId }
  /** The own cell is engulfing; `progress` is the prey's 0..1. */
  | { kind: typeof GAME_EVENT_KIND.engulfProgress; progress: number }
  | { kind: typeof GAME_EVENT_KIND.engulfEnded }
  | { kind: typeof GAME_EVENT_KIND.roundPhaseChanged; phase: RoundPhase }
  | { kind: typeof GAME_EVENT_KIND.bloomStarted }
  /** Raised by the HUD the moment a card is chosen, before the server confirms it. */
  | { kind: typeof GAME_EVENT_KIND.traitPicked; traitId: TraitId }
  /** Raised by the renderer at a trait's moment (docs/TRAITS.md §3); `isActive: false` ends a looping cue. */
  | { kind: typeof GAME_EVENT_KIND.traitCue; traitId: TraitId; isActive: boolean }
  | { kind: typeof GAME_EVENT_KIND.uiClick };

export type GameEventListener = (event: GameEvent) => void;
export type Unsubscribe = () => void;

/** Synchronous fan-out to every subscriber, in subscription order. */
@Injectable({ providedIn: 'root' })
export class GameEventBus {
  private readonly listeners = new Set<GameEventListener>();

  subscribe(listener: GameEventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: GameEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  emitAll(events: readonly GameEvent[]): void {
    for (const event of events) this.emit(event);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
