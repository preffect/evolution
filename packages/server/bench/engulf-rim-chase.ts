// The rim chase of ticket #819's review: E18's geometry (docs/ecology/acceptance.md §8; A 30 chasing B 20 along the
// dish's rim, B starting under A) at several pointer leads, for a plain prey, Cilia Fringe I to III, and a plain prey
// that sprints whenever it is held and its cooldown allows. Each run reports how the first grab ended (`esc@t`
// released `escaped` on tick t, `eat@t` absorbed on tick t, `held` still held when the run ends), the peak progress
// that grab reached, and whether B is alive at the end. The whole tick runs; no gel, no food.
//
//   pnpm --filter @evolution/server bench:engulf-rim-chase
//   HOLD=<fraction> pnpm --filter @evolution/server bench:engulf-rim-chase    (patches ENGULF_HOLD_COVERAGE_FRACTION first)
//   TRIAL=<seconds> pnpm --filter @evolution/server bench:engulf-rim-chase   (each run's length; unset: 20 s)

import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  playerId,
  secondsToTicks,
  type TraitId,
  type TraitTier,
} from '@evolution/shared';
import { setBalanceForDebug } from '../src/game/debug/debug-operations.js';
import { setCellMass } from '../src/game/simulation/cell-mass.js';
import { tryStartSprint } from '../src/game/simulation/inputs.js';
import { stepWorld } from '../src/game/simulation/step.js';
import type { CellRecord } from '../src/game/world/entities.js';
import { FULL_THROTTLE_RADII } from '../src/testing/scenarios/shared-setups.js';
import { createTestStepContext, createTestWorld } from '../src/testing/world-builders.js';

/** E18's pair and placement: B against the rim on the +x axis, A 8 wu behind it, inside the contact bound. */
const PREDATOR_MASS = 30;
const PREY_MASS = 20;
const PREDATOR_OFFSET_WU = { x: -4.8, y: -6.4 };
/** B leans this share of its reach into the wall so it slides along the curve (E18). */
const RIM_LEAN = 0.3;
/** A's pointer this many of its radii ahead of B along the rim; E18 pins 1.5. */
const LEADS_RADII = [1.25, 1.5, 2, 3, 5];
const DEFAULT_TRIAL_SECONDS = 20;
const TRIAL_SECONDS = Number(process.env.TRIAL ?? DEFAULT_TRIAL_SECONDS);
const CILIA: TraitId = 'cilia';
/** The prey variants: its Cilia Fringe tier (none when left out), and whether it sprints whenever held. */
interface PreyVariant {
  readonly label: string;
  readonly ciliaTier?: TraitTier;
  readonly sprints: boolean;
}
const PREYS: readonly PreyVariant[] = [
  { label: 'plain', sprints: false },
  { label: 'Cilia I', ciliaTier: 1, sprints: false },
  { label: 'Cilia II', ciliaTier: 2, sprints: false },
  { label: 'Cilia III', ciliaTier: 3, sprints: false },
  { label: 'sprint', sprints: true },
];

/** The unit tangent of the rim at `cell`, counter-clockwise. */
function rimTangentAt(cell: CellRecord): { x: number; y: number } {
  const distance = Math.hypot(cell.x, cell.y);
  return { x: -cell.y / distance, y: cell.x / distance };
}

function chasePair(ciliaTier: TraitTier | undefined) {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  world.gelPatches = [];
  if (process.env.HOLD !== undefined) {
    setBalanceForDebug(world, { absorption: { ENGULF_HOLD_COVERAGE_FRACTION: Number(process.env.HOLD) } });
  }
  if (ciliaTier !== undefined) world.players[1]?.ownedTraits.push({ traitId: CILIA, tier: ciliaTier });
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  setCellMass(predator, PREDATOR_MASS, world.balance);
  setCellMass(prey, PREY_MASS, world.balance);
  prey.x = world.balance.world.DISH_RADIUS - prey.radius;
  prey.y = 0;
  predator.x = prey.x + PREDATOR_OFFSET_WU.x;
  predator.y = prey.y + PREDATOR_OFFSET_WU.y;
  return { world, predator, prey };
}

/** One E18 run: how the first grab ended, its peak progress, and whether B is alive at the end. */
function run(leadRadii: number, preyVariant: PreyVariant): string {
  const { world, predator, prey } = chasePair(preyVariant.ciliaTier);
  const context = createTestStepContext(world);
  let firstGrab = 'held';
  let peakProgress = 0;
  let isEaten = false;
  for (let tick = 0; tick < secondsToTicks(TRIAL_SECONDS) && !isEaten; tick += 1) {
    const preyTangent = rimTangentAt(prey);
    const reach = FULL_THROTTLE_RADII * prey.radius;
    prey.targetX = prey.x + (preyTangent.x + RIM_LEAN * preyTangent.y) * reach;
    prey.targetY = prey.y + (preyTangent.y - RIM_LEAN * preyTangent.x) * reach;
    predator.targetX = prey.x + preyTangent.x * leadRadii * predator.radius;
    predator.targetY = prey.y + preyTangent.y * leadRadii * predator.radius;
    if (preyVariant.sprints && prey.engulfedByCellId !== null) tryStartSprint(prey, world.balance);
    stepWorld(world, context);
    if (firstGrab === 'held') peakProgress = Math.max(peakProgress, prey.engulfProgress);
    for (const effect of world.effects.splice(0)) {
      const isEscape = effect.kind === EFFECT_KIND.cellReleased && effect.reason === ENGULF_RELEASE_REASON.escaped;
      isEaten ||= effect.kind === EFFECT_KIND.cellAbsorbed && effect.cellId === prey.id;
      if (firstGrab === 'held' && isEscape) firstGrab = `esc@${world.tick}`;
      if (firstGrab === 'held' && isEaten) firstGrab = `eat@${world.tick}`;
    }
  }
  return `${firstGrab} (peak ${peakProgress.toFixed(2)}, ${isEaten ? 'eaten' : 'alive'})`;
}

console.log(`hold ${process.env.HOLD ?? `default (${DEFAULT_BALANCE.absorption.ENGULF_HOLD_COVERAGE_FRACTION})`}`);
console.log(`trial ${TRIAL_SECONDS} s`);
console.log(`| prey | ${LEADS_RADII.map((lead) => `lead ${lead}`).join(' | ')} |`);
for (const preyVariant of PREYS) {
  console.log(`| ${preyVariant.label} | ${LEADS_RADII.map((lead) => run(lead, preyVariant)).join(' | ')} |`);
}
