// The hold-Tab panel's rows at the audit's worked example (docs/ui/overlays.md §3.7): mass 312 in the warm vent,
// Mitochondrion I, touching a Toxin Vacuole I cell called Nib, in bloom.
//
// Every expectation is computed from `balance` (#212) and the shared formulas — never copied from the literals the
// doc prints. The doc's `249.6`, `390` and `−50 %` are that example's values under the default balance, so a
// retuned `ENGULF_MASS_RATIO` or speed curve has to move them here the moment it lands, and a spec that typed them
// would keep passing while the panel lied.
//
// The applied rates themselves are inputs, not expectations: the server measures them and sends them (#383), so
// re-deriving the metabolism here would be a second copy of the server's rules in a client spec.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  MASS_RATE_CAUSE,
  ZONE_ID,
  createTestPlayerProgressView,
  entityId,
  maxSpeedForMass,
  playerId,
  standingAgainstWorld,
  worldElapsedSeconds,
  worldReference,
  type MassFlowView,
  type PlayerRosterView,
} from '@evolution/shared';
import { MODIFIER_EFFECT } from '../../quantities/modifier-labels';
import { createTestCellView } from '../../../../testing/builders';
import { AT_LEAST_SIGN, AT_MOST_SIGN, QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { formatQuantity } from '../../quantities/format-quantity';
import { massTrendFor } from '../../state/mass-trend';
import { ownCellIndicatorsFor } from '../../state/own-cell-indicators';
import { HUD_TEST_ID, affectingCauseTestId, affectingTraitTestId } from '../../test-ids/hud-test-ids';
import { AFFECTING_SECTION, WORLD_STANDING_WORD, affectingRowsFor, type AffectingPanel } from './affecting-rows';
import { joinFacts } from './fact-line';
import { RATE_CAUSE_LABEL, formatMassRate } from './mass-cues';
import { leadingMultiplier, roundClockStateFor } from './round-clock';
import { describeTierModifiers } from './trait-effects';
import { bindQuantities } from './trait-cards';
import { zonePillText } from './zone-pill';

const balance = DEFAULT_BALANCE;
const OWN_PLAYER = playerId('player-me');
const RIVAL_PLAYER = playerId('player-rival');
const OWN_CELL_ID = entityId('c-own');
const TOXIC_CELL_ID = entityId('c-toxic');
const RIVAL_NAME = 'Nib';

const OWN_MASS = 312;
const TOXIC_MASS = 96;
const ROUND_SECONDS = 600;
const TICK = 600;
const ROUND_START_TICK = 0;
const FOOD_GAIN_PER_SECOND = 1.1;
const MASS_RUN = [300, 306, 312];
const MITOCHONDRION = 'mitochondrion';
const TOXIN_VACUOLE = 'toxin_vacuole';
const FIRST_TIER = 1;
const TIER_INDEX = 0;
const IDENTITY = 1;
const MILLISECONDS_PER_SECOND_LOCAL = 1000;

/** The toxin the rival's tier actually drains, so the fed rate is the one that balance implies. */
const TOXIN_FRACTION = balance.traits.TRAIT_TIERS[TOXIN_VACUOLE][TIER_INDEX]?.toxinDrainFractionPerSecond ?? 0;
const TOXIN_RATE = -(OWN_MASS * TOXIN_FRACTION);
/** A stand-in for the wire's applied decay; the vent's share keeps its real relationship to it. */
const DECAY_RATE = -0.5;
const VENT_RATE = DECAY_RATE * (balance.ecology.VENT_DECAY_MULTIPLIER - IDENTITY);
const DECAY_TRAIT_SHARE =
  (balance.traits.TRAIT_TIERS[MITOCHONDRION][TIER_INDEX]?.decayMultiplier ?? IDENTITY) - IDENTITY;

/** Well inside the bloom, so the bloom row is up without sitting on its boundary. */
const SECONDS_LEFT = Math.floor((ROUND_SECONDS * (IDENTITY - balance.session.ROUND_BLOOM_START_FRACTION)) / 2);

const massFlow: MassFlowView = {
  ratesPerSecond: {
    [MASS_RATE_CAUSE.toxin]: TOXIN_RATE,
    [MASS_RATE_CAUSE.decay]: DECAY_RATE,
    [MASS_RATE_CAUSE.vent]: VENT_RATE,
  },
  decayTraitShare: DECAY_TRAIT_SHARE,
  zone: ZONE_ID.warmVent,
};

const ownCell = createTestCellView({
  id: OWN_CELL_ID,
  playerId: OWN_PLAYER,
  mass: OWN_MASS,
  traits: [{ traitId: MITOCHONDRION, tier: FIRST_TIER }],
});

/** The cell whose toxin reaches us: close enough to be the nearest, and toxic by its folded modifiers. */
const toxicCell = createTestCellView({
  id: TOXIC_CELL_ID,
  playerId: RIVAL_PLAYER,
  mass: TOXIC_MASS,
  x: 10,
  traits: [{ traitId: TOXIN_VACUOLE, tier: FIRST_TIER }],
});

const players: Readonly<Record<string, PlayerRosterView>> = {
  [OWN_PLAYER]: { playerId: OWN_PLAYER, playerName: 'Me' },
  [RIVAL_PLAYER]: { playerId: RIVAL_PLAYER, playerName: RIVAL_NAME },
};

const ownProgress = createTestPlayerProgressView({ playerId: OWN_PLAYER, massFlow });

/** A real record rather than a hand-made one, so the panel reads the same mass chip and zone the cell draws. */
function indicatorsOf(): ReturnType<typeof ownCellIndicatorsFor> {
  const massTrend = massTrendFor(null, {
    cellId: OWN_CELL_ID,
    tick: TICK,
    massFlow,
    effects: [],
  });
  return ownCellIndicatorsFor({
    ownCell,
    ownProgress,
    balance,
    threats: [],
    previewTraitId: null,
    tick: TICK,
    massTrend,
    zoneEntry: null,
  });
}

function panelAt(mass = OWN_MASS): AffectingPanel {
  const cell = { ...ownCell, mass };
  return affectingRowsFor({
    ownCell: cell,
    ownProgress,
    indicators: indicatorsOf(),
    balance,
    cells: [cell, toxicCell],
    players,
    roundClock: roundClockStateFor({
      timeLeftMs: SECONDS_LEFT * MILLISECONDS_PER_SECOND_LOCAL,
      roundPhase: 'playing',
      roundDurationSeconds: ROUND_SECONDS,
      bloomStartFraction: balance.session.ROUND_BLOOM_START_FRACTION,
      foodBloomMultiplier: balance.ecology.FOOD_BLOOM_SPAWN_MULTIPLIER,
      dnaFragmentBloomMultiplier: balance.ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER,
    }),
    tick: TICK,
    roundStartTick: ROUND_START_TICK,
    roundDurationSeconds: ROUND_SECONDS,
    masses: MASS_RUN,
    foodGainPerSecond: FOOD_GAIN_PER_SECOND,
  });
}

function rowById(panel: AffectingPanel, rowId: string) {
  return panel.sections.flatMap((section) => section.rows).find((row) => row.rowId === rowId);
}

function valueOf(panel: AffectingPanel, rowId: string): string | undefined {
  return rowById(panel, rowId)?.values[0];
}

describe('affectingRowsFor at the worked example', () => {
  it('names every cause with the thing responsible for it, at the rate the wire applied', () => {
    const panel = panelAt();
    const toxin = rowById(panel, affectingCauseTestId(MASS_RATE_CAUSE.toxin));
    expect(toxin?.name).toContain(RIVAL_NAME);
    expect(toxin?.values[0]).toBe(formatMassRate(TOXIN_RATE));

    const vent = rowById(panel, affectingCauseTestId(MASS_RATE_CAUSE.vent));
    expect(vent?.name).toContain(leadingMultiplier(balance.ecology.VENT_DECAY_MULTIPLIER));
    expect(vent?.values[0]).toBe(formatMassRate(VENT_RATE));

    // The decay row names the trait cutting it, which is `mass-cues.ts`'s choice, not a second one. It writes the
    // cut in that file's wording too (#445): the factor, as the vent row right below it writes the vent's, so the
    // two decay modifiers read in one vocabulary and neither leans on a minus sign beside the rate it sits next to.
    // Pinned whole rather than with `toContain`, so a surface that *appends* to the shared string fails here too.
    const decay = rowById(panel, affectingCauseTestId(MASS_RATE_CAUSE.decay));
    const factor = leadingMultiplier(IDENTITY + DECAY_TRAIT_SHARE);
    expect(decay?.name).toBe(joinFacts([RATE_CAUSE_LABEL[MASS_RATE_CAUSE.decay], `Mitochondrion ${factor}`]));
    expect(decay?.values[0]).toBe(formatMassRate(DECAY_RATE));
  });

  it('shows the food gain as a rate', () => {
    expect(valueOf(panelAt(), HUD_TEST_ID.affectingCauseFood)).toBe(formatMassRate(FOOD_GAIN_PER_SECOND));
  });

  it('omits a cause the wire never sent, rather than showing it as zero', () => {
    const panel = panelAt();
    expect(rowById(panel, affectingCauseTestId(MASS_RATE_CAUSE.light))).toBeUndefined();
    expect(rowById(panel, affectingCauseTestId(MASS_RATE_CAUSE.swallowed))).toBeUndefined();
  });

  it('says where the cell is, carrying the whole zone pill in the row name', () => {
    const panel = panelAt();
    const pill = zonePillText({ zone: ZONE_ID.warmVent, mass: OWN_MASS, traits: ownCell.traits, balance })!;
    const zone = rowById(panel, HUD_TEST_ID.affectingZone);
    // The facts are prose, so they belong in `body` with the name (docs/ui/overlays.md §3.7). The kit draws
    // `values` in the mono figure face and never wraps one, which cut `orange rods` off at the panel edge.
    expect(zone?.name).toBe(pill);
    expect(zone?.values).toEqual([]);
  });

  it('shows the bloom with its multipliers, both from the live balance, in the row name', () => {
    const bloom = rowById(panelAt(), HUD_TEST_ID.affectingBloom);
    expect(bloom?.name).toContain(leadingMultiplier(balance.ecology.FOOD_BLOOM_SPAWN_MULTIPLIER));
    expect(bloom?.name).toContain(leadingMultiplier(balance.ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER));
    // Same reason as the zone row: `8:02 · food ×1.5 · DNA drops ×2` is the widest line the panel draws, and in
    // the figure face it lost `ps ×2` off the end.
    expect(bloom?.values).toEqual([]);
  });

  it('reads the engulf thresholds off the ratio in balance, with the comparisons canEngulf admits', () => {
    const panel = panelAt();
    const prey = OWN_MASS / balance.absorption.ENGULF_MASS_RATIO;
    const threat = OWN_MASS * (balance.absorption.ENGULF_MASS_RATIO + ownCell.membraneRatioBonus);
    // Each figure is taken away from the player being surprised, never to the nearest decimal: the prey limit down,
    // the threat threshold up. The rule, not the implementation — a rounded expectation would pin the bug.
    expect(valueOf(panel, HUD_TEST_ID.affectingPreyBelow)).toBe(`${AT_MOST_SIGN} ${Math.floor(prey * 10) / 10}`);
    expect(valueOf(panel, HUD_TEST_ID.affectingThreatAbove)).toBe(`${AT_LEAST_SIGN} ${Math.ceil(threat * 10) / 10}`);
  });

  it('floors the prey figure instead of rounding it, so it never names a prey that is too heavy', () => {
    // The #389 ruling: at mass 312.1 the true limit is 249.68. Rounded it would read 249.7 — but a 249.7 prey
    // needs a predator of 312.125, which this cell is not.
    const panel = panelAt(312.1);
    expect(valueOf(panel, HUD_TEST_ID.affectingPreyBelow)).toBe(`${AT_MOST_SIGN} 249.6`);
  });

  it('ceils the threat figure instead of rounding it, so it never names a cell that cannot eat us', () => {
    // The other half of the #389 ruling. The mass is chosen from the live ratio so the threshold lands 0.0375 above
    // a decimal step whatever the ratio is tuned to — at the shipped 1.25 that mass is 100.03. Rounded, the row
    // would read `≥ 125`, and a 125-mass cell cannot engulf this one: a harmless cell named as a predator.
    const thresholdJustAboveAStep = 125.0375;
    const ratio = balance.absorption.ENGULF_MASS_RATIO + ownCell.membraneRatioBonus;
    const panel = panelAt(thresholdJustAboveAStep / ratio);
    expect(valueOf(panel, HUD_TEST_ID.affectingThreatAbove)).toBe(`${AT_LEAST_SIGN} 125.1`);
  });

  it('omits the speed row entirely at a size that costs no speed', () => {
    // `maxSpeedForMass` clamps to `CELL_BASE_SPEED` at or under the starting mass, so the share is exactly zero
    // there — not an epsilon — and a `−0 %` row would be noise.
    const panel = panelAt(balance.growth.CELL_STARTING_MASS);
    expect(rowById(panel, HUD_TEST_ID.affectingSpeed)).toBeUndefined();
  });

  it('reads the size speed cost off the shared mass curve, before any trait', () => {
    const share = maxSpeedForMass(OWN_MASS, balance.growth) / balance.growth.CELL_BASE_SPEED - IDENTITY;
    const expected = formatQuantity(share, QUANTITY_UNIT.share, {
      presentation: QUANTITY_PRESENTATION.signedChange,
    });
    expect(valueOf(panelAt(), HUD_TEST_ID.affectingSpeed)).toBe(expected);
  });

  it('lists each owned trait with its tier and the first line of that tier effects', () => {
    const row = rowById(panelAt(), affectingTraitTestId(MITOCHONDRION));
    const [effect] = describeTierModifiers(balance.traits, MITOCHONDRION, FIRST_TIER);
    expect(row?.name).toBe(
      `Mitochondrion ${formatQuantity(FIRST_TIER, QUANTITY_UNIT.tier, { presentation: QUANTITY_PRESENTATION.numeral })}`,
    );
    // The value wraps in the panel's narrow column (#630), so its number is bound to its unit like a card's (#446).
    expect(row?.values[0]).toBe(bindQuantities(effect ?? ''));
    expect(row?.values[0]).not.toMatch(/\d /);
    // Less mass decay reads with a minus and still helps: the value is toned a benefit, not by its sign (#453).
    expect(effect).toMatch(/^−/);
    expect(row?.valueEffect).toBe(MODIFIER_EFFECT.benefit);
    // Its marker is the trait's own glyph, which is what the panel draws in the slot.
    expect(row?.traitId).toBe(MITOCHONDRION);
  });

  it('says where the cell stands against the world clock, through the shared standing', () => {
    const reference = worldReference(worldElapsedSeconds(TICK, ROUND_START_TICK, ROUND_SECONDS), balance);
    const standing = standingAgainstWorld(ownProgress.level, OWN_MASS, reference, balance);
    expect(valueOf(panelAt(), HUD_TEST_ID.affectingWorld)).toBe(WORLD_STANDING_WORD[standing]);
  });

  it('carries the mass element the kit has no row for, with the run the sparkline draws', () => {
    const panel = panelAt();
    expect(panel.mass.massText).toBe(String(Math.floor(OWN_MASS)));
    expect(panel.mass.masses).toEqual(MASS_RUN);
  });

  it('puts the rows in the sections §3.7 gives them', () => {
    const panel = panelAt();
    const ids = panel.sections.map((section) => section.sectionId);
    expect(ids).toEqual([
      AFFECTING_SECTION.mass,
      AFFECTING_SECTION.here,
      AFFECTING_SECTION.size,
      AFFECTING_SECTION.traits,
    ]);
    // The world row closes the trait section, after the traits themselves.
    const traits = panel.sections.find((section) => section.sectionId === AFFECTING_SECTION.traits);
    expect(traits?.rows.at(-1)?.rowId).toBe(HUD_TEST_ID.affectingWorld);
  });

  it('never renders a row whose value would read as nothing', () => {
    for (const section of panelAt().sections) {
      for (const row of section.rows) expect(row.values[0]).not.toBe('');
    }
  });
});
