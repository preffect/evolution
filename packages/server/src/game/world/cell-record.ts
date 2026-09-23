// The one literal every cell is born from (docs/architecture/entity-model.md §2): free, at rest, its target at its
// own centre (throttle 0), nothing engulfed, nothing derived yet. A player cell and a wild cell differ
// only in the identity they pass; the caller folds the derived state and appends the record.

import { DEFAULT_CELL_MODIFIERS, NO_STEER_COMMAND, STARTING_STAGE, type Vec2 } from '@evolution/shared';
import type { CellRecord } from './entities.js';

/** Who the cell is: everything on the record that the kind of cell decides. */
export type CellIdentity = Pick<CellRecord, 'id' | 'kind' | 'playerId' | 'organismId' | 'avatarIndex' | 'level'>;

/** A free cell at `centre` with `mass`; the radius, modifiers, traits and stage are folded by the caller. */
export function bornCellRecord(identity: CellIdentity, centre: Vec2, mass: number): CellRecord {
  return {
    ...identity,
    x: centre.x,
    y: centre.y,
    velocityX: 0,
    velocityY: 0,
    mass,
    radius: 0,
    stage: STARTING_STAGE,
    traits: [],
    membraneRatioBonus: 0,
    states: [],
    engulfProgress: 0,
    engulfingCellId: null,
    engulfedByCellId: null,
    sprintRemainingTicks: 0,
    sprintCooldownRemainingTicks: 0,
    starving: false,
    targetX: null,
    targetY: null,
    modifiers: { ...DEFAULT_CELL_MODIFIERS },
    pinnedX: null,
    pinnedY: null,
    carriedOffsetX: null,
    carriedOffsetY: null,
    spitOutRefractories: [],
    steerCommand: NO_STEER_COMMAND,
    lastRelease: null,
  };
}
