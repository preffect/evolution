// The eras' snapshot members (docs/architecture/wire-contract.md §4 "The pool layout"): what every viewer is sent alike
// of the pool's own state, copied so a snapshot never aliases the world and written exact (§4 "Wire precision"), since
// the shared movement step predicts with them. The layout rides every snapshot from the pool's warning tick on, so the
// client bakes the pool's layer during the warning (docs/game-design/phases.md §14.4.6). A creature's view rides on its
// cell instead (`toPoolCreatureView`), its heading rounded as a drawing's.

import {
  GAME_ERA,
  SNAPSHOT_BEARING_DECIMALS,
  eraWarningStartedAtTick,
  type GameSnapshot,
  type PoolCreatureView,
  type PoolLayoutView,
} from '@evolution/shared';
import type { WorldState } from '../world/world-state.js';
import { snapshotValue, type SnapshotPrecision } from './quantize.js';

/** The snapshot members `serializeEraMembers` builds. */
export type EraSnapshotMembers = Pick<GameSnapshot, 'poolLayout' | 'surge' | 'copepodLane'>;

/**
 * True from the pool's warning tick on (`ERA_MOVE_WARNING_SECONDS` before its start, from `roundStartTick`): after a
 * `debug_set_era` jump to the pool or past it that tick lies behind the move, so the move's snapshot carries the layout.
 */
export function isPoolLayoutOnTheWire(world: WorldState): boolean {
  return world.tick >= eraWarningStartedAtTick(GAME_ERA.pool, world.roundStartTick, world.balance);
}

function copyPoolLayout(layout: PoolLayoutView): PoolLayoutView {
  return {
    films: layout.films.map((film) => ({ ...film })),
    threads: layout.threads.map((thread) => ({ ...thread })),
    lightPatchOrbit: { ...layout.lightPatchOrbit },
  };
}

/** The layout once it is on the wire, and the surge and the copepod's pass while the world has them; null otherwise. */
export function serializeEraMembers(world: WorldState): EraSnapshotMembers {
  return {
    poolLayout: world.poolLayout !== null && isPoolLayoutOnTheWire(world) ? copyPoolLayout(world.poolLayout) : null,
    surge: world.surge === null ? null : { ...world.surge },
    copepodLane: world.copepodLane === null ? null : { ...world.copepodLane },
  };
}

/** A creature's view as its cell carries it: a copy, its heading at `SNAPSHOT_BEARING_DECIMALS` on the wire. */
export function toPoolCreatureView(creature: PoolCreatureView, precision: SnapshotPrecision): PoolCreatureView {
  return { ...creature, headingRadians: snapshotValue(creature.headingRadians, SNAPSHOT_BEARING_DECIMALS, precision) };
}
