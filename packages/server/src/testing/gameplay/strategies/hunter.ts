// The hunter commits to the largest cell it can engulf (the shared predicate through the
// perception, ECOLOGY §6.1) and chases it until the prey is gone or no longer engulfable, then
// picks again; it sprints once the prey is within `HUNTER_SPRINT_WITHIN_RADII` of its own radius.
// `preyPlayerId` narrows the hunt to one player (`hunt <playerId>` on the CLI). No randomness.

import type { PlayerId } from '@evolution/shared';
import type { PlayerCommand } from '../adapter.js';
import type { BotStrategy, BotStrategyFactory } from '../bots.js';
import type { ScriptContext } from '../scripts.js';
import { distanceBetween, type BotCellView, type BotPerception } from './perception.js';
import { BOT_STRATEGY_NAME, HUNTER_SPRINT_WITHIN_RADII } from './strategy-constants.js';

export interface HunterOptions {
  /** Hunt only this player's cells; every other player is ignored even when engulfable. */
  readonly preyPlayerId?: PlayerId;
  readonly sprintWithinRadii?: number;
}

function ownCellOf<Snapshot>(
  perception: BotPerception<Snapshot>,
  context: ScriptContext<Snapshot>,
): BotCellView | undefined {
  return perception.cellsOf(context.snapshot).find((cell) => cell.playerId === context.playerId);
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
        const self = ownCellOf(perception, context);
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
