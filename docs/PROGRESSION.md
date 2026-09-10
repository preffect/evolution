# Evolution — DNA, Levels and Trait Drafts

Ticket: #24. Epic #2. Sources of DNA and tag points: [`ECOLOGY.md`](./ECOLOGY.md#1-food-kinds) and
[`ECOLOGY.md §6`](./ECOLOGY.md#6-absorption-and-engulf). The traits being drafted:
[`TRAITS.md`](./TRAITS.md). The ladder the drafts climb: [`GAME-DESIGN.md §3`](./GAME-DESIGN.md#3-the-evolution-ladder).
Session rules (respawn, round end): [`GAME-DESIGN.md §5`](./GAME-DESIGN.md#5-session-structure-29).

## 1. DNA and tags

DNA is the experience currency. Every player carries:

| Field                    | Type                               | Meaning                                                                              |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------ |
| `dnaCumulative`          | number                             | Every DNA point ever gained this round (including catch-up gifts). Never decreases.  |
| `dnaCatchUpGift`         | number                             | The part of `dnaCumulative` granted by late-join catch-up (§5). Excluded from score. |
| `dnaTowardNextLevel`     | number                             | Progress inside the current level; reset on death.                                   |
| `level`                  | 1 .. `MAX_LEVEL`                   | Current level. Kept on death.                                                        |
| `dnaTagPoints`           | `Record<DnaTag, number>`           | What you have eaten, by flavour. Drives draft weights (§3).                          |
| `bacteriaEatenByVariant` | `Record<BacteriumVariant, number>` | Endosymbiosis counters (ECOLOGY §1). Kept on death. Gate the endosymbionts (§3).     |

`DnaTag` = `motile | photic | predatory | armored | toxic | sensory | metabolic`. Tag points are not
spent; they only bias drafts. Sources, with the amounts owned by ECOLOGY: algae (`photic`),
bacteria (one tag by variant + 1 DNA), DNA fragments (5 DNA + one zone tag), absorption
(`ENGULF_DNA_BASE` + share of the prey's DNA, half the prey's tag points, plus `predatory`), mass
overflow at the cap. Every DNA gain except the late-join gift is multiplied by the folded
`dnaGainMultiplier` (the Nucleoid Coil, [`TRAITS.md §3.1`](./TRAITS.md)).

Score for the leaderboard is `dnaCumulative − dnaCatchUpGift + SCORE_ABSORPTION_BONUS × absorptions`
([`GAME-DESIGN.md §5.3`](./GAME-DESIGN.md#53-leaderboard-and-score)).

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
  bloom, the winner at 10–12. On the ladder: nucleoid at 2, an endosymbiont at 3–4, the nuclear
  envelope at 4–5, a form at 5–6, then tiers and the remaining organelles.

## 3. Draft pool and weights

On each level-up the server builds a draft of `TRAIT_DRAFT_SIZE` = 3 cards from the catalog:

1. **Candidates.** A trait is a candidate when all of these hold:
   - it is not owned at tier III; if owned, the card is the _upgrade_ to the next tier;
   - **the ladder:** the cell has reached the trait's `stage` (`stageOf(ownedTraits)`,
     [`GAME-DESIGN.md §3`](./GAME-DESIGN.md#3-the-evolution-ladder)), every id in its `requires` is
     owned, and, if it has `unlockedBy`, `bacteriaEatenByVariant[variant]` ≥ `count`;
   - no _other_ owned trait shares its `exclusionGroup` (an upgrade of the owned member is fine).
     The ladder only filters candidates; tag weighting below works unchanged on top of it.
2. **Weights.**

```
tagScore   = Σ dnaTagPoints[tag] for tag in trait.tags
weight     = RARITY_WEIGHT[trait.rarity]
           × min(TAG_WEIGHT_MAX_MULTIPLIER, 1 + TAG_WEIGHT_PER_POINT × tagScore)
           × (isUpgrade ? UPGRADE_CARD_WEIGHT_MULTIPLIER : 1)
```

3. **The rung card.** If any candidate is a gate trait of the cell's next stage
   (`STAGE_GATE_TRAITS[next]`), the first card is drawn among those gates by weight; the ladder is
   always climbable once its prerequisites are met.
4. **Draw** the remaining cards, up to `TRAIT_DRAFT_SIZE` distinct candidates in total, by weighted
   sampling without replacement from the `traitDraft` random stream. Fewer candidates than cards:
   offer what exists. Zero candidates: no draft, the player gains `LEVEL_UP_NO_DRAFT_MASS_BONUS` mass
   instead (a specialised cell with every reachable trait at tier III; the rule also covers later
   catalogs).

The upshot: a protocell's first draft is always the three protocell picks (nucleoid, flagellum,
wall). Eat bacteria (`motile`) and the flagellum, later the cilia, become up to four times as likely;
a hunter (`predatory` from absorptions) sees the food vacuole and the amoeba; a shallows grazer eats
photosynthetic bacteria, unlocks the chloroplast and is steered toward the euglena. Rarity still
matters: a rare with no tag support is 20 % as likely as a common.

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
- Applying a card sets the trait to the offered tier, recomputes the cell's modifiers
  ([`TRAITS.md §2`](./TRAITS.md#2-modifier-model)) and its stage.
- Rerolls: `TRAIT_REROLLS_PER_ROUND` = 0 in build 1 (declared, reserved).
- Offers survive death: a queued or shown offer stays with the player through spectate and respawn.

## 5. Late-join catch-up

A player who joins after `LATE_JOIN_GRACE_SECONDS` of round time receives, relative to the living
players' medians at the moment of joining:

| Field           | Rule                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `dnaCumulative` | `floor(LATE_JOIN_DNA_FRACTION × median dnaCumulative)`; also recorded as `dnaCatchUpGift`.                                    |
| `level`         | Derived from the threshold table; every level-up above 1 queues a draft, so the joiner climbs the ladder one draft at a time. |
| mass            | `clamp(LATE_JOIN_MASS_FRACTION × median mass, CELL_STARTING_MASS, LATE_JOIN_MAX_MASS)`.                                       |
| tag points      | none (their drafts are unbiased until they eat).                                                                              |

Before the grace period, or when no other living player exists, the joiner starts fresh. Respawn is not
a late join: it keeps level, traits and stage and keeps only `dnaKeptOnDeathFraction` of
`dnaTowardNextLevel` ([`GAME-DESIGN.md §5.2`](./GAME-DESIGN.md#52-spawn-death-and-respawn)). Auto-rematch
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
| `TRAIT_CHOICE_TIMEOUT_SECONDS`   | 10                                 | s       |
| `TRAIT_REROLLS_PER_ROUND`        | 0 (reserved)                       | count   |
| `LEVEL_UP_NO_DRAFT_MASS_BONUS`   | 10                                 | mass    |
| `LATE_JOIN_GRACE_SECONDS`        | 30                                 | s       |
| `LATE_JOIN_DNA_FRACTION`         | 0.5                                | ratio   |
| `LATE_JOIN_MASS_FRACTION`        | 0.25                               | ratio   |
| `LATE_JOIN_MAX_MASS`             | 200                                | mass    |
| `DNA_TAGS`                       | the seven tags above               | ids     |

The ladder's own constants (`STAGE_ORDER`, `STAGE_GATE_TRAITS`, `ENDOSYMBIOSIS_BACTERIA_REQUIRED`)
live in `ladder.ts` ([`GAME-DESIGN.md §12`](./GAME-DESIGN.md#12-constants-table)).

## 7. Acceptance scenarios

Given seed S and inputs I, after N ticks assert X. "Greedy bot" is the framework's `graze` behaviour:
steer toward the nearest DNA fragment, else the nearest food mote, re-evaluated every 30 ticks.
Conventions as in [`ECOLOGY.md §8`](./ECOLOGY.md#8-acceptance-scenarios).

| #   | Given                                                                                                                                | Inputs                         | After       | Assert                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | seed 42, 1 player (seeded world)                                                                                                     | greedy bot                     | 5400 ticks  | level ≥ 2 (the ticket #75 example scenario).                                                                                                                                                                 |
| P2  | seed 42, 1 player, four `sensory` DNA fragments placed inside the cell one per tick                                                  | idle                           | 4 ticks     | `dnaCumulative` = 20, level = 2, `dnaTowardNextLevel` = 0, one offer shown with `offerId` 1 whose cards are exactly `nucleoid`, `simple_flagellum`, `cell_wall` (the three protocell picks) in some order.   |
| P3  | P2 state                                                                                                                             | no `traitChoice` for 600 ticks | 600 ticks   | offer closed; `nucleoid` owned at tier I (weights 1.0 / 0.5 / 1.0, tie → lowest catalog index); stage `prokaryote`.                                                                                          |
| P4  | pure function `computeDraftWeights` over candidates `cilia`, `simple_flagellum`, `cell_wall` with `motile` tag points 30, none owned | —                              | —           | cilia = 4.0 (1.0 × min(4, 1 + 3)), simple_flagellum = 2.0 (0.5 × 4), cell_wall = 1.0.                                                                                                                        |
| P5  | ECOLOGY E9 (A level 1 absorbs B on tick 30)                                                                                          | idle                           | 31 ticks    | A `dnaCumulative` = 30, level = 2, `dnaTowardNextLevel` = 10, exactly one offer shown (opened on tick 30).                                                                                                   |
| P6  | seed 42, 1 player granted 50 DNA in one tick by the fixture                                                                          | picks card 0 at tick 5         | 6 ticks     | level 3; offer 1 applied at tick 5, offer 2 shown at tick 6 with its own timer; picking `offerId` 1 again at tick 7 is ignored.                                                                              |
| P7  | seed 42, 2 players with fixture-set `dnaCumulative` 60 / 60 and mass 400 / 400; third joins at tick 6000                             | idle                           | join + 1    | joiner `dnaCumulative` = 30, `dnaCatchUpGift` = 30, level 2, one offer shown (the protocell draft), mass = 100, score = 0.                                                                                   |
| P8  | as P7 but the third player joins at tick 600                                                                                         | idle                           | join + 1    | joiner fresh: mass 20, `dnaCumulative` 0, level 1, no offer.                                                                                                                                                 |
| P9  | pure function `buildDraft` for a eukaryote (fixture) owning `amoeba_pseudopods` I and `cytoskeleton` I, seeds 1..100                 | —                              | —           | no other form ever appears (`body_plan`); `amoeba_pseudopods` appears only as the tier II upgrade card; `cytoskeleton` only as its tier II card.                                                             |
| P10 | seed 42, 1 player at level 12 with fixture DNA 770                                                                                   | eat 1 placed DNA fragment      | 1 tick      | `dnaCumulative` = 775, level 12, no offer.                                                                                                                                                                   |
| P11 | seed 42, A engulfing B; B has an offer shown                                                                                         | idle until B respawns          | respawn + 1 | B still has the same `offerId` shown; its timer kept counting during spectate (may have auto-picked).                                                                                                        |
| P12 | pure function `listDraftCandidates` for a prokaryote (`nucleoid` I) with `bacteriaEatenByVariant` photosynthetic 5, aerobic 4        | —                              | —           | `chloroplast` is a candidate; `mitochondrion` is not (4 < `ENDOSYMBIOSIS_BACTERIA_REQUIRED`); `nuclear_envelope`, `cilia` and every form are not (stage not reached); `ribosomes` is.                        |
| P13 | pure function `stageOf`                                                                                                              | —                              | —           | [] → `protocell`; [nucleoid] → `prokaryote`; [nucleoid, chloroplast] → `endosymbiosis`; + nuclear_envelope → `eukaryote`; + euglena_eyespot → `specialised`; [chloroplast] alone → `protocell` (walk stops). |
| P14 | pure function `buildDraft` for a protocell with no tag points, seeds 1..100                                                          | —                              | —           | `nucleoid` is in every draft (the rung card); for a prokaryote with photosynthetic 5, `chloroplast` is in every draft.                                                                                       |
