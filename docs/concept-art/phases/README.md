# Phase concepts (ticket #782)

Concept sheets for the game in phases: outgrowing the dish, the pond, and the roads to many-celled life. They
support the decision tickets filed from ticket #782; **nothing here is decided**, and every game number on them is
a proposal. Once the human picks a direction, the chosen design moves into `docs/game-design/`.

Every sheet is code-drawn SVG in the dark-field language of sheets 01 and 04 ([`../README.md`](../README.md)), with
a 1920 × 1080 PNG rendered by `rsvg-convert`. The SVGs are generated: edit the script in `tools/`, then re-render.

```bash
docs/concept-art/phases/tools/render.sh                  # every sheet
docs/concept-art/phases/tools/render.sh pond_screen      # one sheet (the script name)
```

| Sheet                       | Shows                                                                         |
| --------------------------- | ----------------------------------------------------------------------------- |
| `game-shapes.png`           | S1 · three whole-game shapes as timelines, with triggers and cost             |
| `multicell-start.png`       | S2 · where multicell starts (three options), and a sketch of an animal era    |
| `transition-options.png`    | S3 · how the move to the pond feels (three options, four frames each)         |
| `transition-storyboard.png` | P1 · the recommended transition, six frames                                   |
| `pond-creatures.png`        | P2 · the pond's creatures sized against the player's five forms               |
| `pond-screen.png`           | P3 · a mock game screen in the pond, with today's HUD chrome                  |
| `road-green-colony.png`     | R1 · the euglena's road: the volvocine ladder to Volvox, and the body map HUD |
| `road-slime.png`            | R2 · the amoeba's road: the slime-mould stream, slug and stalk                |
| `road-diatom-chain.png`     | R3 · the diatom's road: chains and the Asterionella star                      |
| `road-ciliates.png`         | R4 · the paramecium and the stentor: real dead ends, three options            |

`tools/phase_art.py` is the shared drawing kit (a palette-generic trim of `../tools/origins-ladder.py`'s helpers).
