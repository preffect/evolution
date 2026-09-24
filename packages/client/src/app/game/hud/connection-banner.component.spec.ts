import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ManualScheduler, SNAPSHOT_STALE_MS, createTestSnapshot } from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { WebSocketService } from '../../services/websocket.service';
import { SCHEDULER } from '../clock-provider';
import { ConnectionBannerComponent } from './connection-banner.component';
import { CONNECTION_BANNER_TEXT, CONNECTION_STATE } from './format/connection-banner';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';

describe('ConnectionBannerComponent', () => {
  let fixture: ComponentFixture<ConnectionBannerComponent>;
  let transport: WebSocketService;
  let scheduler: ManualScheduler;

  function banner(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.connectionBanner));
  }

  beforeEach(() => {
    scheduler = new ManualScheduler();
    TestBed.configureTestingModule({
      imports: [ConnectionBannerComponent],
      providers: [{ provide: SCHEDULER, useValue: scheduler }],
    });
    transport = TestBed.inject(WebSocketService);
    fixture = TestBed.createComponent(ConnectionBannerComponent);
  });

  it('shows nothing while the socket is up', () => {
    transport.connected.set(true);
    fixture.detectChanges();
    expect(banner()).toBeNull();
  });

  it('says the connection is lost, as a polite status in the danger role, while the socket is down', () => {
    transport.connected.set(false);
    fixture.detectChanges();
    expect(banner()?.textContent?.trim()).toBe(CONNECTION_BANNER_TEXT.disconnected);
    expect(banner()?.getAttribute('data-connection-state')).toBe(CONNECTION_STATE.disconnected);
    expect(banner()?.getAttribute('role')).toBe('status');
    expect(banner()?.classList.contains('danger')).toBe(true);
  });

  it('clears as soon as the socket is back', () => {
    fixture.detectChanges();
    expect(banner()).not.toBeNull();
    transport.connected.set(true);
    fixture.detectChanges();
    expect(banner()).toBeNull();
  });

  it('says the server is quiet, in the level role, once the snapshots stop with the socket up', () => {
    transport.connected.set(true);
    TestBed.inject(MultiplayerService).snapshot.set(createTestSnapshot());
    fixture.detectChanges();
    expect(banner()).toBeNull();

    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS);
    fixture.detectChanges();
    expect(banner()?.textContent?.trim()).toBe(CONNECTION_BANNER_TEXT.stale);
    expect(banner()?.getAttribute('data-connection-state')).toBe(CONNECTION_STATE.stale);
    expect(banner()?.classList.contains('level-gold')).toBe(true);
    expect(banner()?.classList.contains('danger')).toBe(false);
  });
});
