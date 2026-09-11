// The typed sound-event catalogue (docs/ARCHITECTURE.md §7, docs/AUDIO.md §2, §3): lookups over
// the ids of types/audio.ts and the numbers of constants/audio.ts, plus the layering rules the
// client's ambient mixer and level-up motif follow. Pure; the server never imports this.

import { SOUND_EVENT, type SoundEventId, type SoundEventRule } from '../types/audio.js';
import type { CellStage, TraitId } from '../types/game.js';
import {
  AMBIENT_STEM_BY_STAGE,
  AMBIENT_STEM_COUNT,
  MOTIF_INSTRUMENT_COUNT,
  SOUND_EVENT_CATALOG,
} from '../constants/audio.js';
import { TRAIT_CATALOG } from '../constants/traits.js';

/** Every id, in the declaration order of `SOUND_EVENT`. */
export const SOUND_EVENT_IDS: readonly SoundEventId[] = Object.values(SOUND_EVENT);

/** Every id without a rule is a type error; the test pins it at runtime as well. */
export function soundEventRule(id: SoundEventId): SoundEventRule {
  return SOUND_EVENT_CATALOG[id];
}

/** The trait cue of docs/TRAITS.md §3 by trait id, read from the catalog so the two cannot drift. */
export const TRAIT_CUE_BY_TRAIT: Readonly<Record<TraitId, SoundEventId>> = Object.fromEntries(
  TRAIT_CATALOG.map((trait) => [trait.id, trait.audioCue]),
) as Record<TraitId, SoundEventId>;

/** The stem index (0-based) the ambient bed plays at a stage; monotone along `STAGE_ORDER`. */
export function ambientStemForStage(stage: CellStage): number {
  return AMBIENT_STEM_BY_STAGE[stage];
}

/** The level-up motif's instrument index for a cell owning `organelleCount` traits, capped at the bed's instruments. */
export function motifInstrumentFor(organelleCount: number): number {
  return Math.max(0, Math.min(organelleCount, MOTIF_INSTRUMENT_COUNT - 1));
}

/**
 * Graceful degradation (#140): when the wanted stem has not shipped, play the nearest one that has,
 * preferring the lower stem on a tie so the bed never sounds richer than the stage. `null` when
 * no stem is available at all.
 */
export function nearestAvailableStem(wantedStem: number, isAvailable: (stem: number) => boolean): number | null {
  for (let distance = 0; distance < AMBIENT_STEM_COUNT; distance += 1) {
    const lower = wantedStem - distance;
    if (lower >= 0 && isAvailable(lower)) return lower;
    const higher = wantedStem + distance;
    if (higher < AMBIENT_STEM_COUNT && isAvailable(higher)) return higher;
  }
  return null;
}

const DECIBELS_PER_DECADE = 20;
const DECIBEL_BASE = 10;

/** Amplitude gain for a level in decibels (`-8 dB` ≈ 0.398). */
export function decibelsToGain(decibels: number): number {
  return Math.pow(DECIBEL_BASE, decibels / DECIBELS_PER_DECADE);
}
