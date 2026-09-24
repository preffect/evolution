// What the death overlay says (docs/ui/overlays.md §3.3), decided here so the component only binds: who engulfed
// the player, how long until the new cell, and what death kept and cost. Pure and DOM-free.

import {
  CELL_KIND,
  TICK_HZ,
  type CellView,
  type EntityId,
  type OwnProgressView,
  type PlayerRosterView,
} from '@evolution/shared';
import { STAGE_ENTRY_CONTENT } from '../../encyclopedia/content/stage-entries';
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { joinFacts } from './fact-line';

const ENGULFED = 'ENGULFED';
const ONE_TRAIT = 1;
const NO_DNA_LOST = 0;

export interface RespawnInput {
  /** The spectating player's own record: the killer's cell, the countdown and what was kept. */
  readonly ownProgress: OwnProgressView;
  readonly cells: readonly CellView[];
  readonly players: Readonly<Record<string, PlayerRosterView>>;
  /** `GameStateService.lastAliveOwnProgress`; `null` when this client never saw the player alive (a late join). */
  readonly lastAliveOwnProgress: OwnProgressView | null;
}

export interface RespawnLines {
  /** `ENGULFED BY AMOEBOID`, `ENGULFED BY A WILD PROKARYOTE`, or `ENGULFED` once the killer has gone. */
  readonly killer: string;
  /** `Respawning in 3`: whole seconds, rounded up, so the last fraction of a second still reads 1. */
  readonly countdown: string;
  /** `Level 4 and 3 traits kept · 40 DNA lost`; the loss is left out when this client cannot know it. */
  readonly kept: string;
}

/** The killer's name as the title shows it, or `null` when its cell or its player has gone. */
function killerName(
  spectatingCellId: EntityId | null,
  cells: readonly CellView[],
  players: Readonly<Record<string, PlayerRosterView>>,
): string | null {
  const killer = spectatingCellId === null ? undefined : cells.find((cell) => cell.id === spectatingCellId);
  if (killer === undefined) return null;
  if (killer.kind === CELL_KIND.wild) return `A WILD ${STAGE_ENTRY_CONTENT[killer.stage].title.toUpperCase()}`;
  const name = killer.playerId === null ? undefined : players[killer.playerId]?.playerName;
  return name === undefined ? null : name.toUpperCase();
}

function killerLine(input: RespawnInput): string {
  const name = killerName(input.ownProgress.spectatingCellId, input.cells, input.players);
  return name === null ? ENGULFED : `${ENGULFED} BY ${name}`;
}

function keptLine(input: RespawnInput): string {
  const { ownProgress, lastAliveOwnProgress } = input;
  const traitCount = ownProgress.ownedTraits.length;
  const traits = `${traitCount} ${traitCount === ONE_TRAIT ? 'trait' : 'traits'}`;
  const kept = `${formatQuantity(ownProgress.level, QUANTITY_UNIT.level)} and ${traits} kept`;
  if (lastAliveOwnProgress === null) return kept;
  const dnaLost = Math.max(
    NO_DNA_LOST,
    Math.round(lastAliveOwnProgress.dnaTowardNextLevel - ownProgress.dnaTowardNextLevel),
  );
  return joinFacts([kept, `${formatQuantity(dnaLost, QUANTITY_UNIT.dna)} lost`]);
}

export function respawnLinesFor(input: RespawnInput): RespawnLines {
  return {
    killer: killerLine(input),
    countdown: `Respawning in ${Math.ceil(input.ownProgress.respawnInTicks / TICK_HZ)}`,
    kept: keptLine(input),
  };
}
