// What `build()` refuses (docs/TESTING.md §8.1): anything stamped past the last advanced tick
// would never run, and a test that cannot fail is worse than no test; a script for a player who
// is not in the room at that tick would be fed to the module as if they were. Every message
// names the offender and the run length so the fix is the tick or an `.advance()`.

import { ScenarioSetupError } from './errors.js';
import { AT_END, type ExpectationTick } from './expectations.js';
import type { ScenarioDefinition } from './runner.js';
import { FIRST_STEP_TICK, type ScheduleWindow } from './schedule.js';
import type { ScenarioPlayer } from './session.js';

const SETUP_TICK = 0;

type Definition = ScenarioDefinition<unknown, unknown>;

function pastEnd(what: string, tick: number, definition: Definition): ScenarioSetupError {
  return new ScenarioSetupError(
    `${what} is stamped tick ${tick}, but "${definition.name}" ends at tick ${definition.totalTicks}: ` +
      'nothing past the last advanced tick can run (add .advance() or fix the tick)',
  );
}

function validatePlayers(definition: Definition): void {
  if (!definition.players.some((player) => player.joinTick === SETUP_TICK)) {
    throw new ScenarioSetupError(`scenario "${definition.name}" has no player present at tick 0`);
  }
  for (const player of definition.players) {
    if (player.joinTick > definition.totalTicks) {
      throw pastEnd(`player ${player.playerIndex} joining`, player.joinTick, definition);
    }
    if (player.leaveTick !== null && player.leaveTick > definition.totalTicks) {
      throw pastEnd(`player ${player.playerIndex} leaving`, player.leaveTick, definition);
    }
  }
}

function requirePlayer(definition: Definition, playerIndex: number): ScenarioPlayer {
  const player = definition.players[playerIndex];
  if (player === undefined) {
    throw new ScenarioSetupError(`player ${playerIndex} does not exist in "${definition.name}"`);
  }
  return player;
}

/** The window must start while the player is in the room and must not claim ticks after they leave. */
function validateScriptPresence(script: ScheduleWindow, player: ScenarioPlayer): void {
  const who = `player ${player.playerIndex}'s script`;
  if (script.fromTick < Math.max(FIRST_STEP_TICK, player.joinTick)) {
    throw new ScenarioSetupError(
      `${who} starts at tick ${script.fromTick}, before the player joins at tick ${player.joinTick}`,
    );
  }
  if (player.leaveTick === null) {
    return;
  }
  if (script.fromTick >= player.leaveTick) {
    throw new ScenarioSetupError(
      `${who} starts at tick ${script.fromTick}, but the player leaves at tick ${player.leaveTick}`,
    );
  }
  if (script.toTick !== null && script.toTick >= player.leaveTick) {
    throw new ScenarioSetupError(
      `${who} ends at tick ${script.toTick}, after the player leaves at tick ${player.leaveTick}`,
    );
  }
}

function validateScripts(definition: Definition): void {
  for (const script of definition.scripts) {
    const player = requirePlayer(definition, script.playerIndex);
    const who = `player ${player.playerIndex}'s script`;
    if (script.fromTick > definition.totalTicks) {
      throw pastEnd(`${who} starting`, script.fromTick, definition);
    }
    if (script.toTick !== null && script.toTick > definition.totalTicks) {
      throw pastEnd(`${who} ending`, script.toTick, definition);
    }
    validateScriptPresence(script, player);
  }
}

function validateObservations(definition: Definition): void {
  const observations: readonly { readonly tick: ExpectationTick; readonly label: string }[] = [
    ...definition.captures,
    ...definition.expectations,
  ];
  for (const observation of observations) {
    if (observation.tick !== AT_END && observation.tick > definition.totalTicks) {
      throw pastEnd(`"${observation.label}"`, observation.tick, definition);
    }
  }
}

function validateScheduledFixtures(definition: Definition): void {
  for (const scheduled of definition.scheduledFixtures) {
    if (scheduled.tick > definition.totalTicks) {
      throw pastEnd('a scheduled fixture', scheduled.tick, definition);
    }
  }
}

/** Throws `ScenarioSetupError` for the first thing in the definition that could never run as written. */
export function validateDefinition<Snapshot, Fixture>(definition: ScenarioDefinition<Snapshot, Fixture>): void {
  // The checks read ticks and indices only, so the script and fixture types do not matter here.
  const untyped = definition as Definition;
  validatePlayers(untyped);
  validateScripts(untyped);
  validateScheduledFixtures(untyped);
  validateObservations(untyped);
}
