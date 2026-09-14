# Evolution — Architecture: client networking, module plan and audio seam

§5–§7 of the split [`ARCHITECTURE.md`](../ARCHITECTURE.md), which keeps the shared context and the file list.

## 5. Client networking policy (`packages/client/src/app/game/net/`)

- **Interpolation.** `SnapshotBuffer` keeps the last `SNAPSHOT_BUFFER_SIZE` snapshots (derived: the delay
  plus a bracket each side, 4 at either cadence) and renders remote cells, bacteria and fragments at
  `renderTick = latestTick − INTERPOLATION_DELAY_TICKS` (`2 × SNAPSHOT_EVERY_TICKS`, two snapshot
  intervals), lerping position, velocity and radius between the bracketing
  snapshots; a missing bracket extrapolates with velocity for at most `MAX_EXTRAPOLATION_TICKS`.
  Two intervals is 6 ticks at the landed cadence, so the world is drawn **100 ms** behind the newest
  snapshot rather than the 33 ms it was while the room broadcast every tick (#214). That is the
  cadence's one cost on the client: an effect fires when the render tick reaches its tick, so it
  fires 100 ms after the moment it marks. What a frame can no longer reach is dropped rather than
  queued; the two bullets below own that rule and the deadline it puts on the client.
- **Prediction: one input per tick.** The client's input controller (`input/input-controller.ts`, #184)
  runs its own tick counter at `TICK_HZ` and sends exactly one `GameInput` per client tick with
  `sequence` = client tick; the ticks come from the injected clock through a `FixedStepAccumulator`
  pumped once per animation frame, so game code owns no timer (`CODE-STANDARDS.md §8`). The counter
  never starts below `appliedInputSequenceByPlayer[me]`: a reconnect gives the page a fresh
  controller against the server's existing player record, and a counter restarted at 1 would have
  every input dropped as stale (`isStaleInput`, section 3.2). The
  prediction and reconciliation below are **#265**: today the own cell is interpolated like any
  other. On a
  snapshot at tick `T` carrying `appliedInputSequenceByPlayer[me] = S`, the own cell's
  authoritative pose is "tick `T` after input `S`". The client then re-runs the shared movement
  kernel for its unacknowledged inputs `S + 1 … latest`, assuming input `S + i` was applied at
  tick `T + i` (the server applies the newest pending input each tick; with one input per tick
  the two counters advance together). When jitter makes the server coalesce two inputs into one
  tick the assumption is off by one tick for one snapshot, and reconciliation absorbs it. Mass,
  radius, stage, traits, engulf state and death are never predicted.
- **Reconciliation.** Differences under `RECONCILE_SNAP_DISTANCE_WU` blend out over
  `RECONCILE_BLEND_SECONDS`; larger ones snap. `WorldStore` is the single client model; the
  Angular `GameStateService` is its signal facade for the HUD, not a second model.
- **Clock.** `serverTickEstimate` comes from snapshot arrival times (EMA) through the client's
  injected `Clock`; a republished snapshot at the latest tick (a debug mutation, §8) replaces the
  frame and is not observed, since it is a new world, not a new arrival; nothing in `game/` reads
  `Date.now` (`DETERMINISM.md §1`).
- **Snapshots are applied on arrival, in order.** A `game_snapshot` is a delta (§4), so the
  transport publishes every one on `messages$` and `RenderSession` applies it to `WorldStore`
  as it arrives; the frame loop only reads (`nextFrame()`, which also releases the effects due),
  so a frame hitch or a background tab never loses a spawn, a removal or an effect. Nothing
  coalesces snapshots.
- **Nothing on the ingest path grows without bound.** A client can ingest far faster than it draws,
  and a background tab draws nothing at all while its socket keeps delivering. #274's flow control
  does not reach this case: the acknowledgement is sent from `RenderSession.onMessage`, on ingest, so
  a client that ingests fine and draws slowly acknowledges promptly, the room measures a shallow
  queue and keeps streaming. Every structure a snapshot feeds is therefore bounded by construction
  and not by the frame rate: `SnapshotBuffer` by `SNAPSHOT_BUFFER_SIZE`, `FoodStore` by the motes
  alive in the world, and `WorldStore.pendingEffects` by the rule below. This does not weaken the
  arrival rule above — a snapshot is still never dropped or merged, only what a frame can still use
  is kept.
- **Effects older than the buffer are dropped, not queued.** An effect waits in `pendingEffects`
  until the render tick reaches its tick. `renderTickFor` never answers before the oldest buffered
  snapshot, so an effect older than that has been overtaken; `applySnapshot` drops those on arrival.
  Measured: 8 000 snapshots ingested with no frame drawn retained 8 000 effects before this rule and
  4 after.
- **The window, and the deadline it puts on the client.** _A client that draws at least one frame
  every `EFFECT_DRAW_WINDOW_TICKS` sees every effect; one that draws slower misses some, and a missed
  effect is never drawn rather than drawn late._ The window is `(SNAPSHOT_BUFFER_SIZE − 1) ×
SNAPSHOT_EVERY_TICKS − INTERPOLATION_DELAY_TICKS + 1` (`netcode.ts`), which is **4 ticks, 67 ms, a
  15 fps obligation at `SNAPSHOT_EVERY_TICKS` = 3**. Every frame-rate figure here is that cadence's;
  the window is not cadence-invariant and neither are they.

  It is the _worst_ effect phase, not the typical one. The render tick advances continuously, but the
  drop lands on a broadcast, so an effect's window depends on `T mod SNAPSHOT_EVERY_TICKS`: 6 ticks at
  phase 0, 5 at phase 1, 4 at phase 2. `serializeDelta` splices a whole interval of ticks into each
  delta, so the wire carries all three phases and only the guaranteed one is worth publishing.
  Measured on the real `WorldStore` over 300 broadcasts carrying every phase, frames on their own
  clock:

  | frame every | fps at this cadence | effects fired of 900 |
  | ----------- | ------------------- | -------------------- |
  | 1–4 ticks   | 60–15               | 900 (100 %)          |
  | 5 ticks     | 12                  | 840 (93.3 %)         |
  | 6 ticks     | 10                  | 598 (66.4 %)         |
  | 12 ticks    | 5                   | 303 (33.7 %)         |
  | 30 ticks    | 2                   | 126 (14.0 %)         |

  The cliff lands exactly on the window, and the loss just past it is steep rather than gradual
  because the drop is half-open: it runs inside the `applySnapshot` that carries the buffer past the
  effect, and a frame at that same instant runs after it.

  **The direction is the surprising part.** The expression reduces to `(BRACKET_SNAPSHOTS − 1) ×
SNAPSHOT_EVERY_TICKS + 1`, so the bracket buys the whole budget and a **faster** cadence buys a
  **tighter** deadline: 2 ticks and a 30 fps obligation at 60 Hz, against 4 ticks and 15 fps at 20 Hz.
  §4.2 lever 2 has to carry `BRACKET_SNAPSHOTS` with it if the floor is ever too high, and
  `netcode.test.ts` gates that rather than describing it. The cross-cadence numbers are a simulation
  (`window2.mjs`, on the #284 review), not a test: the constants compile at one cadence, so a spec
  cannot execute another — #287 is the extraction that would change that.

- **Every applied snapshot is acknowledged** (#266, §4). `RenderSession` tells the room the tick it
  has just applied — at once for a `game_state`, every `SNAPSHOT_ACK_EVERY_SNAPSHOTS` for a delta —
  and a `game_state` that arrives mid-stream is the room's resync: `applyGameState` already replaces
  the whole view, so the client needs no new behaviour to recover from falling behind.

## 6. Client module plan (Pixi v8 + Angular)

```text
 Angular <app-game> host component
   └─ game-setup.ts (composition root, < 100 lines): wires net, input, render, hud, audio
 Pixi Application (one canvas, resolution = devicePixelRatio)
   stage
   ├─ dishLayer      dark-field background, wall rim, zones, gel patches (cached render texture)
   ├─ foodLayer      algae / detritus / bacteria by variant (ParticleContainer), fragments by tag
   ├─ cellLayer      CellView: one instanced quad + SDF shader per cell, organelle sprites (RENDERING.md)
   │                 (traits/catalog-organelles.md §3.0: no nucleus until nuclear_envelope), sorted by radius ascending
   ├─ effectsLayer   eat pulse, engulf stretch, cell_absorbed dissolve, level-up burst, respawn fade
   └─ debugLayer     spatial hash / ids, toggled by the debug MCP
 HTML overlay (Angular, above the canvas, every element with a data-testid)
   components: ui/components-and-constants.md §7 (the one home of the HUD component list, #30)
```

- **Camera** (`render/camera.ts`) implements game-design/controls-and-scope.md §7 from `constants/camera.ts`; render-only
  numbers (`PROTOCELL_GRANULE_COUNT`, palettes, layer z, wobble amplitude) live in `render/constants.ts`.
- **View registry**: entity id → view, created/destroyed on snapshot diff; views are dumb.
- **HUD** reads `WorldStore` through `GameStateService` signals (derived only; the writable UI
  signals live in `hud/hud-state.service.ts`); the renderer never touches the DOM, the HUD never
  touches Pixi. The four crossings (`previewTraitId`, `reticleVisible`, `ownCellIndicators` in;
  `cameraExtent` out) are wired in `game-setup.ts` so `render/` never imports from `hud/` (ui/components-and-constants.md §7);
  the own cell's progress indicators are drawn by the renderer from that record (ui/hud.md §3.1, rendering/own-cell-indicators.md §10).
- **Game events** (`state/game-event-bus.ts`, `GameEventBus`, #101): the one client seam for _moments_, as
  opposed to the state the signals carry. `state/snapshot-transitions.ts` turns each snapshot into them: every
  server `GameEffect` (tagged `isOwn` / `isOwnPredator`), the own cell's `stage_changed` and `organelle_gained`,
  `danger_changed` through the shared `canEngulf`, `engulf_progress` / `engulf_ended`, `round_phase_changed` and
  `bloom_started`. The renderer raises the moments only it knows (`zone_changed` from the dish geometry,
  `trait_cue` at a trait's keyframe, traits/catalog-organelles.md §3) and the HUD raises `trait_picked` and `ui_click`. Subscribers
  (the sound bus today; the toast and onboarding services, the effects layer) never see each other, and
  `game-setup.ts` is the only place that feeds the tracker and connects the subscribers (`AUDIO.md` §5).
- **Cosmetics** draw from the round seed's cosmetic stream and its `COSMETIC_SUB_STREAM` forks
  (`rendering/cells.md §1` owns the derivation) so a paused screenshot reproduces.
- **Frame budget** (#99): 60 fps, ≤ 12 ms p95 frame time at the 8-player baseline above (8 cells, 1 400 motes,
  110 fragments) at 1080p; the per-stage budget, the 100-cell bench scene that proves headroom above that
  baseline, and how a cell is drawn are [`rendering/budget.md`](../rendering/budget.md) §7.

## 7. Audio hook seam (#101)

The design and the tables are [`AUDIO.md`](../AUDIO.md) (decision #140, option B). The ids are
`SOUND_EVENT` in `types/audio.ts` (the trait cues are the `audioCue` values of traits/catalog-organelles.md §3, typed as
`SoundEventId`); the rules (priority, cooldown, loop, bus) and the layering numbers are
`constants/audio.ts`, cosmetic data like `motion.ts`; `audio/sound-events.ts` holds the lookups and
`audio/audio-manifest.ts` the manifest shape and its one validator. On the client, `SoundEventBus`
(`audio/sound-event-bus.ts`) subscribes to the `GameEventBus` of section 6 and is the one place that
knows which moment plays which cue; `AudioService` resolves each through `assets/audio/manifest.json`
and plays via Web Audio behind the `AudioBackend` seam (`audio-backend.ts`; `web-audio-backend.ts` is
the only file that knows `AudioContext`), with `CueScheduler` (cooldown, overlap by priority),
`AmbientMixer` (stem per stage, zone overlay, duck) and `AudioBuses` (`master` → `music`, `sfx`; the
persisted mute). **Silent when the manifest or an asset is missing, never throwing.** Nothing but the
sound bus plays through `AudioService`; the HUD's mute toggle is its only other caller. Time is the
injected `CLOCK` (`clock-provider.ts`) and the audio clock, never a JS timer.
