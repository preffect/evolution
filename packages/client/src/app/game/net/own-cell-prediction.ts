// The own cell's predicted pose (docs/architecture/client.md §5, #265): the authoritative pose of the newest snapshot
// re-run through the shared movement step, one whole tick per unacknowledged input. Pure — the predictor owns the
// inputs and the correction, this owns the replay. Only the pose and the sprint clocks move; mass, radius, stage,
// traits, engulf state and death are read from the snapshot and never predicted.

import {
  ZONE_ID,
  engulfPhaseOf,
  foldModifiers,
  hasSteerTarget,
  movementStepFor,
  predatorEngulfSpeedFactor,
  sprintCooldownTicksFor,
  sprintDurationTicks,
  stepMovementKernel,
  zoneAt,
  type BalanceConfig,
  type CellView,
  type GameInput,
  type GameSnapshot,
  type MovementCellState,
  type MovementModifiers,
  type MovementPose,
  type Vec2,
} from '@evolution/shared';

/** What one replay starts from: the snapshot, the own cell in it, and the live balance. */
export interface PredictionBase {
  readonly snapshot: GameSnapshot;
  readonly ownCell: CellView;
  readonly balance: BalanceConfig;
}

/** The replayed state: the pose, and the sprint clocks a predicted sprint start sets. */
interface ReplayState {
  pose: MovementPose;
  /** `null` until an input steers: the server then steers at the cell's own centre, throttle 0. */
  target: Vec2 | null;
  sprintRemainingTicks: number;
  sprintCooldownRemainingTicks: number;
}

/** A cell being engulfed is moved by its predator, not by its input: its pose is never predicted. */
export function isPredictable(cell: CellView): boolean {
  return cell.engulfedByCellId === null;
}

/** docs/ecology/absorption.md §6.1 as the predator, read from the prey's reported progress; 1 when not engulfing. */
function predatorFactorOf(base: PredictionBase): number {
  const preyId = base.ownCell.engulfingCellId;
  const prey = preyId === null ? undefined : base.snapshot.cells.find((cell) => cell.id === preyId);
  if (prey === undefined) return 1;
  const absorption = base.balance.absorption;
  return predatorEngulfSpeedFactor(engulfPhaseOf(prey.engulfProgress, absorption), absorption);
}

/** Step 1 of the server tick for the own cell (`simulation/inputs.ts`): latch the target, start a sprint if ready. */
function applyInput(
  state: ReplayState,
  input: GameInput | undefined,
  cooldownTicks: number,
  balance: BalanceConfig,
): void {
  if (input === undefined) return;
  if (hasSteerTarget(input)) state.target = { x: input.targetX, y: input.targetY };
  if (input.shouldSprint && state.sprintCooldownRemainingTicks <= 0) {
    state.sprintRemainingTicks = sprintDurationTicks(balance);
    state.sprintCooldownRemainingTicks = cooldownTicks;
  }
}

/** The replay's last two poses: the frame draws between them, so a tick landing mid-frame never reads as a jolt. */
export interface PredictedPoses {
  /** After every replayed tick: where the cell is when the server applies the newest input. */
  readonly current: MovementPose;
  /** One tick earlier; `current` itself when nothing was replayed. */
  readonly previous: MovementPose;
}

/** What every replayed tick reads unchanged: the snapshot's facts, folded once per replay. */
interface ReplayContext {
  readonly base: PredictionBase;
  readonly modifiers: MovementModifiers & { readonly sprintCooldownSecondsDelta: number };
  readonly cooldownTicks: number;
  readonly engulfFactor: number;
}

/** One server tick for the own cell: step 1's input, step 3's move, then the sprint clocks age. */
function replayTick(state: ReplayState, input: GameInput | undefined, context: ReplayContext): void {
  const { ownCell, balance, snapshot } = context.base;
  applyInput(state, input, context.cooldownTicks, balance);
  const movement: MovementCellState = {
    mass: ownCell.mass,
    radiusWu: ownCell.radius,
    sprintRemainingTicks: state.sprintRemainingTicks,
    modifiers: context.modifiers,
    isInGel: zoneAt(state.pose, snapshot.gelPatches, balance) === ZONE_ID.viscousGel,
    engulfFactor: context.engulfFactor,
  };
  state.pose = stepMovementKernel(state.pose, movementStepFor(movement, state.target ?? state.pose, balance));
  state.sprintRemainingTicks = Math.max(0, state.sprintRemainingTicks - 1);
  state.sprintCooldownRemainingTicks = Math.max(0, state.sprintCooldownRemainingTicks - 1);
}

function replayContextOf(base: PredictionBase): ReplayContext {
  const modifiers = foldModifiers(base.ownCell.traits, base.balance.traits.TRAIT_TIERS);
  return {
    base,
    modifiers,
    cooldownTicks: sprintCooldownTicksFor(modifiers.sprintCooldownSecondsDelta, base.balance),
    engulfFactor: predatorFactorOf(base),
  };
}

/**
 * The poses after `steps` ticks, input `acknowledgedSequence + i` applied at tick `snapshot.tick + i` (a sequence
 * missing from `inputs` keeps the latch, as the server does on a tick with no input). `inputs` are the ones the
 * client holds, in sequence order; the newest at or below the acknowledged one gives the latched target.
 */
export function predictOwnPoses(
  base: PredictionBase,
  inputs: readonly GameInput[],
  acknowledgedSequence: number,
  steps: number,
): PredictedPoses {
  const { ownCell } = base;
  const context = replayContextOf(base);
  const pose: MovementPose = { x: ownCell.x, y: ownCell.y, velocityX: ownCell.velocityX, velocityY: ownCell.velocityY };
  const state: ReplayState = {
    pose,
    target: latchedTargetOf(inputs, acknowledgedSequence),
    sprintRemainingTicks: ownCell.sprintRemainingTicks,
    sprintCooldownRemainingTicks: ownCell.sprintCooldownRemainingTicks,
  };
  let previous = pose;
  for (let step = 1; step <= steps; step += 1) {
    previous = state.pose;
    const sequence = acknowledgedSequence + step;
    replayTick(
      state,
      inputs.find((input) => input.sequence === sequence),
      context,
    );
  }
  return { current: state.pose, previous };
}

/** The target the server holds latched after `acknowledgedSequence`: the newest steering input at or below it. */
function latchedTargetOf(inputs: readonly GameInput[], acknowledgedSequence: number): Vec2 | null {
  for (let index = inputs.length - 1; index >= 0; index -= 1) {
    const input = inputs[index];
    if (input !== undefined && input.sequence <= acknowledgedSequence && hasSteerTarget(input)) {
      return { x: input.targetX, y: input.targetY };
    }
  }
  return null;
}
