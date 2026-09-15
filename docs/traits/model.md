# Evolution — Trait Catalog v1 (the ladder): definition shape and modifier model

§1–§2 of the split [`TRAITS.md`](../TRAITS.md), which keeps the shared context and the file list.

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
  audioCue: SoundEventId; // a SOUND_EVENT id; the renderer raises it as a trait_cue game event (AUDIO.md §2)
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
| `speedMultiplier`                    | 1       | `traitSpeedFactor` in the movement step (ecology/mass-and-movement.md §5.2)                      |
| `accelerationSecondsMultiplier`      | 1       | `CELL_ACCELERATION_SECONDS`                                                                      |
| `sprintSpeedMultiplierBonus`         | 0       | added to `SPRINT_SPEED_MULTIPLIER`                                                               |
| `sprintCooldownSecondsDelta`         | 0       | added to `SPRINT_COOLDOWN_SECONDS` (floor `SPRINT_COOLDOWN_FLOOR_SECONDS`)                       |
| `membraneRatioBonus`                 | 0       | `requiredRatio` and `releaseRatio` when this cell is prey (ecology/absorption.md §6.1)           |
| `absorbDurationMultiplierAsPrey`     | 1       | the absorb phase's pace when this cell is prey (armour: ecology/absorption.md §6.1)              |
| `wrapDurationMultiplierAsPredator`   | 1       | the wrap phase's pace when this cell is predator                                                 |
| `absorbDurationMultiplierAsPredator` | 1       | the absorb phase's pace when this cell is predator                                               |
| `gripStrengthBonus`                  | 0       | subtracted from the prey's held speed factor during wrap, when this cell is predator             |
| `gripResistanceBonus`                | 0       | added to this cell's held speed factor during wrap, when it is prey                              |
| `struggleSlowdownBonus`              | 0       | added to `ENGULF_STRUGGLE_SLOWDOWN` when this cell steers away as prey (cover and wrap)          |
| `spitOutChancePerSecond`             | 0       | per-tick spit-out roll from the `engulf` stream while this cell is wrapped or sealed as prey     |
| `engulfMassYieldBonus`               | 0       | added to `ENGULF_MASS_YIELD` (cap 1)                                                             |
| `digestionFactorBonus`               | 0       | food mass × (1 + bonus)                                                                          |
| `decayMultiplier`                    | 1       | mass decay (ecology/mass-and-movement.md §4)                                                     |
| `photosynthesisMassPerSecond`        | 0       | gained per second while inside `sunlit_shallows`                                                 |
| `spikeDrainFractionPerSecond`        | 0       | predator engulfing this cell loses this × its mass per second                                    |
| `toxinDrainFractionPerSecond`        | 0       | other cells overlapping this cell lose this × their mass per second (floor `CELL_STARTING_MASS`) |
| `toxinAuraRangeInRadii`              | 0       | scalar: toxin also applies to cells whose centre is within this × radius, without contact        |
| `attractRangeInRadii`                | 0       | scalar: motes whose centre is within this × radius drift toward the cell                         |
| `attractSpeed`                       | 0       | wu/s of that drift                                                                               |
| `dnaGainMultiplier`                  | 1       | every DNA gain (food, fragments, absorption, overflow); never the late-join gift                 |
| `dnaKeptOnDeathFraction`             | 0       | share of `dnaTowardNextLevel` kept on death (adds, cap 1; game-design/session.md §5.2)           |
| `gelSpeedFactorFloor`                | 0       | floor (max) on `gelSpeedFactor(mass)` (ecology/mass-and-movement.md §5.2)                        |

Drained mass is lost to the dish (it is not transferred). Toxin and spikes never kill: they stop at
`CELL_STARTING_MASS`; their job is to push the predator below `releaseRatio` (ecology/absorption.md §6.1). A prey's
toxin counts `ENGULF_SWALLOWED_TOXIN_MULTIPLIER` (6) times against its engulfer once the wrap has
begun: the poison is inside. The engulf hooks above are the whole set; §3.18 says which trait pulls
each one, and every trait not named there sets none of them, by design.

**Against PR #142's `trait-modifiers.ts`** (the shared contract, #97). The field half landed with #258:
`CellModifiers` now carries all eight names above, the three tier tables that already set a duration
multiplier were moved to the phase §3.18 assigns them (Food Vacuole → `absorbDurationMultiplierAsPredator`,
Amoeba Pseudopods → `wrapDurationMultiplierAsPredator`, Diatom Shell → `absorbDurationMultiplierAsPrey`),
and #260 filled the tier values: Cell Wall's `absorbDurationMultiplierAsPrey`, Cytoskeleton Lattice's and
Paramecium Cilia's `struggleSlowdownBonus`, Cilia Fringe's `gripResistanceBonus`, Amoeba Pseudopods'
`gripStrengthBonus` and Diatom Shell's `spitOutChancePerSecond`. `traits.test.ts` reads §3.18 itself and fails
when a tier table and the table disagree. The rework as originally written renames
`engulfDurationMultiplierAsPrey` → `absorbDurationMultiplierAsPrey` (it now scales the absorb phase
only), splits `engulfDurationMultiplierAsPredator` into `wrapDurationMultiplierAsPredator` (Amoeba
Pseudopods) and `absorbDurationMultiplierAsPredator` (Food Vacuole), and adds `gripStrengthBonus`,
`gripResistanceBonus`, `struggleSlowdownBonus` and `spitOutChancePerSecond`. The tier tables that
change: Cell Wall (+`absorbDurationMultiplierAsPrey`), Cytoskeleton Lattice (+`struggleSlowdownBonus`),
Cilia Fringe (+`gripResistanceBonus`), Paramecium Cilia (+`struggleSlowdownBonus`), Amoeba Pseudopods
(rename + `gripStrengthBonus`), Diatom Shell (rename + `spitOutChancePerSecond`).
