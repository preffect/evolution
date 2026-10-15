# Evolution — Architecture: constants, file plan and test plan

§9–§11 of the split [`ARCHITECTURE.md`](../ARCHITECTURE.md), which keeps the shared context and the file list.

## 9. Constants and balance (decision, one home)

`packages/shared/src/constants/<domain>.ts` is the **source of truth** for every tunable, named
exactly as the design tables name it (`game-design/constants-and-acceptance.md §12`, `ecology/constants.md §7`, `PROGRESSION.md §6`,
`traits/constants-and-acceptance.md §5`, `game-design/early-life.md §15.12.1`, `game-design/phases.md §14.14.1`). `packages/shared/src/constants/balance.ts` assembles them into one
`DEFAULT_BALANCE = { world, session, worldClock, controls, ladder, ecology, growth, wildCells, giants, absorption, earlyLife, progression, traits, eras, pool, poolCreatures }`
(the domain modules spread into plain records; `giants` leaves out `GIANT_ROLE_BY_SPECIES`, a plain constant of
`giants.ts` because a role is what a species is and no patch may change it (ecology/giants.md §3.5.14); `ladder` leaves out `ENDOSYMBIOSIS_BACTERIA_REQUIRED`, which reaches a
room only as the endosymbionts' `unlockedBy.count` in `traits.TRAIT_CATALOG`, the number the draft gate and the
ladder orbit read, so there is one copy on the wire, #286; being catalog structure inside an array, it is not
`debug_set_balance`-patchable, so the count is a build-time constant and retuning the endosymbiosis trip is a code
change; and no domain carries a constant computed from other constants of its module, below) and `BalanceConfig`, which is `typeof DEFAULT_BALANCE`
with every number leaf widened to `number` (a constant declared `= 3000` has the literal type `3000`; a
patched copy holds other numbers). A patchable non-number leaf (one `debug_set_balance` declares a kind for,
architecture/debug-mcp.md §8) is declared with its widened type, never its literal: an id with its id type
(`LATCH_FROM_STAGE: CellStage`), a list with its element type (`ERAS_IN_PLAY: readonly GameEra[]`, not `['dish'] as const`;
`SWALLOW_GATE_TRAITS: readonly TraitId[]`), so a
patched value never lies to the type; `balance-leaf-kinds.test.ts` checks that each declared leaf's default passes its
own kind. The record is deep-frozen: it aliases the module constants, so a room
that patched it without cloning would rewrite every room and the constants themselves; `applyBalancePatch`
returns a fresh copy and never writes its input.
`data/balance.json` is **generated** from `DEFAULT_BALANCE` by `scripts/generate-balance.ts`,
checked in as the diffable reference the debug tools quote, and pinned by
`balance.test.ts` (file equals `DEFAULT_BALANCE`, so hand edits fail the gate). At runtime each
room starts from a copy of `DEFAULT_BALANCE`; `debug_set_balance` patches number leaves and the declared
non-number leaves (a stage id: `earlyLife.LATCH_FROM_STAGE`; a trait-id list: `absorption.SWALLOW_GATE_TRAITS`; the
era list: `eras.ERAS_IN_PLAY`; architecture/debug-mcp.md §8) and the world carries the live copy. Tier numbers are read from `balance.traits.TRAIT_TIERS` only:
`TRAIT_CATALOG[n].tiers` is structure and is never read for a number (the JSON writes both because a
catalog row carries its tiers), so a patch has one path. The one number read from catalog structure is
`TRAIT_CATALOG[n].unlockedBy.count` (above), which has no patch path at all. Nothing reads `data/balance.json` at
runtime. The full rule set is `CODE-STANDARDS.md §2`.
**Derived constants are not balance leaves (#367).** A constant computed from balance leaves (today
`ENGULF_BASE_DURATION_SECONDS`, `ENGULF_WRAP_START_PROGRESS` and `ENGULF_SEAL_PROGRESS`, from the three engulf phase
seconds, and `ERA_LANDMARK_RADIUS`, `DISH_RADIUS / ERA_SCALE_STEP`) is listed in `DERIVED_BALANCE_CONSTANTS`, exported
beside `DEFAULT_BALANCE` in `balance.ts`, and declared outside the domain module the balance spreads
(`constants/absorption-derived.ts` beside `absorption.ts`, `constants/eras-derived.ts` beside `eras.ts`). Everything
that needs its value derives it at read time from the room's leaves through the shared function that owns the formula
(`engulfBaseDurationSeconds`, `engulfWrapStartProgress`, `engulfSealProgress` in `simulation/engulf-pace.ts`;
`eraLandmarkRadius` in `simulation/era-scale.ts`), so a
patched source leaf is felt and there is no second copy to disagree with it; the named export is the defaults' value,
for the docs and the ledger, computed by the same function over the domain module. The `*-derived.ts` modules are the
only constants modules allowed to import `simulation/`, and the formula module each calls (`engulf-pace.ts`,
`era-scale.ts`) imports leaf constants modules only, never the `constants/index.ts` barrel, so loading the constants can never cycle through it.
`balance.test.ts` pins that no domain carries a listed name, and `constants-ledger.test.ts` that the `derived` rows
of the design tables (a row whose later cell reads `(derived …`) are exactly the list, so a new derived constant cannot
reach the balance untagged. The `(derived` marker in a constants-table row is reserved for constants derived from
balance leaves; any other derived value (`TICK_INTERVAL_MS` beside `TICK_HZ`, say) says so in prose.
**Giant records are keyed by species (ecology/giants.md §3.5.14).** The `giants` domain's number records
(`GIANT_BORN_MASS_MIN_BY_SPECIES.giant_amoeba`, …) are patchable leaves; `GIANT_SPECIES_IN_DISH` and
`GIANT_BUILDS_BY_SPECIES` are arrays, so structure, refused by a patch as `WILD_CELL_BUILDS` is (a test or fixture
balance sets them). `debug_set_balance` refuses a patch whose result breaks a rule `giantBalanceProblems`
(`simulation/giant-balance.ts`) checks; `constants/giants.test.ts` pins the same rules on `DEFAULT_BALANCE` (G14).
`constants/camera.ts` is not a balance domain, yet the wild cells' sight reads its zoom curve through
`viewHalfHeightFor` (ecology/wild-cells.md §3.3.3): a zoom change is a simulation change, and the patchable sight
knob is `wildCells.WILD_CELL_SIGHT_VIEW_MULTIPLE` (server-simulation.md §3.4).
**The eras' three domains (game-design/phases.md §14.14, ticket #867).** `eras` (the era starts, `ERAS_IN_PLAY`, the
move), `pool` (the rock pool's world) and `poolCreatures` (its creatures) hold the stage 1 table's rows; the arena keeps
`DISH_RADIUS`, so there is no pool radius. `ERA_START_SECONDS` is a record keyed by `GameEra` whose numbers are
patchable leaves; `debug_set_balance` refuses starts `eraBalanceProblems` (`simulation/era-clock.ts`) finds, the rule
`era-clock.test.ts` pins on `DEFAULT_BALANCE`. The colonies' domains (stage 2, §14.14.2) arrive with their own ledger
registration (ticket #884), so the ledger never reads a row whose file does not exist.

## 10. File plan (target ≤ 250 lines per file; 300 is the lint cap)

```text
packages/shared/src/
  constants/{index,units,network,lobby,identity}.ts            (template, already split)
  constants/{world,session,world-clock,controls,ladder,camera,ecology,growth,wild-cells,giants,absorption,early-life,progression,traits,eras,pool,pool-creatures}.ts
  constants/balance.ts                                          DEFAULT_BALANCE, BalanceConfig, DERIVED_BALANCE_CONSTANTS
  constants/{absorption-derived,eras-derived}.ts                the engulf base duration and progress bands, and the landmark's radius, at the defaults, derived from absorption.ts and eras.ts (+ world.ts); not in balance (§9)
  constants/trait-modifiers.ts                                  DEFAULT_CELL_MODIFIERS and one tier table per trait, re-exported by traits.ts
  constants/{simulation,netcode}.ts                             engineering constants (CODE-STANDARDS §2), not tunables
  constants/interest.ts                                         viewport culling: the covered aspect, the camera history and the margin, derived (wire-contract.md §4.2 lever 1)
  constants/audio.ts                                            SOUND_EVENT_CATALOG and the layering numbers (AUDIO.md §2, §3); cosmetic, not in balance.json
  types/{common,messages,game,pool,traits,effects,audio}.ts     pool: the rock pool's views (its layout, the surge, the copepod's lane); traits: TraitDefinition, CellModifiers, TRAIT_CATEGORY, TRAIT_RARITY; audio: SOUND_EVENT, AUDIO_BUS, SoundEventRule
  testing/builders.ts                                           createTestSessionConfig, createTestGameInput, createTestSnapshot, createTestCellView, createTestPlayerProgressView
  testing/{markdown-document,swallow-balance,era-balance}.ts    the design-table reader the ledgers share; withSwallowGateTraits / withEveryCellSwallowing, the one way a test states its swallow switch (game-design/early-life.md §15.8.5, §15.11); withErasInPlay, the one way a test states the eras it plays (game-design/phases.md §14.2.4)
  hashing/fnv1a.ts                                              one FNV-1a fold for label seeds and hash lanes
  random/{random-source,seeded-random,xoshiro128-star-star,label-hash,stream-labels}.ts
  time/{clock,fixed-step-accumulator,units}.ts
  simulation/{movement-kernel,movement-step,mass-curves,level-costs,engulf-eligibility,swallow-gate,engulf-pace,state-hasher,state-hash,vector-math}.ts   engulf-pace: phases, rates, struggle, held speed (ecology/absorption.md §6.1); movement-step: the speed cap and blend the server and the prediction share (#265)
  camera/{camera-follow,interest-margin,era-move-camera}.ts     camera-follow: the camera's follow, zoom and target (game-design/controls-and-scope.md §7), which the client renders through and the server culls with; interest-margin: interestMarginFor(balance), the cull margin over the live balance (wire-contract.md §4.2 lever 1); era-move-camera: remapCameraAcrossMove and moveCameraZoomSecondsAt, the camera across the move (game-design/phases.md §14.4.4). None feeds the simulation, so they sit outside simulation/
  simulation/{world-clock,era-clock,era-scale,pool-layout,pool-creature-shapes,stage-of,entry-rule,bacterium-variant-weights,bacterium-contact,trait-tiers,giant-balance,ladder-check}.ts   worldElapsedSeconds / worldReference / standingAgainstWorld (ecology/food-and-spawn.md §3.1); era-clock: eraAt, eraStartTicks, eraStartedAtTick, eraWarningStartedAtTick, isEraReachable, isEraAfter and eraBalanceProblems, the era from the round clock (game-design/phases.md §14.2.1); era-scale: eraLandmarkRadius, the dish's footprint in the pool (§14.6.3); pool-layout: lightPatchCentreAt (the light patch's centre from the tick and the layout's orbit) and poolThreadEnds (a thread's ends from its centre, its angle and the live length) (§14.5.2); pool-creature-shapes: the nematode's chain (nematodeSegmentCentres) and bounding radius, cellRadiusOf (every cell's radius: its mass's, the landmark's footprint, the nematode's bound) and the copepod's head, per-tick strip and its box (§14.6.4); stageOf(traitIds, balance.ladder); entryMass / entryDnaFloor (PROGRESSION §5); the stage-driven broth variant row (ecology/food-and-spawn.md §3.2); trait-tiers: FIRST_TIER, tierRowOf and tierOfRowIndex, the one tier-to-row rule
                                                                level-costs: FIRST_LEVEL, levelUpCost(level, balance.progression) and cumulativeDnaForLevel, shared with the HUD (ui/hud.md §3.1)
                                                                engulf-eligibility: canEngulf / canContinueEngulf(predator, prey, balance.absorption) (canEngulf reads the predator's species, else its traits through canSwallowByTraits, game-design/early-life.md §15.5.1), meetsEngulfStartRatio (its mass half), eatsCells and hasSpecies (a giant's role, a pool creature's POOL_CREATURE_EATS_CELLS; ecology/absorption.md §6.1, ecology/giants.md §3.5.6) and engulfStartMass(prey, balance.absorption), canEngulf's bound as a figure (the encyclopedia's giant pages, #831)
                                                                swallow-gate: canSwallowByTraits / ownsSwallowGateTrait(traits, balance.absorption), the swallow switch's two checks, each read by the rules game-design/early-life.md §15.5.1's table names
                                                                bacterium-contact: bacteriumContactOutcome(cell, heldCount, balance), cell its stage and traits, what a player cell's touch does to a bacterium: swallow, latch or pass (game-design/early-life.md §15.5.1)
                                                                giant-balance: giantBalanceProblems(balance), the giant rules the balance test pins and debug_set_balance refuses on (ecology/giants.md §3.5.14), and giantBuildOf(species, balance), a build as owned traits, which the server seats a giant with and the encyclopedia quotes and previews
                                                                ladder-check: ladderProblem(build, balance), the one valid-ladder rule (stage, requires, exclusion groups) the wild builds' test and giantBalanceProblems share (ecology/wild-cells.md §3.3), and its per-pick part traitPickProblem(trait, before, balance), which the server's draft asks of every card, an upgrade after the other owned ids (PROGRESSION §3)
                                                                vector-math: distanceBetween(origin, target) over Vec2 (the bots' and the simulation's one distance)
  audio/{sound-events,audio-manifest}.ts                        catalogue lookups and layering; the manifest shape + parseAudioManifest (AUDIO.md §4)
  net/snapshot-acknowledger.ts                                  tells the room which tick a client has applied (wire-contract.md §4, #266); the client's RenderSession and the server's socket tests share it so they cannot drift (#664)
packages/server/src/
  lobby/{game-room,ticker,snapshot-backlog}.ts                   room drives the accumulator via Ticker; snapshot-backlog: per-client flow control on the acknowledged tick and the resync it owes (§4, #266)
  lobby/snapshot-dispatch.ts                                     every snapshot and game_state a room sends, and the bytes it reports to the tracker; the room only decides when (§4, #714)
  lobby/viewer-snapshots.ts, ws/snapshot-frame.ts                what each connection is sent (the policy) and the splice that closes one shared stringify per viewer (§4)
  game/evolution-module.ts                                      factory + GameModule (≤ 120 lines)
  game/world/{world-state,entities,cell-record,create-world,entity-ids,lookups,simulation-invariant-error,streams,spatial-hash,state-hash,seat-hashed-fields,era-hashed-section,pool-creature-mirror}.ts   cell-record: the literal every cell is born from (player or wild); state-hash: computeStateHash over the records' HASHED_FIELDS (determinism/ordering-and-state-hash.md §5), the seats' lists in seat-hashed-fields, the eras' section and its gate (hasEraState) in era-hashed-section; pool-creature-mirror: the one writer of a creature cell's poolCreature, its seat's mirror (game-design/phases.md §14.6)
  game/simulation/{step,round,round-clock,inputs,input-coalescing,movement,contact,eating,cell-diet,cell-mass,metabolism,engulf,engulf-state,engulf-payout}.ts   round-clock: the tick-based round clock, worldReferenceAt and roundEraAt (the clock's era at a tick); cell-diet: what a wild cell and each giant eats, read by step 4 and the seat's graze (ecology/giants.md §3.5.7, #827); engulf: the lifecycle step (#258), engulf-state: the record on a cell and every writer of it (the aborts included, so `session/death.ts` never imports the step), engulf-payout: the #259 seam
  game/simulation/{spawner,spawn-rates,spawn-point,spawn-mote,spawn-placement,mote-motion,zones}.ts
  game/simulation/{era-moves,pool-move,move-grace}.ts             the eras in the step (game-design/phases.md §14.2, §14.4, ticket #868): era-moves runs every move the era clock crossed after step 2, in era order, with `era_moved` and the next era's `era_warning`; pool-move: the move into the pool (§14.4.2 steps 1–8); move-grace: the grace the move stores and its two readers (an engulf's start, a seat's hunt)
  game/wild/{wild-seats,wild-build,wild-settle,wild-respawn}.ts   the wild seats (ecology/wild-cells.md §3.3, #176, #517): placement by the safe-spawn rule plus the wild spacing (with the size factor, the first heading and the decision countdown), a seat's build up to a level, the step-1 settle (`settleWildMass`, `wildSizeFactor`: growth, the growth ceiling, recovery; server-simulation.md §3.4), the step-9 respawn (`runSeatRespawns`, shared with the giants)
  game/wild/seat-mind.ts                                         what a wild and a giant seat share (#826): the `SeatMindRecord` at rest and the birth of a seat's cell
  game/wild/seat-profile.ts                                      the seat profile (ecology/giants.md §3.5.15, #827): a wild seat's and each giant's rules order, diet, hunt window, give-up and rest, players-as-prey stage, turn chance, random stream, growth ceiling and respawn, read by the settle, the decision, the give-up, the wander and the respawn
  game/wild/{giant-seats,giant-build,giant-settle,giant-respawn}.ts   the giant seats (ecology/giants.md §3.5, #826): seats by species order, the giant clearance and the `giants` stream's draws, the fixed build with the species speed multiplier's one home (`applyGiantBuild`), the step-1 settle on the born mass under `GIANT_MASS_CEILING` with the quartered decay, the step-9 respawn
  game/wild/{wild-strategy,seat-decision,seat-graze,wild-perception,wild-wander}.ts     the seats' minds (#176, #517, #827): the step-1 cadence, wild seats then giant seats, and one decision by the seat's profile (escape, then its rules of flee, hunt and graze, else wander, and the sprint flag) over the #15 strategies through an entity-id perception filtered to the seat's sight (`wildSightRange` over the shared `viewHalfHeightFor`) and its hunt window, the grazer's forward cone, the wander heading rule
  game/progression/{levels,ladder,draft,offers,dna,modifiers}.ts   levels applies level-ups; the cost formula is shared simulation/level-costs.ts; ladder: the shared stageOf over owned traits
  game/session/{players,membership,entry,death,respawn,leaderboard}.ts   entry: entryState (PROGRESSION §5) composing the shared entryMass / entryDnaFloor for late join and respawn
  game/serialize/{serialize,quantize,food-delta-tracker,era-views}.ts   quantize: the wire rounding and its exact twin (wire-contract.md §4); era-views: the pool's members, the layout from the pool's warning tick (§4 "The pool layout")
  game/serialize/{viewer-state,viewer-cameras,interest-area}.ts  per-viewer members: the culled food delta and fragments over each viewer's camera and area (wire-contract.md §4.2 lever 1); the cameras remapped across the pool's move (§4 "The cameras across the move")
  game/serialize/move-broadcasts.ts                             the broadcasts around the pool's move: whether the next step runs a move (the room closes a broadcast first) and whether a broadcast holds the pool's move (sent as a `game_state`) (wire-contract.md §4 "The move", ticket #868)
  game/serialize/viewer-snapshot-keys.ts                      which members the broadcast carries and which each viewer is sent apart; read by both sides so neither imports the other (wire-contract.md §4, #399)
  game/replay/{replay-format,replay-recorder,recorded-step,replay-runner,index-by-tick}.ts
  game/replay/{recorded-balance,recorded-swallow-switch}.ts   the balance an old recording replays under (its missing leaves filled), and #907's stage switch mapped to the trait switch or refused by name before the replay starts (determinism/replay-tests-and-traps.md §6, game-design/early-life.md §15.10)
  game/debug/{simulation-debug-handle,evolution-debug-handle,debug-entities,debug-operations,debug-giant-spawn,debug-era,balance-patch,balance-leaf-kinds,debug-request-error}.ts   the seam, the Evolution handle (Required<SimulationDebugHandle>), what `debug_get_entities` lists and filters (debug-entities, the pool creatures' species and the copepod's pass included, #935) and the recorded debug mutations (debug-giant-spawn: `debug_spawn('giant')`, #826; debug-era: `debug_set_era` and the era-rewind refusal, #867); balance-leaf-kinds: the non-number balance leaves a patch may write, each path's kind and validator (debug-mcp.md §8, #907)
  game/bots/{bot-strategy,perception,strategy-catalog,strategy-constants}.ts   the strategy seam (ScriptContext, PlayerCommand, BotStrategy), BotPerception (+ ownCellOf, CellLocation), the name → factory catalogue and its constants (#15)
  game/bots/{bot-identity,bot-pilot,bot-binding,in-process-bots}.ts          who a bot is (wire `bot_` / in-process `sim_bot_` prefixes), one bot's brain, BotWorldBinding (+ echo binding, toWireInput), the roster a module drives
  game/bots/{evolution-binding,evolution-bots}.ts                            the Evolution binding over wire snapshots and the roster the Evolution module drives
  game/bots/strategies/{idle,wander,grazer,hunter,flee,forager}.ts           the build-1 strategies (testing/bots-and-design-tables.md §8.3)
  mcp/handlers/<tool>.ts (one file per tool, one shared room lookup)          bots.ts: debug_spawn_bot / debug_remove_bot; eras.ts: debug_set_era
  testing/builders.ts   testing/world-builders.ts   testing/bot-builders.ts   testing/socket-builders.ts  test doubles: rooms and tools; createTestWorld / createTestStepContext / createTestPlayerRecord over the records; strategy contexts, fake transport and socket; a real /ws server on an ephemeral port
  testing/gameplay/*.ts (the scenario runner, #75; re-exports the game/bots seam)   testing/gameplay/strategies/script-sequence.ts (scenario-only)
  testing/gameplay/{evolution-adapter,evolution-fixtures,evolution-views}.ts   the Evolution ScenarioAdapter (testing/scenario-runner.md §8), the placed and world fixtures on a live world (`jumpToThePool`: a row about the move), the table selectors
  testing/era-room.ts                                            the Evolution module with the eras patched on through its debug handle, stepped and drained tick by tick: the era integration rows (phases.md §14.15)
  testing/bot-client/{bot-session,bot-swarm,bot-timing,bot-transport,web-socket-transport,cli,cli-arguments,errors}.ts   the headless wire client (#15): one bot's protocol, N bots, its clock + ticker, the transport seam, the `ws` transport, the CLI and its parser, BotClientError
  testing/scenarios/{ecology-spawn,ecology-cells,game-design-session,game-design-controls,progression}.gameplay.test.ts (+ shared-setups.ts)   the design tables by row (#102)
packages/client/src/app/game/
  game-setup.ts  game-host.component.ts                         the composition root and the element that mounts it
  debug/evolution-debug.ts                                      `window.__evolutionDebug` (dev only): pause / step / resume / setSeed, TESTING.md's screenshot hook
  net/{snapshot-buffer,interpolation,food-store,world-store,own-cell-prediction,own-cell-predictor,pose-correction}.ts          interpolation owns renderTick (section 5); food-store applies the mote deltas; own-cell-prediction replays, own-cell-predictor keeps the inputs and re-bases, pose-correction reconciles (#265)
  net/{connection-state,snapshot-staleness,connection-state.service}.ts   the banner's `connected` / `disconnected` / `stale` (ui/overlays.md §3.6): the pure rule, the `SNAPSHOT_STALE_MS` wait on the injected Scheduler, and the service that restarts it per snapshot (#190)
  input/{input-constants,keyboard-action,input-state,trait-pick,game-input-builder}.ts   the key tables, the Space-precedence and hotkey rules, the state, the trait-pick policy and the GameInput mapping — all pure (ui/input-and-onboarding.md §4)
  input/{dom-input-context,keyboard-input,pointer-input,input-world-context,input-controller,attach-input}.ts   the DOM adapters, the WorldStore adapter, the client-tick controller and the composition
  render/{pixi-app,layers,camera,view-registry,constants,palette,easing}.ts
  render/{cells,food,dish,effects,noise,textures,bench}/**             (the one home of the render/ plan: rendering/files-and-tests.md §8)
  clock-provider.ts                                             the injected Clock token (determinism/contract-and-clock.md §2)
  state/{game-state.service,game-event-bus,snapshot-transitions}.ts   the signal facade; the moment seam of section 6 and its snapshot detector
  state/own-cell-indicators.ts                                  pure ownCellIndicatorsFor: the record the renderer and the status mirror share (ui/hud.md §3.1.4)
  state/own-cell-ladder.ts                                      pure ladderFor: the rung ghost and the endosymbiont counters on the orbit (ui/hud.md §3.1.2)
  state/legibility-cues.ts                                      pure legibilityCuesFor: the record's mass chip, rate tags, zone, sprint cost (ui/hud.md §3.1.5)
  state/mass-trend.ts                                           pure massTrendFor: the chip's net rate and trend with hysteresis (ui/hud.md §3.1.5)
  state/legibility-constants.ts                                 the §3.1.6 rows marked state
  quantities/**  encyclopedia/**                               the one formatter and the encyclopedia registry (the one home of their file plan: architecture/encyclopedia.md §12.8)
  audio/audio-hooks.ts                                          AudioHooks.connect(options): the composition root's one audio call (AUDIO.md §5)
  audio/audio-session.ts                                        AudioSession: the live handle kept through a resync, a new one per room or player (#275)
  audio/{audio.service,sound-event-bus,cue-scheduler,ambient-mixer,audio-buses,audio-asset-cache}.ts
  audio/{audio-backend,web-audio-backend,audio-tokens}.ts       the Web Audio seam, its production impl, the injection tokens (AUDIO.md §5)
  hud/*.component.ts   hud/format/*.ts   hud/{onboarding,toast,hud-state}.service.ts
  hud/{hud-constants,test-ids,trait-glyphs}.ts                  (components and file roles: ui/components-and-constants.md §7)
  ../testing/{builders,fake-websocket,fake-audio-backend,fake-audio-context}.ts   client test doubles (testing/tiers-and-builders.md §4)
assets/audio/manifest.json                                      event → files, mood, length, prompt hint (AUDIO.md §4); the files are gitignored
data/balance.json                                               generated (section 9): `pnpm generate:balance`
scripts/generate-balance.ts
```

Import direction: `types` ← `constants` ← `simulation` (shared); `ladder.ts` and `traits.ts`
reference each other only as types (`TraitId`, `CellStage`), and `traits.ts` imports the value
`ENDOSYMBIOSIS_BACTERIA_REQUIRED` from `ladder.ts`, so there is no runtime cycle. On the server,
`game/bots` ← `game/*` and `testing/*`, never the reverse: no production file imports `src/testing/`.

## 11. Test plan (`engineering/testing-and-typescript.md §2`, `determinism/replay-tests-and-traps.md §7`)

- **Unit:** every system and progression function with a `createTestWorld` builder; movement
  kernel; mass curves; spatial hash vs brute force on seeded populations; serialize round-trip;
  food delta tracker; draft (ladder filter, rung card, weights, timeout pick); `foldModifiers`;
  snapshot buffer / prediction / reconciliation; schemas (`message-schemas.test.ts` bounds);
  `balance.test.ts` (generated file equals `DEFAULT_BALANCE`), `constants-ledger.test.ts` (every design
  table constant exists; each table is found by its heading line at any level, so a `####` table inside a larger
  section, game-design/early-life.md §15.12.1, registers as a `##` one does, #907), `constants-consumers.test.ts` (the
  constants whose doc block claims something about their consumers, checked against the shipping sources).
- **Early life (#907, #948, game-design/early-life.md §15.8.5, §15.13):** the two checks on an empty and a non-empty
  list, owning and not owning a listed trait; the predicate's cases (EL26: a player predator without the gate trait
  fails with the switch on and passes with it off; the giant hunter, the Didinium and the rotifer pass whatever they
  own; the grazer, the drifter and the nematode never do), `bacteriumContactOutcome`'s three answers (EL15 with the
  switch off), the trait-id list patch (EL23: taken, refused for a non-catalog id, a repeated id and a non-list,
  replayed to its hash), the recordings made under #907's stage switch (`replay/recorded-swallow-switch.ts`, two
  pinned exports), and the held list in the state hash. A test about the engulf process states its switch through
  `withEveryCellSwallowing` (`shared/src/testing/swallow-balance.ts`), so it keeps passing when the switch flips.
- **The eras (#867, game-design/phases.md §14.2):** `eraAt` against the era table (each start on its tick, a round
  shorter than an era never reaching it, a negative `roundStartTick`); the stage 1 defaults read from §14.14.1 itself
  (`phases-constants.test.ts`); the era-list leaf (a prefix written as a copy; a non-prefix, a non-list and a list of
  non-strings refused naming the path; the MCP tool forwarding the list); `debug_set_era`'s jump and each refusal, and
  a replay across the jump reproducing its hash. A test about a later era states the eras it plays through
  `withErasInPlay` (`shared/src/testing/era-balance.ts`).
- **Wild cells (#517):** `settleWildMass` and `wildSizeFactor` against ecology W11; the wild perception's sight
  filter against a brute-force distance check on a seeded population (boundary: a centre exactly at the range is
  seen); the wild floor (a 10-mass wild cell that sprints or is drained stays at 10, a player cell floors at 20);
  one seeded long-run invariant test: after every settle, `grownMass ≥ 0`, `fullMass` in `[baseMass, max(baseMass,
3 × worldMass)]` and `cell.mass ≤ fullMass` (plus the tick's own meals), and the state hash covers `sizeFactor`, `grownMass` and `fullMass` (a
  one-field change moves it).
- **Integration:** input → step → snapshot through a real `GameRoom` under a `ManualClock`; late
  join gets a full `game_state` then deltas; reconnect resync; replay reproduces the hash; the
  rematch reseed (`seed + ROUND_SEED_INCREMENT`) produces a fresh world.
- **Gameplay scenarios (#102)** run each design table row by id on the framework (#75);
  **perf (#103)** records step/serialise timings and `snapshotBytes` against sections 3.3 and 4.1.
