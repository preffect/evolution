// Integration (docs/TESTING.md §2): `debug_set_player` on a paused room of the real Evolution module
// republishes the frame the client draws from, so the stage the tool reports and the stage the
// snapshot carries never disagree (#236; docs/ARCHITECTURE.md §8).
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, SERVER_MESSAGE_TYPE, type GameSnapshot } from '@evolution/shared';
import { registerPlayerTools } from './player.js';
import { registerRoomLoopTools } from './room-loop.js';
import { evolutionModuleFactory } from '../../game/evolution-module.js';
import { createActiveRoomFixture, parseToolJson } from '../../testing/builders.js';

/** The level set alongside the traits; the stage comes from the gating trait (`stageOf`), never from the level. */
const LEVEL_SET_WITH_TRAITS = 5;
const TRAITS_INCLUDING_THE_EUKARYOTE_GATE = ['nucleoid', 'ribosomes', 'mitochondrion', 'nuclear_envelope'];

function evolutionFixture() {
  const fixture = createActiveRoomFixture({ gameFactory: evolutionModuleFactory });
  registerPlayerTools(fixture.mcp, fixture.context);
  registerRoomLoopTools(fixture.mcp, fixture.context);
  const snapshotsSentToAlice = () =>
    fixture.sent['alice']!.filter(
      (message): message is { type: string; snapshot: GameSnapshot } =>
        (message as { type: string }).type === SERVER_MESSAGE_TYPE.gameSnapshot,
    );
  return { ...fixture, snapshotsSentToAlice };
}

describe('debug_set_player on a paused room', () => {
  it('republishes a same-tick snapshot whose cell carries the stage the tool reports', async () => {
    const fixture = evolutionFixture();
    await fixture.call('debug_pause_room', { gameId: fixture.gameId });
    const before = fixture.snapshotsSentToAlice().length;

    await fixture.call('debug_set_player', {
      gameId: fixture.gameId,
      playerId: 'alice',
      level: LEVEL_SET_WITH_TRAITS,
      traits: TRAITS_INCLUDING_THE_EUKARYOTE_GATE,
    });
    const progress = parseToolJson(
      await fixture.call('debug_get_player_progress', { gameId: fixture.gameId, playerId: 'alice' }),
    ) as { stage: string };
    expect(progress.stage).toBe(CELL_STAGE.eukaryote);

    const snapshots = fixture.snapshotsSentToAlice();
    expect(snapshots).toHaveLength(before + 1);
    const republished = snapshots[snapshots.length - 1]!.snapshot;
    expect(republished.tick).toBe(fixture.room.getTickCount());
    const cell = republished.cells.find((candidate) => candidate.playerId === 'alice')!;
    expect(cell.stage).toBe(CELL_STAGE.eukaryote);
    expect(cell.level).toBe(LEVEL_SET_WITH_TRAITS);
    expect(cell.traits.map((trait) => trait.traitId)).toEqual(TRAITS_INCLUDING_THE_EUKARYOTE_GATE);
    fixture.stop();
  });
});
