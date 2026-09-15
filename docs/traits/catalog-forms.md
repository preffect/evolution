# Evolution — Trait Catalog v1 (the ladder): build-1 catalog: forms and the at-a-glance tables

§3.12–§3.18 of the split [`TRAITS.md`](../TRAITS.md), which keeps the shared context and the file list.

### Rung 5 — the specialised forms (`stage: 'eukaryote'`, category `form`, group `body_plan`: one per cell). **Owning any form → `specialised`.**

#### 3.12 Amoeba Pseudopods `amoeba_pseudopods` — form, uncommon, tags `predatory motile`, requires `cytoskeleton`

| Tier | gelSpeedFactorFloor | wrapDurationMultiplierAsPredator | gripStrengthBonus |
| ---- | ------------------- | -------------------------------- | ----------------- |
| I    | 0.6                 | 0.85                             | +0.1              |
| II   | 0.8                 | 0.75                             | +0.2              |
| III  | 1.0                 | 0.65                             | +0.3              |

The gel is no shelter from an amoeba, and its pseudopods wrap prey faster and hold it: the wrap runs
at 0.85 / 0.75 / 0.65 of its base time and a wrapped prey's held speed factor is 0.7 / 0.6 / 0.5 instead
of 0.8 (ecology/absorption.md §6.1). The absorb phase is untouched (lobes grab, they do not digest: that is the Food
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

**The armour line stacks, by design (#154).** Cell Wall, Diatom Shell and Toxin Vacuole share no group.
At tier I the trio is beatable: a 2 × predator pays out with ≈ 31 % spit-out risk over the meal and nets
≈ +54 on a prey of 100. At tier III it is nearly unkillable (a 3 × predator nets ≈ −4 on a completed
meal and faces a ≈ 73 % spit-out; T22), and Food Vacuole III is the answer (≈ +45, ≈ 53 % spit-out). No
exclusion is added, because the full trio is unreachable at any round length: it needs 12 picks (the three
gates, Nucleoid Coil, an endosymbiont and Nuclear Envelope, plus nine tiers), and levels 1 → 12 give only 11
drafts ([`PROGRESSION.md`](../PROGRESSION.md)). The 11-pick near-trios are reachable in a long round, and a
3 × predator beats every one of them on a completed meal (spit-out forced to miss, prey 100):

| Build (Wall / Diatom / Toxin) | Net at 2.5 × | Net at 3 × | Spit-out risk it faces at 3 × |
| ----------------------------- | ------------ | ---------- | ----------------------------- |
| II / III / III                | ≈ −5.9       | ≈ +5.4     | ≈ 69 %                        |
| III / II / III                | ≈ +3.0       | ≈ +11.9    | ≈ 53 %                        |
| III / III / II                | ≈ +12.1      | ≈ +18.9    | ≈ 72 %                        |

No `WILD_CELL_BUILDS` list carries the toxin with the shell, and a cell that only defends earns no
absorptions, so it grazes but does not win (score, session.md §5.3).

Distinguishability at small sizes (the graphics sign-off in #25): every rung and every form owns one
silhouette change (nucleus-free blob / thread / tail / double rim / stipple / bean / lens / bounded
nucleus / taut outline / fuzzy edge / orange bubbles / violet pulse / lobes / slipper / spindle + red
dot / star / trumpet) so a level-1 protocell at 18 wu radius still reads at the zoomed-out camera.

### 3.18 Engulf effects at a glance

The direction from decision #139: every trait helps where it plausibly should and nowhere else. One row
per build-1 trait; the process and its hooks are [`ecology/absorption.md §6.1`](../ecology/absorption.md#61-rules). "Emergent"
means the effect comes through the base rules (speed breaks contact, sprint breaks it faster) with no
engulf field set; "none, by design" carries its reason. Tier I / II / III values.

| Trait                | As predator                                                                                                                          | As prey                                                                                                                                                                                                                                                                            | Phases touched         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Nucleoid Coil        | none on the process, by design (a genome reads DNA); the payout's DNA is × 1.05 / 1.10 / 1.15 like every gain (§2)                   | none, by design (genes do not wriggle)                                                                                                                                                                                                                                             | payout only            |
| Simple Flagellum     | none, by design (a tail chases; the wrap is the membrane's)                                                                          | emergent: sprint × 2.1 / 2.4 / 2.7 instead of 1.8 breaks contact sooner and the cooldown comes back faster (T17)                                                                                                                                                                   | cover, wrap (movement) |
| Cell Wall            | none, by design (a wall is defensive)                                                                                                | `membraneRatioBonus` +0.15 / +0.30 / +0.45 (harder to start and to hold); `absorbDurationMultiplierAsPrey` 1.2 / 1.4 / 1.6 (slow to dissolve)                                                                                                                                      | eligibility, absorb    |
| Ribosome Studs       | none, by design (ribosomes digest motes; enzymes for prey are the Food Vacuole's, so this must not shorten the absorb)               | none, by design                                                                                                                                                                                                                                                                    | —                      |
| Mitochondrion        | none, by design (it is fuel, not a grip)                                                                                             | emergent: sprint × 1.9 / 2.0 / 2.1 breaks contact sooner (T19); slower decay keeps a big prey above the predator's ratio a little longer                                                                                                                                           | cover, wrap (movement) |
| Chloroplast          | none, by design (light does not digest)                                                                                              | none, by design (light does not free you)                                                                                                                                                                                                                                          | —                      |
| Nuclear Envelope     | none, by design                                                                                                                      | none on the process, by design; after absorption `dnaKeptOnDeathFraction` 0.25 / 0.50 / 0.75 of the progress survives (T12)                                                                                                                                                        | after payout           |
| Cytoskeleton Lattice | none, by design (wrapping is the pseudopods' job, which require it)                                                                  | `struggleSlowdownBonus` +0.10 / +0.20 / +0.30 (steering away slows the wrap by 0.6 / 0.7 / 0.8) and the faster acceleration breaks contact sooner (T14)                                                                                                                            | cover, wrap            |
| Cilia Fringe         | none, by design (cilia move, they do not hold)                                                                                       | `gripResistanceBonus` +0.05 / +0.10 / +0.15 (held speed factor 0.85 / 0.90 / 0.95) plus the cruising speed (T15)                                                                                                                                                                   | wrap                   |
| Food Vacuole         | `absorbDurationMultiplierAsPredator` 0.80 / 0.64 / 0.51 and `engulfMassYieldBonus` +0.05 / +0.10 / +0.15 (T6)                        | none, by design                                                                                                                                                                                                                                                                    | absorb, payout         |
| Toxin Vacuole        | the base drain on the prey it touches, nothing more, by design (poison is not a grip)                                                | `toxinDrainFractionPerSecond` 0.03 / 0.05 / 0.07; once wrapped the predator takes a dose of × 8 that of **your** mass (0.24 / 0.40 / 0.56 × your mass per second, #154) until the ratio fails and it ejects you: beats predators up to ≈ 1.34 / 1.49 / 1.62 × your mass (T18, T21) | wrap, absorb (ratio)   |
| Amoeba Pseudopods    | `wrapDurationMultiplierAsPredator` 0.85 / 0.75 / 0.65 and `gripStrengthBonus` +0.1 / +0.2 / +0.3 (held factor 0.7 / 0.6 / 0.5) (T13) | none, by design (its wriggle is the Cytoskeleton Lattice it requires)                                                                                                                                                                                                              | wrap                   |
| Paramecium Cilia     | none, by design (a groove sweeps motes; no pseudopods)                                                                               | `struggleSlowdownBonus` +0.10 / +0.15 / +0.20, on top of the Cilia Fringe's slip and its own speed and acceleration (T16)                                                                                                                                                          | cover, wrap            |
| Euglena Eyespot      | none, by design (it senses motes; a wrapped cell is not a mote)                                                                      | none, by design                                                                                                                                                                                                                                                                    | —                      |
| Diatom Shell         | none, by design (a shell is worn, not wielded)                                                                                       | `absorbDurationMultiplierAsPrey` 1.4 / 1.8 / 2.2, `spikeDrainFractionPerSecond` 0.02 / 0.04 / 0.06, `spitOutChancePerSecond` 0.4 / 0.7 / 1.0 (T4); stacks on the Cell Wall it requires                                                                                             | wrap, absorb, ratio    |
| Stentor Trumpet      | the aura drains a prey before contact like any cell in range (base rule), nothing more, by design                                    | none beyond the Toxin Vacuole it requires, by design (the aura is outside the membrane; only the vacuole's drain is swallowed)                                                                                                                                                     | —                      |

Held together: a prey's escape scales with how much of the ladder it spent on moving (flagellum,
cilia, cytoskeleton, paramecium), its resistance with how much it spent on armour and poison (cell
wall, diatom, toxin), and a predator's success with the two organelles that grab and digest (amoeba,
food vacuole) plus its mass. Nothing metabolic, genomic or sensory sets an engulf hook (the Mitochondrion's help is the emergent sprint of T19).
