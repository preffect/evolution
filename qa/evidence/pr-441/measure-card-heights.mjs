// #415: measure the natural height of every catalog trait card at a given card width, in headless
// Chromium with the shipped card CSS and type scale. Usage: node measure-cards.mjs <cards.json> <width> [cssPath]
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [cardsPath, widthArg, cssPath] = process.argv.slice(2);
const CARD_WIDTH = Number(widthArg);
const CARD_HEIGHT = 214;
const cards = JSON.parse(readFileSync(cardsPath, 'utf8'));

// Two cards no shipped tier row produces, measured alongside the catalog because the cap is four lines.
const uniqueLines = [...new Set(cards.flatMap((card) => card.effects))].sort((a, b) => b.length - a.length);
const longestName = cards.reduce((a, b) => (b.name.length > a.name.length ? b : a)).name;
const hypothetical = (traitId, effects) => ({
  traitId,
  tier: 3,
  tierLabel: 'II → III',
  name: longestName,
  category: 'locomotion',
  rarity: 'uncommon',
  effects,
});
// The 4-line ceiling as the catalog could reach it: the longest name over four ordinary one-row lines.
cards.push(hypothetical('HYPOTHETICAL-4-ordinary-lines', uniqueLines.slice(-4)));
// The same card with the four longest lines in the catalog — three of them the Diatom Shell's paired
// spines line, which only one trait has one of. It does NOT fit, and no line count can tell you that:
// that is the case for #428's rendered-height guard, not an argument against the four-line cap.
cards.push(hypothetical('ADVERSARIAL-4-wrapping-lines', uniqueLines.slice(0, 4)));
const cardCss = readFileSync(cssPath, 'utf8');

const VARS = {
  '--hud-scale': '1',
  '--hud-picker-card-width': `${CARD_WIDTH}px`,
  '--hud-picker-card-height': `${CARD_HEIGHT}px`,
  '--hud-picker-card-content-gap': '2px',
  '--hud-picker-card-padding-block': '8px',
  '--hud-picker-card-padding-inline': '8px',
  '--hud-picker-medallion': '56px',
  '--hud-picker-card-lift': '8px',
  '--hud-picker-card-glow': '12px',
  '--hud-picker-highlight-duration': '120ms',
  '--hud-picker-ribbon-padding-inline': '6px',
  '--hud-leaderboard-corner-radius': '6px',
  '--hud-focus-ring': '2px',
  '--hud-panel-rim': '#173250',
  '--hud-panel-top': '#0e1f33',
  '--hud-panel-bottom': '#060e1a',
  '--hud-text': '#dfeaf2',
  '--hud-text-label': '#8fb3c9',
  '--hud-text-muted': '#7f93a8',
  '--hud-level-gold': '#ffe08a',
  '--hud-font-sans': 'Inter, "Segoe UI", system-ui, sans-serif',
  '--hud-type-caption': '11px',
  '--hud-type-card-name': '16px',
  '--hud-type-label': '12px',
};

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cardHtml = (c) => `
<button type="button" class="card" data-key="${escape(`${c.traitId} ${c.tierLabel}`)}">
  <div class="medallion"></div>
  <span class="category">${escape(c.category)}</span>
  <span class="name">${escape(c.name)} <span class="tier">${escape(c.tierLabel)}</span></span>
  ${c.effects.map((line) => `<span class="effect">${escape(line)}</span>`).join('\n  ')}
  <span class="rarity">${escape(c.rarity)}</span>
  <span class="key-chip" aria-hidden="true">1</span>
</button>`;

const html = `<!doctype html><meta charset="utf-8"><style>
  :root { ${Object.entries(VARS).map(([k, v]) => `${k}: ${v};`).join(' ')} }
  body { margin: 0; background: #04101c; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
  ${cardCss.replace(':host', '.unused-host')}
  /* Natural height, so every card reports how tall it wants to be, over or under the budget. */
  .card { height: auto !important; }
</style>${cards.map(cardHtml).join('\n')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.setContent(html);
const measured = await page.evaluate(() =>
  [...document.querySelectorAll('.card')].map((el) => ({ key: el.dataset.key, height: el.getBoundingClientRect().height })),
);
await browser.close();

const byKey = new Map(measured.map((m) => [m.key, m.height]));
const rows = cards.map((c) => ({
  key: `${c.traitId} ${c.tierLabel}`,
  lines: c.effects.length,
  height: byKey.get(`${c.traitId} ${c.tierLabel}`),
}));
rows.sort((a, b) => b.height - a.height);
console.log(`card width ${CARD_WIDTH}px, height budget ${CARD_HEIGHT}px, ${rows.length} cards`);
for (const r of rows) {
  console.log(`${r.height > CARD_HEIGHT ? 'OVERFLOW' : '   ok   '} ${String(r.height).padStart(6)}  ${r.lines} lines  ${r.key}`);
}
console.log(`tallest ${rows[0].height}px (${rows[0].key}); overflowing ${rows.filter((r) => r.height > CARD_HEIGHT).length}`);
