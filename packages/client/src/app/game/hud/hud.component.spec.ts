import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUND_PHASE, createTestSnapshot } from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import {
  UI_REFERENCE_VIEWPORT_HEIGHT_PX,
  UI_REFERENCE_VIEWPORT_WIDTH_PX,
  UI_SCALE_MIN,
} from '../../ui-kit/ui-kit-constants';
import { HudComponent } from './hud.component';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';
import { HUD_NOTICE_ROWS_VARIABLE } from './format/hud-css-variables';
import { UI_SCALE_VARIABLE } from '../../ui-kit/format/ui-css-variables';

/** jsdom lays nothing out, so the host's box is the one fact the shell needs stubbed. */
function stubHostBox(host: HTMLElement, widthPx: number, heightPx: number): void {
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    width: widthPx,
    height: heightPx,
    left: 0,
    top: 0,
    right: widthPx,
    bottom: heightPx,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('HudComponent', () => {
  let fixture: ComponentFixture<HudComponent>;
  let multiplayer: MultiplayerService;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HudComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    fixture = TestBed.createComponent(HudComponent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts the overlay with the chrome of docs/ui/hud.md §3.1.1 and the status mirror of §3.1.4', () => {
    fixture.detectChanges();
    expect(host().dataset['testid']).toBe(HUD_TEST_ID.hud);
    expect(host().querySelector('app-leaderboard-panel')).not.toBeNull();
    expect(host().querySelector('app-round-timer')).not.toBeNull();
    expect(host().querySelector('app-own-cell-status')).not.toBeNull();
    expect(host().querySelector(testIdSelector(HUD_TEST_ID.leaderboard))).not.toBeNull();
  });

  it('stands the board down for the results phase, and brings it back when a round follows', () => {
    fixture.detectChanges();
    expect(host().querySelector(testIdSelector(HUD_TEST_ID.leaderboard))).not.toBeNull();

    multiplayer.snapshot.set(createTestSnapshot({ roundPhase: ROUND_PHASE.results }));
    fixture.detectChanges();
    expect(host().querySelector(testIdSelector(HUD_TEST_ID.leaderboard))).toBeNull();
    // The mirror is not phase-gated: it stands down on its own when there is no own cell, and a
    // screen-reader user is owed the final state rather than sudden silence (docs/ui/hud.md §3.1.4).
    expect(host().querySelector('app-own-cell-status')).not.toBeNull();

    multiplayer.snapshot.set(createTestSnapshot({ roundPhase: ROUND_PHASE.playing }));
    fixture.detectChanges();
    expect(host().querySelector(testIdSelector(HUD_TEST_ID.leaderboard))).not.toBeNull();
  });

  it('publishes --ui-scale and the rest of the custom properties from its own box', () => {
    stubHostBox(host(), UI_REFERENCE_VIEWPORT_WIDTH_PX, UI_REFERENCE_VIEWPORT_HEIGHT_PX);
    fixture.detectChanges();
    expect(host().style.getPropertyValue(UI_SCALE_VARIABLE)).toBe('1');
    expect(host().style.getPropertyValue('--hud-margin')).not.toBe('');
    expect(host().style.getPropertyValue('--ui-type-clock')).not.toBe('');
  });

  it('clamps the scale on a small viewport', () => {
    stubHostBox(host(), 400, 300);
    fixture.detectChanges();
    expect(host().style.getPropertyValue(UI_SCALE_VARIABLE)).toBe(String(UI_SCALE_MIN));
  });

  it('publishes how many notice rows are up, so the top-anchored chrome drops under them (#219)', () => {
    multiplayer.connected.set(true);
    fixture.detectChanges();
    expect(host().style.getPropertyValue(HUD_NOTICE_ROWS_VARIABLE)).toBe('0');

    multiplayer.connected.set(false);
    multiplayer.lastError.set('nope');
    fixture.detectChanges();
    expect(host().style.getPropertyValue(HUD_NOTICE_ROWS_VARIABLE)).toBe('2');
    expect(host().querySelector('.connection-lost-dim')).not.toBeNull();
  });

  it('stops observing its box on destroy', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    fixture.detectChanges();
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
