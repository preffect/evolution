// The flee strategy runs from the nearest cell that can engulf it (the shared predicate through the
// perception, ecology/absorption.md §6.1) once that cell's centre is within `withinRadii` own radii, aiming
// `stepRadii` own radii past its own centre straight away from the threat; with no threat in range it
// sends nothing, so a composed strategy (the wild strategy, docs/ecology/wild-cells.md §3.3) falls through to
// its next rule. It reads its own cell through `perception.ownCellOf` because the predicate needs the
// mass. No randomness, no state.

import { distanceBetween, unitVectorToward, type PlayerId, type Vec2 } from '@evolution/shared';
import type { BotStrategy, BotStrategyFactory, PlayerCommand } from '../bot-strategy.js';
import { nearestTo, type BotCellView, type BotPerception } from '../perception.js';
import { BOT_STRATEGY_NAME, FLEE_STEP_RADII, FLEE_WITHIN_RADII } from '../strategy-constants.js';

export interface FleeOptions {
  /** Flee only from a threat whose centre is within this many own radii. */
  readonly withinRadii?: number;
  /** How far past its own centre it aims, in own radii. */
  readonly stepRadii?: number;
}

/** Where a fleeing cell aims: `stepRadii` own radii from its centre, straight away from the threat. */
export function fleeTargetFrom(self: BotCellView, threat: Vec2, stepRadii: number): Vec2 {
  const away = unitVectorToward(threat, self);
  return { x: self.x + away.x * stepRadii * self.radius, y: self.y + away.y * stepRadii * self.radius };
}

export function createFleeStrategy<Snapshot, ActorId = PlayerId>(
  perception: BotPerception<Snapshot, ActorId>,
  options: FleeOptions = {},
): BotStrategyFactory<Snapshot, ActorId> {
  const { withinRadii = FLEE_WITHIN_RADII, stepRadii = FLEE_STEP_RADII } = options;
  const isThreat = (self: BotCellView, other: BotCellView): boolean =>
    other.id !== self.id &&
    perception.canEngulf(other, self) &&
    distanceBetween(self, other) <= self.radius * withinRadii;

  return (): BotStrategy<Snapshot, ActorId> => ({
    name: BOT_STRATEGY_NAME.flee,
    decide(context): PlayerCommand | null {
      const self = perception.ownCellOf(context.snapshot, context.actorId);
      if (self === undefined) {
        return null;
      }
      const threats = perception.cellsOf(context.snapshot).filter((other) => isThreat(self, other));
      const threat = nearestTo(self, threats);
      if (threat === undefined) {
        return null;
      }
      const target = fleeTargetFrom(self, threat, stepRadii);
      return { targetX: target.x, targetY: target.y };
    },
  });
}
