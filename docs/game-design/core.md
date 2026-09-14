# Evolution — Game Design: companions, fantasy, ladder and loop

§1–§4 of the split [`GAME-DESIGN.md`](../GAME-DESIGN.md), which keeps the shared context and the file list.

## 1. Companion documents

| Document                                | Covers                                                                                                    | Tickets       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------- |
| this file                               | Core fantasy, the evolution ladder, loop, session model, controls, camera, dish, win/lose, constants      | #22, #29      |
| [`ECOLOGY.md`](../ECOLOGY.md)           | Food kinds and bacterium variants, zones, spawn model, decay, mass/speed curves, mitosis, absorption      | #23, #26, #27 |
| [`PROGRESSION.md`](../PROGRESSION.md)   | DNA, tags, level thresholds, draft rules filtered by the ladder, entering the dish (late join, respawn)   | #24           |
| [`TRAITS.md`](../TRAITS.md)             | Modifier model, the sixteen build-1 traits (organelles and forms) mapped onto the ladder, later traits    | #25           |
| [`VISUAL-STYLE.md`](../VISUAL-STYLE.md) | Palette, cell layer stack, organelle vocabulary, motion language, legibility at play scale, render intent | #34           |
| [`UI.md`](../UI.md)                     | HUD, overlays, onboarding beats, input mapping, readability rules, Angular component plan                 | #30           |

Technical contracts and the file plan: [`ARCHITECTURE.md`](../ARCHITECTURE.md) (#112); the build itself is
epic #96 and its tickets (planning lives in GitHub issues, never in a markdown plan). Still to come under this
epic: multi-cell organisms (#28), cross-player fusion decision
(#79), audio manifest (#35).

**One fact, one home.** Every number in this document is a named constant whose home is
`packages/shared/src/constants/<domain>.ts`. Other docs link here rather than repeating. Where a
number belongs to another doc, this doc names the constant and links.

## 2. Core fantasy

_A single cell that becomes something more._ You begin as a bare **protocell**: a lipid membrane, a
few granules, no nucleus, drifting in a dark-field petri dish. You steer toward the pointer, swallow
motes of food, grow heavy and slow, and absorb the DNA of what you eat. DNA buys organelles, and
organelles climb biology's own ladder: a nucleoid, a flagellum, a wall; a mitochondrion or a
chloroplast stolen by engulfing the bacterium that carries it; a nuclear envelope, a cytoskeleton,
vacuoles, cilia; and finally one of the great single-cell forms (amoeba, paramecium, euglena,
diatom, stentor). What you eat shapes what you become: the traits offered at each level-up are
weighted by the DNA you absorbed. Bigger cells engulf smaller ones. You are not alone: the dish is
populated by **wild cells** at your own scale, and the world they make up evolves on its own clock,
from a broth of protocells to a food web of nucleated hunters, whether you keep up or not. The round
is a race against that average: outgrow the world and it is lunch, fall behind and it eats you
(section 5.5). Build 1 is one cell, one round, one leaderboard; colonies and multicellular life are
build 2.

## 3. The evolution ladder

The ladder is the progression spine of build 1. It is a shared enum, and every trait in
[`TRAITS.md`](../TRAITS.md) is an organelle or a form that sits on one of its rungs.

```ts
// packages/shared/src/types/game.ts: the ids; packages/shared/src/constants/ladder.ts: the order and the gates
export const CELL_STAGE = {
  protocell: 'protocell',
  prokaryote: 'prokaryote',
  endosymbiosis: 'endosymbiosis',
  eukaryote: 'eukaryote',
  specialised: 'specialised',
} as const;
export type CellStage = (typeof CELL_STAGE)[keyof typeof CELL_STAGE];
export const STAGE_ORDER = [
  CELL_STAGE.protocell,
  CELL_STAGE.prokaryote,
  CELL_STAGE.endosymbiosis,
  CELL_STAGE.eukaryote,
  CELL_STAGE.specialised,
] as const satisfies readonly CellStage[];
export const STAGE_GATE_TRAITS: Record<CellStage, readonly TraitId[]> = {
  protocell: [], // the starting stage has no gate
  prokaryote: ['nucleoid'],
  endosymbiosis: ['mitochondrion', 'chloroplast'],
  eukaryote: ['nuclear_envelope'],
  specialised: ['amoeba_pseudopods', 'paramecium_cilia', 'euglena_eyespot', 'diatom_shell', 'stentor_trumpet'],
};
```

| Stage           | Reached when                                                    | What it unlocks (traits whose `stage` is this one)                           | Biology                  |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| `protocell`     | start of every round and every respawn                          | `nucleoid`, `simple_flagellum`, `cell_wall`                                  | membrane + granules      |
| `prokaryote`    | `nucleoid` owned                                                | `ribosomes`, `mitochondrion`, `chloroplast`                                  | bacterium / archaeon     |
| `endosymbiosis` | `mitochondrion` or `chloroplast` owned                          | `nuclear_envelope`                                                           | the engulfed bacterium   |
| `eukaryote`     | `nuclear_envelope` owned                                        | `cytoskeleton`, `cilia`, `food_vacuole`, `toxin_vacuole`, and the five forms | true nucleus, organelles |
| `specialised`   | one form owned (`body_plan` exclusion group: one form per cell) | nothing new; the remaining picks deepen tiers                                | amoeba, paramecium, …    |

Rules (home of the pure functions: `packages/server/src/game/progression/ladder.ts`):

- **A cell's stage** is the last stage `S` in `STAGE_ORDER` such that every stage after `protocell`
  up to and including `S` has at least one of its `STAGE_GATE_TRAITS` owned (any tier). A fixture
  that grants `chloroplast` to a cell without `nucleoid` therefore leaves it a protocell: the walk
  stops at the first missing gate.
- **Trait eligibility** (the candidate rule, [`PROGRESSION.md §3`](../PROGRESSION.md#3-draft-pool-and-weights)):
  a trait can be offered only when the cell has reached the trait's `stage`, owns every id in its
  `requires`, and, for endosymbionts, has met its `unlockedBy` counter
  (`ENDOSYMBIOSIS_BACTERIA_REQUIRED` bacteria of the matching variant eaten, [`ecology/food-and-spawn.md §1`](../ecology/food-and-spawn.md#1-food-kinds)).
- **The rung card.** Whenever a gate trait of the cell's _next_ stage is a candidate, one of the
  three draft cards is reserved for it, so the ladder is always climbable when its prerequisites are
  met. Tag weighting still biases the other cards.
- **Endosymbiosis** is the only rung with an unlock outside the draft: eat
  `ENDOSYMBIOSIS_BACTERIA_REQUIRED` = 10 aerobic bacteria (two full clusters of `BACTERIUM_CLUSTER_SIZE`
  = 5; they cluster around the warm vent) and the mitochondrion becomes a candidate; eat
  `ENDOSYMBIOSIS_BACTERIA_REQUIRED` = 10 photosynthetic bacteria (the same constant; they cluster in the
  sunlit shallows) and the chloroplast does. Absorbing a player cell that owns an endosymbiont credits that unlock in full.
- **The protocell is the baseline.** The mass, radius and speed curves in
  [`ecology/mass-and-movement.md §5`](../ecology/mass-and-movement.md#5-size-mass-and-speed) and the identity `DEFAULT_CELL_MODIFIERS`
  ([`traits/model.md §2`](../traits/model.md#2-modifier-model)) describe the protocell. There is no separate
  protocell speed multiplier: a flagellate is faster than a protocell because the flagellum is a trait
  (`speedMultiplier` > 1), not because the protocell is penalised. "Drifting" is the visual language
  (a wobbly, translucent, nucleus-free blob, [`traits/catalog-organelles.md §3.0`](../traits/catalog-organelles.md#30-what-each-stage-looks-like)).
- **Death keeps the ladder.** Level, traits and therefore stage survive death and respawn
  (section 5.2); only mass and part of the progress toward the next level are lost.
- **Pace target** (decision #138, option A "slow dawn"; the #138 pace model, ± 20 s). A fast player
  is a bare protocell for about three minutes and owns a nucleoid at level 2 (~2:50), an endosymbiont
  at level 3 (~5:40, after a vent or shallows trip that eats two clusters), the nuclear envelope at
  level 4 (~8:00) and a form at level 5 (~9:40). Levels 6–12 deepen tiers and add the remaining
  organelles; they fall outside a `ROUND_DURATION_SECONDS` = 600 round (section 5.1). The mass curve
  is unchanged by the decision: engulf is gated by mass, not by the ladder, so a three-minute
  protocell is a fat one (mass ~200, radius ~57 wu) that already hunts.
- **Build 2** adds colonies and multicellular organisms above `specialised`; they are not stages of
  this enum (a colony is several cells), so the enum is closed for build 1.
- **The world climbs the same ladder.** The world clock ([`ecology/food-and-spawn.md §3.1`](../ecology/food-and-spawn.md#31-the-world-clock))
  gives the dish itself a `worldStage` from this enum: the stage of the world's own picks,
  `stageOf` of wild build 0's first floor(`worldLevel`) − 1 traits (protocell 0:00, prokaryote 3:00,
  endosymbiosis 6:00, eukaryote 9:00 in a 600 s round; `eukaryote` spans levels 4 and 5, because the
  fifth pick is a form's prerequisite and the form itself is the sixth); the wild cells wear that
  stage's organelles, and a player's standing is read against it (section 5.5). Late joiners and
  respawns enter the ladder no lower than the world's level (section 5.2, [`PROGRESSION.md §5`](../PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)).

## 4. Moment-to-moment loop

```
 steer -> eat motes -> grow (mass up, radius up, speed down)
    ^                           |
    |        absorb DNA <-------+---> hunt smaller / avoid bigger
    |             |                          |
    +-- choose 1 of 3 traits <-- level up    +--> engulf / be engulfed
                  |
                  +--> climb a rung of the ladder (organelle or form)
```

Reserved for build 2 (hooks only, section 11): split (mitosis), bond (colonies).
