// The broadcasts around the pool's move (docs/architecture/wire-contract.md §4 "The move", docs/game-design/phases.md
// §14.4.2 step 9): the room closes a broadcast on the tick before any move, so every dish moment goes out in an ordinary
// delta, and the broadcast whose window holds the pool's move goes to every viewer as a `game_state`. Read from state
// alone: the clock, a `debug_set_era` jump and a balance patch all reach it through the world. Serialisation state
// only: the simulation, the state hash and a replay never read it.

import { GAME_ERA, ROUND_PHASE, isEraAfter, type GameEra } from '@evolution/shared';
import { roundEraAt } from '../simulation/round-clock.js';
import type { WorldState } from '../world/world-state.js';

/** The next step's tick, the one the era clock is asked about. */
const TICKS_TO_NEXT_STEP = 1;

export class MoveBroadcasts {
  /** The era the world had moved into at the previous broadcast. */
  private eraAtLastBroadcast: GameEra;
  private isMoveWindow = false;

  constructor(private readonly world: WorldState) {
    this.eraAtLastBroadcast = world.eraMovedInto;
  }

  /** The next step runs a move: the round is playing and its clock reads an era past the one the world moved into. */
  isMoveNext(): boolean {
    const { world } = this;
    if (world.roundPhase !== ROUND_PHASE.playing) return false;
    return isEraAfter(roundEraAt(world, world.tick + TICKS_TO_NEXT_STEP), world.eraMovedInto);
  }

  /** Called once per broadcast, as it is serialised: whether its window holds the move out of the dish. */
  noteBroadcast(): void {
    const era = this.world.eraMovedInto;
    this.isMoveWindow = this.eraAtLastBroadcast === GAME_ERA.dish && era !== GAME_ERA.dish;
    this.eraAtLastBroadcast = era;
  }

  /** The newest broadcast holds the pool's move: every viewer is sent it whole. */
  isMoveBroadcast(): boolean {
    return this.isMoveWindow;
  }
}
