# Evolution — Game Design: the early game true to life

§15 of the split [`GAME-DESIGN.md`](../GAME-DESIGN.md), which keeps the shared context and the file list.

## 15. The early game true to life (ticket #865)

Epic #761; decision ticket #791 (answer **A**); the build is epic #906 (its roadmap comment gives the order). Decision
ticket #919 then moved swallowing off the stage and onto the inner skeleton, a trait you earn (ticket #947, §15.5).
This section is the decided design: what the build makes. Numbers
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

Decision ticket #919 (preffect, 2026-10-14) replaced the fourth point: **swallowing unlocks on its requirement, not on
time.** A cell swallows once it owns its inner skeleton, the **Cytoskeleton Lattice** (`trait:cytoskeleton`), whenever
it earns it; no stage, clock or world level decides. That holds for players, wild cells and bots alike (§15.5).

Why it is true. The cell line that became complex cells was an Asgard archaeon (Eme et al. 2023). Bacteria and
archaea take in dissolved food through their skin; swallowing a whole cell needs an inner skeleton of protein threads
and motor proteins, which complex cells (eukaryotes) have (Rodrigues-Oliveira et al. 2023 found the first threads of
it, actin, already in an Asgard archaeon's arms, but no archaeon is known to swallow, and their genes suggest they
cannot: Burns et al. 2018). The one Asgard archaeon grown in
a lab, _Prometheoarchaeum_, is about half a micrometre across, lives tangled in long branching arms with partner
bacteria it trades food with, and suggested the "entangle, engulf, endogenize" story: the partner was held, then
wrapped, then kept, never swallowed in one gulp (Imachi et al. 2020). The chloroplast came much later, when a complex
cell swallowed a green bacterium (a cyanobacterium).

How this reads the answer's open points (design calls, not new questions):

- **The arms come with the stage, not with a pick.** Every archaeon has them (`LATCH_FROM_STAGE`), as every
  _Prometheoarchaeum_ does. A pick would add a rung and slow the climb.
- **Swallowing comes with a pick: the Cytoskeleton Lattice** (since decision ticket #919; it first came with the
  eukaryote stage). The Lattice moves down the ladder to the archaeon, so it can be earned before the nucleus, and the
  swallow switch names it (`SWALLOW_GATE_TRAITS`, §15.5, §15.10). Where it sits, and so when a player can first
  swallow, is §15.5.3 and question 1 of §15.14.
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
 eukaryote      Eukaryote       nuclear_envelope      absorbs specks; latches         the chloroplast (§15.6); the forms
     |  pick a form (after its own requirement)
 specialised    (the form)      a form                as a eukaryote                  —

 off the rungs, from the archaeon on:
                pick the Cytoskeleton Lattice  ->  SWALLOWS (§15.5): the arms go, bacteria and cells are swallowed whole
```

The Lattice is not a rung: it changes no stage, and a cell takes it whenever it is offered (§15.5.3, §15.5.4). What a player cell
can do depends on its stage and on whether it owns the Lattice (with the switch on, §15.10):

| The cell                                              | Absorbs specks (algae, detritus, DNA fragments) | A bacterium it touches                                  | Swallows a cell | Endosymbiont credit                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| a `protocell`                                         | yes                                             | passes under it: nothing happens                        | no              | none                                                                                                  |
| from `prokaryote` on, **without** the Lattice         | yes                                             | **latched** by the arms, up to `LATCH_MAX_HELD` (§15.4) | no              | a bacterium held to the bond: +1 of its variant once the cell has reached its endosymbiont's stage    |
| from `prokaryote` on, **with** the Lattice (any tier) | yes                                             | **swallowed** whole on touch, as today's eating rule    | **yes** (§15.5) | any bacterium swallowed: +1 of its variant once the cell has reached its endosymbiont's stage (today) |

Anyone heavy enough who owns the Lattice, and the giant amoeba, can swallow any of them. Wild cells and giants keep their
own diets (`simulation/cell-diet.ts`, unchanged): a wild cell eats algae and detritus only, the giant grazer bacteria
too, the hunter and the drifter no mote. Who among them may swallow a cell is §15.5.1: a wild cell by its build (does it
own the Lattice yet), a giant by its species.

### 15.3 Absorbing

Every player cell **absorbs** the specks it touches: algae, detritus and DNA fragments, by today's eating rule (a mote is
taken the tick its centre lies within the cell's radius; ecology/food-and-spawn.md §1). Nothing about the payout
changes. What changes is the look and the words: a speck **dissolves into the membrane** (it shrinks and fades into
the rim over about a fifth of a second with a faint ripple, render ticket) instead of the gulp, at every stage; the
gulp stays for what is swallowed (a bacterium or a cell, by a cell with the Lattice only). DNA fragments are loose DNA in the water:
real bacteria and archaea really do take it in through their skin (natural transformation), so the fragment is the
truest food in the dish.

**Bacteria are not specks.** A bacterium is a cell: a protocell passes over it, an archaeon latches it (§15.4), a
cell with the Lattice swallows it (§15.5). Wild cells leave bacteria alone, as today (ecology/wild-cells.md §3.3.3), so they never
latch.

### 15.4 The latch: the archaeon's arms

#### 15.4.1 Rules

- **Who latches.** A cell whose stage has reached `LATCH_FROM_STAGE` (`prokaryote`) and that cannot swallow yet
  (`canSwallowByTraits` false, §15.5.1: the switch names the Lattice and the cell does not own it): from the archaeon
  on, until it takes the Lattice, so a eukaryote that took the nucleus first still latches. Players only; wild cells and giants never latch.
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
  ladder of §15.6 that is: aerobic from the archaeon on (the Mitochondrion is a `prokaryote` trait), photosynthetic
  only once the cell is a eukaryote (the Chloroplast is a `eukaryote` trait: a cell that took the nucleus before the
  Lattice holds green bacteria to the bond for it), plain has no endosymbiont. The rule reads the catalog; no list of
  variants is written anywhere.
- **The unlock is unchanged.** `ENDOSYMBIOSIS_BACTERIA_REQUIRED` (10) aerobic bacteria taken in make the Mitochondrion
  a candidate, and the rung card offers it at the next level-up (PROGRESSION.md §3; the partner card of §15.6 says the
  same of any earned endosymbiont). Two clusters of five held to the
  bond is the vent trip, as two clusters eaten is today.
- **A bond is a real partnership, made quick.** In life the partners traded food for countless generations before
  one ended up inside; the game compresses it to six seconds of holding and a count of ten.

The counter keeps its wire name `bacteriaEatenByVariant` (the contract ticket #907 decided: a rename would churn the
wire, the orbit and the draft for no change in play); its meaning is "taken in: held to the bond or swallowed".

#### 15.4.2 Losing held bacteria

| When                                                                       | What happens to every held bacterium                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the cell **starts a sprint** (step 1, where the sprint is set)             | shaken loose: its kept record goes back into the world as a free bacterium at its rim point with a fresh entity id and its own heading (nothing new is drawn from the `moteMotion` stream), no payout, no credit; one `latch_shaken` naming the mote ids. No latching while the sprint runs, so it cannot catch it back                                                                                                                                                                                                                                                                                                                                                   |
| the cell is **removed** (absorbed, dissolved, disconnected)                | dropped free at its rim point, as above, before the cell's detritus                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| the cell **can swallow** (`canSwallowByTraits`, §15.5.1)                   | **swallowed**: at the start of every eating step, any cell for which `canSwallowByTraits` holds eats its whole held list through `eatFoodMote` (one `eat` each, its counter credited by today's rule). A per-tick invariant, not an event: one home covers a pick (applied at step 1, so the swallow lands on the same tick), the gift at the move (a gifted amoeba brings the Lattice), `debug_set_player`, and a `debug_set_balance` that moves the switch while archaea hold bacteria (emptying the list makes every cell able to swallow, so they swallow what they hold: EL23). No cell that can swallow ever holds a bacterium. Your first swallow is your partners |
| the move to the rock pool at 10:00 (phases.md §14.4.2 step 1, ticket #868) | gone with the dish's motes: no payout, no credit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| a rematch                                                                  | gone (every cell is new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

So a held cluster is something to protect: the giant amoeba bearing down on you at the vent asks you to choose
between your partners and a sprint.

#### 15.4.3 How it looks and sounds

- **The arms.** From the prokaryote stage on, the cell grows thin branching arms that reach `LATCH_REACH_RADII` past
  the rim, exactly as far as they catch, so what you see is what latches; drawn in the seat colour's rim tone (the
  _Prometheoarchaeum_ look). They are hair-thin and many, never the amoeba's blunt lobes, so the two
  never read alike. They go when the cell takes the Lattice (its skin now flows instead), at whatever stage.
- **A held bacterium** sits on the rim with an arm wrapped round it; its rod brightens from its own colour toward the
  seat colour as its bond progresses (the client derives the progress from `caughtAtTick`, its render tick and the live
  `LATCH_BOND_SECONDS`, §15.11). On the bond it slides into the membrane with a soft pulse, and an
  aerobic one lights the next pip of the Mitochondrion's counter on the ladder orbit (ui/hud.md §3.1.2).
- **Sound** (the audio ticket, docs/AUDIO.md §2): a small wet catch on the latch, a soft chord on the bond, a dry
  scatter when a sprint shakes them loose.
- **Names in code.** "Arm" already names the amoeba's pseudopod grab (#735: `isArmHold`, `armRegrabRefractories`,
  `engulf-arm-grab.ts`). Every new identifier of this mechanic says `latch` (`latchedBacteria`, `LATCH_*`,
  `latch_shaken`), never `arm`; "arms" is the players' word only.

### 15.5 Swallowing unlocks with the inner skeleton

Decision ticket #919: swallowing unlocks on its requirement, the inner skeleton, not on a stage or the clock (ticket
#947 wrote it in). The inner skeleton is the **Cytoskeleton Lattice** (`cytoskeleton`), the trait that already draws
threads from the nucleus to the membrane and that Amoeba Pseudopods already requires. Whether it stays the Lattice or
becomes a new base trait with the Lattice as its upgrade is question 2 of §15.14 (decision ticket #952). Every rule
below names the gate through the switch's list (`SWALLOW_GATE_TRAITS`), never the trait id, so the rules keep their
shape either way; the ladder does not. Answer B (a new Actin Skeleton that the Lattice `requires`) also changes:

- **build 0** (`cytoskeleton` is its fourth pick with no Actin Skeleton before it, so `ladderProblem` refuses it): it
  gains the Actin Skeleton as a pick, and since the world's stage clock reads build 0 (ecology/food-and-spawn.md §3.1,
  `world-clock.ts`), the world reaches `specialised` at **18:00 instead of 15:00** (unless the world clock gets its own
  pick list, ticket #957);
- **`GIANT_BUILDS_BY_SPECIES.giant_amoeba`**, which owns the Lattice, gains the Actin Skeleton (its derived level + 1);
- **`amoeba_pseudopods`** keeps `requires: ['cytoskeleton']`, so the amoeba becomes a six-pick form (level 7) and the
  no-form gift's requirement chain for it grows by one (phases ticket #869);
- a catalog row, its art and its encyclopedia page, and `SWALLOW_GATE_TRAITS` at the flip names the new trait.

#### 15.5.1 The rule

- **Two checks, one home** (`shared/simulation/`, beside `canEngulf`). The switch is read two ways, and each rule
  reads exactly one:

  ```
  canSwallowByTraits(traits)   = SWALLOW_GATE_TRAITS is empty                    (the switch off: every cell can swallow)
                                 ∨ traits owns any id of SWALLOW_GATE_TRAITS, at any tier
  ownsSwallowGateTrait(traits) = SWALLOW_GATE_TRAITS is not empty
                                 ∧ traits owns any id of SWALLOW_GATE_TRAITS, at any tier
  ```

  | Check                  | Read by                                                                                                                                                                                                                                  |
  | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `canSwallowByTraits`   | `canEngulf`; `bacteriumContactOutcome` (and so who latches, §15.4.1); the held-list swallow (§15.4.2); the renderer's arms (drawn while the cell has reached `LATCH_FROM_STAGE` and it is false); the "Can't swallow yet" beat (§15.9.1) |
  | `ownsSwallowGateTrait` | the unlock moment and its ability popup (§15.5.2: the tick it first turns true); the reserved card (§15.5.4: offered while it is false and the list is not empty); the Lattice card's extra effect line (§15.9.1)                        |

  With the list empty the first is true for every cell and the second false for every cell: everyone swallows, and
  no unlock moment, popup or reserved card ever appears. The "own any listed trait" reading is `STAGE_GATE_TRAITS`'s.

- **Cells.** `canEngulf` (the one shared predicate, ecology/absorption.md §6.1) has a predator test. A cell with a
  species is decided by its species (a giant, and from the phases build a pool creature); every other cell, a player or
  a plain wild cell, by its traits:

  ```
  canEngulf(predator, prey) = eatsCells(predator)
                              ∧ (hasSpecies(predator) ∨ canSwallowByTraits(predator.traits))
                              ∧ meetsEngulfStartRatio(predator, prey)

  hasSpecies(cell) = cell.giantSpecies ≠ null ∨ cell.poolCreature ≠ null
  eatsCells(cell)  = a giant: its role is the hunter (GIANT_ROLE_BY_SPECIES)
                     a pool creature cell: the Didinium or the rotifer; never the nematode
                     any other cell: true
  ```

  `eatsCells` is today's `isCellEaterSpecies` widened to the creature species (`CellView.poolCreature.species`, ticket
  #935; the copepod has no cell and eats by its own sweep). **The nematode must be in it as a non-eater**, like the
  grazer and the drifter: it is a cell whose `giantSpecies` is null, so without it the nematode would read as a plain
  cell and, with the switch empty, pass `canEngulf`. So a creature built with no ladder still swallows or never does by
  its species, and the giant amoeba swallows because it is a hunter, not because of its build.
  `SWALLOW_GATE_TRAITS` lives in the **`absorption` balance domain**, beside the ratios, in place of ticket #907's
  `SWALLOW_FROM_STAGE` (§15.10), so `EngulfRatioBalance` keeps one switch leaf. The predicate reads `traits` where it
  read `stage`: almost every caller passes a `CellView` or a record with its owned traits. The exception is the bots:
  their `BotCellView` (`bots/perception.ts`) has `stage` and no `traits`, so ticket #948 adds `traits` to it (and to
  `testing/bot-builders.ts`), keeping `stage` for `bacteriumContactOutcome`; it also rewrites the `debug_set_balance`
  tool description's example (`mcp/handlers/balance.ts`), which names `SWALLOW_FROM_STAGE`. The mass half stays
  exported as `meetsEngulfStartRatio`, which the HUD's "can't swallow yet" beat reads (§15.9.1). With the switch on no
  cell without the Lattice, player or wild, ever starts an engulf, whatever its stage. Every caller (the server's
  contact and engulf steps, the wild cells' flee, hunt, hunt sprint and closer-rival rules, the bots, the HUD's danger
  chip and relations, the renderer's warning ring, the client's own-cell danger) reads it, so none can disagree. The
  giant amoeba keeps swallowing; the grazer and the drifter still never do. `canContinueEngulf` is unchanged (an engulf
  can only have started under `canEngulf`). The prey side is unchanged: anything may be swallowed.

- **Bacteria.** A cell that owns the gate eats a bacterium by today's eating rule (whole, on touch) and credits its
  counter as today; without it, a bacterium is latched or passed over (§15.4). One shared pure function answers what a
  touch does, `bacteriumContactOutcome(cell, heldCount, balance)` → `'swallow' | 'latch' | 'pass'` (`cell`: its stage
  and its traits): `swallow` when `canSwallowByTraits`, else `latch` from `LATCH_FROM_STAGE` while the cell holds fewer
  than `LATCH_MAX_HELD`, else `pass`. Read by the server's eating step and the bots' mote filter (§15.8.3).
- **Wild cells.** A wild cell owns the first (level − 1) picks of its build (ecology/wild-cells.md §3.3.2), so it
  swallows from the world level at which its build reaches the Lattice, by the same `canEngulf`. §15.8.1 gives the
  builds and the times. `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE` (`endosymbiosis`, 6:00) stays and is checked as well: with
  the builds of §15.8.1 no wild cell owns the Lattice before 6:00, so it never bites before the gate does.
- **Bots** are players: they swallow when their cell owns the Lattice, which they take as anyone takes a card (§15.8.3).

#### 15.5.2 The teaching moment on screen

It plays on the tick `ownsSwallowGateTrait` first turns true for the own cell (in play: the Cytoskeleton Lattice's
pick; at 10:00: the no-form gift, when the gifted form is the amoeba, whose requirement is the Lattice, phases.md
§14.4.3), in this order, while you keep steering:

1. **The pick's own popup**: Cytoskeleton Lattice I, as today (ui/overlays.md §3.8).
2. **Your partners go inside.** Any held bacteria slide into the cell, one gulp pulse each (§15.4.2): your first
   swallow.
3. **The skeleton shows.** A lattice of fine threads spreads from the cell's centre (the nucleus, if it has one) to the
   membrane over `SWALLOW_UNLOCK_LATTICE_SECONDS` and fades; the arms draw in and are gone; the membrane's wobble
   becomes the flowing edge of a cell that can wrap round its food.
4. **The reveal.** A ring goes out from your cell to the edge of the view over `SWALLOW_UNLOCK_PING_SECONDS`; as it
   passes each cell you can now swallow, that cell's green `EDIBLE` ring (ui/hud.md §3.1.5, which from this tick
   shows anyway, because it reads `canEngulf`) lights with a pop. The world you could only bump into is suddenly food.
5. **The ability popup**, form-sized (ui/overlays.md §3.8's form popup, a new `ability` kind, test id
   `ability-popup`, `data-ability="engulf"`), queued after the Lattice's: the text is §15.9.3.
6. **The prey coach beat** (ui/input-and-onboarding.md §5, unchanged) fires the first time an edible cell is near:
   `Green ring: you can engulf it · swim over it`.

At the move (a gifted amoeba), steps 2 to 4 are skipped while the move's camera eases (phases.md §14.4.4: the
caption and the scale bar own that moment), and the popup queues after the gifted form's. A late joiner or a reconnect
whose first snapshot already owns the Lattice sees nothing (the popups' first-snapshot rule).

#### 15.5.3 Where the skeleton sits on the ladder, and the pace

**The Lattice becomes an archaeon's trait** (recommended; question 1 of §15.14 gives the human the choice): its
catalog row's `stage` goes from `eukaryote` to `prokaryote`, with `requires` still empty, its tiers, rarity, tags and
place in the catalog unchanged. It changes no stage (it is no rung's gate). So from the archaeon on a cell can take it at
any level-up, before or after the mitochondrion and the nucleus.

| Path (one active player, the pace model, PROGRESSION.md §2) | Level 2 (~2:50) | Level 3 (~5:40)               | Level 4 (~8:00)                  | Level 5 (~9:40)  | First swallow |
| ----------------------------------------------------------- | --------------- | ----------------------------- | -------------------------------- | ---------------- | ------------- |
| **Hunter first**                                            | Nucleoid        | **Lattice**                   | Mitochondrion (the rung card)    | Nuclear Envelope | **~5:40**     |
| **Partner first, then the skeleton**                        | Nucleoid        | Mitochondrion (the rung card) | **Lattice**                      | Nuclear Envelope | ~8:00         |
| **Partner and nucleus first**                               | Nucleoid        | Mitochondrion                 | Nuclear Envelope (the rung card) | **Lattice**      | ~9:40         |

- **The pace.** A player who wants to hunt can swallow from **~5:40**, so the dish's food web runs about **4:20 of its
  10 minutes (43 %)**; the paramecium-line wild cells join at 6:00 (§15.8.1). No number changes for it: the levels keep
  the #138 slow-dawn pace. The cost is real: the Lattice takes a level-up, so a hunter reaches the nucleus one level
  later (9:40 instead of 8:00) and a form one level later (level 7). That is the choice the human asked for: hunt
  early, or climb first.
- **Why it is true.** Swallowing a whole cell (phagocytosis) needs an actin skeleton that pushes the skin out round
  the food, motor proteins and a lot of energy (Uribe-Querol & Rosales 2020). Asgard archaea already have actin threads
  in their arms (Rodrigues-Oliveira et al. 2023), so an archaeon building them into a skeleton is the real starting
  point. Which came first in our ancestors, swallowing or the mitochondrion partner, is still argued: the
  "phagocytosing archaeon" idea has an archaeon swallow first and catch its mitochondrion that way (Martijn & Ettema
  2013), and a dating of the genes that suggests the mitochondrion arrived late, in a host that was already complex,
  supports that side (Pittis & Gabaldón 2016); the energy argument and the gene evidence on Asgard archaea lean toward
  the partner first and swallowing after it (Lane & Martin 2010; Burns et al. 2018; Mills 2020). The game lets you play
  either story, and the encyclopedia says that much of the evidence leans toward the partner first (§15.9.4).
- **The hunter-first archaeon** loses its arms on the pick (its held bacteria are swallowed, §15.4.2) and earns the
  mitochondrion by **swallowing** ten aerobic bacteria, which credit the counter as any swallow does (the phagocytosing
  archaeon's story). The partner-first archaeon earns it by holding them, as before.
- **The other placements** (question 1, decision ticket #951), and what each rewrites:
  - **A, after the mitochondrion** (`stage: 'endosymbiosis'`; first swallow ~8:00, about 2 minutes of food web): this
    section's table and §15.7; build 1 becomes `nucleoid`, `mitochondrion`, `cytoskeleton`, `nuclear_envelope`, … so
    its Lattice comes at level 4 (9:00), and §15.8.1, EL13 and G13 move their 6:30 engulf to 9:30; EL21 (d) and (e)
    (an archaeon is offered no Lattice: (d) becomes the Mitochondrion's rung card and two free cards, (e) three free
    cards), EL25 (an archaeon with the Lattice is no longer a valid build: it moves to an endosymbiosis cell) and EL26
    (build 1 at level 4); the hunter-first path that earns the mitochondrion by swallowing goes, and with it the
    §15.9.4 lines on the Archaeon, Mitochondrion, aerobic bacterium and Engulf pages and the "either story" line;
    §15.9.1's beats and the times in the copy (5:40 becomes 8:00).
  - **C, after the mitochondrion with a faster climb** (lower level costs, so level 4 comes at about 6:00): everything
    A rewrites, plus the level costs (PROGRESSION.md §2 and its constants), the pace model's targets (core.md §3,
    PROGRESSION.md §2, EL20, P1), the world clock's calibration (ecology/food-and-spawn.md §3.1) and the phases pace
    model (ticket #881); it reopens decision #138's slow dawn.

#### 15.5.4 The skeleton's reserved card

Without a reserved card the Lattice would be one weighted draw among about six archaeon candidates, so a player who
wants to hunt could wait levels for it. So the draft's **second reserved card** (§15.6's partner card, widened) offers
it: after the rung card, if a candidate is an earned partner the rung card did not take, one card is drawn among those
by weight (§15.6, unchanged); **if none is, `SWALLOW_GATE_TRAITS` is not empty and `ownsSwallowGateTrait` is false,
the card is drawn among the gate traits that are candidates** (the Lattice alone). The same room rule holds: at most one rung
card and one second reserved card, each only while the draft still has room for a free card after it. The partners
come first because their unlock toast promises them at the next level-up (§15.6); the Lattice is offered at every
level-up with no partner waiting, until it is taken, with no cap. So:

- an archaeon at level 3 with ten aerobic bacteria: the Mitochondrion (rung), the Lattice (reserved), one free card;
  without the ten: the Lattice (reserved) and two free cards;
- an endosymbiosis cell without the Lattice: the Nuclear Envelope (rung), the Lattice, one free card;
- a eukaryote that has earned the chloroplast and lacks the Lattice: a form gate (rung), the Chloroplast (reserved),
  and the Lattice only by a free draw, then reserved at the following level-up.

With the switch off (`SWALLOW_GATE_TRAITS` empty) the second card reserves partners only, exactly §15.6. Scenario EL21.

**The cost to a player who does not want to hunt, and why it is uncapped.** A player heading for the diatom or the
euglena keeps being offered the Lattice. Before its form that costs a free card: a eukaryote's draft is a form gate
(rung), the Lattice and one free card, for the one or two level-ups between the nucleus and the form. After the form
there is no rung card, so the draft is the Lattice and two free cards, as many free cards as any draft with a rung
card has today. That is intended: swallowing is the one ability that changes what the dish means for a cell, and a
player who has not taken it should always be one pick away (in the pool era too, §15.8.7). Capping it (only up to
`eukaryote`, or N offers) would leave a formed player who wants to hunt waiting on a free draw.

### 15.6 The chloroplast after the nucleus

- **The catalog.** `chloroplast` moves from `stage: 'prokaryote'` to `stage: 'eukaryote'`; it keeps
  `unlockedBy: { photosynthetic, ENDOSYMBIOSIS_BACTERIA_REQUIRED }`, its tiers, rarity and tags. It is no longer an
  endosymbiosis gate: `STAGE_GATE_TRAITS.endosymbiosis` = `['mitochondrion']`. Every eukaryote therefore owns a
  mitochondrion, which is true of every eukaryote's ancestry.
- **How it is earned.** Take in ten photosynthetic bacteria as a eukaryote (the shallows trip, now a late trip):
  swallowed with the Lattice, or held to the bond without it; or swallow a cell that owns a chloroplast (the counter
  credited in full, as today). Green bacteria taken in before the nucleus never count (§15.4.1).
- **The partner card.** Off the rung, the chloroplast would lose its reserved card (`takeRungCard` reserves only the
  next stage's gates, which for a eukaryote are the forms) and be one weighted draw among about nine eukaryote
  candidates. So the draft reserves a second card, the **partner card**, the same way the rung card works: after the
  rung card is drawn, if any candidate is an **earned partner** (a trait with `unlockedBy`, its counter met, its stage
  reached, not owned, a new-trait card) that the rung card did not take, one card is drawn among those by weight. The
  rule reads `unlockedBy` and `stage` from the catalog; no list names the two. At most one rung card and one partner
  card, each drawn only while the draft still has room for a free card after it, so a draft of `TRAIT_DRAFT_SIZE` 1 or 2
  never overflows and a draft of 3 or more keeps at least one free card; when the rung card is itself the earned partner
  (the mitochondrion for an archaeon) no partner is left for the second card. What it changes once the reorder ships: a
  eukaryote that has earned the chloroplast gets it on a reserved card instead of as a random draw. With the switch on,
  the same card offers the inner skeleton when no partner is waiting (§15.5.4; ticket #908 builds the partner half,
  the skeleton half comes with the ladder ticket of §15.10). Scenario EL21.
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
the reorder does not touch (ecology/food-and-spawn.md §3.1). The inner skeleton changes build 1 once more, after the
reorder (§15.8.1).

### 15.7 The pace

The #138 slow-dawn targets (core.md §3, ± 20 s for one active player) are kept for the first three rungs and
re-read. The level-ups land where they did; what changed with decision ticket #919 is that the player chooses at level
3 or later whether one of them is the Lattice (§15.5.3):

| Round time   | Phase (session.md §5.1) | What the player does                                                                                                                                                                                                                                                  |
| ------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 – 3:00  | Dawn                    | A protocell: absorbs algae, scraps and DNA fragments; bacteria pass under it; nothing but the giant amoeba can eat it, and nothing can it eat. Nucleoid at level 2, ~2:50                                                                                             |
| 3:00 – 5:40  | The arms                | An archaeon: its arms latch bacteria; the vent trip holds two clusters of aerobic bacteria to the bond. The giant amoeba starts to hunt it from 225 mass (~3:25). At level 3, ~5:40, the choice: the Mitochondrion (the rung card) or the Lattice (the reserved card) |
| 5:40 – 8:00  | Partners or hunters     | Hunters (the Lattice at level 3) swallow from ~5:40: bacteria whole, and any cell they out-weigh by the ratio. Partner-first players absorb and latch and dodge them. The paramecium-line wild cells swallow from 6:00 (§15.8.1). Level 4 at ~8:00                    |
| 8:00 – 10:00 | Bloom, and the food web | Partner-first players take the nucleus or the Lattice at ~8:00, the other at ~9:40; hunters take the mitochondrion at ~8:00 and the nucleus at ~9:40. Engulfs decide the leaderboard. The shallows trip for the chloroplast. A form only at level 6, past 10:00       |

- **The food web's share.** Players can swallow from ~5:40 and wild cells from 6:00: about **4:20 of the 10-minute
  dish (43 %)**, against 2:00 when swallowing came with the nucleus. Gameplay QA (ticket #917) measures the first
  swallow and the share of players who take the Lattice at level 3.
- **The protocell loses its bacteria.** Today a bacterium every ~10 s (1 DNA) is part of the protocell's income, about
  a quarter of the 60 DNA to level 2 (ecology/food-and-spawn.md §3). The start value replacing it:
  `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` 0.3 → **0.4** (tuning; with the switch, in the "on" slice), which brings the
  pace model's level 2 back to about 3:00. The archaeon's latch pays the same as eating, so the later rungs keep their
  pace. Gameplay QA measures the model's three targets and the P1 bound (level 2 by 6:00) and moves this one value.
- **No form inside a 10-minute dish.** Every form is now five picks (level 6, 500 DNA), six for a player who took the
  Lattice before it (the amoeba's five include it). In the three-era game (phases.md §14) the move at 10:00 gifts a
  form to whoever has none (§14.4.3), so the pool era starts with everyone formed, as planned; in a game of
  `ROUND_DURATION_SECONDS` 600 almost no one ends with a form. Today only a euglena could take one at level 5 (9:40), so
  little is lost.
- **Early absorptions are a choice.** Before 5:40 nobody scores an absorption; after it only hunters and the
  paramecium-line wild cells do (the pace model never counted any, core.md §3); score is DNA. The death rate before
  5:40 is the giant amoeba's alone.
- **Who decides when the cards time out.** An offer left alone picks its heaviest card, a tie going to the lower
  catalog index (PROGRESSION.md §4). The weight is rarity × min(4, 1 + 0.1 × the card's tag points): the Lattice
  1.0 × (1 + 0.1 × (motile + armored)), the Mitochondrion 0.5 × (1 + 0.1 × metabolic). After the vent trip a cell has at
  least 10 metabolic points (one per aerobic bacterium), so the Mitochondrion weighs at least 1.0, and it wins a tie
  (it comes before the Lattice in the catalog); more aerobic bacteria tip it further, motile and armored points tip the
  Lattice, and the free card can outweigh both. So an idle archaeon, or a bot, after the vent trip more likely takes the
  partner first. Gameplay QA (EL20, ticket #917) measures the share that takes the Lattice at level 3; it is a tuning
  fact, not a new rule.

### 15.8 What else it touches

#### 15.8.1 Wild cells

- **A wild cell swallows from the level its build reaches the Lattice** (§15.5.1). Real biology picks which: paramecia
  are swallowers (they feed through an oral groove), amoebae are the classic swallowers, and diatoms never swallow (they
  live by light inside a glass wall). The builds, after the reorder of §15.6:

  | Build (seat mod 3)               | Picks in order                                                                                                                    | Owns the Lattice from          |
  | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
  | 0, the amoeba line (world clock) | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cytoskeleton`, `amoeba_pseudopods`, `ribosomes`, `simple_flagellum` (unchanged) | level 5: 12:00, after the dish |
  | 1, the paramecium line           | `nucleoid`, **`cytoskeleton`**, `mitochondrion`, `nuclear_envelope`, `cilia`, `paramecium_cilia`, `ribosomes`                     | **level 3: 6:00**              |
  | 2, the diatom line               | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cell_wall`, `diatom_shell`, `ribosomes`, `food_vacuole` (unchanged)             | never                          |

  Build 1 takes the Lattice second and drops `simple_flagellum` from its end, so it stays seven picks long (the wrap to
  tier upgrades is unchanged). Build 0 is not touched, because the world's stage clock reads it (ecology/food-and-spawn.md
  §3.1); so in the dish the amoeba line does not swallow, which no one sees: no wild cell reaches its form before 15:00.
  Ticket #957 gives the world clock its own pick list, so build 0 can then take the Lattice second like a real amoeba.

- **So the dish:** before 6:00 no wild cell swallows; they graze, wander and flee only the giant amoeba and the
  hunters among the players. From 6:00 the paramecium line (eight of the 24 seats) hunts cells and players by today's
  rules; the other two lines graze and flee all dish long. The die-off (ecology/wild-cells.md §3.3.6) keeps their
  numbers, and its dissolved cells still drop detritus.
- **`WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`** (`endosymbiosis`, 6:00) stays, read beside `canEngulf` as today; build 1
  reaches the Lattice on the same tick, so it changes nothing while the shipping numbers hold.
- **A wild cell's stage no longer always equals the world's** (ecology/wild-cells.md §3.3.2 said it did): build 1 is a
  rung behind at levels 3, 4 and 6 (at 6:00 it is an archaeon with the Lattice). Nothing decides a rule by a wild cell's
  own stage any more (the swallow reads its traits, the hunt-players gate the world's stage), only its label (`WILD
ARCHAEON`). The wild-cells test and §3.3.2 drop the equality and keep `ladderProblem`.
- A wild cell owns no chloroplast in the dish, never latches and still leaves bacteria alone.
- **Pool wild cells** (phases ticket #871): the per-form builds follow the same truth: the amoeba's, the paramecium's and
  the stentor's take the Lattice early (the stentor is a swallower too); the diatom's and the euglena's never take it
  (the green euglena lives by light and absorbing).

#### 15.8.2 The giants

- The giant amoeba swallows by its species (§15.5.1): it swallows any cell it touches and can engulf, and hunts in its
  window from 225 mass, as today. Until the first hunters it is the early dish's one predator, which is true to life:
  big eukaryotes graze archaea and bacteria. Its build keeps the Lattice (`GIANT_BUILDS_BY_SPECIES`), which is now a
  valid earlier pick and changes nothing.
- The grazer and the drifter are unchanged. Players can swallow a giant only with the Lattice (the lightest giant needs
  1 125 mass, so in practice late).
- The giant diatom's build is re-ordered (§15.6); its level goes from 6 to 7 (derived), its payout (`GIANT_DNA_BONUS`)
  does not change, and eating it still credits the chloroplast's counter in full.

#### 15.8.3 The bots

- **`grazer`, `forager` and the hunter's graze** aim at the nearest mote their cell can use: a bacterium only when
  `bacteriumContactOutcome` is `latch` or `swallow` for it (a protocell, or an archaeon with a full held list, skips
  bacteria). The filter lives in the bots' perception beside `canEngulf`, so no strategy carries its own rule.
- **`hunter`** reads `canEngulf`, so until its cell owns the Lattice it never finds prey and grazes (#376's grazing
  hunter), as it should. **`flee`** likewise flees only what can swallow it.
- **Bots take the Lattice as a player who lets the cards time out does** (§15.7: when it is the heaviest card, which
  after the vent trip is usually not at level 3), since a bot never picks a card. No strategy gains a card rule.
- **No new strategy.** A grazer latches by touching; holding to the bond needs no steering.
- **The predation bench** (`bench:predation`, testing/bots-and-design-tables.md §8.3) will print near-zero player
  absorptions before 5:40; gameplay QA records the new baseline.

#### 15.8.4 The balance tables and numbers

| Table or number                                                                                               | Change                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `TRAIT_CATALOG` (`traits.ts`)                                                                                 | `chloroplast.stage` `prokaryote` → `eukaryote` (§15.6); `cytoskeleton.stage` `eukaryote` → `prokaryote` (§15.5.3)         |
| `STAGE_GATE_TRAITS` (`ladder.ts`)                                                                             | `endosymbiosis`: `['mitochondrion', 'chloroplast']` → `['mitochondrion']`                                                 |
| `WILD_CELL_BUILDS` (`wild-cells.ts`)                                                                          | build 1 (§15.6), then the Lattice second (§15.8.1)                                                                        |
| `GIANT_BUILDS_BY_SPECIES` (`giants.ts`)                                                                       | `giant_diatom` (§15.6)                                                                                                    |
| `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` (`ecology.ts`)                                                           | 0.3 → 0.4 (tuning, §15.7), in the "on" slice                                                                              |
| `ENDOSYMBIOSIS_BACTERIA_REQUIRED`, level costs, `ENGULF_*`, food mix by world stage, zone and variant weights | unchanged. The shallows' photosynthetic clusters now serve a late trip; the protocell era's bacteria wait for the archaea |
| `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`                                                                          | unchanged (opens on the tick build 1 reaches the Lattice, §15.8.1)                                                        |
| `SWALLOW_FROM_STAGE` (`absorption.ts`, ticket #907)                                                           | replaced by `SWALLOW_GATE_TRAITS` (§15.10, §15.12.2)                                                                      |
| new: the early-life domain                                                                                    | §15.12                                                                                                                    |
| `data/balance.json`                                                                                           | regenerated (`pnpm generate:balance`) by each ticket that changes a value                                                 |

#### 15.8.5 The tests that change

- **Ladder and draft:** PROGRESSION.md §7 P12 (a prokaryote with photosynthetic 10: the chloroplast is no longer a
  candidate), P13 (`[nucleoid, chloroplast]` → `prokaryote`), P14 (the chloroplast clause becomes the mitochondrion's);
  the shared `stage-of`, `ladder-check`, `traits` and `wild-cells` tests; the server's `draft`, `ladder`, `wild-build`,
  `wild-settle` and giant balance tests; the client's ladder orbit specs.
- **Engulf-process tests** (about 118 files: 87 server and shared test files, 12 `src/testing` helpers and about 19
  client specs; most build plain protocell predators): they test the process, not who may swallow, so before the flip
  each states that every cell swallows (a balance with `SWALLOW_GATE_TRAITS` empty, through one helper in
  `packages/shared/src/testing/` for server and client tests alike: ticket #907's `withSwallowFromProtocell`, renamed
  `withEveryCellSwallowing` by the contract ticket of §15.10), and no expected value moves.
  Four tickets do it: #910 (shared and the server simulation units), #923 (the wild, bots, session, world and debug
  units and `bot-builders.ts`), #924 (the gameplay setups and scenarios) and #925 (the client specs and the preview
  scenes). The preview scenes are production code: `render/preview/scenes/escape-scene.ts` stages protocell predators,
  so its predators own the Lattice rather than a patched balance, or the bench and evidence scenes lose their danger
  ring at the flip. New engulf tests written meanwhile (the phases build included) use the helper from day
  one. The gate itself is tested by §15.13's own scenarios. Scenarios that are about the early dish's
  predation are re-read, not patched: G13 (a wild seat engulfs a player at 6:30) keeps its time but needs a build-1
  seat (EL13), and the wild-cell scenarios that count early wild-on-wild engulfs are re-measured.
- **Bots and pace:** P1 (greedy bot, level 2 by 6:00) is re-measured under the switch; the bot strategy tests gain the
  mote filter's cases.
- **The skeleton on the ladder:** the shared `traits`, `ladder-check` and `wild-cells` tests (the Lattice at
  `prokaryote`, build 1, and the wild stage equality dropped), the server's `draft` tests (the second reserved card's
  skeleton half, EL21), `wild-settle`, and the client's trait-glyph and catalog specs that list traits by stage.

#### 15.8.6 Score, death and entry

Unchanged rules: score is `dnaCumulative − dnaCatchUpGift + SCORE_ABSORPTION_BONUS × absorptions`; death keeps the
ladder; the entry rule lifts a respawn's or a late joiner's level, never its stage past its gates, so a lifted player
who is still an archaeon latches like anyone (PROGRESSION.md §5). The Lattice is kept on death like every trait, so a
hunter respawns a hunter; the lifted level's queued drafts offer it on the reserved card (§15.5.4).

#### 15.8.7 Where it meets the phases plan (phases.md §14)

Each bullet names the phases ticket it changes; the tickets carry the change.

- **The shared non-number balance leaves (tickets #907 and #867).** `debug_set_balance` and the replay's
  `debug_patch` took number leaves only before ticket #907. `SWALLOW_FROM_STAGE` (a stage id) and phases' `ERAS_IN_PLAY` (a list of
  era ids) need the same widening, so it is built once, in ticket #907, which ships first (§15.10); ticket #867 depends
  on it and adds only `ERAS_IN_PLAY`'s validator (a prefix of dish, pool, colonies). The contract ticket of §15.10
  declares one more kind on it, the trait-id list of `SWALLOW_GATE_TRAITS`. Ticket #907 also widens the
  ledger's parser to find a constants table under a `####` heading, which §14.14.1 needs too.
- **The move (ticket #868; §14.4.2 step 1).** Step 1 empties every held list with no payout, no credit and no `eat`
  (the held bacteria go with the dish's motes, §15.4.2); step 6's gift comes after, so no partner is paid at the move
  even when the gift brings the Lattice (the eating step's swallow finds the list already empty). Built; nothing to
  change.
- **The no-form gift (ticket #869; §14.4.3).** It reads `STAGE_GATE_TRAITS` and the forms' requirements at build time, so it needs no
  rule change: after the reorder the endosymbiosis gate is the mitochondrion alone, and the euglena's chloroplast is its
  form requirement. PH2 and PH16 hold unchanged. The gift gives the Lattice only to a gifted amoeba (its form
  requirement), so only then does the swallow popup fire at the move (§15.5.2: queued after the form popup, without the
  reveal; the popup is ticket #913's, the HUD of the move ticket #877's). A gifted paramecium, euglena, diatom or
  stentor arrives in the pool unable to swallow until it takes the Lattice, which the reserved card offers at its next
  level-up (§15.5.4). Whether the gift should add the Lattice is question 3 of §15.14.
- **The pace (tickets #881 and #883).** Ticket #881's pace model takes in the 0.4 fragment rate (§15.7) and forms at
  level 6, not 5 (7 for a player who took the Lattice first); more players reach 10:00 without a form, so more are
  gifted one, and ticket #883 measures the share.
- **Endosymbiosis after the dish (ticket #881; §14.7.2).** The waiver stands; in the dish the chloroplast's unlock is
  now a eukaryote's.
- **Wild cells in the pool (ticket #871; §14.5.4).** The per-form builds follow the new ladder (§15.6): the euglena's
  takes the mitochondrion second and the chloroplast after the envelope; `ladderProblem` refuses the old order. And the
  inner skeleton (§15.8.1): the amoeba's, paramecium's and stentor's builds take the Lattice early, so they swallow; the
  diatom's and euglena's never take it.
- **The pool's creatures (tickets #872 and #873; §14.6).** The species half of `canEngulf` (§15.5.1) covers them: the
  Didinium and the rotifer swallow by species, as the giant hunter does, whatever stage they are built with; the
  copepod and the nematode never engulf. Ticket #867 only defines the species; ticket #872 adds the Didinium and the
  rotifer to the species half as eaters, and ticket #873 adds the nematode to it **as a non-eater** (§15.5.1: as a cell
  whose `giantSpecies` is null it would otherwise read as a plain cell and engulf while the switch is empty); the
  copepod has no cell and stays out.
  The traits half does bite in the pool: a player or wild form without the Lattice cannot swallow there (above).
- **New engulf tests in the phases build (tickets #868, #872, #873, #885).** The grace, the creatures' engulfs and the
  bodies' bites start engulfs; their tests state that every cell swallows through the shared helper (or use
  predators that own the Lattice), so the flip in ticket #916 does not break them.
- **The pool's bots (ticket #904).** They aim at motes through the same mote filter (§15.8.3).
- **The cast (ticket #878; §14.12.3).** The archaeon is a sea-floor microbe, which fits the kelp shore; its page and
  lines are ticket #914's (§15.9), not the cast ticket's.

### 15.9 The words

Every number below comes from a constant or the live balance through `hud/format/`, never typed. Encyclopedia copy
follows ui/encyclopedia.md §11 (no number and no arithmetic in the copy files: placeholders only).

This is the switch-on game's copy, and the live game must never show it while the switch is off (it would say "only a
cell with an inner skeleton engulfs" while protocells still do). So:

- **The HUD's copy (ticket #913) reads the switch.** Its popup and beats fire on the live balance's
  `SWALLOW_GATE_TRAITS` (while it is empty no cell ever gains a gate trait, so the ability popup never fires), and the
  pills and toasts that differ pick their switch-off line (the reorder's, §15.6) while it is off. #913 may merge any time
  before ticket #916.
- **The encyclopedia (ticket #914) is static prose and merges with the flip:** its PR lands immediately before ticket
  #916's, back to back, never earlier. The stage display name `Archaeon` is true either way and may ship with #913.

#### 15.9.1 Stage names, toasts and the opening beats

| Where                                                                                                                                                                            | Today                                                                 | After                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The `prokaryote` stage's display name                                                                                                                                            | `Prokaryote`                                                          | `Archaeon` (the stage id stays `prokaryote`; the HUD's wild label reads `WILD ARCHAEON`)                                                                                                                                                                 |
| `stage` toast, prokaryote                                                                                                                                                        | `You are a prokaryote`                                                | `You are an archaeon`                                                                                                                                                                                                                                    |
| `stage` toast, endosymbiosis                                                                                                                                                     | `Endosymbiosis · an organelle lives inside you`                       | `Endosymbiosis · a bacterium lives inside you`                                                                                                                                                                                                           |
| `stage` toast, eukaryote                                                                                                                                                         | `You are a eukaryote`                                                 | unchanged                                                                                                                                                                                                                                                |
| First eat pill                                                                                                                                                                   | `Swallow motes to grow`                                               | `Absorb specks to grow`                                                                                                                                                                                                                                  |
| Prokaryote pill                                                                                                                                                                  | `Eat 10 orange rods at the warm vent or 10 green in the shallows · …` | `Touch bacteria to hold them · {10} orange ones earn a mitochondrion` (the orbit's one counter)                                                                                                                                                          |
| new opening beat **Eukaryote**: stage becomes `eukaryote` without a chloroplast                                                                                                  | —                                                                     | `Take {10} green rods in the shallows · they become a chloroplast` (rim `ZONE_CUE`; held or swallowed, both count)                                                                                                                                       |
| new coach beat **Can't swallow yet**: the first time the own cell, while `canSwallowByTraits` is false, touches a bacterium it cannot latch or a cell it out-weighs by the ratio | —                                                                     | protocell and bacterium: `You can't swallow bacteria · grow a nucleoid to hold them`; a cell: `You can't swallow cells yet · the Cytoskeleton Lattice lets you`. The mass test is the shared `meetsEngulfStartRatio` (§15.5.1), never a re-derived ratio |
| Endosymbiont unlocked toast                                                                                                                                                      | `Mitochondrion unlocked · offered at your next level-up`              | unchanged                                                                                                                                                                                                                                                |
| The Cytoskeleton Lattice's card and its tier I popup, while `ownsSwallowGateTrait` is false and the list names the Lattice                                                       | its tier effect lines                                                 | its tier effect lines, then `▲ Swallow cells and bacteria whole`                                                                                                                                                                                         |

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

| Entry                                            | Says (in substance; the encyclopedia ticket writes the copy)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage:protocell`                                | You absorb food through your skin: specks, scraps and loose DNA. You cannot swallow a bacterium or a cell.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `stage:prokaryote`, titled **Archaeon**          | Your genes sit in one loose coil. You are an archaeon, the kind of cell whose line became ours. Thin arms hold any bacterium they touch; held long enough, it shares its food, and enough aerobic ones earn the mitochondrion. From here you can also build an inner skeleton, the Cytoskeleton Lattice, and swallow. Real: Asgard archaea live in sea-floor mud; the one grown in a lab, _Prometheoarchaeum_, is half a micrometre across and lives tangled in long arms with partner bacteria. Caveat: a real partnership took countless generations. |
| `stage:endosymbiosis`                            | A bacterium you held now lives inside you as a mitochondrion: every complex cell alive descends from that partnership.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `stage:eukaryote`                                | A nucleus of your own, its genes safe behind a membrane. The chloroplast and the forms open here. Whether you can swallow depends on the inner skeleton, not the nucleus: real complex cells all have one.                                                                                                                                                                                                                                                                                                                                              |
| `trait:mitochondrion`                            | Unlocked by holding aerobic bacteria with an archaeon's arms until they bond, or by swallowing them once you have the inner skeleton.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `trait:chloroplast`                              | A eukaryote's trait. Unlocked by taking in photosynthetic bacteria, held or swallowed. Real: the first chloroplast was a green bacterium a complex cell swallowed, long after the mitochondrion; a euglena's came second-hand, from a green alga it swallowed.                                                                                                                                                                                                                                                                                          |
| `trait:cytoskeleton` (Cytoskeleton Lattice)      | Your inner skeleton: protein threads that push your skin out round a smaller cell, so you swallow cells and bacteria whole; it also makes you turn and stop sharper and harder to hold. Taking it ends your arms. Real: Asgard archaea already had actin threads in their arms; whether our ancestors swallowed before or after they gained the mitochondrion is still argued, and much of the evidence leans toward the partner first. The game lets you choose.                                                                                       |
| `trait:nucleoid`                                 | Owning it makes you an archaeon, with arms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `action:eat`, titled **Absorb**                  | Touch a speck to take it in. Every cell absorbs specks, scraps and loose DNA; only a cell with an inner skeleton swallows bacteria and cells.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `action:latch` (new)                             | An archaeon's arms hold any bacterium they touch, up to {maxHeld}; held for {bondSeconds} it shares its food and, if aerobic, counts toward the mitochondrion. A sprint shakes them loose.                                                                                                                                                                                                                                                                                                                                                              |
| `action:engulf`                                  | Only a cell with an inner skeleton (the Cytoskeleton Lattice) engulfs, at any stage from the archaeon on.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `bacterium:aerobic` / `bacterium:photosynthetic` | Aerobic: an archaeon holds them, or swallows them once it has the skeleton, to earn the mitochondrion. Photosynthetic: only a eukaryote can use them, held or swallowed, toward the chloroplast.                                                                                                                                                                                                                                                                                                                                                        |
| the DNA fragment                                 | Loose DNA in the water; real bacteria and archaea take it in and sometimes use its genes.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| the ladder orbit (`hud-entries.ts`)              | A counter shows for each endosymbiont from the stage that can earn it: the mitochondrion's from the archaeon, the chloroplast's from the eukaryote.                                                                                                                                                                                                                                                                                                                                                                                                     |

### 15.10 The switch and the order of the build

Main deploys to the human's game on every merge, so the change ships behind one balance leaf, as the giants and the
eras did. Ticket #907 built it as a stage, **`SWALLOW_FROM_STAGE`** (`absorption` domain, shipping `protocell`).
Decision ticket #919 moves the gate from a stage to a trait, so the **contract ticket #948** replaces that leaf
with **`SWALLOW_GATE_TRAITS`** (`absorption` domain, a list of trait ids, read by §15.5.1's two checks):

- **Shipping value `[]`**: no gate, every cell swallows from the start and no cell latches (a swallow outranks a
  latch), which is today's game exactly, as `protocell` was.
- **The flip (ticket #916) sets `['cytoskeleton']`** (or the new base trait, if question 2 of §15.14 chooses one).
- **Why a list, not one id:** it reads like `STAGE_GATE_TRAITS` (own any listed trait; empty means no gate), it holds
  either answer to question 2 without a new leaf, and a later trait that also brings swallowing joins the list.
- **No stage half is kept.** A cell swallows by its traits alone; keeping `SWALLOW_FROM_STAGE` beside it would be two
  switches for one rule. The stage-id leaf kind stays for `LATCH_FROM_STAGE`.

**Reaching it in tests and on a private stack.** `debug_set_balance` (`server/src/game/debug/balance-patch.ts`) and the
`BalancePatch` the replay records as a `debug_patch` took number leaves only, so a stage id was refused.
Ticket #907 widened both, once, for every non-number leaf (`game/debug/balance-leaf-kinds.ts`, architecture/debug-mcp.md §8): a patch may set a leaf of a declared kind, each kind with its
validator, and anything else is refused as today. It declares the stage-id kind (`LATCH_FROM_STAGE`, and
`SWALLOW_FROM_STAGE` until ticket #948); phases ticket #867 declares the era-list kind for `ERAS_IN_PLAY`.
Ticket #948 declares a **trait-id list** kind for `SWALLOW_GATE_TRAITS`: every entry a catalog trait id, no id
twice, the empty list allowed; anything else refused. The replay records and replays such a patch, so a game whose
switch moved mid-way reproduces its state hash.

**Old recordings** (`server/src/game/replay/`, ticket #948; the rule of determinism/replay-tests-and-traps.md §6: a
recording replays to its `finalHash` or is refused by name, never silently under other rules):

| Recording                                                                             | What the replay does                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| made before ticket #907: neither leaf                                                 | fills `SWALLOW_GATE_TRAITS` `[]` (and `earlyLife`), as today's fill does; the pinned `recorded-before-907.replay.json` stays green                                                                                                                                        |
| made between tickets #907 and #948: its balance carries `SWALLOW_FROM_STAGE`          | `protocell` maps to `SWALLOW_GATE_TRAITS` `[]` (the same game) and the stale leaf is dropped before the fill; **any other stage is refused by name** ("recorded under the stage switch at `<stage>`, which the trait switch cannot replay")                               |
| any recording whose `debug_patch` `set_balance` names `absorption.SWALLOW_FROM_STAGE` | the same mapping on the patch: `protocell` becomes `SWALLOW_GATE_TRAITS` `[]`; any other stage refuses the recording by name before the replay starts. The patch is never handed to `applyBalancePatch` as is, which would abort the replay mid-way on an undeclared leaf |
| made after ticket #948                                                                | replays as recorded                                                                                                                                                                                                                                                       |

Ticket #948 pins one recording made between #907 and #948 (a fixture beside `recorded-before-907.replay.json`) and
one with a recorded `SWALLOW_FROM_STAGE` patch. **The fill stays `[]` after the flip**: `recordedBalanceWithShippingDefaults`
fills from `DEFAULT_BALANCE`, which the flip (ticket #916) moves to `['cytoskeleton']`, but a recording without the leaf
ran under "every cell swallows". So the fill for this leaf is pinned to `[]` (the `recorded-balance.ts` header already
demands it of the flip), or the flip moves `REPLAY_FORMAT_VERSION` instead; ticket #916 does one of the two, and the
pinned fixtures prove it.

The order (the epic's roadmap):

1. **In parallel, first:** the ladder reorder, **ticket #908**, on its own (the chloroplast after the nucleus, the partner
   card, the unlock toast's rule, the builds, the orbit's counter rule, and the copy of §15.6 that is true with the
   switch off): it needs no switch and changes only who is offered the chloroplast when. And the contract, **ticket
   #907** (merged), with the switch off; phases ticket #867 builds on its non-number leaves.
2. **The trait gate, ticket #948,** with the switch off (`[]`): the leaf, its kind, the predicate and
   `bacteriumContactOutcome` reading traits, the renamed test helper. It goes before the tickets of step 3 that read
   the switch (#909, #911, #912, #913) and before the test-fixture parts use the helper.
3. **Behind the switch, in parallel:** the latch (#909), the four test-fixture parts (#910, #923, #924, #925), bots and
   wild cells (#911), the render (#912), the HUD (#913), the sound (#915); with the switch empty they are inert. And
   **the skeleton on the ladder, ticket #949** (after ticket #908 and ticket #948, and the human's answer
   to question 1): the Lattice's stage, the second reserved card's skeleton half, wild build 1. It is true with the
   switch off (the Lattice is then an ordinary archaeon pick), so it may merge before the flip.
4. **The flip, ticket #916,** with the encyclopedia (#914) merged immediately before it: `['cytoskeleton']` and the
   fragment rate, and core.md §3, session.md §5.1 and the ecology docs move to describe the live game. Every part of
   the test-fixture work lands before it. Then gameplay QA (#917) tunes.

### 15.11 Contract (for the architect)

Folded into architecture/entity-model.md §2, server-simulation.md §3, wire-contract.md §4, constants-files-tests.md §9
and §10 and debug-mcp.md §8 by the contract ticket.

- **Constants and balance:** `SWALLOW_GATE_TRAITS: readonly TraitId[]` in `constants/absorption.ts` (the `absorption`
  domain), shipping `[]`, in place of ticket #907's `SWALLOW_FROM_STAGE`; its row in ecology/constants.md §7 replaces
  that one (the ledger parses it; ticket #948). The `LATCH_*` rows in a new domain file (proposed
  `constants/early-life.ts`, balance domain `earlyLife`), registered in `CONSTANTS_TABLE_SOURCES` from this doc's
  §15.12.1 heading. The ledger found only `## N. Constants table` sections (`constantsTableRows`), so ticket
  #907 widened the parser to take a section by its heading at any level; phases §14.14.1 (ticket #867) reuses it.
- **Non-number balance leaves:** the patch and replay widening of §15.10, built in ticket #907.
- **The predicate:** `EngulfPredator` reads `traits` in place of `stage` (`Pick<CellView, 'mass' | 'giantSpecies' |
'poolCreature' | 'traits'>`); `canEngulf` is §15.5.1's formula (the species decides for a giant or a creature, the owned traits for a
  player or a plain wild cell); `EngulfRatioBalance` carries `SWALLOW_GATE_TRAITS` in place of `SWALLOW_FROM_STAGE`.
  `canSwallowByTraits(traits, balance)` and `ownsSwallowGateTrait(traits, balance)` are exported beside it, each read
  by the rules §15.5.1's table names. `isCellEaterSpecies` becomes `eatsCells`, reading `giantSpecies` and
  `poolCreature` (the nematode a non-eater). The bots' `BotCellView` gains `traits` and `poolCreature` (so a bot's `flee` and threat reads count a Didinium or a rotifer as dangerous).
  The mass half is exported as `meetsEngulfStartRatio`. `bacteriumContactOutcome(cell, heldCount, balance)`, `cell`
  being `Pick<CellView, 'stage' | 'traits'>`, in `shared/simulation/` beside them.
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
  a stage or give the Lattice; `debug_spawn(bacterium)` already exists; `debug_set_balance` takes the stage leaves and
  the gate's trait list (§15.10).
- **Determinism:** no new random stream; the latch runs in the eating step and keeps its order; a release re-inserts
  the kept record and draws nothing from `moteMotion`.
- **Test helper:** one helper in `packages/shared/src/testing/` that gives a balance in which every cell swallows
  (`SWALLOW_GATE_TRAITS` `[]`), for server and client tests, so the test-fixture parts and the phases build use it from
  day one: ticket #907's `withSwallowFromProtocell`, renamed `withEveryCellSwallowing` by ticket #948, and
  `withSwallowGateTraits(traitIds, balance)` beside it for a test that states the gate.
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

| Constant                             | Today                                           | After                                                                                    | Its row                         | When                       |
| ------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------- | -------------------------- |
| `STAGE_GATE_TRAITS`                  | endosymbiosis: `mitochondrion` or `chloroplast` | endosymbiosis: `mitochondrion`                                                           | constants-and-acceptance.md §12 | the ladder reorder         |
| `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` | 0.3                                             | 0.4 (tuning)                                                                             | ecology/constants.md §7         | the "on" slice             |
| `SWALLOW_FROM_STAGE`                 | `'protocell'` (ticket #907)                     | removed: replaced by `SWALLOW_GATE_TRAITS` (§15.10)                                      | ecology/constants.md §7         | ticket #948                |
| `SWALLOW_GATE_TRAITS` (new row)      | —                                               | `[]`, then `['cytoskeleton']` (decided; trait-id list, `absorption.ts`, §15.5.1, §15.10) | ecology/constants.md §7         | ticket #948, then the flip |

The catalog rows (the chloroplast's stage, §15.6; the Lattice's, §15.5.3), `WILD_CELL_BUILDS` (§15.6, §15.8.1) and
`GIANT_BUILDS_BY_SPECIES` (§15.6) change as those sections say.

#### 15.12.3 Client constants (not ledger rows)

| Constant                         | Default | Unit | File                                                          | Status | Rule (section) |
| -------------------------------- | ------- | ---- | ------------------------------------------------------------- | ------ | -------------- |
| `SWALLOW_UNLOCK_LATTICE_SECONDS` | 0.6     | s    | `packages/client/src/app/game/render/constants/early-life.ts` | tuning | §15.5.2 step 3 |
| `SWALLOW_UNLOCK_PING_SECONDS`    | 1.2     | s    | `packages/client/src/app/game/render/constants/early-life.ts` | tuning | §15.5.2 step 4 |

The arms' and the held rods' look (count, length, the bond tint) are the render ticket's constants
(rendering docs).

### 15.13 Acceptance scenarios

Format and fixture conventions as [`constants-and-acceptance.md §13`](./constants-and-acceptance.md#13-acceptance-scenarios).
Unless stated: seed 42, balance with `SWALLOW_GATE_TRAITS` `['cytoskeleton']` (the switch on), ticks at 60 Hz. "An
archaeon" owns `nucleoid` I; "a eukaryote" owns `nucleoid` I, `mitochondrion` I and `nuclear_envelope` I; "with the
Lattice" adds `cytoskeleton` I. "The switch off" is `SWALLOW_GATE_TRAITS` `[]`.

| #    | Given                                                                                                                                                                                                                                                                                                                                                                         | Inputs                                                                                        | After                | Assert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EL1  | two protocell players, mass 100 and 20, the smaller placed at the larger's centre                                                                                                                                                                                                                                                                                             | idle                                                                                          | 120 ticks            | no engulf ever starts (both `free` every tick); separation pushes them apart; paired case with the switch off: the 100 engulfs the 20 as E9                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| EL2  | a protocell at mass 20; one algae mote and one plain bacterium placed at its centre                                                                                                                                                                                                                                                                                           | idle                                                                                          | 1 tick               | the algae mote is gone (mass + 1 less decay); the bacterium is still a mote (± its drift); `dnaCumulative` 0, every counter 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| EL3  | an archaeon at mass 100; one aerobic bacterium placed with its centre 1.1 own radii from the cell's centre                                                                                                                                                                                                                                                                    | idle                                                                                          | 1 tick               | the mote is gone from the world; the cell's `latchedBacteria` holds one aerobic entry with that mote's id and `caughtAtTick` = this tick; one `bacterium_latched` effect; mass and DNA unchanged (less decay)                                                                                                                                                                                                                                                                                                                                                                                                      |
| EL4  | EL3                                                                                                                                                                                                                                                                                                                                                                           | idle                                                                                          | latch + 360 ticks    | still held on tick latch + 359; on latch + 360: the held list is empty, one `eat` effect whose `eatenId` is the mote's id and whose `massGained` is 3, and one `bacterium_bonded` with that `moteId` and `isCredited` true; `bacteriaEatenByVariant.aerobic` = 1, `dnaCumulative` = 1.05 (Nucleoid I), mass + 3 less decay, `metabolic` + 1; the mass-flow invariant (Δmass = Σ rates + Σ `eat.massGained`) holds on every tick                                                                                                                                                                                    |
| EL5  | an archaeon; 7 aerobic bacteria placed 1.1 own radii out on one tick                                                                                                                                                                                                                                                                                                          | idle                                                                                          | 1 tick               | the 5 lowest mote ids are held; the other 2 are still motes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| EL6  | EL5 two seconds on                                                                                                                                                                                                                                                                                                                                                            | sprint on tick t                                                                              | t + 30               | on tick t (step 1, where the sprint is set) the 5 held go back as free aerobic bacteria (fresh ids, their own headings) at their rim points, one `latch_shaken` with the 5 mote ids, no counter change. The latch reads `sprintRemainingTicks` > 0 at the eating step, after movement has counted it down, so with `sprintDurationTicks` = 30 a bacterium kept in reach latches on no tick from t to t + 28 and is latched on t + 29, the first tick it can be                                                                                                                                                     |
| EL7  | an archaeon holding one photosynthetic bacterium                                                                                                                                                                                                                                                                                                                              | idle                                                                                          | to the bond          | mass + 3 and DNA + 1.05 and `photic` + 1, `bacteriaEatenByVariant.photosynthetic` still 0, `isCredited` false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| EL8  | an archaeon at level 2 with `bacteriaEatenByVariant.aerobic` 9 holding one aerobic bacterium; the fixture grants the DNA to level 3 on the tick after the bond                                                                                                                                                                                                                | idle                                                                                          | grant + 1            | counter 10 after the bond; the offer shown holds `mitochondrion` (the rung card)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| EL9  | pure `listDraftCandidates`: (a) an archaeon with photosynthetic 10, aerobic 10; (b) a eukaryote with photosynthetic 10; (c) the same with photosynthetic 9                                                                                                                                                                                                                    | —                                                                                             | —                    | (a) `mitochondrion` and `ribosomes` are candidates, `chloroplast` is not (stage); (b) `chloroplast` is; (c) it is not                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| EL10 | pure `stageOf`                                                                                                                                                                                                                                                                                                                                                                | —                                                                                             | —                    | `[nucleoid, chloroplast]` → `prokaryote`; `[nucleoid, mitochondrion]` → `endosymbiosis`; + `nuclear_envelope` → `eukaryote`; + `chloroplast`, `euglena_eyespot` → `specialised`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| EL11 | an archaeon with `mitochondrion` I at mass 200 and a protocell player at mass 20 at its centre                                                                                                                                                                                                                                                                                | idle; the fixture grants `cytoskeleton` on tick 60; paired: grants `nuclear_envelope` instead | 62 ticks; paired 120 | no engulf before tick 60; the engulf of the 20 starts on the first contact tick after the grant (60 or 61). Paired: the cell becomes a eukaryote and no engulf ever starts                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| EL12 | an archaeon with `mitochondrion` I holding 3 plain bacteria for 2 s; an offer showing `cytoskeleton`                                                                                                                                                                                                                                                                          | picks it on tick t                                                                            | t + 1                | on tick t (the pick at step 1, the swallow at the start of step 4) the held list is empty and the three are eaten as swallowed: three `eat` effects, mass + 9 less decay, DNA + 3.15, `motile` + 3; then (EL11) it can engulf; its stage is still `endosymbiosis`                                                                                                                                                                                                                                                                                                                                                  |
| EL13 | G13's pattern (a wild seat at size 2.0 on an idle player at mass 20): a build-1 seat placed at 5:30 and at 6:30; a build-0 and a build-2 seat at 9:30                                                                                                                                                                                                                         | idle                                                                                          | 60 ticks after each  | the build-1 seat: no engulf at 5:30 (world level 2: it owns `nucleoid` only), at 6:30 (level 3: `nucleoid`, `cytoskeleton`) the engulf starts and pays out; the build-0 and build-2 seats at 9:30 (level 4, no Lattice): no engulf                                                                                                                                                                                                                                                                                                                                                                                 |
| EL14 | G4 (the giant amoeba and a small cell touching it), the switch on                                                                                                                                                                                                                                                                                                             | idle                                                                                          | as G4                | as G4: the giant amoeba swallows it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| EL15 | the switch off: an archaeon touching an aerobic bacterium                                                                                                                                                                                                                                                                                                                     | idle                                                                                          | 1 tick               | it eats it at once as today (counter + 1 on that tick); `latchedBacteria` stays empty; no `bacterium_latched` effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| EL16 | pure `ladderProblem` over `WILD_CELL_BUILDS` and `GIANT_BUILDS_BY_SPECIES`                                                                                                                                                                                                                                                                                                    | —                                                                                             | —                    | every build is valid, build 1 with the Lattice second included; today's build 1 (`chloroplast` second) gives `chloroplast needs stage eukaryote before it`; with the Lattice's row at `eukaryote` the new build 1 gives `cytoskeleton needs stage eukaryote before it`                                                                                                                                                                                                                                                                                                                                             |
| EL17 | an archaeon holding 2 bacteria is engulfed by the giant amoeba                                                                                                                                                                                                                                                                                                                | idle                                                                                          | the absorb tick      | on its removal tick 2 free bacteria appear at its rim points, then its detritus; no counter change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| EL18 | client: a seat's snapshots show its traits gain `cytoskeleton` on one pick                                                                                                                                                                                                                                                                                                    | —                                                                                             | —                    | one `ability-popup` (`data-ability="engulf"`) queued after Cytoskeleton Lattice I's upgrade popup; none for a Nuclear Envelope pick; none for a first snapshot that already owns it (late join, reconnect); none with the switch off                                                                                                                                                                                                                                                                                                                                                                               |
| EL19 | bots: a `grazer` protocell with one bacterium and one algae mote in view, the bacterium nearer                                                                                                                                                                                                                                                                                | one decision                                                                                  | —                    | it aims at the algae mote; as an archaeon with a full held list, the same; as an archaeon with room, at the bacterium                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| EL20 | gameplay QA, measured (not pinned): one active player and a greedy bot, seeds 1–10, switch on                                                                                                                                                                                                                                                                                 | —                                                                                             | 10:00                | the pace model's nucleoid ~2:50, level 3 ~5:40, level 4 ~8:00 (± 20 s, PROGRESSION.md §2); the first player swallow and the first wild swallow; the share of cells that take the Lattice at level 3 (the timeout pick included); P1's bound holds (level 2 by 6:00); the giant amoeba's kill rate before 5:40 reported                                                                                                                                                                                                                                                                                             |
| EL21 | pure `buildDraft`, seeds 1..100: (a) a eukaryote with the Lattice and photosynthetic 10; (b) an archaeon with aerobic 10 and photosynthetic 10, the switch off; (c) the same as (a) owning `chloroplast`; (d) an archaeon with aerobic 10, no Lattice; (e) an archaeon with aerobic 0, no Lattice; (f) an endosymbiosis cell without the Lattice; (g) (d) with the switch off | —                                                                                             | —                    | (a) `chloroplast` and one form gate (`amoeba_pseudopods`) in every draft, the third card free; (b) `mitochondrion` in every draft (rung card), `chloroplast` in none (stage); (c) no card reserved for a partner; (d) `mitochondrion` and `cytoskeleton` in every draft, the third free; (e) `cytoskeleton` in every draft, two free; (f) `nuclear_envelope` and `cytoskeleton` in every draft; (g) `mitochondrion` in every draft, `cytoskeleton` only by a free draw. The unlock toast fires for (a) on the tick the cell became a candidate, and for (b)'s chloroplast only on the tick (b) becomes a eukaryote |
| EL22 | the switch on; one archaeon latches 3 bacteria, bonds 2, sprints and sheds 1 over 1 200 ticks; a `debug_set_balance` moves `SWALLOW_GATE_TRAITS` to `[]` and back to `['cytoskeleton']` mid-way                                                                                                                                                                               | —                                                                                             | 1 200 ticks          | `debug_export_replay` re-run gives the same final state hash (`evolution-module.determinism.integration.test.ts`); the hash differs if a held entry's `caughtAtTick` is changed (it covers the held list)                                                                                                                                                                                                                                                                                                                                                                                                          |
| EL23 | the switch on; an archaeon holding 2 bacteria; `debug_set_balance` sets `SWALLOW_GATE_TRAITS` to `[]` on tick t                                                                                                                                                                                                                                                               | —                                                                                             | t + 1                | on tick t the held list is swallowed (two `eat`), it never holds a bacterium again, and it can now engulf; a patch with `['amoeba']` (not a trait id), `['cytoskeleton', 'cytoskeleton']` or `'cytoskeleton'` (not a list) is refused                                                                                                                                                                                                                                                                                                                                                                              |
| EL24 | a eukaryote without the Lattice at mass 200, a protocell player at mass 20 at its centre, and one photosynthetic bacterium placed 1.1 own radii out                                                                                                                                                                                                                           | idle                                                                                          | latch + 360 ticks    | no engulf ever starts; the bacterium is latched on tick 0 and bonds on tick 360 with `isCredited` true and `bacteriaEatenByVariant.photosynthetic` + 1                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| EL25 | an archaeon with the Lattice (`nucleoid` I, `cytoskeleton` I), `bacteriaEatenByVariant.aerobic` 9, one aerobic bacterium at its centre                                                                                                                                                                                                                                        | idle                                                                                          | 1 tick               | the bacterium is swallowed on that tick (one `eat`, no `bacterium_latched`), the counter is 10, `latchedBacteria` is empty, and `listDraftCandidates` holds `mitochondrion`                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| EL26 | pure `canEngulf`, each predator at 2 × the prey's mass, the switch on                                                                                                                                                                                                                                                                                                         | —                                                                                             | —                    | a wild cell of build 1 at level 3 (`nucleoid`, `cytoskeleton`): true; build 0 at level 4 (no Lattice): false; the giant amoeba (no Lattice in the test's build): true; the giant grazer: false; a eukaryote player without the Lattice: false, with it: true; every one of them true with the switch off except the grazer and the drifter                                                                                                                                                                                                                                                                         |

### 15.14 Questions put to the human

Answered: decision ticket #919 (when hunting starts) became the trait gate of §15.5; decision ticket #920 kept the
green specks as algae (answer A, §15.9.4).

Ticket #947's questions. The design above is written to each recommendation; the lead files them as decision tickets.

1. **Where does the inner skeleton sit, and so when can a player first swallow?** (decision ticket #951) **A** after the mitochondrion
   (`stage: 'endosymbiosis'`): truest to today's evidence (the partner first, then swallowing); the first swallow at
   ~8:00, about 2 minutes of food web. **B** at the archaeon (`stage: 'prokaryote'`): the first swallow at ~5:40, about
   4:20 of food web (43 %); a real but minority idea (an archaeon swallowed first and caught its mitochondrion that
   way), and the hunter path earns the mitochondrion by swallowing aerobic bacteria. **C** after the mitochondrion with
   a faster climb (level costs lowered so level 4 comes at ~6:00): true order and early hunting, but it reopens decision
   #138's slow dawn and moves the phases pace model. **Recommend B:** the only option that gives the dish a real food
   web with no number changed, and it turns a real open question of biology into the player's choice; the encyclopedia
   says that much of the evidence leans toward the partner first. What A or C rewrites is listed in §15.5.3.
2. **Is the inner skeleton the Cytoskeleton Lattice, or a new trait?** (decision ticket #952) **A** the Lattice itself is the gate (one
   pick: swallow, plus its sharper turning). **B** a new common base trait, the Actin Skeleton, is the gate, and the
   Lattice becomes its denser upgrade (requires it): one more card and page, and a player who wants both spends two
   level-ups; build 0, the giant amoeba's build and the world clock change with it (§15.5). **Recommend A:** the Lattice already draws the skeleton's threads and already gates the amoeba's
   pseudopods; a second trait adds a rung to every hunter's climb for no new play.
3. **A player who reaches the pool without the skeleton** (decision ticket #953): **A** it cannot swallow there until it takes the Lattice,
   which the reserved card offers at its next level-up (the rule as decided: you earn it). **B** the move's no-form gift
   adds the Lattice to everyone who lacks it (every pool player can hunt from the first second). **Recommend A:** it
   keeps one rule everywhere, and a diatom or euglena player not swallowing is true to life; the reserved card makes
   it one level-up away for anyone who wants it (uncapped, §15.5.4).

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
- Uribe-Querol E, Rosales C (2020). Phagocytosis: our current understanding of a universal biological process.
  _Frontiers in Immunology_ 11:1066 (swallowing needs the actin skeleton, motor proteins and membrane remodelling: the
  "inner skeleton" line).
- Burns JA, Pittis AA, Kim E (2018). Gene-based predictive models of trophic modes suggest Asgard archaea are not
  phagocytotic. _Nature Ecology & Evolution_ 2:697–704.
- Martijn J, Ettema TJG (2013). From archaeon to eukaryote: the evolutionary dark ages of the eukaryotic cell.
  _Biochemical Society Transactions_ 41:451–457 (the phagocytosing archaeon idea: swallowing before the mitochondrion).
- Lane N, Martin W (2010). The energetics of genome complexity. _Nature_ 467:929–934 (the energy argument: complex
  features such as swallowing after the mitochondrion).
- Pittis AA, Gabaldón T (2016). Late acquisition of mitochondria by a host with chimaeric prokaryotic ancestry.
  _Nature_ 531:101–104 (the mitochondrion late, in a host already complex: the side of the debate that leaves room for
  swallowing first).
- Mills DB (2020). The origin of phagocytosis in Earth history. _Interface Focus_ 10:20200019 (the host before the
  mitochondrion probably could not swallow; swallowing may have arisen late, more than once).
- Natural transformation (free DNA uptake by bacteria and archaea): the encyclopedia ticket cites one review page.
