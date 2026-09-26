// The forager (#376) grazes like `grazer` and flees like `flee` from any cell that can engulf it (the shared
// predicate through the perception, ecology/absorption.md §6.1) within `FORAGER_FLEE_WITHIN_RADII` own radii,
// sprinting once the threat is within `FORAGER_SPRINT_WITHIN_RADII`: the alert prey a `hunter` is measured against
// (#119 item 3). The flee comes first, so a threat in range always wins over food. No randomness.

import type { PlayerId } from '@evolution/shared';
import { createFirstCommandStrategy, type BotStrategyFactory } from '../bot-strategy.js';
import type { BotPerception } from '../perception.js';
import { BOT_STRATEGY_NAME, FORAGER_FLEE_WITHIN_RADII, FORAGER_SPRINT_WITHIN_RADII } from '../strategy-constants.js';
import { createFleeStrategy, type FleeOptions } from './flee.js';
import { createGrazerStrategy } from './grazer.js';

export function createForagerStrategy<Snapshot, ActorId = PlayerId>(
  perception: BotPerception<Snapshot, ActorId>,
  options: FleeOptions = {},
): BotStrategyFactory<Snapshot, ActorId> {
  const fleeOptions: FleeOptions = {
    withinRadii: FORAGER_FLEE_WITHIN_RADII,
    sprintWithinRadii: FORAGER_SPRINT_WITHIN_RADII,
    ...options,
  };
  return createFirstCommandStrategy(BOT_STRATEGY_NAME.forager, [
    createFleeStrategy(perception, fleeOptions),
    createGrazerStrategy(perception),
  ]);
}
