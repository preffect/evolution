import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WebSocketService } from '../../services/websocket.service';
import { ConnectionBannerComponent } from './connection-banner.component';
import { CONNECTION_BANNER_TEXT, CONNECTION_STATE } from './format/connection-banner';
import { HUD_TEST_ID, testIdSelector } from './test-ids';

describe('ConnectionBannerComponent', () => {
  let fixture: ComponentFixture<ConnectionBannerComponent>;
  let transport: WebSocketService;

  function banner(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.connectionBanner));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConnectionBannerComponent] });
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
});
