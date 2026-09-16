# Decision: trait card effect lines (#415, revisits #316)

Three traits (Cell Wall, Amoeba Pseudopods, Paramecium Cilia) sit at the card's 3-line cap in every tier, so the next
modifier on any of them overflows. Each frame shows the same offer at level 5: Cell Wall III, Diatom Shell `II → III`
and Amoeba Pseudopods `I → II`, the catalog's tallest card.

- `today-*.png`: the shipped 170 × 214 card with the shipped catalog. It already overflows: Amoeba Pseudopods
  `I → II` needs 223 px and Diatom Shell `II → III` 218 px.
- `a-shorter-words-*.png`: A, the same card with shorter labels and paired lines. Still 3 lines.
- `b-wider-card-*.png`: B, a 240 × 214 card with the labels unchanged and room for 4 lines.
- `c-taller-card-*.png`: C, a 170 × 254 card with the labels unchanged and 4 lines, which runs off the bottom edge.
- `*-band-2x.png`: the band of each 1280 × 800 frame at 2×, for reading the card text.

A, B and C's Amoeba card carries a **hypothetical** 4th effect (dashed outline); no catalog tier has one today.

**How the frames were measured.** The row heights and every name and effect wrap come from Chromium rendering the
shipped card CSS (`hud/trait-card.component.css`, no row allowed to shrink) in DejaVu Sans, the container's fallback
for Inter and the font of #316's evidence. The card text is `describeTierModifiers` on the shipped balance, except
A's rewritten labels. The glyphs are the #312 glyph views. The band geometry is `docs/ui/overlays.md` §3.2
(`pickerBandOffsetPx` 136 at 1280 × 800 and 183.6 at 1920 × 1080).

To re-render, run from the repo root:

```bash
D=qa/decisions/trait-card-lines
python3 $D/tools/render_cards.py $D
for f in $D/*-1280x800.svg; do rsvg-convert -w 1280 -h 800 $f -o ${f%.svg}.png; done
for f in $D/*-1920x1080.svg; do rsvg-convert -w 1920 -h 1080 $f -o ${f%.svg}.png; done
for f in $D/*-1280x800.svg; do
  rsvg-convert -z 2 $f | convert - -crop 1960x560+440+1040 +repage ${f%-1280x800.svg}-band-2x.png
done
```
