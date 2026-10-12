// docs/ecology/giants.md §3.5.5–§3.5.7: a giant seat decides by its species' profile. Each role takes only its own
// rules (the hunter never grazes, the grazer and the drifter never hunt), the hunter's window gates the chase, a giant
// hunts a player from tick 0, a giant being engulfed escapes and sprints, and its draws come from the `giants` stream
// alone. The giant seats count down and decide in the same pass as the wild seats (`decideSeatTargets`).
import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  DEFAULT_BALANCE,
  FOOD_KIND,
  GIANT_SPECIES,
  RANDOM_STREAM,
  SERVER_RANDOM_STREAM_LABELS,
  secondsToTicks,
  type GiantSpecies,
} from '@evolution/shared';
import { targetOf } from '../../testing/wild-arena.js';
import { seatTestGiantCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { beginEngulf } from '../simulation/engulf-state.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import type { StepContext } from '../world/world-state.js';
import { decideSeatTargets } from './wild-strategy.js';
import { pointAlongHeading } from './wild-wander.js';

const { controls, giants, wildCells } = DEFAULT_BALANCE;
const BORN_MASS = 1200;
const GIANT_AT = { x: 1000, y: 0 };
/** A player inside the amoeba's window (≥ 300 at 1 200) and in sight, 400 wu east; a lighter one under it. */
const IN_WINDOW_MASS = 400;
const UNDER_WINDOW_MASS = 250;
const PREY_EAST_WU = 400;
/** The heaviest grazer target 300 wu east: inside every giant's sight. */
const MOTE_EAST_WU = 300;
/** A threat that can swallow a 1 200 diatom (1.40 × 1 200 = 1 680), 600 wu east. */
const THREAT_MASS = 1900;
/** The threat's centre this far east of the diatom's: over it, so an engulf can start. */
const COVERING_EAST_WU = 10;

/** The species' giant at `GIANT_AT` due to decide on the next call, the player cell `preyMass` `eastWu` east of it. */
function giantWithPlayer(species: GiantSpecies, preyMass: number, eastWu = PREY_EAST_WU) {
  const world = createTestWorld();
  const player = world.cells[0]!;
  const giant = seatTestGiantCell(world, { species, at: GIANT_AT, bornMass: BORN_MASS });
  giant.seat.decideInTicks = 1;
  world.tick = 1;
  setCellMass(player, preyMass, world.balance);
  player.x = GIANT_AT.x + eastWu;
  player.y = GIANT_AT.y;
  return { world, context: createTestStepContext(world), player, ...giant };
}

function streamPositions(context: StepContext): Record<string, number> {
  return Object.fromEntries(
    SERVER_RANDOM_STREAM_LABELS.map((label) => [label, context.streams[label].getState().position]),
  );
}

describe('decideSeatTargets: the giant hunter (docs/ecology/giants.md §3.5.6)', () => {
  it('hunts a player in its window at protocell, the stage no wild seat hunts players at', () => {
    const { world, context, player, seat, cell } = giantWithPlayer(GIANT_SPECIES.amoeba, IN_WINDOW_MASS);
    decideSeatTargets(world, context);
    expect(seat.huntPreyId).toBe(player.id);
    expect(targetOf(cell)).toEqual({ x: player.x, y: player.y });
  });

  it('wanders past a player under its window, and never grazes the mote beside it', () => {
    const { world, context, seat, cell } = giantWithPlayer(GIANT_SPECIES.amoeba, UNDER_WINDOW_MASS);
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: GIANT_AT.x, y: MOTE_EAST_WU } });
    decideSeatTargets(world, context);
    expect(seat.huntPreyId).toBeNull();
    expect(targetOf(cell)).toEqual(pointAlongHeading(seat, cell, DEFAULT_BALANCE));
  });

  it('gives up a hunt after GIANT_HUNT_GIVE_UP_SECONDS, not the wild 5 s', () => {
    const { world, context, player, seat } = giantWithPlayer(GIANT_SPECIES.amoeba, IN_WINDOW_MASS);
    decideSeatTargets(world, context);
    const huntStartTick = world.tick;
    world.tick = huntStartTick + secondsToTicks(wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS);
    seat.decideInTicks = 1;
    decideSeatTargets(world, context);
    expect(seat.huntPreyId).toBe(player.id);
    world.tick = huntStartTick + secondsToTicks(giants.GIANT_HUNT_GIVE_UP_SECONDS);
    seat.decideInTicks = 1;
    decideSeatTargets(world, context);
    expect(seat.givenUpPreyId).toBe(player.id);
  });
});

describe('decideSeatTargets: the grazer and the drifter never hunt', () => {
  for (const species of [GIANT_SPECIES.paramecium, GIANT_SPECIES.diatom]) {
    it(`${species} leaves a player it could not swallow anyway alone, and wanders`, () => {
      const { world, context, seat, cell } = giantWithPlayer(species, IN_WINDOW_MASS);
      decideSeatTargets(world, context);
      expect(seat.huntPreyId).toBeNull();
      expect(targetOf(cell)).toEqual(pointAlongHeading(seat, cell, DEFAULT_BALANCE));
    });
  }

  it('the grazer grazes a bacterium; the drifter does not', () => {
    const grazer = giantWithPlayer(GIANT_SPECIES.paramecium, IN_WINDOW_MASS, -PREY_EAST_WU * 2);
    const moteAt = { x: GIANT_AT.x + MOTE_EAST_WU, y: GIANT_AT.y };
    spawnFoodMote(grazer.world, { kind: FOOD_KIND.bacterium, variant: BACTERIUM_VARIANT.plain, at: moteAt });
    decideSeatTargets(grazer.world, grazer.context);
    expect(targetOf(grazer.cell)).toEqual(moteAt);
    const drifter = giantWithPlayer(GIANT_SPECIES.diatom, IN_WINDOW_MASS, -PREY_EAST_WU * 2);
    spawnFoodMote(drifter.world, { kind: FOOD_KIND.algae, variant: null, at: moteAt });
    decideSeatTargets(drifter.world, drifter.context);
    expect(targetOf(drifter.cell)).toEqual(pointAlongHeading(drifter.seat, drifter.cell, DEFAULT_BALANCE));
  });
});

describe('decideSeatTargets: a giant flees and escapes', () => {
  it('the drifter flees a cell that can swallow it, 2 radii away from it', () => {
    const { world, context, cell } = giantWithPlayer(GIANT_SPECIES.diatom, THREAT_MASS);
    decideSeatTargets(world, context);
    expect(targetOf(cell)).toEqual({ x: GIANT_AT.x - controls.STEER_FULL_THROTTLE_RADII * cell.radius, y: 0 });
  });

  it('a giant being engulfed runs from its predator and sprints', () => {
    const { world, context, player, cell } = giantWithPlayer(GIANT_SPECIES.diatom, THREAT_MASS, COVERING_EAST_WU);
    beginEngulf({ predator: player, prey: cell });
    decideSeatTargets(world, context);
    expect(cell.sprintRemainingTicks).toBeGreaterThan(0);
    expect(cell.targetX).toBeLessThan(GIANT_AT.x);
  });
});

describe('decideSeatTargets: a giant draws from the giants stream alone', () => {
  it("a giant's wander draws its turn roll from giants, and no other stream moves", () => {
    const { world, context } = giantWithPlayer(GIANT_SPECIES.paramecium, IN_WINDOW_MASS);
    const before = streamPositions(context);
    decideSeatTargets(world, context);
    const after = streamPositions(context);
    expect(after[RANDOM_STREAM.giants]).toBeGreaterThan(before[RANDOM_STREAM.giants]!);
    expect({ ...after, [RANDOM_STREAM.giants]: before[RANDOM_STREAM.giants] }).toEqual(before);
  });
});
