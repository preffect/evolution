// docs/game-design/phases.md §14.15 PH17 (§14.4.2 step 9): the move's wire and cameras, on the real room over the
// Evolution module with every era in play (seed 42) and one connected player placed as PH1 places it. The pool's layout
// reaches the client on the warning tick; the room closes a broadcast on the tick before the move, so every dish
// moment goes out in a delta; the move's broadcast arrives as a full `game_state` carrying its `era_moved`; the
// server's viewer camera is the remap of its tick-35 999 state and so is every state of its history, so the arriving
// cell lies inside the culled area; and the shared movement step fed the `game_state`'s own cell reproduces the
// server's pose on the next tick (the client snaps to it, net/world-store.spec.ts). Run with `./validate.sh integration`.
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  GAME_ERA,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_POSITION_DECIMALS,
  TICK_INTERVAL_S,
  ZONE_ID,
  createTestPoolLayout,
  createTestSessionConfig,
  distanceBetween,
  foldModifiers,
  interestMarginFor,
  movementStepFor,
  remapCameraAcrossMove,
  stepCamera,
  stepMovementKernel,
  zoneAt,
  type CameraState,
  type CellView,
  type GameSnapshot,
  type ServerMessage,
} from '@evolution/shared';
import { GameRoom } from './game-room.js';
import { interestAreaOf, isInInterestArea } from '../game/serialize/interest-area.js';
import { findCellOfPlayer } from '../game/world/lookups.js';
import {
  createManualRoomTiming,
  createTestConnection,
  createTestRoomInitOptions,
  type SentLog,
} from '../testing/builders.js';
import { ERA_PLAYER, ERA_TABLE_SEED, startEraRoom } from '../testing/era-room.js';
import { COLONIES_ON_ROUND_SECONDS } from '../testing/world-builders.js';

const { eras } = DEFAULT_BALANCE;
/** The module steps alone up to here, a whole number of broadcasts before the warning, so the room's cadence lands on its ticks. */
const ROOM_START_TICK = 35_388;
const WARNING_TICK = 35_400;
const MOVE_TICK = 36_000;
/** PH1's placement, on tick 35 999. */
const PH1 = { position: { x: 1200, y: -600 }, mass: 500, level: 5 };
/** One wire position step: what the quantised snapshot and the server's pose may differ by. */
const WIRE_POSITION_STEP_WU = 10 ** -SNAPSHOT_POSITION_DECIMALS;

function snapshotsOf(sent: SentLog): { type: string; snapshot: GameSnapshot }[] {
  return (sent[ERA_PLAYER] as ServerMessage[]).flatMap((message) =>
    message.type === SERVER_MESSAGE_TYPE.gameState || message.type === SERVER_MESSAGE_TYPE.gameSnapshot
      ? [{ type: message.type, snapshot: message.snapshot }]
      : [],
  );
}

function ownCellIn(snapshot: GameSnapshot): CellView {
  const cell = snapshot.cells.find((each) => each.playerId === ERA_PLAYER);
  if (cell === undefined) throw new Error(`no own cell in the snapshot of tick ${snapshot.tick}`);
  return cell;
}

/** What the client's own-cell prediction replays for one idle tick from `snapshot` (net/own-cell-prediction.ts). */
function predictOneIdleTick(snapshot: GameSnapshot) {
  const cell = ownCellIn(snapshot);
  const balance = DEFAULT_BALANCE;
  const pose = { x: cell.x, y: cell.y, velocityX: cell.velocityX, velocityY: cell.velocityY };
  const movement = {
    mass: cell.mass,
    radiusWu: cell.radius,
    sprintRemainingTicks: cell.sprintRemainingTicks,
    modifiers: foldModifiers(cell.traits, balance.traits.TRAIT_TIERS),
    isInGel: zoneAt(pose, snapshot.gelPatches, balance) === ZONE_ID.viscousGel,
    engulfFactor: 1,
  };
  return stepMovementKernel(pose, movementStepFor(movement, pose, balance));
}

/** PH1 with a connected client: the module run alone to just before the warning, then the room around it. */
async function connectedPh1Room() {
  const eraRoom = startEraRoom({ roundDurationSeconds: COLONIES_ON_ROUND_SECONDS });
  // The layout drawn at the round's start, as ticket #870 draws it: what rides the wire from the warning on.
  eraRoom.world.poolLayout = createTestPoolLayout();
  await eraRoom.stepTo(ROOM_START_TICK);
  const config = createTestSessionConfig({ seed: ERA_TABLE_SEED, roundDurationSeconds: COLONIES_ON_ROUND_SECONDS });
  const room = new GameRoom(
    eraRoom.module,
    createTestRoomInitOptions([ERA_PLAYER], { config }),
    createManualRoomTiming(),
  );
  const sent: SentLog = {};
  room.addPlayer(createTestConnection({ playerId: ERA_PLAYER, sent }));
  return { eraRoom, room, sent, stepTo: (tick: number) => room.step(tick - eraRoom.world.tick) };
}

describe('phases.md §14.15 PH17: the move’s wire and cameras, with a connected client', () => {
  it('sends the layout at the warning, closes the dish’s last broadcast, then the move as a game_state the cameras follow', async () => {
    const { eraRoom, sent, stepTo } = await connectedPh1Room();
    const { module, world, handle } = eraRoom;
    stepTo(WARNING_TICK);
    const atWarning = snapshotsOf(sent);
    expect(atWarning.at(-1)?.snapshot).toMatchObject({ tick: WARNING_TICK, poolLayout: createTestPoolLayout() });
    expect(atWarning.at(-2)?.snapshot).toMatchObject({ tick: WARNING_TICK - 3, poolLayout: null });

    // Placed for tick 35 999, then two ticks in one burst: the room's own loop closes the dish's last broadcast.
    stepTo(MOVE_TICK - 2);
    handle.setPlayer(ERA_PLAYER, { ...PH1, traits: ['nucleoid', 'mitochondrion', 'nuclear_envelope'] });
    const sentBeforeMove = snapshotsOf(sent).length;
    const historiesAtServe: (readonly CameraState[])[] = [];
    const serialize = module.viewerState.serialize.bind(module.viewerState);
    vi.spyOn(module.viewerState, 'serialize').mockImplementation((viewer, broadcast) => {
      historiesAtServe.push(module.viewerState.cameraHistoryOf(viewer));
      return serialize(viewer, broadcast);
    });
    stepTo(MOVE_TICK);

    // The dish's last delta closes on 35 999; the move's broadcast is a game_state whose window starts on the move.
    const [closing, move] = snapshotsOf(sent).slice(sentBeforeMove);
    expect(closing).toMatchObject({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { tick: MOVE_TICK - 1 } });
    expect(closing!.snapshot.era).toBe(GAME_ERA.dish);
    expect(move).toMatchObject({
      type: SERVER_MESSAGE_TYPE.gameState,
      snapshot: { tick: MOVE_TICK, era: GAME_ERA.pool },
    });
    expect(move!.snapshot.effects.every((effect) => effect.tick === MOVE_TICK)).toBe(true);
    expect(move!.snapshot.effects).toContainEqual({ kind: EFFECT_KIND.eraMoved, tick: MOVE_TICK, era: GAME_ERA.pool });
    expect(move!.snapshot.ownProgress?.playerId).toBe(ERA_PLAYER);

    // Every state of the history is the remap of its dish state; the newest steps on from the remapped 35 999 one.
    const dishHistory = historiesAtServe.at(-1)!;
    const remapped = dishHistory.map((state) => remapCameraAcrossMove(state, eras.ERA_SCALE_STEP));
    const cell = findCellOfPlayer(world, ERA_PLAYER)!;
    const newest = stepCamera(remapped.at(-1)!, cell, TICK_INTERVAL_S, eras.ERA_MOVE_CAMERA_ZOOM_SECONDS);
    const history = module.viewerState.cameraHistoryOf(ERA_PLAYER);
    expect(history).toEqual([...remapped, newest].slice(-history.length));
    const area = interestAreaOf(history as [CameraState, ...CameraState[]], interestMarginFor(world.balance));
    expect(isInInterestArea(area, cell.x, cell.y)).toBe(true);

    // The client predicts from the game_state: one idle tick of the shared movement step is the server's 36 001.
    stepTo(MOVE_TICK + 1);
    const next = snapshotsOf(sent).at(-1)!;
    expect(next).toMatchObject({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { tick: MOVE_TICK + 1 } });
    const predicted = predictOneIdleTick(move!.snapshot);
    expect(distanceBetween(predicted, ownCellIn(next.snapshot))).toBeLessThanOrEqual(WIRE_POSITION_STEP_WU);
  });
});
