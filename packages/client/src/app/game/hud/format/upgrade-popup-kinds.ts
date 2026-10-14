// What a popup of docs/ui/overlays.md §3.8 is: its kind and what it says. A file of its own so the trait popups
// (`upgrade-popups.ts`) and the giant popup (`giant-popups.ts`) build the same record without importing each other.

import type { GiantSpecies, TraitId, ValueOf } from '@evolution/shared';
import type { ModifierEffect } from '../../quantities/modifier-labels';

/** A trait or tier gained; a form gained; a giant swallowed (docs/ecology/giants.md §3.5.8). */
export const UPGRADE_POPUP_KIND = { upgrade: 'upgrade', form: 'form', giant: 'giant' } as const;
export type UpgradePopupKind = ValueOf<typeof UPGRADE_POPUP_KIND>;

export interface UpgradePopup {
  readonly kind: UpgradePopupKind;
  /** The capitals above the title that name the moment (`NEW FORM`); `null` on an upgrade popup, which has none. */
  readonly kicker: string | null;
  /** The trait gained; `null` on a giant popup. */
  readonly traitId: TraitId | null;
  /** The giant swallowed; `null` on a trait's popup. */
  readonly giantSpecies: GiantSpecies | null;
  /** Unique within a seat's queue: the component re-creates the element, and so replays its animation, per popup. */
  readonly key: string;
  /** `Paramecium Cilia II`: the catalog's name and the tier numeral; a giant's display name. */
  readonly title: string;
  readonly effects: readonly string[];
  /** Each effect line's tone, in the same order (`ui-effect-mark`). */
  readonly effectTones: readonly ModifierEffect[];
  /** The form's or the giant's real-life line; `null` on an upgrade popup. */
  readonly realLifeLine: string | null;
  /** The tick it goes up on, and the tick it is gone by. */
  readonly startTick: number;
  readonly endTick: number;
}

/** What a popup says: everything but where it sits in the queue. */
export type UpgradePopupContent = Omit<UpgradePopup, 'key' | 'startTick' | 'endTick'>;
