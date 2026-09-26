// The hunter commits to the largest cell it can engulf (the shared predicate through the
// perception, ecology/absorption.md §6.1) and chases it until the prey is gone or no longer engulfable, then
// picks again; it sprints once the prey is within `HUNTER_SPRINT_WITHIN_RADII` of its own radius.
// It reads its own cell through `perception.ownCellOf` (the same self-locator `context.cell` is
// derived from) because it needs the mass, not only the location. `preyPlayerId` narrows the
// hunt to one player (`--prey <playerId>` on the CLI); `withinRadii` to the prey within that many own
// radii and `preference` picks the nearest instead of the largest: the wild hunt of
// docs/ecology/wild-cells.md §3.3 is a fresh, range-bound, nearest-first hunter. No randomness.
// The catalogue's `hunter` is `createGrazingHunterStrategy`: the same hunt, grazing like `grazer` while nothing is
// engulfable (#376), so a bot spawned small grows into a predator instead of waiting for a bigger respawn, and aims
// `HUNTER_AIM_PAST_PREY_RADII` own radii past its prey so it arrives at full throttle (#698). The wild strategy
// composes the bare hunter, which aims at the prey's centre, with its own rules.

import { distanceBetween, unitVectorToward, type PlayerId, type Vec2 } from '@evolution/shared';
import {
  createFirstCommandStrategy,
  type BotStrategy,
  type BotStrategyFactory,
  type PlayerCommand,
} from '../bot-strategy.js';
import { createGrazerStrategy } from './grazer.js';
import { nearestTo, type BotCellView, type BotPerception } from '../perception.js';
import {
  BOT_STRATEGY_NAME,
  HUNT_PREFERENCE,
  HUNTER_AIM_PAST_PREY_RADII,
  HUNTER_SPRINT_WITHIN_RADII,
  type HuntPreference,
} from '../strategy-constants.js';

export interface HunterOptions {
  /** Hunt only this player's cells; every other player is ignored even when engulfable. */
  readonly preyPlayerId?: PlayerId;
  readonly sprintWithinRadii?: number;
  /** Whether it sprints at `prey` once within `sprintWithinRadii`; always by default (the wild hunt skips a prey it already covers). */
  readonly isSprintWorthwhile?: (self: BotCellView, prey: BotCellView) => boolean;
  /** Only prey whose centre is within this many own radii; any distance by default. */
  readonly withinRadii?: number;
  /** Which candidate to take when none is committed: the largest (the default) or the nearest. */
  readonly preference?: HuntPreference;
  /** How far past the prey's centre it aims, along its line of approach, in own radii; 0 (the centre) by default. */
  readonly aimPastRadii?: number;
}

/** Which cells count as prey and which of them a fresh hunter takes; shared by every instance of one factory. */
interface PreyRules {
  isCandidate(self: BotCellView, other: BotCellView): boolean;
  preferredOf(self: BotCellView, candidates: readonly BotCellView[]): BotCellView | undefined;
}

const ALWAYS_WORTHWHILE = (): boolean => true;
/** The bare hunter aims at its prey's centre. */
const AIM_AT_CENTRE_RADII = 0;

/** Where a hunter aims: `aimPastRadii` own radii past the prey's centre, along the line from its own centre through the prey's. */
export function huntTargetFrom(self: BotCellView, prey: Vec2, aimPastRadii: number): Vec2 {
  const approach = unitVectorToward(self, prey);
  return { x: prey.x + approach.x * aimPastRadii * self.radius, y: prey.y + approach.y * aimPastRadii * self.radius };
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
  const {
    sprintWithinRadii = HUNTER_SPRINT_WITHIN_RADII,
    isSprintWorthwhile = ALWAYS_WORTHWHILE,
    aimPastRadii = AIM_AT_CENTRE_RADII,
  } = options;
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
        const isSprinting =
          distanceBetween(self, prey) <= self.radius * sprintWithinRadii && isSprintWorthwhile(self, prey);
        const target = huntTargetFrom(self, prey, aimPastRadii);
        return { targetX: target.x, targetY: target.y, ...(isSprinting ? { isSprinting } : {}) };
      },
    };
  };
}

/**
 * The catalogue's `hunter`: hunts as `createHunterStrategy`, aiming `HUNTER_AIM_PAST_PREY_RADII` own radii past its
 * prey unless `aimPastRadii` says otherwise, and grazes the nearest mote while it has no prey.
 */
export function createGrazingHunterStrategy<Snapshot, ActorId = PlayerId>(
  perception: BotPerception<Snapshot, ActorId>,
  options: HunterOptions = {},
): BotStrategyFactory<Snapshot, ActorId> {
  return createFirstCommandStrategy(BOT_STRATEGY_NAME.hunter, [
    createHunterStrategy(perception, { aimPastRadii: HUNTER_AIM_PAST_PREY_RADII, ...options }),
    createGrazerStrategy(perception),
  ]);
}
