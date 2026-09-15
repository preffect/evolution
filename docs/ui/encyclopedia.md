# Evolution — UI: HUD, overlays and onboarding: the encyclopedia

§11 of the split [`UI.md`](../UI.md), which keeps the shared context and the file list.

## 11. Encyclopedia

Ticket #354, epic #353. This file owns what the player sees: the categories as the player meets them, navigation,
search, cross-links and the layouts. The content model (the registry, entry ids, values bound to code, prose, the
completeness tests) and the live-preview seam are the architect's, #355; where this file names an id or a registry
field it is a proposal **to align with #355**, and #355's file wins where they differ. Every piece is built from the
UI kit ([`components-and-constants.md §10`](./components-and-constants.md#10-the-ui-kit-354)); the ESC menu that opens
it is [`overlays.md §3.5`](./overlays.md#35-menu-escape). Mockups: `qa/decisions/encyclopedia/`.

**The layout is pending decision #DECISION** (A atlas, B eyepiece, C codex). This file specifies **A**, the
recommendation; §11.8 lists what changes if B or C is picked. The navigation model, the categories, the entry page's
content and the kit do not depend on the answer.

### 11.1 What it is, and where it opens

A reference for every thing in the game, in the player's words: what it is, what it does to you, the numbers, and
the real thing moving. Every number is a code value (#355), never typed text, and every preview is the game's own
renderer, never a picture.

| Opened from                                   | Opens at                                                  | Escape / Close returns to          |
| --------------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| ESC menu → `Encyclopedia` (§3.5)              | the last location this session, else the `basics` landing | the menu, focus on `Encyclopedia`  |
| ESC menu → a `Your traits` row (§3.5)         | that trait's entry (`traits.<traitId>`)                   | the menu, focus on that row        |
| `H` in play (`ENCYCLOPEDIA_KEY_CODE`, §4)     | the last location this session, else the `basics` landing | the game, focus on the canvas host |
| The lobby header's `Encyclopedia` button (§2) | the last location this session, else the `basics` landing | the lobby, focus on the button     |

**The lobby opens it too.** Reading the rules before joining a round is the calm moment to do it, and the page
needs no room: outside a room the values are `DEFAULT_BALANCE`'s and the previews run on the preview seam alone
(#355). Inside a room the values are the room's live balance (#355 decides the binding; the page shows no caption
for it).

**In a round the dish keeps running.** The encyclopedia is a modal overlay (`openOverlay = 'encyclopedia'`,
components-and-constants.md §7): a callout-backing scrim at `ENCYCLOPEDIA_SCRIM_ALPHA` over the whole viewport, the
kit focus trap, and the same input gate as the menu (§4): only `1` `2` `3` and Escape reach the game, the steer
target stays latched (the pointer over the panel does not steer), sprint and the Tab hold are swallowed. The panel
covers most of the dish, so it carries the one fact that must not be missed, the **alert strip**:

| `data-alert-kind` | Shown while                                         | Text (from the HUD's own formatters, never a copy)              | Tone           |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------- | -------------- |
| `engulfed`        | `ownCellIndicators.engulfed` is set (hud.md §3.1.2) | the escape label (`SPRINT TO ESCAPE`, `SEALED`)                 | danger rim     |
| `threat`          | `threats` is non-empty                              | the threat label (`AMOEBOID CAN ENGULF YOU`)                    | danger rim     |
| `offer`           | `ownProgress.offer !== null`                        | the picker title and timer (`LEVEL 5 · CHOOSE A TRAIT · 6.5 s`) | level gold rim |

One strip at a time, in that priority; it is a kit pill (`label` role, `WHITE` text, a dot and a 1 px rim in the
tone, on the callout backing) and a button: activating it closes every overlay and returns focus to the canvas host.
The menu shows the same strip (§3.5), rendered by one component (`hud/overlay-alert.component.ts`) over the pure
`overlayAlertFor`. Outside a round there is no strip.

### 11.2 Categories (to align with #355)

The rail, in this order. "Entries" is where the list comes from; a count shown in the rail is the list's length,
never a typed number.

| Order | Id          | Rail name | What a player finds there                                                                                                                             | Entries                                                            |
| ----- | ----------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1     | `basics`    | Basics    | Mass and size (bigger is slower), DNA and levels, DNA tags, mass decay, who can engulf whom, score, death and respawn, the round and the rematch      | the concept ids #355 defines                                       |
| 2     | `evolution` | Evolution | The five stages and what climbs each rung                                                                                                             | `STAGE_ORDER`                                                      |
| 3     | `traits`    | Traits    | One entry per trait, grouped by its `TRAIT_CATEGORY` in catalog order                                                                                 | `TRAIT_CATALOG`                                                    |
| 4     | `abilities` | Abilities | The mechanics traits grant: photosynthesis, toxin drain, toxin aura, spines, grip, spit-out, food attraction, digestion, DNA kept on death            | #355's grouping of the ability-shaped `CellModifiers`              |
| 5     | `actions`   | Actions   | Steer, sprint, eat, engulf (cover, wrap, seal), escape, pick a trait                                                                                  | #355's action ids                                                  |
| 6     | `cells`     | Cells     | The player cell and the wild cell                                                                                                                     | the cell kinds                                                     |
| 7     | `food`      | Food      | Algae mote, the three bacterium variants, detritus, the DNA fragment                                                                                  | `FOOD_KIND` × `BACTERIUM_VARIANTS`, plus `ENTITY_KIND.dnaFragment` |
| 8     | `world`     | World     | The four zones, the dish wall, the bloom                                                                                                              | `ZONE_ID`, plus the wall and the bloom                             |
| 9     | `hud`       | HUD       | Reading the screen: the DNA ring, the level numeral, the ladder orbit, the self ring and seat mark, the threat ring, the leaderboard, the round clock | hud.md §3.1's elements                                             |

**Entry ids** are `<category>.<code id>` wherever a code id exists: `traits.mitochondrion`, `evolution.endosymbiosis`,
`food.bacterium_aerobic`, `world.warm_vent`; concept, action, ability and HUD ids are snake_case slugs
(`basics.mass_decay`, `actions.sprint`, `abilities.photosynthesis`, `hud.leaderboard`). The id is the deep link,
the `data-entry-id` and the test-id suffix.

**Why these, from the legibility audit** (`qa/decisions/legibility/audit.md`): every row a player could not read in
play has a home here. Own size and size → speed: `basics.mass_and_size`. Food gain and DNA sources: the `food.*`
entries and `basics.dna_and_levels`. Mass decay: `basics.mass_decay`; vent decay: `world.warm_vent`. Sprint cost:
`actions.sprint`. Gel: `world.viscous_gel`. Shallows: `world.sunlit_shallows` and `abilities.photosynthesis`.
Food by zone: the `food.bacterium_*` entries name their zone. Bloom: `world.bloom`. Toxin and spines:
`abilities.toxin_drain`, `abilities.spines`. Who eats whom: `basics.engulf_ratio`. Engulf progress: `actions.engulf`,
`actions.escape`. Death cost: `basics.death_and_respawn`. DNA tags: `basics.dna_tags`. Stage gates and
endosymbiosis: the `evolution.*` entries. Trait effects: `traits.*`. Leaderboard columns: `hud.leaderboard`.

### 11.3 Layout (option A)

**Frame.** A kit modal panel centred on the viewport, `ENCYCLOPEDIA_INSET_PX` from every edge and at most
`ENCYCLOPEDIA_MAX_WIDTH_PX` × `ENCYCLOPEDIA_MAX_HEIGHT_PX`, every length × `--ui-scale`. Worked examples: at 1280 × 800
(scale 1) the panel is 1216 × 736 at (32, 32); at 1920 × 1080 (scale 1.35) it is 1834 × 994 at (43, 43), both sides
held by the inset (the width cap, 1836, is 2 px wider). Below the `HUD_SCALE_MIN` viewport (1024 × 640) the panel
keeps the inset and the detail column narrows; that is under the smallest viewport the game targets, so it is
recorded rather than solved, as layout.md §1 records the leaderboard's.

**Header** (`ENCYCLOPEDIA_HEADER_HEIGHT_PX`, a 1 px panel-rim rule under it, never scrolls), left to right: `Back`
(kit icon button, `‹`, disabled with an empty history), `Encyclopedia` (`title`), the kit search field
(`UI_SEARCH_WIDTH_PX`, `/` key hint), then right-aligned the alert strip (§11.1, in a round), the `ESC` key hint and
`Close` (kit icon button, `✕`).

**Body**: three columns, a 1 px panel-rim rule between them, each its own kit scroll area.

- **Rail** (`ENCYCLOPEDIA_RAIL_WIDTH_PX`, on the kit well): one kit rail item per category of §11.2, `UI_RAIL_ROW_HEIGHT_PX`
  tall: a 16 px category icon, the name (`body`), the entry count (`figure`, muted, right).
- **List** (`ENCYCLOPEDIA_LIST_WIDTH_PX`): the category name and count (`label`), then kit list rows
  (`UI_ROW_HEIGHT_PX`): a `UI_ROW_MEDALLION_PX` medallion (the trait glyph of `hud/trait-glyphs.ts`, or the entry's
  still preview frame, #355), the name (`body`), and in a round a level-gold `I` / `II` / `III` chip on owned traits.
  Section headers (`label`, muted) group a category that has groups: traits by `TRAIT_CATEGORY`, food by kind; the
  others are one flat list.
- **Detail** (the rest): the entry page (§11.4) when an entry is selected, else the category landing: the breadcrumb,
  the category name (`headline`), its one-line summary (`body`, label colour), a grid of entry tiles
  (`ENCYCLOPEDIA_TILE_WIDTH_PX` × `ENCYCLOPEDIA_TILE_HEIGHT_PX`, `UI_SPACE_M_PX` gaps: a `ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX`
  preview well with the entry's still frame, the name in `body` and its headline fact in `label` size, mixed case),
  and the category's own facts table when it has one (the food cap and the bloom multipliers on Food). A tile is a
  link to its entry.

### 11.4 The entry page

Top to bottom (`encyclopedia-a-trait-*.png`), with `UI_PANEL_PADDING_PX` around it:

1. **Breadcrumb**: `TRAITS › METABOLISM` (`label`, muted); every crumb but the last is a link.
2. **Name and chips** on one line, wrapping under the name when they do not fit: the name (`headline`), then kit chips:
   rarity (`COMMON` muted rim, `UNCOMMON` accent rim, `RARE` DNA rim: text as well as colour), each DNA tag with its
   `DNA_TAG_COLOR` dot, the entry's stage, and in a round `OWNED · I` in level gold.
3. **Preview stage**: the full detail width × `ENCYCLOPEDIA_PREVIEW_HEIGHT_PX`, `UI_RADIUS_PANEL_PX` corners, a
   panel-rim rim over the dish field; #355's seam draws the live, animated preview inside it. Overlaid kit controls:
   top-left the tier switch (traits only: a segmented `I` `II` `III`, default the owned tier in a round, else `I`),
   top-right one action button when the registry names a moment worth replaying (`Play sprint`, `Play engulf`),
   bottom-left a scale bar (`50 u`, from the preview's fixed zoom, so sizes compare across entries). Under
   `prefers-reduced-motion` the stage holds a still frame and the action button plays the moment once. No preview
   runs while the encyclopedia is closed.
4. **Facts**: two columns when the detail is at least `ENCYCLOPEDIA_FACTS_TWO_COLUMN_MIN_WIDTH_PX` wide, else one under
   the other, each a kit facts table with a `label` header. A trait's left table is **Effects by tier**: one row per
   non-identity modifier across the three tiers, named and formatted by the picker's label table (the row name is
   the label's noun, `Mass decay`; the values are `figure`, `−15 %`), the owned tier's column tinted accent with
   `You own I` in the header row. Its right table is **Unlock and ladder**: `Unlock` (the `unlockedBy` count and
   variant), `Offered from` (the trait's stage), `Climbs to` (the stage it gates, when it is a rung), `Requires`
   (when it has requirements), `DNA tag`. Other entries have one key–value table (`Mass` `+3`, `DNA` `+1`,
   `Found in` `Warm vent`). A value that names another entry is a link. A section with no rows is left out, never
   drawn empty.
5. **Prose**: `body`, at most `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX` wide, paragraphs `UI_SPACE_S_PX` apart; numbers in
   it are bound values (#355); a link run is accent text with an underline.
6. **See also**: a `label` header and kit link chips.

### 11.5 Navigation, search and cross-links

**State.** `encyclopedia/encyclopedia-state.service.ts` (root-provided, so the lobby and the room share one
session's reading position; it is not a HUD service): `location` (`{ categoryId, entryId | null }`), `query`,
`history` (a back stack capped at `ENCYCLOPEDIA_HISTORY_MAX`), and the last location, which is where the next open
starts. Every transition is a pure function in `encyclopedia/format/navigation.ts`.

- **Rail**: selecting a category shows its landing (`entryId: null`). **List** and **tiles**: selecting an entry
  shows its page. **Links** (prose, facts, chips, breadcrumbs, a menu trait row): go to the target, switching the
  category to the target's. Every move but Back pushes the location it left; Back pops. A move to the location
  already shown pushes nothing.
- **Search** is warranted: about 65 entries across nine categories, and a player usually arrives knowing a name they
  saw on a card or a label. `/` focuses the field (from anywhere in the encyclopedia except a text field). Typing
  filters every entry by name and registry aliases (#355), case- and accent-insensitive: name-prefix matches first,
  then other matches, each in rail and catalog order. While the query is non-empty the list column shows the
  results under category section headers, the rail shows no selection, and Enter opens the first result;
  `No match for "xyz"` (`body`, muted) when there is none. Escape in the field clears a non-empty query and stops
  there; in an empty field it falls through to close (§4).
- **Keyboard.** Tab order: header (Back, search, alert strip, Close), rail, list, detail (its controls and links in
  reading order). The rail and the list are one tab stop each with a roving focus: ↑ ↓ move, Home End jump, and
  **selection follows focus**, so arrowing down the list pages through entries (the preview starts
  `ENCYCLOPEDIA_PREVIEW_SETTLE_MS` after the selection stops moving). ← → move between the rail and the list.
  `Alt+←`, or Backspace outside a text field, is Back. The arrows are free here because the modal gate swallows
  steering (§4).
- **Escape**, in order: clears a non-empty search; otherwise closes the encyclopedia to where it was opened from
  (§11.1). It never goes back one entry: Back does that.

### 11.6 Test ids

Home `packages/client/src/app/encyclopedia/test-ids.ts` (`ENCYCLOPEDIA_TEST_ID` with builders, the pattern of
`HUD_TEST_ID`). `encyclopedia` (the panel, with `data-location="<categoryId>|<entryId>"`), `encyclopedia-back`,
`encyclopedia-close`, `encyclopedia-search`, `encyclopedia-no-results`, `encyclopedia-alert` (with
`data-alert-kind`), `encyclopedia-rail`, `encyclopedia-category-<categoryId>`, `encyclopedia-list`,
`encyclopedia-row-<entryId>`, `encyclopedia-tile-<entryId>`, `encyclopedia-entry` (with `data-entry-id`),
`encyclopedia-preview`, `encyclopedia-tier-<1|2|3>`, `encyclopedia-preview-action`, `encyclopedia-facts`,
`encyclopedia-link-<entryId>` (every link to that entry; a test takes the first), and in the lobby
`lobby-encyclopedia`.

### 11.7 Files and constants

Standalone, `OnPush`, signal inputs; the rules of components-and-constants.md §7 hold (no decision in a template,
every decision a pure function with a unit test).

| File (`packages/client/src/app/encyclopedia/`)                         | Role                                                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `encyclopedia.component.ts`                                            | The panel: header, the three columns, focus trap; hosted by the HUD shell in a room, by the lobby outside |
| `encyclopedia-rail.component.ts`, `encyclopedia-list.component.ts`     | The category rail and the entry list or search results, on the kit rail and list                          |
| `encyclopedia-landing.component.ts`, `encyclopedia-entry.component.ts` | The category landing and the entry page (§11.4); the entry page hosts #355's preview in its stage         |
| `encyclopedia-facts.component.ts`, `encyclopedia-prose.component.ts`   | The facts tables and the prose runs with their links, from the registry's view model                      |
| `encyclopedia-state.service.ts`                                        | §11.5's state                                                                                             |
| `format/navigation.ts`, `format/search.ts`, `format/entry-view.ts`     | Pure: the transitions, the filter and its order, the entry page's view model (rows, chips, crumbs)        |
| `encyclopedia-constants.ts`, `test-ids.ts`                             | The table below; §11.6                                                                                    |

| Constant                                     | Value | Unit | Meaning                                                                                         |
| -------------------------------------------- | ----- | ---- | ----------------------------------------------------------------------------------------------- |
| `ENCYCLOPEDIA_INSET_PX`                      | 32    | px   | The panel's distance from every viewport edge.                                                  |
| `ENCYCLOPEDIA_MAX_WIDTH_PX`                  | 1360  | px   | The panel's widest.                                                                             |
| `ENCYCLOPEDIA_MAX_HEIGHT_PX`                 | 880   | px   | The panel's tallest.                                                                            |
| `ENCYCLOPEDIA_HEADER_HEIGHT_PX`              | 56    | px   | The header row.                                                                                 |
| `ENCYCLOPEDIA_RAIL_WIDTH_PX`                 | 184   | px   | The category rail: the longest name, `Evolution`, with its icon and a two-digit count.          |
| `ENCYCLOPEDIA_LIST_WIDTH_PX`                 | 280   | px   | The entry list: `Photosynthetic bacterium` and `Cytoskeleton Lattice` fit with their medallion. |
| `ENCYCLOPEDIA_PREVIEW_HEIGHT_PX`             | 220   | px   | The preview stage; the page's first screen at 1280 × 800 ends with See also, unscrolled.        |
| `ENCYCLOPEDIA_FACTS_TWO_COLUMN_MIN_WIDTH_PX` | 640   | px   | The detail width from which the two facts tables sit side by side.                              |
| `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX`            | 640   | px   | The prose measure: about 90 characters of `body`.                                               |
| `ENCYCLOPEDIA_TILE_WIDTH_PX`                 | 168   | px   | A landing tile; four to a row at 1280 × 800.                                                    |
| `ENCYCLOPEDIA_TILE_HEIGHT_PX`                | 132   | px   | A landing tile.                                                                                 |
| `ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX`        | 96    | px   | The tile's preview well.                                                                        |
| `ENCYCLOPEDIA_SCRIM_ALPHA`                   | 0.8   | ×    | The callout-backing scrim behind the panel in a round.                                          |
| `ENCYCLOPEDIA_HISTORY_MAX`                   | 50    | —    | Back-stack depth; the oldest location drops first.                                              |
| `ENCYCLOPEDIA_PREVIEW_SETTLE_MS`             | 150   | ms   | Arrowing through the list starts the preview only once the selection rests this long.           |

`ENCYCLOPEDIA_KEY_CODE` (`KeyH`) and `ENCYCLOPEDIA_SEARCH_KEY_CODE` (`Slash`) live with the other key codes in
`input/input-constants.ts` (§4).

### 11.8 If B or C is picked (#DECISION)

- **B, eyepiece** (`encyclopedia-b-trait-1920x1080.png`): the rail, list, header and navigation stay. The stage
  becomes a round lens `ENCYCLOPEDIA_LENS_DIAMETER_PX` (300) wide with a reticle, top-left of the detail, the tier
  switch under it; the name, chips and both facts tables stack to its right; prose and See also run full width
  below. `ENCYCLOPEDIA_PREVIEW_HEIGHT_PX` and the two-column rule go.
- **C, codex** (`encyclopedia-c-trait-1920x1080.png`): the rail and the list go. A tab row (`ENCYCLOPEDIA_TABS_HEIGHT_PX`, 44) of the kit rail in its horizontal orientation sits under the header; the category landing grid is the list;
  an entry page opens with a full-width hero stage (300 tall) carrying the name and chips on a fade, `‹ previous`
  and `next ›` entry buttons in its top corners, and the facts, prose and See also in three columns under it. Search
  results show as a landing grid.
