# Evolution — UI: HUD, overlays and onboarding: the encyclopedia

§11 of the split [`UI.md`](../UI.md), which keeps the shared context and the file list.

## 11. Encyclopedia

Ticket #354, epic #353. This file owns what the player sees: the rail names and their order, the list groups,
navigation, search, cross-links and the layouts. The content model is the architect's,
[`architecture/encyclopedia.md §12`](../architecture/encyclopedia.md#12-encyclopedia) (#355): the closed category and
subject sets, the entry ids, the `ResolvedEntry` each page renders (§12.2), the formatted values (§12.3, §12.5), the
prose segments (§12.6) and the `ENCYCLOPEDIA_PREVIEW` seam (§12.7). Where the two files meet, ids and data shapes are
§12's and everything on screen is this file's. Every piece is built from the UI kit
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
| ESC menu → `Encyclopedia` (§3.5)              | the last location this session, else the `basics` landing | the menu, focus on `Encyclopedia`  |
| ESC menu → a `Your traits` row (§3.5)         | that trait's entry (`trait:<traitId>`)                    | the menu, focus on that row        |
| `H` in play (`ENCYCLOPEDIA_KEY_CODE`, §4)     | the last location this session, else the `basics` landing | the game, focus on the canvas host |
| The lobby header's `Encyclopedia` button (§2) | the last location this session, else the `basics` landing | the lobby, focus on the button     |

**The lobby opens it too.** Reading the rules before joining a round is the calm moment to do it, and the page
needs no room: outside a room the values are `DEFAULT_BALANCE`'s and the preview runs on the seam alone. Inside a
room the values follow the room's live balance (§12.3), so a patched balance updates an open page; the page shows no
caption for which balance it reads.

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

One strip at a time, in that priority; it is a kit alert pill (`label` role, `WHITE` text, a dot and a 1 px rim in
the tone, on the callout backing) and a button: activating it closes every overlay and returns focus to the canvas
host. The menu shows the same strip (§3.5), rendered by one component (`hud/overlay-alert.component.ts`) over the
pure `overlayAlertFor`. Outside a round there is no strip.

### 11.2 Categories, groups and ids

The categories are §12.2's closed `ENCYCLOPEDIA_CATEGORY` (the five of preffect's request, plus `basics`), in the
order `ENCYCLOPEDIA_CATEGORY_ORDER` fixes from this table. The rail name and the list groups are this file's; a count
in the rail is the category's entry count, never a typed number.

| Order | Category     | Rail name    | List groups, in order                                               | What a player finds there                                                                                                                                                                |
| ----- | ------------ | ------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `basics`     | Basics       | Rules · Reading the screen                                          | Mass and size (bigger is slower), mass decay, who can engulf whom, DNA and levels, score; the DNA ring, level numeral, ladder orbit, self ring, threat ring, leaderboard and round clock |
| 2     | `entities`   | Cells & food | Cells · Food                                                        | The player cell and the wild cell; algae, the three bacterium variants, detritus, the DNA fragment                                                                                       |
| 3     | `evolutions` | Evolution    | Stages · one group per `TRAIT_CATEGORY` in catalog order · DNA tags | The five ladder stages, every trait (its tiers are sections of its page, not entries), the seven DNA tags                                                                                |
| 4     | `abilities`  | Abilities    | none                                                                | The mechanics traits grant (photosynthesis, toxin, spines, food attraction, grip, spit-out, digestion, DNA gain, speed, sprint, gel resistance), each listing the traits that grant it   |
| 5     | `actions`    | Actions      | none                                                                | Steer, sprint, eat, engulf (cover, wrap, seal), escape, pick a trait, level up, respawn                                                                                                  |
| 6     | `world`      | World        | Dish and zones · Time                                               | The dish and its four zones; the world clock and world level, the bloom, the round                                                                                                       |

**Ids** are §12.2's `<subject>:<codeId>`, with `#` for a section inside a page: `trait:mitochondrion`,
`trait:mitochondrion#tier_2`, `stage:endosymbiosis`, `bacterium:aerobic`, `food:algae`, `entity:dna_fragment`,
`zone:warm_vent`, `action:sprint`, `ability:photosynthesis`, `concept:mass_decay`, `hud:leaderboard`. The subject is
the code kind, not the category, so regrouping never renames an id. The id is the deep link, the `data-entry-id` and
the test-id suffix (quoted in selectors: `[data-testid="encyclopedia-row-trait:mitochondrion"]`).

**`basics` is this file's addition to the five**, for the rows the legibility audit (`qa/decisions/legibility/audit.md`)
found unreadable in play that no thing-entry explains, and for reading the HUD itself: subjects `concept`
(`mass_and_size`, `mass_decay`, `engulf_ratio`, `dna_and_levels`, `score`) and `hud` (`dna_ring`, `level_numeral`,
`ladder_orbit`, `self_ring`, `threat_ring`, `leaderboard`, `round_clock`). Every audit row has a home: own size and
size → speed `concept:mass_and_size`; food gain and DNA sources the `food:` / `bacterium:` / `entity:` entries and
`concept:dna_and_levels`; mass decay `concept:mass_decay`; vent decay `zone:warm_vent`; sprint cost `action:sprint`;
gel `zone:viscous_gel`; shallows `zone:sunlit_shallows` and `ability:photosynthesis`; food by zone the `bacterium:`
entries; bloom `world:bloom`; toxin and spines `ability:toxin`, `ability:spines`; who eats whom `concept:engulf_ratio`;
engulf progress `action:engulf`, `action:escape`; death cost `action:respawn`; DNA tags the `dna_tag:` entries; stage
gates and endosymbiosis the `stage:` entries; trait effects the `trait:` entries; the leaderboard columns
`hud:leaderboard`.

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

- **Rail** (`ENCYCLOPEDIA_RAIL_WIDTH_PX`, on the kit well): one kit rail item per category of §11.2,
  `UI_RAIL_ROW_HEIGHT_PX` tall: a 16 px category icon, the rail name (`body`), the entry count (`figure`, muted, right).
- **List** (`ENCYCLOPEDIA_LIST_WIDTH_PX`): the rail name and count (`label`), then the category's groups of §11.2,
  each a kit list section (`label`, muted) over kit list rows (`UI_ROW_HEIGHT_PX`). A row leads with its **mark**,
  `UI_ROW_MEDALLION_PX` wide: a trait's glyph (#312, `<app-trait-glyph [traitId] lod="list" still>` at
  `TRAIT_GLYPH_LIST_PX`, which draws its own disc and rim), otherwise the entry's still frame (below), then the title
  (`body`), and in a round a level-gold `I` / `II` / `III` chip on owned traits.
- **Detail** (the rest): the entry page (§11.4) when an entry is selected, else the category landing: the breadcrumb,
  the rail name (`headline`), the category's one-line summary (`body`, label colour), a grid of entry tiles
  (`ENCYCLOPEDIA_TILE_WIDTH_PX` × `ENCYCLOPEDIA_TILE_HEIGHT_PX`, `UI_SPACE_M_PX` gaps: a
  `ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX` well with the entry's still frame, the title in `body` and its first fact in
  `label` size, mixed case), and the category's own facts when it has any (the food cap and the bloom multipliers on
  Cells & food). A tile is a link to its entry.

**Still frames.** A row mark and a tile well show a still image of the entry drawn by the same preview seam, requested
lazily for what is on screen and cached for the session (the still-capture call is being settled on #355). Until it
exists, and for an entry whose preview is `null`, the well shows the entry's subject icon (the 16 px line icon set of
the rail, one per subject) centred on the dish field.

### 11.4 The entry page

Top to bottom (`encyclopedia-a-trait-*.png`), with `UI_PANEL_PADDING_PX` around it; every field is the
`ResolvedEntry`'s (§12.2):

1. **Breadcrumb**: the rail name, then the list group (`EVOLUTION › METABOLISM`; `label`, muted); every crumb but the
   last is a link.
2. **Title and chips** on one line, wrapping under the title when they do not fit: the title (`headline`), then kit
   chips: rarity (`COMMON` muted rim, `UNCOMMON` accent rim, `RARE` DNA rim: the word as well as the colour), each DNA
   tag with its `DNA_TAG_COLOR` dot, the entry's stage, and in a round `OWNED · I` in level gold.
3. **Preview stage**, when the entry's `preview` is not `null`: a fixed box `ENCYCLOPEDIA_PREVIEW_WIDTH_PX` ×
   `ENCYCLOPEDIA_PREVIEW_HEIGHT_PX` (16:5, × `--ui-scale`, so the canvas resizes only with the scale), left-aligned in
   the detail, `UI_RADIUS_PANEL_PX` corners and a panel-rim rim over the dish field. It hosts the one preview canvas of
   the open encyclopedia through the `ENCYCLOPEDIA_PREVIEW` token (§12.7: `show(spec)` on each entry, `destroy()` on
   close). **Loading:** until the first frame (§12.7 budgets 300 ms for the first open) the box shows the dish field
   with one slow `UI_ACCENT` ring pulse and no text, static under reduced motion. Overlaid kit controls: top-left the
   tier switch (traits only: a segmented `I` `II` `III`; default the owned tier in a round, else `I`; a deep link to
   `#tier_n` selects tier n), top-right one action button when the spec names a moment worth replaying
   (`Play sprint`, `Play engulf`), bottom-left a scale bar (`50 u`, from the preview's fixed zoom, so sizes compare
   across entries). Under `prefers-reduced-motion` the page calls `pause()` after the first frame and the action
   button `resume()`s for one loop.
4. **Facts**: two columns when the detail is at least `ENCYCLOPEDIA_FACTS_TWO_COLUMN_MIN_WIDTH_PX` wide, else one under
   the other, each a kit facts table with a `label` header, filled from the entry's `facts` and `sections`, whose
   labels, value text and units arrive formatted. A trait's left table is **Effects by tier**: its tier sections as
   columns, one row per effect, the owned tier's column tinted accent with `You own I` in the header row. Its right
   table is **Unlock and ladder** (`Unlock`, `Offered from`, `Climbs to`, `Requires`, `DNA tag`). Other entries have one
   key–value table (`Mass` `+3`, `DNA` `+1`, `Found in` `Warm vent`). A value that names another entry is a link. A
   table with no rows is left out, never drawn empty.
5. **Prose**: the summary's segments (§12.6): text in `body`, a value in `body` with tabular digits, a link as accent
   text with an underline; at most `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX` wide, paragraphs `UI_SPACE_S_PX` apart.
6. **See also**: a `label` header and a kit link chip per `seeAlso` id, titled by its entry.

### 11.5 Navigation, search and cross-links

**State.** `encyclopedia/encyclopedia-state.service.ts` (root-provided, so the lobby and the room share one
session's reading position; it is not a HUD service): `location` (`{ category, entryId | null }`), `query`, `history`
(a back stack capped at `ENCYCLOPEDIA_HISTORY_MAX`), and the last location, which is where the next open starts. Every
transition is a pure function in `encyclopedia/format/navigation.ts`.

- **Rail**: selecting a category shows its landing (`entryId: null`). **List** and **tiles**: selecting an entry
  shows its page. **Links** (prose, facts, chips, breadcrumbs, a menu trait row): go to the target, switching the
  category to the target entry's. An id with a `#section` opens the page with that section selected (a tier) or
  scrolled into view. Every move but Back pushes the location it left; Back pops. A move to the location already
  shown pushes nothing.
- **Search** is warranted: about 75 entries across six categories, and a player usually arrives knowing a name they
  saw on a card or a label. `/` focuses the field (from anywhere in the encyclopedia except a text field). Typing
  filters every entry by title and aliases (§12.2), case- and accent-insensitive: title-prefix matches first, then
  other matches, each in rail and list order. While the query is non-empty the list column shows the results under
  category section headers, the rail shows no selection, and Enter opens the first result; `No match for "xyz"`
  (`body`, muted) when there is none. Escape in the field clears a non-empty query and stops there; in an empty field
  it falls through to close (§4).
- **Keyboard.** Tab order: header (Back, search, alert strip, Close), rail, list, detail (its controls and links in
  reading order). The rail and the list are one tab stop each with a roving focus: ↑ ↓ move, Home End jump, and
  **selection follows focus**, so arrowing down the list pages through entries (the preview `show`s
  `ENCYCLOPEDIA_PREVIEW_SETTLE_MS` after the selection stops moving). ← → move between the rail and the list.
  `Alt+←`, or Backspace outside a text field, is Back. The arrows are free here because the modal gate swallows
  steering (§4).
- **Escape**, in order: clears a non-empty search; otherwise closes the encyclopedia to where it was opened from
  (§11.1). It never goes back one entry: Back does that.

### 11.6 Test ids

Home `packages/client/src/app/encyclopedia/test-ids.ts` (`ENCYCLOPEDIA_TEST_ID` with builders, the pattern of
`HUD_TEST_ID`). `encyclopedia` (the panel, with `data-location="<category>|<entryId>"`), `encyclopedia-back`,
`encyclopedia-close`, `encyclopedia-search`, `encyclopedia-no-results`, `encyclopedia-alert` (with
`data-alert-kind`), `encyclopedia-rail`, `encyclopedia-category-<category>`, `encyclopedia-list`,
`encyclopedia-row-<entryId>`, `encyclopedia-tile-<entryId>`, `encyclopedia-entry` (with `data-entry-id`),
`encyclopedia-preview` (with `data-preview-state="loading|playing|paused"`), `encyclopedia-tier-<1|2|3>`,
`encyclopedia-preview-action`, `encyclopedia-facts`, `encyclopedia-link-<entryId>` (every link to that entry; a test
takes the first), and in the lobby `lobby-encyclopedia`.

### 11.7 Files and constants

Standalone, `OnPush`, signal inputs; the rules of components-and-constants.md §7 hold (no decision in a template,
every decision a pure function with a unit test). Component specs get a fake `ENCYCLOPEDIA_PREVIEW`.

| File (`packages/client/src/app/encyclopedia/`)                         | Role                                                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `encyclopedia.component.ts`                                            | The panel: header, the three columns, focus trap; hosted by the HUD shell in a room, by the lobby outside |
| `encyclopedia-rail.component.ts`, `encyclopedia-list.component.ts`     | The category rail and the grouped entry list or search results, on the kit rail and list                  |
| `encyclopedia-landing.component.ts`, `encyclopedia-entry.component.ts` | The category landing and the entry page (§11.4); the entry page hosts the preview canvas in its stage     |
| `encyclopedia-facts.component.ts`, `encyclopedia-prose.component.ts`   | The facts tables and the prose segments with their links                                                  |
| `encyclopedia-state.service.ts`                                        | §11.5's state                                                                                             |
| `format/navigation.ts`, `format/search.ts`, `format/entry-view.ts`     | Pure: the transitions, the filter and its order, the page's view model (tables, chips, crumbs, groups)    |
| `encyclopedia-constants.ts`, `test-ids.ts`                             | The table below, the rail names and group titles; §11.6                                                   |

| Constant                                     | Value | Unit | Meaning                                                                                      |
| -------------------------------------------- | ----- | ---- | -------------------------------------------------------------------------------------------- |
| `ENCYCLOPEDIA_INSET_PX`                      | 32    | px   | The panel's distance from every viewport edge.                                               |
| `ENCYCLOPEDIA_MAX_WIDTH_PX`                  | 1360  | px   | The panel's widest.                                                                          |
| `ENCYCLOPEDIA_MAX_HEIGHT_PX`                 | 880   | px   | The panel's tallest.                                                                         |
| `ENCYCLOPEDIA_HEADER_HEIGHT_PX`              | 56    | px   | The header row.                                                                              |
| `ENCYCLOPEDIA_RAIL_WIDTH_PX`                 | 184   | px   | The category rail: the longest name, `Cells & food`, with its icon and a two-digit count.    |
| `ENCYCLOPEDIA_LIST_WIDTH_PX`                 | 280   | px   | The entry list: `Photosynthetic bacterium` and `Cytoskeleton Lattice` fit beside their mark. |
| `ENCYCLOPEDIA_PREVIEW_WIDTH_PX`              | 704   | px   | The preview box: the full detail width at 1280 × 800.                                        |
| `ENCYCLOPEDIA_PREVIEW_HEIGHT_PX`             | 220   | px   | The preview box; the page's first screen at 1280 × 800 ends with See also, unscrolled.       |
| `ENCYCLOPEDIA_FACTS_TWO_COLUMN_MIN_WIDTH_PX` | 640   | px   | The detail width from which the two facts tables sit side by side.                           |
| `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX`            | 640   | px   | The prose measure: about 90 characters of `body`.                                            |
| `ENCYCLOPEDIA_TILE_WIDTH_PX`                 | 168   | px   | A landing tile; four to a row at 1280 × 800.                                                 |
| `ENCYCLOPEDIA_TILE_HEIGHT_PX`                | 132   | px   | A landing tile.                                                                              |
| `ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX`        | 96    | px   | The tile's still-frame well.                                                                 |
| `ENCYCLOPEDIA_SCRIM_ALPHA`                   | 0.8   | ×    | The callout-backing scrim behind the panel in a round.                                       |
| `ENCYCLOPEDIA_HISTORY_MAX`                   | 50    | —    | Back-stack depth; the oldest location drops first.                                           |
| `ENCYCLOPEDIA_PREVIEW_SETTLE_MS`             | 150   | ms   | Arrowing through the list `show`s the preview only once the selection rests this long.       |

`ENCYCLOPEDIA_KEY_CODE` (`KeyH`) and `ENCYCLOPEDIA_SEARCH_KEY_CODE` (`Slash`) live with the other key codes in
`input/input-constants.ts` (§4).

### 11.8 If B or C is picked (#368)

- **B, eyepiece** (`encyclopedia-b-trait-1920x1080.png`): the rail, list, header and navigation stay. The preview box
  becomes a round lens `ENCYCLOPEDIA_LENS_DIAMETER_PX` (300) wide with a reticle, top-left of the detail, the tier
  switch under it; the title, chips and both facts tables stack to its right; prose and See also run full width
  below. The 16:5 box constants and the two-column rule go.
- **C, codex** (`encyclopedia-c-trait-1920x1080.png`): the rail and the list go. A tab row
  (`ENCYCLOPEDIA_TABS_HEIGHT_PX`, 44) of the kit rail in its horizontal orientation sits under the header; the
  category landing grid is the list; an entry page opens with a full-width hero box (300 tall) carrying the title and
  chips on a fade, `‹ previous` and `next ›` entry buttons in its top corners, and the facts, prose and See also in
  three columns under it. Search results show as a landing grid.
