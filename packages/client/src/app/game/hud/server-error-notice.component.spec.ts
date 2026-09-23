import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MultiplayerService } from '../../services/multiplayer.service';
import {
  SERVER_ERROR_CAPTION,
  SERVER_ERROR_DISMISS_LABEL,
  ServerErrorNoticeComponent,
} from './server-error-notice.component';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';

describe('ServerErrorNoticeComponent', () => {
  let fixture: ComponentFixture<ServerErrorNoticeComponent>;
  let multiplayer: MultiplayerService;

  function query(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(testId));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ServerErrorNoticeComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    fixture = TestBed.createComponent(ServerErrorNoticeComponent);
  });

  it('shows nothing without an error', () => {
    fixture.detectChanges();
    expect(query(HUD_TEST_ID.serverError)).toBeNull();
  });

  it('shows the server’s words as an alert, captioned as the lobby captions them', () => {
    multiplayer.lastError.set('Game is full');
    fixture.detectChanges();
    const notice = query(HUD_TEST_ID.serverError);
    expect(notice?.getAttribute('role')).toBe('alert');
    expect(notice?.textContent).toContain(`${SERVER_ERROR_CAPTION} Game is full`);
    expect(query(HUD_TEST_ID.serverErrorDismiss)?.getAttribute('aria-label')).toBe(SERVER_ERROR_DISMISS_LABEL);
  });

  it('replaces an older error with the newest', () => {
    multiplayer.lastError.set('first');
    fixture.detectChanges();
    multiplayer.lastError.set('second');
    fixture.detectChanges();
    expect(query(HUD_TEST_ID.serverError)?.textContent).toContain('second');
    expect(query(HUD_TEST_ID.serverError)?.textContent).not.toContain('first');
  });

  it('goes away when dismissed, and clears the error for the lobby too', () => {
    multiplayer.lastError.set('nope');
    fixture.detectChanges();
    query(HUD_TEST_ID.serverErrorDismiss)?.click();
    fixture.detectChanges();
    expect(query(HUD_TEST_ID.serverError)).toBeNull();
    expect(multiplayer.lastError()).toBeNull();
  });
});
