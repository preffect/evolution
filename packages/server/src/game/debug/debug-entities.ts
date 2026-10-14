// What `debug_get_entities` lists (docs/architecture/debug-mcp.md §8): every cell, mote and fragment as its view at full
// precision, tagged with its entity kind, plus the copepod's pass while one is on (it has no cell), filtered by an
// entity kind or a pool creature's species and by an inclusive box.

import {
  ENTITY_KIND,
  POOL_CREATURE_SPECIES,
  copepodHeadAt,
  isPoolCreatureSpecies,
  type EntityKind,
  type PoolCreatureSpecies,
  type PoolCreatureView,
} from '@evolution/shared';
import { EXACT_SNAPSHOT_VALUES } from '../serialize/quantize.js';
import { toCellView, toDnaFragmentView, toFoodMoteView } from '../serialize/serialize.js';
import type { WorldState } from '../world/world-state.js';
import { DebugRequestError } from './debug-request-error.js';
import type { BoundingBox, EntityFilter } from './simulation-debug-handle.js';

/**
 * A view tagged with its entity kind (a mote's own `kind` is its food kind), what `debug_get_entities` lists. The
 * copepod's pass, which has no cell, is listed as `copepod` at its head while one is on (docs/architecture/debug-mcp.md
 * §8); a creature's cell is a `cell` carrying its `poolCreature`.
 */
export interface DebugEntity {
  readonly entityKind: EntityKind | typeof POOL_CREATURE_SPECIES.copepod;
  readonly x: number;
  readonly y: number;
  readonly poolCreature?: PoolCreatureView | null;
}

/** What `debug_get_entities` filters on: an entity kind, or a pool creature's species (its cells, or the pass). */
type EntityFilterKind = EntityKind | PoolCreatureSpecies;

const ENTITY_KINDS: readonly EntityKind[] = Object.values(ENTITY_KIND);
const FILTER_KINDS: readonly EntityFilterKind[] = [...ENTITY_KINDS, ...Object.values(POOL_CREATURE_SPECIES)];

function isInside(entity: DebugEntity, bbox: BoundingBox | undefined): boolean {
  if (bbox === undefined) {
    return true;
  }
  return entity.x >= bbox.minX && entity.x <= bbox.maxX && entity.y >= bbox.minY && entity.y <= bbox.maxY;
}

function requireFilterKind(kind: string | undefined): EntityFilterKind | undefined {
  if (kind === undefined) {
    return undefined;
  }
  if (!ENTITY_KINDS.includes(kind as EntityKind) && !isPoolCreatureSpecies(kind)) {
    throw new DebugRequestError(`"${kind}" is not an entity kind or a pool creature (${FILTER_KINDS.join(', ')})`);
  }
  return kind as EntityFilterKind;
}

/** Every entity for no filter; else those of the kind, or the creature's cells (or the copepod's pass) for a species. */
function matchesKind(entity: DebugEntity, kind: EntityFilterKind | undefined): boolean {
  return kind === undefined || entity.entityKind === kind || entity.poolCreature?.species === kind;
}

/** The copepod's pass as a listed entity: its lane view, placed at its head on `world.tick`. */
function copepodPassEntities(world: WorldState): DebugEntity[] {
  const lane = world.copepodLane;
  if (lane === null) return [];
  return [{ entityKind: POOL_CREATURE_SPECIES.copepod, ...lane, ...copepodHeadAt(lane, world.tick, world.balance) }];
}

/** The entities `filter` asks for, in world order: cells, motes, fragments, then the copepod's pass. */
export function listDebugEntities(world: WorldState, filter: EntityFilter): DebugEntity[] {
  const kind = requireFilterKind(filter.kind);
  const entities: DebugEntity[] = [
    ...world.cells.map((cell) => ({ entityKind: ENTITY_KIND.cell, ...toCellView(cell, EXACT_SNAPSHOT_VALUES) })),
    ...world.food.map((mote) => ({
      entityKind: ENTITY_KIND.foodMote,
      ...toFoodMoteView(mote, EXACT_SNAPSHOT_VALUES),
    })),
    ...world.dnaFragments.map((fragment) => ({
      entityKind: ENTITY_KIND.dnaFragment,
      ...toDnaFragmentView(fragment, EXACT_SNAPSHOT_VALUES),
    })),
    ...copepodPassEntities(world),
  ];
  return entities.filter((entity) => matchesKind(entity, kind) && isInside(entity, filter.bbox));
}
