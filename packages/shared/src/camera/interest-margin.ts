// The interest margin (docs/architecture/wire-contract.md §4.2 lever 1): how far past each camera's view a viewer's
// food and fragments are still sent, so that none enters or leaves its stream where the canvas can show it. A formula
// over the room's live balance, because `debug_set_balance` can raise the speeds it bounds; the covered aspect, the
// camera history and the drawn reach do not depend on the balance and are constants (`constants/interest.ts`).

import type { BalanceConfig } from '../constants/balance.js';
import { INTEREST_ENTITY_REACH_RADII } from '../constants/interest.js';
import { INTERPOLATION_DELAY_TICKS, MAX_EXTRAPOLATION_TICKS, SNAPSHOT_EVERY_TICKS } from '../constants/netcode.js';
import { TICK_INTERVAL_S } from '../constants/network.js';

export type InterestBalance = Pick<BalanceConfig, 'controls' | 'ecology' | 'growth' | 'traits'>;

const IDENTITY_MULTIPLIER = 1;
const IDENTITY_BONUS = 0;
/** Ticks the client's camera can run ahead of the server's newest state: the extrapolation, and one broadcast step. */
const CAMERA_LEAD_TICKS = MAX_EXTRAPOLATION_TICKS + SNAPSHOT_EVERY_TICKS;
/** Ticks a drawn mote can trail the snapshot that last placed it: the render delay, the extrapolation, one interval. */
const FOOD_LAG_TICKS = INTERPOLATION_DELAY_TICKS + MAX_EXTRAPOLATION_TICKS + SNAPSHOT_EVERY_TICKS;

/**
 * The fastest a cell can move (wu/s): `CELL_BASE_SPEED` under every trait's best speed tier, sprinting with every
 * trait's best sprint bonus. An upper bound: no build owns every trait.
 */
export function interestMaxCellSpeedFor(balance: InterestBalance): number {
  const tiersOfEveryTrait = Object.values(balance.traits.TRAIT_TIERS);
  const speedMultiplier = tiersOfEveryTrait.reduce(
    (product, tiers) =>
      product * Math.max(IDENTITY_MULTIPLIER, ...tiers.map((tier) => tier.speedMultiplier ?? IDENTITY_MULTIPLIER)),
    IDENTITY_MULTIPLIER,
  );
  const sprintBonus = tiersOfEveryTrait.reduce(
    (sum, tiers) =>
      sum + Math.max(IDENTITY_BONUS, ...tiers.map((tier) => tier.sprintSpeedMultiplierBonus ?? IDENTITY_BONUS)),
    IDENTITY_BONUS,
  );
  return balance.growth.CELL_BASE_SPEED * speedMultiplier * (balance.controls.SPRINT_SPEED_MULTIPLIER + sprintBonus);
}

/** The fastest a mote or a fragment moves (wu/s): a bacterium's walk, a fragment's drift or a mote an eyespot pulls. */
export function interestMaxFoodSpeedFor(balance: InterestBalance): number {
  const attractSpeeds = Object.values(balance.traits.TRAIT_TIERS).flatMap((tiers) =>
    tiers.map((tier) => tier.attractSpeed ?? IDENTITY_BONUS),
  );
  return Math.max(balance.ecology.BACTERIUM_DRIFT_SPEED, balance.ecology.DNA_FRAGMENT_DRIFT_SPEED, ...attractSpeeds);
}

/**
 * What the area adds around each camera's view (wu): how far the client's camera can lead the server's, how far a
 * mote can move before the client draws where it is, and how far past its centre a mote is drawn.
 */
export function interestMarginFor(balance: InterestBalance): number {
  const largestFoodRadius = Math.max(
    balance.ecology.ALGAE_RADIUS,
    balance.ecology.BACTERIUM_RADIUS,
    balance.ecology.DETRITUS_RADIUS,
    balance.ecology.DNA_FRAGMENT_RADIUS,
  );
  return Math.ceil(
    CAMERA_LEAD_TICKS * TICK_INTERVAL_S * interestMaxCellSpeedFor(balance) +
      FOOD_LAG_TICKS * TICK_INTERVAL_S * interestMaxFoodSpeedFor(balance) +
      INTEREST_ENTITY_REACH_RADII * largestFoodRadius,
  );
}
