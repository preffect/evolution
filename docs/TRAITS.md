# Evolution — Trait Catalog v1 (the ladder)

Ticket: #25. Epic #2. The ladder the catalog implements: [`GAME-DESIGN.md §3`](./GAME-DESIGN.md#3-the-evolution-ladder).
How traits are offered: [`PROGRESSION.md §3`](./PROGRESSION.md#3-draft-pool-and-weights). Base rules the
modifiers act on: [`ECOLOGY.md`](./ECOLOGY.md) and [`GAME-DESIGN.md §6`](./GAME-DESIGN.md#6-controls).
Visual language (colours, membrane, organelles): [`VISUAL-STYLE.md`](./VISUAL-STYLE.md) (#34) and
the concept sheets (#104–#106); this doc says _what_ each trait must show, not how it is drawn.

**Traits are organelles and forms.** Build 1 ships the sixteen traits in §3 at three tiers each,
arranged on the five rungs of the ladder: three protocell picks, three prokaryote organelles (two of
them endosymbionts), the nuclear envelope, four eukaryote organelles and five specialised forms. §4
names the later traits so tags, exclusion groups and the modifier model already account for them.
Machine-readable form: the catalog is an `as const` array in `packages/shared/src/constants/traits.ts`
(if #72 adopts `data/traits.json`, that file is generated from the same definitions and a test pins
them equal).

## 1. Definition shape

```ts
type TraitTierModifiers = Partial<CellModifiers>; // one tier's row: only the fields the tier changes

interface TraitDefinition {
  id: TraitId; // snake_case, full words
  name: string; // evocative, two words
  stage: CellStage; // the cell must have reached this stage to be offered it (ladder.ts)
  requires: TraitId[]; // every id must be owned (any tier) before it can be offered
  unlockedBy?: { bacteriumVariant: BacteriumVariant; count: number }; // endosymbionts only
  category: 'genome' | 'locomotion' | 'membrane' | 'metabolism' | 'sensory' | 'offense' | 'defense' | 'form' | 'colony';
  rarity: 'common' | 'uncommon' | 'rare';
  tags: DnaTag[]; // draft weighting, PROGRESSION §3
  exclusionGroup?: 'body_plan' | 'membrane';
  tiers: [TraitTierModifiers, TraitTierModifiers, TraitTierModifiers]; // tier I..III
  visual: string; // what the renderer must show, per tier
  audioCue: SoundEventId; // hook only in build 1 (#101)
}
```

There is no `minLevel`: the ladder (`stage`, `requires`, `unlockedBy`) is the pacing. A trait's rung is
the stage a cell must _have reached_ to draft it; the gate traits of the next stage therefore carry the
previous stage (`nucleoid` is a `protocell` trait that makes you a prokaryote).

## 2. Modifier model

Every trait tier is a partial `CellModifiers`. The cell's effective modifiers are folded over all
owned traits at their current tier: **multipliers multiply, bonuses and deltas add, floors take the
max**; defaults are the identity. The simulation reads only the folded record, never the trait list.
The fold runs at step 1 of the tick, right after trait choices are applied, so a pick affects the
same tick's movement, metabolism and engulf checks.

| Modifier                             | Default | Applied where                                                                                    |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------ |
| `speedMultiplier`                    | 1       | `traitSpeedFactor` in the movement step (ECOLOGY §5.2)                                           |
| `accelerationSecondsMultiplier`      | 1       | `CELL_ACCELERATION_SECONDS`                                                                      |
| `sprintSpeedMultiplierBonus`         | 0       | added to `SPRINT_SPEED_MULTIPLIER`                                                               |
| `sprintCooldownSecondsDelta`         | 0       | added to `SPRINT_COOLDOWN_SECONDS` (floor `SPRINT_COOLDOWN_FLOOR_SECONDS`)                       |
| `membraneRatioBonus`                 | 0       | `requiredRatio` and `releaseRatio` when this cell is prey (ECOLOGY §6.1)                         |
| `absorbDurationMultiplierAsPrey`     | 1       | the absorb phase's pace when this cell is prey (armour: ECOLOGY §6.1)                            |
| `wrapDurationMultiplierAsPredator`   | 1       | the wrap phase's pace when this cell is predator                                                 |
| `absorbDurationMultiplierAsPredator` | 1       | the absorb phase's pace when this cell is predator                                               |
| `gripStrengthBonus`                  | 0       | subtracted from the prey's held speed factor during wrap, when this cell is predator             |
| `gripResistanceBonus`                | 0       | added to this cell's held speed factor during wrap, when it is prey                              |
| `struggleSlowdownBonus`              | 0       | added to `ENGULF_STRUGGLE_SLOWDOWN` when this cell steers away as prey (cover and wrap)          |
| `spitOutChancePerSecond`             | 0       | per-tick spit-out roll from the `engulf` stream while this cell is wrapped or sealed as prey     |
| `engulfMassYieldBonus`               | 0       | added to `ENGULF_MASS_YIELD` (cap 1)                                                             |
| `digestionFactorBonus`               | 0       | food mass × (1 + bonus)                                                                          |
| `decayMultiplier`                    | 1       | mass decay (ECOLOGY §4)                                                                          |
| `photosynthesisMassPerSecond`        | 0       | gained per second while inside `sunlit_shallows`                                                 |
| `spikeDrainFractionPerSecond`        | 0       | predator engulfing this cell loses this × its mass per second                                    |
| `toxinDrainFractionPerSecond`        | 0       | other cells overlapping this cell lose this × their mass per second (floor `CELL_STARTING_MASS`) |
| `toxinAuraRangeInRadii`              | 0       | scalar: toxin also applies to cells whose centre is within this × radius, without contact        |
| `attractRangeInRadii`                | 0       | scalar: motes whose centre is within this × radius drift toward the cell                         |
| `attractSpeed`                       | 0       | wu/s of that drift                                                                               |
| `dnaGainMultiplier`                  | 1       | every DNA gain (food, fragments, absorption, overflow); never the late-join gift                 |
| `dnaKeptOnDeathFraction`             | 0       | share of `dnaTowardNextLevel` kept on death (adds, cap 1; GAME-DESIGN §5.2)                      |
| `gelSpeedFactorFloor`                | 0       | floor (max) on `gelSpeedFactor(mass)` (ECOLOGY §5.2)                                             |

Drained mass is lost to the dish (it is not transferred). Toxin and spikes never kill: they stop at
`CELL_STARTING_MASS`; their job is to push the predator below `releaseRatio` (ECOLOGY §6.1). A prey's
toxin counts `ENGULF_SWALLOWED_TOXIN_MULTIPLIER` (6) times against its engulfer once the wrap has
begun: the poison is inside. The engulf hooks above are the whole set; §3.18 says which trait pulls
each one, and every trait not named there sets none of them, by design.

**Against PR #142's `trait-modifiers.ts`** (the shared contract, #97), this rework renames
`engulfDurationMultiplierAsPrey` → `absorbDurationMultiplierAsPrey` (it now scales the absorb phase
only), splits `engulfDurationMultiplierAsPredator` into `wrapDurationMultiplierAsPredator` (Amoeba
Pseudopods) and `absorbDurationMultiplierAsPredator` (Food Vacuole), and adds `gripStrengthBonus`,
`gripResistanceBonus`, `struggleSlowdownBonus` and `spitOutChancePerSecond`. The tier tables that
change: Cell Wall (+`absorbDurationMultiplierAsPrey`), Cytoskeleton Lattice (+`struggleSlowdownBonus`),
Cilia Fringe (+`gripResistanceBonus`), Paramecium Cilia (+`struggleSlowdownBonus`), Amoeba Pseudopods
(rename + `gripStrengthBonus`), Diatom Shell (rename + `spitOutChancePerSecond`).

## 3. Build-1 catalog (sixteen traits, fully specified)

Tier columns give the _value of the modifiers this tier sets_; unlisted modifiers stay at default.
Constants are the tier tables themselves (`TRAIT_TIERS.cilia[0]` etc.), no loose literals. Headings
give: category, rarity, tags, exclusion group, `stage`, `requires`.

### 3.0 What each stage looks like

The protocell is the level-1 baseline; every rung adds something the renderer must show
(`render/cell-layer.ts`, [`ARCHITECTURE.md`](./ARCHITECTURE.md)):

| Stage / trait      | On screen                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protocell`        | Translucent membrane ring with a loose wobble, `PROTOCELL_GRANULE_COUNT` (3, `render/constants.ts`) dim granules drifting inside, **no nucleus**.        |
| `nucleoid`         | A loose, brighter tangle of thread in the cytoplasm with no boundary (tier: 1 / 2 / 3 loops).                                                            |
| `ribosomes`        | A fine stipple of dots along the inside of the membrane (density per tier).                                                                              |
| endosymbionts      | Mitochondrion: orange-red bean(s) with inner folds. Chloroplast: green lens(es). Count per tier.                                                         |
| `nuclear_envelope` | The nucleoid thread gathers into a bounded round nucleus with its own rim: the classic cell look. Everything "near the nucleus" below assumes this rung. |
| `cytoskeleton`     | The membrane wobble tightens (taut outline), contact dents are sharper; the forms' silhouettes become possible.                                          |
| forms              | Each form owns one silhouette (§3.17) so a specialised cell reads at the zoomed-out camera.                                                              |

### Rung 1 — protocell picks (`stage: 'protocell'`)

#### 3.1 Nucleoid Coil `nucleoid` — genome, common, tags `metabolic`, no group, requires none. **Gate → `prokaryote`.**

| Tier | dnaGainMultiplier |
| ---- | ----------------- |
| I    | 1.05              |
| II   | 1.10              |
| III  | 1.15              |

Your genes are organised: every DNA gain reads a little more. Visual: §3.0. Audio: soft click.

#### 3.2 Simple Flagellum `simple_flagellum` — locomotion, uncommon, tags `motile predatory`, no group, requires none

| Tier | speedMultiplier | sprintSpeedMultiplierBonus | sprintCooldownSecondsDelta |
| ---- | --------------- | -------------------------- | -------------------------- |
| I    | 1.05            | +0.3                       | −0.5                       |
| II   | 1.05            | +0.6                       | −1.0                       |
| III  | 1.05            | +0.9                       | −1.5                       |

Visual: one long tail trailing opposite the velocity, sine wave with amplitude growing per tier;
tier III adds a second tail. Silhouette: teardrop. Audio: whip crack on sprint.

#### 3.3 Cell Wall `cell_wall` — membrane, common, tags `armored`, group `membrane`, requires none

| Tier | membraneRatioBonus | absorbDurationMultiplierAsPrey | speedMultiplier |
| ---- | ------------------ | ------------------------------ | --------------- |
| I    | +0.15              | 1.2                            | 0.95            |
| II   | +0.30              | 1.4                            | 0.90            |
| III  | +0.45              | 1.6                            | 0.85            |

So a predator needs 1.40 / 1.55 / 1.70 × your mass to start, 1.25 / 1.40 / 1.55 × to continue, and
once you are sealed the wall dissolves 1.2 / 1.4 / 1.6 × slower (armour is slow to absorb; the cover
and wrap are unchanged, a wall does not wriggle). Engulf as predator: none, by design (a wall is
defensive). Visual: a second, brighter rim inside the first; rim thickness × 1.5 / 2 / 2.5. Audio: dull
thud on contact.

### Rung 2 — prokaryote organelles (`stage: 'prokaryote'`)

#### 3.4 Ribosome Studs `ribosomes` — metabolism, common, tags `metabolic`, no group, requires none

| Tier | digestionFactorBonus |
| ---- | -------------------- |
| I    | +0.10                |
| II   | +0.20                |
| III  | +0.30                |

Food motes are worth more mass. Visual: §3.0. Audio: gurgle on eat.

#### 3.5 Mitochondrion `mitochondrion` — metabolism, uncommon, tags `metabolic`, no group, requires none, `unlockedBy: { bacteriumVariant: 'aerobic', count: ENDOSYMBIOSIS_BACTERIA_REQUIRED }`. **Gate → `endosymbiosis`.**

| Tier | decayMultiplier | sprintSpeedMultiplierBonus |
| ---- | --------------- | -------------------------- |
| I    | 0.85            | +0.1                       |
| II   | 0.70            | +0.2                       |
| III  | 0.55            | +0.3                       |

The powerhouse: surplus mass burns slower and bursts are stronger. Unlocked by eating aerobic bacteria
(vent clusters). Visual: 1 / 2 / 3 orange-red beans with inner folds, pulsing on sprint. Audio: low
thrum on sprint.

#### 3.6 Chloroplast `chloroplast` — metabolism, common, tags `photic`, no group, requires none, `unlockedBy: { bacteriumVariant: 'photosynthetic', count: ENDOSYMBIOSIS_BACTERIA_REQUIRED }`. **Gate → `endosymbiosis`.**

| Tier | photosynthesisMassPerSecond | decayMultiplier |
| ---- | --------------------------- | --------------- |
| I    | 0.3                         | 0.9             |
| II   | 0.6                         | 0.8             |
| III  | 0.9                         | 0.7             |

Unlocked by eating photosynthetic bacteria (shallows clusters). Visual: green lenses in the cytoplasm
(1 / 2 / 3, each with 6 granules) and the membrane tint shifts toward green; they glow brighter inside
the shallows. Audio: warm shimmer on entering the shallows.

### Rung 3 — the true nucleus (`stage: 'endosymbiosis'`)

#### 3.7 Nuclear Envelope `nuclear_envelope` — genome, common, tags `armored metabolic`, no group, requires `nucleoid`. **Gate → `eukaryote`.**

| Tier | dnaKeptOnDeathFraction |
| ---- | ---------------------- |
| I    | 0.25                   |
| II   | 0.50                   |
| III  | 0.75                   |

Your genome is safe behind a membrane: dying keeps part of the progress toward the next level.
Visual: §3.0 (the nucleus appears); rim brightness per tier. Audio: deep chime on pick.

### Rung 4 — eukaryote organelles (`stage: 'eukaryote'`)

#### 3.8 Cytoskeleton Lattice `cytoskeleton` — locomotion, common, tags `motile armored`, no group, requires none

| Tier | accelerationSecondsMultiplier | struggleSlowdownBonus |
| ---- | ----------------------------- | --------------------- |
| I    | 0.85                          | +0.10                 |
| II   | 0.72                          | +0.20                 |
| III  | 0.61                          | +0.30                 |

Shape control: the cell turns and stops faster, and wriggles. As prey, steering away slows the cover
and wrap by 0.6 / 0.7 / 0.8 instead of 0.5 (ECOLOGY §6.1 struggle), and the faster acceleration breaks
contact sooner (T14). As predator: none, by design (wrapping is the pseudopods' job, §3.12, which
requires this trait). Visual: §3.0; a faint lattice under the membrane. Audio: taut snap on direction change.

#### 3.9 Cilia Fringe `cilia` — locomotion, common, tags `motile`, no group, requires none

| Tier | speedMultiplier | gripResistanceBonus |
| ---- | --------------- | ------------------- |
| I    | 1.10            | +0.05               |
| II   | 1.20            | +0.10               |
| III  | 1.30            | +0.15               |

As prey the beating hairs push against the wrapping membrane: the held speed factor is 0.85 / 0.90 /
0.95 instead of 0.8 (ECOLOGY §6.1), and the cruising speed breaks contact sooner (T15). As predator:
none, by design (cilia move the cell, they do not hold anything). Visual: a ring of short hairs on the
rim (24 / 36 / 48), beating in a travelling wave whose speed follows velocity. Silhouette: fuzzy edge.
Audio: soft flutter loop while moving.

#### 3.10 Food Vacuole `food_vacuole` — metabolism (offense), uncommon, tags `metabolic predatory`, no group, requires none

| Tier | absorbDurationMultiplierAsPredator | engulfMassYieldBonus |
| ---- | ---------------------------------- | -------------------- |
| I    | 0.80                               | +0.05                |
| II   | 0.64                               | +0.10                |
| III  | 0.51                               | +0.15                |

Enzymes: once sealed, prey dissolves faster and yields more; the cover and wrap are unchanged (a
vacuole digests, it does not grab). It is the predator's answer to armour: Food Vacuole III against a
Diatom Shell I dissolves it in 0.6 × 1.4 × 0.51 ≈ 0.43 s at the base ratio. As prey: none, by design.
Visual: 2 / 3 / 4 orange digestive vacuoles that bubble; prey dissolves visibly faster. Audio: gurgle on absorb.

#### 3.11 Toxin Vacuole `toxin_vacuole` — offense, rare, tags `toxic`, no group, requires none

| Tier | toxinDrainFractionPerSecond |
| ---- | --------------------------- |
| I    | 0.03                        |
| II   | 0.05                        |
| III  | 0.07                        |

A predator touching you loses mass every tick, and one that has wrapped you loses it six times as fast
(`ENGULF_SWALLOWED_TOXIN_MULTIPLIER`: 0.18 / 0.30 / 0.42 of its mass per second); when it drops below
`releaseRatio` you are ejected, sealed or not (base rule, ECOLOGY §6.1). Tier I frees you from a predator
up to 1.30 × your mass, tier III up to 1.60 × (T18); heavier ones finish before the poison bites, and the
mass they shed is gone for good. As predator: the vacuole drains the prey you touch like any other cell
(base rule) and nothing more, by design (poison is not a grip). Visual: one large violet vacuole pulsing
near the nucleus. Audio: hiss while draining.

### Rung 5 — the specialised forms (`stage: 'eukaryote'`, category `form`, group `body_plan`: one per cell). **Owning any form → `specialised`.**

#### 3.12 Amoeba Pseudopods `amoeba_pseudopods` — form, uncommon, tags `predatory motile`, requires `cytoskeleton`

| Tier | gelSpeedFactorFloor | wrapDurationMultiplierAsPredator | gripStrengthBonus |
| ---- | ------------------- | -------------------------------- | ----------------- |
| I    | 0.6                 | 0.85                             | +0.1              |
| II   | 0.8                 | 0.75                             | +0.2              |
| III  | 1.0                 | 0.65                             | +0.3              |

The gel is no shelter from an amoeba, and its pseudopods wrap prey faster and hold it: the wrap runs
at 0.85 / 0.75 / 0.65 of its base time and a wrapped prey's held speed factor is 0.7 / 0.6 / 0.5 instead
of 0.8 (ECOLOGY §6.1). The absorb phase is untouched (lobes grab, they do not digest: that is the Food
Vacuole). As prey: none, by design (lobes reach outward; a wrapped amoeba has only its cytoskeleton's
wriggle, which it owns by prerequisite). Visual: the membrane extrudes 2 / 3 / 4 blunt lobes toward the
velocity and toward any engulfed prey. Silhouette: irregular blob. Audio: wet stretch.

#### 3.13 Paramecium Cilia `paramecium_cilia` — form, uncommon, tags `motile`, requires `cilia`

| Tier | speedMultiplier | accelerationSecondsMultiplier | struggleSlowdownBonus |
| ---- | --------------- | ----------------------------- | --------------------- |
| I    | 1.10            | 0.90                          | +0.10                 |
| II   | 1.15            | 0.80                          | +0.15                 |
| III  | 1.20            | 0.70                          | +0.20                 |

The fastest thing in the dish, and the most agile: as prey it twists against the wrap (struggle
slowdown 0.6 / 0.65 / 0.7, stacking with the Cytoskeleton Lattice up to the 0.9 cap) on top of the
Cilia Fringe's slip it owns by prerequisite (T16). As predator: none, by design (a paramecium sweeps
motes into its groove; it has no pseudopods). Visual: the cell elongates into a slipper (aspect 1.6 /
1.8 / 2.0) fully covered in beating cilia, with an oral groove. Silhouette: slipper. Audio: rapid flutter.

#### 3.14 Euglena Eyespot `euglena_eyespot` — form, rare, tags `sensory photic`, requires `chloroplast`

| Tier | attractRangeInRadii | attractSpeed (wu/s) |
| ---- | ------------------- | ------------------- |
| I    | 3                   | 40                  |
| II   | 4                   | 60                  |
| III  | 5                   | 80                  |

The eyespot senses food and the flagellum steers into it: motes and DNA fragments inside the range
drift straight toward the centre (server side, seed-free, deterministic). Visual: a red eyespot at
the front, a long leading flagellum, green body. Silhouette: spindle with a red dot. Audio: low hum,
pitch rising with tier.

#### 3.15 Diatom Shell `diatom_shell` — form, uncommon, tags `armored`, requires `cell_wall`

| Tier | absorbDurationMultiplierAsPrey | spikeDrainFractionPerSecond | spitOutChancePerSecond | speedMultiplier |
| ---- | ------------------------------ | --------------------------- | ---------------------- | --------------- |
| I    | 1.4                            | 0.02                        | 0.4                    | 0.97            |
| II   | 1.8                            | 0.04                        | 0.7                    | 0.94            |
| III  | 2.2                            | 0.06                        | 1.0                    | 0.91            |

A silica frustule: slow to dissolve, it cuts the swallower, and its spines make it hard to keep down.
Once wrapped or sealed, every tick rolls `spitOutChancePerSecond × TICK_INTERVAL_S` (0.0067 / 0.0117 /
0.0167) from the `engulf` stream; over an unaided base-ratio engulf (24 wrap ticks + 36 × 1.4 / 1.8 /
2.2 absorb ticks) that is a 39 % / 65 % / 83 % chance of being spat out, and the Cell Wall it requires
stacks its own absorb multiplier on top. As predator: none, by design (a shell is worn, not wielded).
Visual: a geometric glassy shell with 8 / 12 / 16 radial spines, each with a bright tip. Silhouette:
star. Audio: scrape while being engulfed, a wet cough on spit-out.

#### 3.16 Stentor Trumpet `stentor_trumpet` — form, rare, tags `toxic metabolic`, requires `toxin_vacuole`

| Tier | toxinAuraRangeInRadii | digestionFactorBonus |
| ---- | --------------------- | -------------------- |
| I    | 1.0                   | +0.10                |
| II   | 1.5                   | +0.20                |
| III  | 2.0                   | +0.30                |

A trumpet-shaped giant whose pigment poisons everything nearby and whose funnel feeds it more from
every mote. The aura reuses the toxin vacuole's drain at range. Visual: a flared trumpet body with a
ciliated rim and a faint violet haze to `toxinAuraRangeInRadii`. Silhouette: trumpet. Audio: hiss plus
a low drone.

### 3.17 Exclusions and pairings at a glance

| Group       | Members                                                                             | Rule         |
| ----------- | ----------------------------------------------------------------------------------- | ------------ |
| `body_plan` | Amoeba Pseudopods, Paramecium Cilia, Euglena Eyespot, Diatom Shell, Stentor Trumpet | one per cell |
| `membrane`  | Cell Wall (build 1); Sticky Coat, Glass Membrane (§4)                               | one per cell |
| none        | the other ten                                                                       | stackable    |

The `primary_locomotion` group of §4 has no build-1 member: the simple flagellum and the cilia stack
(sprint burst versus cruising speed).

Distinguishability at small sizes (the graphics sign-off in #25): every rung and every form owns one
silhouette change (nucleus-free blob / thread / tail / double rim / stipple / bean / lens / bounded
nucleus / taut outline / fuzzy edge / orange bubbles / violet pulse / lobes / slipper / spindle + red
dot / star / trumpet) so a level-1 protocell at 18 wu radius still reads at the zoomed-out camera.

### 3.18 Engulf effects at a glance

The direction from decision #139: every trait helps where it plausibly should and nowhere else. One row
per build-1 trait; the process and its hooks are [`ECOLOGY.md §6.1`](./ECOLOGY.md#61-rules). "Emergent"
means the effect comes through the base rules (speed breaks contact, sprint breaks it faster) with no
engulf field set; "none, by design" carries its reason. Tier I / II / III values.

| Trait                | As predator                                                                                                                          | As prey                                                                                                                                                                                                                             | Phases touched         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Nucleoid Coil        | none on the process, by design (a genome reads DNA); the payout's DNA is × 1.05 / 1.10 / 1.15 like every gain (§2)                   | none, by design (genes do not wriggle)                                                                                                                                                                                              | payout only            |
| Simple Flagellum     | none, by design (a tail chases; the wrap is the membrane's)                                                                          | emergent: sprint × 2.1 / 2.4 / 2.7 instead of 1.8 breaks contact sooner and the cooldown comes back faster (T17)                                                                                                                    | cover, wrap (movement) |
| Cell Wall            | none, by design (a wall is defensive)                                                                                                | `membraneRatioBonus` +0.15 / +0.30 / +0.45 (harder to start and to hold); `absorbDurationMultiplierAsPrey` 1.2 / 1.4 / 1.6 (slow to dissolve)                                                                                       | eligibility, absorb    |
| Ribosome Studs       | none, by design (ribosomes digest motes; enzymes for prey are the Food Vacuole's, so this must not shorten the absorb)               | none, by design                                                                                                                                                                                                                     | —                      |
| Mitochondrion        | none, by design (it is fuel, not a grip)                                                                                             | emergent: sprint × 1.9 / 2.0 / 2.1 breaks contact sooner (T19); slower decay keeps a big prey above the predator's ratio a little longer                                                                                            | cover, wrap (movement) |
| Chloroplast          | none, by design (light does not digest)                                                                                              | none, by design (light does not free you)                                                                                                                                                                                           | —                      |
| Nuclear Envelope     | none, by design                                                                                                                      | none on the process, by design; after absorption `dnaKeptOnDeathFraction` 0.25 / 0.50 / 0.75 of the progress survives (T12)                                                                                                         | after payout           |
| Cytoskeleton Lattice | none, by design (wrapping is the pseudopods' job, which require it)                                                                  | `struggleSlowdownBonus` +0.10 / +0.20 / +0.30 (steering away slows the wrap by 0.6 / 0.7 / 0.8) and the faster acceleration breaks contact sooner (T14)                                                                             | cover, wrap            |
| Cilia Fringe         | none, by design (cilia move, they do not hold)                                                                                       | `gripResistanceBonus` +0.05 / +0.10 / +0.15 (held speed factor 0.85 / 0.90 / 0.95) plus the cruising speed (T15)                                                                                                                    | wrap                   |
| Food Vacuole         | `absorbDurationMultiplierAsPredator` 0.80 / 0.64 / 0.51 and `engulfMassYieldBonus` +0.05 / +0.10 / +0.15 (T6)                        | none, by design                                                                                                                                                                                                                     | absorb, payout         |
| Toxin Vacuole        | the base drain on the prey it touches, nothing more, by design (poison is not a grip)                                                | `toxinDrainFractionPerSecond` 0.03 / 0.05 / 0.07 counts × 6 once wrapped (0.18 / 0.30 / 0.42 of the predator's mass per second) until the ratio fails and it ejects you: beats predators up to 1.30 / 1.40 / 1.60 × your mass (T18) | wrap, absorb (ratio)   |
| Amoeba Pseudopods    | `wrapDurationMultiplierAsPredator` 0.85 / 0.75 / 0.65 and `gripStrengthBonus` +0.1 / +0.2 / +0.3 (held factor 0.7 / 0.6 / 0.5) (T13) | none, by design (its wriggle is the Cytoskeleton Lattice it requires)                                                                                                                                                               | wrap                   |
| Paramecium Cilia     | none, by design (a groove sweeps motes; no pseudopods)                                                                               | `struggleSlowdownBonus` +0.10 / +0.15 / +0.20, on top of the Cilia Fringe's slip and its own speed and acceleration (T16)                                                                                                           | cover, wrap            |
| Euglena Eyespot      | none, by design (it senses motes; a wrapped cell is not a mote)                                                                      | none, by design                                                                                                                                                                                                                     | —                      |
| Diatom Shell         | none, by design (a shell is worn, not wielded)                                                                                       | `absorbDurationMultiplierAsPrey` 1.4 / 1.8 / 2.2, `spikeDrainFractionPerSecond` 0.02 / 0.04 / 0.06, `spitOutChancePerSecond` 0.4 / 0.7 / 1.0 (T4); stacks on the Cell Wall it requires                                              | wrap, absorb, ratio    |
| Stentor Trumpet      | the aura drains a prey before contact like any cell in range (base rule), nothing more, by design                                    | none beyond the Toxin Vacuole it requires, by design (the aura is outside the membrane; only the vacuole's drain is swallowed)                                                                                                      | —                      |

Held together: a prey's escape scales with how much of the ladder it spent on moving (flagellum,
cilia, cytoskeleton, paramecium), its resistance with how much it spent on armour and poison (cell
wall, diatom, toxin), and a predator's success with the two organelles that grab and digest (amoeba,
food vacuole) plus its mass. Nothing metabolic, genomic or sensory touches the process.

## 4. Later traits (build 2+, one line each)

Named now so ids, tags and groups are reserved. Not offered in build 1.

| Id                       | Name                   | Category   | Tags             | One-liner                                                                                |
| ------------------------ | ---------------------- | ---------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `jet_siphon`             | Jet Siphon             | locomotion | motile           | Sprint becomes a long burst that ejects a mass trail; group `primary_locomotion`.        |
| `sticky_coat`            | Sticky Coat            | membrane   | predatory        | `gripStrengthBonus` on a membrane (the wrap holds harder); group `membrane`.             |
| `glass_membrane`         | Glass Membrane         | membrane   | sensory          | Nearly invisible when still; renders at 30 % alpha; group `membrane`.                    |
| `fat_vacuole`            | Fat Vacuole            | metabolism | metabolic        | Stores 20 % of eaten mass in a reserve immune to decay, spent on sprint.                 |
| `iron_gut`               | Iron Gut               | metabolism | metabolic        | Detritus worth double; decay in the vent unaffected.                                     |
| `wide_eyespot`           | Wide Eyespot           | sensory    | sensory          | `CAMERA_VIEW_RADII` + 3 per tier for this player.                                        |
| `chemotaxis_trails`      | Chemotaxis Trails      | sensory    | sensory motile   | Shows fading trails of nearby cells and fragment scent gradients.                        |
| `enzyme_cloud`           | Enzyme Cloud           | offense    | toxic metabolic  | Toggle a short-lived cloud that digests motes at range into DNA.                         |
| `lunge_reflex`           | Lunge Reflex           | offense    | predatory motile | Sprint toward a prey in contact skips the cover phase (progress jumps to the wrap band). |
| `regenerative_cytoplasm` | Regenerative Cytoplasm | defense    | metabolic        | After escaping an engulf, regain the mass lost to spikes/toxin over 5 s.                 |
| `emergency_fission`      | Emergency Fission      | defense    | motile           | Auto-split when engulf progress passes 0.7 (needs mitosis).                              |
| `decoy_vacuole`          | Decoy Vacuole          | defense    | toxic            | Eject a look-alike mass blob that predators' engulf targets first.                       |
| `split_nucleus`          | Split Nucleus          | colony     | metabolic        | Enables mitosis at `MITOSIS_MIN_MASS`; the gateway trait for multi-cell.                 |
| `bond_filaments`         | Bond Filaments         | colony     | armored          | Daughter cells stay bonded (springs); bond strength per tier.                            |
| `specialisation_node`    | Specialisation Node    | colony     | sensory          | A bonded cell may take a role: motor, sensor, digestive, armour.                         |
| `colony_chorus`          | Colony Chorus          | colony     | photic sensory   | Colony-level level-ups draft a shared trait for every member.                            |

## 5. Constants table — `packages/shared/src/constants/traits.ts`

| Constant                        | Value                                                    | Unit  |
| ------------------------------- | -------------------------------------------------------- | ----- |
| `TRAIT_CATALOG`                 | the sixteen definitions of §3 (`as const`), rung order   | —     |
| `TRAIT_TIERS`                   | the tier tables of §3, keyed by id                       | —     |
| `TRAIT_TIER_COUNT`              | 3                                                        | tiers |
| `RESERVED_TRAIT_IDS`            | the sixteen ids of §4                                    | ids   |
| `EXCLUSION_GROUPS`              | `body_plan`, `membrane`, `primary_locomotion` (reserved) | ids   |
| `SPRINT_COOLDOWN_FLOOR_SECONDS` | 0.5                                                      | s     |
| `DEFAULT_CELL_MODIFIERS`        | the identity record of §2                                | —     |

The ladder constants (`STAGE_ORDER`, `STAGE_GATE_TRAITS`, `ENDOSYMBIOSIS_BACTERIA_REQUIRED`) live in
`ladder.ts` ([`GAME-DESIGN.md §12`](./GAME-DESIGN.md#12-constants-table)).

## 6. Acceptance scenarios

Given seed S and inputs I, after N ticks assert X. Conventions (placement, pinning, decay in expected
values, fixture-granted traits) as in [`ECOLOGY.md §8`](./ECOLOGY.md#8-acceptance-scenarios). The
engulf rows (T3, T4, T6, T13–T19) were recomputed from the §6.1 step order for #145; the sprint they
lean on is the base `SPRINT_SPEED_MULTIPLIER` 1.8 for 0.5 s. Level costs and
`ENDOSYMBIOSIS_BACTERIA_REQUIRED` are #144's (slow dawn); T12's cost literal follows
[`PROGRESSION.md §2`](./PROGRESSION.md#2-level-thresholds) and nothing else here depends on them.

| #   | Given                                                                                                                                                         | Inputs                                               | After     | Assert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | pure `foldModifiers`: Cilia Fringe I + Cell Wall I + Cytoskeleton Lattice I                                                                                   | —                                                    | —         | `speedMultiplier` = 1.045 (1.10 × 0.95), `accelerationSecondsMultiplier` = 0.85, `membraneRatioBonus` = 0.15, all else default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T2  | seed 42, player mass 20 with Cilia Fringe I, placed at the origin (spawners off; ≈ 484 wu of travel stays inside the vent, no wall or gel)                    | target 5 radii east                                  | 120 ticks | speed within 0.5 wu/s of 242.0 (no decay at starting mass; blend converged as in E6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T3  | seed 42, B mass 20 with Cell Wall I; A placed 5 wu away at mass 28, then 29                                                                                   | idle                                                 | 120 ticks | mass 28: no engulf (after tick-1 decay A < 28.0 = 1.40 × 20); mass 29: engulf from tick 1, held throughout (A ≥ 25 = 1.25 × 20 release), `massFactor` = 25 / A ≈ 0.862; cover ends tick 11, seal on tick 32, absorb at × 1.2: B absorbed on tick 69 (tick 63 without the wall's absorb multiplier); A mass ≈ 44.98 after payout.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T4  | ECOLOGY E9 setup, B has Diatom Shell I (fixture-granted; the Cell Wall it requires is not granted, so the ratio is the base one)                              | idle                                                 | 120 ticks | cover 1–6, seal on tick 18, absorb at 1/(36 × 1.4) per tick would pay out on tick 44. From tick 7 the `engulf` stream is drawn once per tick (chance 0.4 / 60 ≈ 0.006667); draws 1–32 are all ≥ 0.0244, draw 33 = 0.001886 < 0.006667 → B spat out on tick 39 (`cell_released` reason `spat_out`), B `free`, progress 0, A absorptions = 0. A paid the spike drain (0.02/s of its mass) on ticks 2–39 plus base decay: A mass ≈ 98.64. A's refractory on B lasts to tick 99; separation runs meanwhile (overlap 47.89 wu × 0.8 per tick ≈ 0 after 60 ticks), so at tick 120 the centres are ≈ 57.9 wu apart (> the 31.06 wu contact bound) and no engulf has restarted. With Diatom Shell III (chance 1.0 / 60): the same draw 33 spits B out on tick 39. |
| T5  | seed 42, player mass 20 with Chloroplast I, placed in the shallows / broth                                                                                    | idle                                                 | 60 ticks  | shallows: mass ≈ 20.2997 (0.3 gained, minus the decay of the growing surplus; ± 0.001); broth: mass = 20.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T6  | ECOLOGY E9 setup, A has Food Vacuole I. Separately: player mass 20 with Ribosome Studs I eats a placed algae                                                  | idle                                                 | 33 ticks  | cover and wrap as E9 (seal on tick 18: the vacuole does not touch them), absorb at 1/(36 × 0.8) per tick: B absorbed on tick 33; A mass = `decayed(100, 33)` + 20 × 0.85 ≈ 116.91. Ribosomes: mass ≈ 21.10 on tick 1 (algae worth 1.1, then one tick of decay); Ribosome Studs on A in the E9 setup changes nothing about tick 36 (T20).                                                                                                                                                                                                                                                                                                                                                                                                                  |
| T7  | seed 42, B mass 100 with Toxin Vacuole I and C mass 90 placed 10 wu apart, both pinned (no engulf possible: 100 < 112.5)                                      | idle                                                 | 60 ticks  | C mass ≈ 87.20 (0.03/s toxin plus base decay, 60 ticks); B mass = `decayed(100, 60)` ≈ 99.84.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| T8  | seed 42, player mass 20 with Euglena Eyespot I, pinned; algae placed at 2.5 radii and at 4 radii east                                                         | idle                                                 | 60 ticks  | the 2.5-radii mote was eaten (drifted 40 wu/s inward, ≈ 40 ticks); the 4-radii mote has not moved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| T9  | seed 42, player mass 20 with Simple Flagellum I                                                                                                               | sprint at tick 1, again at tick 151                  | 152 ticks | tick 2 speed cap = 231 × 2.1; second sprint accepted at tick 151 (cooldown 2.5 s = 150 ticks from tick 1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| T10 | pure catalog test                                                                                                                                             | —                                                    | —         | every trait has 3 tiers, unique id, at least one tag, a visual and an audio cue; §4 ids are not in `TRAIT_CATALOG`; every `requires` id is in the catalog with a stage no later than the trait's own.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T11 | pure ladder test                                                                                                                                              | —                                                    | —         | every stage after `protocell` has ≥ 1 gate trait in `STAGE_GATE_TRAITS`, and each gate's `stage` is the previous stage; both endosymbionts carry `unlockedBy` with count `ENDOSYMBIOSIS_BACTERIA_REQUIRED`; exactly the five forms share `body_plan`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T12 | seed 42, player at level 5 (cost 60, so 40 does not level up on tick 1) with Nuclear Envelope II, `dnaTowardNextLevel` 40, engulfed by a placed 100-mass cell | idle                                                 | respawn+1 | `dnaTowardNextLevel` = 20 (50 % kept), level, traits and stage unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T13 | ECOLOGY E9 setup, A has Amoeba Pseudopods III (fixture-granted, cytoskeleton not granted)                                                                     | idle; then B sprints away at tick 10; then at tick 7 | 120 ticks | idle: wrap at 1/(36 × 0.65) per tick, seal on tick 14 (progress ≈ 0.5085), absorb at 1/36, B absorbed on tick 32; A mass ≈ 115.91. Sprint at tick 10 (E11's input, which escapes a plain predator): held factor 0.5 (0.8 − 0.3), B never breaks contact, sealed on tick 19, absorbed on tick 37. Sprint at tick 7: contact breaks tick 22, released tick 27. With Amoeba I instead, sprint at tick 10 escapes (contact breaks tick 22, released tick 27).                                                                                                                                                                                                                                                                                                 |
| T14 | ECOLOGY E9 setup, B has Cytoskeleton Lattice III                                                                                                              | B steers away from tick 16 (no sprint)               | 120 ticks | slowdown 0.8 (0.5 + 0.3): the wrap runs at 1/180 per tick from tick 16; acceleration 0.1525 s; contact breaks on tick 29, released on tick 34, B alive at tick 120. Without the trait the same input is sealed on tick 21 and absorbed on tick 39. Steering from tick 10: contact breaks tick 23, released tick 25 (plain: 26 / 31).                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T15 | ECOLOGY E9 setup, B has Cilia Fringe III                                                                                                                      | B steers away from tick 12 (no sprint)               | 120 ticks | held factor 0.95 (0.8 + 0.15), cap 220 × 1.3 × 0.95 = 271.7 wu/s: contact breaks on tick 24, released on tick 29. Without the trait the same input is sealed on tick 25 and absorbed on tick 43.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T16 | ECOLOGY E9 setup, B has Paramecium Cilia III and Cilia Fringe I                                                                                               | B steers away from tick 15 (no sprint)               | 120 ticks | slowdown 0.7, held factor 0.85, speed × 1.32, acceleration 0.175 s: contact breaks on tick 26, released on tick 31. A plain prey steering from tick 15 is absorbed (its window closes at tick 10, E11).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T17 | ECOLOGY E9 setup, B has Simple Flagellum III                                                                                                                  | B sprints away at tick 14                            | 120 ticks | cap 220 × 1.05 × 2.7 × 0.8 = 499 wu/s: contact breaks on tick 23, released on tick 28. A plain prey sprinting at tick 14 is sealed on tick 23 and absorbed on tick 41 (E11). Flagellum I sprinting at tick 13: contact breaks tick 23, released tick 28 (plain: 24 / 29).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T18 | seed 42, B mass 80 with Toxin Vacuole I, A placed 10 wu east at mass 101 (≥ 100 = 1.25 × 80 after tick-1 decay)                                               | idle                                                 | 72 ticks  | engulf from tick 1 (`massFactor` ≈ 0.99); A drains 0.03/s of its mass in cover (contact), 0.18/s from tick 13 (wrap: × 6); seal on tick 36; A falls below 1.10 × B on tick 56 (A ≈ 87.83 < 87.88) → released from absorb (`ratio`), no payout, B `free`. Without the toxin A absorbs B on tick 72. Toxin Vacuole III with A at 128 (1.6 ×): released on tick 62.                                                                                                                                                                                                                                                                                                                                                                                          |
| T19 | ECOLOGY E9 setup, B has Mitochondrion III                                                                                                                     | B sprints away at tick 13                            | 120 ticks | sprint × 2.1: contact breaks on tick 23, released on tick 28 (plain prey: tick 24 / tick 29). No engulf field is set: the help is the sprint alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| T20 | pure catalog test                                                                                                                                             | —                                                    | —         | Nucleoid Coil, Simple Flagellum, Ribosome Studs, Mitochondrion, Chloroplast, Nuclear Envelope, Euglena Eyespot and Stentor Trumpet set none of `membraneRatioBonus`, `absorbDurationMultiplierAsPrey`, `wrapDurationMultiplierAsPredator`, `absorbDurationMultiplierAsPredator`, `gripStrengthBonus`, `gripResistanceBonus`, `struggleSlowdownBonus`, `spitOutChancePerSecond`, `spikeDrainFractionPerSecond`, `engulfMassYieldBonus` at any tier; each of those fields is set by exactly the traits §3.18 names for it.                                                                                                                                                                                                                                  |
