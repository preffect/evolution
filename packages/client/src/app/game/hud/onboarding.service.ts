// The onboarding beats' one owner (docs/ui/input-and-onboarding.md §5, docs/ui/components-and-constants.md §7): it
// samples every snapshot into the pure queue (`format/onboarding-queue.ts`) and answers which beat is up. The hint
// pill (`hint.component.ts`) reads `current`, the picker reads it for the `offer` beat's footer line, and the game
// host reads `reticleVisible` for the renderer's steer reticle. Seen-flags live as long as this root service: the
// session. A rematch keeps them; a reload replays them.

import { Injectable, computed, effect, inject, linkedSignal } from '@angular/core';
import {
  EFFECT_KIND,
  PLAYER_LIFE_STATE,
  ROUND_PHASE,
  CELL_STAGE,
  ticksToSeconds,
  type CellView,
  type GameSnapshot,
  type OwnProgressView,
} from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import type { OwnCellIndicators } from '../state/own-cell-indicators';
import { ONBOARDING_BEAT, type OnboardingBeatId, type OnboardingObservation } from './format/onboarding-beats';
import {
  INITIAL_ONBOARDING_MEMORY,
  onboardingStepFor,
  type OnboardingMemory,
  type OnboardingSample,
} from './format/onboarding-queue';

/** One snapshot with the own cell, progress and indicators the HUD derived from it. */
interface OnboardingSource {
  readonly snapshot: GameSnapshot;
  readonly ownCell: CellView | null;
  readonly ownProgress: OwnProgressView | null;
  readonly indicators: OwnCellIndicators | null;
}

/** The facts one snapshot gives the queue; no observation while there is no own cell alive in play. */
export function onboardingSampleFor({
  snapshot,
  ownCell,
  ownProgress,
  indicators,
}: OnboardingSource): OnboardingSample {
  const isAliveInPlay =
    ownCell !== null &&
    ownProgress !== null &&
    ownProgress.lifeState === PLAYER_LIFE_STATE.alive &&
    snapshot.roundPhase === ROUND_PHASE.playing;
  const observation: OnboardingObservation | null = isAliveInPlay
    ? {
        tick: snapshot.tick,
        roundElapsedSeconds: ticksToSeconds(snapshot.tick - snapshot.roundStartTick),
        dnaCumulative: ownProgress.dnaCumulative,
        hasOffer: ownProgress.offer !== null,
        isProkaryote: ownProgress.stage === CELL_STAGE.prokaryote,
        hasThreat: (indicators?.nearestThreat ?? null) !== null,
      }
    : null;
  return {
    tick: snapshot.tick,
    observation,
    ownCell: ownCell === null ? null : { id: ownCell.id, x: ownCell.x, y: ownCell.y },
    hasOwnEat:
      ownCell !== null &&
      snapshot.effects.some((effect) => effect.kind === EFFECT_KIND.eat && effect.cellId === ownCell.id),
    isSprinting: ownCell !== null && ownCell.sprintRemainingTicks > 0,
  };
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly gameState = inject(GameStateService);

  /** The queue, carried from snapshot to snapshot; a recomputation on the same tick changes nothing. */
  private readonly memory = linkedSignal<GameSnapshot | null, OnboardingMemory>({
    source: () => this.gameState.snapshot(),
    computation: (snapshot, previous) => {
      const last = previous?.value ?? INITIAL_ONBOARDING_MEMORY;
      if (snapshot === null) return last;
      return onboardingStepFor(
        last,
        onboardingSampleFor({
          snapshot,
          ownCell: this.gameState.ownCell(),
          ownProgress: this.gameState.ownProgress(),
          indicators: this.gameState.ownCellIndicators(),
        }),
      );
    },
  });

  /** The beat on screen, or `null`. */
  readonly current = computed<OnboardingBeatId | null>(() => this.memory().current);

  /** The steer beat shows the pointer reticle and the dotted line to it (the renderer draws them). */
  readonly reticleVisible = computed(() => this.current() === ONBOARDING_BEAT.steer);

  constructor() {
    // A computed memory steps only when read, and no reader is guaranteed on every snapshot (the picker reads it only
    // while an offer is open): this read steps it once per change detection, so an eat or a dismissal is not skipped.
    effect(() => this.memory());
  }
}
