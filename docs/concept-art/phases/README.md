# Phase concepts (tickets #782, #864)

Concept sheets for the game in phases: outgrowing the dish, the rock pool, and the roads to many-celled life. They
were drawn for the decision tickets filed from ticket #782; **the human has decided** (tickets #784 to #790 on 2026-10-13, tickets #901 and #902 on 2026-10-14), and the decided
design is [`docs/game-design/phases.md`](../../game-design/phases.md) §14 (ticket #864, build epic #866):

| Ticket      | Chosen | Sheets                                                                                                                                                         |
| ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ticket #784 | A      | `game-shapes.png`: one journey, together (B and C greyed out, "not chosen")                                                                                    |
| ticket #785 | A      | `multicell-start.png`: colonies in the rock pool after a big-protist chapter                                                                                   |
| ticket #786 | C      | `transition-options.png` (C marked chosen), `transition-seamless.png` (new); `transition-storyboard.png` is the pull-back, **not chosen**, kept for the record |
| ticket #787 | A      | `road-ciliates.png`: the paramecium and the stentor stay one cell                                                                                              |
| ticket #790 | A      | every sheet names the sea-water cast: the second world is a rock pool on the kelp shore, not a pond                                                            |
| ticket #901 | A      | `road-green-colony.png`: the euglena's road is the light road, _Phaeocystis_ (answered 2026-10-14)                                                             |
| ticket #902 | A      | no sheet: the opening dive stays as it is (answered 2026-10-14)                                                                                                |

The sheets are concepts, not specs: game numbers on them are the tuning values of phases.md §14.14, and the
polished look belongs to the build tickets. Where a sheet and phases.md disagree, phases.md wins.

Every sheet is code-drawn SVG in the dark-field language of sheets 01 and 04 ([`../README.md`](../README.md)), with
a 1920 × 1080 PNG rendered by `rsvg-convert`. The SVGs are generated: edit the script in `tools/`, then re-render.

```bash
docs/concept-art/phases/tools/render.sh                  # every sheet
docs/concept-art/phases/tools/render.sh pond_screen      # one sheet (the script name)
```

| Sheet                       | Shows                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `game-shapes.png`           | S1 · three whole-game shapes as timelines; A chosen                                                        |
| `multicell-start.png`       | S2 · where multicell starts; A chosen; a sketch of an animal era and the rosettes                          |
| `transition-options.png`    | S3 · how the move to the pool feels (three options, four frames each); C chosen                            |
| `transition-seamless.png`   | P1b · the chosen seamless move, six frames and its timing: you never lose control                          |
| `transition-storyboard.png` | P1 · the pull-back, six frames: **not chosen** (ticket #786 chose C)                                       |
| `pond-creatures.png`        | P2 · the rock pool's creatures sized against the player's five forms, with their sea-water names           |
| `pond-screen.png`           | P3 · a mock game screen in the rock pool, with today's HUD chrome                                          |
| `road-green-colony.png`     | R1 · the euglena's road, now **the light road**: _Phaeocystis_, a sea-water colony (Volvox is fresh-water) |
| `road-slime.png`            | R2 · the amoeba's road: the slime-mould stream, slug and stalk, fruiting on the bank                       |
| `road-diatom-chain.png`     | R3 · the diatom's road: chains and the _Asterionellopsis_ star                                             |
| `road-ciliates.png`         | R4 · the paramecium and the stentor: A chosen, B and C greyed out                                          |

The file names keep the proposal's words (`pond-*`, `road-green-colony`) so links in the tickets keep working.
`tools/phase_art.py` is the shared drawing kit (a palette-generic trim of `../tools/origins-ladder.py`'s helpers).
