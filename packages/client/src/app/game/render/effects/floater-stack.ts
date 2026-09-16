// The floaters (docs/ui/hud.md §3.1.5): one per one-off mass or DNA change of the own cell — an eat, an engulf's
// payout, a sprint's cost — rising `FLOATER_RISE_PX` over `FLOATER_LIFETIME_MS` and fading over its last
// `FLOATER_FADE_FRACTION`. The same cause within `FLOATER_MERGE_MS` merges into the youngest; a new floater pushes the
// live ones up one row; at most `FLOATER_MAX_VISIBLE`, the oldest leaving early. A floater's x is fixed when it
// spawns, so it only ever moves on y. Every amount is the server's. Pure over the render clock (`nowMs`).

import { EFFECT_KIND, type EntityId, type GameEffect, type ValueOf } from '@evolution/shared';
import {
  CUE_GAP_PX,
  CUE_PILL_HEIGHT_PX,
  CUE_ROW_GAP_PX,
  FLOATER_FADE_FRACTION,
  FLOATER_LIFETIME_MS,
  FLOATER_MAX_VISIBLE,
  FLOATER_MERGE_MS,
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
  amount: number;
  readonly bornMs: number;
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

  /** The newest live floater of `cause`: the live list is oldest first. */
  private youngestOf(cause: FloaterCause): LiveFloater | undefined {
    for (let index = this.live.length - 1; index >= 0; index -= 1) {
      const floater = this.live[index];
      if (floater?.cause === cause) return floater;
    }
    return undefined;
  }

  /** Merges into the youngest of the same cause inside `FLOATER_MERGE_MS`, or pushes the column and adds a floater. */
  spawn(spawn: FloaterSpawn, nowMs: number, leftPx: number): void {
    const youngest = this.youngestOf(spawn.cause);
    if (youngest !== undefined && nowMs - youngest.bornMs < FLOATER_MERGE_MS) {
      youngest.amount += spawn.amount;
      return;
    }
    for (const floater of this.live) floater.row += 1;
    this.live.push({ cause: spawn.cause, amount: spawn.amount, bornMs: nowMs, leftPx, row: 0 });
    if (this.live.length > FLOATER_MAX_VISIBLE) this.live.shift();
  }

  /** The live floaters at `nowMs`, oldest first; the ones past their lifetime leave first. */
  placements(nowMs: number): FloaterPlacement[] {
    this.live = this.live.filter((floater) => nowMs - floater.bornMs < FLOATER_LIFETIME_MS);
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
