// What a `GameInput` asks for (docs/architecture/wire-contract.md §4): the one home of "this input steers",
// read by the server's coalescing and step 1 alike. A target is both coordinates or neither; the
// server's schema refuses a half one.

import type { GameInput } from './messages.js';

export type SteeringGameInput = GameInput & { targetX: number; targetY: number };

/** Whether the input steers; one without a target leaves the latched target alone (#346). */
export function hasSteerTarget(input: GameInput): input is SteeringGameInput {
  return input.targetX !== null && input.targetY !== null;
}
