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

**The layout is option B, the eyepiece** (decision #368): the rail and the list, and on the entry page a round live
preview lens beside the title and the facts. The reference frames are `qa/decisions/encyclopedia/encyclopedia-b-*.png`;
the category landing (`encyclopedia-a-category-*.png`) is the same under every option. §11.8 records what was not
chosen.

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

**How each return is actually produced** (#449), since "focus on the canvas host" is not something a focus trap does
by itself. The kit trap restores whatever had focus when the panel opened, which is right for the lobby (its button)
and for the two menu rows (the menu remounts and focuses the control named in `menuReturnFocusTestId`). It is **wrong
for `H` in play**: on the first `H` of a round nothing has focus, because the Start button unmounted when the room
began, so the trap would restore nothing and the reader would lose the cursor entirely. The room's host therefore
passes the canvas host as the panel's `restoreFocusTo` for a close **to the game**, and `null` for a close to the
menu. The table's third row is unconditional, so the code has to be too.

**Where "the `basics` landing" actually lands, and what U8 asserts.** §11.5 forbids showing a category with no entry,
and `basics` holds none until #361 fills it, so an open with no last location falls to the first category the rail
lists — `defaultLocation`, which returns `basics` the moment that category has entries. Acceptance **U8**
(components-and-constants.md §8) therefore asserts **the first rail row is selected**, not `encyclopedia-category-basics`
by name: the row it names today would be wrong, and naming `basics` would pin the content rather than the rule. Once
#361 lands, the first rail row _is_ `basics` and U8 reads the same either way. Amended by #448 (part 2 of #372);
#361 removes nothing here.

**The lobby opens it too.** Reading the rules before joining a round is the calm moment to do it, and the page
needs no room. Values come from `EncyclopediaContextService` (§12.2): outside a room its context is
`DEFAULT_BALANCE`, inside one the room's live balance, so a patched balance updates an open page. The page shows no
caption for which balance it reads.

**In a round the dish keeps running.** The encyclopedia is a modal overlay (`openOverlay = 'encyclopedia'`,
components-and-constants.md §7): a callout-backing scrim at `ENCYCLOPEDIA_SCRIM_ALPHA` over the whole viewport, the
kit focus trap, and the same input gate as the menu (§4): only `1` `2` `3` and Escape reach the game, the steer
target stays latched (the pointer over the panel does not steer), sprint and the Tab hold are swallowed. The HUD
chrome (the leaderboard and the round clock) hides while it is open, since the panel would cut it into slivers. The encyclopedia is exempt from input-and-onboarding.md §6's overlay coverage bar: it is a reading screen the player opens on purpose, and the alert strip carries what must not be missed. The
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
the subject. A count in the rail is `entriesIn(category)`'s length, never a typed number. The one line under a landing's
heading is `ENCYCLOPEDIA_CATEGORY_SUMMARY`, beside the labels: the "what a player finds there" column below, in the
player's words and in no more than a line.

| Order | Category     | Label        | Groups (`ENTRY_GROUP`), in order                                                      | What a player finds there                                                                                                                                                                                                                                                                    |
| ----- | ------------ | ------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `basics`     | Basics       | Rules (`rules`) · Reading the screen (`reading_the_screen`)                           | Mass and size (bigger is slower), mass decay, who can engulf whom, DNA and levels, score, where you stand against the world; how to read each HUD element (`HUD_TOPIC`): the DNA ring, the level numeral, the ladder orbit, the self ring, the threat ring, the leaderboard, the round clock |
| 2     | `entities`   | Cells & food | Cells (`cells`) · Food (`food`)                                                       | The player cell and the wild cell; the food overview, algae, the bacteria and their variants, detritus, the DNA fragment                                                                                                                                                                     |
| 3     | `evolutions` | Evolution    | Stages (`stages`) · one per `TRAIT_CATEGORY` in catalog order · DNA tags (`dna_tags`) | The five ladder stages, every trait (its tiers are sections of its page, not entries), the DNA tags                                                                                                                                                                                          |
| 4     | `abilities`  | Abilities    | none                                                                                  | What traits grant, one page per `ABILITY` (§12.4): movement, sprint, photosynthesis, toxin, spines, food attraction and the rest, each listing the traits that grant it                                                                                                                      |
| 5     | `actions`    | Actions      | none                                                                                  | One page per `ACTION` (§12.4): steer, sprint, eat, engulf (its `ENGULF_PHASE`s cover, wrap, absorb), escape, pick a trait, level up, respawn                                                                                                                                                 |
| 6     | `world`      | World        | Dish and zones (`dish_and_zones`) · Time (`time`)                                     | The dish and its four zones; the world clock, the bloom, the round                                                                                                                                                                                                                           |

A list shows group headers only when its category has more than one group. The `hud` subject is a subject under
Basics, not a category: §12.2's `CATEGORY_BY_SUBJECT` sends it there, and `HUD_ELEMENT_BY_TOPIC` (§12.4) anchors each topic to the element it explains, a `HUD_TEST_ID` key or an `OwnCellIndicators` field (§12.4, #361); `HUD_TEST_ID` moves to the neutral
`game/test-ids/hud-test-ids.ts`, so the encyclopedia never imports `hud/`.

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

### 11.3 Layout

**Frame.** A kit modal panel centred on the viewport, `ENCYCLOPEDIA_INSET_PX` from every edge and at most
`ENCYCLOPEDIA_MAX_WIDTH_PX` × `ENCYCLOPEDIA_MAX_HEIGHT_PX`, every length × `--ui-scale`. Worked examples: at 1280 × 800
(scale 1) the panel is 1216 × 736 at (32, 32); at 1920 × 1080 (scale 1.35) it is 1834 × 994 at (43, 43), both sides
held by the inset (the width cap, 1836, is 2 px wider). Below the `UI_SCALE_MIN` viewport (1024 × 640) the panel
keeps the inset and the detail column narrows; that is under the smallest viewport the game targets, so it is
recorded rather than solved, as layout.md §1 records the leaderboard's.

**Header** (`ENCYCLOPEDIA_HEADER_HEIGHT_PX`, a 1 px panel-rim rule under it, never scrolls), left to right: `Back`
(kit icon button, disabled while the history is empty), `Encyclopedia` (`title`), the kit search field
(`UI_SEARCH_WIDTH_PX`, `/` key hint), then right-aligned the projected alert strip (§11.1), the `ESC` key hint and
`Close` (kit icon button).

**Body**: three columns, a 1 px panel-rim rule between them, each its own kit scroll area.

- **Rail** (`ENCYCLOPEDIA_RAIL_WIDTH_PX`, on the kit well): one kit rail item per category of §11.2 that has
  entries, `UI_RAIL_ROW_HEIGHT_PX` tall: a 16 px category icon, the label (`body`), the entry count (`figure`).
- **List** (`ENCYCLOPEDIA_LIST_WIDTH_PX`): the label and count (`label`) — the category and `entriesIn`'s length, or
  `ENCYCLOPEDIA_RESULTS_LABEL` and the number of matches while a query runs — then the category's groups, each a kit list
  section over kit list rows (`UI_ROW_HEIGHT_PX`). A row leads with a **glyph medallion**, `UI_ROW_MEDALLION_PX` square: a trait's glyph (`<app-trait-glyph [traitId] lod="list" still>`, #312), otherwise the subject's code-drawn
  glyph (`<app-subject-glyph [entryId] lod="list" still>`, #391: a small drawing of the cell, mote, rod, fragment,
  zone or topic, visual-style/ui-type.md §7.2). Then the title
  (`body`, one line, ending in an ellipsis when it does not fit) and, in a round, a level-gold tier chip on owned
  traits.
- **Detail** (the rest): the entry page (§11.4) when an entry is selected, else the category landing: the breadcrumb,
  the label (`headline`), the category's one-line summary (`body`, label colour) and a grid of entry tiles
  (`ENCYCLOPEDIA_TILE_WIDTH_PX` × `ENCYCLOPEDIA_TILE_HEIGHT_PX`, `UI_SPACE_M_PX` gaps): a
  `ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX` well on the dish field with the glyph medallion at the picker's
  `PICKER_CARD_MEDALLION_PX`, the title in `body` on one line ending in an ellipsis (the full title is the tile's
  accessible name), and under it the entry's `facts[0]` in `label` size, mixed case, wrapping at its spaces to at most
  `ENCYCLOPEDIA_TILE_FACT_LINES` lines at `ENCYCLOPEDIA_TILE_FACT_LINE_HEIGHT`. The caption is top-aligned, so titles
  line up across a row whether their fact takes one line or two. The fact is drawn as `<name>: <text>`: a value alone
  says nothing of what it measures (`Mass decay` over `20 mass`), and a link's text alone is another entry's title, so
  the tile would read as two titles. At one line the name spent the characters the value needed, and 30 of 78 tiles
  were cut mid-value. At two lines every tile reads in full at 1280 × 800, 1920 × 1080, 1024 × 640 and 800 × 600
  (#462). A tile is a link to its entry.

The landing's blocks stack from the panel body's own box, each on its own line height: the breadcrumb and the
heading on their cap height, the summary on the body's. The reference frame is drawn baseline by baseline
(`qa/decisions/encyclopedia/tools/render_encyclopedia.py`, with a `PANEL_PAD - 4` offset at the top), so it starts
the tile grid about 13 px higher than a stack of real line boxes does. That gap is the two ways of drawing text,
not a defect: closing it would mean overriding `UI_PANEL_PADDING_PX` for this one column or cancelling a font's
half-leading by hand, and the number would hold for one face at one size. Leave it.

Still frames of the real render in rows and tiles are follow-up #378; build 1 draws glyph medallions only.

### 11.4 The entry page

`encyclopedia-b-trait-*.png`. The page sits in a **content column**, the detail's inner width capped at
`ENCYCLOPEDIA_CONTENT_MAX_WIDTH_PX` (the panel's own width cap already keeps it there, so the cap never bites today; it
is declared because the column is the page's measure and a wider panel must not stretch it), with `UI_PANEL_PADDING_PX`
around it. Its top is two columns: the **lens column** on the left
and the **title column** beside it, `ENCYCLOPEDIA_LENS_GAP_PX` apart; below both, prose and See also run across the
content column. Each part names the `ResolvedEntry` field (§12.2) it reads.

**Geometry**, every length × `--ui-scale`:

| Viewport (UI scale) | Detail inner width | Content column | Lens               | Title column | Lens top-left (viewport px) |
| ------------------- | ------------------ | -------------- | ------------------ | ------------ | --------------------------- |
| 1280 × 800 (1)      | 702                | 702            | 300 (300 × 300 px) | 370          | (520, 109)                  |
| 1920 × 1080 (1.35)  | 846 (1143 px)      | 846 (1143 px)  | 300 (405 × 405 px) | 514 (694 px) | (702, 147)                  |

Widths are scale-1 units (px in brackets). Detail inner width is the panel less the rail, the list and two paddings
(§11.3); the title column is the content column less the lens and the gap. The lens top-left is the mockup's; the
built page measures (521, 113) at 1280 × 800, which is the content box's own top — the inset, the header, its rule and
`UI_PANEL_PADDING_PX` — and the lens shares it with the title column beside it, so the 4 units are the mockup's and
not a layout error (#465). At the `UI_SCALE_MIN` viewport
(1024 × 640, scale 0.8) the units are 1280 × 800's, so the title column keeps its 372; narrower viewports are below the
target and recorded, not solved (§11.3).

**The lens column** (`preview` not `null`):

1. **The lens**: a circle `ENCYCLOPEDIA_LENS_DIAMETER_PX` across, `encyclopedia-lens.component.ts`. It hosts the one
   preview canvas of the open encyclopedia in a square stage element of that side, clipped to the circle by a CSS
   `border-radius: 50%; overflow: hidden` on the stage host (§12.7: the renderer never knows it is round, and every scene is framed 1:1
   inside its safe circle). **Framing** (§12.7): a subject's body stays inside the `PREVIEW_LENS_SAFE_RADIUS_FRACTION` safe circle; appendages (a flagellum, cilia, pseudopods, spines) may reach into the vignette band but never past the rim. Over the canvas the lens draws a DOM SVG overlay that takes no pointer: a
   `ENCYCLOPEDIA_LENS_RIM_PX` rim in `PANEL_RIM`, a 1 px inner ring in `LIGHT_ACCENT` (the condenser colour) @
   `ENCYCLOPEDIA_LENS_INNER_RING_ALPHA`, `ENCYCLOPEDIA_LENS_TICK_COUNT` reticle ticks inward from the rim in the label
   colour @ `ENCYCLOPEDIA_LENS_TICK_ALPHA` (every `ENCYCLOPEDIA_LENS_MAJOR_TICK_EVERY`th one
   `ENCYCLOPEDIA_LENS_MAJOR_TICK_PX` long, the rest `ENCYCLOPEDIA_LENS_MINOR_TICK_PX`), and a radial edge vignette of
   `CALLOUT_BACKING` from `ENCYCLOPEDIA_LENS_VIGNETTE_START_FRACTION` of the radius to `ENCYCLOPEDIA_LENS_VIGNETTE_ALPHA` at the rim. The vignette is the eyepiece's field stop; the scene inside keeps its own condenser pool.
   - **The handle.** `encyclopedia.component.ts` owns the one `PreviewHandle`: it asks `ENCYCLOPEDIA_PREVIEW` for it on
     the first entry that has a preview, the entry page lends it the lens's stage element, it calls `show(spec)` once
     the selection has rested `ENCYCLOPEDIA_PREVIEW_SETTLE_MS`, `pause()` while a landing or an entry without a preview
     is shown, `resize` when `--ui-scale` changes, and `destroy()` on close.
   - **States** (`encyclopedia-preview[data-preview-state]`), each inside the circle under the overlay: `loading` until
     the first frame (the dish field with one slow `LIGHT_ACCENT` ring pulsing at half the radius, no text, static under
     reduced motion; §12.7 budgets 300 ms), `live`, `paused` (the last frame held), `unavailable` when the preview app
     cannot start (the dish field with `ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT` in `body`, muted, centred and wrapped
     within `ENCYCLOPEDIA_LENS_TEXT_WIDTH_FRACTION` of the diameter; no retry loop).
2. **The lens control**, centred under the lens and `UI_SPACE_M_PX` below it, one of:
   - for a trait, the tier switch: one segment per `tier_n` section (its numeral from `formatQuantity`, so the count
     follows the tier table), default the owned tier in a round, else the first; selecting one calls `show` with that
     section's `preview`, and a deep link to `#tier_n` selects it;
   - for the action scenes (`eat`, `engulf`, `escape`, `sprint`, `level_up`), a `Replay` compact button that calls
     `show(spec)` again, labelled from `ENCYCLOPEDIA_PREVIEW_REPLAY_LABEL`;
   - nothing for the other scenes.

   **Reduced motion.** Under `prefers-reduced-motion` the page pauses the lens after the first frame and adds a play and
   pause toggle (`resume` / `pause`, a compact icon button): beside the tier switch for a trait (`UI_SPACE_S_PX` apart,
   the pair centred under the lens), in place of `Replay` for an action scene, alone for the other scenes. There is no
   scale bar: the handle does not expose the preview's zoom.

An entry whose `preview` is `null` has no lens column: the title column takes the whole content column.

**Where the eyepiece's parts live** (#466). The rim, the inner ring, the reticle and the vignette belong to the
eyepiece rather than to what is under it, so all four are in the one SVG overlay above the canvas and are drawn in
every state — an empty lens and a lens with a cell in it wear the same instrument. `format/lens-overlay.ts` places
them, taking each length and alpha from the constants below and leaving the colours to the stylesheet. The
measurement the reserved box left behind still holds and is why the inner ring is there at all: with no ring the box
was a bare outline of a circle, which is what a failed image looks like rather than what an instrument does, since
`CALLOUT_BACKING` at `UI_WELL_ALPHA` over the panel's own gradient measures one unit per channel above it.

**What is built and what is left.** The lens, its four states, the one session behind it and the tier switch are
#466's; **`Replay`** is #577's. `EncyclopediaPreviewService.replay()` shows the scene on the canvas again, which
restarts its loop from the first frame, and plays a paused lens. It does nothing before the open resolves or while a
new selection settles, since there is then no scene on the canvas to restart. One piece still waits: the
**reduced-motion** pause with its play and pause toggle, which needs a `prefers-reduced-motion` seam the client does
not have yet. Under it today the lens plays, as the dish behind the panel does.

**The title column**, top to bottom:

1. **Breadcrumb** (`label`, muted): the category label, then the label of `group`; every crumb but the last is a link.
2. **Title** (`headline`), and under it `UI_SPACE_M_PX` the **chips**, sized to their text and wrapping within the
   column `UI_SPACE_S_PX` apart: from the trait summary on `subject` (rarity with its word, `COMMON` muted rim,
   `UNCOMMON` label rim, `RARE` DNA rim, never the accent; each DNA tag with its `DNA_TAG_COLOR` dot; the stage), and in
   a round `OWNED · II` in level gold, its numeral `formatQuantity(tier, QUANTITY_UNIT.tier)` in `numeral` presentation.
   An entry that is **not** a trait has one chip, `ENTRY_SUBJECT_LABEL[subject.kind]` (`Stage`, `DNA tag`), in the
   neutral tone: it has no rarity, tags or stage of its own, and a page that opened on a title with nothing under it
   read as unfinished (#465). **It repeats the breadcrumb's group crumb for the two subjects whose list group is their
   subject** — `EVOLUTION › STAGES` over `STAGE` — and is kept anyway: the alternative is those two pages losing their
   chip row, which is the defect the chip was added for, and the crumb is a quieter line the eye passes on its way to
   the title while the chip sits in the reader's eye-line under it. Where the two differ they differ usefully, and a
   subject that carried something better than its own name would be content's to give (#465's review).
3. **Facts**, `UI_SPACE_L_PX` under the chips: kit facts tables stacked `UI_SPACE_L_PX` apart, each under a `label`
   header — `ENCYCLOPEDIA_EFFECTS_TABLE_LABEL`, `ENCYCLOPEDIA_LADDER_TABLE_LABEL` and, for an entry that is not a
   trait, `ENCYCLOPEDIA_FACTS_TABLE_LABEL`.
   - A trait's first table, **Effects by tier**: the columns are the `tier_n` sections, the rows the union of the
     modifier keys their `facts` carry (`label` is the noun, `Mass decay`; `text` the value, `−15 %`, in `figure`),
     `ENCYCLOPEDIA_TIER_IDENTITY_TEXT` where a tier leaves that key at identity; the owned tier's column is tinted
     accent under `You own II` (`ENCYCLOPEDIA_TIER_CAPTION_PREFIX` and the numeral). A tier
     column is its widest value plus `UI_SPACE_S_PX` at each end, and the noun column takes the rest.
   - **When the columns do not fit, the values wrap; the table never widens** (#465). The sizing rule above assumes
     every value fits on one line, and three tier columns of `+0.3 mass / s` do not fit the 370 unit title column
     however little the noun column keeps. So both tables ask the kit for `shouldWrapValues`
     (components-and-constants.md §10.2): a value breaks at its spaces, a tier column takes its widest resulting
     **line**, the noun column takes what is left, and the row grows downwards. The nouns themselves keep one line —
     a noun column that may wrap is one the table's auto layout can squeeze, which broke `Reached by` over two lines
     to widen a value column that had room to spare. Nothing ever crosses the content
     column. Two alternatives were weighed and rejected: shrinking the noun column alone cannot fit Chloroplast's
     three tiers at any width, and moving the tier table out to the full content column would re-lay the page around
     the lens and split the facts across two measures for the sake of one trait. A wrapped tier value keeps the
     comparison the table exists for — I over II over III, aligned — which is what a clipped one loses.
   - The next table, **Unlock and ladder** for a trait, and the only table for other entries: `facts`, `label` on the
     left and `text` on the right; a fact whose `link` is set renders its text as a link to that entry. Consecutive
     facts sharing a `key` are one row: the label once, the texts as links joined by `, ` (a link with several targets
     arrives as one fact per target, architecture/encyclopedia.md §12.3). A value of several links is one of the two
     cases the wrapping rule above exists for: `Opens` on a stage page is three entry titles in one cell.
   - A table with no rows is left out, never drawn empty.

**Below both columns**, from `UI_SPACE_XL_PX` under whichever of the lens control and the title column ends lower:

1. **Prose**: `summary`'s segments (§12.6): `text` in `body`, `value` in `body` with tabular digits, `link` as accent
   text with an underline; at most `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX` wide, paragraphs `UI_SPACE_S_PX` apart,
   `text-wrap: pretty` so no line ends on a lone word.
2. **See also**, `UI_SPACE_S_PX` under the prose: a `label` header and a kit link chip per `seeAlso` link, sized to its
   title, wrapping across the content column.

**Long entries scroll** (`encyclopedia-b-long-trait-1280x800.png`, Diatom Shell: three effect rows, five facts with a
`Requires`, four paragraphs). The detail column is one kit scroll area; the lens, both columns, the prose and See also
scroll together. Once the title has scrolled under the column's top edge, a **sticky title bar**
`ENCYCLOPEDIA_STICKY_TITLE_HEIGHT_PX` tall shows at that edge, on `PANEL_TOP` with a 1 px panel-rim rule under it: the
breadcrumb (`label`, muted) over the title (`card_name`), no chips. The scroll area's `UI_SCROLL_FADE_PX` fade sits
under the rule (the mockup omits the fade; the build draws it). At 1280 × 800 an entry whose title column ends near
the lens control and whose prose is two short paragraphs fits unscrolled (Mitochondrion, with room to spare); anything
longer scrolls.

### 11.5 Navigation, search and cross-links

**State.** `game/encyclopedia/encyclopedia-state.service.ts` (root-provided, so the lobby and the room share one
session's reading position; it is not a HUD service): `location` (`{ category, entryId | null, sectionKey | null }`,
the section carrying the anchor a link arrived on), `query`, `history` (a back stack capped at
`ENCYCLOPEDIA_HISTORY_MAX`), and the last location, which is where the next open starts. A reopen starts with a blank
`query`, so a stale search never greets the next open. Every transition is a pure function in
`game/encyclopedia/format/navigation.ts`, and the rail's categories are one of them: `listedCategories` keeps the
declared order and drops every category `entriesIn` finds empty, which is also why an open with no last location falls
to the first listed category while `basics` is still empty (#361).

- **Rail**: selecting a category shows its landing (`entryId: null`). **List** and **tiles**: selecting an entry
  shows its page. **Links** (prose, facts, chips, breadcrumbs, a menu trait row): go to the target, switching the
  category to the target entry's. An anchor (`#tier_2`, `#ahead`) opens the page with that section selected or
  scrolled into view. Every move but Back pushes the location it left; Back pops. A move to the location already
  shown pushes nothing. **Activating pushes; roving replaces**: a row, tile, link, crumb or rail row the player
  activates pushes the location it left (`goTo`), while the roving focus of the rail and the list, where selection
  follows focus, only replaces it (`goToReplacing`). Arrowing down a list is one act of looking, not one move per row;
  pushing each would spend `ENCYCLOPEDIA_HISTORY_MAX` on arrow steps and drop the location Back is there to return to.
  A `sectionKey` naming a section the entry does not have is treated as the top of the page.
- **Search** is warranted: about 75 entries across six categories, and a player usually arrives knowing a name they
  saw on a card or a label. `/` (`ENCYCLOPEDIA_SEARCH_KEY_CODE`) focuses the field from anywhere in the encyclopedia
  but a text field. Typing matches, case- and accent-insensitive, the resolved `title` and then the `summary` text.
  Results are **category-major**: each category's matches are contiguous, so its section header is drawn exactly once;
  the categories run in the order of the best match each one holds, and a tie between two keeps rail order. **Within a
  category** the entries run by match rank — a title-prefix match, then any other title match, then a summary match —
  and then in list order. So the strongest name match always leads the list, whichever category it sits in. Folding
  covers what NFD decomposes: ligatures and stroked letters (`œ`, `æ`, `ß`, `ø`) are out of scope until an entry title
  uses one. While the query is non-empty
  the list column shows the results under category section headers, the rail shows no selection, and **Enter in the
  search field** opens the first result; `No match for "xyz"` (`body`, muted) when there is none. (Which Enter, this
  bullet did not say. It is the field's: everywhere else in the panel Enter already belongs to the control it was
  pressed on — the kit groups select their focused item with it — and the reader who has just typed a name is in the
  field. It is an activation, so it pushes; with no match there is nothing to open. #449.) **The detail column keeps whatever it was
  showing** — a search narrows the list, it does not leave the reader's page — and **activating a rail row drops the
  query**, so the three columns never disagree about which category is selected: the rail marks it, the list returns to
  its entries and the detail shows its landing.
- **Keyboard.** Tab order: header (Back, search, alert strip, Close), rail, list, detail (its controls and links in
  reading order). **Initial focus is the rail's selected row**, not the first tab stop: Back leads the Tab order but
  is disabled on an open with nothing pushed, and a reader whose first keystroke hits a dimmed dead control has been
  told the panel is broken. The rail row is live, marks where they already are, and every key below works from it
  (#449). The rail and the list are one tab stop each with a roving focus: ↑ ↓ move, Home End jump, and
  **selection follows focus**, so arrowing down the list pages through entries. ← → move between the rail and the list.
  **Entering a region is not a move**: Tab or ← → takes the region's Tab stop and the reader stays where they were, so
  Tab-ing through the panel to reach Close never changes the page. The consequence is that the first ↓ after entering
  the list selects its **second** row; the first row's page is reached by activating it (Enter) or by Home, both of
  which are one key.
  `ENCYCLOPEDIA_BACK_KEYS` (`Alt+←`, and Backspace outside a text field) is Back. The arrows are free here because
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
`encyclopedia-crumb-<category>` (a breadcrumb crumb that goes somewhere; the crumb naming the page already shown is
text and carries none),
`encyclopedia-entry` (with `data-entry-id`), `encyclopedia-preview` (with `data-preview-state`),
`encyclopedia-tier-<n>` (one per tier section), `encyclopedia-preview-replay`, `encyclopedia-facts`,
`encyclopedia-link-<entryId>` (every link to that entry; a test takes the first), and in the lobby
`lobby-encyclopedia`.

### 11.7 Files and constants

Standalone, `OnPush`, signal inputs; the rules of components-and-constants.md §7 hold (no decision in a template,
every decision a pure function with a unit test). Component specs get a recording fake `ENCYCLOPEDIA_PREVIEW`. The
components sit at the root of `packages/client/src/app/game/encyclopedia/`, beside §12.8's `model/`, `facts/` and
`content/`.

| File (`game/encyclopedia/`)                                                                                                                                                                                                                     | Role                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encyclopedia.component.ts`                                                                                                                                                                                                                     | The panel: header with its alert slot, the three columns, focus trap, the one `PreviewHandle`; hosted by the HUD shell in a room and by the lobby outside            |
| `encyclopedia-rail.component.ts`, `encyclopedia-list.component.ts`                                                                                                                                                                              | The category rail and the grouped entry list or search results, on the kit rail and list                                                                             |
| `encyclopedia-list-rows.component.ts`                                                                                                                                                                                                           | One run of entry rows, so a section's rows and a headerless group's are written once                                                                                 |
| `encyclopedia-breadcrumb.component.ts`                                                                                                                                                                                                          | The trail over a landing and an entry page; a crumb with a target is a link to that category's landing                                                               |
| `encyclopedia-glyph.component.ts`                                                                                                                                                                                                               | The medallion a row and a tile lead with: a trait's glyph (#312) or the subject's (#391), over `format/glyph-subject.ts`                                             |
| `encyclopedia-icons.ts`, `encyclopedia-icon.component.ts`                                                                                                                                                                                       | The six 16 px rail marks and the header's Back and Close, as shape tables and their one renderer, in `currentColor`                                                  |
| `encyclopedia-landing.component.ts`, `encyclopedia-entry.component.ts`                                                                                                                                                                          | The category landing and the entry page (§11.4); the entry page lends the lens's stage element to the handle                                                         |
| `encyclopedia-lens.component.ts`                                                                                                                                                                                                                | The lens (§11.4): the square stage the preview's canvas is lent to, its circular clip, its four states and the rim, reticle and vignette overlay                     |
| `encyclopedia-lens-control.component.ts`                                                                                                                                                                                                        | The control under the lens (§11.4): a trait's tier switch                                                                                                            |
| `encyclopedia-preview.service.ts`                                                                                                                                                                                                               | The one `PreviewHandle` an open panel has: the panel provides it, the entry page says what to show, the lens borrows its canvas (architecture §12.7)                 |
| `encyclopedia-facts.component.ts`, `encyclopedia-prose.component.ts`                                                                                                                                                                            | The facts tables and the prose segments with their links                                                                                                             |
| `encyclopedia-state.service.ts`                                                                                                                                                                                                                 | §11.5's state                                                                                                                                                        |
| `encyclopedia-activation-press.directive.ts`                                                                                                                                                                                                    | The one seam that tells an activation from a rove on a roving group whose selection follows focus: the rail's and the list's (§11.5)                                 |
| `format/navigation.ts`, `format/search.ts`, `format/panel-keys.ts`, `format/rail-view.ts`, `format/list-view.ts`, `format/landing-view.ts`, `format/panel-view.ts`, `format/glyph-subject.ts`, `format/entry-view.ts`, `format/lens-overlay.ts` | Pure: the transitions, the match and its order, the panel's key rules, the page's view model (tier columns, chips, crumbs, the tier switch), the eyepiece's geometry |
| `encyclopedia-constants.ts`, `test-ids.ts`                                                                                                                                                                                                      | The table below and the key codes; §11.6. §11.2's category labels and order are the registry's, in `model/categories.ts`                                             |
| `format/encyclopedia-css-variables.ts`                                                                                                                                                                                                          | The `--encyclopedia-…` tokens the panel's stylesheets read, pinned entry by entry (docs/CODE-STANDARDS.md §2)                                                        |

**How a spec holds a row of the table below**, mechanically rather than by judgement: the **Value** column _is_ the list. A row whose value is a **quoted string** is copy this document writes out, so a spec asserts the characters (`encyclopedia-constants.spec.ts`) and the element that shows them reads it too — a guard built from the same constant pins the shape and never the wording. A row whose value is a **number** is a tunable, so a spec reads it through the constant and stays green when it is retuned (`format/encyclopedia-css-variables.spec.ts`). Walk the column, not your memory of it.

| Constant                                                             | Value                                                                | Unit | Meaning                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENCYCLOPEDIA_INSET_PX`                                              | 32                                                                   | px   | The panel's distance from every viewport edge.                                                                                                                                                                                                                                                                                                                              |
| `ENCYCLOPEDIA_MAX_WIDTH_PX`                                          | 1360                                                                 | px   | The panel's widest.                                                                                                                                                                                                                                                                                                                                                         |
| `ENCYCLOPEDIA_MAX_HEIGHT_PX`                                         | 880                                                                  | px   | The panel's tallest.                                                                                                                                                                                                                                                                                                                                                        |
| `ENCYCLOPEDIA_HEADER_HEIGHT_PX`                                      | 56                                                                   | px   | The header row.                                                                                                                                                                                                                                                                                                                                                             |
| `ENCYCLOPEDIA_RAIL_WIDTH_PX`                                         | 184                                                                  | px   | The category rail: the longest label, `Cells & food`, with its icon and a two-digit count.                                                                                                                                                                                                                                                                                  |
| `ENCYCLOPEDIA_LIST_WIDTH_PX`                                         | 280                                                                  | px   | The entry list: `Photosynthetic bacterium` and `Cytoskeleton Lattice` fit beside their medallion.                                                                                                                                                                                                                                                                           |
| `ENCYCLOPEDIA_CONTENT_MAX_WIDTH_PX`                                  | 848                                                                  | px   | The content column's widest. The panel's own width cap already holds the detail column there; this is the page's measure, so a wider panel later never stretches the prose and the tables with it.                                                                                                                                                                          |
| `ENCYCLOPEDIA_LENS_DIAMETER_PX`                                      | 300                                                                  | px   | The lens, and the side of its square preview canvas.                                                                                                                                                                                                                                                                                                                        |
| `ENCYCLOPEDIA_LENS_GAP_PX`                                           | 32                                                                   | px   | The lens to the title column.                                                                                                                                                                                                                                                                                                                                               |
| `ENCYCLOPEDIA_LENS_RIM_PX`                                           | 6                                                                    | px   | The lens rim, in `PANEL_RIM`.                                                                                                                                                                                                                                                                                                                                               |
| `ENCYCLOPEDIA_LENS_INNER_RING_ALPHA`                                 | 0.35                                                                 | ×    | The 1 px `LIGHT_ACCENT` ring inside the rim.                                                                                                                                                                                                                                                                                                                                |
| `ENCYCLOPEDIA_LENS_TICK_COUNT`                                       | 24                                                                   | —    | Reticle ticks around the lens.                                                                                                                                                                                                                                                                                                                                              |
| `ENCYCLOPEDIA_LENS_MAJOR_TICK_EVERY`                                 | 6                                                                    | —    | Every sixth tick is a major one: the four quarters.                                                                                                                                                                                                                                                                                                                         |
| `ENCYCLOPEDIA_LENS_MAJOR_TICK_PX`, `ENCYCLOPEDIA_LENS_MINOR_TICK_PX` | 10, 5                                                                | px   | Tick lengths, inward from the rim.                                                                                                                                                                                                                                                                                                                                          |
| `ENCYCLOPEDIA_LENS_TICK_ALPHA`                                       | 0.6                                                                  | ×    | The ticks' opacity, in the label colour.                                                                                                                                                                                                                                                                                                                                    |
| `ENCYCLOPEDIA_LENS_VIGNETTE_START_FRACTION`                          | 0.7                                                                  | × r  | Where the edge vignette starts.                                                                                                                                                                                                                                                                                                                                             |
| `ENCYCLOPEDIA_LENS_VIGNETTE_ALPHA`                                   | 0.6                                                                  | ×    | The vignette's `CALLOUT_BACKING` at the rim.                                                                                                                                                                                                                                                                                                                                |
| `ENCYCLOPEDIA_LENS_TEXT_WIDTH_FRACTION`                              | 0.7                                                                  | × d  | The widest line of the `unavailable` text inside the lens.                                                                                                                                                                                                                                                                                                                  |
| `ENCYCLOPEDIA_LENS_LOADING_RING_RADIUS_FRACTION`                     | 0.5                                                                  | × r  | The `loading` ring: §11.4's "half the radius", clear of both the reticle and the `unavailable` text.                                                                                                                                                                                                                                                                        |
| `ENCYCLOPEDIA_LENS_LOADING_PULSE_MS`                                 | 1800                                                                 | ms   | One breath of that ring. It is a wait, not a progress bar: nothing on the page knows how far along the bake is.                                                                                                                                                                                                                                                             |
| `ENCYCLOPEDIA_LENS_LOADING_PULSE_MIN_ALPHA`                          | 0.2                                                                  | ×    | The dimmest the pulse goes; it breathes back to full, and holds full under `prefers-reduced-motion`.                                                                                                                                                                                                                                                                        |
| `ENCYCLOPEDIA_STICKY_TITLE_HEIGHT_PX`                                | 48                                                                   | px   | The sticky title bar of a scrolled entry: the breadcrumb over the title.                                                                                                                                                                                                                                                                                                    |
| `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX`                                    | 640                                                                  | px   | The prose measure: about 90 characters of `body`.                                                                                                                                                                                                                                                                                                                           |
| `ENCYCLOPEDIA_EFFECTS_TABLE_LABEL`                                   | `Effects by tier`                                                    | —    | The header over a trait's tier table (§11.4).                                                                                                                                                                                                                                                                                                                               |
| `ENCYCLOPEDIA_LADDER_TABLE_LABEL`                                    | `Unlock and ladder`                                                  | —    | The header over a trait's second table.                                                                                                                                                                                                                                                                                                                                     |
| `ENCYCLOPEDIA_FACTS_TABLE_LABEL`                                     | `Facts`                                                              | —    | The header over the one table of an entry that is not a trait, which has no unlock and no ladder of its own.                                                                                                                                                                                                                                                                |
| `ENCYCLOPEDIA_SEE_ALSO_LABEL`                                        | `See also`                                                           | —    | The header over the link chips (§11.4).                                                                                                                                                                                                                                                                                                                                     |
| `ENCYCLOPEDIA_TIER_CAPTION_PREFIX`                                   | `You own `                                                           | —    | Before the owned tier's numeral, as the caption over the tier table's noun column.                                                                                                                                                                                                                                                                                          |
| `ENCYCLOPEDIA_OWNED_CHIP_LABEL`, `ENCYCLOPEDIA_OWNED_CHIP_SEPARATOR` | `OWNED`, `·`                                                         | —    | The level-gold chip a round adds, around the tier's numeral: `OWNED · II`.                                                                                                                                                                                                                                                                                                  |
| `ENCYCLOPEDIA_TIER_IDENTITY_TEXT`                                    | `—`                                                                  | —    | What a tier column shows where that tier leaves the row's modifier at identity.                                                                                                                                                                                                                                                                                             |
| `ENCYCLOPEDIA_TILE_WIDTH_PX`                                         | 168                                                                  | px   | A landing tile; three to a row at 1280 × 800 and four at 1920 × 1080. The grid wraps to whatever the column fits.                                                                                                                                                                                                                                                           |
| `ENCYCLOPEDIA_TILE_HEIGHT_PX`                                        | 152                                                                  | px   | A landing tile: the well, the one-line title and a fact of up to `ENCYCLOPEDIA_TILE_FACT_LINES` lines (#462).                                                                                                                                                                                                                                                               |
| `ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX`                                | 96                                                                   | px   | The tile's well.                                                                                                                                                                                                                                                                                                                                                            |
| `ENCYCLOPEDIA_TILE_FACT_LINES`                                       | 2                                                                    | —    | The lines a tile's fact wraps to before it ends in an ellipsis.                                                                                                                                                                                                                                                                                                             |
| `ENCYCLOPEDIA_TILE_FACT_LINE_HEIGHT`                                 | 1.2                                                                  | —    | The line height the fact wraps at.                                                                                                                                                                                                                                                                                                                                          |
| `ENCYCLOPEDIA_SCRIM_ALPHA`                                           | 0.8                                                                  | ×    | The callout-backing scrim behind the panel in a round.                                                                                                                                                                                                                                                                                                                      |
| `ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA`                                     | 1                                                                    | ×    | The same scrim outside a round, where no dish runs behind the panel: it covers completely, so the lobby's own header never ghosts through. Which one applies is the host's answer (`isOverDish`), never the panel's.                                                                                                                                                        |
| `ENCYCLOPEDIA_HISTORY_MAX`                                           | 50                                                                   | —    | Back-stack depth; the oldest location drops first.                                                                                                                                                                                                                                                                                                                          |
| `ENCYCLOPEDIA_TITLE`                                                 | `Encyclopedia`                                                       | —    | The header's word, the dialog's accessible name and the landing's first crumb.                                                                                                                                                                                                                                                                                              |
| `ENCYCLOPEDIA_RAIL_ICON_PX`                                          | 16                                                                   | px   | A rail row's category mark (`encyclopedia-icons.ts`), drawn in `currentColor`.                                                                                                                                                                                                                                                                                              |
| `ENCYCLOPEDIA_SEARCH_PLACEHOLDER`                                    | `Search`                                                             | —    | The search field's placeholder, which also names it.                                                                                                                                                                                                                                                                                                                        |
| `ENCYCLOPEDIA_RESULTS_LABEL`                                         | `Results`                                                            | —    | The list column's header while a query runs, where no category is selected.                                                                                                                                                                                                                                                                                                 |
| `ENCYCLOPEDIA_NO_MATCH_PREFIX`, `ENCYCLOPEDIA_NO_MATCH_SUFFIX`       | `No match for "`, `"`                                                | —    | Around the query as typed, for §11.5's `No match for "xyz"`.                                                                                                                                                                                                                                                                                                                |
| `DEFAULT_ENCYCLOPEDIA_CATEGORY`                                      | `basics`                                                             | —    | Where an open with no entry asked for and no last location starts (§11.1); while that category is empty, the first one the rail lists.                                                                                                                                                                                                                                      |
| `ENCYCLOPEDIA_PREVIEW_SETTLE_MS`                                     | 150                                                                  | ms   | Arrowing through the list calls `show` only once the selection rests this long.                                                                                                                                                                                                                                                                                             |
| `ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT`                              | `Preview unavailable`                                                | —    | The `unavailable` state's line.                                                                                                                                                                                                                                                                                                                                             |
| `ENCYCLOPEDIA_PREVIEW_REPLAY_LABEL`                                  | `Replay`                                                             | —    | The replay button's label, a record keyed by the action scenes (`PreviewActionScene`), so a new action scene without a label fails `typecheck`. One value in build 1.                                                                                                                                                                                                       |
| `ENCYCLOPEDIA_SEARCH_KEY_CODE`                                       | `Slash`                                                              | —    | Focuses the search field.                                                                                                                                                                                                                                                                                                                                                   |
| `ENCYCLOPEDIA_BACK_KEYS`                                             | `{ code: 'ArrowLeft', isAltKeyHeld: true }`, `{ code: 'Backspace' }` | —    | Back, as `KeyboardEvent` `code` plus modifier, and a modifier a chord does not name must be up. A chord with **no** modifier is one a text field is using, so it acts only outside one — which is §11.5's "Backspace outside a text field", derived rather than named. (`isAltKeyHeld`, not `KeyboardEvent`'s own `altKey`: CODE-STANDARDS.md's boolean-naming rule, #449.) |

`ENCYCLOPEDIA_KEY_CODE` (`KeyH`) lives with the in-room key codes in `input/input-constants.ts` (§4), since only the
room's input layer reads it.

### 11.8 The options not chosen (#368)

The human chose **B** on #368. What the other frames show, so the mockups read right:

- **A, atlas** (`encyclopedia-a-trait-*.png`, `encyclopedia-a-long-trait-1280x800.png`): a 704 × 220 (16:5) preview box
  above two side-by-side facts tables, with a sticky title-and-chips row. Its landing frames
  (`encyclopedia-a-category-*.png`) stay the reference for the category landing, which B shares.
- **C, codex** (`encyclopedia-c-trait-*.png`): a tab row in place of the rail and the list, a full-width hero preview
  and previous / next entry buttons.
