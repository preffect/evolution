// Integration (docs/testing/tiers-and-builders.md §2): a client's `client_performance` frame-budget report (ticket #256,
// docs/rendering/budget.md §7) over a real socket, through the router's schema, the lobby and the room's tracker, read
// back through `debug_get_room_performance`. The browser's side of the path — the render session's cadence, the game
// host's seam, the service's send — is pinned by `game-host.integration.spec.ts` in the client; this is the frame it
// sends, `{ type, report }`, landing where the debug tool reads it. Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  RENDER_STAGE,
  SERVER_MESSAGE_TYPE,
  createTestClientPerformanceReport,
  type ClientPerformanceReport,
} from '@evolution/shared';
import { registerPerformanceTools } from './performance.js';
import { createToolCapture, parseToolJson } from '../../testing/builders.js';
import {
  closeLobbySocketHarness,
  connectTestClient,
  startLobbySocketHarness,
  startTestRoom,
  type LobbySocketHarness,
} from '../../testing/socket-builders.js';
import { messageOfType, nextMatchingMessage, type TestClient } from '../../testing/socket-messages.js';
import { untilRoomDecides } from '../../testing/wait-for.js';
import type { GameRoom } from '../../lobby/game-room.js';

const REPORTER_ID = 'reporter';
const QUIET_ID = 'quiet';

function sendReport(client: TestClient, report: unknown): void {
  client.socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.clientPerformance, report }));
}

describe('a client_performance report over the wire (#256)', () => {
  let harness: LobbySocketHarness;

  beforeEach(async () => {
    harness = await startLobbySocketHarness();
  });

  afterEach(async () => {
    await closeLobbySocketHarness(harness);
  });

  /** A started room seating a client that reports and one that does not, and the debug tool reading the lobby. */
  async function roomWithTwoClients() {
    const reporter = await connectTestClient(harness, REPORTER_ID);
    const quiet = await connectTestClient(harness, QUIET_ID);
    const { gameId, room } = await startTestRoom(harness, reporter, 'reports', [quiet]);
    const tools = createToolCapture();
    registerPerformanceTools(tools.mcp, { lobbyManager: harness.started.lobby, connections: harness.started.connections });
    const readClientReports = async () => {
      const [stats] = parseToolJson(await tools.call('debug_get_room_performance', { gameId })) as {
        clientReports: Record<string, ClientPerformanceReport>;
      }[];
      return stats!.clientReports;
    };
    return { reporter, room, readClientReports };
  }

  function untilStored(room: GameRoom, frameTimeP95Ms: number): Promise<void> {
    return untilRoomDecides(
      () => room.performanceTracker.clientReportsSnapshot()[REPORTER_ID]?.frameTimeP95Ms === frameTimeP95Ms,
      `the room stored the report with a ${frameTimeP95Ms} ms frame p95`,
    );
  }

  it('lands in debug_get_room_performance under the player who sent it, the newest one replacing the last', async () => {
    const { reporter, room, readClientReports } = await roomWithTwoClients();
    const first = createTestClientPerformanceReport({ frameTimeP95Ms: 14, gpuMs: 3.2, drawCalls: 15 });
    sendReport(reporter, first);
    await untilStored(room, first.frameTimeP95Ms);
    expect(await readClientReports()).toEqual({ [REPORTER_ID]: first });

    const second = createTestClientPerformanceReport({ frameTimeP95Ms: 9 });
    sendReport(reporter, second);
    await untilStored(room, second.frameTimeP95Ms);
    expect(await readClientReports()).toEqual({ [REPORTER_ID]: second });
  });

  it('refuses a report missing a render stage key, the frame an older client would send, and stores nothing', async () => {
    const { reporter, readClientReports } = await roomWithTwoClients();
    const complete = createTestClientPerformanceReport();
    const { [RENDER_STAGE.dish]: _omitted, ...stagesBeforeDish } = complete.renderStagesMs;
    const firstIndex = reporter.received.length;
    sendReport(reporter, { ...complete, renderStagesMs: stagesBeforeDish });
    const refusal = await nextMatchingMessage(reporter, messageOfType(SERVER_MESSAGE_TYPE.error), firstIndex);
    expect(refusal).toMatchObject({ message: expect.stringMatching(/^Invalid message/) });
    expect(await readClientReports()).toEqual({});
  });
});
