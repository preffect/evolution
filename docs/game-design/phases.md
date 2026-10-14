# Evolution — Game Design: the game in phases

§14 of the split [`GAME-DESIGN.md`](../GAME-DESIGN.md), which keeps the shared context and the file list.

## 14. The game in phases (tickets #782, #864)

Epic #761; the build is epic #866 (its roadmap comment gives the order). The proposal is ticket #782; the concept sheets are `docs/concept-art/phases/` (PR #788). This section
is the decided design: what the build makes. Numbers marked **(tuning)** are starting values for the build and
for gameplay QA to move; everything else is decided. Nothing here is built yet: until the build epic's "on"
slices land (§14.2.4), [`session.md`](./session.md) describes the game as it plays today.

### 14.1 What the human decided (2026-10-13)

| Ticket      | Answer | Decision                                                                                                                                                                                                                                           |
| ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ticket #784 | A      | **One journey, together.** At 10:00 the whole room leaves the dish for the next world; colonies open in that same world at 17:00; one game of about 25 minutes.                                                                                    |
| ticket #785 | A      | **Colonies start after a big-protist chapter.** From 10:00 to 17:00 you play your form in the new world; many-celled life opens there at 17:00.                                                                                                    |
| ticket #786 | C      | **Seamless.** You never stop playing: the dish's rim dissolves, the new world fades in around you and the camera eases out. Not the recommended pull-back, so the size jump must read without taking control.                                      |
| ticket #787 | A      | **The paramecium and the stentor stay one cell, with real upgrades:** trichocysts and conjugation; anchoring together and regrowth.                                                                                                                |
| ticket #790 | A      | **Keep the kelp shore; each form becomes its sea-water cousin.** Choanoflagellate rosettes join the colony step; the green road needs a sea-water colony in place of Volvox (which colony: _Phaeocystis_, the light road, ticket #901 A, §14.9.1). |

Ticket #786's other options are kept on the concept sheets as "not chosen" (the pull-back storyboard,
`transition-storyboard.png`). The decision tickets called the second world "the pond". Ticket #790's answer puts it
by the sea, so this design calls it **the rock pool** (§14.5). In code and constants it is `pool`.

Two follow-up decisions were answered on 2026-10-14, both **A**: ticket #901, the euglena's colony road is the light
road with _Phaeocystis_ (§14.9.1); ticket #902, the opening dive stays as it is (§14.13).

### 14.2 The shape and the clock

#### 14.2.1 Three eras, one game

```
 0:00                     10:00               17:00                     25:00   25:20
  |------- the dish -------|---- the pool ----|---- the colonies -------|results|-> new game
  one cell climbs the      your form, small    same pool: your road to   20 s     the dish again
  ladder (today's round)   again, among        many cells (or your
                           giants              ciliate's upgrades)
```

| Era id (`GameEra`) | Starts (game time) | Ticks after `roundStartTick` | Where                                | You play                                                                                       |
| ------------------ | ------------------ | ---------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `dish`             | 0:00               | 0                            | the dish: a pocket in the kelp slime | today's round, unchanged: protocell to a form (session.md §5.1)                                |
| `pool`             | 10:00              | 36 000                       | the rock pool (§14.5)                | your form, small again, among the pool's creatures (§14.6); levels deepen tiers                |
| `colonies`         | 17:00              | 61 200                       | the same rock pool                   | your road to a body of many cells (§14.8, §14.9), or your ciliate's upgrades (§14.10)          |
| end                | 25:00              | 90 000                       | results                              | the results screen (`RESULTS_SCREEN_SECONDS`), then a new game from the dish (session.md §5.4) |

- **The clock is the game's, not a player's.** Each era opens for the whole room at its start time, whatever
  anyone has done. Inside an era a player's own triggers still matter: in the colony era your road starts at your
  next level-up after 17:00 (§14.8.6).
- **The round is the game.** `roundPhase` stays `'playing'` from 0:00 to 25:00 (no results screen at 10:00 or
  17:00); `roundTimeLeftMs` counts down the whole game. Ticks are counted from the round's `roundStartTick` (a
  rematch does not start at tick 0).
- **The era is derived, not stored.** One shared pure function, `eraAt(elapsedSeconds, roundDurationSeconds,
balance)` in `packages/shared/src/simulation/` beside `worldReference`, gives the era from the same inputs as
  the round clock. The server's step, the bloom and the HUD all call it, so they cannot disagree. `era` on the
  snapshot is a convenience copy; `eraStartedAtTick` is derived from it.
- **A round shorter than an era's start never reaches it.** An era opens only if it starts before the round's
  end (`ROUND_DURATION_SECONDS`, still set at create time within 60–1800 s). A 600 s round is today's game
  exactly; a 1020 s round ends at the end of the pool era. Tests and short rooms keep working unchanged.
- **The bloom belongs to the dish.** It runs from `ROUND_BLOOM_START_FRACTION` × the dish era's length to the
  dish era's end (8:00–10:00). The dish era ends at the next **in-play** era's start, or at the round's end when
  no later era is in play: with `ERAS_IN_PLAY` = `['dish']` a 1 500 s round keeps its bloom at 20:00–25:00, as
  today's fraction rule gives. The pool and the colony era have no bloom (tuning: add
  one if QA finds the last minutes flat).

#### 14.2.2 The world clock across eras

The world clock (session.md §5.5, ecology/food-and-spawn.md §3.1) keeps running across the eras:

- **World level** keeps climbing one level per `WORLD_LEVEL_SECONDS` (180): about 4.3 at 10:00, 6.7 at 17:00, 9.3
  at 25:00, capped at `MAX_LEVEL`. It sets the wild cells' ladder and the entry floor as today.
- **World mass restarts at each move**, because the move resets every size (§14.3): in the pool,
  `worldMass` = `POOL_WORLD_MASS_START` + `POOL_WORLD_MASS_GAIN_PER_SECOND` × seconds since 10:00 (60 at 10:00,
  270 at 17:00, 510 at 25:00; tuning). World DNA keeps its absolute curve (it is a score scale, not a size).
- **Standing** (`'ahead' | 'with' | 'behind'`) reads against this, unchanged.

#### 14.2.3 The game's length

`ROUND_DURATION_SECONDS` defaults to 1500 once the colony era is on (1020 while only the pool is on, 600 today). The
lobby's create form keeps its 60–1800 s field: a host who wants today's 10-minute game sets 600.

#### 14.2.4 Switching the eras on

Main deploys to the human's game on every merge, so the eras ship behind a balance leaf, as the giants did
(ecology/giants.md §3.5.17): `ERAS_IN_PLAY` lists the eras a game may reach. It must be a prefix of
`['dish', 'pool', 'colonies']`; `debug_set_balance` refuses any other list (a declared non-number leaf with its
validator, the mechanism ticket #907 built: architecture/debug-mcp.md §8). It ships as `['dish']` (today's
game), becomes `['dish', 'pool']` in a "pool on" slice once the pool's world, creatures, move and HUD have
landed, and `['dish', 'pool', 'colonies']` in a "colonies on" slice once the roads have. Each "on" slice also
moves the `ROUND_DURATION_SECONDS` default (§14.2.3). Until then every era is reachable in tests and on a private
stack through the balance patch and `debug_set_era` (§14.13). `debug_set_era` never jumps the tick counter (the
replay log, acks and effect windows are keyed by tick): it moves `roundStartTick` back so that the next step is
the era's first tick, and it is recorded as a `debug_patch`, so `debug_export_replay` reproduces the state hash
across it. Three rules make that safe:

- **Every crossed move runs, in order.** Each step runs every move whose start lies in (the previous step's elapsed
  time, this step's elapsed time], in era order. A jump from the dish to `colonies` therefore runs the pool's move
  (§14.4.2, all nine steps) and then the colonies' move (§14.4.5) on the same tick; the colony era never opens in
  the dish. The same rule covers an ordinary step, which crosses at most one start.
- **No way back.** `debug_set_era` refuses an era earlier than the current one (and the current one); to start
  over, a new round.
- **`roundStartTick` may be negative.** A jump early in a round moves it below zero (PH19's jump at tick 600 to the
  pool gives 600 − 36 000 = −35 400). That is allowed: nothing on the wire or in the round clock requires it to be
  non-negative, and the contract says so.

### 14.3 What carries over and what resets

| At each move (10:00 and 17:00)                 | Carries over | Notes                                                                                                                                  |
| ---------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Form and its tier, every trait                 | yes          | the move at 10:00 completes a cell that has no form (§14.4.3)                                                                          |
| Level, DNA toward the next level, tag points   | yes          | your DNA's leaning keeps weighting your drafts                                                                                         |
| Colour, name, seat                             | yes          |                                                                                                                                        |
| Score (`dnaCumulative`, absorptions)           | yes          | it keeps adding up for the whole game; one leaderboard                                                                                 |
| Life state                                     | yes          | a player spectating at the move respawns in the new era by the entry rule (§14.7.3)                                                    |
| **Size (mass)**                                | **no**       | 10:00: every player arrives at `POOL_ARRIVAL_MASS`, the same for all five forms. 17:00: nothing resets; the colony era opens in place. |
| Position                                       | scaled       | 10:00: your dish position divided by `ERA_SCALE_STEP` (§14.4.2). 17:00: unchanged.                                                     |
| An engulf in progress, a sprint, a draft offer | partly       | 10:00: engulfs end with no transfer (both cells go free) and sprints end; an open draft offer stays open                               |
| The dish's wild cells, giants and food         | no           | they become green specks in the pool (§14.4.2); the pool seats its own wild cells                                                      |

Why size resets: the real sizes of the five forms differ about 40-fold (a euglena is about 50 µm, a stentor up to 2
mm), and the pool is a world of things bigger than you. Arriving equal is fair, and arriving small is the point.

### 14.4 The move: dish to pool, seamless (ticket #786 C)

You keep control the whole time. The size jump is read from what the world does around you, never from a cut.

#### 14.4.1 The timeline

| Game time     | The player               | What happens                                                                                                                                                                                                                               | Who owns it                       |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| 9:40          | plays                    | the fastest form arrives (session.md §5.1)                                                                                                                                                                                                 | —                                 |
| 9:50          | plays                    | **the warning**, `ERA_MOVE_WARNING_SECONDS` before: a toast `THE DISH IS BREAKING UP`; the rim thins and brightens; the pool's moving light starts to show through the dark field at low strength; the music swells (`era_warning` effect) | HUD, render                       |
| 10:00.0       | plays                    | **the move**, one tick (36 000): the simulation is now in the pool (§14.4.2); `era_moved` effect                                                                                                                                           | server                            |
| 10:00–10:01.5 | plays                    | **the rim dissolves**: the dish wall breaks into fragments that drift outward and fade over `ERA_MOVE_RIM_DISSOLVE_SECONDS`                                                                                                                | render                            |
| 10:00–10:02   | plays                    | **the pool fades in** round you over `ERA_MOVE_POOL_FADE_SECONDS`: water, light shafts, the floor's films, algal threads                                                                                                                   | render                            |
| 10:00–10:04   | plays                    | **the camera eases out**: the shared camera is remapped by the scale step on the move tick, then zooms out to the pool's view over `ERA_MOVE_CAMERA_EASE_SECONDS` (§14.4.4)                                                                | shared camera (server and client) |
| 10:00–10:08   | plays, nothing hunts you | **the grace**: for `ERA_MOVE_GRACE_SECONDS` nothing targets a player and no engulf of a player cell starts                                                                                                                                 | server                            |
| 10:00–10:05   | plays                    | **the caption**: `YOUR DISH WAS ONE POCKET OF SLIME ON A KELP BLADE` for `ERA_MOVE_CAPTION_SECONDS`, with the scale bar (§14.4.4)                                                                                                          | HUD                               |
| 10:00–10:12   | plays                    | **the footprint**: the old dish's outline stays in the pool as a faint dotted ring for `ERA_FOOTPRINT_RING_SECONDS`, then fades                                                                                                            | render                            |

There is no input lock at any point. A draft offer open at 10:00 stays open and can be picked during the move.

#### 14.4.2 What the simulation does on the move tick

All on the pool era's first tick (36 000 after `roundStartTick`), in this order, deterministic. New random streams
(docs/determinism/random-streams.md §3), each forked from the round seed by its own label: `eras` (the gift's draw,
the landmark's bearing), `pool` (the layout, swarm placement and respawn points, the surge's direction) and
`pool_creatures` (creature placement, their minds, the copepod's lanes).

1. **End what cannot cross.** Every engulf in progress ends with no mass or DNA moving (predator and prey both go
   free); every sprint ends; every held list empties (the bacteria an archaeon's arms hold, early-life.md §15.4.2) with
   no payout, no credit and no `eat`, before step 6's gift, so a cell the gift makes a eukaryote has nothing left to
   swallow.
2. **Fill the pool** (§14.5): its food, wild seats and creatures. Its **layout** (films, threads, the bank, the
   light patch's orbit) is not built here: it is drawn from the `pool` stream at the round's start, whenever the pool
   is in play, and sent to the client with the warning (§14.4.6), so the client has the pool's layer baked before
   this tick. The radius is `DISH_RADIUS` (the arena does not change size; the scale step gives the size jump).
3. **The footprint.** The dish maps onto a disc at the pool's centre: a dish point `p` becomes pool point
   `p / ERA_SCALE_STEP`. The footprint's radius is `DISH_RADIUS / ERA_SCALE_STEP` = 300 wu.
4. **The leftovers.** Each dish wild cell and giant becomes one green speck (§14.5.2) of mass
   `ERA_LEFTOVER_SPECK_MASS` at its mapped point: the world you just left is a mouthful. The dish's motes vanish
   (too small to see at the pool's scale).
5. **The players.** Each living player's cell moves to its mapped point at mass `POOL_ARRIVAL_MASS`, keeping its
   heading and its velocity divided by `ERA_SCALE_STEP`. Cells that now overlap separate by the ordinary rule
   (ecology/mass-and-movement.md §5.3) over the next ticks. They arrive at the same mass, but eating the leftover
   specks soon makes some heavier, so the grace (step 8) is what keeps players from engulfing each other at once.
6. **The no-form gift** (§14.4.3).
7. **The landing.** Nothing hostile and no swarm is placed within `ERA_LANDING_CLEAR_RADIUS` of the pool's centre,
   except the **landmark** (§14.6.3): one rotifer at landmark size, anchored at `ERA_LANDMARK_DISTANCE` from the
   centre, due east or due west (the `eras` stream picks which), so it lies along a landscape screen's wide axis.
8. **The grace** starts: for `ERA_MOVE_GRACE_SECONDS` no pool creature or wild cell chooses a player as a target,
   and no engulf of a player cell starts, whoever the predator (players included). Cells may still bump; the
   rotifers' pull is off.
9. **The camera and the wire.** Every viewer camera, the server's (it culls with it) and the client's, is remapped
   by one shared function, `remapCameraAcrossMove(state, ERA_SCALE_STEP)`: x, y and the view's half-height are
   divided by the scale step (§14.4.4). The server's viewer camera is a history (`interestAreaOf` unions the last
   `INTEREST_CAMERA_HISTORY_BROADCASTS` states, `serialize/viewer-cameras.ts`): **every** state in it is remapped,
   so no dish-coordinate rectangle stays in the union. The client swaps the dish's layers for the pool's in place
   (§14.4.6): it never rebuilds the renderer and never re-parks the camera. The move tick sends every viewer a full `game_state` (as
   `SNAPSHOT_PUSH.replaced`), not a delta: the own-cell predictor rebases instead of blending a 1 000-wu
   correction, and the interpolation buffer restarts, so other cells do not streak from dish to pool coordinates.
   The full state also carries the move's churn (every dish mote gone, the pool's spawned) in one message.
   The contract writes this into architecture/wire-contract.md §4 and architecture/client.md §5.

#### 14.4.3 No form at 10:00: the DNA you ate picks it

A player who has no form at the move gets one, with every trait it needs, as a gift on the move tick:

- **The form** is the one its tag points lean toward: the form whose tags' **mean** tag points are highest (amoeba
  `predatory motile`, paramecium `motile`, euglena `sensory photic`, diatom `armored`, stentor `toxic metabolic`),
  ties broken by the order amoeba, paramecium, euglena, diatom, stentor. The mean, not the sum: with a sum the
  two-tag forms always win, and the amoeba (`predatory motile`) beats the paramecium (`motile`) for every player,
  so the paramecium could never be gifted. A player with only `motile` points gets the paramecium (scenario PH16).
  A player with no tag points gets the form the `eras` stream draws.
- **The missing traits**, at tier I: every stage gate the cell lacks (read from `STAGE_GATE_TRAITS` at build time;
  for an endosymbiont, the one the form needs, else the mitochondrion, and simply the mitochondrion once ticket #865
  reorders the ladder, with no change here: early-life.md §15.8.7) and the form's own requirement (`cytoskeleton`, `cilia`, `chloroplast`, `cell_wall` or
  `toxin_vacuole`), then the form.
- **Level and DNA do not change.** The gift is traits, not levels; it never scores. The HUD shows the form popup
  for it as for a picked form (ui/overlays.md §3.8).

#### 14.4.4 Making the jump readable without taking control

The risk ticket #786 named: with no pull-back, "you would not see that you had grown out of a drop". Five cues
carry it, all while you steer:

1. **The camera eases out, and it is the game's one camera.** There is no second, render-only magnification: the
   ease is the shared camera (`packages/shared/src/camera/camera-follow.ts`), which the server also culls with.
   On the move tick `remapCameraAcrossMove` divides its x, y and view half-height by `ERA_SCALE_STEP`, so the
   footprint lies exactly where the dish's rim was on screen. Then, for `ERA_MOVE_CAMERA_EASE_SECONDS`, the
   camera's zoom smooths toward the pool's `viewHalfHeightFor(radius)` with time constant
   `ERA_MOVE_CAMERA_ZOOM_SECONDS` instead of `CAMERA_ZOOM_SECONDS` (one ease, not two; both constants are shared).
   **The real numbers**, at today's camera: a dish cell of mass 500 (radius 89 wu) sees a half-height of about
   671 wu, so the remapped camera starts at about 67 pool wu; the arriving cell (mass 60, radius 31 wu) sees about
   395 pool wu. The net zoom-out is about **5.9×**, not 10×: the arriving cell is smaller, so the camera comes back
   in part of the way. What the player sees is the read that matters: before the move the dish's rim was far off
   screen (the dish is 3 000 wu across and the view about 1 340 wu tall); after it, the **whole dish fits on one
   screen**, its outline filling about three quarters of the view's height. Your whole old world, which you could
   never see at once, is now one view. Graphics QA judges the read on these numbers (ticket #874).
2. **Your cell does not pop.** The remap alone would draw your cell about 3.5 times bigger on the move tick (its
   radius shrank by 2.9 while the view shrank by 10). Over the ease every player cell's drawn radius goes from its
   dish radius / `ERA_SCALE_STEP` (in pool units) to its true radius. This is drawing only: the simulation already
   has the arrival size, culling reads true radii, and the grace keeps the difference harmless.
3. **The footprint ring and the leftovers.** The dish's outline stays as a dotted ring with the green specks that
   were its wild cells inside it: the whole dish, its giants included, is now a handful of crumbs.
4. **The landmark.** A rotifer as wide as the footprint (§14.6.3) sits beside it along the screen's wide axis, its
   crown spinning: the image of the pull-back storyboard's frame 4, delivered without the pull-back.
5. **The caption and the scale bar.** The caption names what the dish was (the opening dive's story, epic #795: a
   pocket of water in the slime on a bull kelp blade, and the blade lies in this pool). A scale bar under it,
   labelled `THE DISH`, is as long on screen as the footprint's diameter at the camera's current zoom, capped at
   `ERA_SCALE_BAR_MAX_SCREEN_FRACTION` of the screen's width: it starts at the cap (the dish is wider than the
   screen) and visibly shortens as the camera eases out, ending as wide as the ring. No micrometres: the game's sizes are relative
   (§14.6.1), and the encyclopedia holds the real ones.

The sound (owned by the audio designer, docs/AUDIO.md): a rising swell from the warning, a soft burst as the rim
dissolves, then the pool's ambience bed.

#### 14.4.5 The move at 17:00

The colony era opens in place: no world change, no size reset, no grace. A toast `MANY-CELLED LIFE IS POSSIBLE NOW`
and the `era_moved` effect; the wild colonies start to appear (§14.11); the HUD's era chip changes (§14.12.2).

#### 14.4.6 The pool's layer is ready before the move

The renderer is built per seed and bakes its textures one step per animation frame (rendering/budget.md §7.2,
tickets #479 and #603); a new build's first visible frame costs about 1 s on SwiftShader, and a build parks the
camera on its first frame. The move keeps the seed, so it must not rebuild:

- **The layout exists from the round's start.** The server draws the pool layout from the `pool` stream at the
  round's start when the pool is in play (its own stream, so drawing it early changes nothing else).
- **It travels with the warning.** On the warning tick (`ERA_MOVE_WARNING_SECONDS` before the move) the snapshot
  carries the pool layout view for the first time; any later `game_state` carries it too, so a client that joins
  after the warning, or reconnects, has it.
- **The client bakes during the warning.** On receiving the layout, the client builds the pool's layer (water,
  films, threads, the bank, the light patch) into the **existing** renderer across the 10 s warning, hidden.
- **The move swaps in place.** On the move's `game_state` the client hides the dish's layers and shows the pool's,
  in the same renderer, with the camera remapped (step 9), no rebuild and no park. The fade (§14.4.1) plays on that
  swap. A client that first builds its renderer during the pool era builds it with the pool layer directly.

The contract (ticket #867) writes the layout view's timing into wire-contract.md §4 and client.md §5; ticket #875
owns the in-place pool layer.

### 14.5 The rock pool (the second world)

#### 14.5.1 Where it is

The opening dive (rendering/opening-dive.md) falls from orbit onto a rocky shore near Victoria, a bull kelp, a
drop of spray and a pocket of water in the slime on the kelp's blade: that pocket is the dish. One step of ten up
is the pool where that blade lies: **a rock pool high on the shore**, filled by waves and spray. Its water is sea
water that the sun warms and the rain freshens, so the things that live there are hardy. The real pool is
centimetres to metres across; the game's pool is one screen-scaled arena, as the dish is.

#### 14.5.2 The world

| Thing                   | What it is (sea-water name)                                         | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The arena               | the pool                                                            | a disc of radius `DISH_RADIUS` (3 000 wu), decided: the arena keeps its size and its 25 readers of `DISH_RADIUS` stay as they are, since the scale step already gives the size jump. Walls, separation and engulf are unchanged                                                                                                                                                                                                                     |
| **Green specks**        | green swimmers, _Dunaliella_ (sea-water cousins of _Chlamydomonas_) | the pool's main food: a mote kind (`green_speck`) of mass `POOL_GREEN_SPECK_MASS`, in swarms of `POOL_SWARM_SIZE` that drift toward the light patch at `POOL_SWARM_SPEED`; the field holds `POOL_SWARM_COUNT` swarms, a swarm respawns at a random point when it is eaten down to a quarter                                                                                                                                                         |
| **The light patch**     | sunlight through the water                                          | a disc of radius `POOL_LIGHT_PATCH_RADIUS` that circles the pool once per `POOL_LIGHT_PATCH_PERIOD_SECONDS`; it is the pool's `sunlit_shallows` zone (ecology/food-and-spawn.md §2): the Chloroplast and the Euglena's light rules work inside it. Its centre is a pure function of the tick and the layout's orbit, so `zoneAt` in shared code becomes era- and tick-aware (the dish keeps its annulus)                                            |
| **Bacteria films**      | the slime on the pool's floor                                       | `POOL_FILM_COUNT` discs of radius `POOL_FILM_RADIUS`, fixed per game: a cell moving at under half its top speed over a film gains `POOL_FILM_GRAZE_MASS_PER_SECOND`; the films are where wild collar cells become rosettes (§14.11) and, in the colony era, where small amoebae live (§14.9.2)                                                                                                                                                      |
| **Algal threads**       | _Cladophora_, branched green threads of rock pools                  | `POOL_THREAD_COUNT` fixed bands of length `POOL_THREAD_LENGTH` and width `POOL_THREAD_WIDTH`: a cell inside a band with mass at most `POOL_THREAD_COVER_MAX_MASS` is hidden (no hunter's sight picks it as a target) and moves at `POOL_THREAD_SPEED_FACTOR`; a heavier cell passes through at full speed and is not hidden. Threads are cover, not walls. For the spatial hash and the interest cull each band is a segment with a bounding radius |
| **The surge**           | a wave washing over the pool's rim                                  | every `POOL_SURGE_PERIOD_SECONDS` a surge of `POOL_SURGE_SECONDS` pushes every cell and mote along one direction (drawn from the `pool` stream) at `POOL_SURGE_SPEED`, added to its own velocity; `POOL_SURGE_WARNING_SECONDS` before, ripples cross the view from that side (`surge_warning` effect). Anchored cells (§14.10.2) and anchored rotifers are not moved. A surge never starts during the grace                                         |
| Detritus, DNA fragments | as in the dish                                                      | unchanged kinds; their spawn rates are tuning for the pool's DNA pace (§14.7.1)                                                                                                                                                                                                                                                                                                                                                                     |
| **The bank**            | the wet rock at the pool's edge                                     | the band of width `POOL_BANK_WIDTH` inside the wall: only the gathering road uses it (§14.9.2)                                                                                                                                                                                                                                                                                                                                                      |

#### 14.5.3 The pool's forces in the shared movement step

The client predicts its own cell with the shared movement step (`packages/shared/src/simulation/movement-step.ts`,
which today resolves only the gel). Every pool force that changes a cell's velocity therefore lives in that shared
step, and its inputs are on the wire; otherwise a surge alone (90 wu/s for 4 s) mispredicts by up to 360 wu and
snaps the pose every 45 s.

| Force                          | In the shared step as                                                    | Its inputs on the wire                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The surge                      | an added velocity while the tick lies inside the surge                   | `surge: { startedAtTick, directionX, directionY }` or null on the snapshot, set the tick its warning starts                                                                     |
| The algal threads' slow-down   | a speed factor while the cell's centre lies in a band under the mass cap | the pool layout, a static view (films, threads, the bank, the light patch's orbit) first sent on the warning tick and then in every `game_state`, beside `gelPatches` (§14.4.6) |
| The rotifers' pull             | a shared formula over the rotifers' positions and radii                  | the rotifers are cells on the snapshot already; the pull reads their species and skips the landmark (`isLandmark`, §14.6.3)                                                     |
| An anchored stentor (§14.10.2) | zero velocity                                                            | `isAnchored` on the cell view                                                                                                                                                   |
| The nematode's knock           | not predicted: a rare, short server correction the predictor absorbs     | —                                                                                                                                                                               |

The light patch's centre is a pure function of the tick and the layout, so it needs no per-tick field.

#### 14.5.4 Wild cells in the pool

The pool has `WILD_CELL_COUNT` (24) wild seats, as the dish does, with the dish's wild-cell minds (ecology/wild-cells.md
§3.3), sized around the pool's `worldMass`:

- **20 form seats**, four of each form, wearing that form's sea-water cousin or counterpart (§14.12.3): seat `i` is the form
  `i mod 5`. Their build is the form plus the world's ladder, extended past today's lists so that a wild form at
  world level 9.3 (25:00, the highest the world reaches) deepens its tiers: the lists need to reach level 10, not 18 (`WILD_CELL_BUILDS` grows per form; the wild cells ticket owns the lists).
- **4 collar-cell seats**: wild choanoflagellates (§14.11), single cells that graze bacteria and flee.
- The dish's rule that wild cells hunt players only from the endosymbiosis era stays satisfied: the world is past it.

### 14.6 The pool's creatures

#### 14.6.1 Sizes are relative to your arriving form

Every creature is sized against a form arriving at `POOL_ARRIVAL_MASS` (radius 31 wu, written 1×), except the
landmark (§14.6.3). Real sizes go to
the encyclopedia, in words. The pool's creatures are seats with a species, built the way a giant is
(ecology/giants.md §3.5.2: an ordinary record with a species, its own seat list and respawn), except where the table
or §14.6.4 says otherwise. Each one shows a real-life fact popup the first time you eat it or it eats you, and has an
encyclopedia page.

| Creature (`PoolCreatureSpecies`) | Sea-water species, real size                                                                                                   | Count            | Game size                                                           | Moves                                                                                                                                                                     | Role and rule                                                                                                                                                                                                                                                                                                                                                                                                                                       | Can you eat it?                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Didinium** (`didinium`)        | _Didinium_, a barrel-shaped hunting ciliate; its sea species include _D. gargantua_. About 0.1–0.2 mm                          | `DIDINIUM_COUNT` | mass `DIDINIUM_MASS` (1.2×)                                         | fast, `DIDINIUM_SPEED`                                                                                                                                                    | **the ciliate hunter.** It hunts only ciliates: cells with the paramecium or the stentor form (players and wild), any it can engulf by the ordinary ratio. It ignores every other form. **Trichocysts do not stop it** (§14.10.1); its source is to be checked (§14.10.1)                                                                                                                                                                           | yes, by the ordinary ratio; payout `POOL_CREATURE_DNA_BONUS` + its fact |
| **Rotifer** (`rotifer`)          | _Brachionus plicatilis_, the sea-water rotifer fish farms raise as food: an animal of about a thousand cells. About 0.1–0.3 mm | `ROTIFER_COUNT`  | mass `ROTIFER_MASS` (2.8×)                                          | anchored on the floor; it never moves (real _Brachionus_ swims and attaches only briefly by its foot: the encyclopedia says so, as giants.md does for the steered diatom) | **the whirlpool.** Its crown pulls every cell and mote within `ROTIFER_PULL_RANGE_RADII` of its own radius toward it at `ROTIFER_PULL_SPEED` (added to their velocity; a cell swimming away at full speed escapes, a slowed or engulfing one is dragged). It swallows any cell of mass at most `ROTIFER_SWALLOW_MAX_MASS` that touches it, at once (no wrap, so trichocysts never fire against it). It eats motes it pulls in                       | yes, by the ordinary ratio (late in the pool era); bonus + fact         |
| **Nematode** (`nematode`)        | sea-floor roundworms, the commonest animals on the sea bed. About 0.3–2 mm long                                                | `NEMATODE_COUNT` | a worm `NEMATODE_LENGTH` long, `NEMATODE_THICKNESS` thick (5× long) | thrashes along a wavy path at `NEMATODE_SPEED`, turning at walls                                                                                                          | **the thrasher.** It never eats a cell (it grazes the films). Touching it knocks a cell aside at `NEMATODE_KNOCK_SPEED` and ends any engulf that cell is in (both go free)                                                                                                                                                                                                                                                                          | no                                                                      |
| **Copepod** (`copepod`)          | _Tigriopus californicus_, the red copepod of high rock pools on this coast. About 1 mm                                         | one at a time    | `COPEPOD_LENGTH` long (20×)                                         | crosses the pool in a straight lane at `COPEPOD_SPEED`, one pass every `COPEPOD_PASS_INTERVAL_SECONDS`                                                                    | **the passing giant.** `COPEPOD_WARNING_SECONDS` before a pass its shadow and lane show (`copepod_warning` effect). In its lane (width `COPEPOD_LANE_WIDTH`) it eats every cell and mote whose mass lies in its **window**, `COPEPOD_EATS_MIN_MASS` to `COPEPOD_EATS_MAX_MASS`, whole; a body of many cells in the window loses `COPEPOD_BITE_CELLS` cells (§14.8.3). Smaller things slip past its mouthparts and bigger ones are too big to handle | no                                                                      |

**Why a window, not "small things vanish".** The proposal had Daphnia sieve everything small. Daphnia is a freshwater
animal; the sea's equivalent grazers are copepods, and the real copepod pattern is a size window: they catch poorly
what is very small (ciliates eat those) and cannot handle what is very large, which is exactly why _Phaeocystis_ and
the chain diatoms change their size when grazers are about (Long et al. 2007; Bergkvist et al. 2012; Nejstgaard et al.
2007). The window makes the copepod the hazard that the light road and the glass road are built to beat (§14.9).

#### 14.6.2 Placement and respawn

Placed on the move tick outside `ERA_LANDING_CLEAR_RADIUS`, except the landmark (§14.6.3), from the `pool_creatures`
stream. An eaten Didinium
or rotifer comes back after `POOL_CREATURE_RESPAWN_SECONDS`, well away from every player, as a giant does
(ecology/giants.md §3.5.9). Creatures are outside the wild cells' carrying capacity and never starve. The first
copepod pass comes `COPEPOD_FIRST_PASS_SECONDS` after the move, so the grace and the first minute stay calm.

#### 14.6.3 The landmark

One rotifer at landmark size: radius `ERA_LANDMARK_RADIUS` (the footprint's radius, 300 wu), drawn and collided at
that radius, anchored at `ERA_LANDMARK_DISTANCE` (650 wu) from the centre, due east or due west. Its near edge is then
350 wu from the centre, inside the arriving view's half-width (about 700 wu on a 16:9 screen) for every player in
the footprint. It has **no pull**: a pull scaled to its size (3 × 300 = 900 wu) would cover the whole footprint,
vacuum the leftover crumbs of cue 3 and sit for the whole game as a mote sink beside where everyone lands. It eats
only the motes that touch it, never a cell, and nothing can eat it: it is the scale reference, the one thing in
view as wide as your whole old dish. Its creature view carries `isLandmark`, and the shared movement step's
rotifer pull (§14.5.3) skips any rotifer with it, so the client's prediction leaves cells near it alone. The roaming rotifers are drawn smaller for play. It stays for
the whole game.

#### 14.6.4 Shapes, and deaths without a killer cell

The simulation's contact, the spatial hash (300-wu cells) and the interest cull assume one centre and one radius.
Two creatures are not circles:

- **The nematode** is a chain of `NEMATODE_SEGMENT_COUNT` circles of radius `NEMATODE_THICKNESS` / 2 along its wave;
  contact tests against each circle, the hash and the interest reach use its bounding radius.
- **The copepod** has no body. Each tick of a pass, the strip of its lane it crosses that tick (a rectangle) is tested
  against the hash by its bounding box. It is on the snapshot as a lane view (`{ startX, startY, directionX,
directionY, startedAtTick }`) sent to every viewer, as the surge is, so the client draws the shadow and the lane.

**Deaths to the copepod and to a rotifer's swallow.** No player is credited: no absorption, no leaderboard change, no
mass or DNA to anyone. The victim's `spectatingCellId` is the rotifer's cell for a swallow (the camera follows it as it
does a killer) and null for the copepod (`followTargetIn` gives no target, so the camera holds where the cell died).
The respawn line names the creature (`EATEN BY A COPEPOD`, `SWALLOWED BY A ROTIFER`, ui/overlays.md §3.3). The
Didinium's kills are ordinary engulfs with the Didinium as the killer.

### 14.7 Progression across eras

#### 14.7.1 The pace

The ladder's levels go on (PROGRESSION.md §2). Targets for one active player (gameplay QA measures them; the DNA
income per era is tuning):

| Game time | Level (fast player) | What it is                                                                          |
| --------- | ------------------- | ----------------------------------------------------------------------------------- |
| 9:40      | 5                   | a form (unchanged, decision #138)                                                   |
| 17:00     | 8–9                 | the pool era deepened the form to tier II or III and added the remaining organelles |
| 24:00     | 15–16               | the road's last step (§14.9) or the ciliate's last upgrade tier (§14.10)            |

- **One cap: `MAX_LEVEL` rises from 12 to 18** in the "colonies on" slice (ticket #897), with its PROGRESSION.md §6
  row; there is no second cap constant, since `MAX_LEVEL` already feeds the world clock's cap, the wild builds, the
  own-cell indicators and the encyclopedia. The cost formula `levelUpCost` is unchanged (level 18 at 3 740
  cumulative DNA).
- **The pool era's draft** is today's: tiers and remaining organelles, weighted by tags. Nothing new is offered in
  the pool era; it is where the forms' tier II and III, which no 10-minute round reaches today, get seven minutes
  of real play.
- **The colony era's draft** reserves one card for the road's next step (§14.8.6).

#### 14.7.2 Endosymbiosis after the dish

The endosymbiont unlock counts bacteria eaten in the dish. The pool has no bacteria motes, so from the move on both
endosymbionts count as unlocked for every player (a waiver, not a gift: they are still picked from a draft).

#### 14.7.3 Entering a later era (late join and respawn)

The entry rule (PROGRESSION.md §5) runs unchanged on the era's own `worldMass` and `worldDna`, plus:

| Era        | A late joiner or a respawn enters as                                                                                                                                                                                                                                                                    | Mass                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `dish`     | today's rule                                                                                                                                                                                                                                                                                            | today's                                                                          |
| `pool`     | **a form.** A respawn keeps its own. A late joiner is lifted to the world's level with drafts queued, as today; if it owns no form on the tick its queued drafts are used up (picked or timed out), it gets the no-form gift (§14.4.3) on that tick. Until then it plays its drafts as any joiner does. | `clamp(ENTRY_MASS_FRACTION × worldMass, POOL_ARRIVAL_MASS, POOL_ENTRY_MAX_MASS)` |
| `colonies` | **four cells**: a body at its road's step 3 (§14.9; the ciliates: the form with its first upgrade at tier I, §14.10), plus the pool rule above for the form                                                                                                                                             | the step's floor mass (§14.9)                                                    |

Death in the colony era (§14.8.4) respawns the same way: a body of four cells, never less, and never more than you had.

### 14.8 The colony era: a body of many cells

The common rules for every road. The roads themselves are §14.9.

#### 14.8.1 What a body is

A body is one entity in the simulation, as a cell is, with:

| Field          | What                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `road`         | `light`, `gathering` or `glass` (from the form: euglena, amoeba, diatom)                               |
| `roadStep`     | 1–6; step 1 is your single-cell form                                                                   |
| `cellCount`    | the cells it has now (a step sets the count it grows back to; bites take cells away)                   |
| `jobs`         | how many cells hold each of the road's jobs (§14.9), each capped at `BODY_JOB_CAP`                     |
| `spareLives`   | from the road's spare-life job                                                                         |
| mass, position | as a cell's; its radius follows the mass curve as today, so the size refuge is the ordinary mass ratio |

The traits it had as a single cell stay and keep working on the body (a tier III Euglena eyespot still pulls food;
a body is the same organism, grown). The architect folds this into the entity model (§14.13).

**This supersedes build 2's reserved colony hooks.** controls-and-scope.md §11 reserves `Cell.organismId` ("grouping
key for colonies"), `GameSessionConfig.mode: 'colony'`, the mitosis constants, `GameInput.shouldSplit` and
`CellState.dividing`. A body here is one entity with a cell count, never several cells grouped by an id, so none
of those hooks builds it. The bodies contract (ticket #884) retires each of them or says what it is kept for, in
§11 itself, so nobody builds colonies from `organismId`.

**Steps and jobs are not traits.** A road step is body state and a job is a count up to `BODY_JOB_CAP`, not a tier.
The draft's offer becomes a card union, `trait | roadStep | job`; only the four ciliate upgrades (§14.10, tiered) are
rows of the trait catalog.

#### 14.8.2 Steering

You steer the whole body with the pointer, exactly as today. The body turns as one: its heading turns at most
`BODY_TURN_DEGREES_PER_SECOND` / (1 + `cellCount` / `BODY_TURN_CELL_SCALE`) degrees a second, so a wider body turns
slower. Its top speed is `CELL_BASE_SPEED` × the step's speed factor (§14.9) × its traits, as today.

Both live in the shared movement step (`packages/shared/src/simulation/movement-step.ts`), as the pool's forces do
(§14.5.3): the turn cap and the step's speed factor are applied there, reading `cellCount`, `road` and `roadStep`
from the cell view (§14.8.1) and the road step table from the shared constants. Otherwise every turn a body makes
mispredicts and blends a correction, more the wider the body. The broken chain's per-piece state (§14.9.3) is
server-only and does not move the body, so it needs nothing here. Scenario PH20.

#### 14.8.3 A bite takes a cell, not your life

- **Bodies are bitten, never swallowed whole.** A predator (any cell, body or creature) that could engulf the body
  by the ordinary mass ratio takes `BODY_BITE_CELLS` cell per touch instead, at most once per
  `BODY_BITE_COOLDOWN_SECONDS` per predator. The body loses `mass / cellCount` per cell taken and the highest-count
  job's cell first (its job goes with it, so a bite costs you a power); the predator gains it as a small absorption
  (ecology/absorption.md §6).
- **The size refuge.** A predator that cannot engulf the body by the ratio cannot harm it at all. This is the real
  reason colonies won: they escaped what ate them (Herron et al. 2019).
- **Cells grow back.** A body below its step's count regains one cell every `BODY_CELL_REGROW_SECONDS` while its mass
  is at least its step's floor (§14.9). (The gathering road regrows by recruiting instead, §14.9.2.)
- A body bites other bodies the same way and engulfs single cells whole, as today.

#### 14.8.4 Down to one cell, and death

A body that falls to one cell is your single-cell form again (step 1), with its mass and traits: fragile, and
engulfable whole. If that cell is engulfed you die and respawn by §14.7.3. A body with a **spare life** (§14.9) that
falls to one cell instead continues at once at the same spot as the step below the one it had, using the spare
life (`body_spare_life_used` effect).

#### 14.8.5 Score

Bites score as absorptions of their mass (no `SCORE_ABSORPTION_BONUS`: a bite is not a kill). Killing a body down to
its last cell and engulfing it is one absorption, as today. The gathering road's fruiting finale scores on top
(§14.9.2).

#### 14.8.6 The colony era's draft

From the first level-up after 17:00:

- **One card is reserved for the road's next step** (the rung card's rule, core.md §3), as long as one is left.
  Taking it grows the body to the step: its cell count, its floor mass (a mass below the floor is raised to it), its
  speed factor and its look.
- **The other two cards** are the road's job cards and the remaining trait tiers, weighted by tags as today.
- A player can decline the step for jobs and come back to it at the next level-up. The step is never forced: a
  euglena that wants to stay one cell may, and is a fast, small target.
- The ciliates' reserved card is their next upgrade (§14.10).

### 14.9 The three roads

Each road is how life really did it, with the honest caveat in its encyclopedia page. Step counts and floor masses
are game values (tuning); the real numbers are in the "real" column and the encyclopedia.

#### 14.9.1 The light road (the euglena): _Phaeocystis_, a sea-water colony of light-fed cells (ticket #901 A)

Decided on ticket #901 (answer A): the euglena's road is the light road below. Not chosen: B, keeping the green road's
volvocine balls with a fresh-water caveat, and C, a fresh-water pool for this one road.

The green road's freshwater ladder (Tetrabaena, Gonium, Pandorina, Eudorina, Volvox) cannot stay: every volvocine
alga lives in fresh water, not only Volvox. The sea's own colony of light-fed swimmers is **_Phaeocystis_**: single
swimming cells of 4–6 µm that, when small grazers are about, build balls of cells in a shared skin of mucus, up to
about 3 cm across, big enough to see with your eye (Long et al. 2007). Each size is a refuge from a different grazer:
single cells are eaten by ciliates, mid-sized colonies by copepods, and the biggest balls are too big for most grazers
to handle (Nejstgaard et al. 2007). That is the road's whole game: grow through the copepod's window as fast as you
can. The road is renamed **the light road**: a _Phaeocystis_ colony is golden-brown, not green; in the game it is drawn
in your colour like every player body.

| Step | Name           | Cells (game) | Floor mass | Speed factor | Real                                                                    |
| ---- | -------------- | ------------ | ---------- | ------------ | ----------------------------------------------------------------------- |
| 1    | your euglena   | 1            | —          | 1            | a single light-fed swimmer                                              |
| 2    | a stuck pair   | 2            | 150        | 0.95         | a game step, no species                                                 |
| 3    | four in a skin | 4            | 250        | 0.9          | a young _Phaeocystis_ colony: a few cells in a mucus skin               |
| 4    | a small ball   | 16           | 450        | 0.85         | tens of cells; in life too big for ciliates to eat                      |
| 5    | a hollow ball  | 64           | 900        | 0.8          | hundreds of cells round a hollow middle; **in the copepod's window**    |
| 6    | a great ball   | 256          | 1 700      | 0.75         | thousands of cells, millimetres to centimetres across; past the copepod |

| Job (card)       | Effect per job cell (cap `BODY_JOB_CAP`)                                                       | Real                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Light cell**   | `LIGHT_CELL_MASS_PER_SECOND` mass gained while the body is in the light patch                  | the colony's cells photosynthesise                      |
| **Mucus cell**   | a predator needs `MUCUS_CELL_RATIO_BONUS` more than the mass ratio to bite (cap 4 cells: +0.2) | the mucus skin is the colony's defence                  |
| **Swarmer cell** | one spare life (§14.8.4); a used swarmer cell is gone                                          | colonies release swimming cells that start new colonies |

Caveats for the encyclopedia: Euglena itself never did this, and _Phaeocystis_ is no relative of it (it is a
haptophyte; they share only a life fed by light). Real colonies drift with the water; in the game you steer
(the human's ruling on the giant diatom, ecology/giants.md §3.5.16, applies: not moving would not be fun).

#### 14.9.2 The gathering road (the amoeba): come together, _Dictyostelium_

Come together instead of staying together (Bonner 2009). Unchanged from the proposal except where it now happens:
the slug crawls out of the pool onto the wet rock of the bank to fruit, which is where social amoebae really live
(damp soil and leaf litter, not the sea).

- **The ability key calls** (§14.12.1): a signal ring of radius `CALL_RADIUS` goes out (`CALL_COOLDOWN_SECONDS`).
  Every **small amoeba** inside it streams toward you at `CALL_STREAM_SPEED` and joins on touch (+1 cell, its mass
  added), up to the step's cell cap.
- **Small amoebae** are a mote-like kind (`small_amoeba`, mass `SMALL_AMOEBA_MASS`) that live on the bacteria films
  from 17:00, `SMALL_AMOEBAE_PER_FILM` per film, coming back over `SMALL_AMOEBA_RESPAWN_SECONDS`. Anyone may eat them
  as food; only a gathering player can recruit them. Another player's body never joins yours (cross-player fusion is
  ticket #79, still "not yet").
- **No cell regrowth**: the gathering road grows back by calling.

| Step | Name            | Cell cap | Floor mass | Speed factor | Real                                                                                 |
| ---- | --------------- | -------- | ---------- | ------------ | ------------------------------------------------------------------------------------ |
| 1    | your amoeba     | 1        | —          | 1            | one amoeba                                                                           |
| 2    | a stream        | 4        | —          | 1            | cells stream in toward the signal (cyclic AMP in life)                               |
| 3    | an aggregate    | 8        | —          | 0.9          | the streams meet                                                                     |
| 4    | a mound         | 16       | —          | 0.6          | a heap of cells                                                                      |
| 5    | a slug          | 32       | —          | 1.1          | the mound tips over into a slug that crawls toward light, faster than any one amoeba |
| 6    | a fruiting body | 32+      | —          | 0            | at the bank: a stalk with a ball of spores on top                                    |

(The gathering road's floor masses are "none": its mass is what it recruits and eats.)

**The fruiting finale.** A slug (step 5, at least `FRUITING_MIN_CELLS` cells) inside the bank band that holds the
ability key for `FRUITING_HOLD_SECONDS` stands up into a fruiting body: it scores `FRUITING_SCORE_PER_CELL` × its cells
(`body_fruited` effect, a big score popup), stays still and harmless for `FRUITING_DISPLAY_SECONDS`, then you
continue as one amoeba (step 1) at the bank with your traits and level, the road open again. In life about a fifth of
the cells die to build the stalk and the rest become spores (Kessin 2001); the popup says so. Jobs:

| Job (card)        | Effect per job cell (cap `BODY_JOB_CAP`)                                                    | Real                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Tip cell**      | speed × (1 + `TIP_CELL_SPEED_BONUS`); the light patch shows on the HUD's edge marker        | the slug's front cells steer it toward light and warmth                      |
| **Sentinel cell** | drains on the body (toxin aura, stentor vacuole) reduced by `SENTINEL_CELL_DRAIN_REDUCTION` | sentinel cells carry poisons and bacteria out of the slug (Chen et al. 2007) |

Caveat: _Amoeba proteus_ never aggregates, and neither do forams, its sea-water counterparts (forams are Rhizaria,
not relatives of _Amoeba_); its real relatives the social amoebae (Amoebozoa, like _Amoeba_) do, on land. Real slime moulds mix cells of different families, and some cheat to avoid the stalk
(Strassmann et al. 2000): the encyclopedia tells it; the game has no cheating cells.

#### 14.9.3 The glass road (the diatom): chains, _Skeletonema_, _Chaetoceros_ and _Asterionellopsis_

A colony, not a body: every cell still does everything, so the glass road has **no jobs**. Its cards are its steps,
its spines and its spare life. All three genera are sea-water diatoms. The proposal's _Asterionella_ star is a
freshwater genus; its sea-water counterpart is **_Asterionellopsis glacialis_**, whose cells join at their bases into
stars and spirals.

| Step | Name             | Cells (game) | Floor mass | Speed factor | Real                                                                    |
| ---- | ---------------- | ------------ | ---------- | ------------ | ----------------------------------------------------------------------- |
| 1    | your diatom      | 1            | —          | 1            | one glass box                                                           |
| 2    | a linked pair    | 2            | 150        | 0.95         | _Skeletonema_: boxes joined by rings of silica tubes                    |
| 3    | a chain of four  | 4            | 250        | 0.9          | _Skeletonema_                                                           |
| 4    | a chain of eight | 8            | 450        | 0.85         | _Skeletonema_ / _Thalassiosira_                                         |
| 5    | a bristled chain | 12           | 800        | 0.8          | _Chaetoceros_: long hollow bristles (setae) lock the cells together     |
| 6    | a star           | 8 arms       | 1 300      | 0.85         | _Asterionellopsis_: cells joined at their bases into a star or a spiral |

- **The ability key breaks the chain** (§14.12.1): for `BREAK_SECONDS` the chain is drawn scattered into its single
  cells. It stays **one entity** with one collision circle at its radius (no split, no merge, no `organismId`); the
  pieces are drawing only. Every predator judges it per piece while it is broken: a piece's mass is `mass / cellCount`, so a broken chain falls below the
  copepod's window and the copepod passes it by, but every small hunter that can engulf a piece bites one cell. After
  `BREAK_SECONDS` the chain re-forms over `BREAK_REFORM_SECONDS`; cooldown `BREAK_COOLDOWN_SECONDS`. True to life:
  chain diatoms shorten their chains when copepods are about, and pay for it with small grazers (Bergkvist et al. 2012).
  Caveat: real chains shorten over days by growing shorter, not in a second.
- **Cards:** the step (reserved), **Setae** (tiers I–III: the body's spit-out chance as prey, as the Diatom Shell's,
  `SETAE_SPIT_OUT_CHANCE_PER_SECOND` by tier, and a bite costs the biter `SETAE_BITE_DRAIN_FRACTION` of its mass) and
  **Resting spore** (one spare life per card, cap 2; real: _Chaetoceros_ forms thick-walled resting spores).

### 14.10 The ciliates: one cell, real upgrades (ticket #787 A)

Ciliates never became many-celled: they bet on one huge, complicated cell. The paramecium and the stentor stay one
cell; in the colony era their reserved card is their next upgrade (§14.8.6), two upgrades of three tiers each, which
matches a road's five steps. Both upgrades are traits (`category: 'upgrade'`, `stage: 'specialised'`, requiring the
form), offered only from the colony era.

#### 14.10.1 The paramecium: trichocysts and conjugation (sea-water cousin _Frontonia_)

- **Trichocysts** (`trichocysts`, tiers I–III). When any predator starts to wrap you, your trichocysts fire: the
  engulf ends at once with no transfer and the predator is pushed back at `TRICHOCYST_PUSH_SPEED`, with chance
  `TRICHOCYST_FIRE_CHANCE` by tier (0.5 / 0.75 / 1.0), then a cooldown `TRICHOCYST_COOLDOWN_SECONDS` by tier (12 / 9 /
  6). A body that bites you is pushed off the same way. **They never work against the Didinium.** Both are true: in the
  lab, paramecia with trichocysts survive the hunter _Dileptus_ far better than mutants without them (Harumoto and
  Miyake 1991; Harumoto 1994). That they are of little use against _Didinium_ is cited from Miyake and Harumoto
  1996, which may have tested _Monodinium balbiani_, a smaller relative in the same family, rather than _Didinium
  nasutum_: **to be checked** against the paper by the cast ticket (ticket #878) before any line quotes it. If it was
  _Monodinium_, the encyclopedia says "useless against a didiniid hunter in the lab" and the rule stays a game rule.
  The Didinium is the classic predator of paramecia (Gause 1934): your answer to it is speed.
- **Conjugation** (`conjugation`, tiers I–III). Touch another paramecium-form cell (a player or a wild one) and both
  stay slower than half your top speed, in contact, for `CONJUGATION_CONTACT_SECONDS`: you conjugate. Each partner gets
  one trait the other owns and it lacks, at tier I (drawn from a new `conjugation` stream; nothing if there is none, and
  never a form), and both get `CONJUGATION_MASS_BONUS` by tier. Cooldown `CONJUGATION_COOLDOWN_SECONDS`. With a player,
  both must own Conjugation; a wild paramecium always agrees. True to life: conjugation swaps genes, not cells; it is sex
  without making new cells.

#### 14.10.2 The stentor: anchoring together and regrowth (sea-water cousin _Folliculina_)

- **Anchoring** (`anchoring`, tiers I–III). The ability key anchors you to the floor or lets go (§14.12.1). Anchored, you
  cannot move and the surge does not move you; your feeding current pulls motes within `ANCHOR_PULL_RANGE_RADII` of your
  radius toward you at `ANCHOR_PULL_SPEED` by tier, and you eat what reaches you. **Together:** each other anchored
  stentor (player or wild) within `ANCHOR_CROWD_RADIUS` adds `ANCHOR_CROWD_RANGE_BONUS` to the pull range, up to
  `ANCHOR_CROWD_MAX` neighbours. True to life: stentors settled side by side make stronger feeding currents together
  (Shekhar et al. 2023). Wild stentors in the colony era anchor near each other and near anchored players.
- **Regrowth** (`regrowth`, tiers I–III). When a predator would seal you, you lose `REGROWTH_LOSS_FRACTION` of your
  mass instead and slip free, with a cooldown `REGROWTH_COOLDOWN_SECONDS` by tier (20 / 15 / 10); you regrow the loss
  at `REGROWTH_MASS_PER_SECOND` while fed. True to life: a piece of a stentor regrows a whole cell, as long as it holds a
  piece of its long nucleus (Tartar 1961).

Caveat: the anchoring and regrowth facts come from freshwater _Stentor_. Its sea-water relatives the folliculinids
live in a bottle-shaped case fixed to seaweed and shells, a heterotrich family close to the stentor-like _Maristentor_;
the encyclopedia shows them and says the experiments were on _Stentor_.

### 14.11 Wild colonies and the choanoflagellate rosettes

- **At 17:00 wild colonies appear** among the pool's wild seats: each form seat of the euglena and the diatom (four
  each) becomes, at its next respawn after 17:00, a wild body at a road step of its world level (a _Phaeocystis_ ball, ticket #901 A, or
  a diatom chain), with the body rules of §14.8. The wild amoebae stay single (social amoebae aggregate only on a
  call); the wild ciliates gain their upgrades.
- **The rosettes (ticket #790 A).** The 4 collar-cell seats are wild **choanoflagellates**, sea-water cells with one
  whip inside a collar of fine fingers, the closest living relatives of animals (King et al. 2008). From 17:00, a
  collar cell that crosses a bacteria film becomes a **rosette**, a wild body of `ROSETTE_CELLS` cells
  (`rosette_formed` effect): true to life, _Salpingoeca rosetta_ forms rosettes only when it senses a molecule made by
  certain bacteria (Alegado et al. 2012). Rosettes graze and flee; they are prey for a big enough player, and the first
  one you eat shows the fact.
- **Rosettes are not a road.** No player form becomes a choanoflagellate: animals came from a sixth kind of cell, not
  from any of our five. A playable collar-cell road is the "after multicell" era of the proposal (ticket #782 Q7), its own
  world and its own decision, not this build.

### 14.12 Controls, HUD and the sea-water cast

#### 14.12.1 One ability key

One new key, **E** (and the right mouse button; a second on-screen button on touch), does the action of your road or
upgrade, and nothing otherwise: **call** (gathering road), **break** (glass road), **anchor / let go** (a stentor with
Anchoring). Conjugation needs no key. The light road and a paramecium without Conjugation have no ability. Wire: one
new optional boolean on `GameInput` (`isAbilityPressed`), edge-triggered on the server.

#### 14.12.2 HUD

- **The era chip** beside the timer: `THE DISH` / `THE ROCK POOL` / `THE COLONIES`, and the timer's track marks 10:00 and
  17:00 (ui/hud.md owns the placement).
- **Toasts:** the warning (§14.4.1), `MANY-CELLED LIFE IS POSSIBLE NOW` at 17:00, the copepod's and the surge's warnings
  as directional edge cues, not text.
- **The body map** (colony era): a small panel with your body's cells as dots in their jobs' colours, the empty count
  to grow back, spare lives, and the road's step name (`FOUR IN A SKIN · STEP 3 OF 6`). The trait strip's stage caption
  reads the road step in the colony era.
- **The ability key's chip** shows its name and cooldown when you have one.
- Danger labels and the hold-Tab panel name the pool's creatures by their display names (§14.12.3).

#### 14.12.3 The sea-water cast (ticket #790 A)

What the encyclopedia, the facts and the art name, and what each choice rests on. The forms keep their shapes and
powers; only names, lines and some art change.

| In the game               | Sea-water name                                            | Based on                                                                                                                                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amoeba (form)             | **forams**, shelled amoebae with nets of thread-like arms | ticket #790's own text; a sea-water **counterpart**, not a relative (forams are Rhizaria, _Amoeba_ is Amoebozoa), so every line says "counterpart", never "cousin". Forams are among the commonest amoeboid cells of the sea floor, and the sand of some beaches is made of their shells |
| Paramecium (form)         | **_Frontonia_**                                           | same order as _Paramecium_ (Peniculida), lives in the sea, covered in trichocysts, eats diatoms and algae: the upgrades of §14.10.1 hold for it                                                                                                                                          |
| Euglena (form)            | **_Eutreptiella_**, a sea-water euglena                   | a marine and brackish euglenid with an eyespot and green chloroplasts that swims toward light and blooms in coastal water                                                                                                                                                                |
| Diatom (form)             | diatoms as they are: **_Coscinodiscus_** (the round one)  | most diatoms live in the sea; the giant diatom's model already is a sea diatom (ecology/giants.md §3.5.13)                                                                                                                                                                               |
| Stentor (form)            | **folliculinids** (_Folliculina_)                         | sea-water heterotrich ciliates, trumpet-mouthed, living fixed in a bottle-shaped case on seaweed and shells; close to the stentor-like _Maristentor_                                                                                                                                     |
| Giant amoeba (dish giant) | a **giant foram**                                         | as ecology/giants.md §3.5.13 option A planned: a chambered shell, drawn only (not armour)                                                                                                                                                                                                |
| Paramecium (dish giant)   | a **giant _Frontonia_**                                   | the paramecium's cousin above, one name per form (giants §3.5.13 offered _Euplotes_ as an example; one cousin per form keeps the encyclopedia simple)                                                                                                                                    |
| Giant diatom (dish giant) | _Coscinodiscus_, unchanged                                | already a sea diatom                                                                                                                                                                                                                                                                     |
| Pool food                 | **_Dunaliella_**                                          | a sea-water green swimmer of the _Chlamydomonas_ family; its salt-loving cousin turns drying splash pools red                                                                                                                                                                            |
| Pool cover                | **_Cladophora_**                                          | branched green threads common in rock pools (the freshwater _Spirogyra_ of the proposal is replaced)                                                                                                                                                                                     |
| Didinium                  | _Didinium_ (sea species such as _D. gargantua_)           | most _Didinium_ live in fresh or brackish water; a few live in the sea                                                                                                                                                                                                                   |
| Rotifer                   | **_Brachionus plicatilis_**                               | a salt-water rotifer, raised by the billion as food in fish farms; it swims and attaches only briefly, so the anchored rotifer is a game liberty the encyclopedia names                                                                                                                  |
| Nematode                  | sea-floor nematodes                                       | nematodes are the most numerous animals in sea-floor sediments                                                                                                                                                                                                                           |
| Water flea (Daphnia)      | **_Tigriopus californicus_**, a copepod                   | Daphnia lives in fresh water; _Tigriopus_ lives in high rock pools from Baja California to Alaska, Vancouver Island included                                                                                                                                                             |
| Volvox (the green road)   | **_Phaeocystis_** (ticket #901 A)                         | §14.9.1: no volvocine alga lives in the sea                                                                                                                                                                                                                                              |
| _Asterionella_ star       | **_Asterionellopsis glacialis_**                          | §14.9.3                                                                                                                                                                                                                                                                                  |
| Wild collar cells         | **_Salpingoeca rosetta_**                                 | a sea-water choanoflagellate whose rosettes are triggered by bacteria (Alegado et al. 2012)                                                                                                                                                                                              |
| Social amoebae            | _Dictyostelium_, on land                                  | no sea-water social amoeba is known to us; the road fruits on the bank (§14.9.2)                                                                                                                                                                                                         |

The real-life lines, display names and real sizes for each are data rows written by the cast and encyclopedia
tickets, checked against a source each, in the giants' style (ecology/giants.md §3.5.12).

### 14.13 Where this meets other work

- **Ticket #865 (decision #791 A, the early game true to life).** It changes the dish era only: absorbing before
  swallowing, the archaeon's latch, the chloroplast after the nucleus. Where it meets this plan: the no-form gift
  (§14.4.3) reads the ladder's gates and the forms' requirements at build time, so the reordered ladder needs no rule
  here; if #865 moves the pace so that fewer players have a form by 10:00, more get the gift, and gameplay QA should
  measure the share. The archaeon (an Asgard archaeon) is a sea-floor microbe, which fits the sea-water setting. The
  design is [`early-life.md`](./early-life.md) §15; §15.8.7 there lists every point where it meets this plan (held
  bacteria end at the move, the pool creatures swallow by species, the euglena's pool build).
- **The opening dive (epic #795).** The move's caption tells the dive's story (§14.4.4). The dive itself stays the
  dish's and is not part of this build. It does not stop one step of ten higher for a player who joins a game already in
  the pool (the human's idea on ticket #782): decided on **ticket #902** (answer A, the dive stays as it is). The
  move's camera ease plays that step in-game.
- **The giants (ecology/giants.md).** They stay in the dish era and do not cross. Their sea-water names are this plan's
  cast ticket (§14.12.3).
- **Ticket #79 (cross-player fusion).** Stays "not yet": no player's body joins another's.
- **Ticket #28 (multi-cell research)** is this plan's source for the roads.
- **The contract** (for the architect; folded into architecture/entity-model.md §2, server-simulation.md §3,
  wire-contract.md §4 and §4.1, client.md §5, constants-files-tests.md §10 and debug-mcp.md §8 by the two contract
  tickets).
  - **Stage 1, the pool (ticket #867):** `GameEra`; the shared `eraAt` (§14.2.1) and `remapCameraAcrossMove`
    (§14.4.2 step 9); `era` on the snapshot; the full `game_state` on the move tick; the effects `era_warning`,
    `era_moved`, `surge_warning`, `copepod_warning`; the pool layout view (films, threads, bank, the light patch's
    orbit; drawn at the round's start, first sent on the warning tick, §14.4.6) and the `surge` and copepod lane views (§14.5.3, §14.6.4); the pool creature species, their views and
    their shapes (§14.6.4); the `green_speck` mote kind; the `eras`, `pool` and `pool_creatures` streams; the arena
    radius decision (`DISH_RADIUS`, §14.5.2); `debug_set_era(gameId, era)` (§14.2.4: every crossed move runs in order, no earlier era, `roundStartTick` may be negative), `isLandmark` on the creature view (§14.6.3), `debug_spawn` kinds for the
    four creatures and `debug_get_entities` kind filters for them.
  - **Stage 2, the colonies (ticket #884):** the body's fields on the cell view (§14.8.1) and `isAnchored`; the draft
    offer as a card union `trait | roadStep | job`; the colony era's gate in the candidate rule (an upgrade or a road
    card is offered only from 17:00); the retirement of controls-and-scope.md §11's colony hooks (§14.8.1);
    `GameInput.isAbilityPressed`; the effects `body_spare_life_used`, `body_fruited`, `rosette_formed`; the
    `small_amoeba` mote kind and the `conjugation` stream; `debug_spawn` for bodies and `debug_set_player` for road,
    step and jobs. The four ciliate upgrades (`trichocysts`, `conjugation`, `anchoring`, `regrowth`) become trait
    catalog rows in their own build tickets (ticket #889, ticket #890), each with its encyclopedia entry in the same
    PR, since the client's registry-completeness spec needs one entry per catalog row; with the era gate in place
    they are never offered in a live game before 17:00.
- **The state hash and replay.** The hash covers the era, the surge, the copepod's pass, the creatures' state and the
  body fields; a replay across the move reproduces the final hash, `debug_set_era` included (§14.2.4).

### 14.14 Constants

Two tables, one per stage, so the constants ledger (`packages/shared/src/constants/constants-ledger.test.ts`) can take
each when its files land and never sees a row whose file does not exist yet. The stage 1 contract (ticket #867)
registers §14.14.1 in `CONSTANTS_TABLE_SOURCES` with the domain files `eras.ts`, `pool.ts` and `pool-creatures.ts`;
the stage 2 contract (ticket #884) registers §14.14.2 with `colonies.ts`, `roads.ts` and `ciliate-upgrades.ts`. The
source entry takes this doc and the subsection's heading (the parser finds a section by its heading at any level).
The architect may merge or split domains; the values are these tables'. "Tuning" marks a starting value gameplay QA
is expected to move.

Rows for files that already have a ledger doc stay in that doc's table: `ROUND_DURATION_SECONDS` (600, then 1020 with
the pool on, then 1500 with the colonies on, §14.2.3) is game-design/constants-and-acceptance.md §12's row, which
the "on" tickets update; `MAX_LEVEL` (12, then 18 with the colonies on, §14.7.1) is PROGRESSION.md §6's row. The
arena keeps `DISH_RADIUS` (§14.5.2); there is no pool radius.

#### 14.14.1 Stage 1 constants table (the pool; registered by ticket #867)

| Constant                          | Default                                  | Unit              | File                | Status  | Rule (section)                                               |
| --------------------------------- | ---------------------------------------- | ----------------- | ------------------- | ------- | ------------------------------------------------------------ |
| `ERA_START_SECONDS`               | `{ dish: 0, pool: 600, colonies: 1020 }` | s (game time)     | `eras.ts`           | decided | era starts (§14.2.1)                                         |
| `ERAS_IN_PLAY`                    | `['dish']`, then pool, then colonies     | era ids           | `eras.ts`           | decided | the "on" slices (§14.2.4)                                    |
| `ERA_SCALE_STEP`                  | 10                                       | ×                 | `eras.ts`           | decided | dish to pool mapping (§14.4.2)                               |
| `ERA_MOVE_WARNING_SECONDS`        | 10                                       | s                 | `eras.ts`           | tuning  | §14.4.1                                                      |
| `ERA_MOVE_GRACE_SECONDS`          | 8                                        | s                 | `eras.ts`           | tuning  | §14.4.2 step 8                                               |
| `ERA_LANDING_CLEAR_RADIUS`        | 900                                      | wu (pool)         | `eras.ts`           | tuning  | §14.4.2                                                      |
| `ERA_LANDMARK_DISTANCE`           | 650                                      | wu (pool)         | `eras.ts`           | tuning  | §14.6.3                                                      |
| `ERA_LANDMARK_RADIUS`             | 300 (derived, the footprint's radius)    | wu (pool)         | `eras-derived.ts`   | decided | §14.6.3: `DISH_RADIUS / ERA_SCALE_STEP`                      |
| `ERA_LEFTOVER_SPECK_MASS`         | 2                                        | mass              | `eras.ts`           | tuning  | §14.4.2                                                      |
| `ERA_MOVE_CAMERA_EASE_SECONDS`    | 4                                        | s                 | `eras.ts`           | tuning  | the shared camera (§14.4.4)                                  |
| `ERA_MOVE_CAMERA_ZOOM_SECONDS`    | 1.0                                      | s (time constant) | `eras.ts`           | tuning  | the shared camera's zoom smoothing during the ease (§14.4.4) |
| `POOL_ARRIVAL_MASS`               | 60                                       | mass              | `pool.ts`           | tuning  | §14.3, §14.4.2                                               |
| `POOL_ENTRY_MAX_MASS`             | 400                                      | mass              | `pool.ts`           | tuning  | §14.7.3                                                      |
| `POOL_WORLD_MASS_START`           | 60                                       | mass              | `pool.ts`           | tuning  | §14.2.2                                                      |
| `POOL_WORLD_MASS_GAIN_PER_SECOND` | 0.5                                      | mass/s            | `pool.ts`           | tuning  | §14.2.2                                                      |
| `POOL_GREEN_SPECK_MASS`           | 3                                        | mass              | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_SWARM_SIZE`                 | 12                                       | specks            | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_SWARM_COUNT`                | 10                                       | swarms            | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_SWARM_SPEED`                | 30                                       | wu/s              | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_LIGHT_PATCH_RADIUS`         | 900                                      | wu                | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_LIGHT_PATCH_PERIOD_SECONDS` | 240                                      | s                 | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_FILM_COUNT`                 | 5                                        | films             | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_FILM_RADIUS`                | 350                                      | wu                | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_FILM_GRAZE_MASS_PER_SECOND` | 2                                        | mass/s            | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_THREAD_COUNT`               | 6                                        | threads           | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_THREAD_LENGTH`              | 1 400                                    | wu                | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_THREAD_WIDTH`               | 60                                       | wu                | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_THREAD_COVER_MAX_MASS`      | 300                                      | mass              | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_THREAD_SPEED_FACTOR`        | 0.7                                      | ×                 | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_SURGE_PERIOD_SECONDS`       | 45                                       | s                 | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_SURGE_SECONDS`              | 4                                        | s                 | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_SURGE_WARNING_SECONDS`      | 3                                        | s                 | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_SURGE_SPEED`                | 90                                       | wu/s              | `pool.ts`           | tuning  | §14.5.2                                                      |
| `POOL_BANK_WIDTH`                 | 250                                      | wu                | `pool.ts`           | tuning  | §14.5.2, §14.9.2                                             |
| `DIDINIUM_COUNT`                  | 2                                        | creatures         | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `DIDINIUM_MASS`                   | 90                                       | mass              | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `DIDINIUM_SPEED`                  | 260                                      | wu/s              | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `ROTIFER_COUNT`                   | 3 (plus the landmark, §14.6.3)           | creatures         | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `ROTIFER_MASS`                    | 480                                      | mass              | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `ROTIFER_PULL_RANGE_RADII`        | 3                                        | own radii         | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `ROTIFER_PULL_SPEED`              | 70                                       | wu/s              | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `ROTIFER_SWALLOW_MAX_MASS`        | 120                                      | mass              | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `NEMATODE_COUNT`                  | 2                                        | creatures         | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `NEMATODE_LENGTH`                 | 320                                      | wu                | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `NEMATODE_THICKNESS`              | 24                                       | wu                | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `NEMATODE_SEGMENT_COUNT`          | 7                                        | circles           | `pool-creatures.ts` | tuning  | its contact shape (§14.6.4)                                  |
| `NEMATODE_SPEED`                  | 180                                      | wu/s              | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `NEMATODE_KNOCK_SPEED`            | 400                                      | wu/s              | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `COPEPOD_LENGTH`                  | 1 200                                    | wu                | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `COPEPOD_SPEED`                   | 600                                      | wu/s              | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `COPEPOD_PASS_INTERVAL_SECONDS`   | 50                                       | s                 | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `COPEPOD_FIRST_PASS_SECONDS`      | 60                                       | s after the move  | `pool-creatures.ts` | tuning  | §14.6.2                                                      |
| `COPEPOD_WARNING_SECONDS`         | 3                                        | s                 | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `COPEPOD_LANE_WIDTH`              | 500                                      | wu                | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `COPEPOD_EATS_MIN_MASS`           | 150                                      | mass              | `pool-creatures.ts` | tuning  | the window (§14.6.1)                                         |
| `COPEPOD_EATS_MAX_MASS`           | 1 500                                    | mass              | `pool-creatures.ts` | tuning  | the window (§14.6.1)                                         |
| `COPEPOD_BITE_CELLS`              | 4                                        | cells             | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `POOL_CREATURE_DNA_BONUS`         | 150                                      | DNA               | `pool-creatures.ts` | tuning  | §14.6.1                                                      |
| `POOL_CREATURE_RESPAWN_SECONDS`   | 90                                       | s                 | `pool-creatures.ts` | tuning  | §14.6.2                                                      |

#### 14.14.2 Stage 2 constants table (the colonies; registered by ticket #884)

| Constant                           | Default                        | Unit                | File                  | Status | Rule (section) |
| ---------------------------------- | ------------------------------ | ------------------- | --------------------- | ------ | -------------- |
| `BODY_JOB_CAP`                     | 4                              | cells per job       | `colonies.ts`         | tuning | §14.8.1        |
| `BODY_TURN_DEGREES_PER_SECOND`     | 360                            | °/s                 | `colonies.ts`         | tuning | §14.8.2        |
| `BODY_TURN_CELL_SCALE`             | 32                             | cells               | `colonies.ts`         | tuning | §14.8.2        |
| `BODY_BITE_CELLS`                  | 1                              | cells               | `colonies.ts`         | tuning | §14.8.3        |
| `BODY_BITE_COOLDOWN_SECONDS`       | 1                              | s                   | `colonies.ts`         | tuning | §14.8.3        |
| `BODY_CELL_REGROW_SECONDS`         | 6                              | s per cell          | `colonies.ts`         | tuning | §14.8.3        |
| `ROAD_STEPS`                       | the three step tables of §14.9 | cells, mass, ×      | `roads.ts`            | tuning | §14.9          |
| `LIGHT_CELL_MASS_PER_SECOND`       | 0.5                            | mass/s per cell     | `roads.ts`            | tuning | §14.9.1        |
| `MUCUS_CELL_RATIO_BONUS`           | 0.05                           | ratio per cell      | `roads.ts`            | tuning | §14.9.1        |
| `CALL_RADIUS`                      | 700                            | wu                  | `roads.ts`            | tuning | §14.9.2        |
| `CALL_COOLDOWN_SECONDS`            | 6                              | s                   | `roads.ts`            | tuning | §14.9.2        |
| `CALL_STREAM_SPEED`                | 160                            | wu/s                | `roads.ts`            | tuning | §14.9.2        |
| `SMALL_AMOEBA_MASS`                | 8                              | mass                | `roads.ts`            | tuning | §14.9.2        |
| `SMALL_AMOEBAE_PER_FILM`           | 10                             | motes               | `roads.ts`            | tuning | §14.9.2        |
| `SMALL_AMOEBA_RESPAWN_SECONDS`     | 20                             | s                   | `roads.ts`            | tuning | §14.9.2        |
| `FRUITING_MIN_CELLS`               | 32                             | cells               | `roads.ts`            | tuning | §14.9.2        |
| `FRUITING_HOLD_SECONDS`            | 3                              | s                   | `roads.ts`            | tuning | §14.9.2        |
| `FRUITING_SCORE_PER_CELL`          | 10                             | score per cell      | `roads.ts`            | tuning | §14.9.2        |
| `FRUITING_DISPLAY_SECONDS`         | 4                              | s                   | `roads.ts`            | tuning | §14.9.2        |
| `TIP_CELL_SPEED_BONUS`             | 0.04                           | × per cell          | `roads.ts`            | tuning | §14.9.2        |
| `SENTINEL_CELL_DRAIN_REDUCTION`    | 0.1                            | share per cell      | `roads.ts`            | tuning | §14.9.2        |
| `BREAK_SECONDS`                    | 5                              | s                   | `roads.ts`            | tuning | §14.9.3        |
| `BREAK_REFORM_SECONDS`             | 2                              | s                   | `roads.ts`            | tuning | §14.9.3        |
| `BREAK_COOLDOWN_SECONDS`           | 15                             | s                   | `roads.ts`            | tuning | §14.9.3        |
| `SETAE_SPIT_OUT_CHANCE_PER_SECOND` | 0.3 / 0.5 / 0.7                | 1/s by tier         | `roads.ts`            | tuning | §14.9.3        |
| `SETAE_BITE_DRAIN_FRACTION`        | 0.02 / 0.04 / 0.06             | share by tier       | `roads.ts`            | tuning | §14.9.3        |
| `ROSETTE_CELLS`                    | 8                              | cells               | `roads.ts`            | tuning | §14.11         |
| `TRICHOCYST_FIRE_CHANCE`           | 0.5 / 0.75 / 1.0               | chance by tier      | `ciliate-upgrades.ts` | tuning | §14.10.1       |
| `TRICHOCYST_COOLDOWN_SECONDS`      | 12 / 9 / 6                     | s by tier           | `ciliate-upgrades.ts` | tuning | §14.10.1       |
| `TRICHOCYST_PUSH_SPEED`            | 500                            | wu/s                | `ciliate-upgrades.ts` | tuning | §14.10.1       |
| `CONJUGATION_CONTACT_SECONDS`      | 2                              | s                   | `ciliate-upgrades.ts` | tuning | §14.10.1       |
| `CONJUGATION_MASS_BONUS`           | 20 / 40 / 60                   | mass by tier        | `ciliate-upgrades.ts` | tuning | §14.10.1       |
| `CONJUGATION_COOLDOWN_SECONDS`     | 30                             | s                   | `ciliate-upgrades.ts` | tuning | §14.10.1       |
| `ANCHOR_PULL_RANGE_RADII`          | 3 / 4 / 5                      | own radii by tier   | `ciliate-upgrades.ts` | tuning | §14.10.2       |
| `ANCHOR_PULL_SPEED`                | 50 / 70 / 90                   | wu/s by tier        | `ciliate-upgrades.ts` | tuning | §14.10.2       |
| `ANCHOR_CROWD_RADIUS`              | 400                            | wu                  | `ciliate-upgrades.ts` | tuning | §14.10.2       |
| `ANCHOR_CROWD_RANGE_BONUS`         | 0.5                            | radii per neighbour | `ciliate-upgrades.ts` | tuning | §14.10.2       |
| `ANCHOR_CROWD_MAX`                 | 4                              | neighbours          | `ciliate-upgrades.ts` | tuning | §14.10.2       |
| `REGROWTH_LOSS_FRACTION`           | 0.4                            | share of mass       | `ciliate-upgrades.ts` | tuning | §14.10.2       |
| `REGROWTH_COOLDOWN_SECONDS`        | 20 / 15 / 10                   | s by tier           | `ciliate-upgrades.ts` | tuning | §14.10.2       |
| `REGROWTH_MASS_PER_SECOND`         | 4                              | mass/s              | `ciliate-upgrades.ts` | tuning | §14.10.2       |

#### 14.14.3 Client constants (not ledger rows)

| Constant                            | Default | Unit                  | File                                                        | Status | Rule (section) |
| ----------------------------------- | ------- | --------------------- | ----------------------------------------------------------- | ------ | -------------- |
| `ERA_MOVE_RIM_DISSOLVE_SECONDS`     | 1.5     | s                     | `packages/client/src/app/game/render/constants/era-move.ts` | tuning | §14.4.1        |
| `ERA_MOVE_POOL_FADE_SECONDS`        | 2       | s                     | `packages/client/src/app/game/render/constants/era-move.ts` | tuning | §14.4.1        |
| `ERA_FOOTPRINT_RING_SECONDS`        | 12      | s                     | `packages/client/src/app/game/render/constants/era-move.ts` | tuning | §14.4.4        |
| `ERA_MOVE_CAPTION_SECONDS`          | 5       | s                     | the HUD constants (ticket #877)                             | tuning | §14.4.4        |
| `ERA_SCALE_BAR_MAX_SCREEN_FRACTION` | 0.4     | share of screen width | the HUD constants (ticket #877)                             | tuning | §14.4.4 cue 5  |

### 14.15 Acceptance scenarios

Format and fixture conventions as [`constants-and-acceptance.md §13`](./constants-and-acceptance.md#13-acceptance-scenarios).
Unless stated: balance `ERAS_IN_PLAY` = all three, `ROUND_DURATION_SECONDS` 1500, seed 42. Ticks are 60 Hz.

| #    | Given                                                                                                                                                                                                       | Inputs                                        | After                                  | Assert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH1  | 1 player, placed at tick 35 999 at (1 200, −600), mass 500, level 5, the paramecium form, score S                                                                                                           | idle                                          | 36 000 ticks                           | era `dish` and `roundPhase` `'playing'` on tick 35 999; on tick 36 000 era `pool`, `roundPhase` `'playing'`, one `era_moved` effect; the cell at (120, −60) (± separation), mass `POOL_ARRIVAL_MASS` less one tick of decay, level 5, traits and score S unchanged                                                                                                                                                                                                                                                                                                    |
| PH2  | 1 player at tick 35 999: level 4, owns `nucleoid`, `mitochondrion`, `nuclear_envelope`; tag points `photic` 30, `motile` 10                                                                                 | idle                                          | 36 000 ticks                           | the cell owns `chloroplast` I and `euglena_eyespot` I (the gift: photic leans euglena, whose requirement it lacked); stage `specialised`; level 4 and `dnaCumulative` unchanged; no draft queued                                                                                                                                                                                                                                                                                                                                                                      |
| PH3  | 1 player                                                                                                                                                                                                    | idle                                          | 36 001 ticks                           | one `green_speck` of mass `ERA_LEFTOVER_SPECK_MASS` within 300 wu of the centre for each wild cell and giant alive on tick 35 999, at its mapped point (27 when all are alive), and no other mote within `ERA_LANDING_CLEAR_RADIUS` (the swarms are placed outside it); no dish mote kind remains; the landmark centred 650 wu due east or due west of the centre; no other creature or wild cell within `ERA_LANDING_CLEAR_RADIUS`                                                                                                                                   |
| PH4  | PH1, then the fixture places a Didinium 100 wu east of the player on tick 36 001                                                                                                                            | idle                                          | 36 480 ticks                           | the Didinium has not targeted the player through tick 36 479 (grace); its first decision at or after tick 36 480 targets it                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| PH5  | `ROUND_DURATION_SECONDS` 600, `ERAS_IN_PLAY` all three                                                                                                                                                      | idle                                          | 37 200 ticks                           | G2 holds unchanged: `'results'` on tick 36 000, no `era_moved` effect, rematch on tick 37 200 in the dish                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| PH6  | 1 player with the euglena form, level 8, 10 DNA short of level 9, on tick 61 199                                                                                                                            | it eats 10 DNA on tick 61 300                 | 61 301 ticks                           | `era_moved` (to `colonies`) on tick 61 200 only; the draft offered on tick 61 300 holds exactly one road card, the light road's step 2                                                                                                                                                                                                                                                                                                                                                                                                                                |
| PH7  | colony era: a light-road body of 4 cells (step 3), mass 400, no jobs; a wild cell of mass 600 placed touching it                                                                                            | idle                                          | touch + 61 ticks                       | the body has 3 cells, mass 300 less decay, after the first touch tick; the wild cell gained the bite's mass; a second bite no sooner than 60 ticks after the first; the body is never sealed whole                                                                                                                                                                                                                                                                                                                                                                    |
| PH8  | colony era: the same body (4 cells, step 3, mass 400); a wild amoeba of mass 450 placed touching it (450 / 400 = 1.125 < `ENGULF_MASS_RATIO` 1.25: it could engulf a single cell of 360, but not this body) | idle                                          | 600 ticks                              | the body keeps 4 cells and its mass less decay: no bite (the size refuge). Paired case, the same amoeba at mass 520 (1.3): one bite on the first touch tick, as PH7                                                                                                                                                                                                                                                                                                                                                                                                   |
| PH9  | colony era: a paramecium player with Trichocysts III (chance 1.0), mass 100, and a wild amoeba of mass 400 placed touching it, then a Didinium of mass 200 likewise                                         | idle                                          | per engulf start                       | the amoeba's engulf ends on the tick it starts, no mass moves, the amoeba moves away at `TRICHOCYST_PUSH_SPEED`; after the cooldown, the Didinium's engulf proceeds and seals                                                                                                                                                                                                                                                                                                                                                                                         |
| PH10 | pool era: three idle player cells of mass 80, 500 and 2 000 placed in a copepod's lane                                                                                                                      | idle                                          | the pass                               | only the 500 cell is eaten; the 80 and the 2 000 remain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| PH11 | a second player joins on tick 43 200 (12:00), the first alive                                                                                                                                               | idle                                          | the tick its queued drafts are used up | on that tick the joiner owns a form (picked from its drafts, or gifted on that very tick if it picked none, §14.7.3); mass = `clamp(ENTRY_MASS_FRACTION × worldMass, POOL_ARRIVAL_MASS, POOL_ENTRY_MAX_MASS)`, `worldMass` = 60 + 0.5 × 120 = 120 → 60                                                                                                                                                                                                                                                                                                                |
| PH12 | colony era: a glass-road player at step 5 is engulfed down to its last cell and sealed                                                                                                                      | idle                                          | respawn tick                           | it respawns as a body of 4 cells at step 3 with its traits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| PH13 | 1 player                                                                                                                                                                                                    | idle                                          | 91 200 ticks                           | `'results'` on tick 90 000 exactly; on tick 91 200 the new game is in the dish era, seed 43, the player level 1, protocell                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| PH14 | colony era: a gathering-road slug of 32 cells inside the bank band                                                                                                                                          | ability key held from tick t                  | t + 181                                | one `body_fruited` effect; score + 320; the player is one amoeba (step 1) at the bank with its traits and level                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| PH15 | colony era: a glass-road chain of 8 cells, mass 1 000, in a copepod's lane                                                                                                                                  | ability key pressed 1 s before the pass       | the pass                               | the chain keeps its cells (each piece 125 < `COPEPOD_EATS_MIN_MASS`); with no key press it loses `COPEPOD_BITE_CELLS` cells                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| PH16 | 1 player at tick 35 999: level 4, owns `nucleoid`, `mitochondrion`, `nuclear_envelope`; tag points `motile` 30, nothing else                                                                                | idle                                          | 36 000 ticks                           | the gift is the paramecium: the cell owns `cilia` I and `paramecium_cilia` I (means: paramecium 30, amoeba 15, the rest 0); level and `dnaCumulative` unchanged                                                                                                                                                                                                                                                                                                                                                                                                       |
| PH17 | PH1 with a connected client                                                                                                                                                                                 | idle                                          | 36 000 ticks                           | the pool layout view reached the client on the warning tick (35 400); on tick 36 000 the client receives a full `game_state` (`SNAPSHOT_PUSH.replaced`), not a delta; the server's viewer camera for that player is `remapCameraAcrossMove` of its tick-35 999 state (x, y and half-height ÷ 10), and so is every state in its history (no dish-coordinate rectangle in the cull union from that tick on), so the cell at (120, −60) lies inside the culled area on that tick; the client's predicted pose equals the server's on tick 36 001 (no blended correction) |
| PH18 | pool era: 1 idle player cell at the centre; the fixture starts a surge on tick t                                                                                                                            | idle                                          | t + `POOL_SURGE_SECONDS` × 60          | the shared movement step fed the snapshot's `surge` view reproduces the server's position of the cell on every tick of the surge within 0.01 wu (the client predicts the surge)                                                                                                                                                                                                                                                                                                                                                                                       |
| PH19 | seed 42, 1 player; case A: `debug_set_era(pool)` at tick 600, then run to tick 1 200; case B: a fresh game, `debug_set_era(colonies)` at tick 600, then run to tick 1 200                                   | idle                                          | 1 200 ticks                            | A: `roundStartTick` = −35 400 (allowed); `debug_export_replay` replays to the same final state hash; the hash differs if the surge's or the copepod's state is changed (it covers them). B: on tick 601 the pool's move ran first (the player in the footprint at `POOL_ARRIVAL_MASS`, the leftovers placed, the cameras remapped, one `era_moved` to `pool`), then the colonies' move (a second `era_moved`, to `colonies`), in that order on that one tick; the replay reproduces the hash. In either case a later `debug_set_era(dish)` is refused                 |
| PH20 | colony era: a light-road body at step 6 (256 cells, mass 1 700), heading east at its top speed; a connected client                                                                                          | target swings to due west on tick t and stays | t + 120                                | the heading turns at most `BODY_TURN_DEGREES_PER_SECOND` / (1 + 256 / `BODY_TURN_CELL_SCALE`) = 40 °/s, and speed is capped at `CELL_BASE_SPEED` × 0.75; the shared movement step fed the snapshot's cell view reproduces the server's position on every tick within 0.01 wu (the client predicts the turning body)                                                                                                                                                                                                                                                   |

### 14.16 Sources

- Alegado RA, Brown LW, Cao S, et al. (2012). A bacterial sulfonolipid triggers multicellular development in the
  closest living relatives of animals. _eLife_ 1:e00013.
- Bergkvist J, Thor P, Jakobsen HH, Wängberg SÅ, Selander E (2012). Grazer-induced chain length plasticity reflects a
  trade-off between defence and resource acquisition in marine diatoms. _Limnology and Oceanography_ 57:318–324.
- Bonner JT (2009). _The Social Amoebae._ Princeton University Press. Kessin RH (2001). _Dictyostelium._ Cambridge
  University Press.
- Chen G, Zhuchenko O, Kuspa A (2007). Immune-like phagocyte activity in the social amoeba. _Science_ 317:678–681.
- Gause GF (1934). _The Struggle for Existence._ Williams and Wilkins.
- Harumoto T, Miyake A (1991). Defensive function of trichocysts in _Paramecium_. _Journal of Experimental Zoology_.
  Harumoto T (1994), on trichocyst discharge against _Dileptus margaritifer_, _Journal of Eukaryotic Microbiology_.
  Miyake A, Harumoto T (1996), on _Didinium_. All three as cited in the Shimane University review of trichocyst
  function; the cast ticket checks the exact references before an encyclopedia line quotes them.
- Herron MD, Borin JM, Boswell JC, et al. (2019). De novo origins of multicellularity in response to predation.
  _Scientific Reports_ 9:2328.
- King N, et al. (2008). The genome of the choanoflagellate _Monosiga brevicollis_ and the origin of metazoans.
  _Nature_ 451:783–788.
- Long JD, Smalley GW, Barsby T, Anderson JT, Hay ME (2007). Chemical cues induce consumer-specific defenses in a
  bloom-forming marine phytoplankton. _PNAS_ 104:10512–10517.
- Nejstgaard JC, Tang KW, Steinke M, et al. (2007). Zooplankton grazing on _Phaeocystis_: a quantitative review and
  future challenges. _Biogeochemistry_ 83:147–172.
- Powlik JJ (1996). Thesis on _Tigriopus californicus_ in the splash pools of Barkley Sound, Vancouver Island,
  University of British Columbia.
- Round FE, Crawford RM, Mann DG (1990). _The Diatoms._ Cambridge University Press.
- Shekhar S, Guo H, Colin SP, Marshall W, Prakash VN (2023). Cooperative hydrodynamics accompany multicellular-like
  colonial organization in the unicellular ciliate _Stentor_. _Current Biology_.
- Strassmann JE, Zhu Y, Queller DC (2000). Altruism and social cheating in the social amoeba _Dictyostelium
  discoideum_. _Nature_ 408:965–967.
- Tartar V (1961). _The Biology of Stentor._ Pergamon.
- Miao W, Simpson AGB, Fu C, Lobban CS (2005). The giant zooxanthellae-bearing ciliate _Maristentor dinoferus_
  (Heterotrichea) is closely related to Folliculinidae. _Journal of Eukaryotic Microbiology_ 52:11–16.
- Phytoplankton references for _Eutreptiella_ (marine euglenids), _Asterionellopsis glacialis_ (UBC phytoplankton
  database) and _Dunaliella_; the cast ticket checks each real-life line against a cited page, as giants.md §3.5.12 does.
