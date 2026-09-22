// The hunter commits to the largest cell it can engulf (the shared predicate through the
// perception, ecology/absorption.md §6.1) and chases it until the prey is gone or no longer engulfable, then
// picks again; it sprints once the prey is within `HUNTER_SPRINT_WITHIN_RADII` of its own radius.
// It reads its own cell through `perception.ownCellOf` (the same self-locator `context.cell` is
// derived from) because it needs the mass, not only the location. `preyPlayerId` narrows the
// hunt to one player (`--prey <playerId>` on the CLI); `withinRadii` to the prey within that many own
// radii and `preference` picks the nearest instead of the largest: the wild hunt of
// docs/ecology/wild-cells.md §3.3 is a fresh, range-bound, nearest-first hunter. No randomness.

import { distanceBetween, type PlayerId } from '@evolution/shared';
import type { BotStrategy, BotStrategyFactory, PlayerCommand } from '../bot-strategy.js';
import { nearestTo, type BotCellView, type BotPerception } from '../perception.js';
import {
  BOT_STRATEGY_NAME,
  HUNT_PREFERENCE,
  HUNTER_SPRINT_WITHIN_RADII,
  type HuntPreference,
} from '../strategy-constants.js';

export interface HunterOptions {
  /** Hunt only this player's cells; every other player is ignored even when engulfable. */
  readonly preyPlayerId?: PlayerId;
  readonly sprintWithinRadii?: number;
  /** Only prey whose centre is within this many own radii; any distance by default. */
  readonly withinRadii?: number;
  /** Which candidate to take when none is committed: the largest (the default) or the nearest. */
  readonly preference?: HuntPreference;
}

/** Which cells count as prey and which of them a fresh hunter takes; shared by every instance of one factory. */
interface PreyRules {
  isCandidate(self: BotCellView, other: BotCellView): boolean;
  preferredOf(self: BotCellView, candidates: readonly BotCellView[]): BotCellView | undefined;
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

function preyRulesOf<Snapshot, ActorId>(
  perception: BotPerception<Snapshot, ActorId>,
  options: HunterOptions,
): PreyRules {
  const { preyPlayerId, withinRadii = Number.POSITIVE_INFINITY, preference = HUNT_PREFERENCE.largest } = options;
  return {
    isCandidate: (self, other) =>
      other.id !== self.id &&
      (preyPlayerId === undefined || other.playerId === preyPlayerId) &&
      perception.canEngulf(self, other) &&
      distanceBetween(self, other) <= self.radius * withinRadii,
    preferredOf: (self, candidates) =>
      preference === HUNT_PREFERENCE.nearest ? nearestTo(self, candidates) : largestOf(candidates),
  };
}

export function createHunterStrategy<Snapshot, ActorId = PlayerId>(
  perception: BotPerception<Snapshot, ActorId>,
  options: HunterOptions = {},
): BotStrategyFactory<Snapshot, ActorId> {
  const { sprintWithinRadii = HUNTER_SPRINT_WITHIN_RADII } = options;
  const rules = preyRulesOf(perception, options);

  return (): BotStrategy<Snapshot, ActorId> => {
    let committedPreyId: string | undefined;
    const choosePrey = (self: BotCellView, cells: readonly BotCellView[]): BotCellView | undefined => {
      const candidates = cells.filter((other) => rules.isCandidate(self, other));
      const committed = candidates.find((candidate) => candidate.id === committedPreyId);
      const prey = committed ?? rules.preferredOf(self, candidates);
      committedPreyId = prey?.id;
      return prey;
    };
    return {
      name: BOT_STRATEGY_NAME.hunter,
      decide(context): PlayerCommand | null {
        const self = perception.ownCellOf(context.snapshot, context.actorId);
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
