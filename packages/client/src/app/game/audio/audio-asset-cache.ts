// Fetches and decodes the manifest's files once each (docs/AUDIO.md §4). A file that is missing,
// unreachable or undecodable is remembered as `null`, so a cue whose asset never shipped costs one
// request and is silent from then on (docs/ARCHITECTURE.md §7). Playback never waits on a load:
// `peek` answers what is decoded now, `load` fills the cache for later.

import {
  AUDIO_ASSET_BASE_PATH,
  AUDIO_MANIFEST_FILE_NAME,
  parseAudioManifest,
  type AudioManifest,
} from '@evolution/shared';
import type { AudioBackend, DecodedAudio } from './audio-backend';

/** How bytes and JSON reach the cache; `null` for any failure (a 404, a network error, bad JSON). */
export interface AudioAssetLoader {
  fetchJson(url: string): Promise<unknown>;
  fetchBytes(url: string): Promise<ArrayBuffer | null>;
}

const PATH_SEPARATOR = '/';

export function audioAssetUrl(fileName: string): string {
  return `${AUDIO_ASSET_BASE_PATH}${PATH_SEPARATOR}${fileName}`;
}

/** The production loader over `fetch`; never throws. */
export class FetchAudioAssetLoader implements AudioAssetLoader {
  async fetchJson(url: string): Promise<unknown> {
    try {
      const response = await fetch(url);
      return response.ok ? await response.json() : null;
    } catch {
      // No manifest is the same as an empty one: the game plays silent (docs/ARCHITECTURE.md §7).
      return null;
    }
  }

  async fetchBytes(url: string): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(url);
      return response.ok ? await response.arrayBuffer() : null;
    } catch {
      // A missing file is a silent cue, by design.
      return null;
    }
  }
}

export class AudioAssetCache {
  private readonly decoded = new Map<string, DecodedAudio | null>();
  private readonly pending = new Map<string, Promise<DecodedAudio | null>>();

  constructor(
    private readonly loader: AudioAssetLoader,
    private readonly backend: AudioBackend,
  ) {}

  /** The manifest, or `null` when it is absent or of another shape. */
  async loadManifest(): Promise<AudioManifest | null> {
    return parseAudioManifest(await this.loader.fetchJson(audioAssetUrl(AUDIO_MANIFEST_FILE_NAME)));
  }

  /** Decoded and ready, or `null` when missing or not loaded yet. */
  peek(fileName: string): DecodedAudio | null {
    return this.decoded.get(fileName) ?? null;
  }

  /** True once the file was fetched, whether or not it exists. */
  isResolved(fileName: string): boolean {
    return this.decoded.has(fileName);
  }

  load(fileName: string): Promise<DecodedAudio | null> {
    if (this.decoded.has(fileName)) return Promise.resolve(this.decoded.get(fileName) ?? null);
    const inFlight = this.pending.get(fileName);
    if (inFlight) return inFlight;
    const request = this.fetchAndDecode(fileName).then((sound) => {
      this.decoded.set(fileName, sound);
      this.pending.delete(fileName);
      return sound;
    });
    this.pending.set(fileName, request);
    return request;
  }

  /** Every file the manifest names, so the first play of each cue is on time. */
  async preload(manifest: AudioManifest): Promise<void> {
    const fileNames = Object.values(manifest.events).flatMap((entry) => entry.files.map((file) => file.path));
    await Promise.all(fileNames.map((fileName) => this.load(fileName)));
  }

  private async fetchAndDecode(fileName: string): Promise<DecodedAudio | null> {
    const bytes = await this.loader.fetchBytes(audioAssetUrl(fileName));
    return bytes ? this.backend.decode(bytes) : null;
  }
}
