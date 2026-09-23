# Evolution — Architecture: constants, file plan and test plan

§9–§11 of the split [`ARCHITECTURE.md`](../ARCHITECTURE.md), which keeps the shared context and the file list.

## 9. Constants and balance (decision, one home)

`packages/shared/src/constants/<domain>.ts` is the **source of truth** for every tunable, named
exactly as the design tables name it (`game-design/constants-and-acceptance.md §12`, `ecology/constants.md §7`, `PROGRESSION.md §6`,
`traits/constants-and-acceptance.md §5`). `packages/shared/src/constants/balance.ts` assembles them into one
`DEFAULT_BALANCE = { world, session, worldClock, controls, ladder, ecology, growth, wildCells, absorption, progression, traits }`
(the domain modules spread into plain records; `ladder` leaves out `ENDOSYMBIOSIS_BACTERIA_REQUIRED`, which reaches a
room only as the endosymbionts' `unlockedBy.count` in `traits.TRAIT_CATALOG`, the number the draft gate and the
ladder orbit read, so there is one copy on the wire, #286; being catalog structure inside an array, it is not
`debug_set_balance`-patchable, so the count is a build-time constant and retuning the endosymbiosis trip is a code
change) and `BalanceConfig`, which is `typeof DEFAULT_BALANCE`
with every number leaf widened to `number` (a constant declared `= 3000` has the literal type `3000`; a
patched copy holds other numbers). The record is deep-frozen: it aliases the module constants, so a room
that patched it without cloning would rewrite every room and the constants themselves; `applyBalancePatch`
returns a fresh copy and never writes its input.
`data/balance.json` is **generated** from `DEFAULT_BALANCE` by `scripts/generate-balance.ts`,
checked in as the diffable reference the debug tools quote, and pinned by
`balance.test.ts` (file equals `DEFAULT_BALANCE`, so hand edits fail the gate). At runtime each
room starts from a copy of `DEFAULT_BALANCE`; `debug_set_balance` patches number leaves only and the
world carries the live copy. Tier numbers are read from `balance.traits.TRAIT_TIERS` only:
`TRAIT_CATALOG[n].tiers` is structure and is never read for a number (the JSON writes both because a
catalog row carries its tiers), so a patch has one path. The one number read from catalog structure is
`TRAIT_CATALOG[n].unlockedBy.count` (above), which has no patch path at all. Nothing reads `data/balance.json` at
runtime. The full rule set is `CODE-STANDARDS.md §2`.
`constants/camera.ts` is not a balance domain, yet the wild cells' sight reads its zoom curve through
`viewHalfHeightFor` (ecology/wild-cells.md §3.3.3): a zoom change is a simulation change, and the patchable sight
knob is `wildCells.WILD_CELL_SIGHT_VIEW_MULTIPLE` (server-simulation.md §3.4).

## 10. File plan (target ≤ 250 lines per file; 300 is the lint cap)

```text
packages/shared/src/
  constants/{index,units,network,lobby,identity}.ts            (template, already split)
  constants/{world,session,world-clock,controls,ladder,camera,ecology,growth,wild-cells,absorption,progression,traits}.ts
  constants/balance.ts                                          DEFAULT_BALANCE, BalanceConfig
  constants/trait-modifiers.ts                                  DEFAULT_CELL_MODIFIERS and one tier table per trait, re-exported by traits.ts
  constants/{simulation,netcode}.ts                             engineering constants (CODE-STANDARDS §2), not tunables
  constants/interest.ts                                         viewport culling: the covered aspect, the camera history and the margin, derived (wire-contract.md §4.2 lever 1)
  constants/audio.ts                                            SOUND_EVENT_CATALOG and the layering numbers (AUDIO.md §2, §3); cosmetic, not in balance.json
  types/{common,messages,game,traits,effects,audio}.ts          traits: TraitDefinition, CellModifiers, TRAIT_CATEGORY, TRAIT_RARITY; audio: SOUND_EVENT, AUDIO_BUS, SoundEventRule
  testing/builders.ts                                           createTestSessionConfig, createTestGameInput, createTestSnapshot, createTestCellView, createTestPlayerProgressView
  hashing/fnv1a.ts                                              one FNV-1a fold for label seeds and hash lanes
  random/{random-source,seeded-random,xoshiro128-star-star,label-hash,stream-labels}.ts
  time/{clock,fixed-step-accumulator,units}.ts
  simulation/{movement-kernel,movement-step,mass-curves,level-costs,engulf-eligibility,engulf-pace,state-hasher,state-hash,vector-math}.ts   engulf-pace: phases, rates, struggle, held speed (ecology/absorption.md §6.1); movement-step: the speed cap and blend the server and the prediction share (#265)
  camera/{camera-follow,interest-margin}.ts                     camera-follow: the camera's follow, zoom and target (game-design/controls-and-scope.md §7), which the client renders through and the server culls with; interest-margin: interestMarginFor(balance), the cull margin over the live balance (wire-contract.md §4.2 lever 1). Neither feeds the simulation, so they sit outside simulation/
  simulation/{world-clock,stage-of,entry-rule,bacterium-variant-weights,trait-tiers}.ts   worldElapsedSeconds / worldReference / standingAgainstWorld (ecology/food-and-spawn.md §3.1); stageOf(traitIds, balance.ladder); entryMass / entryDnaFloor (PROGRESSION §5); the stage-driven broth variant row (ecology/food-and-spawn.md §3.2); trait-tiers: FIRST_TIER, tierRowOf and tierOfRowIndex, the one tier-to-row rule
                                                                level-costs: FIRST_LEVEL, levelUpCost(level, balance.progression) and cumulativeDnaForLevel, shared with the HUD (ui/hud.md §3.1)
                                                                engulf-eligibility: canEngulf / canContinueEngulf(predator, prey, balance.absorption) (ecology/absorption.md §6.1)
                                                                vector-math: distanceBetween(origin, target) over Vec2 (the bots' and the simulation's one distance)
  audio/{sound-events,audio-manifest}.ts                        catalogue lookups and layering; the manifest shape + parseAudioManifest (AUDIO.md §4)
packages/server/src/
  lobby/{game-room,ticker,snapshot-backlog}.ts                   room drives the accumulator via Ticker; snapshot-backlog: per-client flow control on the acknowledged tick and the resync it owes (§4, #266)
  lobby/viewer-snapshots.ts, ws/snapshot-frame.ts                what each connection is sent (the policy) and the splice that closes one shared stringify per viewer (§4)
  game/evolution-module.ts                                      factory + GameModule (≤ 120 lines)
  game/world/{world-state,entities,cell-record,create-world,entity-ids,lookups,simulation-invariant-error,streams,spatial-hash,state-hash}.ts   cell-record: the literal every cell is born from (player or wild); state-hash: computeStateHash over the records' HASHED_FIELDS (determinism/ordering-and-state-hash.md §5)
  game/simulation/{step,round,round-clock,inputs,input-coalescing,movement,contact,eating,cell-mass,metabolism,engulf,engulf-state,engulf-payout}.ts   round-clock: the tick-based round clock and worldReferenceAt; engulf: the lifecycle step (#258), engulf-state: the record on a cell and every writer of it (the aborts included, so `session/death.ts` never imports the step), engulf-payout: the #259 seam
  game/simulation/{spawner,spawn-rates,spawn-point,spawn-mote,spawn-placement,mote-motion,zones}.ts
  game/wild/{wild-seats,wild-build,wild-settle,wild-respawn}.ts   the wild seats (ecology/wild-cells.md §3.3, #176, #517): placement by the safe-spawn rule plus the wild spacing (with the size factor, the first heading and the decision countdown), a seat's build up to a level, the step-1 settle (`settleWildMass`, `wildSizeFactor`: growth, the growth ceiling, recovery; server-simulation.md §3.4), the step-9 respawn
  game/wild/{wild-strategy,wild-perception,wild-wander}.ts     the wild minds (#176, #517): the step-1 decisions (flee, hunt, graze, wander, and the sprint flag) over the #15 strategies through an entity-id perception filtered to the seat's sight (`wildSightRange` over the shared `viewHalfHeightFor`), the wander heading rule
  game/progression/{levels,ladder,draft,offers,dna,modifiers}.ts   levels applies level-ups; the cost formula is shared simulation/level-costs.ts; ladder: the shared stageOf over owned traits
  game/session/{players,membership,entry,death,respawn,leaderboard}.ts   entry: entryState (PROGRESSION §5) composing the shared entryMass / entryDnaFloor for late join and respawn
  game/serialize/{serialize,quantize,food-delta-tracker}.ts   quantize: the wire rounding and its exact twin (wire-contract.md §4)
  game/serialize/{viewer-state,viewer-cameras,interest-area}.ts  per-viewer members: the culled food delta and fragments over each viewer's camera and area (wire-contract.md §4.2 lever 1)
  game/serialize/viewer-snapshot-keys.ts                      which members the broadcast carries and which each viewer is sent apart; read by both sides so neither imports the other (wire-contract.md §4, #399)
  game/replay/{replay-format,replay-recorder,recorded-step,replay-runner,index-by-tick}.ts
  game/debug/{simulation-debug-handle,evolution-debug-handle,debug-operations,balance-patch,debug-request-error}.ts   the seam, the Evolution handle (Required<SimulationDebugHandle>) and the recorded debug mutations
  game/bots/{bot-strategy,perception,strategy-catalog,strategy-constants}.ts   the strategy seam (ScriptContext, PlayerCommand, BotStrategy), BotPerception (+ ownCellOf, CellLocation), the name → factory catalogue and its constants (#15)
  game/bots/{bot-identity,bot-pilot,bot-binding,in-process-bots}.ts          who a bot is (wire `bot_` / in-process `sim_bot_` prefixes), one bot's brain, BotWorldBinding (+ echo binding, toWireInput), the roster a module drives
  game/bots/{evolution-binding,evolution-bots}.ts                            the Evolution binding over wire snapshots and the roster the Evolution module drives
  game/bots/strategies/{idle,wander,grazer,hunter,flee}.ts                   the build-1 strategies (testing/bots-and-design-tables.md §8.3)
  mcp/handlers/<tool>.ts (one file per tool, one shared room lookup)          bots.ts: debug_spawn_bot / debug_remove_bot
  testing/builders.ts   testing/world-builders.ts   testing/bot-builders.ts   testing/socket-builders.ts  test doubles: rooms and tools; createTestWorld / createTestStepContext / createTestPlayerRecord over the records; strategy contexts, fake transport and socket; a real /ws server on an ephemeral port
  testing/gameplay/*.ts (the scenario runner, #75; re-exports the game/bots seam)   testing/gameplay/strategies/script-sequence.ts (scenario-only)
  testing/gameplay/{evolution-adapter,evolution-fixtures,evolution-views}.ts   the Evolution ScenarioAdapter (testing/scenario-runner.md §8), the placed and world fixtures on a live world, the table selectors
  testing/bot-client/{bot-session,bot-swarm,bot-timing,bot-transport,web-socket-transport,cli,cli-arguments,errors}.ts   the headless wire client (#15): one bot's protocol, N bots, its clock + ticker, the transport seam, the `ws` transport, the CLI and its parser, BotClientError
  testing/scenarios/{ecology-spawn,ecology-cells,game-design-session,game-design-controls,progression}.gameplay.test.ts (+ shared-setups.ts)   the design tables by row (#102)
packages/client/src/app/game/
  game-setup.ts  game-host.component.ts                         the composition root and the element that mounts it
  debug/evolution-debug.ts                                      `window.__evolutionDebug` (dev only): pause / step / resume / setSeed, TESTING.md's screenshot hook
  net/{snapshot-buffer,interpolation,food-store,world-store,snapshot-acknowledger,own-cell-prediction,own-cell-predictor,pose-correction}.ts          interpolation owns renderTick (section 5); food-store applies the mote deltas; snapshot-acknowledger tells the room which tick this client has applied (§4, #266); own-cell-prediction replays, own-cell-predictor keeps the inputs and re-bases, pose-correction reconciles (#265)
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
  table constant exists).
- **Wild cells (#517):** `settleWildMass` and `wildSizeFactor` against ecology W11; the wild perception's sight
  filter against a brute-force distance check on a seeded population (boundary: a centre exactly at the range is
  seen); the wild floor (a 10-mass wild cell that sprints or is drained stays at 10, a player cell floors at 20);
  one seeded long-run invariant test: after every settle, `grownMass ≥ 0`, `fullMass ≤ max(baseMass, 3 ×
worldMass)` and `cell.mass ≤ fullMass`, and the state hash covers `sizeFactor`, `grownMass` and `fullMass` (a
  one-field change moves it).
- **Integration:** input → step → snapshot through a real `GameRoom` under a `ManualClock`; late
  join gets a full `game_state` then deltas; reconnect resync; replay reproduces the hash; the
  rematch reseed (`seed + ROUND_SEED_INCREMENT`) produces a fresh world.
- **Gameplay scenarios (#102)** run each design table row by id on the framework (#75);
  **perf (#103)** records step/serialise timings and `snapshotBytes` against sections 3.3 and 4.1.
