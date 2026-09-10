# Evolution — Trait Catalog v1

Ticket: #25. Epic #2. How traits are offered: [`PROGRESSION.md §3`](./PROGRESSION.md#3-draft-pool-and-weights).
Base rules the modifiers act on: [`ECOLOGY.md`](./ECOLOGY.md) and [`GDD.md §4`](./GDD.md#4-controls).
Visual language (colours, membrane, organelles): `docs/VISUAL-STYLE.md` (#34) and the concept sheets
(#104–#106); this doc says _what_ each trait must show, not how it is drawn.

Build 1 ships the eight traits in §3 at three tiers each. §4 names the later traits so tags, exclusion
groups and the modifier model already account for them. Machine-readable form: the catalog is an
`as const` array in `packages/shared/src/constants/traits.ts` (if #72 adopts `data/traits.json`, that
file is generated from the same definitions and a test pins them equal).

## 1. Definition shape

```ts
interface TraitDefinition {
  id: TraitId; // snake_case, full words
  name: string; // evocative, two words
  category: 'locomotion' | 'membrane' | 'metabolism' | 'sensory' | 'offense' | 'defense' | 'colony';
  rarity: 'common' | 'uncommon' | 'rare';
  tags: DnaTag[]; // draft weighting, PROGRESSION §3
  exclusionGroup?: 'primary_locomotion' | 'membrane';
  minLevel: number; // first level at which it can be offered
  tiers: [CellModifiers, CellModifiers, CellModifiers]; // partial modifier sets, tier I..III
  visual: string; // what the renderer must show, per tier
  audioCue: SoundEventId; // hook only in build 1 (#101)
}
```

## 2. Modifier model

Every trait tier is a partial `CellModifiers`. The cell's effective modifiers are folded over all
owned traits at their current tier: **multipliers multiply, bonuses and deltas add**, defaults are
the identity. The simulation reads only the folded record, never the trait list.

| Modifier                             | Default | Applied where                                                                                    |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------ |
| `speedMultiplier`                    | 1       | `traitSpeedFactor` in the movement step (ECOLOGY §5.2)                                           |
| `accelerationSecondsMultiplier`      | 1       | `CELL_ACCELERATION_SECONDS`                                                                      |
| `sprintSpeedMultiplierBonus`         | 0       | added to `SPRINT_SPEED_MULTIPLIER`                                                               |
| `sprintCooldownSecondsDelta`         | 0       | added to `SPRINT_COOLDOWN_SECONDS` (floor 0.5 s)                                                 |
| `membraneRatioBonus`                 | 0       | `requiredRatio` when this cell is prey (ECOLOGY §6.1)                                            |
| `engulfDurationMultiplierAsPrey`     | 1       | `durationS` when this cell is prey                                                               |
| `engulfDurationMultiplierAsPredator` | 1       | `durationS` when this cell is predator                                                           |
| `engulfMassYieldBonus`               | 0       | added to `ENGULF_MASS_YIELD` (cap 1)                                                             |
| `digestionFactorBonus`               | 0       | food mass × (1 + bonus)                                                                          |
| `decayMultiplier`                    | 1       | mass decay (ECOLOGY §4)                                                                          |
| `photosynthesisMassPerSecond`        | 0       | gained per second while inside `sunlit_shallows`                                                 |
| `spikeDrainFractionPerSecond`        | 0       | predator engulfing this cell loses this × its mass per second                                    |
| `toxinDrainFractionPerSecond`        | 0       | other cells overlapping this cell lose this × their mass per second (floor `CELL_STARTING_MASS`) |
| `toxinAuraRadii`                     | 0       | toxin also applies within this × radius without contact                                          |
| `attractRadii`                       | 0       | motes within this × radius drift toward the cell                                                 |
| `attractSpeed`                       | 0       | wu/s of that drift                                                                               |

Drained mass is lost to the dish (it is not transferred). Toxin and spikes never kill: they stop at
`CELL_STARTING_MASS`; their job is to break the engulf ratio.

## 3. Build-1 catalog (eight traits, fully specified)

Tier columns give the _value of the modifiers this tier sets_; unlisted modifiers stay at default.
Constants are the tier tables themselves (`TRAIT_TIERS.cilia_fringe[0]` etc.), no loose literals.

### 3.1 Cilia Fringe — locomotion, common, tags `motile`, group `primary_locomotion`, minLevel 2

| Tier | speedMultiplier | accelerationSecondsMultiplier |
| ---- | --------------- | ----------------------------- |
| I    | 1.10            | 0.85                          |
| II   | 1.20            | 0.72                          |
| III  | 1.30            | 0.61                          |

Visual: a ring of short hairs on the rim (24 / 36 / 48), beating in a travelling wave whose speed
follows velocity. Silhouette: fuzzy edge. Audio: soft flutter loop while moving.

### 3.2 Whip Flagellum — locomotion, uncommon, tags `motile predatory`, group `primary_locomotion`, minLevel 2

| Tier | speedMultiplier | sprintSpeedMultiplierBonus | sprintCooldownSecondsDelta |
| ---- | --------------- | -------------------------- | -------------------------- |
| I    | 1.05            | +0.3                       | −0.5                       |
| II   | 1.05            | +0.6                       | −1.0                       |
| III  | 1.05            | +0.9                       | −1.5                       |

Visual: one long tail trailing opposite the velocity, sine wave with amplitude growing per tier;
tier III adds a second tail. Silhouette: teardrop. Audio: whip crack on sprint.

### 3.3 Thick Membrane — membrane, common, tags `armored`, group `membrane`, minLevel 2

| Tier | membraneRatioBonus | speedMultiplier |
| ---- | ------------------ | --------------- |
| I    | +0.15              | 0.95            |
| II   | +0.30              | 0.90            |
| III  | +0.45              | 0.85            |

So a predator needs 1.40 / 1.55 / 1.70 × your mass. Visual: a second, brighter rim inside the first;
rim thickness × 1.5 / 2 / 2.5. Audio: dull thud on contact.

### 3.4 Barbed Spikes — membrane (offense), uncommon, tags `armored predatory`, group `membrane`, minLevel 2

| Tier | engulfDurationMultiplierAsPrey | spikeDrainFractionPerSecond | speedMultiplier |
| ---- | ------------------------------ | --------------------------- | --------------- |
| I    | 1.4                            | 0.02                        | 0.97            |
| II   | 1.8                            | 0.04                        | 0.94            |
| III  | 2.2                            | 0.06                        | 0.91            |

Visual: 8 / 12 / 16 triangular barbs on the rim, each with a bright tip. Silhouette: star.
Audio: scrape while being engulfed.

### 3.5 Chloroplast Pigment — metabolism, common, tags `photic`, no group, minLevel 2

| Tier | photosynthesisMassPerSecond | decayMultiplier |
| ---- | --------------------------- | --------------- |
| I    | 0.3                         | 0.9             |
| II   | 0.6                         | 0.8             |
| III  | 0.9                         | 0.7             |

Visual: green granules in the cytoplasm (6 / 12 / 18) and the membrane tint shifts toward green;
granules glow brighter inside the shallows. Audio: warm shimmer on entering the shallows.

### 3.6 Ravenous Enzymes — metabolism (offense), uncommon, tags `metabolic predatory`, no group, minLevel 2

| Tier | engulfDurationMultiplierAsPredator | engulfMassYieldBonus | digestionFactorBonus |
| ---- | ---------------------------------- | -------------------- | -------------------- |
| I    | 0.80                               | +0.05                | +0.10                |
| II   | 0.64                               | +0.10                | +0.20                |
| III  | 0.51                               | +0.15                | +0.30                |

Visual: 2 / 3 / 4 orange digestive vacuoles that bubble; prey dissolves visibly faster.
Audio: gurgle on eat.

### 3.7 Toxin Vacuole — offense, rare, tags `toxic`, no group, minLevel 4

| Tier | toxinDrainFractionPerSecond | toxinAuraRadii |
| ---- | --------------------------- | -------------- |
| I    | 0.03                        | 0              |
| II   | 0.05                        | 0              |
| III  | 0.07                        | 1.5            |

A predator wrapping you loses mass every tick; when it drops below `requiredRatio` you are released
(base rule, ECOLOGY §6.1). Visual: one large violet vacuole pulsing near the nucleus; tier III adds a
faint violet haze to `toxinAuraRadii`. Audio: hiss while draining.

### 3.8 Lodestone Core — sensory, rare, tags `sensory metabolic`, no group, minLevel 4

| Tier | attractRadii | attractSpeed (wu/s) |
| ---- | ------------ | ------------------- |
| I    | 3            | 40                  |
| II   | 4            | 60                  |
| III  | 5            | 80                  |

Motes and DNA fragments inside the radius drift straight toward the centre (server side, seeded-free,
deterministic). Visual: a dense dark nucleus with 3 / 5 / 7 bright flecks orbiting it. Audio: low hum,
pitch rising with tier.

### 3.9 Exclusions and pairings at a glance

| Group                | Members                       | Rule             |
| -------------------- | ----------------------------- | ---------------- |
| `primary_locomotion` | Cilia Fringe, Whip Flagellum  | one per cell     |
| `membrane`           | Thick Membrane, Barbed Spikes | one per cell     |
| none                 | the other four                | freely stackable |

Distinguishability at small sizes (the graphics sign-off in #25): each trait owns one silhouette
change (fuzzy / teardrop / double rim / star / green tint / orange bubbles / violet pulse / dark
core) so a level-1 cell at 18 wu radius still reads at the zoomed-out camera.

## 4. Later traits (build 2+, one line each)

Named now so ids, tags and groups are reserved. Not offered in build 1.

| Id                       | Name                   | Category   | Tags             | One-liner                                                                         |
| ------------------------ | ---------------------- | ---------- | ---------------- | --------------------------------------------------------------------------------- |
| `pseudopod_crawl`        | Pseudopod Crawl        | locomotion | motile armored   | Slow but ignores gel entirely; group `primary_locomotion`.                        |
| `jet_siphon`             | Jet Siphon             | locomotion | motile           | Sprint becomes a long burst that ejects a mass trail; group `primary_locomotion`. |
| `sticky_coat`            | Sticky Coat            | membrane   | predatory        | Prey in contact gets `ENGULF_PREY_SPEED_FACTOR` halved; group `membrane`.         |
| `glass_membrane`         | Glass Membrane         | membrane   | sensory          | Nearly invisible when still; renders at 30 % alpha; group `membrane`.             |
| `fat_vacuole`            | Fat Vacuole            | metabolism | metabolic        | Stores 20 % of eaten mass in a reserve immune to decay, spent on sprint.          |
| `iron_gut`               | Iron Gut               | metabolism | metabolic        | Detritus worth double; decay in the vent unaffected.                              |
| `wide_eyespot`           | Wide Eyespot           | sensory    | sensory          | `CAMERA_VIEW_RADII` + 3 per tier for this player.                                 |
| `chemotaxis_trails`      | Chemotaxis Trails      | sensory    | sensory motile   | Shows fading trails of nearby cells and fragment scent gradients.                 |
| `enzyme_cloud`           | Enzyme Cloud           | offense    | toxic metabolic  | Toggle a short-lived cloud that digests motes at range into DNA.                  |
| `lunge_reflex`           | Lunge Reflex           | offense    | predatory motile | Sprint toward a prey in contact instantly fills 25 % engulf progress.             |
| `regenerative_cytoplasm` | Regenerative Cytoplasm | defense    | metabolic        | After escaping an engulf, regain the mass lost to spikes/toxin over 5 s.          |
| `emergency_fission`      | Emergency Fission      | defense    | motile           | Auto-split when engulf progress passes 0.7 (needs mitosis).                       |
| `decoy_vacuole`          | Decoy Vacuole          | defense    | toxic            | Eject a look-alike mass blob that predators' engulf targets first.                |
| `split_nucleus`          | Split Nucleus          | colony     | metabolic        | Enables mitosis at `MITOSIS_MIN_MASS`; the gateway trait for multi-cell.          |
| `bond_filaments`         | Bond Filaments         | colony     | armored          | Daughter cells stay bonded (springs); bond strength per tier.                     |
| `specialisation_node`    | Specialisation Node    | colony     | sensory          | A bonded cell may take a role: motor, sensor, digestive, armour.                  |
| `colony_chorus`          | Colony Chorus          | colony     | photic sensory   | Colony-level level-ups draft a shared trait for every member.                     |

## 5. Constants table — `packages/shared/src/constants/traits.ts`

| Constant                        | Value                                    | Unit  |
| ------------------------------- | ---------------------------------------- | ----- |
| `TRAIT_CATALOG`                 | the eight definitions of §3 (`as const`) | —     |
| `TRAIT_TIERS`                   | the tier tables of §3, keyed by id       | —     |
| `TRAIT_TIER_COUNT`              | 3                                        | tiers |
| `RESERVED_TRAIT_IDS`            | the seventeen ids of §4                  | ids   |
| `EXCLUSION_GROUPS`              | `primary_locomotion`, `membrane`         | ids   |
| `SPRINT_COOLDOWN_FLOOR_SECONDS` | 0.5                                      | s     |
| `DEFAULT_CELL_MODIFIERS`        | the identity record of §2                | —     |

## 6. Acceptance scenarios

Given seed S and inputs I, after N ticks assert X. Placements as in [`ECOLOGY.md §8`](./ECOLOGY.md#8-acceptance-scenarios).

| #   | Given                                                                                   | Inputs                              | After     | Assert                                                                                                                          |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| T1  | pure `foldModifiers`: Cilia Fringe I + Thick Membrane I                                 | —                                   | —         | `speedMultiplier` = 1.045 (1.10 × 0.95), `accelerationSecondsMultiplier` = 0.85, `membraneRatioBonus` = 0.15, all else default. |
| T2  | seed 42, player mass 20 with Cilia Fringe I                                             | target 5 radii east                 | 600 ticks | speed within 0.5 wu/s of 242.0.                                                                                                 |
| T3  | seed 42, B mass 20 with Thick Membrane I; A placed 5 wu away at mass 27, then 28        | idle                                | 120 ticks | mass 27: no engulf (27 < 28.0); mass 28: B absorbed.                                                                            |
| T4  | ECOLOGY E9 setup, B has Barbed Spikes I                                                 | idle                                | 42 ticks  | B absorbed at tick 42 (0.5 s × 1.4); A mass = 100 × (1 − 0.02/60)^42 + 16 ≈ 114.61 (± 0.05).                                    |
| T5  | seed 42, player mass 20 with Chloroplast Pigment I, placed in the shallows / broth      | idle                                | 60 ticks  | shallows: mass = 20.3 (± 0.001); broth: mass = 20.                                                                              |
| T6  | ECOLOGY E9 setup, A has Ravenous Enzymes I; separately A eats a placed algae mote       | idle                                | 24 ticks  | B absorbed at tick 24 (0.5 s × 0.8); A mass = 100 + 17 = 117 (yield 0.85); algae gives +1.1 mass.                               |
| T7  | seed 42, B mass 100 with Toxin Vacuole I overlapping C mass 90 (no engulf possible)     | idle                                | 60 ticks  | C mass = 90 × (1 − 0.03/60)^60 ≈ 87.34 (± 0.05); B mass unchanged except decay.                                                 |
| T8  | seed 42, player mass 20 with Lodestone Core I; algae placed at 2.5 radii and at 4 radii | idle                                | 60 ticks  | the 2.5-radii mote was eaten (drifted 40 wu/s inward); the 4-radii mote has not moved.                                          |
| T9  | seed 42, player mass 20 with Whip Flagellum I                                           | sprint at tick 1, again at tick 152 | 153 ticks | tick 2 max speed = 231 × 2.1; second sprint accepted at tick 152 (cooldown 2.5 s = 150 ticks).                                  |
| T10 | pure catalog test                                                                       | —                                   | —         | every trait has 3 tiers, unique id, at least one tag, a visual and an audio cue; §4 ids are not in `TRAIT_CATALOG`.             |
