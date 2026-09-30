# Evolution — Ecology, Growth and Absorption: absorption and engulf

§6 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

## 6. Absorption and engulf

Decision #139 (direction, confirmed on #145): **escape and absorption depend on the traits involved.**
Movement and agility get the prey out before the seal, spikes get it spat out, armour makes it slow
to dissolve, the predator's pseudopods and vacuoles pull the other way. Every build-1 trait's engulf
effect, as predator and as prey, is the table in [`traits/catalog-forms.md §3.18`](../traits/catalog-forms.md#318-engulf-effects-at-a-glance);
this section is the process those effects plug into.

### 6.1 Rules

**Eligibility (mass only, one home).**

```
requiredRatio = ENGULF_MASS_RATIO + prey.membraneRatioBonus            (Cell Wall, TRAITS.md)
releaseRatio  = ENGULF_RELEASE_RATIO + prey.membraneRatioBonus         (hysteresis, < requiredRatio)
canStart      = predator.mass ≥ prey.mass × requiredRatio
canContinue   = predator.mass ≥ prey.mass × releaseRatio
inContact     = |predator.centre − prey.centre| ≤ predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION
inGrab        = |predator.centre − prey.centre| ≤ predator.radius × (1 + predator.armGrabReachRadii) − prey.radius × ENGULF_COVERAGE_FRACTION
```

`inGrab` is `inContact` for every cell without arms (`armGrabReachRadii` 0); the amoeba's arms widen it (the arm grab,
below).

`canStart` is the pure predicate `canEngulf(predator, prey, balance.absorption)` in
`packages/shared/src/simulation/engulf-eligibility.ts`, which takes two `CellView`s and reads only
`predator.mass`, `prey.mass`, `prey.membraneRatioBonus` (folded server-side and carried on the view,
[`architecture/entity-model.md §2`](../architecture/entity-model.md#2-entity-model)) and `ENGULF_MASS_RATIO`. Three callers, no
copies of the ratio arithmetic: the server engulf system (step 6), the HUD threat label (`threatsFor`,
[`ui/hud.md §3.1`](../ui/hud.md#31-in-round-elements-visible-while-roundphase--playing-and-lifestate--alive)) and the
renderer's engulf-warning ring ([`visual-style/motion-and-legibility.md §5`](../visual-style/motion-and-legibility.md#5-membrane-and-motion-language)),
so the three can never disagree about who can engulf whom. `canContinue` is `canContinueEngulf` in the same
file (same inputs, `ENGULF_RELEASE_RATIO`); only the server calls it. **Their signatures do not change**
with this rework: the chip and the ring warn about mass, not touch, effort or luck. Everything below that
needs more than mass is a second shared pure function in the same folder:

```ts
// packages/shared/src/simulation/engulf-pace.ts — formulas, numbers in, numbers out (architecture/server-simulation.md §3.1)
export type EngulfPhase = 'cover' | 'wrap' | 'absorb';
export function engulfPhaseOf(progress: number, balance: EngulfPaceBalance): EngulfPhase;
export function engulfProgressDelta(
  input: {
    phase: EngulfPhase;
    predatorMass: number;
    preyMass: number;
    isInContact: boolean;
    awayEffort: number; // 0..1, the prey's steer command away from the predator (below)
    predator: Pick<CellModifiers, 'wrapDurationMultiplierAsPredator' | 'absorbDurationMultiplierAsPredator'>;
    prey: Pick<CellModifiers, 'absorbDurationMultiplierAsPrey' | 'struggleSlowdownBonus'>;
  },
  balance: EngulfPaceBalance,
): number; // signed; the caller clamps and releases
export function preyHeldSpeedFactor(
  phase: EngulfPhase,
  predatorGripStrengthBonus: number,
  preyGripResistanceBonus: number,
  balance: EngulfPaceBalance,
): number;
export function predatorEngulfSpeedFactor(phase: EngulfPhase, balance: EngulfPaceBalance): number;
export function spitOutChancePerTick(preySpitOutChancePerSecond: number): number;
// packages/shared/src/types/effects.ts — the reason rides the `cell_released` effect, so it lives
// with the wire types; `types` never imports `simulation` (architecture/constants-files-tests.md §10)
export type EngulfReleaseReason = 'escaped' | 'spat_out' | 'ratio' | 'aborted';
// packages/shared/src/simulation/engulf-eligibility.ts — the hold verdict beside the two predicates
export function resolveEngulfHold(
  predator: EngulfPredator,
  prey: EngulfPrey,
  hold: { phase: EngulfPhase; spitOutRoll: number | null; spitOutChancePerTick: number },
  balance: EngulfRatioBalance,
): 'hold' | Extract<EngulfReleaseReason, 'ratio' | 'spat_out'>;
```

`CellModifiers` carries every field named above (traits/model.md §2), so the arguments are literal `Pick`s of the
folded record: #258 landed the `absorb` / `wrap` split and the four new bonuses with identity defaults, and
#260 filled the tier tables that set them (traits/catalog-forms.md §3.18).
`EngulfPaceBalance` and `EngulfRatioBalance` are `Pick`s of `BalanceConfig['absorption']`
([`architecture/constants-files-tests.md §9`](../architecture/constants-files-tests.md#9-constants-and-balance-decision-one-home)), so every caller, server and client, passes
`balance.absorption` (the room's live copy) and the thresholds follow a `debug_set_balance` patch.
`spitOutRoll` is `null` when no draw was made (chance 0); `engulfPhaseOf` is what the HUD chip and the
renderer read to show the phase ([`ui/hud.md §3.1`](../ui/hud.md#31-in-round-elements-visible-while-roundphase--playing-and-lifestate--alive)),
so **`CellView` gains no field**: `engulfProgress` plus the shared thresholds say everything the client needs.

**The process: cover → wrap → seal → absorb.** Progress runs 0..1; the phase is a band of it. The
band widths are the phase durations' shares of the base duration, so the HUD bar moves evenly in
time while nobody fights. The three phase seconds are the tunables; the three derived values are computed from the
room's live balance every time they are read (`engulfBaseDurationSeconds`, `engulfWrapStartProgress`,
`engulfSealProgress`, shared `simulation/engulf-pace.ts`) and are not balance leaves, so a `debug_set_balance` patch
of a phase second moves the bands and the pace (#367):

```
ENGULF_BASE_DURATION_SECONDS = ENGULF_COVER_SECONDS + ENGULF_WRAP_SECONDS + ENGULF_ABSORB_SECONDS   (0.2 + 0.4 + 0.6 = 1.2, derived)
ENGULF_WRAP_START_PROGRESS   = ENGULF_COVER_SECONDS / ENGULF_BASE_DURATION_SECONDS                   (1/6, derived)
ENGULF_SEAL_PROGRESS         = (ENGULF_COVER_SECONDS + ENGULF_WRAP_SECONDS) / ENGULF_BASE_DURATION_SECONDS   (0.5, derived)
phase(progress) = absorb if progress ≥ ENGULF_SEAL_PROGRESS − ε; wrap if ≥ ENGULF_WRAP_START_PROGRESS − ε; else cover   (ε = ENGULF_PROGRESS_EPSILON)

massFactor       = clamp(ENGULF_MASS_RATIO / (predator.mass / prey.mass), ENGULF_MIN_DURATION_FACTOR, 1)
baseRatePerTick  = TICK_INTERVAL_S / (ENGULF_BASE_DURATION_SECONDS × massFactor)
phaseRatePerTick = baseRatePerTick / phaseMultiplier
   cover   phaseMultiplier = 1
   wrap    phaseMultiplier = predator.wrapDurationMultiplierAsPredator                                   (Amoeba Pseudopods)
   absorb  phaseMultiplier = prey.absorbDurationMultiplierAsPrey × predator.absorbDurationMultiplierAsPredator   (Cell Wall, Diatom Shell / Food Vacuole)
```

| Phase      | Band                                                 | What it is                                                                                                 | Prey speed cap ×                                                                                                                                        | Predator speed cap ×                  | How the prey gets out                                                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cover**  | `[0, ENGULF_WRAP_START_PROGRESS)`                    | The predator's membrane (or an amoeba's arm, `inGrab`) lies over the prey's centre. The grab: a mild hold. | `clamp(ENGULF_PREY_SPEED_FACTOR_COVER − predator.gripStrengthBonus + prey.gripResistanceBonus, ENGULF_PREY_SPEED_FACTOR_FLOOR, 1)` (the grab, below)    | `ENGULF_PREDATOR_SPEED_FACTOR`        | **Break contact:** progress drains by `ENGULF_ESCAPE_DECAY_MULTIPLIER × baseRatePerTick` per tick and the prey is released the tick it reaches 0; contact regained before then resumes from what is left (#634: a slip drains, it no longer cancels). Steering away also slows the cover (struggle, below).      |
| **Wrap**   | `[ENGULF_WRAP_START_PROGRESS, ENGULF_SEAL_PROGRESS)` | Pseudopods close around the prey. Grip.                                                                    | `clamp(ENGULF_PREY_SPEED_FACTOR − predator.gripStrengthBonus + prey.gripResistanceBonus, ENGULF_PREY_SPEED_FACTOR_FLOOR, 1)` (Amoeba grips, Cilia slip) | `ENGULF_PREDATOR_SPEED_FACTOR`        | **Break contact:** progress drains as in cover, back through the cover band, and the prey is released the tick it reaches 0. **Struggle:** steering away slows the wrap. **Spit-out** rolls (spines). **Ratio** release (toxin, spikes, decay).                                                                  |
| **Seal**   | the tick progress reaches `ENGULF_SEAL_PROGRESS`     | The membrane closes: the prey is inside.                                                                   | —                                                                                                                                                       | —                                     | The prey's `carriedOffset` = prey.centre − predator.centre is recorded and its velocity zeroed. From here the prey rides with the predator: movement no longer helps. Chip goes solid, bar locks ([`ui/hud.md §3.1`](../ui/hud.md#31-in-round-elements-visible-while-roundphase--playing-and-lifestate--alive)). |
| **Absorb** | `[ENGULF_SEAL_PROGRESS, 1]`                          | Digestion. `inContact` holds by construction (carried).                                                    | 0 (carried: `prey.centre = predator.centre + carriedOffset` after the movement step, velocity = the predator's)                                         | `ENGULF_PREDATOR_SPEED_FACTOR_SEALED` | **Spit-out** rolls (spines). **Ratio** release: swallowed toxin and spikes drain the predator until `canContinue` fails, then the prey is ejected at its offset. Nothing else.                                                                                                                                   |

**The grab (#634).** The human's call on ticket #634, after a playtest found the engulf clumsy and a chase along
the rim impossible to finish: a slip drains instead of cancelling, and a grab, "but not too strong". Three numbers:

- `ENGULF_PREY_SPEED_FACTOR_COVER` **0.85**: from the first touch the prey keeps 85 % of its speed, a notch looser
  than the wrap's 0.8, so the hold tightens as the arms close and a prey that reacts at once still has most of its
  speed. Grip traits move it exactly as they move the wrap: Amoeba Pseudopods III holds a plain prey at 0.55 from the
  first touch, and Cilia Fringe III (+0.15) cancels the grab outright (1.0, E18c).
- `ENGULF_PREDATOR_SPEED_FACTOR` **1** (was 0.6): holding costs the predator nothing. Every cell shares one top
  speed (#677; before it the mass curve made the predator the slower cell, 0.946 of the prey at the start ratio), so
  any factor below the prey's held factor lets the prey it holds outrun it (at 0.6: 0.57 against the prey's 1.0, the playtest's "you slow down when you
  grab"). At 1 a predator of any mass outpaces a plain held prey (1 against 0.85 in cover and 0.8 in wrap,
  pinned by `engulf-pace.test.ts`), and a heavier one also has a wider reach
  (`predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION`) and a shorter engulf. `ENGULF_PREDATOR_SPEED_FACTOR_SEALED` stays 1: once sealed the prey is carried.
- The drain reuses `ENGULF_ESCAPE_DECAY_MULTIPLIER` **2**: a slip of n ticks costs 2n ticks of progress, and a prey
  that stays clear drains out in 0.1 s × `massFactor` from the end of the cover, 0.3 s × `massFactor` from the seal
  line. Escape is unchanged in kind: a sprint, a speed trait or the cilia still break contact and stay clear (E18b,
  E18c, E11), each a few ticks later than when the cover cancelled outright.

**The arm grab (#735).** The human's call on ticket #735, after #646 made the amoeba's arms reach far past the
rings: an arm that lies across a cell grabs it. Amoeba Pseudopods sets `armGrabReachRadii` to
`AMOEBA_ARM_GRAB_REACH_RADII` = `PSEUDOPOD_REACH × PSEUDOPOD_RETRACTED_SHARE` = 0.95 × 0.65 = **0.6175** at every tier
(`shared/constants/pseudopods.ts`, the numbers the renderer draws the arms with): the shortest an arm ever is past
the body, so the prey is under an arm's tip at every moment of its cycle. The reach is the same all round, because
the arms' angles are the renderer's (its clock, its smoothed heading, the cosmetic phase) and the server cannot know
where an arm points; taking the arm's shortest length, and the same coverage of the prey's radius the body needs, is
what keeps an all-round reach honest. Three rules, and nothing else changes:

- **Start and hold by the arm:** step 1 starts on `inContact`, or on `inGrab` while the prey is not steering away
  (`awayEffort` = 0, the struggle's own projection below), and step 5 counts the same arm hold as contact in cover and
  wrap, so a prey the arm holds advances the engulf like one under the body. A prey that steers away is never held by
  the arm alone: it drains as out of contact (it is still pulled) and escapes when the progress runs out, unless the
  pull or the predator brings the body over it first. So a prey swimming through the arm's reach is not grabbed, and a
  prey pinned at arm's length (against the rim, say) cannot hover there with the progress climbing and draining for
  minutes, which the #735 review found.
- **The re-grab cooldown:** a prey that escapes (`escaped`) a predator with arms cannot be grabbed by that
  predator's arm alone for `ENGULF_ARM_REGRAB_COOLDOWN_SECONDS` **0.75** s. The body can still catch it meanwhile.
  It is the spit-out refractory's record (`{ preyCellId, untilTick }`, one entry per prey, pruned by the engulf step,
  in the state hash) kept in a second list, `armRegrabRefractories`. Without it, a prey whose steering wobbled
  around "away" was grabbed and dropped five to ten times a second (the #735 review's flicker). The mass ratio, the refractory and the separation are untouched: contact, the
  dent and the push stay the body's.
- **The pull:** before step 5, an unsealed prey held by the arm alone (outside `inContact`, inside `inGrab`) is drawn
  toward the predator's centre at `min(ENGULF_ARM_PULL_RADII_PER_SECOND × predator.radius,
ENGULF_ARM_PULL_MAX_PREY_SPEED_SHARE × the prey's speed cap this tick)`: **1.5** predator radii a second, never more
  than **0.5** of what the held prey can swim right now (sprint, gel and the held factor included). The last tick may
  carry it up to one step inside `inContact`, then the dish wall. It moves the prey only, and the cap is what keeps
  "a prey swimming or sprinting away still gains" true at every size: 1.5 R/s alone outran a held prey from an
  amoeba of about 300 mass (the #735 review). E9's 40 wu amoeba pulls 1 wu a tick, under its cap.
- **Only the body seals:** progress that would cross `ENGULF_SEAL_PROGRESS` while the prey is held by the arm alone
  stays where it was, at the lip of the seal, until the pull (or the predator) brings the body over the prey; the
  seal then records the carried offset as usual, so a carried prey is always under the body.

**The drag (#772).** The human's call on ticket #772, after a playtest found that early on most engulfs were a pass
straight through the prey: a predator at full speed covered the prey for a few ticks and coasted out the far side, and
the progress drained before it could seal (a 30 over a 20 at 220 wu/s crosses its 26 wu contact window in about seven
ticks; the seal needs thirty). Once an engulf has started, and until the seal, the predator drags the prey after it.
One number, `ENGULF_DRAG_SHARE` **1**:

```
predatorStart = predator.centre − predator.velocity × TICK_INTERVAL_S                 (where the movement step took it from)
gapOpened     = max(0, |predator.centre − prey.centre| − |predatorStart − prey.centre|)
drag          = ENGULF_DRAG_SHARE × gapOpened, toward the predator's centre, then the dish wall
```

- **Only the predator's own move is answered.** Both distances are measured to where the prey is now, after its own
  move, so whatever the prey swam this tick stays swum; a predator moving toward its prey, or sitting still, drags
  nothing. A prey swimming away therefore gets out exactly as it would from a still predator: the struggle, the speed
  traits, the sprint and the cilia keep every escape they had (decision #139; E11, E18b, E18c, T13–T17 unchanged, and
  E19b is the prey that sprints off sideways under a predator that is passing through it). At share 1 a predator can no
  longer lose a prey that is not swimming away by moving off it: a pass carries the prey at the offset where the
  predator's move started to open the gap (E19).
- **Why the gap and not the velocity.** A velocity blend toward the predator's also slows a prey fleeing a still
  predator, which is the escape the direction protects; a tether (the arm's pull) cannot tell a predator coasting off
  from a prey swimming off. Measuring the gap the predator opened is what separates the two.
- **Velocity is the kernel's.** The predator's start is read back from the velocity the movement step left on its
  record, so a push from separation is not counted; at the dish wall, whose clamp removes the outward velocity, it is
  an approximation of under one tick's move. The prey's own velocity is not changed: the drag moves it, as the arm's
  pull does. The wire still shows it moving (#774): the tick's drag and arm pull are kept on the prey
  (`heldDisplacementX/Y`, cleared at the top of the engulf step), and while it is held its view's velocity adds them ÷
  the tick, so the client draws it heading and stretching with its predator and extrapolates a late snapshot with it.
  The next tick's kernel reads the record's velocity, which never includes them; a prey released this tick reports the
  kernel's alone, the velocity its own client's prediction replays from.
- **Order:** step 5 drags first, then the arm pulls, then contact is read (below). A sealed prey is carried and never
  dragged. Dragging first matters for an amoeba: a prey the drag puts back under the body is not pulled on top of it.
- **The arm hold is dragged too.** The drag reads the hold, not how it holds: an amoeba swimming off a still prey it
  holds by the arm alone tows it at its own speed, and the arm's pull then draws it under the body to seal. Before
  #772 the arm pull's cap (`ENGULF_ARM_PULL_MAX_PREY_SPEED_SHARE` of the prey's speed) let such a prey go at half
  throttle or more (released `escaped` on tick 20 at half, tick 5 at full); the cap still bounds the pull, never the
  drag. A prey that steers away is still not held by the arm alone (below), and the drag still never answers its own
  move.
- **A dragged prey can end a tick pressed into a third cell.** The drag runs at step 6, after separation (step 3),
  so a prey towed into a bystander overlaps it until the next tick's separation pushes the two apart again; a towed
  prey pressed into a cell it cannot pass can lose contact and drain out. Only the pair's own centres are moved.

What the numbers moved (ticket #772, `packages/server/bench/engulf-pass.ts`, 12 passes per row: 4 offsets of the pass
line × 3 start distances, the predator at full speed steering far past the prey): the first pass over a still prey at
early-game masses (26/20, 40/30, 60/45) ate 0 of 12 before and eats 12 of 12 at share 1; 0.9 eats 0–6 of 12 and 0.75
none, so the default is the only share that fixes the protocell pass. The round-level numbers (wild swallows, the idle
and grazing players' deaths per minute) do not move: a wild hunter stops over its prey rather than passing through it,
which the drag does not answer.

The player sees the hold: the lobe nearest the prey reaches to it and draws back with it as the pull brings it in
(ticket #753, cosmetic: docs/rendering/cells.md §2.1 pseudopods row); nothing on the server reads it.

The rows it moves are T13's (a sprint at tick 7 no longer gets clear of Amoeba III; the escapes that remain drain
later, held out on the arm), and T23 is the grab itself, the escape from it and the large amoeba's ([`traits/constants-and-acceptance.md §6`](../traits/constants-and-acceptance.md#6-acceptance-scenarios)).

**Struggle (cover and wrap, while in contact).** The prey's steer command of this tick — the one the
movement step took from its start-of-tick pose and moved on, kept on the record as
`CellRecord.steerCommand` (`steerCommand` of the shared movement kernel, §5.2) rather than taken a
second time after the centres have moved — is projected away from the predator:

```
awayEffort = throttle × max(0, direction · normalise(prey.centre − predator.centre))     (0 when the centres coincide)
slowdown   = min(ENGULF_STRUGGLE_SLOWDOWN_CAP, ENGULF_STRUGGLE_SLOWDOWN + prey.struggleSlowdownBonus) × awayEffort
progress  += phaseRatePerTick × (1 − slowdown)
```

Steering straight away at full throttle halves the pace (0.5); a Cytoskeleton Lattice or Paramecium
prey pushes the slowdown toward the cap (0.9). Sprint does not enter this formula: its job is speed,
which breaks contact. Both routes are the direction's "moving should help escape": the struggle keeps
movement useful when contact cannot be broken (gel, a strong grip, a corner), and speed and agility
traits shorten the time to break it (E11, TRAITS T13–T17).

**Spit-out (wrap and absorb).** Once per tick, for a prey whose `spitOutChancePerSecond` > 0, the engulf
step draws `roll = streams.engulf.nextFloat()` ([`determinism/random-streams.md §3`](../determinism/random-streams.md#3-seeded-random-streams-packagessharedsrcrandom-73),
label `engulf`; no draw when the chance is 0, so a dish without spiny cells never touches the stream)
and spits the prey out when `roll < spitOutChancePerSecond × TICK_INTERVAL_S`. Spat out: prey released
with progress 0 at its current centre, `cell_released` with reason `spat_out`, and the predator records a
**refractory** keyed by that prey (`spitOutRefractoryUntilTickByPreyId.set(preyCellId, tick + ENGULF_SPIT_OUT_REFRACTORY_SECONDS × TICK_HZ)`,
one entry per spat-out prey, so a predator that spits out X and then Y within the second still remembers X;
`untilTick` is the **last** blocked tick and is the tick of the spit-out plus
`ENGULF_SPIT_OUT_REFRACTORY_SECONDS × TICK_HZ`, so the predator is refused on exactly that many ticks —
sixty at 1.0 s — and may start again on the next one.
Two readers: the engulf step's start check at step 6, which also prunes expired entries and entries naming a
cell that has left the world, and separation at step 3, which treats a pair inside a refractory as one that
cannot engulf (§5.3)): it cannot start on that prey until the tick after, and the pair is
separated meanwhile (§5.3) so the prey is pushed clear. Only the Diatom Shell sets the chance in build 1 (traits/catalog-forms.md §3.15).

**Swallowed toxin and spikes: a dose set by the prey (#154).** Once the engulf is past cover (wrap
and absorb) the poison is inside the membrane, and the engulfer loses
`prey.mass × prey.toxinDrainFractionPerSecond × ENGULF_SWALLOWED_TOXIN_MULTIPLIER` mass per second
(§4.1), in place of the contact drain that prey put on it in cover. Spikes cut the swallower in every
phase from the tick after the start, `prey.mass × prey.spikeDrainFractionPerSecond` per second. Both
read the **prey's** mass, not the predator's: a poison cell is a fixed dose, so a heavy predator that
finishes quickly pays less than a marginal one. A prey whose only defence is the toxin is always worth
finishing (`traits/catalog-organelles.md §3.11`, T21); armour stacked on the toxin can still make a
completed meal cost more than it yields (`traits/catalog-forms.md §3.17`, T22). Both work through the ratio: the predator sheds mass until
`canContinue` fails and the prey is released (`ratio`), in whatever phase, seal included. **What the
player sees:** the predator's rim flashes violet and its mass readout falls while it holds the prey,
and an ejected prey pops out of it with the `ratio` release; the HUD threat chip still warns on mass
alone (above), so the toxin's effect is read on the predator, not promised on the chip.

**Order inside the engulf step, per pair** (stable id order, #74; the numbers the scenarios quote come
from this order):

1. No engulf: start when (`inContact` ∨ the arm hold outside its re-grab cooldown) ∧ `canStart` ∧ the predator has no live refractory on this prey
   ∧ the prey was not released `aborted` this tick (below). Progress 0, then continue below on the same tick.
2. `¬canContinue` → release, reason `ratio`.
3. `phase` = `engulfPhaseOf(progress, balance.absorption)` from the progress at the start of the step.
4. Wrap or absorb with a positive chance: draw and compare → release, reason `spat_out`, refractory.
5. Cover or wrap: the drag first (the gap the predator's own move opened, above), then the arm's pull (a prey in
   `inGrab` but not `inContact`, the arm grab above); then in contact
   (`inContact` or the arm hold) → `progress += phaseRatePerTick × (1 − slowdown)`; out of contact →
   `progress −= ENGULF_ESCAPE_DECAY_MULTIPLIER × baseRatePerTick`, release (`escaped`) when it is ≤ ε (drained to 0;
   a wrap drains back through the cover band first). Absorb: `progress += phaseRatePerTick`.
6. Progress ≥ 1 − ε → payout. Progress crossed `ENGULF_SEAL_PROGRESS` this tick → seal (offset recorded,
   prey velocity zeroed) when the prey is `inContact`; held by the arm alone, the progress stays where it was. A tick that crosses a band boundary runs entirely at the rate of the phase it
   started in; the overshoot (under one tick) is spent in the next phase.

**A cell the world freed waits a tick.** A prey released with reason `aborted` — the chain payout
below, a removed predator, the results phase — cannot be claimed again by anyone until the next tick.
It is left exactly where its predator was, usually inside the cell that has just eaten that predator,
so the wait is the one movement step that lets it be somewhere of its own before the next engulf can
start; without it the claim would fall to cell-id order, since the pair walk reaches some pairs
before the payout and some after. The other three release reasons do not wait, because §6.3 has already resolved where each leaves
the prey and who may claim it: an `escaped` prey is out of contact by its own movement; a
`spat_out` one may be started on at once by any other predator, its own being held off by the
refractory; and a `ratio` one — which past the seal is ejected at its carried offset, still
overlapping, having moved nothing itself — is pushed clear by separation, because its former
predator can no longer engulf it. Only `aborted` leaves the prey where no rule chose: inside a
cell that was not its predator a moment ago.

`massFactor`, the phase multipliers and the held speed factor are recomputed every tick from the
current masses and the modifiers folded at step 1, so a trait picked this tick affects this tick's
engulf. The speed factors the movement step applies (§5.2) read the engulf state at the end of the
previous tick (movement runs before engulf). **Hysteresis:** an engulf in progress is rechecked every tick
against `canContinue`, not `canStart`; the predator holds its prey until it drops below `releaseRatio`,
so decay, toxin and spikes must move the ratio by a real margin rather than a rounding error before
the prey is released. A prey is claimed by at most one predator at a time. Every release sets the prey
`free` with progress 0 and emits `cell_released { cellId, predatorCellId, reason }`.

**Payout at progress ≥ 1 − `ENGULF_PROGRESS_EPSILON`** (so thirty-six additions of 1/36 pay out on tick 36):

| Who      | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Predator | mass += prey.mass × `ENGULF_MASS_YIELD` (cap overflow → DNA, §5.4); DNA += `ENGULF_DNA_BASE` + (prey.dnaCumulative − prey.dnaCatchUpGift) × `ENGULF_DNA_SHARE` (the prey's **earned** DNA, the score's own figure: the entry rule's gift buys levels, not rank, for the killer either, #271); tag points += prey tag points × `ENGULF_TAG_SHARE` plus `predatory` × `ENGULF_PREDATORY_TAG_POINTS`; absorptions += 1.                                                                                 |
| Dish     | detritus worth prey.mass × `DETRITUS_MASS_FRACTION` (§1).                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Prey     | cell removed this tick (`cell_absorbed` effect, `playerId: null` for a wild prey, #270); player `lifeState` = `spectating` for `RESPAWN_SPECTATE_SECONDS`, then respawn ([`game-design/session.md §5.2`](../game-design/session.md#52-spawn-death-and-respawn)). Keeps level, traits, stage and `dnaKeptOnDeathFraction` of its progress. A wild prey has no player: its seat respawns it ([`wild-cells.md §3.3`](./wild-cells.md#33-wild-cells)).                                                   |
| Traits   | never move. Absorption moves mass, DNA, tag points and the endosymbiont counter only; the prey keeps every trait (session.md §5.2). Trait stealing is a build-1 non-goal ([`game-design/controls-and-scope.md §10`](../game-design/controls-and-scope.md#10-explicit-non-goals-for-build-1)), so the payout draws no roll and the retired `ENGULF_TRAIT_STEAL_CHANCE` was removed with #260 (#269). A steal in a later build is a new mechanic and a new decision, with its own draw-order contract. |

### 6.2 State diagram

Two records, two homes. The **cell** carries only simulation states (`CellState = 'free' |
'being_engulfed' | 'engulfing' | 'dividing'`); the **player** carries the lifecycle
(`PlayerProgressView.lifeState = 'alive' | 'spectating'`). An absorbed cell is removed from the world
the tick it is absorbed and emitted as a `cell_absorbed` effect, so the renderer never sees a ghost and
the spatial hash keeps no empty entry.

```
   cell (prey side; the phase is a band of engulfProgress, engulfPhaseOf):
              contact + canStart              1/6                  seal (0.5)              progress >= 1 − ε
   [free] ----------------------> [being_engulfed: cover] ---> [wrap] ---------> [absorb, carried] ---------> (cell removed, cell_absorbed)
     ^                               |                    |                       |
     |  drained to 0 (escaped)       |                    |                       |
     +-------------------------------+                    |                       |
     |  drained to 0 (escaped) · spat out · ratio         |                       |
     +----------------------------------------------------+                       |
     |  spat out · ratio · aborted (chain, round end)                             |
     +----------------------------------------------------------------------------+
        every release: progress 0, cell_released { reason }
        out of contact before the seal the progress drains (a wrap back into cover); regained contact resumes it

   cell (predator side):
              contact + canStart as predator          prey absorbed / released
   [free] ----------------------------------------> [engulfing] ------------------------> [free]

   [dividing]  (reserved, build 2: unreachable in build 1)

   player:
   [alive] --cell absorbed--> [spectating] --RESPAWN_SPECTATE_SECONDS--> respawn (new cell, [free]) --> [alive]
```

A cell can be `engulfing` and `being_engulfed` at once (a chain); the flags are independent.

### 6.3 Edge cases (resolved)

| Case                                        | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutual engulf                               | Impossible: `requiredRatio` ≥ 1.25 cannot hold both ways. Near-equal cells only push apart (§5.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Two predators reach one prey                | The first to satisfy contact + eligibility claims it; the other waits. Ties within a tick: lower cell id (stable ordering, #74).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Chain: B engulfs C while A engulfs B        | Both run. If A finishes first, C is released (`aborted`, progress 0, at B's last centre, so it now sits inside A; nobody may claim C again on that tick, so A starts on it next tick at the earliest, §6.1) and A's payout is B alone. If B finishes first, B's mass jumps and A's eligibility is rechecked next tick. A sealed B keeps engulfing C from its carried centre. Before the seals, A's drag moves B only: B's own drag answers B's own move (its kernel velocity), so a B that A tows does not carry C along, and C can drain out of it. |
| Predator drops below `releaseRatio`         | Released immediately (`ratio`) in any phase, seal included; the predator keeps no progress. Between `releaseRatio` and `requiredRatio` the engulf continues (hysteresis, §6.1). A prey ejected from the absorb phase reappears at its carried offset, overlapping the predator, and separation (§5.3) pushes it clear because the predator can no longer engulf it.                                                                                                                                                                                  |
| Prey moves away before the seal             | Cover or wrap: contact breaks, progress drains at 2× the base rate (a wrap back through the cover band) and the prey is released the tick it reaches 0 (E11, E18b). Contact regained before then resumes the engulf from what is left, so a one-tick slip costs two ticks of progress, never the engulf (#634). This is the intended escape; the struggle slows the engulf meanwhile.                                                                                                                                                                |
| Predator moves off the prey before the seal | The drag (#772) draws the prey after it by `ENGULF_DRAG_SHARE` of the gap the predator's own move opened, so a pass at speed carries the prey and finishes (E19). The drag never answers the prey's own move, so a prey that swims off at the same time still gets out as from a still predator (E19b).                                                                                                                                                                                                                                              |
| Chase along the rim                         | The grabbed prey keeps 0.85 of its speed and the predator all of its own, so a predator that follows its prey along the curved wall keeps contact and finishes (E18, #634). A sprint or a speed or cilia trait still breaks contact and stays clear (E18b, E18c).                                                                                                                                                                                                                                                                                    |
| Prey moves away after the seal              | Nothing: the prey is carried (`carriedOffset`), its input is latched but its speed cap is 0 (E11b). Spines and swallowed toxin are the only ways out.                                                                                                                                                                                                                                                                                                                                                                                                |
| Spat out, still overlapping                 | The refractory (`ENGULF_SPIT_OUT_REFRACTORY_SECONDS`, one per spat-out prey, so two Diatoms spat out in turn each keep theirs) blocks a restart on that prey and separation pushes the pair apart meanwhile; after it, an idle pair sits just past touching and nothing restarts unless the predator closes in again (T4). Another predator may start on the spat-out prey at once.                                                                                                                                                                  |
| Predator or prey disconnects                | No special case: an input-less cell is still a cell. Removing a cell (`dissolveCell`) aborts every engulf it is part of, on both sides, before it leaves the world. If the prey is removed from the room mid-engulf, the predator gets no payout and the removed cell drops detritus. If a predator carrying a sealed prey is removed, the prey is released (`aborted`) where it is.                                                                                                                                                                 |
| Round enters `results` mid-engulf           | Engulf aborted (`aborted`), no payout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Level-up mid-engulf (either side)           | The draft opens normally; the simulation never pauses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Engulf at the wall                          | Clamping only moves centres inward, so contact is never broken by the wall. A carried prey goes through the same clamp as any other cell, so it never rides past the rim either. Nor does any cell at the end of a tick: separation stops each push at the wall (mass-and-movement.md §5.3), and a predator paid out against the wall is pushed inward by its growth (§5.4, #710).                                                                                                                                                                   |
| Predator at `CELL_MAX_MASS`                 | Yield converts to DNA (§5.4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Prey lifted by the entry rule               | The share reads earned DNA only (#271): G13's player, respawned at 6:30 with `dnaCumulative` 140 all gift and `ENTRY_MAX_MASS` 200, pays its killer 30 DNA, not 58. Eating the same lifted player every respawn (3 s) is worth the base alone, so a gift is never farmed into someone else's score (E9c).                                                                                                                                                                                                                                            |
| Same organism (build 2)                     | Cells sharing `organismId` never engulf each other. Trivially true in build 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Engulf during split (build 2)               | Open for #28. Proposed: each daughter cell is an independent prey; a predator engulfing a cell that splits keeps the half it overlaps.                                                                                                                                                                                                                                                                                                                                                                                                               |
| Partial absorption / nibbling               | Not in v1 (game-design/controls-and-scope.md §10 non-goals).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
