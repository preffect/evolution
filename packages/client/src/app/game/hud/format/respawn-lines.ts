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
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { joinFacts } from './fact-line';
import { truncatePlayerName } from './player-name';

const ENGULFED = 'ENGULFED';
/** A wild cell has no name, and its stage names a step on the ladder, not a creature. */
const WILD_KILLER = 'A WILD CELL';
const NO_TRAITS = 0;
const ONE_TRAIT = 1;
/** The countdown's floor while spectating: the last tick sends 0, one tick before the new cell. */
const LAST_SECOND = 1;
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
  /** `ENGULFED BY AMOEBOID` (the name cut as everywhere else), `ENGULFED BY A WILD CELL`, or `ENGULFED` once it has gone. */
  readonly killer: string;
  /** `Respawning in 3`: whole seconds, rounded up and never below 1, so it never reads 0 while the player waits. */
  readonly countdown: string;
  /**
   * `Level 4 and 3 traits kept · 40 DNA lost`, or `Level 1 kept` without traits; the loss is left out when this client
   * cannot know it.
   */
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
  if (killer.kind === CELL_KIND.wild) return WILD_KILLER;
  const name = killer.playerId === null ? undefined : players[killer.playerId]?.playerName;
  return name === undefined ? null : truncatePlayerName(name).toUpperCase();
}

function killerLine(input: RespawnInput): string {
  const name = killerName(input.ownProgress.spectatingCellId, input.cells, input.players);
  return name === null ? ENGULFED : `${ENGULFED} BY ${name}`;
}

function keptLine(input: RespawnInput): string {
  const { ownProgress, lastAliveOwnProgress } = input;
  const traitCount = ownProgress.ownedTraits.length;
  const level = formatQuantity(ownProgress.level, QUANTITY_UNIT.level);
  const traits = `${traitCount} ${traitCount === ONE_TRAIT ? 'trait' : 'traits'}`;
  const kept = traitCount === NO_TRAITS ? `${level} kept` : `${level} and ${traits} kept`;
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
    countdown: `Respawning in ${Math.max(LAST_SECOND, Math.ceil(input.ownProgress.respawnInTicks / TICK_HZ))}`,
    kept: keptLine(input),
  };
}
