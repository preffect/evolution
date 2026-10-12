// What organelles a cell carries and how many (docs/visual-style/cells-and-organelles.md §3, §4): the kinds in the
// order their slots are laid out, and the per-trait tier tables that decide the counts. The
// eyespot and the form parts join with #216.

import { GIANT_SPECIES, tierEntryOf } from '@evolution/shared';
import {
  CHLOROPLASTS_BY_TIER,
  FOOD_VACUOLES_BY_TIER,
  GIANT_AMOEBA_DIGESTIVE_VACUOLE_COUNT,
  GIANT_DIATOM_PLASTID_COUNT,
  LIPID_DROPLET,
  MITOCHONDRIA_BY_TIER,
  ORGANELLE_KIND,
  PROTOCELL_GRANULE_COUNT,
  TOXIN_VACUOLES_BY_TIER,
  type OrganelleKind,
} from '../constants';
import type { CellTraitSummary } from './cell-traits';

/** The kinds that anchor the nucleus offset and drift: the nucleus, or the nucleoid before the envelope. */
export const NUCLEUS_KINDS: ReadonlySet<OrganelleKind> = new Set([ORGANELLE_KIND.nucleus, ORGANELLE_KIND.nucleoid]);

/** Layout order: the nucleus first (it anchors the keep-out), then the organelles by prominence. */
export const ORGANELLE_KIND_ORDER: readonly OrganelleKind[] = [
  ORGANELLE_KIND.nucleus,
  ORGANELLE_KIND.nucleoid,
  ORGANELLE_KIND.toxinVacuole,
  ORGANELLE_KIND.chloroplast,
  ORGANELLE_KIND.diatomPlastid,
  ORGANELLE_KIND.mitochondrion,
  ORGANELLE_KIND.foodVacuole,
  ORGANELLE_KIND.digestiveVacuole,
  ORGANELLE_KIND.lipid,
  ORGANELLE_KIND.protocellGranule,
];

function byTier(table: readonly number[], tier: number): number {
  return tierEntryOf(table, tier) ?? 0;
}

/**
 * The giant diatom's chloroplasts are its golden-brown plastids, a fixed handful at any tier (docs/ecology/giants.md
 * §3.5.11): (chloroplasts, plastids).
 */
function photosynthesisCounts(traits: CellTraitSummary): readonly [number, number] {
  const chloroplasts = byTier(CHLOROPLASTS_BY_TIER, traits.tierOf('chloroplast'));
  if (traits.giantSpecies !== GIANT_SPECIES.diatom || chloroplasts === 0) return [chloroplasts, 0];
  return [0, GIANT_DIATOM_PLASTID_COUNT];
}

/** Only the giant amoeba shows its prey being digested (docs/ecology/giants.md §3.5.11, the mockup's two pools). */
const NO_DIGESTIVE_VACUOLES = 0;

/** How many of each kind the cell shows: granules for a protocell, the nucleoid until the envelope, then the nucleus. */
export function organelleCounts(traits: CellTraitSummary): Readonly<Record<OrganelleKind, number>> {
  const hasNucleoid = !traits.isProtocell && !traits.hasNucleus;
  const [chloroplasts, plastids] = photosynthesisCounts(traits);
  return {
    [ORGANELLE_KIND.nucleus]: traits.hasNucleus ? 1 : 0,
    [ORGANELLE_KIND.nucleoid]: hasNucleoid ? 1 : 0,
    [ORGANELLE_KIND.mitochondrion]: byTier(MITOCHONDRIA_BY_TIER, traits.tierOf('mitochondrion')),
    [ORGANELLE_KIND.chloroplast]: chloroplasts,
    [ORGANELLE_KIND.diatomPlastid]: plastids,
    [ORGANELLE_KIND.foodVacuole]: byTier(FOOD_VACUOLES_BY_TIER, traits.tierOf('food_vacuole')),
    [ORGANELLE_KIND.digestiveVacuole]:
      traits.giantSpecies === GIANT_SPECIES.amoeba ? GIANT_AMOEBA_DIGESTIVE_VACUOLE_COUNT : NO_DIGESTIVE_VACUOLES,
    [ORGANELLE_KIND.toxinVacuole]: byTier(TOXIN_VACUOLES_BY_TIER, traits.tierOf('toxin_vacuole')),
    [ORGANELLE_KIND.lipid]: traits.isProtocell ? 0 : LIPID_DROPLET.count,
    [ORGANELLE_KIND.protocellGranule]: traits.isProtocell ? PROTOCELL_GRANULE_COUNT : 0,
  };
}
