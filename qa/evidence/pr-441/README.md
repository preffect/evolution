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

No catalog tier has four effect lines, so the four-line card was produced by temporarily giving
`CYTOSKELETON_TIERS` tier II two extra modifiers, rebuilding `@evolution/shared` and restarting the private
server. That edit was reverted before the first commit and is not in this branch (`debug_set_balance` could not do
it: it patches existing number leaves only, so it cannot add a modifier).

## Every catalog card, measured in headless Chromium

`measure-card-heights.mjs` lays out all 80 catalog cards — every trait at every tier, fresh and upgrade — with the
shipped `packages/client/src/app/game/hud/trait-card.component.css` and the shipped type scale, at `height: auto`,
and reports the height each one wants. DejaVu Sans, the container's fallback for Inter and the font of #316's
evidence. Border box, so the figures include the card's 1 px rim and compare directly against the 214 px card.

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
| tallest of the other 77                                 | 211 px                 | 176 px      |
| longest name over four ordinary one-row lines           | 208 px                 | 208 px      |
| longest name over the four longest lines in the catalog | 264 px                 | 250 px      |

The last row is adversarial, not reachable: three of those four lines are the Diatom Shell's paired spines line, and
no trait has more than one of them. It is in the table because it is the case a _line count_ can never catch — which
is #428's rendered-height guard, not an argument against the four-line cap.
