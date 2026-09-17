# Evidence — #415, the 240 × 214 trait card with a 4-line cap (PR #441)

## In the running game, 1280 × 800

A private stack on 4510/4512, the room paused so the frame is still, the offer forced with the debug MCP
(`debug_set_player` for the owned traits, `debug_set_balance` to weight upgrade cards so the draft reaches the two
cards that overflowed, `debug_pause_room` before each shot). Every card measured off the live DOM.

| file                                     | card                                                                                                 | effect lines / rows | card box | content | clear under the rarity row |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------- | -------- | ------- | -------------------------- |
| `amoeba-pseudopods-upgrade-1280x800.png` | Amoeba Pseudopods `I → II` — the 225 px overflow                                                     | 3 / 3               | 214 px   | 212 px  | 23 px                      |
| `diatom-shell-upgrade-1280x800.png`      | Diatom Shell `I → II` — the 220 px overflow; its paired spines line still wraps to two rows          | 3 / 4               | 214 px   | 212 px  | 28 px                      |
| `four-line-card-1280x800.png`            | Cytoskeleton Lattice `I → II` at the 4-line cap, with the catalog's longest name over its 2-row name | 4 / 4               | 214 px   | 212 px  | 7 px                       |

In all three the rarity row never reaches the key chip, and the card row sits at x 270–1010, y 586–800 — ending
exactly on the bottom edge, as `docs/ui/overlays.md` §3.2's worked example now says.

Two wrap points the extra 70 px did **not** cure are visible in these frames and are **#446**, not this PR: the
Diatom Shell's paired line breaks as `spit out 70 % /` + `s`, splitting a number from its unit, and the name breaks
as `Amoeba Pseudopods I →` + `II`, orphaning the target tier. Both want non-breaking spaces catalog-wide, which
costs no width.

No catalog tier has four effect lines, so the four-line card was produced by temporarily giving
`CYTOSKELETON_TIERS` tier II two extra modifiers, rebuilding `@evolution/shared` and restarting the private
server. That edit was reverted before the first commit and is not in this branch (`debug_set_balance` could not do
it: it patches existing number leaves only, so it cannot add a modifier).

## Every catalog card, measured in headless Chromium

`measure-card-heights.mjs` lays out all 80 catalog cards — every trait at every tier, fresh and upgrade — with the
shipped `packages/client/src/app/game/hud/trait-card.component.css` and the shipped type scale, at `height: auto`,
and reports the height each one wants. Border box, so the figures include the card's 1 px rim and compare directly
against the 214 px card.

**These heights are font-dependent, and the run is the conservative end of the range.** `UI_FONT_SANS` is a system
stack with no web font (`Inter, "Segoe UI", system-ui, sans-serif`), so what a player actually gets depends on their
machine. The container has none of the named faces and falls through to DejaVu Sans — the widest of them, and the
font behind #316's evidence — so text wraps at least as early here as it will for a player on Inter or Segoe UI.
Read the numbers as an upper bound on the height, not an absolute.

The custom properties are restated in the harness rather than imported from `hud/format/hud-css-variables.ts`
(plain node, no TS loader on the path). Every one that affects height was checked against the shipped constant;
only `--hud-leaderboard-corner-radius` differs, and it is the rim radius, which changes no height. The harness
header says the same, so re-check it there before trusting a fresh run.

```bash
node qa/evidence/pr-441/measure-card-heights.mjs qa/evidence/pr-441/catalog-cards.json 240 \
  packages/client/src/app/game/hud/trait-card.component.css
```

`catalog-cards.json` is the card text `describeTierModifiers` generates from the shipped balance.
`measured-at-170.txt` and `measured-at-240.txt` are the two runs.

| card                                                    | at 170 wide            | at 240 wide |
| ------------------------------------------------------- | ---------------------- | ----------- |
| Amoeba Pseudopods `I → II`                              | **225 px — overflows** | 192 px      |
| Diatom Shell `I → II` and `II → III`                    | **220 px — overflows** | 187 px      |
| tallest of the other 77 (`amoeba_pseudopods II → III`)  | 211 px                 | 192 px      |
| longest name over four ordinary one-row lines           | 208 px                 | 208 px      |
| longest name over the four longest lines in the catalog | 264 px                 | 250 px      |

The last row is adversarial, not reachable: three of those four lines are the Diatom Shell's paired spines line, and
no trait has more than one of them. It is in the table because it is the case a _line count_ can never catch — which
is #428's rendered-height guard, not an argument against the four-line cap.

## Every viewport, not just the reference one (added by review)

The runs above are at `--hud-scale` 1. The graphics-qa review on PR #441 parameterised the harness by scale and
re-ran it at 0.8, 1.0, 1.35 and 1.8 — 1024 × 640 through 2560 × 1440, the five viewports `docs/ui/overlays.md` §3.2
names. At every scale the only card that overflows is the synthetic adversarial one, and the four-line ceiling card
keeps the same proportional slack (164.7 of 171.2 at 0.8; 280 of 288.9 at 1.35). The four-line cap is safe on all
five, not only at the reference viewport.
