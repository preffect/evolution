// A model of the clients (#406, architect review of PR #627): `EvolutionViewerState` driven through a seeded random run
// of joins, leaves (a freed slot then reused by another player), resyncs (`serializeFull`), paused re-broadcasts of
// one tick, motes stepping, leaving and returning to an area, despawning and spawning, and viewers missing broadcasts.
// After every `serialize`: the member JSON equals `JSON.stringify`, no mote the client holds is spawned again, and a
// client store that applies the deltas as `food-store.ts` does holds exactly the motes in that viewer's area.
import { describe, expect, it } from 'vitest';
import { FOOD_KIND, SNAPSHOT_EVERY_TICKS, playerId, type FoodDelta, type PlayerId } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import type { WorldState } from '../world/world-state.js';
import { serializeBroadcastSnapshot, toMotePositionView } from './serialize.js';
import { EvolutionViewerState } from './viewer-state.js';

const MODEL_PLAYERS = ['a', 'b', 'c', 'd'].map((name, index) => ({
  playerId: playerId(`model-${name}`),
  playerName: name,
  avatarIndex: index,
}));
const MODEL_SEED = 12345;
const MODEL_ROUNDS = 400;
const MODEL_MOTES = 40;
const MIN_CHECKS = 300;
/** Where the near motes live: inside the near viewers' areas. */
const NEAR_SPAN_WU = 100;
/** Where the far viewers sit and where a leaving mote goes: past the near viewers' areas, inside the far ones'. */
const OUTSIDE_X = 2800;
/** The line between the two areas the truth is drawn at. */
const AREA_DIVIDE_X = 1000;
const MAX_STEP_WU = 3;
/** Cumulative thresholds of one draw: the membership event, a mote's motion. Separate draws for the rest. */
const CHANCE = {
  forget: 0.05,
  join: 0.1,
  resync: 0.13,
  step: 0.3,
  leaveArea: 0.35,
  returnToArea: 0.4,
  removeSome: 0.1,
  removeEach: 0.1,
  spawn: 0.2,
  pausedRebroadcast: 0.1,
  missBroadcast: 0.1,
} as const;
const LCG_MULTIPLIER = 1103515245;
const LCG_INCREMENT = 12345;
const LCG_MODULUS = 2 ** 31;

type ClientStore = Map<string, { x: number; y: number }>;

/** A seeded LCG in [0, 1): the model's own stream, apart from the world's. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
}

/** What `food-store.ts` does with a delta: upsert spawned, delete removed, patch moved when known. */
function applyDelta(store: ClientStore, delta: FoodDelta): void {
  for (const mote of delta.spawned) store.set(mote.id, { x: mote.x, y: mote.y });
  for (const id of delta.removedIds) store.delete(id);
  for (const position of delta.moved) {
    if (store.has(position.id)) store.set(position.id, { x: position.x, y: position.y });
  }
}

const sorted = (store: ClientStore): ClientStore => new Map([...store].sort());

/** The world, the viewer state and the clients' stores the run drives. */
class ClientModel {
  readonly world: WorldState = createTestWorld({ players: MODEL_PLAYERS });
  readonly viewerState = new EvolutionViewerState(this.world);
  /** Alternate viewers sit near and far, so a slot two viewers shared would show: they see different motes. */
  readonly farViewers = new Set(
    MODEL_PLAYERS.filter((_player, index) => index % 2 === 1).map((player) => player.playerId),
  );
  readonly stores = new Map<PlayerId, ClientStore>();
  readonly active = new Set<PlayerId>([MODEL_PLAYERS[0]!.playerId, MODEL_PLAYERS[1]!.playerId]);

  constructor(private readonly random: () => number) {
    for (const cell of this.world.cells) {
      cell.x = this.farViewers.has(cell.playerId!) ? OUTSIDE_X : 0;
      cell.y = 0;
    }
    for (let index = 0; index < MODEL_MOTES; index += 1) this.spawnNear();
  }

  /** One draw: a viewer leaves (freeing its slot), a free player joins, or the last viewer resyncs. */
  membershipEvent(): void {
    const event = this.random();
    if (event < CHANCE.forget && this.active.size > 1) this.leave([...this.active][0]!);
    else if (event < CHANCE.join) this.join();
    else if (event < CHANCE.resync) this.resync([...this.active][this.active.size - 1]!);
  }

  /** Motes step, leave the near area, come back; some despawn, one may spawn. */
  moveWorld(): void {
    for (const mote of this.world.food) {
      const motion = this.random();
      if (motion < CHANCE.step) mote.x += this.random() * MAX_STEP_WU;
      else if (motion < CHANCE.leaveArea) mote.x = OUTSIDE_X;
      else if (motion < CHANCE.returnToArea) mote.x = this.random() * NEAR_SPAN_WU;
    }
    if (this.random() < CHANCE.removeSome) {
      this.world.food = this.world.food.filter(() => this.random() > CHANCE.removeEach);
    }
    if (this.random() < CHANCE.spawn) this.spawnNear();
  }

  /** The viewers served this broadcast (some miss it), after the tick moves on unless the room is paused. */
  broadcastTo(): { snapshot: ReturnType<typeof serializeBroadcastSnapshot>; viewers: PlayerId[] } {
    if (this.random() >= CHANCE.pausedRebroadcast) this.world.tick += SNAPSHOT_EVERY_TICKS;
    const snapshot = serializeBroadcastSnapshot(this.world);
    return { snapshot, viewers: [...this.active].filter(() => this.random() >= CHANCE.missBroadcast) };
  }

  storeOf(viewer: PlayerId): ClientStore {
    const store = this.stores.get(viewer) ?? new Map();
    this.stores.set(viewer, store);
    return store;
  }

  /** The motes in a viewer's area: the near side of the dish or the far one, by where its cell sits. */
  truthFor(viewer: PlayerId): ClientStore {
    const isFar = this.farViewers.has(viewer);
    const inArea = this.world.food.filter((mote) => mote.x < AREA_DIVIDE_X !== isFar);
    return new Map(inArea.map((mote) => [mote.id as string, toMotePositionView(mote)] as const));
  }

  private spawnNear(): void {
    const spawnAt = { x: this.random() * NEAR_SPAN_WU, y: this.random() * NEAR_SPAN_WU };
    spawnFoodMote(this.world, { kind: FOOD_KIND.algae, variant: null, at: spawnAt });
  }

  private leave(viewer: PlayerId): void {
    this.viewerState.forget(viewer);
    this.active.delete(viewer);
    this.stores.delete(viewer);
  }

  private join(): void {
    const joining = MODEL_PLAYERS.find((player) => !this.active.has(player.playerId));
    if (joining === undefined) return;
    this.active.add(joining.playerId);
    this.resync(joining.playerId);
  }

  private resync(viewer: PlayerId): void {
    const store: ClientStore = new Map();
    applyDelta(store, this.viewerState.serializeFull(viewer).food);
    this.stores.set(viewer, store);
  }
}

const positionsOf = (store: ClientStore): ClientStore =>
  new Map([...store].map(([id, position]) => [id, { x: position.x, y: position.y }] as const));

describe('EvolutionViewerState against a model of its clients (#406)', () => {
  it('keeps every client equal to its area, never re-spawns what it holds, and writes JSON equal to JSON.stringify', () => {
    const model = new ClientModel(seededRandom(MODEL_SEED));
    let checks = 0;
    for (let round = 0; round < MODEL_ROUNDS; round += 1) {
      model.membershipEvent();
      model.moveWorld();
      const { snapshot, viewers } = model.broadcastTo();
      for (const viewer of viewers) {
        const members = model.viewerState.serialize(viewer, snapshot);
        for (const key of model.viewerState.keys) {
          expect(model.viewerState.memberJson(key, members[key]), `round ${round} ${key}`).toBe(
            JSON.stringify(members[key]),
          );
        }
        const store = model.storeOf(viewer);
        const resent = members.food.spawned.filter((mote) => store.has(mote.id)).map((mote) => mote.id);
        expect(resent, `round ${round} ${viewer}: spawned again while the client holds it`).toEqual([]);
        applyDelta(store, members.food);
        expect(sorted(store), `round ${round} ${viewer}`).toEqual(sorted(positionsOf(model.truthFor(viewer))));
        checks += 1;
      }
    }
    expect(checks).toBeGreaterThan(MIN_CHECKS);
  });
});
