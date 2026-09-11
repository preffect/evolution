// The sound vocabulary (docs/AUDIO.md §2, docs/ARCHITECTURE.md §7): the event ids, the buses and
// the shape of a catalogue rule. The numbers themselves (priority, cooldown, layering) are the
// constants in constants/audio.ts; the trait cues are the `audioCue` values of docs/TRAITS.md §3.

import type { ValueOf } from './common.js';
import type { SOUND_PRIORITY } from '../constants/audio.js';

export const SOUND_EVENT = {
  ambientBed: 'ambient_bed',
  zoneLayer: 'zone_layer',
  eat: 'eat',
  dnaAbsorb: 'dna_absorb',
  levelUp: 'level_up',
  traitPick: 'trait_pick',
  dangerWarning: 'danger_warning',
  engulfProgress: 'engulf_progress',
  engulfComplete: 'engulf_complete',
  engulfed: 'engulfed',
  respawn: 'respawn',
  bloomStart: 'bloom_start',
  roundEnd: 'round_end',
  uiClick: 'ui_click',
  // Trait cues, one per build-1 trait (docs/TRAITS.md §3), in catalog order.
  softClick: 'soft_click',
  whipCrack: 'whip_crack',
  dullThud: 'dull_thud',
  eatGurgle: 'eat_gurgle',
  lowThrum: 'low_thrum',
  warmShimmer: 'warm_shimmer',
  deepChime: 'deep_chime',
  tautSnap: 'taut_snap',
  softFlutter: 'soft_flutter',
  absorbGurgle: 'absorb_gurgle',
  toxinHiss: 'toxin_hiss',
  wetStretch: 'wet_stretch',
  rapidFlutter: 'rapid_flutter',
  lowHum: 'low_hum',
  shellScrape: 'shell_scrape',
  hissDrone: 'hiss_drone',
} as const;
export type SoundEventId = ValueOf<typeof SOUND_EVENT>;

/** The three gain stages: every cue plays through `sfx` or `music`, both through `master`. */
export const AUDIO_BUS = { master: 'master', music: 'music', sfx: 'sfx' } as const;
export type AudioBus = ValueOf<typeof AUDIO_BUS>;

export type SoundPriority = ValueOf<typeof SOUND_PRIORITY>;

/** One catalogue row: how the client schedules the event (docs/AUDIO.md §2). */
export interface SoundEventRule {
  priority: SoundPriority;
  /** Minimum gap between two plays of the same event; 0 = none. */
  cooldownMs: number;
  /** Keeps playing until its end condition instead of once through. */
  isLoop: boolean;
  bus: Exclude<AudioBus, typeof AUDIO_BUS.master>;
}
