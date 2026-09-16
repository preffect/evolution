#!/usr/bin/env python3
"""Trait card line cap (#415): today and options A, B, C, each at 1280x800 and 1920x1080.

The band geometry is docs/ui/overlays.md §3.2 (title row at centre + pickerBandOffsetPx, bar, cards). Card rows use
the heights Chromium measured for the shipped card CSS in DejaVu Sans (the container's fallback for Inter):
medallion 56, caption 13, name 19 per row, effect 12 px at 14 per row, 2 px gaps, 8 px padding. The name and effect
wraps in tools/cards.json are the measured ones; the glyphs are the real #312 glyph views. Seeded: a re-run
reproduces the SVGs byte for byte.
"""
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = json.loads((HERE / 'cards.json').read_text(encoding='utf-8'))

GOLD, TEXT, LABEL, MUTED = '#ffe08a', '#dfeaf2', '#8fb3c9', '#7f93a8'
PANEL_TOP, PANEL_BOTTOM, PANEL_RIM = '#0e1f33', '#060e1a', '#173250'
ANNOT, DANGER = '#ff9a4d', '#ff5470'
SANS = "Inter, 'DejaVu Sans', sans-serif"
MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace"

PAD, GAP, MEDALLION = 8, 2, 56
CAPTION_ROW, NAME_ROW, EFFECT_ROW = 13, 19, 14
CAPTION_BASELINE, NAME_BASELINE, EFFECT_BASELINE = 10.3, 15.0, 11.1
CARD_GAP, ROW_GAP, TITLE_ROW, BAR_W, BAR_H = 10, 12, 22, 470, 4
EXCLUSION, SPOT_SOFT = 120, 0.85
# pickerBandOffsetPx at each viewport (overlays.md §3.2: the exclusion box wins at both).
BAND_OFFSET = {(1280, 800): 136.0, (1920, 1080): 183.6}
VIEWPORTS = ((1280, 800), (1920, 1080))

OPTIONS = {
    'today': dict(w=170, h=214, cards=('today_cellwall', 'today_diatom', 'today_amoeba'),
                  title='Today · card 170 × 214, up to 3 lines', sub='Shipped catalog, no hypothetical line'),
    'a-shorter-words': dict(w=170, h=214, cards=('A_cellwall', 'A_diatom', 'A_amoeba'),
                            title='A · Shorter words + pairs · 170 × 214', sub='Still 3 lines max'),
    'b-wider-card': dict(w=240, h=214, cards=('B_cellwall', 'B_diatom', 'B_amoeba'),
                         title='B · Wider card · 240 × 214', sub='4 lines max, words unchanged'),
    'c-taller-card': dict(w=170, h=254, cards=('C_cellwall', 'C_diatom', 'C_amoeba'),
                          title='C · Taller card · 170 × 254', sub='4 lines max, words unchanged'),
}


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text(x, y, s, px, fill, anchor='middle', weight='normal', family=SANS, tracking=0.0):
    spacing = f' letter-spacing="{tracking * px:.2f}"' if tracking else ''
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{px:.1f}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}"{spacing}>{esc(s)}</text>')


def glyph(trait_id, x, y, size, suffix):
    view = DATA['glyphs'][trait_id]
    o = ['<defs>']
    for g in view['gradients']:
        o.append(f'<radialGradient id="{g["id"]}{suffix}" cx="{g["fx"]}" cy="{g["fy"]}" fx="{g["fx"]}" fy="{g["fy"]}" r="{g["radius"]}">')
        for stop in g['stops']:
            o.append(f'<stop offset="{stop["offset"]}" stop-color="{stop["colour"]}" stop-opacity="{stop["opacity"]}"/>')
        o.append('</radialGradient>')
    o.append(f'</defs><g transform="translate({x:.2f} {y:.2f}) scale({size / 100:.4f})">')
    for layer in view['layers']:
        attrs = {'d': layer['d'], 'fill': layer['fill'], 'fill-opacity': layer['fillOpacity'], 'stroke': layer['stroke'],
                 'stroke-width': layer['strokeWidth'], 'stroke-opacity': layer['strokeOpacity'],
                 'stroke-dasharray': layer['dash'], 'stroke-linecap': layer['lineCap']}
        if isinstance(attrs['fill'], str) and attrs['fill'].startswith('url(#'):
            attrs['fill'] = attrs['fill'][:-1] + suffix + ')'
        body = ' '.join(f'{k}="{v}"' for k, v in attrs.items() if v is not None)
        transform = f' transform="{layer["transform"]}"' if layer['transform'] else ''
        o.append(f'<g{transform}><path {body} stroke-linejoin="round"/></g>')
    o.append('</g>')
    return ''.join(o)


def card(x, y, w, h, s, key, index):
    c = DATA['cards'][key]
    cx = x + w * s / 2
    o = [f'<rect x="{x:.1f}" y="{y:.1f}" width="{w * s:.1f}" height="{h * s:.1f}" rx="{6 * s:.1f}" fill="url(#card-bg)" '
         f'stroke="{PANEL_RIM}" stroke-width="{s:.2f}"/>']
    cursor = y + PAD * s
    o.append(glyph(c['traitId'], cx - MEDALLION * s / 2, cursor, MEDALLION * s, f'-{key}'))
    cursor += (MEDALLION + GAP) * s
    o.append(text(cx, cursor + CAPTION_BASELINE * s, c['category'].upper(), 11 * s, LABEL, tracking=0.08))
    cursor += (CAPTION_ROW + GAP) * s
    for row in c['nameRows']:
        o.append(text(cx, cursor + NAME_BASELINE * s, row, 16 * s, TEXT, weight='bold'))
        cursor += NAME_ROW * s
    cursor += GAP * s
    hypo_mid = None
    for i, rows in enumerate(c['effects']):
        top = cursor
        for row in rows:
            o.append(text(cx, cursor + EFFECT_BASELINE * s, row, 12 * s, TEXT))
            cursor += EFFECT_ROW * s
        if i == c['hypoIndex']:
            inset = 4 * s
            o.append(f'<rect x="{x + inset:.1f}" y="{top - s:.1f}" width="{w * s - 2 * inset:.1f}" height="{cursor - top + 2 * s:.1f}" '
                     f'rx="{3 * s:.1f}" fill="none" stroke="{ANNOT}" stroke-width="{1.2 * s:.2f}" stroke-dasharray="{4 * s:.1f} {3 * s:.1f}"/>')
            hypo_mid = (top + cursor) / 2
        cursor += GAP * s
    o.append(text(cx, cursor + CAPTION_BASELINE * s, c['rarity'].upper(), 11 * s, LABEL, tracking=0.08))
    content_bottom = cursor + (CAPTION_ROW + PAD) * s
    o.append(text(x + (w - PAD) * s, y + (h - PAD - 1) * s, str(index + 1), 11 * s, MUTED, anchor='end'))
    return ''.join(o), hypo_mid, content_bottom, c


def defs(W, H, s):
    spot_r = EXCLUSION * s / SPOT_SOFT
    return ('<defs>'
            '<radialGradient id="bg" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="#0b1626"/><stop offset="1" stop-color="#04070d"/></radialGradient>'
            f'<linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PANEL_TOP}"/><stop offset="1" stop-color="{PANEL_BOTTOM}"/></linearGradient>'
            f'<radialGradient id="spot" gradientUnits="userSpaceOnUse" cx="{W / 2}" cy="{H / 2}" r="{spot_r:.1f}">'
            f'<stop offset="{SPOT_SOFT}" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>'
            f'<mask id="spot-mask"><rect width="{W}" height="{H}" fill="url(#spot)"/></mask>'
            '<radialGradient id="cell" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="#22c1d6" stop-opacity="0.3"/>'
            '<stop offset="1" stop-color="#a6f4ff" stop-opacity="0.8"/></radialGradient>'
            '<filter id="blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter>'
            '</defs>')


def dish(W, H, s):
    rng = random.Random(415)
    o = [f'<rect width="{W}" height="{H}" fill="url(#bg)"/>']
    for _ in range(int(160 * W * H / (1280 * 800))):
        o.append(f'<circle cx="{rng.uniform(0, W):.1f}" cy="{rng.uniform(0, H):.1f}" r="{rng.uniform(0.5, 1.3) * s:.1f}" '
                 f'fill="#9fc4de" opacity="{rng.uniform(0.08, 0.3):.2f}"/>')
    for _ in range(18):
        o.append(f'<circle cx="{rng.uniform(0, W):.1f}" cy="{rng.uniform(0, H):.1f}" r="{5 * s:.1f}" fill="#8dff6a" '
                 f'opacity="0.45" filter="url(#blur)"/>')
    cx, cy = W / 2, H / 2
    o.append(f'<circle cx="{cx}" cy="{cy}" r="{30 * s:.1f}" fill="url(#cell)" stroke="#a6f4ff" stroke-width="{1.5 * s:.1f}"/>')
    o.append(f'<circle cx="{cx}" cy="{cy}" r="{12 * s:.1f}" fill="none" stroke="{GOLD}" stroke-width="{2 * s:.1f}"/>')
    o.append(text(cx, cy + 5 * s, '5', 13 * s, TEXT, weight='bold', family=MONO))
    return ''.join(o)


def chrome(W, H, s):
    x, y, w = W - 16 * s - 240 * s, 16 * s, 240 * s
    o = [f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{50 * s:.1f}" rx="{6 * s:.1f}" fill="url(#card-bg)" stroke="{PANEL_RIM}"/>',
         text(x + 9 * s, y + 17 * s, 'LEADERBOARD', 11 * s, LABEL, anchor='start', tracking=0.08),
         text(x + w - 9 * s, y + 17 * s, 'TAB', 11 * s, LABEL, anchor='end', tracking=0.08),
         text(x + 9 * s, y + 40 * s, '1   Player', 14 * s, TEXT, anchor='start'),
         text(x + w - 9 * s, y + 40 * s, 'L5   312', 14 * s, TEXT, anchor='end', family=MONO),
         text(W - 16 * s, H - 30 * s, '4:34', 24 * s, TEXT, anchor='end', family=MONO),
         text(W - 16 * s, H - 16 * s, 'ROUND', 11 * s, LABEL, anchor='end', tracking=0.08)]
    return ''.join(o)


def option_label(s, option):
    return (f'<rect x="{16 * s:.1f}" y="{16 * s:.1f}" width="{400 * s:.1f}" height="{52 * s:.1f}" rx="{6 * s:.1f}" '
            f'fill="#050c17" fill-opacity="0.9" stroke="{ANNOT}" stroke-opacity="0.7"/>'
            + text(28 * s, 38 * s, option['title'], 16 * s, TEXT, anchor='start', weight='bold')
            + text(28 * s, 58 * s, option['sub'] + ' · mockup', 12 * s, LABEL, anchor='start'))


def band(W, H, s, option):
    cx, cy = W / 2, H / 2
    w, h = option['w'], option['h']
    o = [f'<rect width="{W}" height="{H}" fill="#000" opacity="0.55" mask="url(#spot-mask)"/>']
    title_top = cy + BAND_OFFSET[(W, H)]
    o.append(text(cx, title_top + 18.6 * s, 'LEVEL 5 · CHOOSE A TRAIT', 22 * s, GOLD, weight='bold'))
    bar_y = title_top + (TITLE_ROW + ROW_GAP) * s
    bar_x = cx - BAR_W * s / 2
    o.append(f'<rect x="{bar_x:.1f}" y="{bar_y:.1f}" width="{BAR_W * s:.1f}" height="{BAR_H * s:.1f}" fill="{PANEL_RIM}"/>')
    o.append(f'<rect x="{bar_x:.1f}" y="{bar_y:.1f}" width="{BAR_W * s * 0.65:.1f}" height="{BAR_H * s:.1f}" fill="{GOLD}"/>')
    o.append(text(bar_x + (BAR_W + 10) * s, bar_y + 9 * s, '6.5 s', 20 * s, TEXT, anchor='start', family=MONO))
    o.append(text(bar_x - 10 * s, bar_y + 6 * s, 'At 0 s the dish picks for you', 11 * s, MUTED, anchor='end'))
    cards_y = bar_y + (BAR_H + ROW_GAP) * s
    row_w = (3 * w + 2 * CARD_GAP) * s
    x0 = cx - row_w / 2
    # Notes stack in a column right of the card row, above the round clock; only the rightmost card gets a leader.
    notes = []
    overflow_heights = []
    for i, key in enumerate(option['cards']):
        x = x0 + i * (w + CARD_GAP) * s
        svg, hypo_mid, content_bottom, c = card(x, cards_y, w, h, s, key, i)
        o.append(svg)
        card_bottom = cards_y + h * s
        if hypo_mid is not None:
            notes.append(([c['note']], ANNOT, hypo_mid))
        if content_bottom > card_bottom + 0.5 * s:
            o.append(f'<line x1="{x:.1f}" y1="{card_bottom:.1f}" x2="{x + w * s:.1f}" y2="{card_bottom:.1f}" stroke="{DANGER}" '
                     f'stroke-width="{2 * s:.1f}"/>')
            overflow_heights.append(f'{h + (content_bottom - card_bottom) / s:.0f}')
    if overflow_heights:
        notes.append(([f'content {" and ".join(overflow_heights)} px', f'in a {h} px card (red line)'], DANGER, None))
    if cards_y + h * s > H + 0.5:
        below = (cards_y + h * s - H) / s
        notes.append(([f'cards end {below:.0f} px below', 'the screen, key chips cut'], DANGER, None))
    column_x = x0 + row_w + 24 * s
    line_y = cards_y + 28 * s
    for lines, colour, anchor_y in notes:
        if anchor_y is not None:
            o.append(f'<polyline points="{x0 + row_w + 3 * s:.1f},{anchor_y:.1f} {column_x - 6 * s:.1f},{line_y - 4 * s:.1f}" '
                     f'fill="none" stroke="{colour}" stroke-width="{1.5 * s:.1f}"/>')
        for line in lines:
            o.append(text(column_x, line_y, line, 12 * s, colour, anchor='start', weight='bold'))
            line_y += 16 * s
        line_y += 10 * s
    return ''.join(o)


def frame(W, H, option):
    s = min(1.5, W / 1280, H / 800)
    body = dish(W, H, s) + chrome(W, H, s) + band(W, H, s, option) + option_label(s, option)
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{defs(W, H, s)}{body}</svg>'


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, option in OPTIONS.items():
        for W, H in VIEWPORTS:
            path = out / f'{name}-{W}x{H}.svg'
            path.write_text(frame(W, H, option), encoding='utf-8')
            print('wrote', path)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
