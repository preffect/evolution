// The time sources a bot client is born with (docs/DETERMINISM.md §2): the same pair a room
// gets, because a bot's client tick is the room's fixed step seen from the other end of the
// wire (docs/ARCHITECTURE.md §5: one input per client tick at `TICK_HZ`). Only the CLI names
// the system pair; the integration test hands every bot a manual clock and ticker.

import { createSystemRoomTiming, type RoomTiming, type RoomTimingFactory } from '../../lobby/room-timing.js';

export type BotClientTiming = RoomTiming;
export type BotClientTimingFactory = RoomTimingFactory;

/** Production timing: the monotonic system clock and a real interval ticker, one pair per bot. */
export const createSystemBotClientTiming: BotClientTimingFactory = createSystemRoomTiming;
