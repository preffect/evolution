// The era clock in the step (docs/architecture/server-simulation.md §3 "Which moves a step runs: one rule",
// docs/game-design/phases.md §14.2.4, §14.4): after step 2, the step runs the move into every era after the one the
// world has moved into, up to the clock's era (`roundEraAt`), in `GAME_ERA_ORDER`, each with its `era_moved` effect,
// and records each in `eraMovedInto` as it runs. One rule covers the clock reaching a start, a `debug_set_era` jump (a
// jump to `colonies` runs the pool's move, then the colonies') and a balance patch that turns an era on after its
// start. The next era's `era_warning` fires on its warning tick, `ERA_MOVE_WARNING_SECONDS` before its start, when the
// round reaches that era. With `ERAS_IN_PLAY` = `['dish']` nothing here ever fires: today's game, hash and replays.

import {
  EFFECT_KIND,
  GAME_ERA,
  GAME_ERA_ORDER,
  eraWarningStartedAtTick,
  isEraAfter,
  isEraReachable,
  type GameEra,
} from '@evolution/shared';
import type { StepContext, WorldState } from '../world/world-state.js';
import { runPoolMove } from './pool-move.js';
import { roundEraAt } from './round-clock.js';

/** An era a world can move into: every era but the first. */
type LaterEra = Exclude<GameEra, typeof GAME_ERA.dish>;

/**
 * What each move does to the world. The colonies open in place (§14.4.5): no world change, no size reset, no grace;
 * their wild colonies come with ticket #891.
 */
const ERA_MOVES: Readonly<Record<LaterEra, (world: WorldState, context: StepContext) => void>> = {
  [GAME_ERA.pool]: runPoolMove,
  [GAME_ERA.colonies]: () => undefined,
};

function isLaterEra(era: GameEra): era is LaterEra {
  return era !== GAME_ERA.dish;
}

/** The eras after `eraMovedInto` up to and including `clockEra`, in era order: the moves this step runs. */
export function erasToMoveInto(eraMovedInto: GameEra, clockEra: GameEra): LaterEra[] {
  return GAME_ERA_ORDER.filter(isLaterEra).filter((era) => isEraAfter(era, eraMovedInto) && !isEraAfter(era, clockEra));
}

/** The next era the round will move into, if it reaches one: in play, after the world's, before the round's end. */
function nextReachableEra(world: WorldState): GameEra | undefined {
  const roundDurationSeconds = world.config.roundDurationSeconds;
  return GAME_ERA_ORDER.find(
    (era) => isEraAfter(era, world.eraMovedInto) && isEraReachable(era, roundDurationSeconds, world.balance),
  );
}

/** `era_warning` on the next era's warning tick (§14.4.1): the toast, the thinning rim, the swell. */
function emitEraWarning(world: WorldState, context: StepContext): void {
  const era = nextReachableEra(world);
  if (era !== undefined && world.tick === eraWarningStartedAtTick(era, world.roundStartTick, world.balance)) {
    context.effects.push({ kind: EFFECT_KIND.eraWarning, tick: world.tick, era });
  }
}

/** After step 2 of a playing tick: every crossed move in era order, each with its `era_moved`, then the next warning. */
export function runEraMoves(world: WorldState, context: StepContext): void {
  for (const era of erasToMoveInto(world.eraMovedInto, roundEraAt(world, world.tick))) {
    world.eraMovedInto = era; // first, so the move builds the new era in its own zones (`worldZoneMap`)
    ERA_MOVES[era](world, context);
    context.effects.push({ kind: EFFECT_KIND.eraMoved, tick: world.tick, era });
  }
  emitEraWarning(world, context);
}
