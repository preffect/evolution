// The audio catalogue numbers (docs/AUDIO.md §2, §3; decision #140 option B "living broth").
// Cosmetic data read by the client's audio hooks only; never by the server, excluded from
// `data/balance.json` like motion.ts (docs/CODE-STANDARDS.md §2). Ids are types/audio.ts.

import { AUDIO_BUS, SOUND_EVENT, type SoundEventId, type SoundEventRule } from '../types/audio.js';
import { CELL_STAGE, type CellStage } from '../types/game.js';
import { STAGE_ORDER } from './ladder.js';

/** localStorage key of the persisted mute flag (`'1'` = muted). */
export const AUDIO_MUTE_STORAGE_KEY = 'evolution.audio.muted';
/** Where the client fetches the manifest and the files it names (docs/AUDIO.md §4). */
export const AUDIO_ASSET_BASE_PATH = '/assets/audio';
export const AUDIO_MANIFEST_FILE_NAME = 'manifest.json';
/** Bumped when the manifest shape changes; the loader ignores a manifest of another version. */
export const AUDIO_MANIFEST_VERSION = 1;

/**
 * #140's scale: `essential` is never dropped and ducks the music; `major` is dropped only for an
 * `essential`; `minor` is dropped when more than `MAX_OVERLAPPING_CUES` overlap; `filler` first to go.
 */
export const SOUND_PRIORITY = { filler: 0, minor: 1, major: 2, essential: 3 } as const;
/** One-shot cues sounding at once before the scheduler starts dropping by priority. */
export const MAX_OVERLAPPING_CUES = 4;

/** Default gain per bus; the master is the persisted mute's target. */
export const DEFAULT_BUS_GAIN = { master: 1, music: 0.8, sfx: 1 } as const;
/** The ambient layers duck by this much while a threat ring shows or an essential cue plays. */
export const DUCK_DECIBELS = -8;
export const DUCK_RAMP_SECONDS = 0.5;
/** Ambient stems crossfade over this long on a stage change. */
export const AMBIENT_CROSSFADE_SECONDS = 4;
/** Zone overlays crossfade over this long when the own cell changes zone. */
export const ZONE_CROSSFADE_SECONDS = 2;
/** The engulf-progress loop's playback rate rises from 1 to this as progress reaches 1. */
export const ENGULF_PROGRESS_MAX_PLAYBACK_RATE = 1.5;

/** Ambient stems in ladder order: one per stage, each adding an instrument. Index into the manifest's `ambient_bed` files. */
export const AMBIENT_STEM_BY_STAGE: Record<CellStage, number> = {
  [CELL_STAGE.protocell]: 0,
  [CELL_STAGE.prokaryote]: 1,
  [CELL_STAGE.endosymbiosis]: 2,
  [CELL_STAGE.eukaryote]: 3,
  [CELL_STAGE.specialised]: 4,
};
export const AMBIENT_STEM_COUNT = STAGE_ORDER.length;
/** The level-up motif gains one instrument per organelle owned, capped at the bed's instrument count. */
export const MOTIF_INSTRUMENT_COUNT = AMBIENT_STEM_COUNT;

const NO_COOLDOWN = 0;
const TRAIT_CUE_COOLDOWN_MS = 300;

function oneShot(priority: SoundEventRule['priority'], cooldownMs: number): SoundEventRule {
  return { priority, cooldownMs, isLoop: false, bus: AUDIO_BUS.sfx };
}
function loop(priority: SoundEventRule['priority'], cooldownMs: number): SoundEventRule {
  return { priority, cooldownMs, isLoop: true, bus: AUDIO_BUS.sfx };
}
function musicLoop(priority: SoundEventRule['priority'], cooldownMs: number): SoundEventRule {
  return { priority, cooldownMs, isLoop: true, bus: AUDIO_BUS.music };
}

/** The option B event table of #140, one row per id; docs/AUDIO.md §2 is the readable copy. */
export const SOUND_EVENT_CATALOG: Record<SoundEventId, SoundEventRule> = {
  [SOUND_EVENT.ambientBed]: musicLoop(SOUND_PRIORITY.essential, NO_COOLDOWN),
  [SOUND_EVENT.zoneLayer]: musicLoop(SOUND_PRIORITY.minor, 2000),
  [SOUND_EVENT.eat]: oneShot(SOUND_PRIORITY.filler, 150),
  [SOUND_EVENT.dnaAbsorb]: oneShot(SOUND_PRIORITY.minor, 300),
  [SOUND_EVENT.levelUp]: {
    priority: SOUND_PRIORITY.essential,
    cooldownMs: NO_COOLDOWN,
    isLoop: false,
    bus: AUDIO_BUS.music,
  },
  [SOUND_EVENT.traitPick]: oneShot(SOUND_PRIORITY.major, NO_COOLDOWN),
  [SOUND_EVENT.dangerWarning]: musicLoop(SOUND_PRIORITY.major, 1000),
  [SOUND_EVENT.engulfProgress]: loop(SOUND_PRIORITY.major, NO_COOLDOWN),
  [SOUND_EVENT.engulfComplete]: oneShot(SOUND_PRIORITY.essential, NO_COOLDOWN),
  [SOUND_EVENT.engulfed]: oneShot(SOUND_PRIORITY.essential, NO_COOLDOWN),
  [SOUND_EVENT.respawn]: oneShot(SOUND_PRIORITY.major, NO_COOLDOWN),
  [SOUND_EVENT.bloomStart]: oneShot(SOUND_PRIORITY.major, NO_COOLDOWN),
  [SOUND_EVENT.roundEnd]: {
    priority: SOUND_PRIORITY.essential,
    cooldownMs: NO_COOLDOWN,
    isLoop: false,
    bus: AUDIO_BUS.music,
  },
  [SOUND_EVENT.uiClick]: oneShot(SOUND_PRIORITY.filler, 60),
  // Trait cues (docs/TRAITS.md §3): a cue that reads "while" loops until the renderer ends it.
  [SOUND_EVENT.softClick]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.whipCrack]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.dullThud]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.eatGurgle]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.lowThrum]: loop(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.warmShimmer]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.deepChime]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.tautSnap]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.softFlutter]: loop(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.absorbGurgle]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.toxinHiss]: loop(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.wetStretch]: oneShot(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.rapidFlutter]: loop(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.lowHum]: loop(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.shellScrape]: loop(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
  [SOUND_EVENT.hissDrone]: loop(SOUND_PRIORITY.minor, TRAIT_CUE_COOLDOWN_MS),
};
