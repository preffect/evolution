import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  ZONE_ID,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  entityId,
  playerId,
  type CellView,
  type MassFlowView,
  type OwnProgressView,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MASS_TREND } from '../state/mass-trend';
import { MODIFIER_EFFECT } from '../quantities/modifier-labels';
import { MultiplayerService } from '../../services/multiplayer.service';
import { AffectingPanelComponent } from './affecting-panel.component';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID, affectingTraitTestId, testIdSelector } from '../test-ids/hud-test-ids';

const OWN_PLAYER_ID = playerId('player-me');
const OWN_CELL_ID = entityId('c-own');
const OWN_MASS = 312;
const MITOCHONDRION = 'mitochondrion';
const FIRST_TIER = 1;

const massFlow: MassFlowView = {
  ratesPerSecond: { decay: -0.5 },
  zone: ZONE_ID.warmVent,
};

describe('AffectingPanelComponent', () => {
  let fixture: ComponentFixture<AffectingPanelComponent>;
  let multiplayer: MultiplayerService;
  let hudState: HudStateService;

  function panel(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.affectingPanel));
  }

  /** Puts a live own cell in the room; the board is opened separately, since that is what shows the panel. */
  function show(cell: Partial<CellView> = {}, progress: Partial<OwnProgressView> = {}): void {
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.sessionConfig.set(createTestSessionConfig());
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [
          createTestCellView({
            id: OWN_CELL_ID,
            playerId: OWN_PLAYER_ID,
            mass: OWN_MASS,
            traits: [{ traitId: MITOCHONDRION, tier: FIRST_TIER }],
            ...cell,
          }),
        ],
        ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, massFlow, ...progress }),
      }),
    );
    fixture.detectChanges();
  }

  function holdTab(): void {
    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();
  }

  /**
   * Whether the panel's stylesheet gives `app-trait-glyph` a width. The glyph fills its host and is sized by
   * whoever mounts it, so this rule is the whole difference between a drawn marker and a 0 x 0 one.
   */
  function sizesTheTraitGlyph(): boolean {
    return styleRules().some((rule) => rule.selectorText.includes('app-trait-glyph') && rule.style.width.length > 0);
  }

  /**
   * Whether any rule the panel ships selects on `fragment`, used to pin a CSS literal to the enum behind it.
   * Quotes are stripped from both sides: the stylesheet is authored with `'…'` and read back with `"…"`.
   */
  function hasRuleSelecting(fragment: string): boolean {
    const unquoted = (text: string): string => text.replaceAll(`'`, '').replaceAll('"', '');
    return styleRules().some((rule) => unquoted(rule.selectorText).includes(unquoted(fragment)));
  }

  function styleRules(): readonly CSSStyleRule[] {
    return [...document.styleSheets].flatMap((sheet) =>
      [...sheet.cssRules].filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule),
    );
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AffectingPanelComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    hudState = TestBed.inject(HudStateService);
    fixture = TestBed.createComponent(AffectingPanelComponent);
    fixture.detectChanges();
  });

  it('draws nothing while the board is shut: it opens and closes with the full leaderboard', () => {
    show();
    expect(panel()).toBeNull();
  });

  it('opens while the board is held open, and closes again on the release', () => {
    show();
    holdTab();
    expect(panel()).not.toBeNull();

    hudState.setFullLeaderboardHeld(false);
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('is the kit side panel, so it and the ESC menu are one family (components-and-constants.md §10.2)', () => {
    show();
    holdTab();
    expect(panel()?.getAttribute('data-variant')).toBe('side');
    expect(panel()?.getAttribute('role')).toBe('region');
    expect(panel()?.getAttribute('aria-label')).toBe('Affecting you');
  });

  it('holds nothing focusable: Tab is being held, so focus stays where it was', () => {
    show();
    holdTab();
    const focusable = panel()?.querySelectorAll('button, a[href], input, select, textarea, [tabindex]');
    expect(focusable?.length).toBe(0);
  });

  it('carries the mass element and the world standing, the two rows the acceptance run reads', () => {
    show();
    holdTab();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector(testIdSelector(HUD_TEST_ID.affectingMass))).not.toBeNull();
    expect(host.querySelector(`[data-row-id="${HUD_TEST_ID.affectingWorld}"]`)).not.toBeNull();
  });

  it('drives the falling-mass cue off MASS_TREND, so a rename cannot leave it green and pointing up', () => {
    show();
    holdTab();
    const mass = (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.affectingMass));
    // The element publishes the trend as the enum's own value...
    expect(Object.values(MASS_TREND)).toContain(mass?.getAttribute('data-trend'));
    // ...and the stylesheet's fall rule selects on that same value. These are the two halves of one cue: if the
    // enum is renamed and the selector is not, a falling mass renders in the gain colour with the triangle still
    // pointing up — the wrong direction and the wrong colour, with nothing else failing.
    expect(hasRuleSelecting(`[data-trend='${MASS_TREND.down}']`)).toBe(true);
  });

  it('marks an owned trait row with that trait glyph rather than a dot, at a size that actually draws', () => {
    show();
    holdTab();
    const row = (fixture.nativeElement as HTMLElement).querySelector(
      `[data-row-id="${affectingTraitTestId(MITOCHONDRION)}"]`,
    );
    expect(row).not.toBeNull();
    const glyph = row?.querySelector(`app-trait-glyph[data-trait-id="${MITOCHONDRION}"] svg`);
    expect(glyph).not.toBeNull();
    // Presence alone is a false green: `TraitGlyphComponent` fills its host and leaves the sizing to the caller,
    // so before the panel gave it a box it sat at 0 x 0 inside the kit's shrink-to-content marker cell and drew
    // nothing at all. jsdom lays nothing out and cannot resolve `calc(var(…))`, so this pins the rule that sizes
    // it — the thing whose absence was the defect — rather than a measured box.
    expect(sizesTheTraitGlyph()).toBe(true);
  });

  /** #453: Mitochondrion's `−15 % mass decay` sits in the column beside costs that also read with a minus. */
  it('marks an owned trait row’s value with its effect on the cell, so its minus is not read as a cost', () => {
    show();
    holdTab();
    const row = (fixture.nativeElement as HTMLElement).querySelector(
      `[data-row-id="${affectingTraitTestId(MITOCHONDRION)}"]`,
    );
    const mark = row?.querySelector<HTMLElement>('.trait-effect ui-effect-mark');
    expect(mark?.dataset['effect']).toBe(MODIFIER_EFFECT.benefit);
    expect(row?.querySelector('.trait-effect')?.textContent?.trim()).toMatch(/^−/);
  });

  /** #630: the value wraps in the panel's narrow column, and the mark must not be left behind on the line above. */
  it('holds the effect mark and the value’s whole quantity together, and lets only the words after it wrap', () => {
    show();
    holdTab();
    const row = (fixture.nativeElement as HTMLElement).querySelector(
      `[data-row-id="${affectingTraitTestId(MITOCHONDRION)}"]`,
    );
    const value = row?.querySelector('.value')?.textContent?.trim() ?? '';
    const held = row?.querySelector('.trait-effect');
    // `−15 % mass decay`: the unbreakable lead is the bound quantity, and the words follow it outside the held span.
    expect(held?.querySelector('ui-effect-mark')).not.toBeNull();
    expect(held?.textContent?.trim()).toBe(value.split(' ')[0]);
    expect(held?.textContent?.trim()).toMatch(/^−\d+\u00a0%$/);
    expect(value.length).toBeGreaterThan(held?.textContent?.trim().length ?? 0);
    expect(row?.closest('table')?.hasAttribute('data-wrap-values')).toBe(true);
  });

  it('stands down while spectating: there is no cell to describe', () => {
    show({}, { lifeState: PLAYER_LIFE_STATE.spectating });
    holdTab();
    expect(panel()).toBeNull();
  });

  it('waits for the room config rather than guessing a round length for the world clock', () => {
    show();
    multiplayer.sessionConfig.set(null);
    holdTab();
    expect(panel()).toBeNull();
  });
});
