# Evolution — Game Design: the early game true to life

§15 of the split [`GAME-DESIGN.md`](../GAME-DESIGN.md), which keeps the shared context and the file list.

## 15. The early game true to life (ticket #865)

Epic #761; decision ticket #791 (answer **A**); the build is epic #906 (its roadmap comment gives the order). This section is the decided design: what the build makes. Numbers
marked **(tuning)** are starting values for the build and for gameplay QA to move; everything else is decided.
Nothing here is built yet: until the "early life on" slice lands (§15.10), [`core.md`](./core.md) §3,
[`session.md`](./session.md) §5.1 and the ecology and trait docs describe the game as it plays today, each with a
pointer here. It changes the dish era only; where it meets the phases plan is §15.8.7.

### 15.1 What the human decided (decision ticket #791, answer A)

- You are an **archaeon** (an Asgard archaeon), not "a bacterium or archaeon"; the mitochondrion comes from a
  partner **bacterium**.
- The protocell and the archaeon **absorb** food (the specks) and **cannot swallow** cells.
- The archaeon has **arms that latch onto bacteria**; holding bacteria is how the mitochondrion is earned.
- **Swallowing unlocks with the internal skeleton** (the eukaryote), and the unlock is a teaching moment.
- The **chloroplast moves after the nucleus**.

Why it is true. The cell line that became complex cells was an Asgard archaeon (Eme et al. 2023). Bacteria and
archaea take in dissolved food through their skin; swallowing a whole cell needs an inner skeleton of protein threads
and motor proteins, which complex cells (eukaryotes) have (Rodrigues-Oliveira et al. 2023 found the first threads of
it, actin, already in an Asgard archaeon's arms, but no archaeon is known to swallow). The one Asgard archaeon grown in
a lab, _Prometheoarchaeum_, is about half a micrometre across, lives tangled in long branching arms with partner
bacteria it trades food with, and suggested the "entangle, engulf, endogenize" story: the partner was held, then
wrapped, then kept, never swallowed in one gulp (Imachi et al. 2020). The chloroplast came much later, when a complex
cell swallowed a green bacterium (a cyanobacterium).

How this reads the answer's open points (design calls, not new questions):

- **The arms come with the stage, not with a pick.** Every archaeon has them (`LATCH_FROM_STAGE`), as every
  _Prometheoarchaeum_ does. A pick would add a rung and slow the climb.
- **Swallowing comes with the eukaryote stage, not with a pick.** The nuclear envelope makes you a eukaryote, and
  the game's eukaryote has its inner skeleton (`SWALLOW_FROM_STAGE`). The Cytoskeleton Lattice stays an optional
  eukaryote pick: a denser skeleton, worded so (§15.9).
- **The specks keep their art and names.** The green motes stay "algae" in code and on screen; what the
  encyclopedia says about absorbing them is §15.9 (and question 2 of §15.14).

### 15.2 The early ladder

```
 stage id       shown as        gate (own any)        eats                            the new thing
 protocell      Protocell       —                     absorbs specks                  —
     |  pick the Nucleoid Coil
 prokaryote     Archaeon        nucleoid              absorbs specks; latches         arms: hold bacteria (§15.4)
     |  hold 10 aerobic bacteria to the bond, then pick the Mitochondrion
 endosymbiosis  Endosymbiosis   mitochondrion         absorbs specks; latches         a partner inside
     |  pick the Nuclear Envelope
 eukaryote      Eukaryote       nuclear_envelope      absorbs specks; swallows        SWALLOWING (§15.5); the chloroplast (§15.6)
     |  pick a form (after its own requirement)
 specialised    (the form)      a form                as a eukaryote                  —
```

What a player cell at each early stage can and cannot do (with the switch on, §15.10):

| Stage           | Absorbs specks (algae, detritus, DNA fragments) | A bacterium it touches                                  | Swallows a cell | Can be swallowed by                                   | Endosymbiont credit                                   |
| --------------- | ----------------------------------------------- | ------------------------------------------------------- | --------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `protocell`     | yes                                             | passes under it: nothing happens                        | no              | any eukaryote cell heavy enough, and the giant amoeba | none                                                  |
| `prokaryote`    | yes                                             | **latched** by the arms, up to `LATCH_MAX_HELD` (§15.4) | no              | the same                                              | an aerobic bacterium held to the bond: +1 aerobic     |
| `endosymbiosis` | yes                                             | latched                                                 | no              | the same                                              | as the archaeon (the count no longer matters)         |
| `eukaryote`     | yes                                             | **swallowed** whole on touch, as today's eating rule    | **yes** (§15.5) | the same                                              | any bacterium swallowed: +1 of its variant (as today) |
| `specialised`   | yes                                             | swallowed                                               | yes             | the same                                              | as the eukaryote                                      |

Wild cells and giants keep their own diets (`simulation/cell-diet.ts`, unchanged): a wild cell eats algae and detritus
only, the giant grazer bacteria too, the hunter and the drifter no mote. Who among them may swallow a cell is §15.5.1:
a wild cell by the world's stage, a giant by its species.

### 15.3 Absorbing

Every player cell **absorbs** the specks it touches: algae, detritus and DNA fragments, by today's eating rule (a mote is
taken the tick its centre lies within the cell's radius; ecology/food-and-spawn.md §1). Nothing about the payout
changes. What changes is the look and the words: a speck **dissolves into the membrane** (it shrinks and fades into
the rim over about a fifth of a second with a faint ripple, render ticket) instead of the gulp, at every stage; the
gulp stays for what is swallowed (a bacterium or a cell, eukaryotes only). DNA fragments are loose DNA in the water:
real bacteria and archaea really do take it in through their skin (natural transformation), so the fragment is the
truest food in the dish.

**Bacteria are not specks.** A bacterium is a cell: a protocell passes over it, an archaeon latches it (§15.4), a
eukaryote swallows it (§15.5). Wild cells leave bacteria alone, as today (ecology/wild-cells.md §3.3.3), so they never
latch.

### 15.4 The latch: the archaeon's arms

#### 15.4.1 Rules

- **Who latches.** A cell whose stage has reached `LATCH_FROM_STAGE` (`prokaryote`) and has not reached
  `SWALLOW_FROM_STAGE`: the archaeon and the endosymbiosis stage. Players only; wild cells and giants never latch.
- **What it latches.** A bacterium mote whose centre lies within `radius × (1 + LATCH_REACH_RADII)` of the cell's
  centre (the arms reach a little past the body), while the cell holds fewer than `LATCH_MAX_HELD` and its sprint is
  not running. The mote leaves the world and joins the cell's **held list**: the held entry keeps the **mote's own record**
  (its id, mass, DNA, tag and heading, untouched) plus `bearingRadians` (from the cell's centre at the catch) and
  `caughtAtTick`. Order: the eating step's own (cells in array order, motes in id
  order), so of two archaea reaching one bacterium on one tick the earlier cell takes it, as with eating. Bacteria past
  the cap pass under the cell as they would under a protocell.
- **Held bacteria ride along.** They sit on the rim at their bearing (drawing only; they add no mass, no radius and no
  collision) and move with the cell.
- **The bond.** A bacterium held for `LATCH_BOND_SECONDS` **bonds**: it leaves the held list and is eaten through
  the eating step's own `eatFoodMote` on its kept record, so it pays exactly what eating it pays today by construction
  (`BACTERIUM_MASS` through the digestion factor, `BACTERIUM_DNA` through `dnaGainMultiplier`, the variant's tag point)
  and emits the ordinary **`eat` effect** with the mote's id as `eatenId`. The mass accounting reads `eat.massGained`
  (the HUD's gain rate, `state/recent-eats.ts`, `state/mass-trend.ts`, `hud/format/affecting-causes.ts`, and the
  mass-flow invariant Δmass = Σ rates + Σ `eat.massGained` of `mass-flow-setups.ts`), so a bond with no `eat` would
  break it. Beside it, `bacterium_bonded { cellId, moteId, isCredited }` says the meal was a bond. The bond **credits its variant's counter** (`bacteriaEatenByVariant`) **only if the cell has
  reached the stage of the endosymbiont that variant unlocks** (the catalog row whose `unlockedBy` names it). With the
  ladder of §15.6 that is: aerobic yes (the Mitochondrion is a `prokaryote` trait), photosynthetic never (the
  Chloroplast is a `eukaryote` trait, and a cell that latches is never a eukaryote), plain has no endosymbiont. The
  rule reads the catalog; no list of variants is written anywhere.
- **The unlock is unchanged.** `ENDOSYMBIOSIS_BACTERIA_REQUIRED` (10) aerobic bacteria taken in make the Mitochondrion
  a candidate, and the rung card offers it at the next level-up (PROGRESSION.md §3; the partner card of §15.6 says the
  same of any earned endosymbiont). Two clusters of five held to the
  bond is the vent trip, as two clusters eaten is today.
- **A bond is a real partnership, made quick.** In life the partners traded food for countless generations before
  one ended up inside; the game compresses it to six seconds of holding and a count of ten.

The counter keeps its wire name `bacteriaEatenByVariant` unless the contract ticket renames it; its meaning is
"taken in: held to the bond or swallowed".

#### 15.4.2 Losing held bacteria

| When                                                                       | What happens to every held bacterium                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the cell **starts a sprint** (step 1, where the sprint is set)             | shaken loose: its kept record goes back into the world as a free bacterium at its rim point with a fresh entity id and its own heading (nothing new is drawn from the `moteMotion` stream), no payout, no credit; one `latch_shaken` naming the mote ids. No latching while the sprint runs, so it cannot catch it back                                                                                                                                                                                                               |
| the cell is **removed** (absorbed, dissolved, disconnected)                | dropped free at its rim point, as above, before the cell's detritus                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| the cell **has reached `SWALLOW_FROM_STAGE`**                              | **swallowed**: at the start of every eating step, any cell whose stage has reached `SWALLOW_FROM_STAGE` eats its whole held list through `eatFoodMote` (one `eat` each, its counter credited by today's rule). A per-tick invariant, not an event: one home covers a pick (applied at step 1, so the swallow lands on the same tick), the gift at the move, `debug_set_player`, and a `debug_set_balance` that moves the switch while archaea hold bacteria. No eukaryote ever holds a bacterium. Your first swallow is your partners |
| the move to the rock pool at 10:00 (phases.md §14.4.2 step 1, ticket #868) | gone with the dish's motes: no payout, no credit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| a rematch                                                                  | gone (every cell is new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

So a held cluster is something to protect: the giant amoeba bearing down on you at the vent asks you to choose
between your partners and a sprint.

#### 15.4.3 How it looks and sounds

- **The arms.** From the prokaryote stage on, the cell grows thin branching arms that reach `LATCH_REACH_RADII` past
  the rim, exactly as far as they catch, so what you see is what latches; drawn in the seat colour's rim tone (the
  _Prometheoarchaeum_ look). They are hair-thin and many, never the amoeba's blunt lobes, so the two
  never read alike. They go when the cell becomes a eukaryote (its skin now flows instead).
- **A held bacterium** sits on the rim with an arm wrapped round it; its rod brightens from its own colour toward the
  seat colour as its bond progresses (the client derives the progress from `caughtAtTick`, its render tick and the live
  `LATCH_BOND_SECONDS`, §15.11). On the bond it slides into the membrane with a soft pulse, and an
  aerobic one lights the next pip of the Mitochondrion's counter on the ladder orbit (ui/hud.md §3.1.2).
- **Sound** (the audio ticket, docs/AUDIO.md §2): a small wet catch on the latch, a soft chord on the bond, a dry
  scatter when a sprint shakes them loose.
- **Names in code.** "Arm" already names the amoeba's pseudopod grab (#735: `isArmHold`, `armRegrabRefractories`,
  `engulf-arm-grab.ts`). Every new identifier of this mechanic says `latch` (`latchedBacteria`, `LATCH_*`,
  `latch_shaken`), never `arm`; "arms" is the players' word only.

### 15.5 Swallowing unlocks with the internal skeleton

#### 15.5.1 The rule

- **Cells.** `canEngulf` (the one shared predicate, ecology/absorption.md §6.1) gains a predator test. The species
  decides for a giant (and, from the phases build, a pool creature); the stage decides for a player or a plain wild
  cell:

  ```
  canEngulf(predator, prey) = isCellEaterSpecies(predator.species)
                              ∧ (predator.species ≠ null ∨ hasReachedStage(predator.stage, SWALLOW_FROM_STAGE))
                              ∧ meetsEngulfStartRatio(predator, prey)
  ```

  `species` is `giantSpecies` today; the phases contract adds the creature species to the same test, so a creature
  built with no ladder still swallows, and the giant amoeba swallows because it is a hunter, not because its build
  happens to reach `specialised`. `SWALLOW_FROM_STAGE` lives in the **`absorption` balance domain**, beside the ratios,
  so `EngulfRatioBalance` widens by one leaf and none of the predicate's fifteen or so callers changes its argument. The mass
  half is exported on its own as `meetsEngulfStartRatio(predator, prey, balance)` (in `engulf-eligibility.ts`), which
  the HUD's "can't swallow yet" beat reads (§15.9.1) instead of re-deriving the ratio. With the switch on no protocell,
  archaeon or endosymbiosis cell, player or wild, ever starts an engulf. Every caller (the server's contact and engulf steps, the
  wild cells' flee, hunt, hunt sprint and closer-rival rules, the bots, the HUD's danger chip and relations, the
  renderer's warning ring, the client's own-cell danger) reads it, so none can disagree. The giant amoeba keeps
  swallowing; the grazer and the drifter still never do. `canContinueEngulf` is unchanged (an
  engulf can only have started under `canEngulf`). The prey side is unchanged: anything may be swallowed.

- **Bacteria.** A cell at or past `SWALLOW_FROM_STAGE` eats a bacterium by today's eating rule (whole, on touch) and
  credits its counter as today; below it, a bacterium is latched or passed over (§15.4). One shared pure function
  answers what a touch does, `bacteriumContactOutcome(stage, heldCount, balance)` → `'swallow' | 'latch' | 'pass'`, read
  by the server's eating step and the bots' mote filter (§15.8.3).
- **The world.** A wild cell's stage is the world's (ecology/wild-cells.md §3.3.2), so wild cells swallow nothing until
  the world reaches `eukaryote` (9:00 in a 600 s round, world level 4). `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`
  (`endosymbiosis`) is then subsumed: it stays, and stops mattering while the switch is on.

#### 15.5.2 The teaching moment on screen

It plays on the tick the own cell's stage first reaches `SWALLOW_FROM_STAGE` (in play: the Nuclear Envelope's pick;
at 10:00: the no-form gift, phases.md §14.4.3), in this order, while you keep steering:

1. **The pick's own popup**: Nuclear Envelope I, as today (ui/overlays.md §3.8), and the nucleus forms (today's
   render).
2. **Your partners go inside.** Any held bacteria slide into the cell, one gulp pulse each (§15.4.2): your first
   swallow.
3. **The skeleton shows.** A lattice of fine threads spreads from the nucleus to the membrane over
   `SWALLOW_UNLOCK_LATTICE_SECONDS` and fades; the arms draw in and are gone; the membrane's wobble becomes the
   eukaryote's flowing edge.
4. **The reveal.** A ring goes out from your cell to the edge of the view over `SWALLOW_UNLOCK_PING_SECONDS`; as it
   passes each cell you can now swallow, that cell's green `EDIBLE` ring (ui/hud.md §3.1.5, which from this tick
   shows anyway, because it reads `canEngulf`) lights with a pop. The world you could only bump into is suddenly food.
5. **The ability popup**, form-sized (ui/overlays.md §3.8's form popup, a new `ability` kind, test id
   `ability-popup`, `data-ability="engulf"`), queued after the Nuclear Envelope's: the text is §15.9.3.
6. **The prey coach beat** (ui/input-and-onboarding.md §5, unchanged) fires the first time an edible cell is near:
   `Green ring: you can engulf it · swim over it`.

At the move (a gifted eukaryote), steps 2 to 4 are skipped while the move's camera eases (phases.md §14.4.4: the
caption and the scale bar own that moment), and the popup queues after the gifted form's. A late joiner or a reconnect
whose first snapshot is already a eukaryote sees nothing (the popups' first-snapshot rule).

### 15.6 The chloroplast after the nucleus

- **The catalog.** `chloroplast` moves from `stage: 'prokaryote'` to `stage: 'eukaryote'`; it keeps
  `unlockedBy: { photosynthetic, ENDOSYMBIOSIS_BACTERIA_REQUIRED }`, its tiers, rarity and tags. It is no longer an
  endosymbiosis gate: `STAGE_GATE_TRAITS.endosymbiosis` = `['mitochondrion']`. Every eukaryote therefore owns a
  mitochondrion, which is true of every eukaryote's ancestry.
- **How it is earned.** Swallow ten photosynthetic bacteria as a eukaryote (the shallows trip, now a late trip), or
  swallow a cell that owns a chloroplast (the counter credited in full, as today). Bacteria latched earlier never count
  (§15.4.1).
- **The partner card.** Off the rung, the chloroplast would lose its reserved card (`takeRungCard` reserves only the
  next stage's gates, which for a eukaryote are the forms) and be one weighted draw among about nine eukaryote
  candidates. So the draft reserves a second card, the **partner card**, the same way the rung card works: after the
  rung card is drawn, if any candidate is an **earned partner** (a trait with `unlockedBy`, its counter met, its stage
  reached, not owned, a new-trait card) that the rung card did not take, one card is drawn among those by weight. The
  rule reads `unlockedBy` and `stage` from the catalog; no list names the two. At most one rung card and one partner
  card, so a draft keeps at least one free card; when the rung card is itself the earned partner (the mitochondrion for
  an archaeon) only one card is reserved. Today's game is unchanged by it except that a prokaryote that has earned both
  endosymbionts sees both. Scenario EL21.
- **The unlock toast tells the truth.** `<Trait> unlocked · offered at your next level-up` fires the first time an
  endosymbiont becomes a candidate (counter met **and** stage reached, not owned), not when the counter fills. With the
  partner card it is then always offered at the next level-up. A cell that fills the photosynthetic counter before it
  is a eukaryote (possible with the switch off) gets the toast on the tick it becomes one.
- **The euglena's road.** Nucleoid, Mitochondrion, Nuclear Envelope, Chloroplast, Euglena Eyespot: five picks, like
  every other form (today the euglena's chloroplast doubles as its endosymbiont, so it takes four). The partner card
  offers the chloroplast at the first level-up after it is earned, and the rung card then offers the eyespot among the
  form gates (photic tag points weight it). No form is reachable before level 6.
- **The ladder orbit** (ui/hud.md §3.1.2) shows an endosymbiont's counter while the cell has reached the endosymbiont's
  stage and does not own it: the Mitochondrion's from the archaeon on, the Chloroplast's from the eukaryote on. The same
  rule describes today's orbit (both are `prokaryote` traits today), so it ships with the reorder.
- **The reorder ships alone, before the switch** (§15.10), so everything it changes must be true with the switch off,
  when every cell still swallows from the start and nothing latches. In the live game after the reorder: a prokaryote
  eats aerobic bacteria for the mitochondrion as today; photosynthetic bacteria eaten at any stage still fill their
  counter, but the chloroplast is offered only to a eukaryote. The copy it rewrites, in switch-off-true words:

  | Where                                                   | Today                                                                                   | After the reorder (true with the switch off)                                                       |
  | ------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
  | prokaryote pill (`onboarding-text.ts`)                  | `Eat 10 orange rods at the warm vent or 10 green in the shallows · the pips count them` | `Eat {10} orange rods at the warm vent · the pips count them`                                      |
  | shallows zone pill                                      | `Sunlight feeds a Chloroplast · green rods live here`                                   | `Sunlight feeds a Chloroplast · a nucleus can take one from the green rods here`                   |
  | unlock toast                                            | fires when the counter fills                                                            | fires when the trait becomes a candidate (above)                                                   |
  | encyclopedia, Chloroplast                               | `… you swallowed and kept … Owning it starts [[stage:endosymbiosis]]`                   | a eukaryote's trait: eat enough photosynthetic bacteria, and once you have a nucleus it is offered |
  | encyclopedia, Endosymbiosis stage                       | `… one of {reachedBy} …`                                                                | the mitochondrion alone reaches it (the derived link already reads the gate)                       |
  | encyclopedia, Eukaryote stage and the orbit's HUD entry | the chloroplast is not named                                                            | the chloroplast opens here; its counter shows from the eukaryote on                                |

  §15.9's copy is the switch-on game and ships by the rule of §15.10.

- **Builds that change** (each still a valid ladder by `ladderProblem`; the reorder makes the old ones invalid):

| Build                                         | Today                                                                                                       | After                                                                                                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WILD_CELL_BUILDS[1]` (the paramecium)        | `nucleoid`, `chloroplast`, `nuclear_envelope`, `cilia`, `paramecium_cilia`, `ribosomes`, `simple_flagellum` | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cilia`, `paramecium_cilia`, `ribosomes`, `simple_flagellum`                                                                                                                        |
| `GIANT_BUILDS_BY_SPECIES.giant_diatom`        | `nucleoid` I, `chloroplast` I, `nuclear_envelope` I, `cell_wall` I, `diatom_shell` I (level 6)              | `nucleoid` I, `mitochondrion` I, `nuclear_envelope` I, `chloroplast` I, `cell_wall` I, `diatom_shell` I (level 7, derived). Mitochondrion I's decay × 0.85: it still never grows (giants.md §3.5.4 numbers re-derived by the ticket) |
| the per-form pool builds (phases ticket #871) | not yet written                                                                                             | the euglena's: mitochondrion second, chloroplast after the envelope                                                                                                                                                                  |

The world's stage clock is unchanged: it reads build 0 (`nucleoid`, `mitochondrion`, `nuclear_envelope`, …), which
the reorder does not touch (ecology/food-and-spawn.md §3.1).

### 15.7 The pace

The #138 slow-dawn targets (core.md §3, ± 20 s for one active player) are kept for the first three rungs and
re-read:

| Round time   | Phase (session.md §5.1) | What the player does                                                                                                                                                                                                         |
| ------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 – 3:00  | Dawn                    | A protocell: absorbs algae, scraps and DNA fragments; bacteria pass under it; nothing but the giant amoeba can eat it, and nothing can it eat. Nucleoid at level 2, ~2:50                                                    |
| 3:00 – 5:40  | The arms                | An archaeon: its arms latch bacteria; the vent trip holds two clusters of aerobic bacteria to the bond. Mitochondrion at level 3, ~5:40. The giant amoeba starts to hunt it from 225 mass (~3:25)                            |
| 5:40 – 8:00  | Partners                | Absorb and latch for food, dodge the giant amoeba. Nuclear envelope at level 4, ~8:00                                                                                                                                        |
| 8:00 – 10:00 | Bloom, and the food web | The first eukaryotes swallow: a player at ~8:00, the wild cells from 9:00 (world level 4). Engulfs now decide the leaderboard. The shallows trip for the chloroplast. A form only at level 6, past 10:00 for nearly everyone |

- **The protocell loses its bacteria.** Today a bacterium every ~10 s (1 DNA) is part of the protocell's income, about
  a quarter of the 60 DNA to level 2 (ecology/food-and-spawn.md §3). The start value replacing it:
  `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` 0.3 → **0.4** (tuning; with the switch, in the "on" slice), which brings the
  pace model's level 2 back to about 3:00. The archaeon's latch pays the same as eating, so the later rungs keep their
  pace. Gameplay QA measures the model's three targets and the P1 bound (level 2 by 6:00) and moves this one value.
- **No form inside a 10-minute dish.** Every form is now five picks (level 6, 500 DNA). In the three-era game (phases.md
  §14) the move at 10:00 gifts a form to whoever has none (§14.4.3), so the pool era starts with everyone formed, as
  planned; in a game of `ROUND_DURATION_SECONDS` 600 almost no one ends with a form. Today only a euglena could take one
  at level 5 (9:40), so little is lost.
- **Early absorptions vanish.** Before 8:00 nobody scores an absorption (the pace model never counted any, core.md §3);
  score is DNA. The death rate before 8:00 is the giant amoeba's alone.

### 15.8 What else it touches

#### 15.8.1 Wild cells

- They swallow nothing until the world is `eukaryote` (§15.5.1), so the early dish has no wild-eats-wild churn and no
  wild hunts; they graze, wander and flee only the giant amoeba. The die-off (ecology/wild-cells.md §3.3.6) keeps their
  numbers, and its dissolved cells still drop detritus.
- From 9:00 they hunt each other and players by today's rules; the "hunt players from `endosymbiosis`" gate is subsumed.
- `WILD_CELL_BUILDS[1]` changes (§15.6); a wild cell owns no chloroplast in the dish.
- A wild cell never latches and still leaves bacteria alone.

#### 15.8.2 The giants

- The giant amoeba is `specialised`: it swallows any cell it touches and can engulf, and hunts in its window from 225
  mass, as today. It becomes the early dish's one predator, which is true to life: big eukaryotes graze archaea and
  bacteria.
- The grazer and the drifter are unchanged. Players can swallow a giant only as eukaryotes (they never could earlier:
  the lightest giant needs 1 125 mass).
- The giant diatom's build is re-ordered (§15.6); its level goes from 6 to 7 (derived), its payout (`GIANT_DNA_BONUS`)
  does not change, and eating it still credits the chloroplast's counter in full.

#### 15.8.3 The bots

- **`grazer`, `forager` and the hunter's graze** aim at the nearest mote their cell can use: a bacterium only when
  `bacteriumContactOutcome` is `latch` or `swallow` for it (a protocell, or an archaeon with a full held list, skips
  bacteria). The filter lives in the bots' perception beside `canEngulf`, so no strategy carries its own rule.
- **`hunter`** reads `canEngulf`, so before the swallow stage it never finds prey and grazes (#376's grazing hunter), as
  it should. **`flee`** likewise flees only what can swallow it.
- **No new strategy.** A grazer latches by touching; holding to the bond needs no steering.
- **The predation bench** (`bench:predation`, testing/bots-and-design-tables.md §8.3) will print near-zero player
  absorptions before 8:00; gameplay QA records the new baseline.

#### 15.8.4 The balance tables and numbers

| Table or number                                                                                               | Change                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `TRAIT_CATALOG` (`traits.ts`)                                                                                 | `chloroplast.stage` `prokaryote` → `eukaryote` (§15.6)                                                                    |
| `STAGE_GATE_TRAITS` (`ladder.ts`)                                                                             | `endosymbiosis`: `['mitochondrion', 'chloroplast']` → `['mitochondrion']`                                                 |
| `WILD_CELL_BUILDS` (`wild-cells.ts`)                                                                          | build 1 (§15.6)                                                                                                           |
| `GIANT_BUILDS_BY_SPECIES` (`giants.ts`)                                                                       | `giant_diatom` (§15.6)                                                                                                    |
| `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` (`ecology.ts`)                                                           | 0.3 → 0.4 (tuning, §15.7), in the "on" slice                                                                              |
| `ENDOSYMBIOSIS_BACTERIA_REQUIRED`, level costs, `ENGULF_*`, food mix by world stage, zone and variant weights | unchanged. The shallows' photosynthetic clusters now serve a late trip; the protocell era's bacteria wait for the archaea |
| `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`                                                                          | unchanged (subsumed while the switch is on)                                                                               |
| new: the early-life domain                                                                                    | §15.12                                                                                                                    |
| `data/balance.json`                                                                                           | regenerated (`pnpm generate:balance`) by each ticket that changes a value                                                 |

#### 15.8.5 The tests that change

- **Ladder and draft:** PROGRESSION.md §7 P12 (a prokaryote with photosynthetic 10: the chloroplast is no longer a
  candidate), P13 (`[nucleoid, chloroplast]` → `prokaryote`), P14 (the chloroplast clause becomes the mitochondrion's);
  the shared `stage-of`, `ladder-check`, `traits` and `wild-cells` tests; the server's `draft`, `ladder`, `wild-build`,
  `wild-settle` and giant balance tests; the client's ladder orbit specs.
- **Engulf-process tests** (about 118 files: 87 server and shared test files, 12 `src/testing` helpers and about 19
  client specs; most build plain protocell predators): they test the process, not who may swallow, so before the flip
  each states its swallow stage explicitly (a balance with `SWALLOW_FROM_STAGE` `protocell`, through one helper that
  ticket #907 adds to `packages/shared/src/testing/` for server and client tests alike), and no expected value moves.
  Four tickets do it: #910 (shared and the server simulation units), #923 (the wild, bots, session, world and debug
  units and `bot-builders.ts`), #924 (the gameplay setups and scenarios) and #925 (the client specs and the preview
  scenes). The preview scenes are production code: `render/preview/scenes/escape-scene.ts` stages protocell predators,
  so its predators take the eukaryote stage rather than a patched balance, or the bench and evidence scenes lose their
  danger ring at the flip. New engulf tests written meanwhile (the phases build included) use the helper from day
  one. The gate itself is tested by §15.13's own scenarios. Scenarios that are about the early dish's
  predation are re-read, not patched: G13 (a wild seat engulfs a player at 6:30) moves to after 9:00 (EL13), and the
  wild-cell scenarios that count early wild-on-wild engulfs are re-measured.
- **Bots and pace:** P1 (greedy bot, level 2 by 6:00) is re-measured under the switch; the bot strategy tests gain the
  mote filter's cases.

#### 15.8.6 Score, death and entry

Unchanged rules: score is `dnaCumulative − dnaCatchUpGift + SCORE_ABSORPTION_BONUS × absorptions`; death keeps the
ladder; the entry rule lifts a respawn's or a late joiner's level, never its stage past its gates, so a lifted player
who is still an archaeon latches like anyone (PROGRESSION.md §5).

#### 15.8.7 Where it meets the phases plan (phases.md §14)

Each bullet names the phases ticket it changes; the tickets carry the change.

- **The shared non-number balance leaves (tickets #907 and #867).** `debug_set_balance` and the replay's
  `debug_patch` take number leaves only today. `SWALLOW_FROM_STAGE` (a stage id) and phases' `ERAS_IN_PLAY` (a list of
  era ids) need the same widening, so it is built once, in ticket #907, which ships first (§15.10); ticket #867 depends
  on it and adds only `ERAS_IN_PLAY`'s validator (a prefix of dish, pool, colonies). Ticket #907 also widens the
  ledger's parser to find a constants table under a `####` heading, which §14.14.1 needs too.
- **The move (ticket #868; §14.4.2 step 1).** Step 1 empties every held list with no payout, no credit and no `eat`
  (the held bacteria go with the dish's motes, §15.4.2); step 6's gift comes after, so no partner is paid at the move
  even when the gift makes the cell a eukaryote (the eating step's swallow finds the list already empty).
- **The no-form gift (ticket #869; §14.4.3).** It reads `STAGE_GATE_TRAITS` and the forms' requirements at build time, so it needs no
  rule change: after the reorder the endosymbiosis gate is the mitochondrion alone, and the euglena's chloroplast is its
  form requirement. PH2 and PH16 hold unchanged. The gift makes a player a eukaryote, so its swallow popup fires at the
  move (§15.5.2: queued after the form popup, without the reveal; the popup is ticket #913's, the HUD of the move
  ticket #877's).
- **The pace (tickets #881 and #883).** Ticket #881's pace model takes in the 0.4 fragment rate (§15.7) and forms at
  level 6, not 5; more players reach 10:00 without a form, so more are gifted one, and ticket #883 measures the share.
- **Endosymbiosis after the dish (ticket #881; §14.7.2).** The waiver stands; in the dish the chloroplast's unlock is
  now a eukaryote's.
- **Wild cells in the pool (ticket #871; §14.5.4).** The per-form builds follow the new ladder (§15.6): the euglena's
  takes the mitochondrion second and the chloroplast after the envelope; `ladderProblem` refuses the old order.
- **The pool's creatures (tickets #872 and #873; §14.6).** The species half of `canEngulf` (§15.5.1) covers them: the
  Didinium and the rotifer swallow by species, as the giant hunter does, whatever stage they are built with; the
  copepod and the nematode never engulf. Ticket #867 only defines the species; #872 and #873 add them to the test.
  Every player in the pool is a eukaryote, so the stage half never bites there.
- **New engulf tests in the phases build (tickets #868, #872, #873, #885).** The grace, the creatures' engulfs and the
  bodies' bites start engulfs; their tests state their swallow stage through ticket #907's helper (or use eukaryote
  predators), so the flip in ticket #916 does not break them.
- **The pool's bots (ticket #904).** They aim at motes through the same mote filter (§15.8.3).
- **The cast (ticket #878; §14.12.3).** The archaeon is a sea-floor microbe, which fits the kelp shore; its page and
  lines are ticket #914's (§15.9), not the cast ticket's.

### 15.9 The words

Every number below comes from a constant or the live balance through `hud/format/`, never typed. Encyclopedia copy
follows ui/encyclopedia.md §11 (no number and no arithmetic in the copy files: placeholders only).

This is the switch-on game's copy, and the live game must never show it while the switch is off (it would say "only a
eukaryote engulfs" while protocells still do). So:

- **The HUD's copy (ticket #913) reads the switch.** Its popup and beats fire on the live balance's
  `SWALLOW_FROM_STAGE` (with `protocell` no cell ever climbs to it, so the ability popup never fires), and the pills
  and toasts that differ pick their switch-off line (the reorder's, §15.6) while it is off. #913 may merge any time
  before ticket #916.
- **The encyclopedia (ticket #914) is static prose and merges with the flip:** its PR lands immediately before ticket
  #916's, back to back, never earlier. The stage display name `Archaeon` is true either way and may ship with #913.

#### 15.9.1 Stage names, toasts and the opening beats

| Where                                                                                                                                                                | Today                                                                 | After                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The `prokaryote` stage's display name                                                                                                                                | `Prokaryote`                                                          | `Archaeon` (the stage id stays `prokaryote`; the HUD's wild label reads `WILD ARCHAEON`)                                                                                                                                                             |
| `stage` toast, prokaryote                                                                                                                                            | `You are a prokaryote`                                                | `You are an archaeon`                                                                                                                                                                                                                                |
| `stage` toast, endosymbiosis                                                                                                                                         | `Endosymbiosis · an organelle lives inside you`                       | `Endosymbiosis · a bacterium lives inside you`                                                                                                                                                                                                       |
| `stage` toast, eukaryote                                                                                                                                             | `You are a eukaryote`                                                 | unchanged; the ability popup follows (§15.5.2)                                                                                                                                                                                                       |
| First eat pill                                                                                                                                                       | `Swallow motes to grow`                                               | `Absorb specks to grow`                                                                                                                                                                                                                              |
| Prokaryote pill                                                                                                                                                      | `Eat 10 orange rods at the warm vent or 10 green in the shallows · …` | `Touch bacteria to hold them · {10} orange ones earn a mitochondrion` (the orbit's one counter)                                                                                                                                                      |
| new opening beat **Eukaryote**: stage becomes `eukaryote` without a chloroplast                                                                                      | —                                                                     | after the ability popup: `Swallow {10} green rods in the shallows · they become a chloroplast` (rim `ZONE_CUE`)                                                                                                                                      |
| new coach beat **Can't swallow yet**: the first time, below the swallow stage, the own cell touches a bacterium it cannot latch or a cell it out-weighs by the ratio | —                                                                     | protocell and bacterium: `You can't swallow bacteria · grow a nucleoid to hold them`; a cell: `You can't swallow cells yet · a nucleus brings the skeleton`. The mass test is the shared `meetsEngulfStartRatio` (§15.5.1), never a re-derived ratio |
| Endosymbiont unlocked toast                                                                                                                                          | `Mitochondrion unlocked · offered at your next level-up`              | unchanged                                                                                                                                                                                                                                            |

#### 15.9.2 Popups (ui/overlays.md §3.8)

The two endosymbionts become form-sized popups with the kicker `NEW PARTNER` and a real-life line (their gain is the
story's turning point); their effect lines are the card's, as every popup's are.

| Popup         | Kicker        | Title         | Real-life line (no full stop)                                        |
| ------------- | ------------- | ------------- | -------------------------------------------------------------------- |
| Mitochondrion | `NEW PARTNER` | Mitochondrion | `Real mitochondria began as bacteria an archaeon held close`         |
| Chloroplast   | `NEW PARTNER` | Chloroplast   | `Real chloroplasts began as green bacteria a complex cell swallowed` |

#### 15.9.3 The ability popup

| Part           | Text                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Kicker         | `NEW ABILITY`                                                                                     |
| Title          | `Engulf`                                                                                          |
| Effect lines   | `▲ Swallow cells under {80 %} of your mass` (1 / `ENGULF_MASS_RATIO`), `▲ Swallow bacteria whole` |
| Real-life line | `Real complex cells swallow food with an inner skeleton of protein threads`                       |

#### 15.9.4 The encyclopedia

| Entry                                            | Says (in substance; the encyclopedia ticket writes the copy)                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage:protocell`                                | You absorb food through your skin: specks, scraps and loose DNA. You cannot swallow a bacterium or a cell.                                                                                                                                                                                                                                                                                                                                                       |
| `stage:prokaryote`, titled **Archaeon**          | Your genes sit in one loose coil. You are an archaeon, the kind of cell whose line became ours. Thin arms hold any bacterium they touch; held long enough, it shares its food, and enough aerobic ones earn the mitochondrion. Real: Asgard archaea live in sea-floor mud; the one grown in a lab, _Prometheoarchaeum_, is half a micrometre across and lives tangled in long arms with partner bacteria. Caveat: a real partnership took countless generations. |
| `stage:endosymbiosis`                            | A bacterium you held now lives inside you as a mitochondrion: every complex cell alive descends from that partnership.                                                                                                                                                                                                                                                                                                                                           |
| `stage:eukaryote`                                | A nucleus of your own and an inner skeleton of protein threads that lets your skin flow round a smaller cell: from here you swallow cells and bacteria whole. The chloroplast and the forms open here. Caveat: Asgard archaea already had the first threads of this skeleton in their arms; swallowing came with the complex cell's full kit.                                                                                                                    |
| `trait:mitochondrion`                            | Unlocked by holding aerobic bacteria with an archaeon's arms until they bond.                                                                                                                                                                                                                                                                                                                                                                                    |
| `trait:chloroplast`                              | A eukaryote's trait. Unlocked by swallowing photosynthetic bacteria. Real: the first chloroplast was a green bacterium a complex cell swallowed, long after the mitochondrion; a euglena's came second-hand, from a green alga it swallowed.                                                                                                                                                                                                                     |
| `trait:cytoskeleton` (Cytoskeleton Lattice)      | Every eukaryote has an inner skeleton; the lattice is a denser one: turn and stop sharper, harder to hold.                                                                                                                                                                                                                                                                                                                                                       |
| `trait:nucleoid`                                 | Owning it makes you an archaeon, with arms.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `action:eat`, titled **Absorb**                  | Touch a speck to take it in. Every cell absorbs specks, scraps and loose DNA; only a eukaryote swallows bacteria and cells.                                                                                                                                                                                                                                                                                                                                      |
| `action:latch` (new)                             | An archaeon's arms hold any bacterium they touch, up to {maxHeld}; held for {bondSeconds} it shares its food and, if aerobic, counts toward the mitochondrion. A sprint shakes them loose.                                                                                                                                                                                                                                                                       |
| `action:engulf`                                  | Only a eukaryote engulfs: it takes the inner skeleton a nucleus brings.                                                                                                                                                                                                                                                                                                                                                                                          |
| `bacterium:aerobic` / `bacterium:photosynthetic` | Aerobic: an archaeon holds them to earn the mitochondrion. Photosynthetic: only a eukaryote can use them, by swallowing them, toward the chloroplast.                                                                                                                                                                                                                                                                                                            |
| the DNA fragment                                 | Loose DNA in the water; real bacteria and archaea take it in and sometimes use its genes.                                                                                                                                                                                                                                                                                                                                                                        |
| the ladder orbit (`hud-entries.ts`)              | A counter shows for each endosymbiont from the stage that can earn it: the mitochondrion's from the archaeon, the chloroplast's from the eukaryote.                                                                                                                                                                                                                                                                                                              |

### 15.10 The switch and the order of the build

Main deploys to the human's game on every merge, so the change ships behind one balance leaf, as the giants and the
eras did: **`SWALLOW_FROM_STAGE`** (`absorption` domain). At `protocell` (the shipping value) every cell swallows from
the start and no cell latches (a swallow outranks a latch), which is today's game exactly. The "early life on" slice
sets it to `eukaryote`.

**Reaching it in tests and on a private stack.** `debug_set_balance` (`server/src/game/debug/balance-patch.ts`) and the
`BalancePatch` the replay records as a `debug_patch` take number leaves only today, so a stage id would be refused.
Ticket #907 widens both, once, for every non-number leaf: a patch may set a leaf of a declared kind, each kind with its
validator, and anything else is refused as today. It declares the stage-id kind (`SWALLOW_FROM_STAGE`,
`LATCH_FROM_STAGE`: a member of `STAGE_ORDER`, any other value refused); phases ticket #867 declares the era-list kind
for `ERAS_IN_PLAY` on the same mechanism (phases.md §14.2.4). The replay records and replays such a patch, so a game
whose switch moved mid-way reproduces its state hash.

The order (the epic's roadmap):

1. **The ladder reorder, ticket #908, first and on its own** (the chloroplast after the nucleus, the partner card, the
   unlock toast's rule, the builds, the orbit's counter rule, and the copy of §15.6 that is true with the switch off):
   it needs no switch and changes only who is offered the chloroplast when.
2. **The contract, ticket #907**, with the switch off; phases ticket #867 builds on its non-number leaves.
3. **Behind the switch, in parallel:** the latch (#909), the four test-fixture parts (#910, #923, #924, #925), bots and
   wild cells (#911), the render (#912), the HUD (#913), the sound (#915); at `protocell` they are inert.
4. **The flip, ticket #916,** with the encyclopedia (#914) merged immediately before it: `eukaryote` and the fragment
   rate, and core.md §3, session.md §5.1 and the ecology docs move to describe the live game. Every part of the
   test-fixture work lands before it. Then gameplay QA (#917) tunes.

### 15.11 Contract (for the architect)

Folded into architecture/entity-model.md §2, server-simulation.md §3, wire-contract.md §4, constants-files-tests.md §9
and §10 and debug-mcp.md §8 by the contract ticket.

- **Constants and balance:** `SWALLOW_FROM_STAGE` in `constants/absorption.ts` (the `absorption` domain), its row added
  to ecology/constants.md §7 (the ledger already parses it). The `LATCH_*` rows in a new domain file (proposed
  `constants/early-life.ts`, balance domain `earlyLife`), registered in `CONSTANTS_TABLE_SOURCES` from this doc's
  §15.12.1 heading. The ledger finds only `## N. Constants table` sections today (`constantsTableRows`), so ticket
  #907 widens the parser to take a section by its heading at any level; phases §14.14.1 (ticket #867) reuses it.
- **Non-number balance leaves:** the patch and replay widening of §15.10, built in ticket #907.
- **The predicate:** `EngulfPredator` gains `stage`; `canEngulf` is §15.5.1's formula (the species decides for a giant
  or a creature, the stage for a player or a plain wild cell); `EngulfRatioBalance` gains `SWALLOW_FROM_STAGE`, so no
  caller's argument changes. The mass half is exported as `meetsEngulfStartRatio`. `bacteriumContactOutcome(stage,
heldCount, balance)` in `shared/simulation/` beside them.
- **State:** a player cell's held list, server-side, in the state hash: each entry the mote's own record (id, mass,
  DNA, tag, heading) plus `bearingRadians` and `caughtAtTick`.
- **Wire:** `CellView.latchedBacteria: readonly { moteId, variant, bearingRadians, caughtAtTick }[]`, every field stable
  while held, so a holder's view changes only on a latch, a bond or a shake (empty for every cell that does not latch;
  at most `LATCH_MAX_HELD`). The client derives the bond's progress from `caughtAtTick`, its render tick and the live
  `LATCH_BOND_SECONDS`. Cost, for wire-contract.md §4.1 as for `giantSpecies`: the empty `"latchedBacteria":[]` is
  about 20 B on each of about 35 cells, about 0.7 KB a snapshot, and an entry about 60 B more. Effects (keyed by the
  mote id, so the renderer knows which rod): `bacterium_latched { cellId, moteId, variant }`; on the bond the ordinary
  `eat` (its `eatenId` the mote id) and `bacterium_bonded { cellId, moteId, isCredited }`; `latch_shaken { cellId,
moteIds }`. No new input.
- **Prediction:** the latch is **not predicted**. The client predicts the own sprint's start
  (`net/own-cell-prediction.ts`), so the shake-loose reaches it one round trip later; the renderer may hide the own
  cell's rods on the predicted sprint start.
- **Debug MCP:** `debug_get_entities` shows a cell's held list; `debug_set_player` can already set the traits that set
  a stage; `debug_spawn(bacterium)` already exists; `debug_set_balance` takes the stage leaves (§15.10).
- **Determinism:** no new random stream; the latch runs in the eating step and keeps its order; a release re-inserts
  the kept record and draws nothing from `moteMotion`.
- **Test helper:** one helper in `packages/shared/src/testing/` that gives a balance `SWALLOW_FROM_STAGE` `protocell`,
  for server and client tests, so the test-fixture parts and the phases build use it from day one.
- **Names:** `latch*` for every identifier of the mechanic, never `arm*` (§15.4.3).

### 15.12 Constants

#### 15.12.1 Early-life constants table (registered by the contract ticket)

| Constant             | Default         | Unit                   | File            | Status  | Rule (section) |
| -------------------- | --------------- | ---------------------- | --------------- | ------- | -------------- |
| `LATCH_FROM_STAGE`   | `'prokaryote'`  | stage id               | `early-life.ts` | decided | §15.4.1        |
| `LATCH_REACH_RADII`  | 0.25            | own radii past the rim | `early-life.ts` | tuning  | §15.4.1        |
| `LATCH_MAX_HELD`     | 5 (one cluster) | bacteria               | `early-life.ts` | tuning  | §15.4.1        |
| `LATCH_BOND_SECONDS` | 6               | s                      | `early-life.ts` | tuning  | §15.4.1        |

#### 15.12.2 Rows in existing tables (their own docs' tables keep the rows)

| Constant                             | Today                                           | After                                                                                 | Its row                                       | When                |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------- |
| `STAGE_GATE_TRAITS`                  | endosymbiosis: `mitochondrion` or `chloroplast` | endosymbiosis: `mitochondrion`                                                        | constants-and-acceptance.md §12               | the ladder reorder  |
| `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` | 0.3                                             | 0.4 (tuning)                                                                          | ecology/constants.md §7                       | the "on" slice      |
| `SWALLOW_FROM_STAGE` (new row)       | —                                               | `'protocell'`, then `'eukaryote'` (decided; stage id, `absorption.ts`, §15.5, §15.10) | ecology/constants.md §7, added by ticket #907 | #907, then the flip |

The catalog row, `WILD_CELL_BUILDS` and `GIANT_BUILDS_BY_SPECIES` change as §15.6 says.

#### 15.12.3 Client constants (not ledger rows)

| Constant                         | Default | Unit | File                                                          | Status | Rule (section) |
| -------------------------------- | ------- | ---- | ------------------------------------------------------------- | ------ | -------------- |
| `SWALLOW_UNLOCK_LATTICE_SECONDS` | 0.6     | s    | `packages/client/src/app/game/render/constants/early-life.ts` | tuning | §15.5.2 step 3 |
| `SWALLOW_UNLOCK_PING_SECONDS`    | 1.2     | s    | `packages/client/src/app/game/render/constants/early-life.ts` | tuning | §15.5.2 step 4 |

The arms' and the held rods' look (count, length, the bond tint) are the render ticket's constants
(rendering docs).

### 15.13 Acceptance scenarios

Format and fixture conventions as [`constants-and-acceptance.md §13`](./constants-and-acceptance.md#13-acceptance-scenarios).
Unless stated: seed 42, balance with `SWALLOW_FROM_STAGE` `eukaryote` (the switch on), ticks at 60 Hz. "An archaeon"
owns `nucleoid` I; "a eukaryote" owns `nucleoid` I, `mitochondrion` I and `nuclear_envelope` I.

| #    | Given                                                                                                                                                                                                          | Inputs                                                 | After               | Assert                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EL1  | two protocell players, mass 100 and 20, the smaller placed at the larger's centre                                                                                                                              | idle                                                   | 120 ticks           | no engulf ever starts (both `free` every tick); separation pushes them apart; paired case with the switch off (`protocell`): the 100 engulfs the 20 as E9                                                                                                                                                                                                                                                                                                      |
| EL2  | a protocell at mass 20; one algae mote and one plain bacterium placed at its centre                                                                                                                            | idle                                                   | 1 tick              | the algae mote is gone (mass + 1 less decay); the bacterium is still a mote (± its drift); `dnaCumulative` 0, every counter 0                                                                                                                                                                                                                                                                                                                                  |
| EL3  | an archaeon at mass 100; one aerobic bacterium placed with its centre 1.1 own radii from the cell's centre                                                                                                     | idle                                                   | 1 tick              | the mote is gone from the world; the cell's `latchedBacteria` holds one aerobic entry with that mote's id and `caughtAtTick` = this tick; one `bacterium_latched` effect; mass and DNA unchanged (less decay)                                                                                                                                                                                                                                                  |
| EL4  | EL3                                                                                                                                                                                                            | idle                                                   | latch + 360 ticks   | still held on tick latch + 359; on latch + 360: the held list is empty, one `eat` effect whose `eatenId` is the mote's id and whose `massGained` is 3, and one `bacterium_bonded` with that `moteId` and `isCredited` true; `bacteriaEatenByVariant.aerobic` = 1, `dnaCumulative` = 1.05 (Nucleoid I), mass + 3 less decay, `metabolic` + 1; the mass-flow invariant (Δmass = Σ rates + Σ `eat.massGained`) holds on every tick                                |
| EL5  | an archaeon; 7 aerobic bacteria placed 1.1 own radii out on one tick                                                                                                                                           | idle                                                   | 1 tick              | the 5 lowest mote ids are held; the other 2 are still motes                                                                                                                                                                                                                                                                                                                                                                                                    |
| EL6  | EL5 two seconds on                                                                                                                                                                                             | sprint on tick t                                       | t + 30              | on tick t (step 1, where the sprint is set) the 5 held go back as free aerobic bacteria (fresh ids, their own headings) at their rim points, one `latch_shaken` with the 5 mote ids, no counter change. The latch reads `sprintRemainingTicks` > 0 at the eating step, after movement has counted it down, so with `sprintDurationTicks` = 30 a bacterium kept in reach latches on no tick from t to t + 28 and is latched on t + 29, the first tick it can be |
| EL7  | an archaeon holding one photosynthetic bacterium                                                                                                                                                               | idle                                                   | to the bond         | mass + 3 and DNA + 1.05 and `photic` + 1, `bacteriaEatenByVariant.photosynthetic` still 0, `isCredited` false                                                                                                                                                                                                                                                                                                                                                  |
| EL8  | an archaeon at level 2 with `bacteriaEatenByVariant.aerobic` 9 holding one aerobic bacterium; the fixture grants the DNA to level 3 on the tick after the bond                                                 | idle                                                   | grant + 1           | counter 10 after the bond; the offer shown holds `mitochondrion` (the rung card)                                                                                                                                                                                                                                                                                                                                                                               |
| EL9  | pure `listDraftCandidates`: (a) an archaeon with photosynthetic 10, aerobic 10; (b) a eukaryote with photosynthetic 10; (c) the same with photosynthetic 9                                                     | —                                                      | —                   | (a) `mitochondrion` and `ribosomes` are candidates, `chloroplast` is not (stage); (b) `chloroplast` is; (c) it is not                                                                                                                                                                                                                                                                                                                                          |
| EL10 | pure `stageOf`                                                                                                                                                                                                 | —                                                      | —                   | `[nucleoid, chloroplast]` → `prokaryote`; `[nucleoid, mitochondrion]` → `endosymbiosis`; + `nuclear_envelope` → `eukaryote`; + `chloroplast`, `euglena_eyespot` → `specialised`                                                                                                                                                                                                                                                                                |
| EL11 | an archaeon with `mitochondrion` I at mass 200 and a protocell player at mass 20 at its centre                                                                                                                 | idle; the fixture grants `nuclear_envelope` on tick 60 | 62 ticks            | no engulf before tick 60; the engulf of the 20 starts on the first contact tick after the grant (60 or 61)                                                                                                                                                                                                                                                                                                                                                     |
| EL12 | an archaeon with `mitochondrion` I holding 3 plain bacteria for 2 s; an offer showing `nuclear_envelope`                                                                                                       | picks it on tick t                                     | t + 1               | on tick t (the pick at step 1, the swallow at the start of step 4) the held list is empty and the three are eaten as swallowed: three `eat` effects, mass + 9 less decay, DNA + 3.15, `motile` + 3; then (EL11) it can engulf                                                                                                                                                                                                                                  |
| EL13 | G13's pattern (a wild seat at size 2.0 on an idle player at mass 20) placed at 6:30, and again at 9:30                                                                                                         | idle                                                   | 60 ticks after each | at 6:30 no engulf starts (world stage `endosymbiosis`); at 9:30 (world `eukaryote`) the engulf starts and pays out                                                                                                                                                                                                                                                                                                                                             |
| EL14 | G4 (the giant amoeba and a small cell touching it), the switch on                                                                                                                                              | idle                                                   | as G4               | as G4: the giant amoeba swallows it                                                                                                                                                                                                                                                                                                                                                                                                                            |
| EL15 | the switch off (`SWALLOW_FROM_STAGE` `protocell`): an archaeon touching an aerobic bacterium                                                                                                                   | idle                                                   | 1 tick              | it eats it at once as today (counter + 1 on that tick); `latchedBacteria` stays empty; no `bacterium_latched` effect                                                                                                                                                                                                                                                                                                                                           |
| EL16 | pure `ladderProblem` over `WILD_CELL_BUILDS` and `GIANT_BUILDS_BY_SPECIES`                                                                                                                                     | —                                                      | —                   | every build is valid; today's build 1 (`chloroplast` second) gives `chloroplast needs stage eukaryote before it`                                                                                                                                                                                                                                                                                                                                               |
| EL17 | an archaeon holding 2 bacteria is engulfed by the giant amoeba                                                                                                                                                 | idle                                                   | the absorb tick     | on its removal tick 2 free bacteria appear at its rim points, then its detritus; no counter change                                                                                                                                                                                                                                                                                                                                                             |
| EL18 | client: a seat's snapshots show its stage go `endosymbiosis` → `eukaryote` on one pick                                                                                                                         | —                                                      | —                   | one `ability-popup` (`data-ability="engulf"`) queued after Nuclear Envelope I's upgrade popup; none for a first snapshot that is already `eukaryote` (late join, reconnect)                                                                                                                                                                                                                                                                                    |
| EL19 | bots: a `grazer` protocell with one bacterium and one algae mote in view, the bacterium nearer                                                                                                                 | one decision                                           | —                   | it aims at the algae mote; as an archaeon with a full held list, the same; as an archaeon with room, at the bacterium                                                                                                                                                                                                                                                                                                                                          |
| EL20 | gameplay QA, measured (not pinned): one active player and a greedy bot, seeds 1–10, switch on                                                                                                                  | —                                                      | 10:00               | the pace model's nucleoid ~2:50, mitochondrion ~5:40, nucleus ~8:00 (± 20 s, PROGRESSION.md §2); P1's bound holds (level 2 by 6:00); the giant amoeba's kill rate before 8:00 reported                                                                                                                                                                                                                                                                         |
| EL21 | pure `buildDraft`, seeds 1..100: (a) a eukaryote owning `cytoskeleton` with photosynthetic 10; (b) an archaeon with aerobic 10 and photosynthetic 10, the switch off; (c) the same as (a) owning `chloroplast` | —                                                      | —                   | (a) `chloroplast` and one form gate (`amoeba_pseudopods`) in every draft, the third card free; (b) `mitochondrion` in every draft (rung card), `chloroplast` in none (stage); (c) no card reserved for a partner. The unlock toast fires for (a) on the tick the cell became a candidate, and for (b)'s chloroplast only on the tick (b) becomes a eukaryote                                                                                                   |
| EL22 | the switch on; one archaeon latches 3 bacteria, bonds 2, sprints and sheds 1 over 1 200 ticks; a `debug_set_balance` moves the switch to `protocell` and back mid-way                                          | —                                                      | 1 200 ticks         | `debug_export_replay` re-run gives the same final state hash (`evolution-module.determinism.integration.test.ts`); the hash differs if a held entry's `caughtAtTick` is changed (it covers the held list)                                                                                                                                                                                                                                                      |
| EL23 | the switch on; an archaeon holding 2 bacteria; `debug_set_balance` sets `SWALLOW_FROM_STAGE` to `prokaryote` on tick t                                                                                         | —                                                      | t + 1               | on tick t the held list is swallowed (two `eat`), it never holds a bacterium again, and it can now engulf; a `debug_set_balance` with `SWALLOW_FROM_STAGE` `'amoeba'` is refused                                                                                                                                                                                                                                                                               |

### 15.14 Questions put to the human

The design above is written to the recommendation; the lead files these as decision tickets.

1. **How dangerous are the first eight minutes?** With no swallowing before the nucleus, the giant amoeba is the only
   predator until ~8:00. **A** keep it calm: the danger arrives with the nucleus, and the dish becomes a food web in its
   last two minutes (recommended: true to life, and the unlock reads as the turning point). **B** add a few small wild
   hunters from the start (real heterotrophic flagellates, small eukaryotes that eat archaea and bacteria): more danger,
   a new wild kind to build.
2. **What are the green specks?** **A** keep "algae" and its art; the encyclopedia says what absorbing really takes in
   (recommended: cheap, and the art reads). **B** make them kelp sugar, specks of the slime and sugar the kelp blade
   leaks into its pocket (truer: a whole alga is a cell and cannot be absorbed): renames the food on screen and in the
   encyclopedia, new art.

### 15.15 Sources

- Eme L, Tamarit D, Caceres EF, et al. (2023). Inference and reconstruction of the heimdallarchaeial ancestry of
  eukaryotes. _Nature_ 618:992–999.
- Imachi H, Nobu MK, Nakahara N, et al. (2020). Isolation of an archaeon at the prokaryote–eukaryote interface.
  _Nature_ 577:519–525.
- Rodrigues-Oliveira T, Wollweber F, Ponce-Toledo RI, et al. (2023). Actin cytoskeleton and complex cell architecture
  in an Asgard archaeon. _Nature_ 613:332–339.
- Martin W, Müller M (1998). The hydrogen hypothesis for the first eukaryote. _Nature_ 392:37–41.
- Keeling PJ (2010). The endosymbiotic origin, diversification and fate of plastids. _Philosophical Transactions of
  the Royal Society B_ 365:729–748 (the chloroplast's primary origin, and the euglenids' second-hand one).
- Phagocytosis needs an actin skeleton and motor proteins, and no archaeon is known to do it: the encyclopedia ticket
  cites one review page for the "inner skeleton" line before it ships.
- Natural transformation (free DNA uptake by bacteria and archaea): the encyclopedia ticket cites one review page.
