// The giant cells' copy (docs/architecture/encyclopedia.md §12.6; docs/ecology/giants.md §3.5): the hunter, the grazer
// and the drifter, each in the player's words: what it eats, when it is a danger, and what it takes to swallow one. The
// title, the preview and the real-life note are the builder's (`build-entries.ts`), from the giants' one name table, the
// balance's builds and `game/giants/giant-facts.ts`. No number and no arithmetic here (lint).

import { GIANT_SPECIES, type GiantSpecies } from '@evolution/shared';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { FACT_FORMULA, GIANT_MASS } from '../facts/formula-table';
import type { WrittenEntryContent } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import type { ValueFactDefinition } from '../model/fact';
import { balanceFact, formulaFact } from './fact-builders';

/** What a giant's content file writes: its title, preview and real-life note are built from the species. */
export type GiantEntryContent = Omit<WrittenEntryContent, 'title' | 'preview' | 'realLife'>;

/** The facts every giant shows, the mass that swallows it first: the question a player brings to the page. */
function giantFacts(species: GiantSpecies): readonly ValueFactDefinition[] {
  return [
    formulaFact(
      { key: 'swallowSmallest', label: 'You swallow the smallest from', unit: QUANTITY_UNIT.mass },
      { id: FACT_FORMULA.giantSwallowMass, argument: { species, mass: GIANT_MASS.smallestBorn } },
    ),
    formulaFact(
      { key: 'swallowAny', label: 'You swallow any from', unit: QUANTITY_UNIT.mass },
      { id: FACT_FORMULA.giantSwallowMass, argument: { species, mass: GIANT_MASS.ceiling } },
    ),
    balanceFact(
      { key: 'bornMin', label: 'Smallest at birth', unit: QUANTITY_UNIT.mass },
      balancePath('giants', 'GIANT_BORN_MASS_MIN_BY_SPECIES', species),
    ),
    balanceFact(
      { key: 'bornMax', label: 'Largest at birth', unit: QUANTITY_UNIT.mass },
      balancePath('giants', 'GIANT_BORN_MASS_MAX_BY_SPECIES', species),
    ),
    balanceFact(
      { key: 'massCeiling', label: 'Grows to at most', unit: QUANTITY_UNIT.mass },
      balancePath('giants', 'GIANT_MASS_CEILING'),
    ),
    balanceFact(
      { key: 'dnaBonus', label: 'DNA for swallowing one', unit: QUANTITY_UNIT.dna },
      balancePath('giants', 'GIANT_DNA_BONUS'),
    ),
    balanceFact(
      { key: 'respawn', label: 'Comes back after', unit: QUANTITY_UNIT.seconds },
      balancePath('giants', 'GIANT_RESPAWN_SECONDS'),
    ),
  ];
}

/** Every giant is a wild cell with a species (giants.md §3.5.2), so each page sends the reader there. */
const WILD_CELL_ENTRY: EntryId = 'cell_kind:wild';

/** The hunter's own row, first on its page: the share of its mass a cell must reach before it is chased. */
const HUNT_SHARE_FACT = balanceFact(
  { key: 'huntShare', label: 'Hunts cells from, of its mass', unit: QUANTITY_UNIT.share },
  balancePath('giants', 'GIANT_HUNT_MIN_PREY_MASS_FRACTION'),
);

export const GIANT_ENTRY_CONTENT: Readonly<Record<GiantSpecies, GiantEntryContent>> = {
  [GIANT_SPECIES.amoeba]: {
    summary:
      'The dish’s hunter, and it eats only cells. While you weigh under {huntShare} of its mass it swims past you to bigger prey, but touch it and it swallows you all the same. Any heavier, and still small enough to swallow, you are its prey: it is slow, so swim away, and if it grabs you, [[action:sprint|sprint]] at once.\n\nFrom {swallowSmallest} you can swallow the smallest, and then it flees you like any [[cell_kind:wild|wild cell]]. Swallowing one pays {dnaBonus}; it comes back after {respawn}.',
    facts: [HUNT_SHARE_FACT, ...giantFacts(GIANT_SPECIES.amoeba)],
    sections: [],
    seeAlso: [WILD_CELL_ENTRY, 'concept:engulf_ratio', 'action:escape', 'trait:amoeba_pseudopods'],
  },
  [GIANT_SPECIES.paramecium]: {
    summary:
      'The dish’s grazer. It sweeps the dish fast, eating the [[food:algae|algae]], [[food:detritus|detritus]] and [[food:bacterium|bacteria]] ahead of it, and never a cell, so touching it is safe.\n\nFrom {swallowSmallest} you can swallow the smallest, but it flees you and it is quick: catch it with speed, or in a corner. Swallowing one pays {dnaBonus}; it comes back after {respawn}.',
    facts: giantFacts(GIANT_SPECIES.paramecium),
    sections: [],
    seeAlso: [WILD_CELL_ENTRY, 'food:bacterium', 'trait:paramecium_cilia'],
  },
  [GIANT_SPECIES.diatom]: {
    summary:
      'The dish’s drifter. It eats nothing at all, since it [[ability:photosynthesis|lives on light]], and never a cell, so touching it is safe.\n\nIt flees once you can swallow it, but it is too slow to outswim you. Its shell makes it the hardest giant to swallow: its [[trait:cell_wall|wall]] means you need {swallowSmallest} even for the smallest, and its [[trait:diatom_shell|spines]] may spit you out, so a try can fail. Swallowing one pays {dnaBonus}; it comes back after {respawn}.',
    facts: giantFacts(GIANT_SPECIES.diatom),
    sections: [],
    seeAlso: [WILD_CELL_ENTRY, 'trait:diatom_shell', 'ability:photosynthesis'],
  },
};
