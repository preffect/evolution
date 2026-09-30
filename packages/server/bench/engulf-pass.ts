// The engulf pass measurement of ticket #772: a predator cruising at full speed passes over a prey it can just eat,
// the way a player does (the mouse past the prey, or on it), and the bench counts how many started engulfs finish and
// how many drop because contact broke. Two cells alone in the broth, no gel, no food; the whole tick runs.
//
//   DRAG=<share> pnpm --filter @evolution/server bench:engulf-pass      (DRAG patches ENGULF_DRAG_SHARE first; unset: the default)

import { DEFAULT_BALANCE, EFFECT_KIND, ENGULF_RELEASE_REASON, playerId, secondsToTicks } from '@evolution/shared';
import { setBalanceForDebug } from '../src/game/debug/debug-operations.js';
import { setCellMass } from '../src/game/simulation/cell-mass.js';
import { stepWorld } from '../src/game/simulation/step.js';
import type { CellRecord } from '../src/game/world/entities.js';
import { BROTH_POINT } from '../src/testing/gameplay/placement.js';
import { createTestStepContext, createTestWorld } from '../src/testing/world-builders.js';

const PAIRS: ReadonlyArray<readonly [number, number]> = [
  [26, 20],
  [40, 30],
  [60, 45],
  [60, 30],
  [400, 300],
  [400, 150],
];
/** Where the pass line crosses the prey, as a share of the predator's contact reach off the prey's centre. */
const OFFSETS = [0, 0.25, 0.5, 0.75];
/** How far outside contact the predator starts, in its own radii, already at full speed. */
const START_RADII = [1, 2, 3];
const TRIAL_SECONDS = 4;
const FAR_WU = 1000;
const PREY_STYLES = ['still', 'flee', 'flee+sprint'] as const;
const AIMS = ['through', 'track'] as const;
type PreyStyle = (typeof PREY_STYLES)[number];
type Aim = (typeof AIMS)[number];

interface Outcome {
  starts: number;
  finished: number;
  escaped: number;
  firstStartFinished: number;
  trials: number;
}

function trial(predatorMass: number, preyMass: number, offset: number, startRadii: number, aim: Aim, style: PreyStyle) {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  world.gelPatches = [];
  if (process.env.DRAG !== undefined) {
    setBalanceForDebug(world, { absorption: { ENGULF_DRAG_SHARE: Number(process.env.DRAG) } });
  }
  const balance = world.balance;
  const context = createTestStepContext(world);
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  setCellMass(predator, predatorMass, balance);
  setCellMass(prey, preyMass, balance);
  const reach = predator.radius - prey.radius * balance.absorption.ENGULF_COVERAGE_FRACTION;
  prey.x = BROTH_POINT.x;
  prey.y = BROTH_POINT.y;
  prey.targetX = null;
  prey.targetY = null;
  predator.x = prey.x + offset * reach;
  predator.y = prey.y - reach - startRadii * predator.radius;
  predator.velocityX = 0;
  predator.velocityY = balance.growth.CELL_BASE_SPEED;
  const outcome = { starts: 0, finished: 0, escaped: 0, firstStartFinished: 0 };
  let wasHeld = false;
  for (let tick = 0; tick < secondsToTicks(TRIAL_SECONDS); tick += 1) {
    if (aim === 'through') {
      predator.targetX = predator.x;
      predator.targetY = predator.y + FAR_WU;
    } else {
      predator.targetX = prey.x;
      predator.targetY = prey.y;
    }
    if (prey.engulfedByCellId !== null && style !== 'still') {
      const distance = Math.hypot(prey.x - predator.x, prey.y - predator.y) || 1;
      prey.targetX = prey.x + ((prey.x - predator.x) / distance) * FAR_WU;
      prey.targetY = prey.y + ((prey.y - predator.y) / distance) * FAR_WU;
      if (style === 'flee+sprint' && !wasHeld) {
        prey.sprintRemainingTicks = secondsToTicks(balance.controls.SPRINT_DURATION_SECONDS);
      }
    }
    stepWorld(world, context);
    const isHeld = prey.engulfedByCellId !== null;
    if (isHeld && !wasHeld) outcome.starts += 1;
    wasHeld = isHeld;
    for (const effect of world.effects.splice(0)) {
      if (effect.kind === EFFECT_KIND.cellAbsorbed && effect.cellId === prey.id) {
        outcome.finished += 1;
        if (outcome.starts === 1) outcome.firstStartFinished = 1;
      }
      if (effect.kind === EFFECT_KIND.cellReleased && effect.reason === ENGULF_RELEASE_REASON.escaped) {
        outcome.escaped += 1;
      }
    }
    if (outcome.finished > 0) break;
  }
  return outcome;
}

function row(predatorMass: number, preyMass: number, aim: Aim, style: PreyStyle): Outcome {
  const total: Outcome = { starts: 0, finished: 0, escaped: 0, firstStartFinished: 0, trials: 0 };
  for (const offset of OFFSETS) {
    for (const startRadii of START_RADII) {
      const one = trial(predatorMass, preyMass, offset, startRadii, aim, style);
      total.starts += one.starts;
      total.finished += one.finished;
      total.escaped += one.escaped;
      total.firstStartFinished += one.firstStartFinished;
      total.trials += 1;
    }
  }
  return total;
}

console.log(`drag ${process.env.DRAG ?? `default (${DEFAULT_BALANCE.absorption.ENGULF_DRAG_SHARE})`}`);
console.log('| aim | prey | predator/prey mass | trials | starts | finished | dropped (escaped) | first pass eats |');
for (const aim of AIMS) {
  for (const style of PREY_STYLES) {
    for (const [predatorMass, preyMass] of PAIRS) {
      const r = row(predatorMass, preyMass, aim, style);
      console.log(
        `| ${aim} | ${style} | ${predatorMass}/${preyMass} | ${r.trials} | ${r.starts} | ${r.finished} | ${r.escaped} | ${r.firstStartFinished}/${r.trials} |`,
      );
    }
  }
}
