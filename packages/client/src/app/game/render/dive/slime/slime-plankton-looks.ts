// Each plankton kind as the slime band draws it (docs/rendering/opening-dive.md §4, ticket #803): its least size, its
// halo, its still layers' ladders (`slime-atlases.ts`), the strokes that move under and over its body
// (`slime-plankton-strokes.ts`), and its own motion — the ciliate drifting and turning, the dinoflagellate spinning a
// little — each as the mockup's `nauplius`, `ciliate`, `dino` and `pennate` had them.

import { SILICA_BASE } from '../../constants';
import {
  SLIME_CILIATE,
  SLIME_DINO,
  SLIME_NAUPLIUS,
  type SlimeHaloLook,
  type SlimeOrganism,
  type SlimePlanktonKind,
} from '../../constants/dive-slime-plankton';
import { SLIME_PENNATE } from '../../constants/dive-slime-diatoms';
import type { PlanktonLayerName } from './slime-atlases';
import type { UnitScale } from './slime-glass';
import {
  ciliaStrokes,
  ciliateMouthStrokes,
  dinoGirdleStrokes,
  dinoTrailingStrokes,
  naupliusLimbStrokes,
  naupliusTailStrokes,
  type PlanktonStroke,
} from './slime-plankton-strokes';

/** What a frame tells an organism's strokes. */
export interface PlanktonClock {
  readonly timeSeconds: number;
  readonly darkField: number;
}

/** An organism's own motion: its drift along x (in its lengths) and its turn (radians). */
export interface PlanktonMotion {
  readonly driftX: number;
  readonly turn: number;
}

export interface PlanktonLook {
  readonly hideBelowPx: number;
  readonly halo: SlimeHaloLook;
  /** The ladder of its still body, or `null` (the pennates draw their own quad). */
  readonly body: PlanktonLayerName | null;
  readonly rim: PlanktonLayerName | null;
  strokesUnder(pen: UnitScale, clock: PlanktonClock): readonly PlanktonStroke[];
  strokesOver(pen: UnitScale, clock: PlanktonClock): readonly PlanktonStroke[];
  motion(organism: SlimeOrganism, timeSeconds: number): PlanktonMotion;
}

const STILL: PlanktonMotion = { driftX: 0, turn: 0 };
const NONE: readonly PlanktonStroke[] = [];

export const SLIME_PLANKTON_LOOKS: Readonly<Record<SlimePlanktonKind, PlanktonLook>> = {
  nauplius: {
    hideBelowPx: SLIME_NAUPLIUS.hideBelowPx,
    halo: SLIME_NAUPLIUS.halo,
    body: 'nauplius',
    rim: null,
    strokesUnder: (pen, clock) => naupliusLimbStrokes(pen, clock.timeSeconds),
    strokesOver: (pen, clock) => naupliusTailStrokes(pen, clock.timeSeconds),
    motion: () => STILL,
  },
  ciliate: {
    hideBelowPx: SLIME_CILIATE.hideBelowPx,
    halo: SLIME_CILIATE.halo,
    body: 'ciliateBody',
    rim: 'ciliateRim',
    strokesUnder: (pen, clock) => ciliaStrokes(pen, clock.timeSeconds, clock.darkField),
    strokesOver: (pen, clock) => ciliateMouthStrokes(pen, clock.timeSeconds),
    motion: (organism, timeSeconds) => {
      const { drift, wobble } = SLIME_CILIATE;
      return {
        driftX: Math.sin(timeSeconds * drift.rate + organism.x * drift.phasePerMetre) * drift.amount,
        turn: Math.sin(timeSeconds * wobble.rate) * wobble.amount,
      };
    },
  },
  dino: {
    hideBelowPx: SLIME_DINO.hideBelowPx,
    halo: SLIME_DINO.halo,
    body: 'dinoBody',
    rim: 'dinoRim',
    strokesUnder: (pen, clock) => dinoTrailingStrokes(pen, clock.timeSeconds),
    strokesOver: (pen, clock) => dinoGirdleStrokes(pen, clock.timeSeconds),
    motion: (organism, timeSeconds) => {
      const { spin } = SLIME_DINO;
      return { driftX: 0, turn: Math.sin(timeSeconds * spin.rate + organism.x * spin.phasePerMetre) * spin.amount };
    },
  },
  pennate: {
    hideBelowPx: SLIME_PENNATE.hideBelowPx,
    halo: { colour: SILICA_BASE, ...SLIME_PENNATE.halo },
    body: null,
    rim: null,
    strokesUnder: () => NONE,
    strokesOver: () => NONE,
    motion: () => STILL,
  },
};
