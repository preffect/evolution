// The broadcast and the viewer members split the snapshot exactly (#399). The type assertions fail
// `./validate.sh typecheck`: a member moved to the viewers but still built for the broadcast, or built by neither side,
// is a compile error rather than a wasted or a missing member on the wire.
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GameSnapshot } from '@evolution/shared';
import { serializeBroadcastSnapshot } from './serialize.js';
import {
  VIEWER_SNAPSHOT_KEYS,
  type BroadcastSnapshot,
  type ViewerSnapshotKey,
  type ViewerSnapshotMembers,
} from './viewer-snapshot-keys.js';
import type { EvolutionViewerState } from './viewer-state.js';

describe('VIEWER_SNAPSHOT_KEYS', () => {
  it('split the snapshot between the broadcast and the viewers, no member on both sides or on neither', () => {
    expectTypeOf<Extract<keyof BroadcastSnapshot, ViewerSnapshotKey>>().toBeNever();
    expectTypeOf<keyof BroadcastSnapshot | ViewerSnapshotKey>().toEqualTypeOf<keyof GameSnapshot>();
    expect(new Set(VIEWER_SNAPSHOT_KEYS).size).toBe(VIEWER_SNAPSHOT_KEYS.length);
  });

  it('type the broadcast without the viewer members and each viewer with all of them', () => {
    expectTypeOf(serializeBroadcastSnapshot).returns.toEqualTypeOf<BroadcastSnapshot>();
    expectTypeOf<EvolutionViewerState['serialize']>().returns.toEqualTypeOf<ViewerSnapshotMembers>();
    expectTypeOf<EvolutionViewerState['serializeFull']>().returns.toEqualTypeOf<ViewerSnapshotMembers>();
  });
});
