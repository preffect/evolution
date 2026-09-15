import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DISH_CENTRE_TARGET,
  INTEREST_CAMERA_HISTORY_BROADCASTS,
  SNAPSHOT_EVERY_TICKS,
  TICK_INTERVAL_S,
  interestMarginFor,
  parkCamera,
  playerId,
  stepCamera,
} from '@evolution/shared';
import { TEST_PLAYER, createTestWorld } from '../../testing/world-builders.js';
import { interestAreaOf, viewAreaOf } from './interest-area.js';
import { ViewerCameras, followTargetOf } from './viewer-cameras.js';

const OTHER_PLAYER = { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 };
const PAN_WU = 2000;
const MARGIN_WU = interestMarginFor(DEFAULT_BALANCE);

function twoPlayerWorld() {
  const world = createTestWorld({ players: [TEST_PLAYER, OTHER_PLAYER] });
  const own = world.cells.find((cell) => cell.playerId === TEST_PLAYER.playerId)!;
  const other = world.cells.find((cell) => cell.playerId === OTHER_PLAYER.playerId)!;
  return { world, own, other };
}

describe('followTargetOf', () => {
  it('follows the own cell, then the killer’s while spectating, then nothing', () => {
    const { world, own, other } = twoPlayerWorld();
    expect(followTargetOf(world, TEST_PLAYER.playerId)).toEqual({ x: own.x, y: own.y, radius: own.radius });
    world.cells = world.cells.filter((cell) => cell !== own);
    world.players[0]!.spectatingCellId = other.id;
    expect(followTargetOf(world, TEST_PLAYER.playerId)).toEqual({ x: other.x, y: other.y, radius: other.radius });
    world.players[0]!.spectatingCellId = null;
    expect(followTargetOf(world, TEST_PLAYER.playerId)).toBeNull();
  });
});

describe('ViewerCameras', () => {
  it('parks a camera on the own cell the first time it is seen', () => {
    const { world, own } = twoPlayerWorld();
    const cameras = new ViewerCameras();
    const parked = parkCamera(own);
    expect(cameras.areaOf(world, TEST_PLAYER.playerId, MARGIN_WU)).toEqual(interestAreaOf([parked], MARGIN_WU));
    cameras.step(world);
    expect(cameras.cameraOf(TEST_PLAYER.playerId)).toEqual(parked);
    expect(cameras.cameraOf(OTHER_PLAYER.playerId)).toEqual(parkCamera(world.cells[1]!));
  });

  it('steps toward the moved cell over the ticks since the last step, still covering where it was', () => {
    const { world, own } = twoPlayerWorld();
    const cameras = new ViewerCameras();
    cameras.step(world);
    const parked = cameras.cameraOf(TEST_PLAYER.playerId)!;
    own.x += PAN_WU;
    world.tick += SNAPSHOT_EVERY_TICKS;
    cameras.step(world);
    const expected = stepCamera(parked, own, SNAPSHOT_EVERY_TICKS * TICK_INTERVAL_S);
    expect(cameras.cameraOf(TEST_PLAYER.playerId)).toEqual(expected);
    const area = cameras.areaOf(world, TEST_PLAYER.playerId, MARGIN_WU);
    expect(area).toEqual(interestAreaOf([parked, expected], MARGIN_WU));
  });

  it('forgets states older than the history', () => {
    const { world, own } = twoPlayerWorld();
    const cameras = new ViewerCameras();
    cameras.step(world);
    const parked = cameras.cameraOf(TEST_PLAYER.playerId)!;
    for (let broadcast = 0; broadcast < INTEREST_CAMERA_HISTORY_BROADCASTS; broadcast += 1) {
      own.x += PAN_WU / INTEREST_CAMERA_HISTORY_BROADCASTS;
      world.tick += SNAPSHOT_EVERY_TICKS;
      cameras.step(world);
    }
    const area = cameras.areaOf(world, TEST_PLAYER.playerId, MARGIN_WU);
    expect(area.minX).toBeGreaterThan(viewAreaOf(parked, MARGIN_WU).minX);
  });

  it('holds a camera with nothing to follow, and parks a viewer with no player at the dish centre', () => {
    const { world, own } = twoPlayerWorld();
    const cameras = new ViewerCameras();
    cameras.step(world);
    const parked = cameras.cameraOf(TEST_PLAYER.playerId)!;
    world.cells = world.cells.filter((cell) => cell !== own);
    world.tick += SNAPSHOT_EVERY_TICKS;
    cameras.step(world);
    expect(cameras.cameraOf(TEST_PLAYER.playerId)).toEqual(parked);
    expect(cameras.areaOf(world, playerId('nobody'), MARGIN_WU)).toEqual(
      interestAreaOf([parkCamera(DISH_CENTRE_TARGET)], MARGIN_WU),
    );
  });

  it('drops a forgotten camera, which parks afresh', () => {
    const { world } = twoPlayerWorld();
    const cameras = new ViewerCameras();
    cameras.step(world);
    cameras.forget(TEST_PLAYER.playerId);
    expect(cameras.cameraOf(TEST_PLAYER.playerId)).toBeUndefined();
  });
});
