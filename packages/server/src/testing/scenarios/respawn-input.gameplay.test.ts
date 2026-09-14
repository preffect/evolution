// docs/game-design/constants-and-acceptance.md §13 G8b (#346): a respawned cell keeps its null target
// (docs/ecology/mass-and-movement.md §5.2) until an input its client built after seeing it arrives. The client
// learns of the respawn at least one broadcast late, so the inputs it sent while spectating are still in
// flight when the cell is placed; they carry no target (docs/architecture/wire-contract.md §4) and steer nothing.

import { describe, it } from 'vitest';
import { DEFAULT_BALANCE, TICK_HZ } from '@evolution/shared';
import type { EvolutionScenarioSnapshot } from '../gameplay/evolution-adapter.js';
import { cellOf, speedOf } from '../gameplay/evolution-views.js';
import { player, type PlayerCommand, type PlayerScript } from '../gameplay/index.js';
import { targetRadiiEast } from '../gameplay/scripts.js';
import { E9_PAYOUT_TICK, engulfPair } from './engulf-setups.js';
import { FULL_THROTTLE_RADII, SPEED_TOLERANCE_WU_PER_SECOND, blendedSpeed } from './shared-setups.js';

const { growth, session } = DEFAULT_BALANCE;
const RESPAWN_TICK = E9_PAYOUT_TICK + session.RESPAWN_SPECTATE_SECONDS * TICK_HZ + 1;
/** The client acts on the snapshot this many ticks old: the stale inputs apply on the ticks after the respawn. */
const CLIENT_SNAPSHOT_LAG_TICKS = 2;
const FIRST_SEEN_INPUT_TICK = RESPAWN_TICK + CLIENT_SNAPSHOT_LAG_TICKS + 1;
/** What the client sends with no own cell (`game-input-builder.ts`): no target, no sprint. */
const SPECTATING_COMMAND: PlayerCommand = {};

/** B as a client that lags the server: idle while alive (the E9 engulf), spectating, then steering east once it sees its new cell. */
const laggingClient: PlayerScript<EvolutionScenarioSnapshot> = (context) => {
  const seenTick = context.tick - CLIENT_SNAPSHOT_LAG_TICKS;
  if (seenTick < E9_PAYOUT_TICK) {
    return null;
  }
  return seenTick < RESPAWN_TICK ? SPECTATING_COMMAND : targetRadiiEast(FULL_THROTTLE_RADII)(context);
};

describe('game-design/constants-and-acceptance.md §13: respawn input', () => {
  it('G8b: the inputs sent while spectating do not steer the respawned cell; the first input after it does', async () => {
    let row = engulfPair('G8b').from(1, player(1).does(laggingClient)).advance(FIRST_SEEN_INPUT_TICK);
    for (let tick = RESPAWN_TICK; tick < FIRST_SEEN_INPUT_TICK; tick += 1) {
      row = row
        .expect(`B at rest on tick ${tick}`, (view) => speedOf(view, 1))
        .atTick(tick)
        .toBe(0);
    }
    await row
      .expect('B swims east once its first post-respawn input applies', (view) => cellOf(view, 1)?.velocityX)
      .atTick(FIRST_SEEN_INPUT_TICK)
      .toBeCloseTo(blendedSpeed(growth.CELL_BASE_SPEED, 1), SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('and only east', (view) => cellOf(view, 1)?.velocityY)
      .atTick(FIRST_SEEN_INPUT_TICK)
      .toBe(0)
      .runDeterministic();
  });
});
