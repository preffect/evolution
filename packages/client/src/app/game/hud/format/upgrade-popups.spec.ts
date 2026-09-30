// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  TICK_HZ,
  createTestPlayerProgressView,
  type OwnProgressView,
  type OwnedTrait,
  type TraitId,
} from '@evolution/shared';
import { FORM_POPUP_DURATION_SECONDS, UPGRADE_POPUP_DURATION_SECONDS } from '../hud-constants';
import { formRealLifeLine } from './form-facts';
import { bindQuantities } from './trait-cards';
import { describeTierModifierEffects, describeTierModifiers } from './trait-effects';
import {
  INITIAL_UPGRADE_POPUP_MEMORY,
  UPGRADE_POPUP_KIND,
  gainedTraits,
  upgradePopupStepFor,
  upgradePopupUpAt,
  type UpgradePopupMemory,
  type UpgradePopupSample,
} from './upgrade-popups';

const SEAT = 'game-1/player-me';
const OTHER_SEAT = 'game-2/player-me';
const START_TICK = 600;
const UPGRADE_TICKS = UPGRADE_POPUP_DURATION_SECONDS * TICK_HZ;
const FORM_TICKS = FORM_POPUP_DURATION_SECONDS * TICK_HZ;
const TRAITS = DEFAULT_BALANCE.traits;

const FLAGELLUM: OwnedTrait = { traitId: 'simple_flagellum' as TraitId, tier: 1 };
const FLAGELLUM_II: OwnedTrait = { traitId: 'simple_flagellum' as TraitId, tier: 2 };
const CILIA: OwnedTrait = { traitId: 'cilia' as TraitId, tier: 1 };
const PARAMECIUM: OwnedTrait = { traitId: 'paramecium_cilia' as TraitId, tier: 1 };
const PARAMECIUM_II: OwnedTrait = { traitId: 'paramecium_cilia' as TraitId, tier: 2 };

function progress(ownedTraits: OwnedTrait[], overrides: Partial<OwnProgressView> = {}): OwnProgressView {
  return createTestPlayerProgressView({ stage: CELL_STAGE.eukaryote, ownedTraits, ...overrides });
}

function sample(tick: number, ownedTraits: OwnedTrait[], overrides: Partial<UpgradePopupSample> = {}) {
  return { seatKey: SEAT, tick, ownProgress: progress(ownedTraits), traits: TRAITS, ...overrides };
}

/** A seat seen once holding `ownedTraits`: every later gain is a change against it. */
function seenOnce(ownedTraits: OwnedTrait[] = []): UpgradePopupMemory {
  return upgradePopupStepFor(INITIAL_UPGRADE_POPUP_MEMORY, sample(START_TICK, ownedTraits));
}

describe('gainedTraits', () => {
  it('reads a trait new to the cell and a tier up as gains, and a held or lowered tier as none', () => {
    expect(gainedTraits([], [FLAGELLUM])).toEqual([FLAGELLUM]);
    expect(gainedTraits([FLAGELLUM], [FLAGELLUM_II])).toEqual([FLAGELLUM_II]);
    expect(gainedTraits([FLAGELLUM_II], [FLAGELLUM])).toEqual([]);
    expect(gainedTraits([FLAGELLUM, CILIA], [CILIA, FLAGELLUM])).toEqual([]);
  });
});

describe('upgradePopupStepFor: the trigger (docs/ui/overlays.md §3.8)', () => {
  it('fires nothing on the first snapshot of a seat, however many traits it holds: a late joiner only remembers', () => {
    const memory = seenOnce([FLAGELLUM, CILIA, PARAMECIUM]);
    expect(memory.queue).toEqual([]);
    expect(upgradePopupUpAt(memory, START_TICK)).toBeNull();
  });

  it('fires an upgrade popup for a trait gained, with the card’s name, tier and toned effect lines', () => {
    const tick = START_TICK + 1;
    const popup = upgradePopupUpAt(upgradePopupStepFor(seenOnce(), sample(tick, [FLAGELLUM])), tick);
    expect(popup).toMatchObject({
      kind: UPGRADE_POPUP_KIND.upgrade,
      traitId: FLAGELLUM.traitId,
      title: 'Simple Flagellum I',
      realLifeLine: null,
      startTick: tick,
      endTick: tick + UPGRADE_TICKS,
    });
    expect(popup?.effects).toEqual(describeTierModifiers(TRAITS, FLAGELLUM.traitId, 1).map(bindQuantities));
    expect(popup?.effects.length).toBeGreaterThan(0);
    expect(popup?.effectTones).toEqual(describeTierModifierEffects(TRAITS, FLAGELLUM.traitId, 1));
  });

  it('fires an upgrade popup for a tier up, titled with the new tier', () => {
    const tick = START_TICK + 1;
    const memory = upgradePopupStepFor(seenOnce([FLAGELLUM]), sample(tick, [FLAGELLUM_II]));
    expect(upgradePopupUpAt(memory, tick)?.title).toBe('Simple Flagellum II');
  });

  it('fires the form popup, with its real-life line and the form’s longer life, when a form is gained', () => {
    const tick = START_TICK + 1;
    const popup = upgradePopupUpAt(upgradePopupStepFor(seenOnce([CILIA]), sample(tick, [CILIA, PARAMECIUM])), tick);
    expect(popup).toMatchObject({
      kind: UPGRADE_POPUP_KIND.form,
      title: 'Paramecium Cilia I',
      realLifeLine: formRealLifeLine(PARAMECIUM.traitId),
      endTick: tick + FORM_TICKS,
    });
  });

  it('gives a form’s tier up the ordinary popup: the form popup is the moment the form arrives', () => {
    const tick = START_TICK + 1;
    const memory = upgradePopupStepFor(seenOnce([PARAMECIUM]), sample(tick, [PARAMECIUM_II]));
    expect(upgradePopupUpAt(memory, tick)).toMatchObject({ kind: UPGRADE_POPUP_KIND.upgrade, realLifeLine: null });
  });

  it('fires nothing for a rematch, which empties the traits, nor for the same traits again', () => {
    const held = seenOnce([FLAGELLUM, CILIA]);
    expect(upgradePopupStepFor(held, sample(START_TICK + 1, [FLAGELLUM, CILIA])).queue).toEqual([]);
    expect(upgradePopupStepFor(held, sample(START_TICK + 1, [])).queue).toEqual([]);
  });

  it('starts over in another room, and when the tick goes back: its first snapshot only remembers', () => {
    const memory = seenOnce();
    expect(upgradePopupStepFor(memory, sample(START_TICK + 1, [FLAGELLUM], { seatKey: OTHER_SEAT })).queue).toEqual([]);
    expect(upgradePopupStepFor(memory, sample(START_TICK - 1, [FLAGELLUM])).queue).toEqual([]);
  });

  it('only remembers while the balance has not arrived, and while the room has not named the seat', () => {
    const memory = seenOnce();
    const noBalance = upgradePopupStepFor(memory, sample(START_TICK + 1, [FLAGELLUM], { traits: null }));
    expect(noBalance.queue).toEqual([]);
    expect(upgradePopupStepFor(noBalance, sample(START_TICK + 2, [FLAGELLUM])).queue).toEqual([]);
    const unnamed = upgradePopupStepFor(memory, sample(START_TICK + 1, [], { ownProgress: null }));
    expect(upgradePopupStepFor(unnamed, sample(START_TICK + 2, [FLAGELLUM])).queue).toHaveLength(1);
  });
});

describe('upgradePopupStepFor: the queue (docs/ui/overlays.md §3.8)', () => {
  it('queues two gains in one snapshot back to back, one up at a time', () => {
    const tick = START_TICK + 1;
    const memory = upgradePopupStepFor(seenOnce(), sample(tick, [FLAGELLUM, CILIA]));
    expect(memory.queue.map((popup) => [popup.traitId, popup.startTick])).toEqual([
      [FLAGELLUM.traitId, tick],
      [CILIA.traitId, tick + UPGRADE_TICKS],
    ]);
    expect(upgradePopupUpAt(memory, tick)?.traitId).toBe(FLAGELLUM.traitId);
    const second = upgradePopupStepFor(memory, sample(tick + UPGRADE_TICKS, [FLAGELLUM, CILIA]));
    expect(upgradePopupUpAt(second, tick + UPGRADE_TICKS)?.traitId).toBe(CILIA.traitId);
    expect(upgradePopupStepFor(second, sample(tick + 2 * UPGRADE_TICKS, [FLAGELLUM, CILIA])).queue).toEqual([]);
  });

  it('starts a gain fired while another is up when that one ends, and one fired later at once', () => {
    const first = upgradePopupStepFor(seenOnce(), sample(START_TICK + 1, [FLAGELLUM]));
    const soon = START_TICK + 2;
    const queued = upgradePopupStepFor(first, sample(soon, [FLAGELLUM, CILIA]));
    expect(queued.queue[1]?.startTick).toBe(START_TICK + 1 + UPGRADE_TICKS);
    expect(upgradePopupUpAt(queued, soon)?.traitId).toBe(FLAGELLUM.traitId);
    const late = START_TICK + 1 + 3 * UPGRADE_TICKS;
    const alone = upgradePopupStepFor(first, sample(late, [FLAGELLUM, CILIA]));
    expect(alone.queue.map((popup) => popup.startTick)).toEqual([late]);
  });

  it('keys every popup apart, so the component replays its animation for each', () => {
    const memory = upgradePopupStepFor(seenOnce(), sample(START_TICK + 1, [FLAGELLUM, CILIA]));
    expect(new Set(memory.queue.map((popup) => popup.key)).size).toBe(memory.queue.length);
  });
});
