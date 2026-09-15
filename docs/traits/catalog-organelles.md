# Evolution — Trait Catalog v1 (the ladder): build-1 catalog: rungs 1 to 4

§3–§3.11 of the split [`TRAITS.md`](../TRAITS.md), which keeps the shared context and the file list.

## 3. Build-1 catalog (sixteen traits, fully specified)

Tier columns give the _value of the modifiers this tier sets_; unlisted modifiers stay at default.
Constants are the tier tables themselves (`TRAIT_TIERS.cilia[0]` etc.), no loose literals. Headings
give: category, rarity, tags, exclusion group, `stage`, `requires`.

### 3.0 What each stage looks like

The protocell is the level-1 baseline; every rung adds something the renderer must show
(`render/cell-layer.ts`, [`ARCHITECTURE.md`](../ARCHITECTURE.md)):

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

Unlocked by eating photosynthetic bacteria (shallows clusters). Light feeds a small cell and plateaus:
in the shallows mass settles at 186.67 / 395 / 662.86 (where the gain meets decay,
ecology/mass-and-movement.md §4.1), and like any gain it is capped at `CELL_MAX_MASS` with the overflow
paid as DNA. Idling on the plateau is a turtle, not a winning line (#119): mass is not score
([`game-design/session.md §5.3`](../game-design/session.md#53-leaderboard-and-score)), and a
663-mass cell that never eats earns nothing on the leaderboard. Visual: green lenses in the cytoplasm
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
and wrap by 0.6 / 0.7 / 0.8 instead of 0.5 (ecology/absorption.md §6.1 struggle), and the faster acceleration breaks
contact sooner (T14). As predator: none, by design (wrapping is the pseudopods' job, §3.12, which
requires this trait). Visual: §3.0; a faint lattice under the membrane. Audio: taut snap on direction change.

#### 3.9 Cilia Fringe `cilia` — locomotion, common, tags `motile`, no group, requires none

| Tier | speedMultiplier | gripResistanceBonus |
| ---- | --------------- | ------------------- |
| I    | 1.10            | +0.05               |
| II   | 1.20            | +0.10               |
| III  | 1.30            | +0.15               |

As prey the beating hairs push against the wrapping membrane: the held speed factor is 0.85 / 0.90 /
0.95 instead of 0.8 (ecology/absorption.md §6.1), and the cruising speed breaks contact sooner (T15). As predator:
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

A predator touching you loses that share of its own mass every second. One that has wrapped you takes a
dose set by **your** mass instead (`ENGULF_SWALLOWED_TOXIN_MULTIPLIER` = 8: 0.24 / 0.40 / 0.56 × your mass
per second, #154); when it drops below `releaseRatio` you are ejected, sealed or not (base rule,
ecology/absorption.md §6.1). Tier I / II / III frees you from a predator up to ≈ 1.34 / 1.49 / 1.62 × your
mass (T18); heavier ones finish before the poison bites, the mass they shed is gone for good, and
because the dose does not grow with the predator, a completed meal of a prey whose only defence is the
toxin always pays: a 5 × predator eating a Toxin Vacuole III prey of 100 sheds ≈ 31 and gains 80 (T21).
Armour stacked on the toxin can still make a completed meal cost more than it yields (§3.17, T22). As predator: the vacuole drains the
prey you touch like any other cell (base rule) and nothing more, by design (poison is not a grip).
Visual: one large violet vacuole pulsing near the nucleus. Audio: hiss while draining.
