# Evolution — UI: HUD, overlays and onboarding: the encyclopedia

§11 of the split [`UI.md`](../UI.md), which keeps the shared context and the file list.

## 11. Encyclopedia

Ticket #354, epic #353. This file owns what the player sees: the category and group labels and their order,
navigation, search, cross-links and the layouts. The content model is the architect's,
[`architecture/encyclopedia.md §12`](../architecture/encyclopedia.md#12-encyclopedia) (#355): the closed category,
subject and group sets, the entry ids, the `ResolvedEntry` each page renders (§12.2), the formatted values (§12.3,
§12.5), the prose segments (§12.6) and the `ENCYCLOPEDIA_PREVIEW` seam (§12.7). Where the two files meet, values,
ids and data shapes are §12's and everything on screen is this file's. Every piece is built from the UI kit
([`components-and-constants.md §10`](./components-and-constants.md#10-the-ui-kit-354)); the ESC menu that opens it is
[`overlays.md §3.5`](./overlays.md#35-menu-escape). Mockups: `qa/decisions/encyclopedia/`.

**The layout is pending decision #368** (A atlas, B eyepiece, C codex). This file specifies **A**, the
recommendation; §11.8 lists what changes if B or C is picked. The navigation model, the categories, the entry page's
content and the kit do not depend on the answer.

### 11.1 What it is, and where it opens

A reference for every thing in the game, in the player's words: what it is, what it does to you, the numbers, and
the real thing moving. Every number is a code value formatted by §12.5, never typed text, and every preview is the
game's own renderer, never a picture.

| Opened from                                   | Opens at                                                  | Escape / Close returns to          |
| --------------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| ESC menu → `Encyclopedia`, or `H` in the menu | the last location this session, else the `basics` landing | the menu, focus on `Encyclopedia`  |
| ESC menu → a `Your traits` row (§3.5)         | that trait's entry (`trait:<traitId>`)                    | the menu, focus on that row        |
| `H` in play (`ENCYCLOPEDIA_KEY_CODE`, §4)     | the last location this session, else the `basics` landing | the game, focus on the canvas host |
| The lobby header's `Encyclopedia` button (§2) | the last location this session, else the `basics` landing | the lobby, focus on the button     |

**The lobby opens it too.** Reading the rules before joining a round is the calm moment to do it, and the page
needs no room. Values come from `EncyclopediaContextService` (§12.2): outside a room its context is
`DEFAULT_BALANCE`, inside one the room's live balance, so a patched balance updates an open page. The page shows no
caption for which balance it reads.

**In a round the dish keeps running.** The encyclopedia is a modal overlay (`openOverlay = 'encyclopedia'`,
components-and-constants.md §7): a callout-backing scrim at `ENCYCLOPEDIA_SCRIM_ALPHA` over the whole viewport, the
kit focus trap, and the same input gate as the menu (§4): only `1` `2` `3` and Escape reach the game, the steer
target stays latched (the pointer over the panel does not steer), sprint and the Tab hold are swallowed. The HUD
chrome (the leaderboard and the round clock) hides while it is open, since the panel would cut it into slivers. The
panel covers most of the dish, so it carries the one fact that must not be missed, the **alert strip**:

| `data-alert-kind` | Shown while                                         | Text (from the HUD's own formatters, never a copy)                              | Tone           |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | -------------- |
| `engulfed`        | `ownCellIndicators.engulfed` is set (hud.md §3.1.2) | the escape label (`SPRINT TO ESCAPE`, `SEALED`)                                 | danger rim     |
| `threat`          | `threats` is non-empty                              | the threat label (`AMOEBOID CAN ENGULF YOU`)                                    | danger rim     |
| `offer`           | `ownProgress.offer !== null`                        | the picker title (`LEVEL 5 · CHOOSE A TRAIT`) and its timer (`6.5 s`, `figure`) | level gold rim |

One strip at a time, in that priority; it is a kit alert pill (`label` in `WHITE` with a changing number in
`figure`, a dot and a 1 px rim in the tone, on the callout backing) and a button: activating it closes every
overlay and returns focus to the canvas host. It is rendered by `hud/overlay-alert.component.ts` over the pure
`overlayAlertFor`; in a room the HUD shell **projects** it into the panel header's `[encyclopediaHeaderAlert]` slot,
and the lobby host projects nothing, so `game/encyclopedia/` never imports from `hud/` (§12.8). The menu renders the
same component (§3.5).

### 11.2 Categories, groups and ids

The categories are §12.2's closed `ENCYCLOPEDIA_CATEGORY`, the five of preffect's request plus `basics`. This file
writes their labels (`ENCYCLOPEDIA_CATEGORY_LABEL`) and order (`ENCYCLOPEDIA_CATEGORY_ORDER`), and the labels of the
list groups (`ENTRY_GROUP_LABEL`); the group each entry takes is `ResolvedEntry.group`, which the registry derives from
the subject. A count in the rail is `entriesIn(category)`'s length, never a typed number.

| Order | Category     | Label        | Groups (`ENTRY_GROUP`), in order                                                      | What a player finds there                                                                                                                                                                                                                                                                    |
| ----- | ------------ | ------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `basics`     | Basics       | Rules (`rules`) · Reading the screen (`reading_the_screen`)                           | Mass and size (bigger is slower), mass decay, who can engulf whom, DNA and levels, score, where you stand against the world; how to read each HUD element (`HUD_TOPIC`): the DNA ring, the level numeral, the ladder orbit, the self ring, the threat ring, the leaderboard, the round clock |
| 2     | `entities`   | Cells & food | Cells (`cells`) · Food (`food`)                                                       | The player cell and the wild cell; the food overview, algae, the bacteria and their variants, detritus, the DNA fragment                                                                                                                                                                     |
| 3     | `evolutions` | Evolution    | Stages (`stages`) · one per `TRAIT_CATEGORY` in catalog order · DNA tags (`dna_tags`) | The five ladder stages, every trait (its tiers are sections of its page, not entries), the DNA tags                                                                                                                                                                                          |
| 4     | `abilities`  | Abilities    | none                                                                                  | What traits grant, one page per `ABILITY` (§12.4): movement, sprint, photosynthesis, toxin, spines, food attraction and the rest, each listing the traits that grant it                                                                                                                      |
| 5     | `actions`    | Actions      | none                                                                                  | One page per `ACTION` (§12.4): steer, sprint, eat, engulf (its `ENGULF_PHASE`s cover, wrap, absorb), escape, pick a trait, level up, respawn                                                                                                                                                 |
| 6     | `world`      | World        | Dish and zones (`dish_and_zones`) · Time (`time`)                                     | The dish and its four zones; the world clock, the bloom, the round                                                                                                                                                                                                                           |

A list shows group headers only when its category has more than one group. The `hud` subject is a subject under
Basics, not a category: §12.2's `CATEGORY_BY_SUBJECT` sends it there, and `HUD_ELEMENT_BY_TOPIC` anchors each topic to a
`HUD_TEST_ID` key, which moves to the neutral `game/test-ids/hud-test-ids.ts` so the encyclopedia never imports `hud/`.

**Ids** are §12.2's `<subject>:<codeId>`, with `#` for a section inside a page: `trait:mitochondrion`,
`trait:mitochondrion#tier_2`, `stage:endosymbiosis`, `bacterium:aerobic`, `food:algae`, `entity:dna_fragment`,
`cell_kind:wild`, `zone:warm_vent`, `world:bloom`, `action:sprint`, `ability:toxin`, `concept:mass_decay`,
`concept:world_standing#ahead`, `hud:leaderboard`. The subject is the code kind, not the category, so regrouping never renames an id. The
id is the deep link, the `data-entry-id` and the test-id suffix (`testIdSelector` quotes the attribute, so `:` and `#`
are safe).

**Every row of the legibility audit** (`qa/decisions/legibility/audit.md`) has a home: own size and size → speed
`concept:mass_and_size`; food gain `concept:food` and the `food:` / `bacterium:` entries; DNA sources and levels
`concept:dna_and_levels` and `entity:dna_fragment`; mass decay `concept:mass_decay`; vent decay `zone:warm_vent`;
sprint cost `action:sprint`; gel `zone:viscous_gel`; shallows `zone:sunlit_shallows` and `ability:photosynthesis`;
food by zone the `bacterium:` entries; bloom `world:bloom`; toxin and spines `ability:toxin`, `ability:spines`; who
eats whom `concept:engulf_ratio`; engulf progress `action:engulf`, `action:escape`; death cost `action:respawn`; DNA
tags the `dna_tag:` entries; stage gates and endosymbiosis the `stage:` entries; trait effects the `trait:` entries;
score `concept:score`; the leaderboard's columns `hud:leaderboard`.

### 11.3 Layout (option A)

**Frame.** A kit modal panel centred on the viewport, `ENCYCLOPEDIA_INSET_PX` from every edge and at most
`ENCYCLOPEDIA_MAX_WIDTH_PX` × `ENCYCLOPEDIA_MAX_HEIGHT_PX`, every length × `--ui-scale`. Worked examples: at 1280 × 800
(scale 1) the panel is 1216 × 736 at (32, 32); at 1920 × 1080 (scale 1.35) it is 1834 × 994 at (43, 43), both sides
held by the inset (the width cap, 1836, is 2 px wider). Below the `HUD_SCALE_MIN` viewport (1024 × 640) the panel
keeps the inset and the detail column narrows; that is under the smallest viewport the game targets, so it is
recorded rather than solved, as layout.md §1 records the leaderboard's.

**Header** (`ENCYCLOPEDIA_HEADER_HEIGHT_PX`, a 1 px panel-rim rule under it, never scrolls), left to right: `Back`
(kit icon button, disabled while the history is empty), `Encyclopedia` (`title`), the kit search field
(`UI_SEARCH_WIDTH_PX`, `/` key hint), then right-aligned the projected alert strip (§11.1), the `ESC` key hint and
`Close` (kit icon button).

**Body**: three columns, a 1 px panel-rim rule between them, each its own kit scroll area.

- **Rail** (`ENCYCLOPEDIA_RAIL_WIDTH_PX`, on the kit well): one kit rail item per category of §11.2 that has
  entries, `UI_RAIL_ROW_HEIGHT_PX` tall: a 16 px category icon, the label (`body`), the entry count (`figure`).
- **List** (`ENCYCLOPEDIA_LIST_WIDTH_PX`): the label and count (`label`), then the category's groups, each a kit list
  section over kit list rows (`UI_ROW_HEIGHT_PX`). A row leads with a **glyph medallion** (`UI_ROW_MEDALLION_PX`): a
  trait's glyph from `game/glyphs/trait-glyphs.ts` (#312, `lod="list"`, still), otherwise the subject's code-drawn
  glyph from `game/glyphs/subject-glyphs.ts` (a small drawing of the cell, mote, rod, fragment or zone). Then the title
  (`body`, one line, ending in an ellipsis when it does not fit) and, in a round, a level-gold tier chip on owned
  traits.
- **Detail** (the rest): the entry page (§11.4) when an entry is selected, else the category landing: the breadcrumb,
  the label (`headline`), the category's one-line summary (`body`, label colour) and a grid of entry tiles
  (`ENCYCLOPEDIA_TILE_WIDTH_PX` × `ENCYCLOPEDIA_TILE_HEIGHT_PX`, `UI_SPACE_M_PX` gaps): a
  `ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX` well on the dish field with the glyph medallion at the picker's
  `PICKER_CARD_MEDALLION_PX`, the title in `body` and the entry's `facts[0].text` in `label` size, mixed case, each on
  one line ending in an ellipsis (the full title is the tile's accessible name). A tile is a link to its entry.

Still frames of the real render in rows and tiles are follow-up #378; build 1 draws glyph medallions only.

### 11.4 The entry page

Top to bottom (`encyclopedia-a-trait-*.png`), with `UI_PANEL_PADDING_PX` around it, inside a content column at most
`ENCYCLOPEDIA_PREVIEW_WIDTH_PX` wide. Each part names the `ResolvedEntry` field (§12.2) it reads:

1. **Breadcrumb** (`label`, muted): the category label, then the label of `group`; every crumb but the last is a link.
2. **Title and chips** on one line, wrapping under the title when they do not fit: `title` (`headline`), then kit
   chips sized to their text: from the trait summary on `subject` (rarity with its word, `COMMON` muted rim,
   `UNCOMMON` label rim, `RARE` DNA rim, never the accent; each DNA tag with its `DNA_TAG_COLOR` dot; the stage), and in
   a round `OWNED · II` in level gold, its numeral `formatQuantity(tier, QUANTITY_UNIT.tier)` in `numeral`
   presentation.
3. **Preview**, when `preview` is not `null`: a fixed box `ENCYCLOPEDIA_PREVIEW_WIDTH_PX` × `ENCYCLOPEDIA_PREVIEW_HEIGHT_PX`
   (16:5, × `--ui-scale`), `UI_RADIUS_PANEL_PX` corners and a panel-rim rim over the dish field.
   - **The handle.** `encyclopedia.component.ts` owns the one `PreviewHandle` of the open encyclopedia: it asks
     `ENCYCLOPEDIA_PREVIEW` for it on the first entry that has a preview, the entry page lends it the stage element,
     it calls `show(spec)` once the selection has rested `ENCYCLOPEDIA_PREVIEW_SETTLE_MS`, `pause()` while a landing or
     an entry without a preview is shown, `resize` when `--ui-scale` changes, and `destroy()` on close.
   - **States** (`encyclopedia-preview[data-preview-state]`): `loading` until the first frame (the dish field with one
     slow `UI_ACCENT` ring pulse and no text, static under reduced motion; §12.7 budgets 300 ms), `live`, `paused` (the
     last frame held), `unavailable` when the preview app cannot start (the dish field with
     `ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT` in `body`, muted, centred; no retry loop).
   - **Controls** over the box: top-left the tier switch for a trait, one segment per `tier_n` section (its numeral
     from `formatQuantity`, so the count follows the tier table), default the owned tier in a round, else the first;
     selecting one calls `show` with that section's `preview`, and a deep link to `#tier_n` selects it. Top-right, for
     the action scenes only (`eat`, `engulf`, `escape`, `sprint`, `level_up`), a `Replay` compact button that calls
     `show(spec)` again; its label per scene is `ENCYCLOPEDIA_PREVIEW_REPLAY_LABEL`. Under `prefers-reduced-motion`
     the page pauses after the first frame and that button becomes a play and pause toggle (`resume` / `pause`). No
     scale bar: the handle does not expose the preview's zoom.
4. **Facts**: two kit facts tables side by side in the content column (one under the other below
   `ENCYCLOPEDIA_FACTS_TWO_COLUMN_MIN_WIDTH_PX`), each under a `label` header.
   - A trait's left table, **Effects by tier**: the columns are the `tier_n` sections, the rows the union of the
     modifier keys their `facts` carry (`label` is the noun, `Mass decay`; `text` the value, `−15 %`, in `figure`),
     `—` where a tier leaves that key at identity; the owned tier's column is tinted accent under `You own II`.
   - The right table, **Unlock and ladder** for a trait, and the only table for other entries: `facts`, `label` on
     the left and `text` on the right; a fact whose `link` is set renders its text as a link to that entry.
   - A table with no rows is left out, never drawn empty.
5. **Prose**: `summary`'s segments (§12.6): `text` in `body`, `value` in `body` with tabular digits, `link` as accent
   text with an underline; at most `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX` wide, paragraphs `UI_SPACE_S_PX` apart,
   `text-wrap: pretty` so no line ends on a lone word.
6. **See also**: a `label` header and a kit link chip per `seeAlso` link, sized to its title.

**Long entries scroll** (`encyclopedia-a-long-trait-1280x800.png`, Diatom Shell: three effect rows and a `Requires`
fact). The detail column is one kit scroll area. The breadcrumb and the title-and-chips row are **sticky** at its top,
on the panel's top colour, with a 1 px panel-rim rule under them once the column has scrolled; the preview, the facts,
the prose and See also scroll under them, with the scroll area's fade below the rule. At 1280 × 800 an entry with two
effect rows and two prose lines fits unscrolled; anything longer scrolls.

### 11.5 Navigation, search and cross-links

**State.** `game/encyclopedia/encyclopedia-state.service.ts` (root-provided, so the lobby and the room share one
session's reading position; it is not a HUD service): `location` (`{ category, entryId | null }`), `query`, `history`
(a back stack capped at `ENCYCLOPEDIA_HISTORY_MAX`), and the last location, which is where the next open starts. Every
transition is a pure function in `game/encyclopedia/format/navigation.ts`.

- **Rail**: selecting a category shows its landing (`entryId: null`). **List** and **tiles**: selecting an entry
  shows its page. **Links** (prose, facts, chips, breadcrumbs, a menu trait row): go to the target, switching the
  category to the target entry's. An anchor (`#tier_2`, `#ahead`) opens the page with that section selected or
  scrolled into view. Every move but Back pushes the location it left; Back pops. A move to the location already
  shown pushes nothing.
- **Search** is warranted: about 75 entries across six categories, and a player usually arrives knowing a name they
  saw on a card or a label. `/` (`ENCYCLOPEDIA_SEARCH_KEY_CODE`) focuses the field from anywhere in the encyclopedia
  but a text field. Typing matches, case- and accent-insensitive, the resolved `title` first (title-prefix matches
  before other title matches) and then the `summary` text, each in rail and list order. While the query is non-empty
  the list column shows the results under category section headers, the rail shows no selection, and Enter opens the
  first result; `No match for "xyz"` (`body`, muted) when there is none.
- **Keyboard.** Tab order: header (Back, search, alert strip, Close), rail, list, detail (its controls and links in
  reading order). The rail and the list are one tab stop each with a roving focus: ↑ ↓ move, Home End jump, and
  **selection follows focus**, so arrowing down the list pages through entries. ← → move between the rail and the list.
  `ENCYCLOPEDIA_BACK_KEY_CODES` (`Alt+←`, and Backspace outside a text field) is Back. The arrows are free here because
  the modal gate swallows steering (§4).
- **Escape**, in order: the search field clears a non-empty query and consumes the press (`preventDefault`, §4);
  otherwise the encyclopedia closes to where it was opened from (§11.1). In a room that close is the HUD's topmost
  order; in the lobby the host closes it on its own Escape. It never goes back one entry: Back does that.

### 11.6 Test ids

Home `packages/client/src/app/game/encyclopedia/test-ids.ts`, a leaf file (`ENCYCLOPEDIA_TEST_ID` with builders, the
pattern of `HUD_TEST_ID`; `input/input-constants.ts` imports the panel id from it). `encyclopedia` (the panel, with
`data-location="<category>|<entryId>"`), `encyclopedia-back`, `encyclopedia-close`, `encyclopedia-search`,
`encyclopedia-no-results`, `encyclopedia-alert` (with `data-alert-kind`), `encyclopedia-rail`,
`encyclopedia-category-<category>`, `encyclopedia-list`, `encyclopedia-row-<entryId>`, `encyclopedia-tile-<entryId>`,
`encyclopedia-entry` (with `data-entry-id`), `encyclopedia-preview` (with `data-preview-state`),
`encyclopedia-tier-<n>` (one per tier section), `encyclopedia-preview-replay`, `encyclopedia-facts`,
`encyclopedia-link-<entryId>` (every link to that entry; a test takes the first), and in the lobby
`lobby-encyclopedia`.

### 11.7 Files and constants

Standalone, `OnPush`, signal inputs; the rules of components-and-constants.md §7 hold (no decision in a template,
every decision a pure function with a unit test). Component specs get a recording fake `ENCYCLOPEDIA_PREVIEW`. The
components sit at the root of `packages/client/src/app/game/encyclopedia/`, beside §12.8's `model/`, `facts/` and
`content/`.

| File (`game/encyclopedia/`)                                            | Role                                                                                                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encyclopedia.component.ts`                                            | The panel: header with its alert slot, the three columns, focus trap, the one `PreviewHandle`; hosted by the HUD shell in a room and by the lobby outside |
| `encyclopedia-rail.component.ts`, `encyclopedia-list.component.ts`     | The category rail and the grouped entry list or search results, on the kit rail and list                                                                  |
| `encyclopedia-landing.component.ts`, `encyclopedia-entry.component.ts` | The category landing and the entry page (§11.4); the entry page lends its stage element to the handle                                                     |
| `encyclopedia-facts.component.ts`, `encyclopedia-prose.component.ts`   | The facts tables and the prose segments with their links                                                                                                  |
| `encyclopedia-state.service.ts`                                        | §11.5's state                                                                                                                                             |
| `format/navigation.ts`, `format/search.ts`, `format/entry-view.ts`     | Pure: the transitions, the match and its order, the page's view model (tier columns, chips, crumbs)                                                       |
| `encyclopedia-constants.ts`, `test-ids.ts`                             | The table below, the labels of §11.2 and the key codes; §11.6                                                                                             |

| Constant                                     | Value                        | Unit | Meaning                                                                                           |
| -------------------------------------------- | ---------------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| `ENCYCLOPEDIA_INSET_PX`                      | 32                           | px   | The panel's distance from every viewport edge.                                                    |
| `ENCYCLOPEDIA_MAX_WIDTH_PX`                  | 1360                         | px   | The panel's widest.                                                                               |
| `ENCYCLOPEDIA_MAX_HEIGHT_PX`                 | 880                          | px   | The panel's tallest.                                                                              |
| `ENCYCLOPEDIA_HEADER_HEIGHT_PX`              | 56                           | px   | The header row.                                                                                   |
| `ENCYCLOPEDIA_RAIL_WIDTH_PX`                 | 184                          | px   | The category rail: the longest label, `Cells & food`, with its icon and a two-digit count.        |
| `ENCYCLOPEDIA_LIST_WIDTH_PX`                 | 280                          | px   | The entry list: `Photosynthetic bacterium` and `Cytoskeleton Lattice` fit beside their medallion. |
| `ENCYCLOPEDIA_PREVIEW_WIDTH_PX`              | 704                          | px   | The preview box and the entry page's content column: the full detail width at 1280 × 800.         |
| `ENCYCLOPEDIA_PREVIEW_HEIGHT_PX`             | 220                          | px   | The preview box (16:5).                                                                           |
| `ENCYCLOPEDIA_FACTS_TWO_COLUMN_MIN_WIDTH_PX` | 640                          | px   | The content width from which the two facts tables sit side by side.                               |
| `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX`            | 640                          | px   | The prose measure: about 90 characters of `body`.                                                 |
| `ENCYCLOPEDIA_TILE_WIDTH_PX`                 | 168                          | px   | A landing tile; four to a row at 1280 × 800.                                                      |
| `ENCYCLOPEDIA_TILE_HEIGHT_PX`                | 132                          | px   | A landing tile.                                                                                   |
| `ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX`        | 96                           | px   | The tile's well.                                                                                  |
| `ENCYCLOPEDIA_SCRIM_ALPHA`                   | 0.8                          | ×    | The callout-backing scrim behind the panel in a round.                                            |
| `ENCYCLOPEDIA_HISTORY_MAX`                   | 50                           | —    | Back-stack depth; the oldest location drops first.                                                |
| `ENCYCLOPEDIA_PREVIEW_SETTLE_MS`             | 150                          | ms   | Arrowing through the list calls `show` only once the selection rests this long.                   |
| `ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT`      | `Preview unavailable`        | —    | The `unavailable` state's line.                                                                   |
| `ENCYCLOPEDIA_PREVIEW_REPLAY_LABEL`          | `Replay`                     | —    | The replay button's label, a record keyed by the action scenes (one value in build 1).            |
| `ENCYCLOPEDIA_SEARCH_KEY_CODE`               | `Slash`                      | —    | Focuses the search field.                                                                         |
| `ENCYCLOPEDIA_BACK_KEY_CODES`                | `Alt+ArrowLeft`, `Backspace` | —    | Back (Backspace only outside a text field).                                                       |

`ENCYCLOPEDIA_KEY_CODE` (`KeyH`) lives with the in-room key codes in `input/input-constants.ts` (§4), since only the
room's input layer reads it.

### 11.8 If B or C is picked (#368)

- **B, eyepiece** (`encyclopedia-b-trait-*.png`): the rail, list, header and navigation stay. The preview box becomes a
  round lens `ENCYCLOPEDIA_LENS_DIAMETER_PX` (300) wide with a reticle, top-left of the detail, the tier switch under
  it; the title, chips and both facts tables stack to its right; prose and See also run full width below. The 16:5 box
  constants and the two-column rule go.
- **C, codex** (`encyclopedia-c-trait-*.png`): the rail and the list go. A tab row (`ENCYCLOPEDIA_TABS_HEIGHT_PX`, 44)
  of the kit rail in its horizontal orientation, each tab sized to its label, sits under the header; the category
  landing grid is the list; an entry page opens with a full-width hero box (300 tall) carrying the title and chips on
  a fade, `‹ previous` and `next ›` compact buttons in its top corners, and the facts, prose and See also in three
  columns under it. Search results show as a landing grid.
