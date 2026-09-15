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
```

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
#260 fills the tier tables that set them. Until it does, `gripStrengthBonus`, `gripResistanceBonus`,
`struggleSlowdownBonus` and `spitOutChancePerSecond` are 0 for every cell in play, so the spit-out branch
and the refractory are reachable only from a folded modifier a test writes directly.
`EngulfPaceBalance` and `EngulfRatioBalance` are `Pick`s of `BalanceConfig['absorption']`
([`architecture/constants-files-tests.md §9`](../architecture/constants-files-tests.md#9-constants-and-balance-decision-one-home)), so every caller, server and client, passes
`balance.absorption` (the room's live copy) and the thresholds follow a `debug_set_balance` patch.
`spitOutRoll` is `null` when no draw was made (chance 0); `engulfPhaseOf` is what the HUD chip and the
renderer read to show the phase ([`ui/hud.md §3.1`](../ui/hud.md#31-in-round-elements-visible-while-roundphase--playing-and-lifestate--alive)),
so **`CellView` gains no field**: `engulfProgress` plus the shared thresholds say everything the client needs.

**The process: cover → wrap → seal → absorb.** Progress runs 0..1; the phase is a band of it. The
band widths are the phase durations' shares of the base duration, so the HUD bar moves evenly in
time while nobody fights:

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

| Phase      | Band                                                 | What it is                                                                      | Prey speed cap ×                                                                                                                                        | Predator speed cap ×                  | How the prey gets out                                                                                                                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cover**  | `[0, ENGULF_WRAP_START_PROGRESS)`                    | The predator's membrane lies over the prey's centre (`inContact`). No grip yet. | 1                                                                                                                                                       | `ENGULF_PREDATOR_SPEED_FACTOR`        | **Leave.** The tick `inContact` fails the prey is released with progress 0 (nothing was held). Steering away also slows the cover (struggle, below).                                                                                                                                                                        |
| **Wrap**   | `[ENGULF_WRAP_START_PROGRESS, ENGULF_SEAL_PROGRESS)` | Pseudopods close around the prey. Grip.                                         | `clamp(ENGULF_PREY_SPEED_FACTOR − predator.gripStrengthBonus + prey.gripResistanceBonus, ENGULF_PREY_SPEED_FACTOR_FLOOR, 1)` (Amoeba grips, Cilia slip) | `ENGULF_PREDATOR_SPEED_FACTOR`        | **Break contact:** progress then decays by `ENGULF_ESCAPE_DECAY_MULTIPLIER × baseRatePerTick` per tick and the prey is released the tick it falls below `ENGULF_WRAP_START_PROGRESS` (the grip is gone). **Struggle:** steering away slows the wrap. **Spit-out** rolls (spines). **Ratio** release (toxin, spikes, decay). |
| **Seal**   | the tick progress reaches `ENGULF_SEAL_PROGRESS`     | The membrane closes: the prey is inside.                                        | —                                                                                                                                                       | —                                     | The prey's `carriedOffset` = prey.centre − predator.centre is recorded and its velocity zeroed. From here the prey rides with the predator: movement no longer helps. Chip goes solid, bar locks ([`ui/hud.md §3.1`](../ui/hud.md#31-in-round-elements-visible-while-roundphase--playing-and-lifestate--alive)).            |
| **Absorb** | `[ENGULF_SEAL_PROGRESS, 1]`                          | Digestion. `inContact` holds by construction (carried).                         | 0 (carried: `prey.centre = predator.centre + carriedOffset` after the movement step, velocity = the predator's)                                         | `ENGULF_PREDATOR_SPEED_FACTOR_SEALED` | **Spit-out** rolls (spines). **Ratio** release: swallowed toxin and spikes drain the predator until `canContinue` fails, then the prey is ejected at its offset. Nothing else.                                                                                                                                              |

**Struggle (cover and wrap, while `inContact`).** The prey's steer command of this tick — the one the
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

**Swallowed toxin (wrap and absorb).** A prey's `toxinDrainFractionPerSecond` counts
`ENGULF_SWALLOWED_TOXIN_MULTIPLIER` times against its engulfer while the engulf is past cover (§4.1):
the poison is inside the membrane. Spikes (`spikeDrainFractionPerSecond`) drain as before in every
phase from the tick after the start. Both work through the ratio: the predator sheds mass until
`canContinue` fails and the prey is released (`ratio`), in whatever phase, seal included.

**Order inside the engulf step, per pair** (stable id order, #74; the numbers the scenarios quote come
from this order):

1. No engulf: start when `inContact` ∧ `canStart` ∧ the predator has no live refractory on this prey
   ∧ the prey was not released `aborted` this tick (below). Progress 0, then continue below on the same tick.
2. `¬canContinue` → release, reason `ratio`.
3. `phase` = `engulfPhaseOf(progress, balance.absorption)` from the progress at the start of the step.
4. Wrap or absorb with a positive chance: draw and compare → release, reason `spat_out`, refractory.
5. Cover or wrap: in contact → `progress += phaseRatePerTick × (1 − slowdown)`; out of contact → cover:
   release (`escaped`); wrap: `progress −= ENGULF_ESCAPE_DECAY_MULTIPLIER × baseRatePerTick`, release
   (`escaped`) when it is below `ENGULF_WRAP_START_PROGRESS − ε`. Absorb: `progress += phaseRatePerTick`.
6. Progress ≥ 1 − ε → payout. Progress crossed `ENGULF_SEAL_PROGRESS` this tick → seal (offset recorded,
   prey velocity zeroed). A tick that crosses a band boundary runs entirely at the rate of the phase it
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

| Who      | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Predator | mass += prey.mass × `ENGULF_MASS_YIELD` (cap overflow → DNA, §5.4); DNA += `ENGULF_DNA_BASE` + (prey.dnaCumulative − prey.dnaCatchUpGift) × `ENGULF_DNA_SHARE` (the prey's **earned** DNA, the score's own figure: the entry rule's gift buys levels, not rank, for the killer either, #271); tag points += prey tag points × `ENGULF_TAG_SHARE` plus `predatory` × `ENGULF_PREDATORY_TAG_POINTS`; absorptions += 1.                                                                                     |
| Dish     | detritus worth prey.mass × `DETRITUS_MASS_FRACTION` (§1).                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Prey     | cell removed this tick (`cell_absorbed` effect); player `lifeState` = `spectating` for `RESPAWN_SPECTATE_SECONDS`, then respawn ([`game-design/session.md §5.2`](../game-design/session.md#52-spawn-death-and-respawn)). Keeps level, traits, stage and `dnaKeptOnDeathFraction` of its progress.                                                                                                                                                                                                        |
| Traits   | never move. Absorption moves mass, DNA, tag points and the endosymbiont counter only; the prey keeps every trait (session.md §5.2). Trait stealing is a build-1 non-goal ([`game-design/controls-and-scope.md §10`](../game-design/controls-and-scope.md#10-explicit-non-goals-for-build-1)), so the payout draws no roll and `ENGULF_TRAIT_STEAL_CHANCE` is retired (#269; #260 removes the constant). A steal in a later build is a new mechanic and a new decision, with its own draw-order contract. |

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
     |  left contact (escaped)       |                    |                       |
     +-------------------------------+                    |                       |
     |  decayed below 1/6 (escaped) · spat out · ratio    |                       |
     +----------------------------------------------------+                       |
     |  spat out · ratio · aborted (chain, round end)                             |
     +----------------------------------------------------------------------------+
        every release: progress 0, cell_released { reason }

   cell (predator side):
              contact + canStart as predator          prey absorbed / released
   [free] ----------------------------------------> [engulfing] ------------------------> [free]

   [dividing]  (reserved, build 2: unreachable in build 1)

   player:
   [alive] --cell absorbed--> [spectating] --RESPAWN_SPECTATE_SECONDS--> respawn (new cell, [free]) --> [alive]
```

A cell can be `engulfing` and `being_engulfed` at once (a chain); the flags are independent.

### 6.3 Edge cases (resolved)

| Case                                 | Resolution                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mutual engulf                        | Impossible: `requiredRatio` ≥ 1.25 cannot hold both ways. Near-equal cells only push apart (§5.3).                                                                                                                                                                                                                                                                                   |
| Two predators reach one prey         | The first to satisfy contact + eligibility claims it; the other waits. Ties within a tick: lower cell id (stable ordering, #74).                                                                                                                                                                                                                                                     |
| Chain: B engulfs C while A engulfs B | Both run. If A finishes first, C is released (`aborted`, progress 0, at B's last centre, so it now sits inside A; nobody may claim C again on that tick, so A starts on it next tick at the earliest, §6.1) and A's payout is B alone. If B finishes first, B's mass jumps and A's eligibility is rechecked next tick. A sealed B keeps engulfing C from its carried centre.         |
| Predator drops below `releaseRatio`  | Released immediately (`ratio`) in any phase, seal included; the predator keeps no progress. Between `releaseRatio` and `requiredRatio` the engulf continues (hysteresis, §6.1). A prey ejected from the absorb phase reappears at its carried offset, overlapping the predator, and separation (§5.3) pushes it clear because the predator can no longer engulf it.                  |
| Prey moves away before the seal      | Cover: released the tick contact breaks. Wrap: contact breaks, progress decays at 2× the base rate and the prey is released when it falls below the wrap band (E11). This is the intended escape; the struggle slows the wrap meanwhile.                                                                                                                                             |
| Prey moves away after the seal       | Nothing: the prey is carried (`carriedOffset`), its input is latched but its speed cap is 0 (E11b). Spines and swallowed toxin are the only ways out.                                                                                                                                                                                                                                |
| Spat out, still overlapping          | The refractory (`ENGULF_SPIT_OUT_REFRACTORY_SECONDS`, one per spat-out prey, so two Diatoms spat out in turn each keep theirs) blocks a restart on that prey and separation pushes the pair apart meanwhile; after it, an idle pair sits just past touching and nothing restarts unless the predator closes in again (T4). Another predator may start on the spat-out prey at once.  |
| Predator or prey disconnects         | No special case: an input-less cell is still a cell. Removing a cell (`dissolveCell`) aborts every engulf it is part of, on both sides, before it leaves the world. If the prey is removed from the room mid-engulf, the predator gets no payout and the removed cell drops detritus. If a predator carrying a sealed prey is removed, the prey is released (`aborted`) where it is. |
| Round enters `results` mid-engulf    | Engulf aborted (`aborted`), no payout.                                                                                                                                                                                                                                                                                                                                               |
| Level-up mid-engulf (either side)    | The draft opens normally; the simulation never pauses.                                                                                                                                                                                                                                                                                                                               |
| Engulf at the wall                   | Clamping only moves centres inward, so contact is never broken by the wall. A carried prey goes through the same clamp as any other cell, so it never rides past the rim either.                                                                                                                                                                                                     |
| Predator at `CELL_MAX_MASS`          | Yield converts to DNA (§5.4).                                                                                                                                                                                                                                                                                                                                                        |
| Prey lifted by the entry rule        | The share reads earned DNA only (#271): G13's player, respawned at 6:30 with `dnaCumulative` 140 all gift and `ENTRY_MAX_MASS` 200, pays its killer 30 DNA, not 58. Eating the same lifted player every respawn (3 s) is worth the base alone, so a gift is never farmed into someone else's score (E9c).                                                                            |
| Same organism (build 2)              | Cells sharing `organismId` never engulf each other. Trivially true in build 1.                                                                                                                                                                                                                                                                                                       |
| Engulf during split (build 2)        | Open for #28. Proposed: each daughter cell is an independent prey; a predator engulfing a cell that splits keeps the half it overlaps.                                                                                                                                                                                                                                               |
| Partial absorption / nibbling        | Not in v1 (game-design/controls-and-scope.md §10 non-goals).                                                                                                                                                                                                                                                                                                                         |
