import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ManualScheduler, SNAPSHOT_STALE_MS, createTestSnapshot } from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { WebSocketService } from '../../services/websocket.service';
import { SCHEDULER } from '../clock-provider';
import { CONNECTION_STATE } from './connection-state';
import { ConnectionStateService } from './connection-state.service';

describe('ConnectionStateService (docs/ui/overlays.md §3.6)', () => {
  let scheduler: ManualScheduler;
  let transport: WebSocketService;
  let multiplayer: MultiplayerService;
  let connection: ConnectionStateService;
  let tick = 0;

  /** A snapshot arrives and change detection runs, which is when the stale wait restarts. */
  function receiveSnapshot(): void {
    tick += 1;
    multiplayer.snapshot.set(createTestSnapshot({ tick }));
    TestBed.tick();
  }

  beforeEach(() => {
    scheduler = new ManualScheduler();
    TestBed.configureTestingModule({ providers: [{ provide: SCHEDULER, useValue: scheduler }] });
    transport = TestBed.inject(WebSocketService);
    multiplayer = TestBed.inject(MultiplayerService);
    connection = TestBed.inject(ConnectionStateService);
    transport.connected.set(true);
    TestBed.tick();
  });

  it('is connected in the lobby however long it lasts: with no room there is nothing to wait for', () => {
    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS);
    expect(connection.state()).toBe(CONNECTION_STATE.connected);
  });

  it('turns stale once no snapshot has come for SNAPSHOT_STALE_MS, and fresh on the next one', () => {
    receiveSnapshot();
    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS - 1);
    expect(connection.state()).toBe(CONNECTION_STATE.connected);
    scheduler.advanceMilliseconds(1);
    expect(connection.state()).toBe(CONNECTION_STATE.stale);
    receiveSnapshot();
    expect(connection.state()).toBe(CONNECTION_STATE.connected);
  });

  it('never goes stale while snapshots keep coming', () => {
    receiveSnapshot();
    for (let arrival = 0; arrival < 3; arrival += 1) {
      scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS - 1);
      receiveSnapshot();
    }
    expect(connection.state()).toBe(CONNECTION_STATE.connected);
    // The wait was armed all along: once the snapshots stop, it runs out.
    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS);
    expect(connection.state()).toBe(CONNECTION_STATE.stale);
  });

  it('cancels a pending wait when the injector is destroyed', () => {
    receiveSnapshot();
    expect(scheduler.pendingCallCount).toBe(1);
    TestBed.resetTestingModule();
    expect(scheduler.pendingCallCount).toBe(0);
  });

  it('says disconnected, not stale, while the socket is down, and waits afresh once it reopens', () => {
    receiveSnapshot();
    transport.connected.set(false);
    TestBed.tick();
    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS);
    expect(connection.state()).toBe(CONNECTION_STATE.disconnected);

    transport.connected.set(true);
    TestBed.tick();
    expect(connection.state()).toBe(CONNECTION_STATE.connected);
    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS);
    expect(connection.state()).toBe(CONNECTION_STATE.stale);
  });
});
