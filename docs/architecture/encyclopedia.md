# Evolution — Architecture: encyclopedia content model and preview seam

§12 of the split [`ARCHITECTURE.md`](../ARCHITECTURE.md), which keeps the shared context and the file list. The
player-facing half (navigation, layouts, the UI kit, and the categories' labels and order) is the ui-designer's spec
(#354); this file decides the data: where entries live, how every number on a page is bound to code, where prose lives,
what the completeness tests pin, and how the game's real renderers draw an animated preview outside a room (#355, epic
#353).

## 12. Encyclopedia

### 12.1 Decisions (the short list)

1. **The registry is client code** (`packages/client/src/app/game/encyclopedia/`). Its titles, prose and labels
   are player-facing copy like the HUD's; nothing on the server or in the debug MCP reads it. It imports id objects and
   pure functions from `@evolution/shared`, and reads every catalog row, walk order and number from the balance
   context (§12.6's lint guard).
2. **No number is typed in an entry, and no arithmetic is written there either.** A fact names where its value
   comes from: a balance leaf, a formula from the closed formula table (each row one call of a shared function), or a
   catalog quantity from a closed selector set. Both tables live in `encyclopedia/facts/`, never in content. The
   balance is the **live** one: the room's `game_state.balance` / `balance_updated` copy while in a room,
   `DEFAULT_BALANCE` outside one, so a `debug_set_balance` patch re-renders an open page.
3. **Only numbers the simulation reads are shown.** A fact or a preview timing reads the leaf, or the shared helper
   over the leaves, that the game itself reads, never an input the game ignores. The engulf phase durations therefore
   go through `engulfPhaseSpanSeconds` (§12.3).
4. **Completeness is a type first and a test second.** Every per-kind content table is a `Record` keyed by the code's
   closed union (`Record<TraitId, …>`, `Record<ZoneId, …>`, `Record<EntityKind, …>`), so a new trait, zone or entity
   kind without an entry fails `typecheck`; the completeness spec then pins the assembled registry against the same
   sets at runtime.
5. **One formatter** (`packages/client/src/app/game/quantities/`) turns a number and a unit into text for the
   encyclopedia and the HUD alike; every HUD number the player reads moves onto it, and the modifier label table
   moves there from `hud/`.
6. **Prose carries no numbers.** It references the entry's facts by key (`{massGain}`) and other entries by id
   (`[[trait:cell_wall]]`); a spec rejects any digit or Roman-numeral tier in prose, and tier headings are generated.
7. **The preview is a second, small Pixi app running the real `GameRenderer`** on a scripted fixture scene with a
   local animation clock — the bench route's pattern (`rendering/budget.md §7`), never the room's store, snapshot or
   socket. One preview app per open encyclopedia, reused across entries, destroyed when the encyclopedia closes.

### 12.2 Registry: categories, subjects, ids

**Categories** are the closed player-facing grouping; **subjects** are the code kinds an entry documents. An entry
has exactly one of each; the id is built from the subject, so regrouping entries never renames an id.

**Ownership of the category values.** This file owns the `ENCYCLOPEDIA_CATEGORY` values: adding, removing or renaming
one is a change to this file (and to the completeness spec, which requires every category to be non-empty). #354 owns
each category's **label and position** only: `ENCYCLOPEDIA_CATEGORY_LABEL` and `ENCYCLOPEDIA_CATEGORY_ORDER` are
written from its spec (`docs/ui/encyclopedia.md §11.2`, not repeated here). So the two specs cannot disagree about
which categories exist. The same split holds for **list groups** (below): the ids and how an entry is assigned one
are here, the headers' labels are #354's; and for the **subjects**, whose ids are this file's while the word each one
wears on an entry page's kind chip is #354's `ENTRY_SUBJECT_LABEL`, beside `ENTRY_SUBJECT` so that a subject added
without a word fails `typecheck` (ui/encyclopedia.md §11.4).

**Category by subject.** An entry's category is derived, never written in content: `CATEGORY_BY_SUBJECT` in
`encyclopedia/model/categories.ts` is total over `ENTRY_SUBJECT`, and `CATEGORY_BY_ENTRY` holds the only exception.

| Subject                                    | Category                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `concept`, `hud`                           | `basics` (except `concept:food` → `entities`, the one `CATEGORY_BY_ENTRY` row) |
| `cell_kind`, `food`, `bacterium`, `entity` | `entities`                                                                     |
| `stage`, `trait`, `dna_tag`                | `evolutions`                                                                   |
| `ability`                                  | `abilities`                                                                    |
| `action`                                   | `actions`                                                                      |
| `zone`, `world`                            | `world`                                                                        |

```ts
// encyclopedia/model/categories.ts
export const ENCYCLOPEDIA_CATEGORY = {
  basics: 'basics', // the rules every other page leans on (#354)
  entities: 'entities',
  evolutions: 'evolutions',
  abilities: 'abilities',
  actions: 'actions',
  world: 'world',
} as const;
export type EncyclopediaCategory = ValueOf<typeof ENCYCLOPEDIA_CATEGORY>;
/** Labels and navigation order: #354's values, pinned complete against the object. */
export const ENCYCLOPEDIA_CATEGORY_LABEL: Readonly<Record<EncyclopediaCategory, string>>;
export const ENCYCLOPEDIA_CATEGORY_ORDER: readonly EncyclopediaCategory[];

// encyclopedia/model/entry-id.ts
export const ENTRY_SUBJECT = {
  cellKind: 'cell_kind', // CELL_KIND
  food: 'food', // FOOD_KIND
  bacterium: 'bacterium', // BACTERIUM_VARIANT
  entity: 'entity', // ENTITY_KIND members with no subject of their own (dna_fragment), via ENTRY_BY_ENTITY_KIND
  stage: 'stage', // CELL_STAGE
  trait: 'trait', // TRAIT_CATALOG
  dnaTag: 'dna_tag', // DNA_TAG
  ability: 'ability', // ABILITY (§12.4)
  action: 'action', // ACTION (§12.4)
  zone: 'zone', // ZONE_ID
  world: 'world', // WORLD_TOPIC (§12.4)
  concept: 'concept', // CONCEPT (§12.4): the rules the other pages link to
  hud: 'hud', // HUD_TOPIC (§12.4): how to read each HUD element; a subject under basics, not a category
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
  | `world:${WorldTopicId}`
  | `concept:${ConceptId}`
  | `hud:${HudTopicId}`;

/** A place inside an entry: `trait:cell_wall#tier_2`. Section keys are lowercase snake_case. */
export type EntryAnchor = `${EntryId}#${string}`;
```

Ids are lowercase and use only `:` `#` `_`, so they are URL- and test-id-safe as written. Cross-references
(`seeAlso`, prose links) are typed `EntryId`s; a trait's tier sections are `tier_1` … `tier_<n>` for each tier of its
row in `balance.traits.TRAIT_TIERS`. The category is derived from the subject (the table above), so content never names one.

**Entry definition** (what content files write) and **resolved entry** (what the UI binds):

```ts
// encyclopedia/model/entry.ts
export interface EntryDefinition {
  readonly id: EntryId;
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
  /** Content-written for every section except generated ones (a trait's tier headings, §12.3). */
  readonly heading: ProseTemplate;
  readonly body: ProseTemplate;
  readonly facts: readonly FactDefinition[];
  /** A section may re-point the preview (a trait's tier tabs); `null` keeps the entry's. */
  readonly preview: PreviewSpec | null;
  /** Set on a trait's `tier_<n>` section (`{ traitId, tier }`): its heading and facts are generated at resolve time. */
  readonly tier: TierSectionSource | null;
}

/** What `resolveEntry(id, context)` returns: every value already formatted, every link already titled. */
export interface ResolvedEntry {
  readonly id: EntryId;
  readonly category: EncyclopediaCategory;
  /** What the page's chips and breadcrumb read, per subject; never re-read from the catalog by the UI. */
  readonly subject: ResolvedSubject;
  /** The list header the entry sits under; `null` in a category without groups (abilities, actions). */
  readonly group: EntryGroupId | null;
  readonly title: string;
  readonly summary: readonly ProseSegment[];
  /** A landing tile's one fact: the entry's first resolved fact (for a multi-target link, its first target), `null` when it has none. */
  readonly headline: ResolvedFact | null;
  readonly facts: readonly ResolvedFact[];
  readonly sections: readonly ResolvedSection[];
  readonly seeAlso: readonly EntryLink[];
  readonly preview: PreviewSpec | null;
}

export type ProseSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly factKey: string; readonly text: string }
  /** `sectionKey` keeps an anchor's section (`tier_2` of `[[trait:cilia#tier_2]]`), `null` for a whole entry. */
  | { readonly kind: 'link'; readonly entryId: EntryId; readonly sectionKey: string | null; readonly text: string };

export type ResolvedSubject =
  | {
      readonly kind: typeof ENTRY_SUBJECT.trait;
      readonly traitId: TraitId;
      readonly traitCategory: TraitCategory;
      readonly rarity: TraitRarity;
      readonly dnaTags: readonly DnaTag[];
      readonly stage: CellStage;
      readonly tierCount: number; // from balance.traits.TRAIT_TIERS
    }
  | { readonly kind: Exclude<EntrySubject, typeof ENTRY_SUBJECT.trait>; readonly codeId: string };

export interface ResolvedFact {
  /** A formula or balance fact's key; in a trait's `tier_n` section, the modifier key (`speedMultiplier`). */
  readonly key: string;
  /** In a tier section, `MODIFIER_LABELS[key].noun` (`speed`). */
  readonly label: string;
  /** The formatted value with its unit: `20 mass`, `+15 %`, `1.2 s`; a link fact's text is its target's title. */
  readonly text: string;
  /** Set for a link-valued fact (`Offered from`, `Climbs to`, `Found in`), `null` otherwise. */
  readonly link: EntryLink | null;
}

/** `entriesIn(category)`: the category's groups in walk order, each with its entries; one `null` group when ungrouped. */
export interface ResolvedGroup {
  readonly group: EntryGroupId | null;
  readonly entries: readonly EntryLink[];
}

export interface EntryLink {
  readonly entryId: EntryId;
  readonly title: string;
}
```

`encyclopedia/registry.ts` assembles `ENCYCLOPEDIA_ENTRIES` (catalog order inside each subject, subjects in
`ENTRY_SUBJECT` order) and the `entryById` map once at module load from `DEFAULT_BALANCE`'s structure (the catalog
rows and walk orders; structure is never patched, `constants-files-tests.md §9`); `resolveEntry(id, context)` and
`entriesIn(category): readonly ResolvedGroup[]` are pure and read every number from `context`. Search, if #354 wants it, runs over resolved
titles and summaries and needs nothing more from the model.

**List groups.** `encyclopedia/model/groups.ts` declares `ENTRY_GROUP` (closed ids) and #354's
`ENTRY_GROUP_LABEL`; the registry **derives** each entry's group, never content: basics → `rules` (concepts) or `reading_the_screen` (`hud:`); entities → `cells` (cell kinds) or `food` (food kinds, variants, `concept:food`,
`entity:dna_fragment`); evolutions → `stages`, then one group per `TRAIT_CATEGORY` in catalog order (the trait's own
category), then `dna_tags`; world → `dish_and_zones` (the dish, zones) or `time` (world clock, bloom, round);
abilities and actions → `null`. A spec pins that every entry of a grouped category has a group and that group order
follows the category's walk.

**The context provider.** `encyclopedia/encyclopedia-context.ts` is the one place a `FactContext` is made:
`factContextFor(balance: BalanceConfig | null)` (pure: the room's balance, else `DEFAULT_BALANCE`) and
`EncyclopediaContextService`, a root-provided service exposing `context: Signal<FactContext>` computed from
`GameStateService.balance`. Components read the signal; nothing else constructs a context.

### 12.3 Facts: values bound to code

```ts
// encyclopedia/model/fact.ts
export interface FactContext {
  /** The live balance: the room's copy in a room, `DEFAULT_BALANCE` outside one. */
  readonly balance: BalanceConfig;
}

/** A typed path to a number leaf: the first two segments are checked by the compiler, deeper ones by §12.6. */
export type BalancePath = readonly [domain: keyof BalanceConfig, name: string, ...keys: string[]];

export type ValueFactSource =
  /** One balance leaf, shown as is: `balancePath('ecology', 'ALGAE_MASS')`. */
  | { readonly kind: 'balance'; readonly path: BalancePath }
  /** A row of the closed formula table with its typed, number-free argument. */
  | { readonly kind: 'formula'; readonly formula: FactFormulaCall }
  /** A catalog quantity from the closed selector set: a count over structure, never a typed number. */
  | { readonly kind: 'catalog'; readonly quantity: CatalogQuantityCall };
/** A link-valued fact from the closed derived-link table (`facts/derived-links.ts`): a trait's stage, a gate's next stage, a food's zones. */
export interface LinkFactSource {
  readonly kind: 'link';
  readonly link: DerivedLinkCall;
}

/** A value fact carries a unit and a presentation (§12.5); a link fact has neither, so neither can be written wrong. */
export type FactDefinition =
  | {
      readonly key: string;
      readonly label: string;
      readonly unit: QuantityUnit;
      readonly presentation: QuantityPresentation;
      readonly source: ValueFactSource;
    }
  | { readonly key: string; readonly label: string; readonly source: LinkFactSource };
// `key` is camelCase: what prose tokens and test ids name.
```

A **catalog quantity** returns `number | null`: `null` where the count does not apply to its subject (the unlock count
of a trait with no `unlockedBy`), and the resolver leaves that fact out rather than showing `0`, as it leaves out a link
fact with no target.

```ts
// encyclopedia/facts/formula-table.ts — the one file where a formula fact's number is computed
export const FACT_FORMULA = {
  radiusAtMass: 'radius_at_mass', // radiusForMass(massOf(argument), balance.growth)
  maxSpeedAtMass: 'max_speed_at_mass', // maxSpeedForMass(...)
  levelUpCostAt: 'level_up_cost_at', // levelUpCost(levelOf(argument), balance.progression)
  engulfPhaseSpan: 'engulf_phase_span', // engulfPhaseSpanSeconds(argument.phase, balance.absorption)
  // … one row per shared function a page needs; a new row is reviewed here, never in content
} as const;
export type FactFormulaId = ValueOf<typeof FACT_FORMULA>;

/** Each formula's argument: ids and closed selectors only, never a number. */
export interface FactFormulaArguments {
  radius_at_mass: { readonly mass: BalanceMassSelector }; // e.g. 'starting' → CELL_STARTING_MASS, 'max' → CELL_MAX_MASS
  max_speed_at_mass: { readonly mass: BalanceMassSelector };
  level_up_cost_at: { readonly level: LevelSelector }; // 'first' | 'last' (MAX_LEVEL from the balance)
  engulf_phase_span: { readonly phase: EngulfPhase };
}
export type FactFormulaCall = {
  [Id in FactFormulaId]: { readonly id: Id; readonly argument: FactFormulaArguments[Id] };
}[FactFormulaId];

export const FACT_FORMULAS: {
  readonly [Id in FactFormulaId]: (balance: BalanceConfig, argument: FactFormulaArguments[Id]) => number;
};

// encyclopedia/facts/catalog-quantities.ts — counts over structure the balance carries
export const CATALOG_QUANTITY = {
  tierCount: 'tier_count', // balance.traits.TRAIT_TIERS[traitId].length
  unlockCount: 'unlock_count', // balance.traits.TRAIT_CATALOG row's unlockedBy.count
  requiresCount: 'requires_count',
  stageCount: 'stage_count', // balance.ladder.STAGE_ORDER.length
} as const;
/** Each selector's argument, exactly as `FactFormulaArguments`: a trait id where the count is per trait, nothing otherwise. */
export interface CatalogQuantityArguments {
  tier_count: { readonly traitId: TraitId };
  unlock_count: { readonly traitId: TraitId };
  requires_count: { readonly traitId: TraitId };
  stage_count: Record<string, never>;
}
export type CatalogQuantityCall = {
  [Id in ValueOf<typeof CATALOG_QUANTITY>]: { readonly id: Id; readonly argument: CatalogQuantityArguments[Id] };
}[ValueOf<typeof CATALOG_QUANTITY>];
```

- **`balance`** is the default. `balancePath` is a typed helper (`balancePath<D extends keyof BalanceConfig>(domain: D,
name: NumberOrTableKey<D>, ...keys)`), so a renamed constant fails `typecheck` at the fact. A leaf the simulation
  does not read is never a path (§12.6 pins the known one: the engulf phase seconds).
- **`formula`** is a call into `FACT_FORMULAS`, whose every row is exactly one call of the shared function the
  simulation calls (`simulation/mass-curves.ts`, `level-costs.ts`, `engulf-pace.ts`, …) with `balance.<domain>`.
  Content supplies an id and a number-free argument; it cannot write a closure, a sum or a local factor
  (`CODE-STANDARDS.md §3`), and the table is the one reviewable file of formulas.
- **`catalog`** selects a count over structure from `CATALOG_QUANTITIES` (same shape, same file rule), read from the
  balance's copy of the structure, never from a module import. Trait tier values are never catalog quantities.
- **The engulf phases.** `ENGULF_COVER_SECONDS`, `ENGULF_WRAP_SECONDS` and `ENGULF_ABSORB_SECONDS` are derived into
  `ENGULF_BASE_DURATION_SECONDS`, `ENGULF_WRAP_START_PROGRESS` and `ENGULF_SEAL_PROGRESS` once at module load, and the
  simulation reads only the derived three. The phase spans shown and previewed are therefore
  `engulfPhaseSpanSeconds(phase, balance.absorption)` = `ENGULF_BASE_DURATION_SECONDS` × the phase's progress band
  (cover `[0, WRAP_START)`, wrap `[WRAP_START, SEAL)`, absorb `[SEAL, 1]`), a new function in shared
  `simulation/engulf-pace.ts` beside `engulfPhaseOf`; it keeps meaning what the game plays whatever #367 decides about
  the derived leaves.
- **Trait tier facts are generated, not declared.** A trait's `tier_<n>` section holds one `ResolvedFact` per
  modifier that tier sets away from identity (`nonIdentityModifiers(balance.traits.TRAIT_TIERS[traitId][n − 1],
balance.traits.DEFAULT_CELL_MODIFIERS)`), keyed by the modifier key, labelled `MODIFIER_LABELS[key].noun` and
  valued `MODIFIER_LABELS[key].formatValue(value)` (`quantities/modifier-labels.ts`, the trait cards' one label table,
  `ui/overlays.md §3.2`), so a card and its encyclopedia page can never read differently and #354 can lay the tiers
  out as rows by modifier (a key missing from a tier is that tier at identity). Its heading is generated too:
  `formatQuantity(n, QUANTITY_UNIT.tier)` → `Tier II`, never written in content.
- **Derived links are computed too:** a trait's `requires` and `unlockedBy.bacteriumVariant`, a stage's gate traits
  (`balance.ladder.STAGE_GATE_TRAITS`), an ability's granting traits (every trait with a tier setting one of the
  ability's modifier keys to a non-identity value), a zone's food weights (`balance.ecology.FOOD_ZONE_WEIGHTS_BY_KIND`),
  a DNA tag's traits (the catalog rows carrying it). `facts/derived-links.ts` declares them as a closed table with typed
  arguments, the shape of `FactFormulaCall` (#360):

  ```ts
  export const DERIVED_LINK = {
    traitStage: 'trait_stage', // the stage a trait is offered from
    traitRequires: 'trait_requires', // the traits it requires
    traitUnlockVariant: 'trait_unlock_variant', // the bacterium variant that unlocks an endosymbiont
    stageGateTraits: 'stage_gate_traits', // balance.ladder.STAGE_GATE_TRAITS[stage]
    stageNext: 'stage_next', // the stage a gate trait climbs to
    stageTraits: 'stage_traits', // the traits a stage opens: catalog rows whose stage is it
    foodZones: 'food_zones', // zones with a non-zero weight in balance.ecology.FOOD_ZONE_WEIGHTS_BY_KIND
    abilityTraits: 'ability_traits', // traits whose tiers set one of the ability's modifier keys
    tagTraits: 'tag_traits', // traits whose catalog row carries the tag
  } as const;
  export interface DerivedLinkArguments {
    [DERIVED_LINK.traitStage]: { readonly traitId: TraitId };
    // … one typed argument per row: a trait id, a stage, a spawned food kind, an ability id or a DNA tag
  }
  export type DerivedLinkCall = {
    [Id in DerivedLinkId]: { readonly id: Id; readonly argument: DerivedLinkArguments[Id] };
  }[DerivedLinkId];
  ```

  Every row reads the live balance's structure, never a module import, and `fact-sources.spec.ts` runs every row over
  every argument its type allows. **A link with several targets yields one `ResolvedFact` per target**, in the table's
  order, sharing the fact's `key` and `label`, so `ResolvedFact.link` stays a single `EntryLink` (docs/ui/encyclopedia.md §11.4 lays
  consecutive facts with one key out as one row); a link with no target yields no fact, and a prose token naming
  a multi-target fact reads as their titles joined by commas.

### 12.4 The closed sets the registry adds

Five subjects have no code enum yet. Each is declared once in `encyclopedia/model/` and **anchored** to a code set
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

// encyclopedia/model/actions.ts — every player intent on the wire has an entry
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

// encyclopedia/model/world-topics.ts
export const WORLD_TOPIC = { dish: 'dish', worldClock: 'world_clock', bloom: 'bloom', round: 'round' } as const;
export type WorldTopicId = ValueOf<typeof WORLD_TOPIC>;

// encyclopedia/model/concepts.ts — the game's core quantities, the pages prose links "mass" and "DNA" to
export const CONCEPT = {
  // basics
  massAndSize: 'mass_and_size',
  massDecay: 'mass_decay',
  engulfRatio: 'engulf_ratio',
  dnaAndLevels: 'dna_and_levels',
  score: 'score',
  worldStanding: 'world_standing',
  // entities
  food: 'food', // the overview of every food kind
} as const;
export type ConceptId = ValueOf<typeof CONCEPT>;

// encyclopedia/model/hud-topics.ts — one page per HUD element, anchored to the element it explains
export const HUD_TOPIC = {
  dnaRing: 'dna_ring',
  levelNumeral: 'level_numeral',
  ladderOrbit: 'ladder_orbit',
  selfRing: 'self_ring',
  threatRing: 'threat_ring',
  leaderboard: 'leaderboard',
  roundClock: 'round_clock',
} as const;
export type HudTopicId = ValueOf<typeof HUD_TOPIC>;
/**
 * The element each page explains, by its `HUD_TEST_ID` key: a removed or renamed element fails `typecheck`.
 * `HUD_TEST_ID` moves from `hud/test-ids.ts` to the neutral `game/test-ids/hud-test-ids.ts` (which `hud/` and
 * `input/` import too), so the anchor keeps "encyclopedia/ never imports hud/", type imports included.
 */
export const HUD_ELEMENT_BY_TOPIC: Readonly<Record<HudTopicId, keyof typeof HUD_TEST_ID>>;

// encyclopedia/model/entry-anchors.ts — every effect and every world standing opens an entry
export const ENTRY_BY_EFFECT: Readonly<Record<EffectKind, EntryId>> = {
  eat: 'action:eat',
  cell_absorbed: 'action:engulf',
  cell_released: 'action:escape',
  level_up: 'action:level_up',
  respawn: 'action:respawn',
  world_level_up: 'world:world_clock',
};
export const ENTRY_BY_WORLD_STANDING: Readonly<Record<WorldStanding, EntryAnchor>> = {
  ahead: 'concept:world_standing#ahead',
  with: 'concept:world_standing#with',
  behind: 'concept:world_standing#behind',
};

// encyclopedia/model/entity-kinds.ts — every ENTITY_KIND has a page
export const ENTRY_BY_ENTITY_KIND: Readonly<Record<EntityKind, EntryId>> = {
  cell: 'cell_kind:player',
  food_mote: 'concept:food',
  dna_fragment: 'entity:dna_fragment',
};
```

`entry-anchors.ts` is its own file because `entry-id.ts` imports `ACTION` and `CONCEPT` to derive `EntryId`: no cycle (#360).

**Reserved values are excluded by name**, never by omission: `RESERVED_FROM_ENCYCLOPEDIA` in
`encyclopedia/model/reserved.ts` lists `CELL_STATE.dividing`, `GAME_MODE.colony`, the reserved trait ids, the
`primary_locomotion` exclusion group and the reserved `GameInput` fields, and a spec pins that each is still reserved
in code (so a value that goes live leaves the list and needs an entry).

### 12.5 Formatting and units: one place

```ts
// quantities/quantity-unit.ts — the one home of unit words, suffixes, decimals and rounding
export const QUANTITY_UNIT = {
  mass: 'mass',
  dna: 'dna',
  worldUnits: 'world_units',
  worldUnitsPerSecond: 'world_units_per_second',
  seconds: 'seconds',
  clock: 'clock', // seconds as `m:ss` (the round timer)
  massPerSecond: 'mass_per_second',
  share: 'share', // a 0..1 ratio, shown as a percent
  sharePerSecond: 'share_per_second',
  multiplier: 'multiplier', // ×
  radii: 'radii',
  count: 'count',
  points: 'points',
  level: 'level',
  tier: 'tier', // 1..n as `Tier I`, `Tier II`; the cards' numeral alone through `numeral` presentation
} as const;
export type QuantityUnit = ValueOf<typeof QUANTITY_UNIT>;

export const QUANTITY_PRESENTATION = {
  plain: 'plain', // `20 mass`
  signedChange: 'signed_change', // a bonus or delta: `+0.5 s`, `+15 %`
  changeFromOne: 'change_from_one', // a multiplier as its change: 1.15 → `+15 %`
  rateFromDuration: 'rate_from_duration', // a duration multiplier as the rate it gives: 0.61 → `+64 %`
  numeral: 'numeral', // the bare figure in the unit's numeral form, no sign, prefix or suffix: `II`, `124`
  countdown: 'countdown', // a running timer, always one decimal so the digits do not jump: `6.0 s`
} as const;
export type QuantityPresentation = ValueOf<typeof QUANTITY_PRESENTATION>;

/** `nearest` for display; `floor` where a reading must never claim more than is there (the DNA percent, the clock). */
export const QUANTITY_ROUNDING = { nearest: 'nearest', floor: 'floor' } as const;

/** Per unit: prefix, suffix, singular suffix, scale (a share × `PERCENT`), decimals (trailing zeros dropped), rounding
 *  and form (a decimal figure, `m:ss`, or a tier numeral from `TIER_NUMERALS`). */
export const QUANTITY_UNIT_FORMAT: Readonly<Record<QuantityUnit, UnitFormat>>;

// quantities/format-quantity.ts — pure
export interface FormatOptions {
  readonly presentation?: QuantityPresentation; // `plain` when absent
  readonly rounding?: QuantityRounding; // the unit's own when absent
}
export function formatQuantity(value: number, unit: QuantityUnit, options?: FormatOptions): string;

// quantities/modifier-labels.ts — moved from hud/format/trait-effects.ts; hud/ and encyclopedia/ both import it
export interface ModifierLabel {
  readonly noun: string; // the effect's name alone: `speed`, `sprint cooldown`; the encyclopedia fact's label
  readonly formatValue: (value: number) => string; // `+15 %`, `−0.5 s`, through `formatQuantity`; the fact's text
  readonly formatLine?: (value: number) => string; // the card line where it is a sentence: `Toxin reaches 1.5 radii`
}
export const MODIFIER_LABELS: Readonly<Record<keyof CellModifiers, ModifierLabel>>;
/** The card line: `formatLine`, else `${formatValue(value)} ${noun}` (`+15 % speed`). */
export function modifierLine(key: keyof CellModifiers, value: number): string;
export function nonIdentityModifiers(
  tierRow: TraitTierModifiers,
  identity: CellModifiers,
): [keyof CellModifiers, number][];
```

**What goes through it.** Every number the player reads as text: the trait cards' effect lines and countdown, the
status mirror's text (`DNA n %`, floored), the round clock (`m:ss`), the leaderboard's mass and score, the menu's
trait list and the encyclopedia. A leaderboard cell and a card's tier are the `numeral` presentation (the column
header or the card names the unit); a mass is shown whole. `PERCENT` and `TIER_NUMERALS` move here from `hud/`; the
HUD keeps `describeTierModifiers(balance.traits, traitId, tier)` as a thin caller. **Not** through it: `data-*`
attribute values, which are machine-readable test hooks (`String(Math.round(mass))` stays where it is). The `−` minus
sign, the space before `%` and the decimal rule the trait cards use today move here unchanged, so no player-facing
text changes. No locale formatting in build 1 (the HUD is English, `ui/layout.md`); a locale later is one change here.

### 12.6 Prose and the tests that bind everything

**Where prose lives.** In the content file of its subject, beside the facts it references
(`encyclopedia/content/<subject>-entries.ts`, one file per subject, each ≤ 250 lines, split by stage for traits if
it outgrows that). Each exports a total record, e.g. `TRAIT_ENTRY_CONTENT: Record<TraitId, TraitEntryContent>`
(summary, one short clause per tier, hand-picked `seeAlso`, and `extraFacts` for facts only that trait's page shows); the builder joins it with the catalog row and the generated
facts and headings. Keeping each entry's copy in one object is also what a later localisation replaces. Trait ids are
snake_case, so `trait-entries.ts` writes `TRAIT_ENTRY_ROWS` (one row per trait, with its `traitId`) and derives the record
through `contentByTrait`: a missing trait fails `typecheck` and a duplicated one throws at module load.

```ts
/** Text with `{factKey}` value tokens and `[[entryId]]` or `[[entryId|shown text]]` links. No numbers. */
export type ProseTemplate = string;
// "Algae drifts in the {zone} and gives {massGain} on contact. Enough of it grows [[action:engulf|an engulfer]]."
```

`resolveProse(template, scope)` splits a template into `ProseSegment`s over `scope = { facts, titleOf, isReference }`: a
value token becomes the text of the facts with its key (a multi-target link's titles joined by `, `), a link its target's
title (or the shown text) with the anchor's `sectionKey`. A tier body carries no value token: the Effects by tier table carries its numbers, and `prose.spec.ts` pins it. A malformed token throws at resolve time and fails the
spec below, never on a player's screen.

**Tests** (`encyclopedia/**/*.spec.ts`, unit tier, jsdom, no Pixi):

| Spec                             | Pins                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry-completeness.spec.ts`  | The registry holds exactly: one `trait:` entry per catalog row with one tier section per tier of its row; one entry per `CELL_STAGE`, `DNA_TAG`, `CELL_KIND`, `FOOD_KIND`, `BACTERIUM_VARIANT`, `ZONE_ID`, `ABILITY`, `ACTION`, `WORLD_TOPIC`, `CONCEPT` and `HUD_TOPIC` value (each `HUD_ELEMENT_BY_TOPIC` value an existing `HUD_TEST_ID` key); every `ENTRY_BY_EFFECT`, `ENTRY_BY_ENTITY_KIND`, `ENTRY_BY_WORLD_STANDING` and `ACTION_BY_INTENT` target (anchors included) exists; every `CellModifiers` key maps to one ability; every value outside the registry is in `RESERVED_FROM_ENCYCLOPEDIA`, and each of those is still reserved in code. Ids are unique; every entry's category is in `ENCYCLOPEDIA_CATEGORY_ORDER`; no category is empty                                                                            |
| `fact-sources.spec.ts`           | Every `balance` path resolves to a finite number in `DEFAULT_BALANCE`, and none names `ENGULF_COVER_SECONDS`, `ENGULF_WRAP_SECONDS` or `ENGULF_ABSORB_SECONDS` (inputs the simulation does not read; the list goes when #367 lands). Every `FACT_FORMULAS` and `CATALOG_QUANTITIES` row, run over a **recording proxy** of the balance with every argument its type allows, reads at least one leaf, and **at least one** of the number leaves it read changes its value when patched on a `structuredClone` (× 2, or + 1 for a leaf at 0), so clamps and branches do not false-fail. Every `DERIVED_LINK` row has one structure change (a row's stage, a gate list, a weight at zero, …) that must move its targets. Every `BalanceConfig` domain is read by at least one fact, counting `balance` paths and proxy reads together |
| `prose.spec.ts`                  | For every entry and section: no digit (`/\d/`), no tier numeral (`/\btier\s+[ivx]+\b/i`, and a bare `/\b[IVX]{2,}\b/`) and no count written as a word (`two` … `twelve`, `either`, `both`) in any template, title, heading or label; no entry or section fact key is a `CellModifiers` key (a tier token reads those); every `{token}` names a fact of that entry or section; every `[[link]]` is a registry id or anchor; `resolveEntry` of every id succeeds over `DEFAULT_BALANCE`                                                                                                                                                                                                                                                                                                                                              |
| `resolve-entry.spec.ts`          | A patched balance (a `structuredClone`, as `applyBalancePatch` leaves it) changes the resolved text of the facts that read the leaf and of the trait tier lines; the generated tier headings follow the tier count; the derived links (requires, granting traits, gate traits) match the balance's catalog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `encyclopedia-context.spec.ts`   | `factContextFor(null)` is `DEFAULT_BALANCE`; a room balance wins; the service's signal follows `GameStateService.balance`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `lint-guard.integration.spec.ts` | Integration tier (a child Node process lints fixture sources with the real `eslint.config.js`). The allowlist below shares no name with any key of any `DEFAULT_BALANCE` domain; it rejects a tunable import, an `import * as` of `@evolution/shared`, a `.tiers` member access (in content too), a number literal, binary arithmetic (`**` included), an increment and a compound assignment under `encyclopedia/content/**`, and accepts `DEFAULT_BALANCE` in both allowed files and every allowlisted name under content, facts and quantities                                                                                                                                                                                                                                                                                  |
| `quantities/*.spec.ts`           | Every unit × presentation × rounding, the trimming and sign rules; the trait card, status mirror, round clock and leaderboard text unchanged by the move                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Lint guard.** `eslint.config.js` gains two blocks (the folders' own `*.spec.ts` and `*.integration.spec.ts` files are exempt: they read `DEFAULT_BALANCE` to pin the
shipped text):

- `packages/client/src/app/game/{encyclopedia,quantities}/**`: `no-restricted-imports` forbids importing an
  `UPPER_SNAKE_CASE` name from `@evolution/shared` (`importNamePattern`) except the **id objects**, which are not
  balance keys: `CELL_STAGE`, `ZONE_ID`, `DNA_TAG`, `CELL_KIND`, `FOOD_KIND`, `BACTERIUM_VARIANT`, `ENTITY_KIND`,
  `EFFECT_KIND`, `CELL_STATE`, `GAME_MODE`, `WORLD_STANDING`, `ENGULF_PHASE`, `TRAIT_CATEGORY`, `TRAIT_RARITY`; the unit
  conversion `SECONDS_PER_MINUTE` (the clock unit; `constants/units.ts`, not a balance key); the ladder rules `FIRST_TIER` and
  `FIRST_LEVEL` (shared `simulation/`, not balance keys); plus
  `DEFAULT_BALANCE` in `encyclopedia/encyclopedia-context.ts` and `encyclopedia/registry.ts` only. Every catalog row,
  walk order (`STAGE_ORDER`, `DNA_TAGS`, `BACTERIUM_VARIANTS`), gate table, tier table, identity record and reserved
  id list is a `DEFAULT_BALANCE` member and is read from the context (or, for the registry's structure, from
  `DEFAULT_BALANCE`). `no-restricted-syntax` rejects `ImportNamespaceSpecifier` from `@evolution/shared` and any
  member access named `tiers` (the catalog's copy of the tier tables, which §9 forbids reading).
- `packages/client/src/app/game/encyclopedia/content/**`: `no-restricted-syntax` rejects number literals, binary
  arithmetic, compound assignments and `++`/`--`, so a content file cannot hold a number or compute one even through a
  named constant. A later `no-restricted-syntax` replaces an earlier one in flat config, so this block repeats the
  live-balance selectors above.

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
  /**
   * Where the camera parks and how much world the lens's **radius** spans (wu), read per frame so a balance patch
   * reframes a scene whose subject's size it moved. Not a px-per-wu zoom: `sizePx` follows `--ui-scale`, and a
   * fixed zoom would shrink the subject on a smaller lens. The session derives the fixed zoom it sets from the
   * canvas it actually has: `zoom = (canvasSidePx / 2) / viewRadiusWu`.
   */
  framing(balance: BalanceConfig): { readonly target: CameraTarget; readonly viewRadiusWu: number };
  /** The cell the camera follows as `ownPlayerId` (the action scenes: the sprint ring, the warning ring), or `null`. */
  readonly subjectPlayerId: PlayerId | null;
  /** One loop of this scene, in ticks; balance-driven wherever the simulation, not the framing, sets the pace. */
  periodTicks(balance: BalanceConfig): number;
  /** Monotonic `tick`; the scene loops internally on its own period. */
  frameAt(tick: number, previousTick: number, balance: BalanceConfig): PreviewSceneFrame;
}

/** Total over `PreviewSpec`. Reads no balance: a scene reads it per frame, so a patch never needs a rebuild. */
export function previewSceneFor(spec: PreviewSpec): PreviewScene;

// render/preview/preview-session.ts
export interface PreviewSessionDependencies {
  readonly host: HTMLElement;
  readonly clock: Clock; // the WALL clock (CODE-STANDARDS.md §8): what the open timings and the frame report are measured on
  /** Where the SCENE's time comes from; the wall clock unless a caller drives one. The evidence route's `ManualClock` goes here — and only here: reading the open off it reports the zero milliseconds it advanced by while the bundle baked. */
  readonly sceneClock?: Clock;
  /** The display's **raw** ratio. The session caps it at `PREVIEW_MAX_DEVICE_PIXEL_RATIO` — one cap site, not two — and passes the capped value to both Pixi's `resolution` and the bake. */
  readonly devicePixelRatio: number;
  readonly sizePx: { readonly width: number; readonly height: number };
  /** `PreviewAppPool.acquire` (`render/preview/preview-app-pool.ts`), so every open in a page shares one context (#503). */
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  /** Read every frame: the live balance, so a patch retimes an engulf preview as it plays. */
  readonly balance: () => BalanceConfig;
  /** `true` on the evidence route only (`toDataURL` needs it); `false` in the encyclopedia: it copies the framebuffer every frame. */
  readonly shouldPreserveDrawingBuffer: boolean;
}

/** `openedToFirstFrameMs` split, so a miss points at its lever (the cost table below). */
export interface PreviewOpenTimings {
  readonly initMs: number; // createPixiApp: the WebGL2 context and Pixi init on the first open, re-hosting the kept app after it
  readonly bakeMs: number; // createRenderTextures
  readonly firstSubmitMs: number; // the first frame: texture uploads and shader compiles
  readonly openedToFirstFrameMs: number;
}

export class PreviewSession extends FrameLoopSession {
  /**
   * Opens on `spec` and resolves with the open timings once the first frame has been **submitted** (`app.render()` has returned; the frame is not
   * necessarily presented), or with `null` when `destroy` ran first: an app that arrives after `destroy` is destroyed on arrival (`RenderSession`'s
   * `isDestroyed` guard). The first spec is taken here rather than through `show`, so `openedToFirstFrameMs`
   * always covers a frame that was drawn instead of an ordering rule nothing enforces.
   */
  start(spec: PreviewSpec): Promise<PreviewOpenTimings | null>;
  /** Swaps the scene and restarts the local clock; no texture work. */
  show(spec: PreviewSpec): void;
  /** A `--ui-scale` change: the canvas resizes and the framing follows it; nothing is rebaked. */
  resize(sizePx: { readonly width: number; readonly height: number }): void;
  /** One frame with a no-op submit: the clips advance, nothing is drawn. The evidence route's walk, and only its. */
  walkFrame(): void;
  /** The UI pause (reduced motion, a pane without a preview): the preview app's own `ticker.stop()`, never the debug `FrameGate`. */
  pause(): void;
  /** `ticker.start()`, and the local clock is re-based so the paused span never plays. */
  resume(): void;
  destroy(): void;
}
```

**The local clock.** `localSeconds = (clock.nowMilliseconds() − shownAtMs) / MILLISECONDS_PER_SECOND` from the
injected `Clock`; `renderTick = localSeconds / TICK_INTERVAL_S`; `timeSeconds` as in play (`rendering/cells.md §1`:
the only time the renderer sees). Time is **monotonic and never wraps**: the clip tracker, the ghost registry and the sprint-ring tracker key on
`nowMs`, and a backwards jump would strand their clips. A scene loops by taking its phase modulo its period and
emitting each loop's effects at their absolute ticks. A prey absorbed in an engulf loop reappears with the **same id**
after a `respawn` effect, once the `absorbed` clip has ended, so its cosmetic fork (`cell:<id>`) and its look are
identical every loop. **Paused and hidden time never plays:** `resume` re-bases `shownAtMs` by the paused span, and
because rAF also stops while the tab is hidden without any pause, `frameAt` never looks back more than one period
(`previousTick = max(previousTick, tick − periodTicks)`), so a return after minutes emits at most one loop's effects
instead of hundreds at one `nowMs`. The preview never installs `window.__evolutionDebug` (the room's hook stays in
place while the encyclopedia is open); only the evidence route does.

**The fixture frame.** `render/preview/preview-frame.ts` wraps a scene frame into the `RenderFrame` the renderer
takes: `balance` is the live one, `latest` a fixture `GameSnapshot` built there (production code never imports
`testing/`), cells get `radius = radiusForMass(mass, balance.growth)` and `stage = stageOf(traitIds, balance.ladder)`,
so a trait preview's silhouette is exactly the ladder's. Scene timings come from what the simulation reads: the
engulf phases from `engulfPhaseSpanSeconds(phase, balance.absorption)` (§12.3), and `SPRINT_DURATION_SECONDS`,
`SPRINT_COOLDOWN_SECONDS`, `BACTERIUM_DRIFT_SPEED` from the balance; the preview's own numbers are framing only
(canvas aspect, zoom per scene, the mass a single-cell preview is drawn at, the swim loop's radius and period, the
gap between loops) and live in a new `render/constants/preview.ts` page. A trait's preview cell owns the trait's
transitive `requires` at tier I and the trait at the section's tier; a zone preview's target comes from the geometry
the dish bake already reads (`DISH_RADIUS`, `SHALLOWS_WIDTH`, `VENT_RADIUS` through `camera.ts` / `dish-texture.ts`),
and its texture bundle is built with one fixture gel patch the `viscous_gel` scene parks on.

**The texture bundle.** Built once per session by `createRenderTextures` with `PREVIEW_SEED` (a
`render/constants/preview.ts` constant), the fixture gel patches and the session's **capped** `devicePixelRatio` (`min(devicePixelRatio, PREVIEW_MAX_DEVICE_PIXEL_RATIO)`, the same value Pixi's `resolution` gets, so a 3× display bakes 2× atlases for its 2× canvas, never 3× ones); `show` never
rebakes, so every entry's preview reuses it and a seed-fixed screenshot is reproducible.

**Two traps the seam closes:**

- **BitmapFont names are global.** `createIndicatorTextures` installs the `value` / `label` fonts into Pixi's
  process-wide `BitmapFont` cache by name, and `destroyIndicatorTextures` uninstalls them. A second bundle under the
  same names would overwrite the room's install, and destroying the preview would uninstall the room's fonts. The
  seam ticket suffixes the installed names per bundle **instance** (a per-process counter in
  `textures/bitmap-fonts.ts`, never the seed: two bundles of `PREVIEW_SEED`, or a kept-alive session, must not
  collide; `IndicatorFontNames` already carries the names to `BitmapText`) and pins that two bundles install
  distinct names, that destroying one leaves the other's installed, that an uninstall removes the name from Pixi's
  cache, and that no live `BitmapText` names an uninstalled font (Pixi would silently install a dynamic font under
  the unknown name, one per open).
- **`BitmapText` crashes jsdom.** The Angular side never builds a `PreviewSession` in a spec: it asks for an
  `ENCYCLOPEDIA_PREVIEW` injection token (`render/preview/preview-host.ts`: `(host, sizePx) => PreviewHandle`, with
  `show` (also the replay: it restarts the scene), `pause`, `resume`, `resize(sizePx)` (a `--ui-scale` change:
  the canvas resizes, nothing is rebaked) and `destroy`; the handle exposes no zoom, so #354 draws no scale bar), provided like `clock-provider.ts`, and component specs provide a recording
  fake. `preview-session.spec.ts` runs over the fake `PixiAppHandle` and the fake baker `render-session.spec.ts`
  uses, and never draws the indicator texts (`NO_HUD_INPUTS`).

**The lens (#368 B, Eyepiece).** The preview is a round microscope lens beside the facts. #354 fixes its diameter
(`ENCYCLOPEDIA_LENS_DIAMETER_PX` CSS px × `--ui-scale`) and owns everything drawn around it: the rim, the reticle ticks and the edge vignette are
its DOM SVG overlay above the canvas. This seam owns the canvas and the crop.

- **Canvas:** the lens's bounding square, `sizePx = { width: D, height: D }` with `D = ENCYCLOPEDIA_LENS_DIAMETER_PX × --ui-scale`, so
  `sizePx` changes only with the UI scale and `resize` is the only path for it. `PREVIEW_CANVAS_MAX_PX` 900 and
  `PREVIEW_MAX_DEVICE_PIXEL_RATIO` 2 are plain render constants in `render/constants/preview.ts`: the session caps the
  DPR it uses at the second (a 3× display shows the canvas upscaled 1.5×) and clamps each side of the canvas, in
  device pixels, to the first. Neither is computed from the lens diameter or the kit's scale maximum, because
  `render/` imports nothing from `encyclopedia/` or the UI kit (§12.8). The bound is sized for `ENCYCLOPEDIA_LENS_DIAMETER_PX`
  × the kit's scale maximum (`UI_SCALE_MAX`) × `PREVIEW_MAX_DEVICE_PIXEL_RATIO`, and
  an encyclopedia-side spec (`encyclopedia-lens.component.spec.ts`) pins that product ≤ `PREVIEW_CANVAS_MAX_PX`, so a
  larger lens or scale fails a test instead of silently clamping. **The invariant holds today with no headroom, so do the arithmetic before changing
  any of its three terms:** `UI_SCALE_MAX` is 1.5 and the DPR cap is 2, so 900 admits a lens of at most **300 CSS
  px** — and `ENCYCLOPEDIA_LENS_DIAMETER_PX` is already 300 (`ui/encyclopedia.md`'s constants table), making the
  product exactly 900. Raising the diameter, `UI_SCALE_MAX` or `PREVIEW_MAX_DEVICE_PIXEL_RATIO` by any amount
  breaks #373's spec, and the canvas then silently clamps. #363's evidence route draws its lens at 360 CSS px, which
  is **not** a counter-example: that route is a standalone page with no encyclopedia panel and no `--ui-scale`, so
  its 360 is its own framing and never multiplies by 1.5. At the cap the canvas's GPU buffers are about 10 MiB (the cost table).
- **Crop:** `border-radius: 50%; overflow: hidden` on the stage host that holds the canvas; never a Pixi mask (a
  stencil pass and extra draw calls every frame) and never a CSS `clip-path` (which promotes the canvas to its own
  composited layer with an offscreen surface of up to the canvas's size plus the mask). The rounded overflow clip is
  applied while the compositor draws the canvas quad, with no offscreen surface. The square's corners (1 − π/4 ≈ 21 %
  of the fill) are still rendered. The loading and unavailable states fill the same circle, so no square shows before
  the first frame. The renderer's own screen vignette is square; its corners fall outside the clip.
- **Framing:** scenes are authored for 1:1, through each scene's `framing.target` and `zoom`, in two bands. The
  `cell` family **derives** its view radius from the subject rather than carrying a constant (#364): a lens sized
  to hold a tier-III flagellate's tail is about 2.5 radii of empty broth around a bare protocell, which has no
  tail, and no one number serves both — at the 4.4 radii the tail needs, a protocell's body sat at 0.26 of the
  lens radius against the 0.8 band. `cells/cell-draw-extent.ts` bounds how far a given cell can be drawn, over any
  frame, and `cell-scene.ts` frames whichever band binds to `PREVIEW_CELL_BODY_FILL_FRACTION` /
  `PREVIEW_CELL_DRAWN_FILL_FRACTION`. Because the bound is time-independent the zoom never breathes with the
  membrane; because it is a bound, the bands below hold for every tick of the loop by construction, and
  `preview-framing.spec.ts` measures the frames the renderer actually builds against them. A
  subject's **body** (every cell's membrane at its widest, stretch and engulf arms included) lies inside
  `PREVIEW_LENS_SAFE_RADIUS_FRACTION` 0.8 of the radius. Its **appendages** (a flagellum, cilia, pseudopods) may reach
  into the vignette band between 0.8 and the rim, and nothing drawn ever reaches past the rim (1.0), so nothing is cut
  off by the crop. The two-cell `engulf` and `escape` scenes keep both bodies inside 0.8. Scenes never know they are
  round.
  **0.8 is a ceiling, not a target, and the two bands cannot both be filled** (#364). A flagellum is
  `FLAGELLUM_LENGTH_RADII` 2 plus its wave, so a body framed at 0.8 would put its tail past 2.2 of the rim: for a
  flagellate the rim band binds and the body lands well under half the lens. That is a property of the framing
  rule, not a measurement. `cell-draw-extent.ts` roots the tail's bound on the membrane **at the rear**, where the
  renderer roots it (#491), at the peak of every surface term; a swimming flagellate fills its rim band to 0.9996,
  and a resting one to 0.985, since the lobe under the rear depends on a heading the bound cannot take. A scene fills **whichever band binds** and lets the other fall where
  it must — a cell framed so its body reaches 0.8 is a cell whose appendages
  are outside the lens. Do not read the 0.8 as something a cell scene should be retuned toward.

**Who owns the handle** (#466). `encyclopedia.component` **provides** `encyclopedia-preview.service.ts`, so the one
handle opens with the panel and is destroyed with it. The service makes the host element itself and lends it to
whichever lens is mounted, rather than being handed the lens's own stage: `createPixiApp` appends the canvas to the
host it is given and a session cannot be re-hosted, so a host that belonged to the lens would die with the first
landing the reader stepped out to, and the next entry would pay the whole bake again. The entry page says _what_ to
show — its own spec, or the tier its switch is on — and the service opens on the first one and `show`s every one
after it, once the selection has rested `ENCYCLOPEDIA_PREVIEW_SETTLE_MS`. The lens pauses the session as it goes and
resumes it as the next one arrives, which covers both a landing and an entry without a preview.

**What #363 built and what #364 added.** The session, the frame, the four **subject** scenes (`cell`, `food`,
`dna_fragment`, `zone`), the host token, the per-bundle BitmapFont names and the evidence route are #363's.
Ticket #364 built the five **action** families: the three single-cell ones (`eat`, `sprint`, `level_up`) — the
first scenes to emit effects at all, so the framing has to account for what a clip does to a cell and for the
effect sprites drawn around it (`cells/cell-draw-extent.ts`'s `CellDrawState`) — and the two-cell ones (`engulf`,
`escape`, `preview/scenes/engulf-pair.ts`), where the **subject holds the lens centre and its partner moves**: the
pair sits at exactly `ENGULF_MASS_RATIO` so each phase lasts exactly `engulfPhaseSpanSeconds`, contact is the
server's `ENGULF_COVERAGE_FRACTION` rule, the approach closes at the predator's own top speed, and every effect
fires where the server fires it (`cell_absorbed` and `cell_released` at the prey, `respawn` where the prey comes
back). The escape scene supplies the HUD's own-cell record with the predator as its one threat, so the escape arc
and its labels draw as in play. `previewSceneFor` is total over `PREVIEW_SCENE` with no stand-in left. The evidence
route also answers a bare `PREVIEW_SCENE` name (`?preview=engulf`) as well as an entry anchor, so a family the
registry has no entry for yet (the actions, until #362) is still reachable for a screenshot.

**Still frames are not in build 1.** List rows and landing tiles draw code-drawn glyph medallions (#354). A cached
still capture from the same app (`still(spec, sizePx): Promise<ImageBitmap>`, one extract per frame at most) is the
follow-up seam ticket #378, which carries its own cost; nothing in build 1 depends on it.

**Lifecycle and cost of opening a preview.**

| When                                                    | Paid                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Budget (reference GPU of `rendering/budget.md §7`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First detail view with a preview, per encyclopedia open | A WebGL2 context and Pixi init on the page's **first** open only (every later open takes the kept app back from `PreviewAppPool`, so no program compiles again); the full bundle bake a room pays at startup: the dish field, the light pool, the noise tile with mips, strip, palette, glow / mote / organelle atlases, indicator textures and fonts. **Memory ≈ 40 MiB per bundle** while open: each `CanvasSource` keeps its bake canvas, so the 2048² dish field (16 MiB) and the 1024² light pool (4 MiB) are each held twice, as the texture and as the canvas's accelerated backing                                                                                                                                                                                                                                                                                                                                                                    | `openedToFirstFrameMs` ≤ `PREVIEW_OPEN_BUDGET_MS` 300, p95 over **20 opens in one page** (`RENDER_P95_MIN_SAMPLE_FRAMES`), the cold first open reported apart, split into init / bake / first submit. The number is **submit-side**: the frame ends at `app.render()`, which returns once the GL commands are queued, not once the frame is presented, so a hardware run understates the open. The three spans bracket exactly the calls they name and so do not sum to the total. **No baseline exists yet**: nothing measures the room's own startup, so #363 records it through the same instrument. The list and text render at once and the lens shows #354's loading state |
| Switching entries                                       | `show`: a new scene, registry churn of at most a handful of render states; no bake, no allocation proportional to the bundle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | one frame                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Every frame while visible                               | One `GameRenderer.render` at ≤ 3 cells, ≤ 40 motes, ≤ 10 fragments on a square canvas of at most `PREVIEW_CANVAS_MAX_PX` **device pixels** (the lens diameter × the capped DPR). **Canvas memory ≈ 10 MiB at the cap** (900² device px): the color backbuffer (3.2 MiB), the depth-stencil buffer Pixi requests with `stencil: true` (3.2 MiB) and the browser's presented front buffer; ≈ 13 MiB on the evidence route with `preserveDrawingBuffer`. With the bundle that is **≈ 50 MiB while the lens is open**. Only these buffers follow the canvas size; the bundle and the first-frame budget do not. Nothing in the preview draws a Pixi mask, so creating its app without a stencil buffer is an option that would save the 3.2 MiB; #363 measures it before anything is built; the same ≤ 17 draw calls on its own context, from its own ticker in the same rAF turn as the room's. The room keeps rendering behind the menu (the dish never pauses) | preview frame CPU p95 ≤ `PREVIEW_FRAME_BUDGET_MS` 1.0 (its own `FrameInstrumentation` report, warm-up frames excluded, per-stage split). **The page:** the room ticker's `deltaMS` p95 (the rAF interval) and dropped frames over ≥ 20 frames, encyclopedia open vs closed, within the room's §7 budget. The room's in-bracket frame time is not the measure: the preview's callback and submit land outside it                                                                                                                                                                                                                                                                  |
| Encyclopedia closed                                     | `destroy`: the renderer and the bundle are released, also when it lands before `start` resolves, and the app goes back to the page's `PreviewAppPool` (canvas out of the DOM, ticker stopped) rather than being destroyed: `app.destroy` calls `loseContext()`, which browsers log as `WebGL context was lost` on every close (#503). The page holds one preview context and its canvas buffers (≈ 10 MiB at the cap) from the first open on; an open at a different device pixel ratio replaces it. Before the bundle goes, `PixiAppHandle.unbindTextures` points the particle pipe's shared shader back at `Texture.WHITE`, or destroying the last `ParticleContainer` texture logs Pixi's `[BindGroup] … destroyed while still bound` warning                                                                                                                                                                                                              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Pane without a preview, reduced motion                  | `pause`: the preview ticker stopped, zero rAF callbacks, the last frame held; `resume` re-bases the clock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 0 per frame                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tab hidden                                              | rAF stops by itself; the one-period clamp covers the return                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 0 per frame                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

The two budgets are new, owned here, and land as constants in `render/constants/preview.ts` beside the bench's.
**Measurement.** The evidence route writes its report into the DOM as the bench route does (a `data-testid`
element carrying the open timings with the cold open apart, the preview frame report, the page's rAF interval and
dropped frames, and the verdict against both budgets), so a hardware run is one URL. **Which surface reports what:**
the bare route (`?preview=<anchor>&opens=20`, one scene) has no room, so it reports the open timings and the preview
frame report only; the page's rAF interval p95 and dropped frames, encyclopedia open vs closed, come from a **live
room** with the encyclopedia open over it, read from the room ticker through the room's debug hook. The container's browser is SwiftShader (about 9 s a frame, a CPU-rasterised
submit), so #363's smoke asserts only the report's **shape** (every value reported and finite, every key present,
nothing leaked, below) and `rendering/budget.md §7` records the absolute numbers as **unmeasured**. No agent has a
real GPU: when #363 lands, the lead files a hardware-run request for the human.

**If a budget is missed**, the levers, in order: **0.** throttle the room renderer to every other frame while the
encyclopedia covers it (a few lines in `FrameLoopSession`; snapshots still apply on arrival, so the room loses no
simulation state); **1.** keep the preview session alive across encyclopedia opens for the room's lifetime (one bake
per room, about 40 MiB held); **2.** a bundle option that skips the dish field and light-pool bakes for scenes that do
not show the dish (which also halves the memory). None is built before a measurement asks for it.

**Rejected alternatives.**

- _Drawing the preview into the room's canvas_ (a second `GameRenderer` in a masked sub-rectangle of the room's
  stage): no second bake, but the DOM panel would need a transparent hole kept in sync with a canvas rectangle, the
  menu's scrim would have to be cut around it, the debug pause gate would freeze it with the room, a rematch rebuild
  would tear it down, `GameRenderer` has no viewport offset or mask, and it could never open outside a room.
- _Rendering to a texture and copying it into the DOM:_ a `readPixels` per frame, far over any frame budget.
- _Screenshots or recorded clips:_ excluded by the epic (code-drawn and live, `ASSET-GENERATION.md`), and stale on
  the first retune.

**Evidence route.** `?preview=<EntryAnchor>&t=<seconds>` (dev builds only, behind the same production gate as
`bench/bench-route.ts`) mounts one preview on a `ManualClock` for graphics-qa screenshots and the Playwright smoke.
Clips and effect sprites start at the frame's `nowMs`, not the effect's tick, so the route **walks the clock** from
the loop's start to `t` in `TICK_INTERVAL_S` steps before it parks, feeding every walk frame to
`GameRenderer.render` with a no-op submit (the clips and registries advance, nothing is drawn; a 3 s loop is 180
frames, about 27 minutes of SwiftShader submits otherwise) and submitting only the parked frame: a frame parked at `t` then shows
the clips already in progress exactly as a live preview does at `t`. It crops the stage exactly as the encyclopedia does (the same rounded overflow clip), so graphics-qa's element screenshots show the lens the player sees, while the pixel-equality checks read the canvas buffer (`toDataURL`, the full square: a CSS clip does not touch it). It is the one place the preview installs
`window.__evolutionDebug` and sets `shouldPreserveDrawingBuffer`; `opens=<n>` repeats open and close `n` times in one
page for the measurement and the leak loop, all on one `PreviewAppPool` as the encyclopedia's opens are. It lives in `encyclopedia/preview-route.ts`, the one module allowed to
join an entry id to its spec and the render seam. `render/` never imports from `encyclopedia/`.

### 12.8 File plan

```text
packages/client/src/app/game/
  quantities/{quantity-unit,format-quantity,modifier-labels}.ts    units, suffixes, decimals, rounding; the one formatter; the modifier label table (§12.5)
  encyclopedia/model/{entry-id,entry,fact,prose}.ts      the closed types, ids, definitions, resolved shapes, token parser
  encyclopedia/model/{categories,groups,abilities,actions,world-topics,concepts,hud-topics,entity-kinds,entry-anchors,reserved}.ts   the registry's own closed sets and their anchors (§12.4)
  encyclopedia/{build-entries,resolve-entry}.ts                    content + the balance's structure → definitions; one definition + context → ResolvedEntry (pure)
  encyclopedia/facts/{balance-path,formula-table,catalog-quantities,resolve-fact,resolve-prose,derived-links}.ts   typed paths, the closed formula and catalog tables, value + unit → text, template → segments, computed links
  encyclopedia/content/{trait,stage,dna-tag}-entries.ts            evolutions (trait tier sections and headings generated from balance.traits.TRAIT_TIERS)
  encyclopedia/content/{concept,hud}-entries.ts                   basics (and `concept:food`, in entities)
  test-ids/hud-test-ids.ts                                          HUD_TEST_ID, moved out of hud/ (hud/, input/ and encyclopedia/ import it)
  encyclopedia/content/{cell-kind,food,bacterium,entity}-entries.ts   entities
  encyclopedia/content/{zone,world}-entries.ts                     world
  encyclopedia/content/{ability,action}-entries.ts                 abilities and actions
  encyclopedia/registry.ts                                          ENCYCLOPEDIA_ENTRIES, entryById, resolveEntry, entriesIn
  encyclopedia/encyclopedia-context.ts                              factContextFor, EncyclopediaContextService (§12.2)
  encyclopedia/preview-route.ts                                     the dev evidence route (§12.7)
  encyclopedia/**/*.spec.ts  encyclopedia/encyclopedia.integration.spec.ts   §12.6, §12.9
  render/preview/**                                                 the seam; its file list is rendering/files-and-tests.md §8
  render/constants/preview.ts                                       preview framing, seed and budgets
packages/shared/src/simulation/engulf-pace.ts                       + engulfPhaseSpanSeconds (§12.3)
```

The encyclopedia's UI component files are #354's and sit at the root of the same folder,
`packages/client/src/app/game/encyclopedia/` (its `docs/ui/encyclopedia.md` lists them, with their test ids and
`format/`); the ESC menu and the UI kit are #354's too. Trait glyphs live in a neutral `game/glyphs/`, and the HUD
shell projects its alert strip into the panel, so the rule below holds for the components as well. Import direction:
`quantities` ← `encyclopedia/model` ← `encyclopedia/facts` ← `encyclopedia/content` ← `registry.ts` ←
`encyclopedia-context.ts` ← components; `hud/` ← `quantities` too, and `encyclopedia/` never imports from `hud/`;
`encyclopedia/model/fact.ts` imports its call types (`FactFormulaCall`, `CatalogQuantityCall`, `DerivedLinkCall`) from
`encyclopedia/facts/` as types only, and nothing in `facts/` imports `model/fact.ts` back but the resolver;
`encyclopedia/content` imports `render/preview/preview-spec.ts` as a type only; `render/` imports nothing from
`encyclopedia/`, `quantities/`, `hud/` or `state/`. `test-ids/` is a leaf that imports nothing.

### 12.9 Test plan

- **Unit:** §12.6's specs; `engulf-pace.test.ts` in shared (`engulfPhaseSpanSeconds` sums to
  `ENGULF_BASE_DURATION_SECONDS` over the three phases and follows a patched `ENGULF_SEAL_PROGRESS`);
  `preview-scene.spec.ts` (every `PREVIEW_SCENE` has a builder; same spec + tick ⇒ same frame; ticks are monotonic
  across a loop; each loop emits its effects once; a tick jump of many periods emits at most one loop's effects);
  `scenes/engulf-scenes.spec.ts` (the engulf scene's phase boundaries follow a patched
  `ENGULF_BASE_DURATION_SECONDS` and `ENGULF_SEAL_PROGRESS`, the leaves the simulation reads; the absorbed prey
  returns with its id after the `absorbed` clip's duration and leaves on its `cell_absorbed`'s tick; the pair can
  engulf by the shared `canEngulf`; the escape's release is `escaped`, lands before the seal and at the prey, and
  its record carries the threat, then the escape arc); `preview-frame.spec.ts` (radius and stage through the
  shared formulas, the live balance on the frame); `preview-session.spec.ts` over the fake app (one bake per session, none on `show`; `destroy` before `start`
  resolves destroys the late app and resolves `null`; N open and close cycles give apps created = apps destroyed,
  font installs = uninstalls and bakes = bundle destroys; `pause` stops the preview ticker and never touches the
  `FrameGate` or installs the debug hook; `resume` re-bases the clock); `preview-route.spec.ts` (the walked frame at
  `t` equals a session sampled live at `t`; the report element carries every key); `indicator-textures.spec.ts`
  (distinct font names per bundle instance, two bundles of one seed included; destroy uninstalls only its own and
  removes the name from Pixi's cache; no `BitmapText` names an uninstalled font).
- **The encyclopedia side (#466):** `encyclopedia-preview.service.spec.ts` over the recording `ENCYCLOPEDIA_PREVIEW`
  fake (one session per panel and a `show` per page after it; the settle's two sides; a selection that arrived during
  the open; `unavailable` once and never retried; pause on the lens leaving and resume on the next; the canvas sized
  and resized at the diameter × `--ui-scale`); `encyclopedia-lens.component.spec.ts` (the four states' DOM, the crop
  being a rounded overflow and not a `clip-path`, the canvas moving into the stage and back out, and the canvas-bound
  pin above); `format/lens-overlay.spec.ts` (the eyepiece's geometry, including that no tick reaches the safe circle).
- **Integration:** `encyclopedia/encyclopedia.integration.spec.ts` applies a `game_state` through the real
  `WorldStore` and `GameStateService`, resolves every registry entry through `EncyclopediaContextService`, applies a
  `balance_updated` patch, and sees the patched values in the resolved entries; with no room, the entries resolve over
  `DEFAULT_BALANCE`. It covers every entry the registry holds, so each content ticket extends it by landing content.
- **Playwright smoke (WebGL, SwiftShader in the container):** the evidence route for one entry per `PREVIEW_SCENE`:
  no page or shader errors, the canvas non-empty, two loads at the same `t` give the same pixels and a different `t`
  changes them; **20 open and close cycles** (`opens=20`, on one scene only) log no `Too many active WebGL contexts` warning; the DOM
  report has its shape (values reported and finite); no absolute time is judged in the container. graphics-qa
  screenshots under `qa/evidence/<pr>/`; the hardware run reads the same report.
