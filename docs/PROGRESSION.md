# Evolution — DNA, Levels and Trait Drafts

Ticket: #24. Epic #2. Sources of DNA and tag points: [`ECOLOGY.md`](./ECOLOGY.md#1-food-kinds) and
[`ECOLOGY.md §6`](./ECOLOGY.md#6-absorption-and-engulf). The traits being drafted:
[`TRAITS.md`](./TRAITS.md). Session rules (respawn, round end): [`GDD.md`](./GDD.md#3-session-structure-29).

## 1. DNA and tags

DNA is the experience currency. Every player carries:

| Field                | Type                     | Meaning                                                                              |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `dnaCumulative`      | number                   | Every DNA point ever gained this round (including catch-up gifts). Never decreases.  |
| `dnaCatchUpGift`     | number                   | The part of `dnaCumulative` granted by late-join catch-up (§5). Excluded from score. |
| `dnaTowardNextLevel` | number                   | Progress inside the current level; reset on death.                                   |
| `level`              | 1 .. `MAX_LEVEL`         | Current level. Kept on death.                                                        |
| `dnaTagPoints`       | `Record<DnaTag, number>` | What you have eaten, by flavour. Drives draft weights (§3).                          |

`DnaTag` = `motile | photic | predatory | armored | toxic | sensory | metabolic`. Tag points are not
spent; they only bias drafts. Sources, with the amounts owned by ECOLOGY: algae (`photic`),
bacteria (`motile` + 1 DNA), DNA fragments (5 DNA + one zone tag), absorption (`ENGULF_DNA_BASE` +
share of the prey's DNA, half the prey's tag points, plus `predatory`), mass overflow at the cap.

Score for the leaderboard is `dnaCumulative − dnaCatchUpGift + SCORE_ABSORPTION_BONUS × absorptions`
([`GDD.md §3.3`](./GDD.md#33-leaderboard-and-score)).

## 2. Level thresholds

```
levelUpCost(level) = LEVEL_UP_COST_BASE_DNA + LEVEL_UP_COST_PER_LEVEL_DNA × level     (DNA to go from level to level + 1)
```

| Level reached | Cost from previous | Cumulative DNA |
| ------------- | ------------------ | -------------- |
| 2             | 20                 | 20             |
| 3             | 30                 | 50             |
| 4             | 40                 | 90             |
| 5             | 50                 | 140            |
| 6             | 60                 | 200            |
| 7             | 70                 | 270            |
| 8             | 80                 | 350            |
| 9             | 90                 | 440            |
| 10            | 100                | 540            |
| 11            | 110                | 650            |
| 12 (max)      | 120                | 770            |

- Gains carry over: a 30-DNA absorption at level 1 gives level 2 and 10 toward level 3. One gain may
  produce several level-ups; each queues a draft (§4).
- At `MAX_LEVEL` DNA keeps accumulating for score; no more drafts.
- Design targets for a 10-minute round: solo level 2 at ~45 s, an active player at level 6–8 by the
  bloom, the winner at 10–12.

## 3. Draft pool and weights

On each level-up the server builds a draft of `TRAIT_DRAFT_SIZE` = 3 cards from the catalog:

1. **Candidates.** A trait is a candidate when: it is not owned at tier III; if owned, the card is the
   _upgrade_ to the next tier; no owned trait shares its `exclusionGroup`; `minLevel` ≤ the new level.
2. **Weights.**

```
tagScore   = Σ dnaTagPoints[tag] for tag in trait.tags
weight     = RARITY_WEIGHT[trait.rarity]
           × min(TAG_WEIGHT_MAX_MULTIPLIER, 1 + TAG_WEIGHT_PER_POINT × tagScore)
           × (isUpgrade ? UPGRADE_CARD_WEIGHT_MULTIPLIER : 1)
```

3. **Draw** 3 distinct candidates by weighted sampling without replacement from the `traitDraft`
   random stream. Fewer than 3 candidates: offer what exists. Zero candidates: no draft, the player
   gains `LEVEL_UP_NO_DRAFT_MASS_BONUS` mass instead (cannot happen with the build-1 catalog, kept as
   the rule for later catalogs).

The upshot: eat bacteria (`motile`) and Cilia Fringe becomes up to four times as likely; a hunter
(`predatory` from absorptions) sees Ravenous Enzymes and Whip Flagellum; a shallows grazer sees
Chloroplast Pigment. Rarity still matters: a rare with no tag support is 20 % as likely as a common.

## 4. Offer lifecycle

```
level-up --> [queued] --> shown (offerId, 3 cards, timer starts) --> pick / timeout --> applied
                ^                                                                        |
                +------------------------- next queued offer ----------------------------+
```

- Offers are shown one at a time per player, FIFO. The `TRAIT_CHOICE_TIMEOUT_SECONDS` timer starts
  when an offer is shown, not when it was queued.
- The client sends `traitChoice: { offerId, cardIndex }` in `GameInput`. A choice whose `offerId` is
  not the currently shown offer is ignored (stale pick after a timeout).
- **Timeout** picks the card with the highest draft weight; ties break by lowest catalog index. The
  simulation never pauses and the cell keeps steering while the cards are up.
- Applying a card sets the trait to the offered tier and recomputes the cell's modifiers
  ([`TRAITS.md §2`](./TRAITS.md#2-modifier-model)).
- Rerolls: `TRAIT_REROLLS_PER_ROUND` = 0 in build 1 (declared, reserved).
- Offers survive death: a queued or shown offer stays with the player through spectate and respawn.

## 5. Late-join catch-up

A player who joins after `LATE_JOIN_GRACE_SECONDS` of round time receives, relative to the living
players' medians at the moment of joining:

| Field           | Rule                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `dnaCumulative` | `floor(LATE_JOIN_DNA_FRACTION × median dnaCumulative)`; also recorded as `dnaCatchUpGift`.                |
| `level`         | Derived from the threshold table; every level-up above 1 queues a draft, so the joiner drafts one by one. |
| mass            | `clamp(LATE_JOIN_MASS_FRACTION × median mass, CELL_STARTING_MASS, LATE_JOIN_MAX_MASS)`.                   |
| tag points      | none (their drafts are unbiased until they eat).                                                          |

Before the grace period, or when no other living player exists, the joiner starts fresh. Respawn is not
a late join: it keeps level and traits and resets `dnaTowardNextLevel` (GDD §3.2). Auto-rematch
resets everyone.

## 6. Constants table — `packages/shared/src/constants/progression.ts`

| Constant                         | Value                              | Unit    |
| -------------------------------- | ---------------------------------- | ------- |
| `MAX_LEVEL`                      | 12                                 | level   |
| `LEVEL_UP_COST_BASE_DNA`         | 10                                 | DNA     |
| `LEVEL_UP_COST_PER_LEVEL_DNA`    | 10                                 | DNA     |
| `TRAIT_DRAFT_SIZE`               | 3                                  | cards   |
| `RARITY_WEIGHT`                  | common 1.0, uncommon 0.5, rare 0.2 | weight  |
| `TAG_WEIGHT_PER_POINT`           | 0.1                                | ×/point |
| `TAG_WEIGHT_MAX_MULTIPLIER`      | 4                                  | ×       |
| `UPGRADE_CARD_WEIGHT_MULTIPLIER` | 1.5                                | ×       |
| `TRAIT_CHOICE_TIMEOUT_SECONDS`   | 10 (home: `controls.ts`, GDD)      | s       |
| `TRAIT_REROLLS_PER_ROUND`        | 0 (reserved)                       | count   |
| `LEVEL_UP_NO_DRAFT_MASS_BONUS`   | 10                                 | mass    |
| `LATE_JOIN_GRACE_SECONDS`        | 30                                 | s       |
| `LATE_JOIN_DNA_FRACTION`         | 0.5                                | ratio   |
| `LATE_JOIN_MASS_FRACTION`        | 0.25                               | ratio   |
| `LATE_JOIN_MAX_MASS`             | 200                                | mass    |
| `DNA_TAGS`                       | the seven tags above               | ids     |

## 7. Acceptance scenarios

Given seed S and inputs I, after N ticks assert X. "Greedy bot" is the framework's `graze` behaviour:
steer toward the nearest DNA fragment, else the nearest food mote, re-evaluated every 30 ticks.

| #   | Given                                                                                                    | Inputs                         | After       | Assert                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | seed 42, 1 player                                                                                        | greedy bot                     | 5400 ticks  | level ≥ 2 (the ticket #75 example scenario).                                                                                               |
| P2  | seed 42, 1 player, four DNA fragments placed inside the cell one per tick                                | idle                           | 4 ticks     | `dnaCumulative` = 20, level = 2, `dnaTowardNextLevel` = 0, one offer shown with `offerId` 1 and 3 distinct trait ids.                      |
| P3  | P2 state                                                                                                 | no `traitChoice` for 600 ticks | 600 ticks   | offer closed, the highest-weight card (ties → lowest catalog index) owned at tier I.                                                       |
| P4  | pure function `computeDraftWeights`: `motile` tag points 30, no traits owned                             | —                              | —           | Cilia Fringe weight = 4.0 (1.0 × min(4, 1 + 3)), Whip Flagellum = 2.0, Thick Membrane = 1.0, Toxin Vacuole (minLevel 4) absent at level 2. |
| P5  | seed 42, A level 1 absorbs B (ECOLOGY E9)                                                                | idle                           | absorb + 1  | A `dnaCumulative` = 30, level = 2, `dnaTowardNextLevel` = 10, exactly one offer shown.                                                     |
| P6  | seed 42, 1 player granted 50 DNA in one tick by the fixture                                              | picks card 0 at tick 5         | 6 ticks     | level 3; offer 1 applied at tick 5, offer 2 shown at tick 6 with its own timer; picking `offerId` 1 again at tick 7 is ignored.            |
| P7  | seed 42, 2 players with fixture-set `dnaCumulative` 60 / 60 and mass 400 / 400; third joins at tick 6000 | idle                           | join + 1    | joiner `dnaCumulative` = 30, `dnaCatchUpGift` = 30, level 2, one offer shown, mass = 100, score = 0.                                       |
| P8  | as P7 but the third player joins at tick 600                                                             | idle                           | join + 1    | joiner fresh: mass 20, `dnaCumulative` 0, level 1, no offer.                                                                               |
| P9  | pure function `buildDraft` with Cilia Fringe owned, seeds 1..100                                         | —                              | —           | Whip Flagellum never appears; Cilia Fringe appears only as the tier II upgrade card.                                                       |
| P10 | seed 42, 1 player at level 12 with fixture DNA 770                                                       | eat 1 placed DNA fragment      | 1 tick      | `dnaCumulative` = 775, level 12, no offer.                                                                                                 |
| P11 | seed 42, A engulfing B; B has an offer shown                                                             | idle until B respawns          | respawn + 1 | B still has the same `offerId` shown; its timer kept counting during spectate (may have auto-picked).                                      |
