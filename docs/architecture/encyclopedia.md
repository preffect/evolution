# Evolution — Architecture: encyclopedia content model and preview seam

§12 of the split [`ARCHITECTURE.md`](../ARCHITECTURE.md), which keeps the shared context and the file list. The
player-facing half (categories' names and order, navigation, layouts, the UI kit) is the ui-designer's spec (#354);
this file decides the data: where entries live, how every number on a page is bound to code, where prose lives, what
the completeness tests pin, and how the game's real renderers draw an animated preview outside a room (#355, epic
#353).

## 12. Encyclopedia

### 12.1 Decisions (the short list)

1. **The registry is client code** (`packages/client/src/app/game/encyclopedia/`). Its titles, prose and labels
   are player-facing copy like the HUD's; nothing on the server or in the debug MCP reads it. It imports catalog
   structure and pure formulas from `@evolution/shared` and never a tunable constant (§12.6's lint guard).
2. **No number is typed in an entry.** A fact names where its value comes from: a balance leaf, a formula over the
   balance through a shared function, or a catalog structure number. The balance is the **live** one: the room's
   `game_state.balance` / `balance_updated` copy while in a room, `DEFAULT_BALANCE` outside one, so a
   `debug_set_balance` patch re-renders an open page.
3. **Completeness is a type first and a test second.** Every per-kind content table is a `Record` keyed by the code's
   closed union (`Record<TraitId, …>`, `Record<ZoneId, …>`), so a new trait or zone without an entry fails
   `typecheck`; the completeness spec then pins the assembled registry against the same sets at runtime.
4. **One formatter** (`packages/client/src/app/game/quantities/`) turns a number and a unit into text for the
   encyclopedia and the HUD alike; the trait cards' private helpers move onto it.
5. **Prose carries no digits.** It references the entry's facts by key (`{massGain}`) and other entries by id
   (`[[trait:cell_wall]]`); a spec rejects any digit in prose.
6. **The preview is a second, small Pixi app running the real `GameRenderer`** on a scripted fixture scene with a
   local animation clock — the bench route's pattern (`rendering/budget.md §7`), never the room's store, snapshot or
   socket. One preview app per open encyclopedia, reused across entries, destroyed when the encyclopedia closes.

### 12.2 Registry: categories, subjects, ids

**Categories** are the closed player-facing grouping; **subjects** are the code kinds an entry documents. An entry
has exactly one of each; the id is built from the subject, so regrouping entries never renames an id.

```ts
// encyclopedia/model/categories.ts
export const ENCYCLOPEDIA_CATEGORY = {
  entities: 'entities',
  evolutions: 'evolutions',
  abilities: 'abilities',
  actions: 'actions',
  world: 'world',
} as const;
export type EncyclopediaCategory = ValueOf<typeof ENCYCLOPEDIA_CATEGORY>;
/** The navigation order; pinned complete against the object. Names and order are #354's. */
export const ENCYCLOPEDIA_CATEGORY_ORDER: readonly EncyclopediaCategory[] = [/* #354 */];

// encyclopedia/model/entry-id.ts
export const ENTRY_SUBJECT = {
  cellKind: 'cell_kind', // entities: CELL_KIND
  food: 'food', // entities: FOOD_KIND
  bacterium: 'bacterium', // entities: BACTERIUM_VARIANT
  entity: 'entity', // entities: the non-food ENTITY_KIND members (dna_fragment)
  stage: 'stage', // evolutions: CELL_STAGE
  trait: 'trait', // evolutions: TRAIT_CATALOG
  dnaTag: 'dna_tag', // evolutions: DNA_TAG
  ability: 'ability', // abilities: ABILITY (§12.4)
  action: 'action', // actions: ACTION (§12.4)
  zone: 'zone', // world: ZONE_ID
  world: 'world', // world: WORLD_TOPIC (§12.4)
} as const;

export type EntryId =
  | `cell_kind:${CellKind}`
  | `food:${FoodKind}`
  | `bacterium:${BacteriumVariant}`
  | `entity:${typeof ENTITY_KIND.dnaFragment}`
  | `stage:${CellStage}`
  | `trait:${TraitId}`
  | `dna_tag:${DnaTag}`
  | `ability:${AbilityId}`
  | `action:${ActionId}`
  | `zone:${ZoneId}`
  | `world:${WorldTopicId}`;

/** A place inside an entry: `trait:cell_wall#tier_2`. Section keys are lowercase snake_case. */
export type EntryAnchor = `${EntryId}#${string}`;
```

Ids are lowercase and use only `:` `#` `_`, so they are URL- and test-id-safe as written. Cross-references
(`seeAlso`, prose links) are typed `EntryId`s; a trait's tier sections are `tier_1` … `tier_<TRAIT_TIER_COUNT>`.

**Entry definition** (what content files write) and **resolved entry** (what the UI binds):

```ts
// encyclopedia/model/entry.ts
export interface EntryDefinition {
  readonly id: EntryId;
  readonly category: EncyclopediaCategory;
  /** A catalog `name` where one exists (traits); content-owned copy otherwise. Never a number. */
  readonly title: string;
  readonly summary: ProseTemplate;
  readonly facts: readonly FactDefinition[];
  readonly sections: readonly SectionDefinition[];
  /** Hand-picked links; the derived ones (a trait's requires, an ability's granting traits) are added at resolve time. */
  readonly seeAlso: readonly EntryId[];
  readonly preview: PreviewSpec | null; // render/preview/preview-spec.ts, §12.7
}

export interface SectionDefinition {
  readonly key: string; // `tier_2`, `aerobic`
  readonly heading: ProseTemplate;
  readonly body: ProseTemplate;
  readonly facts: readonly FactDefinition[];
  /** A section may re-point the preview (a trait's tier tabs); `null` keeps the entry's. */
  readonly preview: PreviewSpec | null;
}

/** What `resolveEntry(id, context)` returns: every value already formatted, every link already titled. */
export interface ResolvedEntry {
  readonly id: EntryId;
  readonly category: EncyclopediaCategory;
  readonly title: string;
  readonly summary: readonly ProseSegment[];
  readonly facts: readonly ResolvedFact[];
  readonly sections: readonly ResolvedSection[];
  readonly seeAlso: readonly EntryLink[];
  readonly preview: PreviewSpec | null;
}

export type ProseSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly factKey: string; readonly text: string }
  | { readonly kind: 'link'; readonly entryId: EntryId; readonly text: string };

export interface ResolvedFact {
  readonly key: string;
  readonly label: string;
  /** The formatted value with its unit: `20 mass`, `+15 %`, `1.2 s`. */
  readonly text: string;
}

export interface EntryLink {
  readonly entryId: EntryId;
  readonly title: string;
}
```

`encyclopedia/registry.ts` assembles `ENCYCLOPEDIA_ENTRIES` (catalog order inside each subject, subjects in
`ENTRY_SUBJECT` order) and the `entryById` map once at module load; `resolveEntry(id, context)` and
`entriesIn(category)` are pure. Search, if #354 wants it, runs over resolved titles and summaries and needs nothing
more from the model.

### 12.3 Facts: values bound to code

```ts
// encyclopedia/model/fact.ts
export interface FactContext {
  /** The live balance: the room's copy in a room, `DEFAULT_BALANCE` outside one. */
  readonly balance: BalanceConfig;
}

/** A typed path to a number leaf: the first two segments are checked by the compiler, deeper ones by §12.6. */
export type BalancePath = readonly [domain: keyof BalanceConfig, name: string, ...keys: string[]];

export type FactSource =
  /** One balance leaf, shown as is: `balancePath('ecology', 'ALGAE_MASS')`. */
  | { readonly kind: 'balance'; readonly path: BalancePath }
  /** A value computed from the balance through a shared formula: `radiusForMass`, `levelUpCost`, `maxSpeedForMass`. */
  | { readonly kind: 'formula'; readonly compute: (context: FactContext) => number }
  /** A catalog structure number with no patch path: `unlockedBy.count`, `TRAIT_TIER_COUNT`. Reads no balance. */
  | { readonly kind: 'catalog'; readonly compute: () => number };

export interface FactDefinition {
  readonly key: string; // camelCase; what prose tokens and test ids name
  readonly label: string;
  readonly unit: QuantityUnit; // §12.5
  readonly presentation: QuantityPresentation; // §12.5
  readonly source: FactSource;
}
```

- **`balance`** is the default. `balancePath` is a typed helper (`balancePath<D extends keyof BalanceConfig>(domain: D,
name: NumberOrTableKey<D>, ...keys)`), so a renamed constant fails `typecheck` at the fact.
- **`formula`** calls the shared function the simulation calls (`simulation/mass-curves.ts`, `level-costs.ts`,
  `engulf-pace.ts`, …) with `context.balance.<domain>`; it never re-derives a formula locally
  (`CODE-STANDARDS.md §3`). The derived engulf duration is `ENGULF_BASE_DURATION_SECONDS` read from the balance,
  not a sum written in the fact.
- **`catalog`** is for the numbers `architecture/constants-files-tests.md §9` names as structure. Trait tier values
  are **not** catalog facts: they are read from `balance.traits.TRAIT_TIERS` (the one patch path), never from
  `TRAIT_CATALOG[n].tiers`.
- **Trait tier lines are generated, not declared.** A trait's `tier_<n>` section is built from
  `nonIdentityModifiers(balance.traits.TRAIT_TIERS[traitId][n − 1])` through `MODIFIER_LABELS`, the trait cards'
  one label table (`hud/format/trait-effects.ts`, `ui/overlays.md §3.2`), so a card and its encyclopedia page can
  never read differently. That table today reads the module `TRAIT_TIERS`; the formatting ticket makes it take the
  live tier table (§9's rule), which also fixes the cards under a balance patch.
- **Derived links are computed too:** a trait's `requires` and `unlockedBy.bacteriumVariant`, a stage's
  `STAGE_GATE_TRAITS`, an ability's granting traits (every trait with a tier setting one of the ability's modifier
  keys to a non-identity value), a zone's food weights (`FOOD_ZONE_WEIGHTS_BY_KIND`).

### 12.4 The closed sets the registry adds

Three subjects have no code enum yet. Each is declared once in `encyclopedia/model/` and **anchored** to a code set
by a total `Record`, so the new id list cannot drift from the code it describes:

```ts
// encyclopedia/model/abilities.ts — every CellModifiers key belongs to exactly one ability
export const ABILITY = {
  movement: 'movement',
  sprint: 'sprint',
  engulfDefence: 'engulf_defence',
  engulfGrip: 'engulf_grip',
  digestion: 'digestion',
  photosynthesis: 'photosynthesis',
  spines: 'spines',
  toxin: 'toxin',
  foodAttraction: 'food_attraction',
  genome: 'genome',
  gelResistance: 'gel_resistance',
} as const; // the final list is content's; the anchor below is the rule
export type AbilityId = ValueOf<typeof ABILITY>;
export const ABILITY_BY_MODIFIER: Readonly<Record<keyof CellModifiers, AbilityId>> = {/* one row per modifier */};

// encyclopedia/model/actions.ts — every player intent on the wire and every positioned effect has an action
export const ACTION = {
  steer: 'steer',
  sprint: 'sprint',
  eat: 'eat',
  engulf: 'engulf',
  escape: 'escape',
  pickTrait: 'pick_trait',
  levelUp: 'level_up',
  respawn: 'respawn',
} as const;
export type ActionId = ValueOf<typeof ACTION>;
type PlayerIntent = Exclude<keyof GameInput, 'sequence' | ReservedInputField>; // shouldSplit, shouldEject reserved
export const ACTION_BY_INTENT: Readonly<Record<PlayerIntent, ActionId>> = {
  targetX: ACTION.steer,
  targetY: ACTION.steer,
  shouldSprint: ACTION.sprint,
  traitChoice: ACTION.pickTrait,
};
export const ENTRY_BY_EFFECT: Readonly<Record<EffectKind, EntryId>> = {
  eat: 'action:eat',
  cell_absorbed: 'action:engulf',
  cell_released: 'action:escape',
  level_up: 'action:level_up',
  respawn: 'action:respawn',
  world_level_up: 'world:world_clock',
};

// encyclopedia/model/world-topics.ts — every balance domain is read by at least one fact somewhere (§12.6)
export const WORLD_TOPIC = { dish: 'dish', worldClock: 'world_clock', bloom: 'bloom', round: 'round' } as const;
export type WorldTopicId = ValueOf<typeof WORLD_TOPIC>;
```

**Reserved values are excluded by name**, never by omission: `RESERVED_FROM_ENCYCLOPEDIA` in
`encyclopedia/model/reserved.ts` lists `CELL_STATE.dividing`, `GAME_MODE.colony`, the `RESERVED_TRAIT_IDS`, the
`primary_locomotion` exclusion group and the reserved `GameInput` fields, and a spec pins that each is still reserved
in code (so a value that goes live leaves the list and needs an entry).

### 12.5 Formatting and units: one place

```ts
// quantities/quantity-unit.ts — the one home of unit words, suffixes and decimals
export const QUANTITY_UNIT = {
  mass: 'mass',
  dna: 'dna',
  worldUnits: 'world_units',
  worldUnitsPerSecond: 'world_units_per_second',
  seconds: 'seconds',
  massPerSecond: 'mass_per_second',
  share: 'share', // a 0..1 ratio, shown as a percent
  sharePerSecond: 'share_per_second',
  multiplier: 'multiplier', // ×
  radii: 'radii',
  count: 'count',
  points: 'points',
  level: 'level',
} as const;
export type QuantityUnit = ValueOf<typeof QUANTITY_UNIT>;

export const QUANTITY_PRESENTATION = {
  plain: 'plain', // `20 mass`
  signedChange: 'signed_change', // a bonus or delta: `+0.5 s`, `+15 %`
  changeFromOne: 'change_from_one', // a multiplier as its change: 1.15 → `+15 %`
  rateFromDuration: 'rate_from_duration', // a duration multiplier as the rate it gives: 0.61 → `+64 %`
} as const;
export type QuantityPresentation = ValueOf<typeof QUANTITY_PRESENTATION>;

/** Per unit: the suffix, the singular form where one exists, the decimals (trailing zeros dropped). */
export const QUANTITY_UNIT_FORMAT: Readonly<Record<QuantityUnit, UnitFormat>>;

// quantities/format-quantity.ts — pure
export function formatQuantity(value: number, unit: QuantityUnit, presentation?: QuantityPresentation): string;
```

The `−` minus sign, the space before `%` and the decimal rule the trait cards use today
(`hud/format/trait-effects.ts`: `signedPercent`, `trimmed`, `radiiText`, `fromOne`, `asRate`) move here unchanged, so
the cards' text does not move; `MODIFIER_LABELS` keeps its words and calls `formatQuantity` for the number.
`trait-cards.ts`'s countdown (`6.5 s`) and any later HUD number go through it too. No locale formatting in build 1
(the HUD is English, `ui/layout.md`); a locale later is one change here.

### 12.6 Prose and the tests that bind everything

**Where prose lives.** In the content file of its subject, beside the facts it references
(`encyclopedia/content/<subject>-entries.ts`, one file per subject, each ≤ 250 lines, split by stage for traits if
it outgrows that). Each exports a total record, e.g. `TRAIT_ENTRY_CONTENT: Record<TraitId, TraitEntryContent>`
(summary, one body per tier, hand-picked `seeAlso`); the builder joins it with the catalog row and the generated
facts. Keeping each entry's copy in one object is also what a later localisation replaces.

```ts
/** Text with `{factKey}` value tokens and `[[entryId]]` or `[[entryId|shown text]]` links. No digits. */
export type ProseTemplate = string;
// "Algae drifts in the {zone} and gives {massGain} on contact. Enough of it grows [[action:engulf|an engulfer]]."
```

`resolveProse(template, facts, context)` splits a template into `ProseSegment`s: a value token becomes the fact's
formatted text, a link its target's title (or the shown text). A malformed token throws at resolve time and fails the
spec below, never on a player's screen.

**Tests** (`encyclopedia/**/*.spec.ts`, unit tier, jsdom, no Pixi):

| Spec                                                                     | Pins                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registry-completeness.spec.ts`                                          | The registry holds exactly: one `trait:` entry per `TRAIT_CATALOG` row with `TRAIT_TIER_COUNT` tier sections; one entry per `CELL_STAGE`, `DNA_TAG`, `CELL_KIND`, `FOOD_KIND`, `BACTERIUM_VARIANT`, `ZONE_ID`, `ABILITY`, `ACTION`, `WORLD_TOPIC` value and `entity:dna_fragment`; every `ENTRY_BY_EFFECT` and `ACTION_BY_INTENT` target exists; every `CellModifiers` key maps to one ability; every value outside the registry is in `RESERVED_FROM_ENCYCLOPEDIA`, and each of those is still reserved in code. Ids are unique; every entry's category is in `ENCYCLOPEDIA_CATEGORY_ORDER`; no category is empty |
| `fact-sources.spec.ts`                                                   | Every `balance` path resolves to a finite number in `DEFAULT_BALANCE`. Every `formula` fact, run over a **recording proxy** of the balance, reads at least one number leaf; patching each leaf it read (× 2 on a `structuredClone`) changes its value; a `catalog` fact reads none. Every `BalanceConfig` domain is read by at least one fact, so a new domain cannot ship undocumented                                                                                                                                                                                                                            |
| `prose.spec.ts`                                                          | For every entry and section: no digit in any template, title or label (`/\d/`); every `{token}` names a fact of that entry or section; every `[[link]]` is a registry id; `resolveEntry` of every id succeeds over `DEFAULT_BALANCE`                                                                                                                                                                                                                                                                                                                                                                               |
| `resolve-entry.spec.ts`                                                  | A patched balance (`applyBalancePatch`) changes the resolved text of the facts that read the leaf and of the trait tier lines; the derived links (requires, granting traits, gate traits) match the catalog                                                                                                                                                                                                                                                                                                                                                                                                        |
| `quantities/format-quantity.spec.ts`, `hud/format/trait-effects.spec.ts` | Every unit × presentation, the trimming and sign rules; the card lines unchanged by the move                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Lint guard.** `eslint.config.js` gains a `no-restricted-imports` block for
`packages/client/src/app/game/encyclopedia/**` that forbids importing an `UPPER_SNAKE_CASE` name from
`@evolution/shared` (`importNamePattern`) except the structure allowlist: the id objects (`CELL_STAGE`, `ZONE_ID`,
`DNA_TAG`, `CELL_KIND`, `FOOD_KIND`, `BACTERIUM_VARIANT`, `ENTITY_KIND`, `EFFECT_KIND`, `CELL_STATE`, `GAME_MODE`),
`TRAIT_CATALOG`, `STAGE_ORDER`, `STAGE_GATE_TRAITS`, `RESERVED_TRAIT_IDS`, `TRAIT_TIER_COUNT`, `DEFAULT_CELL_MODIFIERS`
(identity, for the non-identity filter) and `DEFAULT_BALANCE` in `registry.ts`'s outside-a-room default only.
Content therefore cannot read `ALGAE_MASS`; it has to go through the context.

### 12.7 The preview seam

**Requirement:** real renders with their animations (epic #353), from the game's own code-drawn renderers, without a
room, a snapshot from the server or a socket.

**Decision: a `PreviewSession` is a third `FrameLoopSession`** beside `RenderSession` (a room) and `BenchSession`
(the bench route). It owns its own small Pixi app (`createPixiApp` with `fixedSize`), a `RendererSlot` holding a real
`GameRenderer` over its own `RenderTextures`, and replaces the store with a **scene**: a pure function from local
time to a `RenderFrame`. Every layer (dish, food, cells with organelles, clips, ghosts, effects) runs unchanged.

```ts
// render/preview/preview-spec.ts — data only; the encyclopedia's content imports it as a type
export const PREVIEW_SCENE = {
  cell: 'cell', // one cell of a kind with owned traits, resting or swimming
  food: 'food', // a cluster of one food kind (and variant), drifting as in play
  dnaFragment: 'dna_fragment', // fragments of one tag
  zone: 'zone', // the camera parked inside one zone of the dish
  eat: 'eat', // a cell swimming through motes: eat clips and effects
  engulf: 'engulf', // predator, prey, the three phases, absorbed ghost, prey respawn
  escape: 'escape', // an engulf that ends in `cell_released`
  sprint: 'sprint', // a sprint and its cooldown ring
  levelUp: 'level_up',
} as const;

export type PreviewSpec =
  | {
      readonly scene: typeof PREVIEW_SCENE.cell;
      readonly cellKind: CellKind;
      readonly traits: readonly OwnedTrait[];
      readonly motion: PreviewMotion;
    }
  | {
      readonly scene: typeof PREVIEW_SCENE.food;
      readonly foodKind: FoodKind;
      readonly bacteriumVariant: BacteriumVariant | null;
    }
  | { readonly scene: typeof PREVIEW_SCENE.dnaFragment; readonly tag: DnaTag }
  | { readonly scene: typeof PREVIEW_SCENE.zone; readonly zone: ZoneId }
  | {
      readonly scene: Exclude<
        ValueOf<typeof PREVIEW_SCENE>,
        | typeof PREVIEW_SCENE.cell
        | typeof PREVIEW_SCENE.food
        | typeof PREVIEW_SCENE.dnaFragment
        | typeof PREVIEW_SCENE.zone
      >;
    };

// render/preview/preview-scene.ts
export interface PreviewSceneFrame {
  readonly cells: readonly CellView[];
  readonly motes: readonly FoodMoteView[];
  readonly fragments: readonly DnaFragmentView[];
  /** The effects whose tick lies in (previous frame's tick, this tick]: the clip tracker starts them once. */
  readonly effects: readonly GameEffect[];
}

export interface PreviewScene {
  /** Where the camera parks and at what fixed zoom (px per wu). */
  readonly framing: { readonly target: CameraTarget; readonly zoom: number };
  /** The cell the camera follows as `ownPlayerId` (the action scenes: the sprint ring, the warning ring), or `null`. */
  readonly subjectPlayerId: PlayerId | null;
  /** Monotonic `tick`; the scene loops internally on its own period. */
  frameAt(tick: number, previousTick: number, balance: BalanceConfig): PreviewSceneFrame;
}

export function previewSceneFor(spec: PreviewSpec, balance: BalanceConfig): PreviewScene;

// render/preview/preview-session.ts
export interface PreviewSessionDependencies {
  readonly host: HTMLElement;
  readonly clock: Clock; // the injected Clock (CODE-STANDARDS.md §8)
  readonly devicePixelRatio: number;
  readonly sizePx: { readonly width: number; readonly height: number };
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  /** Read every frame: the live balance, so a patch retimes an engulf preview as it plays. */
  readonly balance: () => BalanceConfig;
}

export class PreviewSession extends FrameLoopSession {
  /** Resolves when the first frame of the first scene is on the canvas; `openedToFirstFrameMs` is recorded. */
  start(): Promise<void>;
  /** Swaps the scene and restarts the local clock; no texture work. */
  show(spec: PreviewSpec): void;
  /** `pause` / `resume` / the report come from the loop (the debug gate): reduced motion, a hidden detail pane. */
  destroy(): void;
}
```

**The local clock.** `localSeconds = (clock.nowMilliseconds() − shownAtMs) / MILLISECONDS_PER_SECOND` from the injected `Clock`; `renderTick = localSeconds /
TICK_INTERVAL_S`; `timeSeconds` as in play (`rendering/cells.md §1`: the only time the renderer sees). Time is
**monotonic and never wraps**: the clip tracker, the ghost registry and the sprint-ring tracker key on `nowMs`, and a
backwards jump would strand their clips. A scene loops by taking its phase modulo its period and emitting each
loop's effects at their absolute ticks. A prey absorbed in an engulf loop reappears with the **same id** after a
`respawn` effect, once the `absorbed` clip has ended, so its cosmetic fork (`cell:<id>`) and its look are identical
every loop.

**The fixture frame.** `render/preview/preview-frame.ts` wraps a scene frame into the `RenderFrame` the renderer
takes: `balance` is the live one, `latest` a fixture `GameSnapshot` built there (production code never imports
`testing/`), cells get `radius = radiusForMass(mass, balance.growth)` and `stage = stageOf(traitIds, balance.ladder)`,
so a trait preview's silhouette is exactly the ladder's. Scene timings come from the balance (`ENGULF_COVER_SECONDS`,
`ENGULF_WRAP_SECONDS`, `ENGULF_ABSORB_SECONDS`, `SPRINT_DURATION_SECONDS`, `SPRINT_COOLDOWN_SECONDS`,
`BACTERIUM_DRIFT_SPEED`); the preview's own numbers are framing only (canvas aspect, zoom per scene, the mass a
single-cell preview is drawn at, the swim loop's radius and period, the gap between loops) and live in a new
`render/constants/preview.ts` page. A trait's preview cell owns the trait's transitive `requires` at tier I and the
trait at the section's tier; a zone preview's target comes from the geometry the dish bake already reads
(`DISH_RADIUS`, `SHALLOWS_WIDTH`, `VENT_RADIUS` through `camera.ts` / `dish-texture.ts`), and its texture bundle is
built with one fixture gel patch the `viscous_gel` scene parks on.

**The texture bundle.** Built once per session by `createRenderTextures` with `PREVIEW_SEED` (a `render/constants/
preview.ts` constant), the fixture gel patches and the session's `devicePixelRatio`; `show` never rebakes, so every
entry's preview reuses it and a seed-fixed screenshot is reproducible.

**Two traps the seam closes:**

- **BitmapFont names are global.** `createIndicatorTextures` installs the `value` / `label` fonts into Pixi's
  process-wide `BitmapFont` cache by name, and `destroyIndicatorTextures` uninstalls them. A second bundle under the
  same names would overwrite the room's install, and destroying the preview would uninstall the room's fonts. The
  seam ticket suffixes the installed names per bundle (`IndicatorFontNames` already carries them to `BitmapText`)
  and pins that two bundles install distinct names and that destroying one leaves the other's installed.
- **`BitmapText` crashes jsdom.** The Angular side never builds a `PreviewSession` in a spec: it asks for an
  `ENCYCLOPEDIA_PREVIEW` injection token (`render/preview/preview-host.ts`: `(host, sizePx) => PreviewHandle`, with
  `show`, `pause`, `resume`, `destroy`), provided like `clock-provider.ts`, and component specs provide a recording
  fake. `preview-session.spec.ts` runs over the fake `PixiAppHandle` and the fake baker `render-session.spec.ts`
  uses, and never draws the indicator texts (`NO_HUD_INPUTS`).

**Lifecycle and cost of opening a preview.**

| When                                                      | Paid                                                                                                                                                                                                                                                                                                | Budget (reference GPU of `rendering/budget.md §7`)                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First detail view with a preview, per encyclopedia open   | A WebGL2 context and Pixi init; the full bundle bake a room pays at startup: the dish field (a 16 MiB RGBA8 texture), the light pool (4 MiB), the noise tile with mips, strip, palette, glow / mote / organelle atlases, indicator textures and fonts. GPU memory ≈ one more room bundle while open | `openedToFirstFrameMs` ≤ `PREVIEW_OPEN_BUDGET_MS` 300, p95 over 10 opens; the list and text render at once and the canvas box shows #354's loading state until then |
| Switching entries                                         | `show`: a new scene, registry churn of at most a handful of render states; no bake, no allocation proportional to the bundle                                                                                                                                                                        | one frame                                                                                                                                                           |
| Every frame while visible                                 | One `GameRenderer.render` at ≤ 3 cells, ≤ 40 motes, ≤ 10 fragments on a canvas of at most `PREVIEW_CANVAS_MAX_PX`; the same ≤ 17 draw calls on its own context. The room keeps rendering behind the menu (the dish never pauses)                                                                    | preview frame CPU p95 ≤ `PREVIEW_FRAME_BUDGET_MS` 1.0 (its own `FrameInstrumentation` report); the room's frame stays within its §7 budget                          |
| Encyclopedia closed                                       | `destroy`: the renderer, the bundle and the context are released (a context is never leaked toward the browser's context cap)                                                                                                                                                                       | —                                                                                                                                                                   |
| Detail pane without a preview, reduced motion, tab hidden | the gate pauses: no frames drawn, the last frame held                                                                                                                                                                                                                                               | 0 per frame                                                                                                                                                         |

The two budgets are new, owned here, and land as constants in `render/constants/preview.ts` beside the bench's;
the perf-engineer measures them in the seam ticket on a real GPU and records the measurement in `rendering/budget.md
§7`. **If the open budget is missed**, the levers, in order: keep the preview session alive across encyclopedia opens
for the room's lifetime (one bake per room, the memory held); then a bundle option that skips the dish field and
light-pool bakes for scenes that do not show the dish. Neither is built before the measurement asks for it.

**Rejected alternatives.**

- _Drawing the preview into the room's canvas_ (a second `GameRenderer` in a masked sub-rectangle of the room's
  stage): no second bake, but the DOM panel would need a transparent hole kept in sync with a canvas rectangle, the
  menu's scrim would have to be cut around it, the debug pause gate would freeze it with the room, a rematch rebuild
  would tear it down, `GameRenderer` has no viewport offset or mask, and it could never open outside a room.
- _Rendering to a texture and copying it into the DOM:_ a `readPixels` per frame, far over any frame budget.
- _Screenshots or recorded clips:_ excluded by the epic (code-drawn and live, `ASSET-GENERATION.md`), and stale on
  the first retune.

**Evidence route.** `?preview=<EntryAnchor>&t=<seconds>` (dev builds only, behind the same production gate as
`bench/bench-route.ts`) mounts one preview at a fixed `ManualClock` time for graphics-qa screenshots and the
Playwright smoke; it lives in `encyclopedia/preview-route.ts`, the one module allowed to join an entry id to its
spec and the render seam. `render/` never imports from `encyclopedia/`.

### 12.8 File plan

```text
packages/client/src/app/game/
  quantities/{quantity-unit,format-quantity}.ts                   units, suffixes, decimals; the one formatter (§12.5)
  encyclopedia/model/{categories,entry-id,entry,fact,prose}.ts      the closed types, ids, definitions, resolved shapes, token parser
  encyclopedia/model/{abilities,actions,world-topics,reserved}.ts  the registry's own closed sets and their anchors (§12.4)
  encyclopedia/facts/{balance-path,resolve-fact,resolve-prose,derived-links}.ts   typed paths, value + unit → text, template → segments, computed links
  encyclopedia/content/{trait,stage,dna-tag}-entries.ts            evolutions (trait tier sections generated from balance.traits.TRAIT_TIERS)
  encyclopedia/content/{cell-kind,food,bacterium,entity}-entries.ts   entities
  encyclopedia/content/{zone,world}-entries.ts                     world
  encyclopedia/content/{ability,action}-entries.ts                 abilities and actions
  encyclopedia/registry.ts                                          ENCYCLOPEDIA_ENTRIES, entryById, resolveEntry, entriesIn
  encyclopedia/preview-route.ts                                     the dev evidence route (§12.7)
  encyclopedia/**/*.spec.ts                                          §12.6
  render/preview/**                                                 the seam; its file list is rendering/files-and-tests.md §8
  render/constants/preview.ts                                       preview framing, seed and budgets
```

The encyclopedia and ESC menu components, their test ids and the UI kit are #354's (`ui/` docs). Import direction:
`encyclopedia/model` ← `encyclopedia/facts` ← `encyclopedia/content` ← `registry.ts` ← components;
`encyclopedia/content` imports `render/preview/preview-spec.ts` as a type only; `render/` imports nothing from
`encyclopedia/`, `hud/` or `state/`.

### 12.9 Test plan

- **Unit:** §12.6's specs; `format-quantity.spec.ts`; `preview-scene.spec.ts` (every `PREVIEW_SCENE` has a builder;
  same spec + tick ⇒ same frame; ticks are monotonic across a loop; each loop emits its effects once; the engulf
  scene's phase boundaries follow a patched `ENGULF_WRAP_SECONDS`; the absorbed prey returns with its id after the
  `absorbed` clip's duration); `preview-frame.spec.ts` (radius and stage through the shared formulas, the live
  balance on the frame); `preview-session.spec.ts` over the fake app (one bake per session, none on `show`, pause
  holds the frame, destroy releases the slot and the app); `indicator-textures.spec.ts` (distinct font names per
  bundle, destroy uninstalls only its own).
- **Integration:** `encyclopedia.integration.spec.ts` resolves every entry against a `game_state` balance applied
  through the real `WorldStore`, applies `balance_updated`, and sees the patched values in the resolved entries.
- **Playwright smoke (WebGL):** the evidence route for one entry per `PREVIEW_SCENE`: no page or shader errors, the
  canvas non-empty, two loads at the same `t` give the same pixels and a different `t` changes them; graphics-qa
  screenshots under `qa/evidence/<pr>/`. The perf-engineer's open and frame measurements ride the same route.
