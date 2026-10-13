// The engulf pass measurement of ticket #772: a predator cruising at full speed passes over a prey it can just eat,
// the way a player does (the mouse past the prey, or on it), and the bench counts how many started engulfs finish and
// how many drop because contact broke. Two cells alone in the broth, no gel, no food; the whole tick runs.
//
//   DRAG=<share> pnpm --filter @evolution/server bench:engulf-pass      (DRAG patches ENGULF_DRAG_SHARE first; unset: the default)
//   HOLD=<fraction> pnpm --filter @evolution/server bench:engulf-pass    (HOLD patches ENGULF_HOLD_COVERAGE_FRACTION first; #819)
//   COVER=<seconds> pnpm --filter @evolution/server bench:engulf-pass   (COVER patches ENGULF_COVER_SECONDS first; #819)
//   PREY_TRAIT=cilia pnpm --filter @evolution/server bench:engulf-pass  (the prey owns that trait at tier I; #819's Cilia escape)
//   TRIAL=<seconds> pnpm --filter @evolution/server bench:engulf-pass   (each trial's length; unset: 4 s. #819's 20 s hold check)
//
// "held at end" counts trials whose prey is still held, neither sealed and paid out nor released, when the trial ends;
// "longest hold" is the longest one grab lasted in any of the row's trials, payout or release included (s).

import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  playerId,
  secondsToTicks,
  ticksToSeconds,
  type TraitId,
} from '@evolution/shared';
import { setBalanceForDebug } from '../src/game/debug/debug-operations.js';
import { setCellMass } from '../src/game/simulation/cell-mass.js';
import { tryStartSprint } from '../src/game/simulation/inputs.js';
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
const DEFAULT_TRIAL_SECONDS = 4;
const TRIAL_SECONDS = Number(process.env.TRIAL ?? DEFAULT_TRIAL_SECONDS);
const FAR_WU = 1000;
/** `cross` (#819): the prey swims east across the pass line at full speed and never reacts, so the two meet mid-swim. */
const PREY_STYLES = ['still', 'flee', 'flee+sprint', 'cross'] as const;
/**
 * `chase` (#819): the pointer sits `CHASE_LEAD_RADII` of the predator's radii ahead of the prey along the prey's own
 * velocity, as a player chasing a moving cell leads it (E18's rim chase); on a still prey it is on the prey.
 */
const AIMS = ['through', 'track', 'chase'] as const;
const CHASE_LEAD_RADII = 1.5;
type PreyStyle = (typeof PREY_STYLES)[number];
type Aim = (typeof AIMS)[number];

interface Outcome {
  starts: number;
  finished: number;
  escaped: number;
  firstStartFinished: number;
  heldAtEnd: number;
  longestHoldTicks: number;
  trials: number;
}

/** The predator's pointer on the prey, or `leadRadii` of its own radii ahead of the prey along the prey's velocity. */
function aimAtPrey(predator: CellRecord, prey: CellRecord, leadRadii: number) {
  const preySpeed = Math.hypot(prey.velocityX, prey.velocityY);
  const lead = preySpeed === 0 ? 0 : (leadRadii * predator.radius) / preySpeed;
  predator.targetX = prey.x + prey.velocityX * lead;
  predator.targetY = prey.y + prey.velocityY * lead;
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
  if (process.env.HOLD !== undefined) {
    setBalanceForDebug(world, { absorption: { ENGULF_HOLD_COVERAGE_FRACTION: Number(process.env.HOLD) } });
  }
  if (process.env.COVER !== undefined) {
    setBalanceForDebug(world, { absorption: { ENGULF_COVER_SECONDS: Number(process.env.COVER) } });
  }
  const balance = world.balance;
  const context = createTestStepContext(world);
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  if (process.env.PREY_TRAIT !== undefined) {
    world.players[1]?.ownedTraits.push({ traitId: process.env.PREY_TRAIT as TraitId, tier: 1 });
  }
  setCellMass(predator, predatorMass, balance);
  setCellMass(prey, preyMass, balance);
  const reach = predator.radius - prey.radius * balance.absorption.ENGULF_COVERAGE_FRACTION;
  const approachWu = reach + startRadii * predator.radius;
  const isCrossing = style === 'cross';
  prey.x = isCrossing ? BROTH_POINT.x - approachWu : BROTH_POINT.x;
  prey.y = BROTH_POINT.y;
  prey.velocityX = isCrossing ? balance.growth.CELL_BASE_SPEED : 0;
  prey.targetX = null;
  prey.targetY = null;
  predator.x = BROTH_POINT.x + offset * reach;
  predator.y = prey.y - approachWu;
  predator.velocityX = 0;
  predator.velocityY = balance.growth.CELL_BASE_SPEED;
  const outcome = { starts: 0, finished: 0, escaped: 0, firstStartFinished: 0, heldAtEnd: 0, longestHoldTicks: 0 };
  let wasHeld = false;
  let holdTicks = 0;
  for (let tick = 0; tick < secondsToTicks(TRIAL_SECONDS); tick += 1) {
    if (aim === 'through') {
      predator.targetX = predator.x;
      predator.targetY = predator.y + FAR_WU;
    } else {
      aimAtPrey(predator, prey, aim === 'chase' ? CHASE_LEAD_RADII : 0);
    }
    if (isCrossing) {
      prey.targetX = prey.x + FAR_WU;
      prey.targetY = prey.y;
    } else if (prey.engulfedByCellId !== null && style !== 'still') {
      const distance = Math.hypot(prey.x - predator.x, prey.y - predator.y) || 1;
      prey.targetX = prey.x + ((prey.x - predator.x) / distance) * FAR_WU;
      prey.targetY = prey.y + ((prey.y - predator.y) / distance) * FAR_WU;
      // Every tick it is held and its cooldown allows, paying the sprint's cost as a player's sprint does (#819: keyed
      // on `wasHeld` it never fired; once a trial, a 20 s trial left a re-grabbed prey with no sprint).
      if (style === 'flee+sprint') tryStartSprint(prey, balance);
    }
    stepWorld(world, context);
    const isHeld = prey.engulfedByCellId !== null;
    if (isHeld && !wasHeld) outcome.starts += 1;
    holdTicks = isHeld ? holdTicks + 1 : 0;
    outcome.longestHoldTicks = Math.max(outcome.longestHoldTicks, holdTicks);
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
  outcome.heldAtEnd = outcome.finished === 0 && prey.engulfedByCellId !== null ? 1 : 0;
  return outcome;
}

function row(predatorMass: number, preyMass: number, aim: Aim, style: PreyStyle): Outcome {
  const total: Outcome = {
    starts: 0,
    finished: 0,
    escaped: 0,
    firstStartFinished: 0,
    heldAtEnd: 0,
    longestHoldTicks: 0,
    trials: 0,
  };
  for (const offset of OFFSETS) {
    for (const startRadii of START_RADII) {
      const one = trial(predatorMass, preyMass, offset, startRadii, aim, style);
      total.starts += one.starts;
      total.finished += one.finished;
      total.escaped += one.escaped;
      total.firstStartFinished += one.firstStartFinished;
      total.heldAtEnd += one.heldAtEnd;
      total.longestHoldTicks = Math.max(total.longestHoldTicks, one.longestHoldTicks);
      total.trials += 1;
    }
  }
  return total;
}

console.log(`drag ${process.env.DRAG ?? `default (${DEFAULT_BALANCE.absorption.ENGULF_DRAG_SHARE})`}`);
console.log(`hold ${process.env.HOLD ?? `default (${DEFAULT_BALANCE.absorption.ENGULF_HOLD_COVERAGE_FRACTION})`}`);
console.log(`cover ${process.env.COVER ?? `default (${DEFAULT_BALANCE.absorption.ENGULF_COVER_SECONDS})`} s`);
console.log(`prey trait ${process.env.PREY_TRAIT ?? 'none'}`);
console.log(`trial ${TRIAL_SECONDS} s`);
console.log(
  '| aim | prey | predator/prey mass | trials | starts | finished | dropped (escaped) | held at end | longest hold (s) | first pass eats |',
);
for (const aim of AIMS) {
  for (const style of PREY_STYLES) {
    for (const [predatorMass, preyMass] of PAIRS) {
      const r = row(predatorMass, preyMass, aim, style);
      console.log(
        `| ${aim} | ${style} | ${predatorMass}/${preyMass} | ${r.trials} | ${r.starts} | ${r.finished} | ${r.escaped} | ${r.heldAtEnd} | ${ticksToSeconds(r.longestHoldTicks)} | ${r.firstStartFinished}/${r.trials} |`,
      );
    }
  }
}
