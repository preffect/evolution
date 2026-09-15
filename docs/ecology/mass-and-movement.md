# Evolution — Ecology, Growth and Absorption: mass decay, size, mass and speed

§4–§5 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

## 4. Mass decay

```
decayPerSecond = max(0, mass − CELL_STARTING_MASS) × MASS_DECAY_RATE_PER_SECOND × zoneDecayMultiplier
```

Applied every tick in the metabolism step (§4.1). Mass never drops below `CELL_STARTING_MASS` by
decay or drains. `zoneDecayMultiplier` is `VENT_DECAY_MULTIPLIER` in the vent, 1 elsewhere; the trait
`decayMultiplier` ([`traits/model.md §2`](../traits/model.md#2-modifier-model)) multiplies on top. At mass 1020 in
the broth this is 2.0 mass/s: idling halves your surplus in about 6 minutes, so a giant must keep eating.

### 4.1 The metabolism step (one formula)

Every metabolism term reads the mass at the start of the step, so a test can reproduce a tick exactly:

```
drainFraction = Σ toxinDrainFractionPerSecond (of every cell whose toxin reaches this one, except the prey this cell is
                  engulfing while that engulf is past cover: that prey's toxin is the dose below instead)
swallowedDose = prey.mass × prey.toxinDrainFractionPerSecond × ENGULF_SWALLOWED_TOXIN_MULTIPLIER   (engulf past cover, §6.1)
              + prey.mass × prey.spikeDrainFractionPerSecond                                     (while progress > 0)
                (prey = the cell this one is engulfing, its mass at the start of the step; 0 when not engulfing)
mass' = max(CELL_STARTING_MASS, mass − decayPerSecond × TICK_INTERVAL_S − mass × drainFraction × TICK_INTERVAL_S
                                − swallowedDose × TICK_INTERVAL_S)
        + photosynthesisMassPerSecond × TICK_INTERVAL_S           (only inside sunlit_shallows; a gain, so capped, §5.4)
```

A toxic cell's toxin reaches a cell whose centre is within
`target.radius + toxic.radius × (1 + toxinAuraRangeInRadii)`: contact, plus the aura measured from the toxic
cell's rim (`toxinAuraRangeInRadii` is 0 without Stentor Trumpet, `traits/catalog-forms.md §3.16`, #424).

The contact drain is a share of the victim's own mass (a field: everything near the poison loses the same
share); the swallowed dose is set by the prey's mass (#154: a heavy predator is not punished for its size,
so a completed meal of a prey whose only defence is the toxin always pays, `traits/catalog-organelles.md §3.11`;
armour stacked on it can still tip a meal negative, `traits/catalog-forms.md §3.17`).

The photosynthesis term is a mass gain like eating: it goes through the cap of §5.4, and the part
above `CELL_MAX_MASS` becomes DNA at `MASS_OVERFLOW_DNA_PER_MASS` (#179). A cell with no player (a
wild cell, whose mass the world re-pins every tick) is clamped to the cap and gains no DNA. At the
default balance light alone never reaches the cap: photosynthesis equals decay at
`CELL_STARTING_MASS + photosynthesisMassPerSecond / (MASS_DECAY_RATE_PER_SECOND × decayMultiplier)`,
186.67 / 395 / 662.86 mass for Chloroplast I / II / III (T5); a cell above that loses mass in the light.

Drained mass is lost to the dish. The step runs after eating and before the engulf update
([`ARCHITECTURE.md`](../ARCHITECTURE.md), fixed step order), which is why a predator that
starts an engulf on tick _t_ first pays the spike drain on tick _t_ + 1.

## 5. Size, mass and speed

### 5.1 Curves

```
radius(mass)   = CELL_RADIUS_SCALE × sqrt(mass)                       (area ∝ mass)
maxSpeed(mass) = clamp(CELL_BASE_SPEED × (CELL_STARTING_MASS / mass) ^ CELL_SPEED_MASS_EXPONENT,
                       CELL_MIN_SPEED, CELL_BASE_SPEED)
```

| Mass | Radius (wu) | Max speed (wu/s) | Note                                         |
| ---- | ----------- | ---------------- | -------------------------------------------- |
| 20   | 17.9        | 220.0            | starting cell                                |
| 80   | 35.8        | 155.6            | a minute of grazing                          |
| 320  | 71.6        | 110.0            | half speed at 16× mass                       |
| 1000 | 126.5       | 82.7             | apex of a typical round                      |
| 2000 | 178.9       | 69.6             |                                              |
| 5000 | 282.8       | 55.3             | `CELL_MAX_MASS`; ≈ 19 % of the dish diameter |

Reviewed for feel: a starting cell crosses its own diameter in 0.16 s, a 1000-mass cell in 3 s.
Escape is always possible on paper (prey is faster); the predator's tools are ambush and zones.

### 5.2 Movement step (server, per tick)

```
direction = normalise(target − centre)
throttle  = clamp((|target − centre| / radius − STEER_DEAD_ZONE_RADII)
                  / (STEER_FULL_THROTTLE_RADII − STEER_DEAD_ZONE_RADII), 0, 1)
speedCap  = maxSpeed(mass) × sprintFactor × zoneSpeedFactor × traitSpeedFactor × engulfSpeedFactor
desired   = direction × throttle × speedCap
velocity += (desired − velocity) × steerBlendPerTick               (derived in code: TICK_INTERVAL_S / (CELL_ACCELERATION_SECONDS × accelerationSecondsMultiplier))
centre   += velocity × TICK_INTERVAL_S
clamp centre to DISH_RADIUS − radius; zero the outward radial velocity on contact
```

`target` is the latest applied input's target, latched until an input carrying one replaces it; an input
whose `targetX/targetY` are null does not steer. A cell has **no target until its player's first input
with one**: a spawn, a respawn and a fixture placement all start without one, exactly as a
wild seat does before its first decision ([`wild-cells.md §3.3`](wild-cells.md)). The client sends no
target while it has no own cell, so the inputs it built while spectating, still in flight when the
respawned cell is placed, leave that cell without a target until the client has seen it (#346, G8b). No target is
throttle 0, so an idle cell stays wherever separation (§5.3) pushes it instead of steering back to the
point it was placed at (E10). The blend is the only drag: with no input `desired` is zero and the cell
coasts to a stop within about a second. `gelSpeedFactor(mass) = max(clamp(1 − mass / GEL_MASS_SCALE, GEL_MIN_SPEED_FACTOR,
GEL_MAX_SPEED_FACTOR), gelSpeedFactorFloor)`: the gel barely slows a starting cell and cuts a 600-mass
cell to 40 %, which is why small cells shelter there; the amoeba's `gelSpeedFactorFloor` is the only
way through ([`traits/catalog-forms.md §3.12`](../traits/catalog-forms.md)). Trait factors: [`TRAITS.md`](../TRAITS.md).
`engulfSpeedFactor` is per phase (§6.1: prey 1 / held / 0 in cover / wrap / absorb, predator 0.6 before
the seal and 1 after) and reads the engulf state at the end of the previous tick. The kernel exposes `steerCommand(pose, step)` (direction and throttle of this tick) and
`stepMovementFrom(pose, command, step)`; the movement step takes the command once per cell at the top of
step 3, before anything has moved, stores it on the record and passes it to the kernel, so the engulf
step's struggle reads the very command the movement used, never a second copy of the throttle arithmetic
and never the same formula at a different pose. The sprint duration and cooldown count down in the same
step **after the move**, for every cell including a carried one: `sprintFactor` reads the duration while
the cell moves, so a tick of sprint has to be spent before it is counted, and a sealed prey spends the
sprint it paid for rather than banking it. A carried prey (§6.1
absorb) skips this step: its centre is set from its predator's after the predator has moved.

### 5.3 Cell-to-cell contact

Two cells that overlap and where neither can engulf the other (§6.1) are pushed apart along the
centre line by `CELL_SEPARATION_FRACTION_PER_TICK` of the overlap each tick, split by inverse mass
(the lighter cell moves more). Separation never applies to a predator and its current prey: while an
engulf is in progress the pair is left alone until payout or release, whatever the mass ratio has
drifted to (E16). A pair inside a spit-out refractory (§6.1) is separated as if neither could engulf the
other, so a spat-out prey is pushed clear (T4). Cells never bounce; the renderer draws the contact dent.

### 5.4 Growth, cap and mitosis (reserved)

- Mass gained from food is applied in full (`digestionFactor` = 1 + trait bonuses).
- At `CELL_MAX_MASS` any further mass, from food, absorption or photosynthesis (§4.1), is converted to
  DNA at `MASS_OVERFLOW_DNA_PER_MASS` so growing at the cap still progresses the leaderboard. One home:
  every mass gain goes through the capped gain; nothing adds mass past the cap (#179).
- **Mitosis, merge-back and eject are build 2.** Their constants are declared in `growth.ts` so the
  contract is stable: `MITOSIS_MIN_MASS` 200, `MITOSIS_MAX_CELLS` 4, `MITOSIS_COOLDOWN_SECONDS` 8,
  `MITOSIS_MERGE_SECONDS` 20, `EJECT_MASS` 10. `GameInput.shouldSplit` / `.shouldEject` are validated and ignored;
  the `dividing` cell state is unreachable. #28 will specify the rules; engulf interactions are listed
  in §6.3 as open for that ticket.
