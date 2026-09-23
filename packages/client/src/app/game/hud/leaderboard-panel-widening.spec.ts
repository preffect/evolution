// The full leaderboard's layout while the panel widens (docs/ui/hud.md §3.1.1, #615): settled from the panel's running
// width transition itself, so a cancelled one (a fast release and re-press, a hidden panel) never leaves it stuck. jsdom
// runs no transitions, so each case stands in the panel's `getAnimations` for the one it describes.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, createTestPlayerProgressView, createTestSnapshot, playerId } from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { HudStateService } from './hud-state.service';
import { LeaderboardPanelComponent } from './leaderboard-panel.component';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';

const PLAYERS = 3;

describe('LeaderboardPanelComponent widening', () => {
  let fixture: ComponentFixture<LeaderboardPanelComponent>;
  let multiplayer: MultiplayerService;
  let hudState: HudStateService;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function footer(): Element | null {
    return element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardFooter));
  }

  function labelStripText(): string {
    const strip = element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardLabels));
    return [...(strip?.querySelectorAll('span') ?? [])].map((label) => label.textContent).join(' ');
  }

  function showBoard(): void {
    const rows = Array.from({ length: PLAYERS }, (_unused, index) => ({
      rank: index + 1,
      playerId: playerId(`player-${index + 1}`),
      score: 10,
      mass: 7,
      level: 1,
      absorptions: 0,
    }));
    multiplayer.snapshot.set(
      createTestSnapshot({
        leaderboard: rows,
        players: Object.fromEntries(
          rows.map((row) => [row.playerId, createTestPlayerProgressView({ playerId: row.playerId })]),
        ),
      }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LeaderboardPanelComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    hudState = TestBed.inject(HudStateService);
    fixture = TestBed.createComponent(LeaderboardPanelComponent);
    fixture.detectChanges();
  });

  describe('the full layout waits for the panel to finish widening (#615)', () => {
    /** A width transition under test control: its `finished` settles when the test says so. */
    function fakeWidthTransition(): { animation: Animation; finish(): void; cancel(): void } {
      let resolve: () => void = () => undefined;
      let reject: (reason: Error) => void = () => undefined;
      const finished = new Promise<Animation>((onResolve, onReject) => {
        resolve = () => onResolve(animation);
        reject = onReject;
      });
      const animation = { transitionProperty: 'width', playState: 'running', finished } as unknown as Animation;
      return {
        animation,
        finish: () => {
          (animation as { playState: string }).playState = 'finished';
          resolve();
        },
        cancel: () => {
          (animation as { playState: string }).playState = 'idle';
          reject(new Error('cancelled'));
        },
      };
    }

    function panelElement(): HTMLElement {
      return element().querySelector<HTMLElement>('.leaderboard')!;
    }

    /** The panel reports these animations from now on, as `getAnimations` would. */
    function animating(animations: readonly Animation[]): void {
      Object.defineProperty(panelElement(), 'getAnimations', { configurable: true, value: () => animations });
    }

    function isFullLayout(): boolean {
      return panelElement().classList.contains('full-layout');
    }

    async function hold(isHeld: boolean): Promise<void> {
      hudState.setFullLeaderboardHeld(isHeld);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    beforeEach(() => {
      multiplayer.balance.set(DEFAULT_BALANCE);
      showBoard();
    });

    it('draws the full layout at once when no width transition runs (reduced motion, a remount)', async () => {
      animating([]);
      await hold(true);
      expect(isFullLayout()).toBe(true);
      expect(footer()).not.toBeNull();
    });

    it('keeps the compact columns and no footer while the width transition runs, and goes full when it ends', async () => {
      const widening = fakeWidthTransition();
      animating([widening.animation]);
      await hold(true);
      expect(isFullLayout()).toBe(false);
      expect(labelStripText()).toBe('LV SCORE');
      expect(footer()).toBeNull();
      widening.finish();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(isFullLayout()).toBe(true);
    });

    it('recovers from a cancelled transition, which fires no transitionend (a fast release and re-press)', async () => {
      const widening = fakeWidthTransition();
      animating([widening.animation]);
      await hold(true);
      animating([]);
      widening.cancel();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(isFullLayout()).toBe(true);
    });

    it('re-reads the running transition on a transition event, so an unrelated one never settles it early', async () => {
      const widening = fakeWidthTransition();
      animating([widening.animation]);
      await hold(true);
      panelElement()
        .querySelector('li, .header')
        ?.dispatchEvent(new Event('transitionend', { bubbles: true }));
      panelElement().dispatchEvent(new Event('transitioncancel'));
      fixture.detectChanges();
      expect(isFullLayout()).toBe(false);
    });

    it('drops the full layout the moment the list closes, before the panel narrows', async () => {
      animating([]);
      await hold(true);
      expect(isFullLayout()).toBe(true);
      animating([fakeWidthTransition().animation]);
      hudState.setFullLeaderboardHeld(false);
      fixture.detectChanges();
      expect(isFullLayout()).toBe(false);
      expect(footer()).toBeNull();
    });
  });
});
