# Evolution — UI: HUD, overlays and onboarding

Ticket: #30, reworked for decision #143 in #146 (**option C, diegetic**: progress is shown on the player's own cell;
the only chrome is the leaderboard and the round clock). Epic #2. Implemented by #100. Rules and numbers this doc
draws on live elsewhere and are linked, never restated: controls, session and camera in
[`GAME-DESIGN.md`](./GAME-DESIGN.md) §5–§7; offers and catch-up in [`PROGRESSION.md`](./PROGRESSION.md) §4–§5; the
catalog in [`TRAITS.md`](./TRAITS.md); the endosymbiosis counters in [`ecology/food-and-spawn.md §1`](./ecology/food-and-spawn.md#1-food-kinds);
every snapshot field named below in [`architecture/entity-model.md §2`](./architecture/entity-model.md#2-entity-model) and §4; the look in
[`VISUAL-STYLE.md`](./VISUAL-STYLE.md) (#34), which owns colours (§2) and type (§7); **how the on-cell indicators
are drawn** in [`rendering/own-cell-indicators.md §10`](./rendering/own-cell-indicators.md#10-own-cell-indicators-and-world-anchored-labels-146). The
decision frames are `qa/decisions/hud-layout/` (branch `decisions/hud-layout`) and the frames that solve the reading
floor inside C are [`qa/decisions/hud-layout/diegetic/`](../qa/decisions/hud-layout/diegetic/README.md). Sheet 03's
HUD panel ([`concept-art/README.md`](./concept-art/README.md#sheet-03--motion-studies-and-hud-motion-and-hudsvg-106))
is superseded by this doc where they differ. This doc holds no hex value and no type size: colours are cited by
role (DNA, level gold, danger, accent, panel gradient and rim, callout backing, timer-bar track, identity ring, text
/ label / muted, and the organelle colours `MITO_BASE` / `CHLORO_LIGHT`) and text by type role (`number`,
`headline`, `clock`, `title`, `value`, `card_name`, `body`, `label`, `caption`, visual-style/ui-type.md §7's ids verbatim);
the sizes, fonts and case of each role are visual-style/ui-type.md §7's. Balance numbers named below are read from
`game_state.balance` (`balance.<domain>.<NAME>`, architecture/constants-files-tests.md §9), never imported from `constants/`: the client
keeps no copy of a balance number (CODE-STANDARDS §2).

Four facts this doc owns: **the HUD reads `WorldStore` through `GameStateService` signals and never touches Pixi**
(architecture/client.md §6), **the trait picker never pauses the dish** (PROGRESSION §4), **the exclusion box
(`HUD_PLAYER_EXCLUSION_PX`, §1) is defined here**, and **what the own cell shows, and the reading floor it must meet,
is defined here (§3.1)**; the renderer draws it and rendering/own-cell-indicators.md §10 owns the how. visual-style/motion-and-legibility.md §6 and rendering/budget.md §6
cite the box.

## Files

This document is split into topic files (#306). Read only the file a ticket or brief cites.

| File                                                                 | Sections  | Topic                                        |
| -------------------------------------------------------------------- | --------- | -------------------------------------------- |
| [`ui/layout.md`](./ui/layout.md)                                     | §1–§2     | Layout frame and lobby screens               |
| [`ui/hud.md`](./ui/hud.md)                                           | §3–§3.1   | In-round HUD and own-cell indicators         |
| [`ui/overlays.md`](./ui/overlays.md)                                 | §3.2–§3.6 | Trait pick, death, results, menu and notices |
| [`ui/input-and-onboarding.md`](./ui/input-and-onboarding.md)         | §4–§6     | Input, onboarding and readability            |
| [`ui/components-and-constants.md`](./ui/components-and-constants.md) | §7–§9     | Component plan, acceptance and constants     |
