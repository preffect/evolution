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
  GIANT_SPECIES,
} from '@evolution/shared';
import { FORM_POPUP_DURATION_SECONDS, UPGRADE_POPUP_DURATION_SECONDS } from '../upgrade-popup-constants';
import { formRealLifeLine } from './form-facts';
import type { GiantSwallow } from './giant-popups';
import { UPGRADE_POPUP_KIND } from './upgrade-popup-kinds';
import { describeTierModifierEffects, describeTierModifiers } from './trait-effects';
import {
  INITIAL_UPGRADE_POPUP_MEMORY,
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
/** How long a popup is held in the hold tests: any span inside its life. */
const HELD_TICKS = 90;

/** The own cell swallowed the giant amoeba on `tick`, as the bus reported it to `seatKey`. */
function amoebaSwallowedOn(tick: number, seatKey: string = SEAT): GiantSwallow[] {
  return [{ seatKey, tick, species: GIANT_SPECIES.amoeba, dnaGained: DEFAULT_BALANCE.giants.GIANT_DNA_BONUS }];
}

const FLAGELLUM: OwnedTrait = { traitId: 'simple_flagellum' as TraitId, tier: 1 };
const FLAGELLUM_II: OwnedTrait = { traitId: 'simple_flagellum' as TraitId, tier: 2 };
const CILIA: OwnedTrait = { traitId: 'cilia' as TraitId, tier: 1 };
const PARAMECIUM: OwnedTrait = { traitId: 'paramecium_cilia' as TraitId, tier: 1 };
const PARAMECIUM_II: OwnedTrait = { traitId: 'paramecium_cilia' as TraitId, tier: 2 };

function progress(ownedTraits: OwnedTrait[], overrides: Partial<OwnProgressView> = {}): OwnProgressView {
  return createTestPlayerProgressView({ stage: CELL_STAGE.eukaryote, ownedTraits, ...overrides });
}

function sample(
  tick: number,
  ownedTraits: OwnedTrait[],
  overrides: Partial<UpgradePopupSample> = {},
): UpgradePopupSample {
  return {
    seatKey: SEAT,
    tick,
    ownProgress: progress(ownedTraits),
    traits: TRAITS,
    giantSwallows: [],
    isUpPopupHeld: false,
    ...overrides,
  };
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
    expect(popup?.effects).toEqual(describeTierModifiers(TRAITS, FLAGELLUM.traitId, 1));
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

describe('upgradePopupStepFor: a held popup (docs/ui/overlays.md §3.8, ticket #863)', () => {
  const firedTick = START_TICK + 1;

  /** A form popup up from `firedTick`, an upgrade popup queued behind it. */
  function formThenUpgrade(): UpgradePopupMemory {
    return upgradePopupStepFor(seenOnce(), sample(firedTick, [PARAMECIUM, FLAGELLUM]));
  }

  it('stops the life of the popup up while it is held, and moves the queue behind it on as far', () => {
    const fired = formThenUpgrade();
    const held = upgradePopupStepFor(
      fired,
      sample(firedTick + HELD_TICKS, [PARAMECIUM, FLAGELLUM], { isUpPopupHeld: true }),
    );
    const formEnd = firedTick + FORM_TICKS + HELD_TICKS;
    expect(held.queue.map((popup) => [popup.traitId, popup.startTick, popup.endTick])).toEqual([
      [PARAMECIUM.traitId, firedTick, formEnd],
      [FLAGELLUM.traitId, formEnd, formEnd + UPGRADE_TICKS],
    ]);
    // Keyed as fired, so the component keeps the element and its animation's place.
    expect(held.queue.map((popup) => popup.key)).toEqual(fired.queue.map((popup) => popup.key));
    // Its whole life still runs once the hold ends: up one tick before its moved end, the next one up at it.
    const lastTick = upgradePopupStepFor(held, sample(formEnd - 1, [PARAMECIUM, FLAGELLUM]));
    expect(upgradePopupUpAt(lastTick, formEnd - 1)?.traitId).toBe(PARAMECIUM.traitId);
    const after = upgradePopupStepFor(lastTick, sample(formEnd, [PARAMECIUM, FLAGELLUM]));
    expect(upgradePopupUpAt(after, formEnd)?.traitId).toBe(FLAGELLUM.traitId);
  });

  it('lets the life run while it is not held, and holds nothing with nothing up', () => {
    const fired = formThenUpgrade();
    const shown = upgradePopupStepFor(fired, sample(firedTick + HELD_TICKS, [PARAMECIUM, FLAGELLUM]));
    expect(shown.queue.map((popup) => popup.endTick)).toEqual(fired.queue.map((popup) => popup.endTick));
    const empty = upgradePopupStepFor(seenOnce(), sample(START_TICK + HELD_TICKS, [], { isUpPopupHeld: true }));
    expect(empty.queue).toEqual([]);
  });

  it('holds a giant popup fired with the picker opening for as long as the pick takes', () => {
    const fired = upgradePopupStepFor(
      seenOnce(),
      sample(firedTick, [], { giantSwallows: amoebaSwallowedOn(firedTick) }),
    );
    const longPickTick = firedTick + 2 * FORM_TICKS;
    const held = upgradePopupStepFor(fired, sample(longPickTick, [], { isUpPopupHeld: true }));
    expect(upgradePopupUpAt(held, longPickTick)?.kind).toBe(UPGRADE_POPUP_KIND.giant);
    expect(held.queue[0]?.endTick).toBe(longPickTick + FORM_TICKS);
  });
});

describe('upgradePopupStepFor: the giant popup (docs/ecology/giants.md §3.5.8)', () => {
  it('fires on the fold after the swallow, for a form popup’s life, but not on a seat’s first sample', () => {
    const tick = START_TICK + 1;
    const memory = upgradePopupStepFor(seenOnce(), sample(tick, [], { giantSwallows: amoebaSwallowedOn(tick) }));
    expect(upgradePopupUpAt(memory, tick)).toMatchObject({
      kind: UPGRADE_POPUP_KIND.giant,
      giantSpecies: GIANT_SPECIES.amoeba,
      traitId: null,
      startTick: tick,
      endTick: tick + FORM_TICKS,
    });
    const first = upgradePopupStepFor(
      INITIAL_UPGRADE_POPUP_MEMORY,
      sample(tick, [], { giantSwallows: amoebaSwallowedOn(tick) }),
    );
    expect(first.queue).toEqual([]);
  });

  it('fires a swallow that a later snapshot overtook before the fold, at the fold’s tick', () => {
    const swallowTick = START_TICK + 1;
    const foldTick = swallowTick + 1;
    const memory = upgradePopupStepFor(
      seenOnce(),
      sample(foldTick, [], { giantSwallows: amoebaSwallowedOn(swallowTick) }),
    );
    expect(memory.queue.map((popup) => [popup.kind, popup.startTick])).toEqual([[UPGRADE_POPUP_KIND.giant, foldTick]]);
  });

  it('fires once: the same tick folded again, or a later one, fires nothing, and neither does another seat’s', () => {
    const tick = START_TICK + 1;
    const giantSwallows = amoebaSwallowedOn(tick);
    const fired = upgradePopupStepFor(seenOnce(), sample(tick, [], { giantSwallows }));
    expect(upgradePopupStepFor(fired, sample(tick, [], { giantSwallows })).queue).toHaveLength(1);
    expect(upgradePopupStepFor(fired, sample(tick + 1, [], { giantSwallows })).queue).toHaveLength(1);
    const elsewhere = sample(tick, [], { giantSwallows: amoebaSwallowedOn(tick, OTHER_SEAT) });
    expect(upgradePopupStepFor(seenOnce(), elsewhere).queue).toEqual([]);
  });

  it('queues ahead of a trait gained in the same snapshot, each keyed apart', () => {
    const tick = START_TICK + 1;
    const memory = upgradePopupStepFor(
      seenOnce(),
      sample(tick, [FLAGELLUM], { giantSwallows: amoebaSwallowedOn(tick) }),
    );
    expect(memory.queue.map((popup) => [popup.kind, popup.startTick])).toEqual([
      [UPGRADE_POPUP_KIND.giant, tick],
      [UPGRADE_POPUP_KIND.upgrade, tick + FORM_TICKS],
    ]);
    expect(new Set(memory.queue.map((popup) => popup.key)).size).toBe(memory.queue.length);
  });
});
