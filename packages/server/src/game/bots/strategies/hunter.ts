// The hunter commits to the largest cell it can engulf (the shared predicate through the
// perception, ECOLOGY §6.1) and chases it until the prey is gone or no longer engulfable, then
// picks again; it sprints once the prey is within `HUNTER_SPRINT_WITHIN_RADII` of its own radius.
// It reads its own cell through `perception.ownCellOf` (the same self-locator `context.cell` is
// derived from) because it needs the mass, not only the location. `preyPlayerId` narrows the
// hunt to one player (`--prey <playerId>` on the CLI). No randomness.

import { distanceBetween, type PlayerId } from '@evolution/shared';
import type { BotStrategy, BotStrategyFactory, PlayerCommand } from '../bot-strategy.js';
import type { BotCellView, BotPerception } from '../perception.js';
import { BOT_STRATEGY_NAME, HUNTER_SPRINT_WITHIN_RADII } from '../strategy-constants.js';

export interface HunterOptions {
  /** Hunt only this player's cells; every other player is ignored even when engulfable. */
  readonly preyPlayerId?: PlayerId;
  readonly sprintWithinRadii?: number;
}

function largestOf(cells: readonly BotCellView[]): BotCellView | undefined {
  let largest: BotCellView | undefined;
  for (const cell of cells) {
    if (largest === undefined || cell.mass > largest.mass) {
      largest = cell;
    }
  }
  return largest;
}

export function createHunterStrategy<Snapshot>(
  perception: BotPerception<Snapshot>,
  options: HunterOptions = {},
): BotStrategyFactory<Snapshot> {
  const { preyPlayerId, sprintWithinRadii = HUNTER_SPRINT_WITHIN_RADII } = options;
  const isCandidate = (self: BotCellView, other: BotCellView): boolean =>
    other.playerId !== self.playerId &&
    (preyPlayerId === undefined || other.playerId === preyPlayerId) &&
    perception.canEngulf(self, other);

  return (): BotStrategy<Snapshot> => {
    let committedPreyId: string | undefined;
    const choosePrey = (self: BotCellView, cells: readonly BotCellView[]): BotCellView | undefined => {
      const candidates = cells.filter((other) => isCandidate(self, other));
      const committed = candidates.find((candidate) => candidate.id === committedPreyId);
      const prey = committed ?? largestOf(candidates);
      committedPreyId = prey?.id;
      return prey;
    };
    return {
      name: BOT_STRATEGY_NAME.hunter,
      decide(context): PlayerCommand | null {
        const self = perception.ownCellOf(context.snapshot, context.playerId);
        if (self === undefined) {
          return null;
        }
        const prey = choosePrey(self, perception.cellsOf(context.snapshot));
        if (prey === undefined) {
          return null;
        }
        const isSprinting = distanceBetween(self, prey) <= self.radius * sprintWithinRadii;
        return { targetX: prey.x, targetY: prey.y, ...(isSprinting ? { isSprinting } : {}) };
      },
    };
  };
}
