// The asset manifest shape (docs/AUDIO.md §4): `assets/audio/manifest.json` maps every sound
// event to its files, mood, length and generation prompt. `parseAudioManifest` is the one
// validator, shared by the manifest test and the client loader; the loader treats an invalid
// manifest as "no assets" (docs/ARCHITECTURE.md §7: silent, never throwing).

import { SOUND_EVENT, type SoundEventId } from '../types/audio.js';
import { AUDIO_MANIFEST_VERSION } from '../constants/audio.js';

/** One file of an event; `key` names the variant (a stage, a zone id, an instrument, a note). */
export interface AudioFileReference {
  key: string;
  path: string;
}

export interface AudioManifestEntry {
  /** Two to five adjectives from the direction's palette. */
  mood: string;
  lengthSeconds: number;
  isLoop: boolean;
  /** The Lyria / curated-SFX prompt sketch the pipeline expands (docs/AUDIO-PIPELINE.md §5). */
  promptHint: string;
  /** Ordered; index 0 is the default variant. May be empty while nothing has shipped. */
  files: AudioFileReference[];
}

export interface AudioManifest {
  version: number;
  events: Record<SoundEventId, AudioManifestEntry>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFileReference(value: unknown): value is AudioFileReference {
  return isRecord(value) && typeof value['key'] === 'string' && typeof value['path'] === 'string';
}

function isEntry(value: unknown): value is AudioManifestEntry {
  if (!isRecord(value)) return false;
  const { mood, lengthSeconds, isLoop, promptHint, files } = value;
  return (
    typeof mood === 'string' &&
    typeof lengthSeconds === 'number' &&
    lengthSeconds > 0 &&
    typeof isLoop === 'boolean' &&
    typeof promptHint === 'string' &&
    Array.isArray(files) &&
    files.every(isFileReference)
  );
}

/** The manifest when `value` has the current version and an entry for every id; `null` otherwise. */
export function parseAudioManifest(value: unknown): AudioManifest | null {
  if (!isRecord(value) || value['version'] !== AUDIO_MANIFEST_VERSION || !isRecord(value['events'])) return null;
  const events = value['events'];
  const isComplete = Object.values(SOUND_EVENT).every((id) => isEntry(events[id]));
  return isComplete ? (value as unknown as AudioManifest) : null;
}

/** The file for a variant key (`stage`, zone id, `instrument-2`), else the default; `null` when none. */
export function resolveAudioFile(
  manifest: AudioManifest,
  id: SoundEventId,
  variantKey?: string,
): AudioFileReference | null {
  const { files } = manifest.events[id];
  if (variantKey !== undefined) return files.find((file) => file.key === variantKey) ?? null;
  return files[0] ?? null;
}

/** The file at a position of the event's list, wrapping (the round-robin notes); `null` when the list is empty. */
export function resolveAudioFileAt(
  manifest: AudioManifest,
  id: SoundEventId,
  index: number,
): AudioFileReference | null {
  const { files } = manifest.events[id];
  if (files.length === 0) return null;
  return files[index % files.length] ?? null;
}
