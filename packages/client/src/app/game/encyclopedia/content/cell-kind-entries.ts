// The cell kinds' copy (docs/architecture/encyclopedia.md §12.6; docs/ecology/wild-cells.md §3.3, docs/PROGRESSION.md
// §5): the player's cell and the wild cells the world clock grows. No number and no arithmetic here (lint).

import { CELL_KIND, type CellKind } from '@evolution/shared';
import { PREVIEW_MOTION, PREVIEW_SCENE } from '../../render/preview/preview-spec';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import type { WrittenEntryContent } from '../model/entry';
import { STARTING_MASS_FACT, STARTING_SPEED_FACT, balanceFact } from './fact-builders';

export const CELL_KIND_ENTRY_CONTENT: Readonly<Record<CellKind, WrittenEntryContent>> = {
  player: {
    title: 'Player cell',
    summary:
      'A cell steered by a player, yours among them. Players who start the round start as a [[stage:protocell]] of {startingMass}, and grow by eating, engulfing and picking traits. Anyone who joins late, or returns after being engulfed, enters at {entryShare} of the [[world:world_clock|world’s]] average mass, at most {entryMaxMass}, and at least at the world’s level. An engulfed player watches its killer for {respawnDelay} first, and keeps its level and traits.',
    facts: [
      STARTING_MASS_FACT,
      STARTING_SPEED_FACT,
      balanceFact(
        { key: 'entryShare', label: 'Late entry mass, of the world’s', unit: QUANTITY_UNIT.share },
        balancePath('progression', 'ENTRY_MASS_FRACTION'),
      ),
      balanceFact(
        { key: 'entryMaxMass', label: 'Late entry mass, at most', unit: QUANTITY_UNIT.mass },
        balancePath('progression', 'ENTRY_MAX_MASS'),
      ),
      balanceFact(
        { key: 'respawnDelay', label: 'Wait before returning', unit: QUANTITY_UNIT.seconds },
        balancePath('session', 'RESPAWN_SPECTATE_SECONDS'),
      ),
    ],
    sections: [],
    seeAlso: ['concept:mass_and_size', 'concept:score', 'cell_kind:wild'],
    preview: { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.player, traits: [], motion: PREVIEW_MOTION.swimming },
  },
  wild: {
    title: 'Wild cell',
    summary:
      'The world’s average cell made flesh. {wildCount} of them share the dish all round. They grow with the [[world:world_clock|world clock]], not by eating, each within {massSpread} of the world’s average mass, and they never decay. They wander, flee what can eat them and, later in the round, hunt what they can eat. Engulfing one pays {wildDnaShare} of the DNA a cell at the world’s level has earned, but no score bonus. An engulfed wild cell returns after {wildRespawn}.',
    facts: [
      balanceFact(
        { key: 'wildCount', label: 'Wild cells in the dish', unit: QUANTITY_UNIT.count },
        balancePath('wildCells', 'WILD_CELL_COUNT'),
      ),
      balanceFact(
        { key: 'massSpread', label: 'Mass spread around the world’s', unit: QUANTITY_UNIT.share },
        balancePath('wildCells', 'WILD_CELL_MASS_SPREAD'),
      ),
      balanceFact(
        { key: 'wildDnaShare', label: 'DNA paid when engulfed, of the world’s', unit: QUANTITY_UNIT.share },
        balancePath('absorption', 'ENGULF_DNA_SHARE'),
      ),
      balanceFact(
        { key: 'wildRespawn', label: 'Returns after', unit: QUANTITY_UNIT.seconds },
        balancePath('wildCells', 'WILD_CELL_RESPAWN_SECONDS'),
      ),
    ],
    sections: [],
    seeAlso: ['concept:world_standing', 'concept:engulf_ratio', 'cell_kind:player'],
    preview: { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.wild, traits: [], motion: PREVIEW_MOTION.swimming },
  },
};
