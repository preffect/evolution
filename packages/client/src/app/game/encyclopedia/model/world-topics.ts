// The world pages that are no zone (docs/architecture/encyclopedia.md §12.4; #361 writes them).

import type { ValueOf } from '@evolution/shared';

export const WORLD_TOPIC = { dish: 'dish', worldClock: 'world_clock', bloom: 'bloom', round: 'round' } as const;
export type WorldTopicId = ValueOf<typeof WORLD_TOPIC>;
