// docs/architecture/encyclopedia.md §12.9: the registry over a real room. A `game_state` off a (fake) socket goes
// through the multiplayer service and `GameStateService` into `EncyclopediaContextService`; every registry entry
// resolves over it, and a `balance_updated` patch moves the resolved values. With no room the entries resolve over
// `DEFAULT_BALANCE`.

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  playerId,
  type BalanceConfig,
  type ServerMessage,
} from '@evolution/shared';
import { FakeWebSocket } from '../../../testing/fake-websocket';
import { IdentityService } from '../../services/identity.service';
import { MultiplayerService } from '../../services/multiplayer.service';
import { WebSocketService } from '../../services/websocket.service';
import { EncyclopediaContextService } from './encyclopedia-context';
import type { ResolvedEntry } from './model/entry';
import { ENCYCLOPEDIA_ENTRIES, resolveEntry } from './registry';

const OWN_PLAYER_ID = playerId('player-me');

function gameStateMessage(balance: BalanceConfig): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: gameId('room'),
    playerId: OWN_PLAYER_ID,
    snapshot: createTestSnapshot(),
    balance,
    config: createTestSessionConfig(),
    playerIds: [OWN_PLAYER_ID],
    avatarAssignments: { [OWN_PLAYER_ID]: 0 },
  };
}

/** The shipped balance with the DNA tag weighting and a tier of the cilia retuned, as `debug_set_balance` leaves it. */
function retunedBalance(): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE) as BalanceConfig;
  (balance.progression as unknown as Record<string, number>)['TAG_WEIGHT_PER_POINT'] = 0.3;
  const ciliaTiers = balance.traits.TRAIT_TIERS.cilia as unknown as Record<string, number>[];
  ciliaTiers[0] = { ...ciliaTiers[0], speedMultiplier: 1.4 };
  return balance;
}

function resolveAll(service: EncyclopediaContextService): ReadonlyMap<string, ResolvedEntry> {
  return new Map(ENCYCLOPEDIA_ENTRIES.map((entry) => [entry.id, resolveEntry(entry.id, service.context())]));
}

function text(
  entries: ReadonlyMap<string, ResolvedEntry>,
  entryId: string,
  key: string,
  sectionKey?: string,
): string[] {
  const entry = entries.get(entryId);
  const facts =
    sectionKey === undefined ? entry?.facts : entry?.sections.find((section) => section.key === sectionKey)?.facts;
  return (facts ?? []).filter((fact) => fact.key === key).map((fact) => fact.text);
}

describe('the encyclopedia over a room', () => {
  let service: EncyclopediaContextService;

  function receive(message: ServerMessage): void {
    FakeWebSocket.latest().receive(JSON.stringify(message));
  }

  beforeEach(() => {
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    TestBed.configureTestingModule({ providers: [{ provide: IdentityService, useValue: { clientId: 'me' } }] });
    TestBed.inject(MultiplayerService);
    TestBed.inject(WebSocketService).connect();
    FakeWebSocket.latest().open();
    service = TestBed.inject(EncyclopediaContextService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves every entry over DEFAULT_BALANCE before a room', () => {
    expect(service.context().balance).toBe(DEFAULT_BALANCE);
    const entries = resolveAll(service);
    expect(entries.size).toBe(ENCYCLOPEDIA_ENTRIES.length);
    expect(text(entries, 'dna_tag:photic', 'weightPerPoint')).toEqual(['+10 %']);
  });

  it('resolves every entry over the room’s balance and follows a balance_updated patch', () => {
    receive(gameStateMessage(structuredClone(DEFAULT_BALANCE) as BalanceConfig));
    expect(service.context().balance).not.toBe(DEFAULT_BALANCE);
    const joined = resolveAll(service);
    expect(joined.size).toBe(ENCYCLOPEDIA_ENTRIES.length);
    expect(text(joined, 'dna_tag:photic', 'weightPerPoint')).toEqual(['+10 %']);
    expect(text(joined, 'trait:cilia', 'speedMultiplier', 'tier_1')).toEqual(['+10 %']);

    receive({ type: SERVER_MESSAGE_TYPE.balanceUpdated, balance: retunedBalance() });
    const patched = resolveAll(service);
    expect(patched.size).toBe(ENCYCLOPEDIA_ENTRIES.length);
    expect(text(patched, 'dna_tag:photic', 'weightPerPoint')).toEqual(['+30 %']);
    expect(text(patched, 'trait:cilia', 'speedMultiplier', 'tier_1')).toEqual(['+40 %']);
  });
});
