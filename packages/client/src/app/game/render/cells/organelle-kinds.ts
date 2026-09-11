// What organelles a cell carries and how many (docs/VISUAL-STYLE.md §3, §4): the kinds in the
// order their slots are laid out, and the per-trait tier tables that decide the counts. The
// eyespot and the form parts join with #121.

import type { ValueOf } from '@evolution/shared';
import {
  CHLOROPLASTS_BY_TIER,
  FOOD_VACUOLES_BY_TIER,
  LIPID_DROPLET,
  MITOCHONDRIA_BY_TIER,
  PROTOCELL_GRANULE_COUNT,
  TOXIN_VACUOLES_BY_TIER,
} from '../constants';
import type { CellTraitSummary } from './cell-traits';

export const ORGANELLE_KIND = {
  nucleus: 'nucleus',
  nucleoid: 'nucleoid',
  mitochondrion: 'mitochondrion',
  chloroplast: 'chloroplast',
  foodVacuole: 'food_vacuole',
  toxinVacuole: 'toxin_vacuole',
  lipid: 'lipid',
  protocellGranule: 'protocell_granule',
} as const;
export type OrganelleKind = ValueOf<typeof ORGANELLE_KIND>;

/** The kinds that anchor the nucleus offset and drift: the nucleus, or the nucleoid before the envelope. */
export const NUCLEUS_KINDS: ReadonlySet<OrganelleKind> = new Set([ORGANELLE_KIND.nucleus, ORGANELLE_KIND.nucleoid]);

/** Layout order: the nucleus first (it anchors the keep-out), then the organelles by prominence. */
export const ORGANELLE_KIND_ORDER: readonly OrganelleKind[] = [
  ORGANELLE_KIND.nucleus,
  ORGANELLE_KIND.nucleoid,
  ORGANELLE_KIND.toxinVacuole,
  ORGANELLE_KIND.chloroplast,
  ORGANELLE_KIND.mitochondrion,
  ORGANELLE_KIND.foodVacuole,
  ORGANELLE_KIND.lipid,
  ORGANELLE_KIND.protocellGranule,
];

function byTier(table: readonly number[], tier: number): number {
  return tier === 0 ? 0 : (table[tier - 1] ?? 0);
}

/** How many of each kind the cell shows: the nucleoid until the envelope, then the nucleus. */
export function organelleCounts(traits: CellTraitSummary): Readonly<Record<OrganelleKind, number>> {
  const hasNucleoid = !traits.isProtocell && !traits.hasNucleus;
  return {
    [ORGANELLE_KIND.nucleus]: traits.hasNucleus ? 1 : 0,
    [ORGANELLE_KIND.nucleoid]: hasNucleoid ? 1 : 0,
    [ORGANELLE_KIND.mitochondrion]: byTier(MITOCHONDRIA_BY_TIER, traits.tierOf('mitochondrion')),
    [ORGANELLE_KIND.chloroplast]: byTier(CHLOROPLASTS_BY_TIER, traits.tierOf('chloroplast')),
    [ORGANELLE_KIND.foodVacuole]: byTier(FOOD_VACUOLES_BY_TIER, traits.tierOf('food_vacuole')),
    [ORGANELLE_KIND.toxinVacuole]: byTier(TOXIN_VACUOLES_BY_TIER, traits.tierOf('toxin_vacuole')),
    [ORGANELLE_KIND.lipid]: traits.isProtocell ? 0 : LIPID_DROPLET.count,
    [ORGANELLE_KIND.protocellGranule]: traits.isProtocell ? PROTOCELL_GRANULE_COUNT : 0,
  };
}
