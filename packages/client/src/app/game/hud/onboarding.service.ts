// The onboarding beats' one owner (docs/ui/input-and-onboarding.md §5, docs/ui/components-and-constants.md §7): it
// samples every snapshot into the pure queue (`format/onboarding-queue.ts`) and answers which beat is up. The hint
// pill (`hint.component.ts`) reads `current`, the picker reads it for the `offer` beat's footer line, and the game
// host reads `reticleVisible` for the renderer's steer reticle. Seen-flags live as long as this root service: the
// session. A rematch keeps them; a reload replays them.

import { Injectable, computed, effect, inject, linkedSignal } from '@angular/core';
import type { GameSnapshot } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { ONBOARDING_BEAT, type OnboardingBeatId } from './format/onboarding-beats';
import { INITIAL_ONBOARDING_MEMORY, onboardingStepFor, type OnboardingMemory } from './format/onboarding-queue';
import { onboardingSampleFor } from './format/onboarding-sample';

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
          balance: this.gameState.balance(),
          roundDurationSeconds: this.gameState.sessionConfig()?.roundDurationSeconds ?? null,
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
