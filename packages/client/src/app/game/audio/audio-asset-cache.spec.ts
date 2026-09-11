import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_ASSET_BASE_PATH, AUDIO_MANIFEST_FILE_NAME, parseAudioManifest } from '@evolution/shared';
import { AudioAssetCache, FetchAudioAssetLoader, audioAssetUrl } from './audio-asset-cache';
import { FakeAudioAssetLoader, FakeAudioBackend } from '../../../testing/fake-audio-backend';
import { createTestAudioManifest, testManifestFileNames } from '../../../testing/builders';

const PRESENT = 'eat-note-1.mp3';
const MISSING = 'never-shipped.mp3';

function createCache(files = testManifestFileNames()) {
  const backend = new FakeAudioBackend();
  const loader = new FakeAudioAssetLoader(createTestAudioManifest(), files);
  return { backend, loader, cache: new AudioAssetCache(loader, backend) };
}

describe('AudioAssetCache', () => {
  it('builds urls under the shared base path', () => {
    expect(audioAssetUrl(PRESENT)).toBe(`${AUDIO_ASSET_BASE_PATH}/${PRESENT}`);
  });

  it('loads and parses the manifest, answering null for an invalid one', async () => {
    const { cache, loader } = createCache();
    expect(await cache.loadManifest()).not.toBeNull();
    expect(loader.requestedUrls).toEqual([audioAssetUrl(AUDIO_MANIFEST_FILE_NAME)]);
    loader.setManifest({ version: 0 });
    expect(await cache.loadManifest()).toBeNull();
  });

  it('decodes a present file once and remembers a missing one as null', async () => {
    const { cache, loader, backend } = createCache();
    expect(cache.peek(PRESENT)).toBeNull();
    expect(cache.isResolved(PRESENT)).toBe(false);
    const first = cache.load(PRESENT);
    const second = cache.load(PRESENT);
    expect(await first).toBe(await second);
    expect(cache.peek(PRESENT)?.durationSeconds).toBe(1);
    expect(await cache.load(MISSING)).toBeNull();
    expect(cache.isResolved(MISSING)).toBe(true);
    await cache.load(PRESENT);
    expect(loader.requestedUrls.filter((url) => url.endsWith(PRESENT))).toHaveLength(1);
    expect(backend.decodedLabels).toEqual([PRESENT]);
  });

  it('remembers an undecodable file as missing', async () => {
    const { cache, backend } = createCache();
    backend.undecodable.add(PRESENT);
    expect(await cache.load(PRESENT)).toBeNull();
    expect(cache.peek(PRESENT)).toBeNull();
  });

  it('settles a loader that rejects as missing, leaving nothing pending', async () => {
    const { cache, loader } = createCache();
    vi.spyOn(loader, 'fetchBytes').mockRejectedValueOnce(new Error('offline'));
    expect(await cache.load(PRESENT)).toBeNull();
    expect(cache.isResolved(PRESENT)).toBe(true);
    expect(cache.peek(PRESENT)).toBeNull();
  });

  it('preloads every file the manifest names', async () => {
    const { cache } = createCache();
    const manifest = parseAudioManifest(createTestAudioManifest())!;
    await cache.preload(manifest);
    for (const path of testManifestFileNames()) expect(cache.isResolved(path)).toBe(true);
  });
});

describe('FetchAudioAssetLoader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the JSON and the bytes of an ok response', async () => {
    const bytes = new Uint8Array([1, 2]).buffer;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ version: 1 }), arrayBuffer: async () => bytes })),
    );
    const loader = new FetchAudioAssetLoader();
    expect(await loader.fetchJson('/m.json')).toEqual({ version: 1 });
    expect(await loader.fetchBytes('/f.mp3')).toBe(bytes);
  });

  it('returns null for a failed response and for a thrown fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    );
    const loader = new FetchAudioAssetLoader();
    expect(await loader.fetchJson('/m.json')).toBeNull();
    expect(await loader.fetchBytes('/f.mp3')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    );
    expect(await loader.fetchJson('/m.json')).toBeNull();
    expect(await loader.fetchBytes('/f.mp3')).toBeNull();
  });
});
