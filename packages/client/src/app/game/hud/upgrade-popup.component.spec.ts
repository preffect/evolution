import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestSnapshot,
  GIANT_SPECIES,
  entityId,
  type OwnedTrait,
  type GameSnapshot,
  type TraitId,
} from '@evolution/shared';
import { createTestCellAbsorbedEffect, createTestCellView } from '../../../testing/builders';
import {
  PARAMECIUM,
  POPUP_OWN_AVATAR_INDEX,
  POPUP_OWN_PLAYER_ID,
  POPUP_START_TICK,
  UpgradePopupHarness,
} from '../../../testing/upgrade-popup-harness';
import { paletteFor } from '../render/palette';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { formRealLifeLine } from './format/form-facts';
import { GIANT_DISPLAY_NAME_BY_SPECIES, GIANT_REAL_LIFE_LINES } from '../giants/giant-facts';
import { GIANT_POPUP_KICKER_TEXT } from './format/giant-popups';
import { FORM_POPUP_KICKER_TEXT } from './format/upgrade-popups';
import { FORM_POPUP_DURATION_SECONDS, UPGRADE_POPUP_DURATION_SECONDS } from './upgrade-popup-constants';
import { unbroken } from '../../../testing/unbroken-quantity';

const UPGRADE_TICKS = UPGRADE_POPUP_DURATION_SECONDS * TICK_HZ;
const FORM_TICKS = FORM_POPUP_DURATION_SECONDS * TICK_HZ;
const FLAGELLUM: OwnedTrait = { traitId: 'simple_flagellum' as TraitId, tier: 1 };
const CILIA: OwnedTrait = { traitId: 'cilia' as TraitId, tier: 1 };
const OWN_CELL_ID = entityId('c-own');
const GIANT_DNA = DEFAULT_BALANCE.giants.GIANT_DNA_BONUS;

describe('UpgradePopupComponent (docs/ui/overlays.md §3.8)', () => {
  let harness: UpgradePopupHarness;

  /** A snapshot in which the own cell has just swallowed the giant diatom. */
  function diatomSwallowedAt(tick: number): GameSnapshot {
    const ownProgress = createTestPlayerProgressView({ playerId: POPUP_OWN_PLAYER_ID, stage: CELL_STAGE.eukaryote });
    const cells = [createTestCellView({ id: OWN_CELL_ID, playerId: POPUP_OWN_PLAYER_ID })];
    const swallow = createTestCellAbsorbedEffect({
      tick,
      playerId: null,
      predatorCellId: OWN_CELL_ID,
      predatorDnaGained: GIANT_DNA,
      preyGiantSpecies: GIANT_SPECIES.diatom,
    });
    return createTestSnapshot({ tick, ownProgress, cells, effects: [swallow] });
  }

  function textOf(element: HTMLElement | null, selector: string): string | undefined {
    return element?.querySelector(selector)?.textContent?.trim();
  }

  beforeEach(() => {
    harness = new UpgradePopupHarness();
  });

  it('shows nothing until a trait is gained, inside a polite live region', () => {
    expect(harness.popup(HUD_TEST_ID.upgradePopup)).toBeNull();
    expect(harness.host().querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('shows the trait’s name, tier and toned effect lines, and takes it down after its duration', () => {
    const gainTick = POPUP_START_TICK + 1;
    harness.receive(gainTick, [FLAGELLUM]);
    const shown = harness.popup(HUD_TEST_ID.upgradePopup);
    expect(shown?.getAttribute('data-trait-id')).toBe(FLAGELLUM.traitId);
    expect(shown?.querySelector('.title')?.textContent?.trim()).toBe('Simple Flagellum I');
    const effects = shown?.querySelectorAll('.effect') ?? [];
    expect(effects.length).toBeGreaterThan(0);
    expect(shown?.querySelectorAll('ui-effect-mark[data-effect]').length).toBe(effects.length);
    expect(shown?.querySelector('.real-life')).toBeNull();
    expect(shown?.querySelector('.kicker')).toBeNull();

    harness.receive(gainTick + UPGRADE_TICKS - 1, [FLAGELLUM]);
    expect(harness.popup(HUD_TEST_ID.upgradePopup)).not.toBeNull();
    harness.receive(gainTick + UPGRADE_TICKS, [FLAGELLUM]);
    expect(harness.popup(HUD_TEST_ID.upgradePopup)).toBeNull();
  });

  it('queues two picks close together: one at a time, the second when the first ends, never both', () => {
    const firstTick = POPUP_START_TICK + 1;
    harness.receive(firstTick, [FLAGELLUM]);
    harness.receive(firstTick + 1, [FLAGELLUM, CILIA]);
    expect(harness.host().querySelectorAll('.popup')).toHaveLength(1);
    expect(harness.popup(HUD_TEST_ID.upgradePopup)?.getAttribute('data-trait-id')).toBe(FLAGELLUM.traitId);

    const secondStart = firstTick + UPGRADE_TICKS;
    harness.receive(secondStart, [FLAGELLUM, CILIA]);
    expect(harness.host().querySelectorAll('.popup')).toHaveLength(1);
    expect(harness.popup(HUD_TEST_ID.upgradePopup)?.getAttribute('data-trait-id')).toBe(CILIA.traitId);
    harness.receive(secondStart + UPGRADE_TICKS, [FLAGELLUM, CILIA]);
    expect(harness.host().querySelector('.popup')).toBeNull();
  });

  it('still shows both gains when the second pick’s snapshot overtook the first before the screen refreshed', () => {
    const firstTick = POPUP_START_TICK + 1;
    const ownProgressOf = (ownedTraits: OwnedTrait[]) =>
      createTestPlayerProgressView({ playerId: POPUP_OWN_PLAYER_ID, stage: CELL_STAGE.eukaryote, ownedTraits });
    harness.deliver(createTestSnapshot({ tick: firstTick, ownProgress: ownProgressOf([FLAGELLUM]) }));
    harness.deliver(createTestSnapshot({ tick: firstTick + 1, ownProgress: ownProgressOf([FLAGELLUM, CILIA]) }));
    harness.fixture.detectChanges();
    expect(harness.popup(HUD_TEST_ID.upgradePopup)?.getAttribute('data-trait-id')).toBe(FLAGELLUM.traitId);
    harness.receive(firstTick + 1 + UPGRADE_TICKS, [FLAGELLUM, CILIA]);
    expect(harness.popup(HUD_TEST_ID.upgradePopup)?.getAttribute('data-trait-id')).toBe(CILIA.traitId);
  });

  it('shows the form popup with its real-life line in the seat colour, for the form’s longer life', () => {
    harness.receive(POPUP_START_TICK + 1, [CILIA]);
    harness.receive(POPUP_START_TICK + 1 + UPGRADE_TICKS, [CILIA]);
    const gainTick = POPUP_START_TICK + 1 + UPGRADE_TICKS + 1;
    harness.receive(gainTick, [CILIA, PARAMECIUM]);
    const shown = harness.popup(HUD_TEST_ID.formPopup);
    expect(harness.popup(HUD_TEST_ID.upgradePopup)).toBeNull();
    expect(shown?.querySelector('.kicker')?.textContent?.trim()).toBe(FORM_POPUP_KICKER_TEXT);
    expect(shown?.querySelector('.title')?.textContent?.trim()).toBe('Paramecium Cilia I');
    expect(shown?.querySelector('.real-life')?.textContent?.trim()).toBe(formRealLifeLine(PARAMECIUM.traitId));
    expect(harness.host().style.getPropertyValue('--popup-seat-colour')).toBe(paletteFor(POPUP_OWN_AVATAR_INDEX).rim);

    harness.receive(gainTick + UPGRADE_TICKS, [CILIA, PARAMECIUM]);
    expect(harness.popup(HUD_TEST_ID.formPopup)).not.toBeNull();
    harness.receive(gainTick + FORM_TICKS, [CILIA, PARAMECIUM]);
    expect(harness.popup(HUD_TEST_ID.formPopup)).toBeNull();
  });

  it('shows the giant popup as large as a form’s: the giant’s name, the DNA it paid and its real-life line', () => {
    const swallowTick = POPUP_START_TICK + 1;
    harness.deliver(diatomSwallowedAt(swallowTick));
    harness.fixture.detectChanges();
    const shown = harness.popup(HUD_TEST_ID.giantPopup);
    expect(shown).not.toBeNull();
    expect(shown?.getAttribute('data-giant-species')).toBe(GIANT_SPECIES.diatom);
    expect(shown?.hasAttribute('data-trait-id')).toBe(false);
    expect(shown?.classList.contains('form')).toBe(true);
    expect(textOf(shown, '.kicker')).toBe(GIANT_POPUP_KICKER_TEXT);
    expect(textOf(shown, '.title')).toBe(GIANT_DISPLAY_NAME_BY_SPECIES[GIANT_SPECIES.diatom]);
    expect(textOf(shown, '.effect')).toBe(unbroken(`+${GIANT_DNA} DNA`));
    expect(textOf(shown, '.real-life')).toBe(GIANT_REAL_LIFE_LINES[GIANT_SPECIES.diatom]);

    harness.receive(swallowTick + FORM_TICKS - 1, []);
    expect(harness.popup(HUD_TEST_ID.giantPopup)).not.toBeNull();
    harness.receive(swallowTick + FORM_TICKS, []);
    expect(harness.popup(HUD_TEST_ID.giantPopup)).toBeNull();
  });

  it('shows a swallow whose snapshot a later one overtook before the screen refreshed, and only once', () => {
    const swallowTick = POPUP_START_TICK + 1;
    const refreshTick = swallowTick + 1;
    harness.deliver(diatomSwallowedAt(swallowTick));
    harness.deliver(
      createTestSnapshot({
        tick: refreshTick,
        ownProgress: createTestPlayerProgressView({ playerId: POPUP_OWN_PLAYER_ID }),
      }),
    );
    harness.fixture.detectChanges();
    expect(harness.popup(HUD_TEST_ID.giantPopup)?.getAttribute('data-giant-species')).toBe(GIANT_SPECIES.diatom);

    harness.receive(refreshTick + FORM_TICKS - 1, []);
    expect(harness.host().querySelectorAll('.popup')).toHaveLength(1);
    harness.receive(refreshTick + FORM_TICKS, []);
    expect(harness.host().querySelector('.popup')).toBeNull();
    harness.receive(refreshTick + FORM_TICKS + 1, []);
    expect(harness.host().querySelector('.popup')).toBeNull();
  });

  it('shows a swallow once when the clock goes back before it, and comes back to it with no swallow since (#842)', () => {
    const swallowTick = POPUP_START_TICK + 1;
    harness.deliver(diatomSwallowedAt(swallowTick));
    harness.fixture.detectChanges();
    expect(harness.popup(HUD_TEST_ID.giantPopup)).not.toBeNull();

    // The same room's clock goes back behind the swallow, and the memory starts over.
    harness.receive(POPUP_START_TICK - 1, []);
    expect(harness.host().querySelector('.popup')).toBeNull();
    harness.receive(swallowTick, []);
    harness.receive(swallowTick + 1, []);
    expect(harness.host().querySelector('.popup')).toBeNull();
  });
});
