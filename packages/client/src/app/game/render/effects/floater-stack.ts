// The floaters (docs/ui/hud.md §3.1.5): one per one-off mass or DNA change of the own cell — an eat, an engulf's
// payout, a sprint's cost — rising `FLOATER_RISE_PX` over `FLOATER_LIFETIME_MS` and fading over its last
// `FLOATER_FADE_FRACTION`. **One live floater per cause (#443):** a pickup of a cause that is still on screen adds to
// that floater (`+1` reads `+2`) instead of spawning a second beside it, so a feeding run is one counter, not a column
// of near-identical labels. The floater keeps the lifetime and the x it was born with — `bornMs` and `leftPx` are
// readonly for that reason: its rise and its fade are both functions of its age, so resetting the clock on a merge
// would slide it back down toward the cell on every bite. A new floater of another cause pushes the live ones up one
// row, so the column holds at most one row per cause (`FLOATER_MAX_VISIBLE`). Every amount is the server's. Pure over
// the render clock (`nowMs`).

import { EFFECT_KIND, type EntityId, type GameEffect, type ValueOf } from '@evolution/shared';
import {
  CUE_GAP_PX,
  CUE_PILL_HEIGHT_PX,
  CUE_ROW_GAP_PX,
  FLOATER_FADE_FRACTION,
  FLOATER_LIFETIME_MS,
  FLOATER_RISE_PX,
} from '../constants';
import { CUE_RIM, formatMassAmount, type CueRim } from '../../hud/format/mass-cues';

export const FLOATER_CAUSE = { food: 'food', dna: 'dna', engulf: 'engulf', sprint: 'sprint' } as const;
export type FloaterCause = ValueOf<typeof FLOATER_CAUSE>;

/** The cause a floater names, uppercased by the `label` role when drawn. */
export const FLOATER_CAUSE_LABEL: Readonly<Record<FloaterCause, string>> = {
  [FLOATER_CAUSE.food]: 'Food',
  [FLOATER_CAUSE.dna]: 'DNA',
  [FLOATER_CAUSE.engulf]: 'Engulf',
  [FLOATER_CAUSE.sprint]: 'Sprint',
};

const FLOATER_RIM: Readonly<Record<FloaterCause, CueRim>> = {
  [FLOATER_CAUSE.food]: CUE_RIM.gain,
  [FLOATER_CAUSE.dna]: CUE_RIM.dna,
  [FLOATER_CAUSE.engulf]: CUE_RIM.gain,
  [FLOATER_CAUSE.sprint]: CUE_RIM.none,
};

export interface FloaterSpawn {
  readonly cause: FloaterCause;
  /** Signed: a sprint's cost is negative. */
  readonly amount: number;
}

export interface FloaterPlacement {
  readonly cause: FloaterCause;
  /** `+3`. */
  readonly amountText: string;
  /** `Food`; uppercased by the `label` role. */
  readonly causeLabel: string;
  readonly rim: CueRim;
  /** The pill's left edge and bottom edge, px in the own cell's frame. */
  readonly leftPx: number;
  readonly bottomPx: number;
  readonly alpha: number;
}

interface LiveFloater {
  readonly cause: FloaterCause;
  /** The only field a merge touches: the running total of this cause's pickups while the floater is up. */
  amount: number;
  /** The first pickup's clock: a merge never moves it, so the floater always leaves on its original schedule. */
  readonly bornMs: number;
  /** The first pickup's column start: a merge never moves it, so the pill never snaps sideways. */
  readonly leftPx: number;
  /** Rows the floaters spawned after it have pushed it up. */
  row: number;
}

const NOTHING = 0;
const OPAQUE = 1;
const ROW_PITCH_PX = CUE_PILL_HEIGHT_PX + CUE_ROW_GAP_PX;

/** The own cell's floaters in one batch of effects: an eat's mass and DNA, an engulf's payout. */
export function floaterSpawnsOf(effects: readonly GameEffect[], ownCellId: EntityId): FloaterSpawn[] {
  const spawns: FloaterSpawn[] = [];
  const add = (cause: FloaterCause, amount: number): void => {
    if (amount !== NOTHING) spawns.push({ cause, amount });
  };
  for (const effect of effects) {
    if (effect.kind === EFFECT_KIND.eat && effect.cellId === ownCellId) {
      add(FLOATER_CAUSE.food, effect.massGained);
      add(FLOATER_CAUSE.dna, effect.dnaGained);
    }
    if (effect.kind === EFFECT_KIND.cellAbsorbed && effect.predatorCellId === ownCellId) {
      add(FLOATER_CAUSE.engulf, effect.predatorMassGained);
      add(FLOATER_CAUSE.dna, effect.predatorDnaGained);
    }
  }
  return spawns;
}

/** 1 until the fade starts, then down to 0 at the end of the lifetime. */
export function floaterAlpha(ageMs: number): number {
  const progress = ageMs / FLOATER_LIFETIME_MS;
  const fadeStart = OPAQUE - FLOATER_FADE_FRACTION;
  return progress < fadeStart ? OPAQUE : Math.max(NOTHING, (OPAQUE - progress) / FLOATER_FADE_FRACTION);
}

export class FloaterStack {
  private live: LiveFloater[] = [];

  /** Drops the floaters past their lifetime, so a spawn and a read both see only what is on screen at `nowMs`. */
  private retire(nowMs: number): void {
    this.live = this.live.filter((floater) => nowMs - floater.bornMs < FLOATER_LIFETIME_MS);
  }

  /**
   * Adds to the live floater of the same cause (#443) — a merge only ever changes the amount — or pushes the column up
   * one row and starts a floater. Retiring first is what keeps a merge from landing on a floater that has already left.
   */
  spawn(spawn: FloaterSpawn, nowMs: number, leftPx: number): void {
    this.retire(nowMs);
    const shown = this.live.find((floater) => floater.cause === spawn.cause);
    if (shown !== undefined) {
      shown.amount += spawn.amount;
      return;
    }
    for (const floater of this.live) floater.row += 1;
    this.live.push({ cause: spawn.cause, amount: spawn.amount, bornMs: nowMs, leftPx, row: 0 });
  }

  /** The live floaters at `nowMs`, oldest first; the ones past their lifetime leave first. */
  placements(nowMs: number): FloaterPlacement[] {
    this.retire(nowMs);
    return this.live.map((floater) => {
      const age = nowMs - floater.bornMs;
      return {
        cause: floater.cause,
        amountText: formatMassAmount(floater.amount),
        causeLabel: FLOATER_CAUSE_LABEL[floater.cause],
        rim: FLOATER_RIM[floater.cause],
        leftPx: floater.leftPx,
        bottomPx: -CUE_GAP_PX - FLOATER_RISE_PX * (age / FLOATER_LIFETIME_MS) - floater.row * ROW_PITCH_PX,
        alpha: floaterAlpha(age),
      };
    });
  }

  /** A new own cell or no cell: nothing carries over. */
  clear(): void {
    this.live = [];
  }

  get count(): number {
    return this.live.length;
  }
}
