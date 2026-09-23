#!/usr/bin/env node
// glyph-contact-sheet.mjs — the encyclopedia glyphs' contact sheets, reproducible (#457).
//
//   node scripts/glyph-contact-sheet.mjs [--url http://localhost:4402] [--out .qa/screenshots/glyph-sheet]
//
// Drives the running client's encyclopedia (the lobby's Encyclopedia button, no room needed) and captures every glyph
// as the page itself draws it: each list row's medallion at the real list size, and each landing tile's medallion at
// the card size. Nothing is re-rendered or scaled, so the list sheet is the 20 px the reader sees, not an enlargement
// (the #456 sheets measured 27 × 27). ImageMagick's `montage` then lays out:
//
//   list-sheet.png         every glyph at the list size, labelled with its entry id
//   list-silhouettes.png   the same in greyscale, where hue can no longer tell two marks apart
//   card-sheet.png         every glyph at the card size
//
// The browser is closed before the sheets are built (agent rule 9: an open game tab costs a core).
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const PLAYWRIGHT_MODULE = '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright';
const VIEWPORT = { width: 1280, height: 800 };
const CATEGORIES = ['basics', 'entities', 'evolutions', 'abilities', 'actions', 'world'];
const SETTLE_MS = 300;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
}

const url = option('url', 'http://localhost:4402');
const out = option('out', '.qa/screenshots/glyph-sheet');
const listDir = join(out, 'list');
const cardDir = join(out, 'card');
mkdirSync(listDir, { recursive: true });
mkdirSync(cardDir, { recursive: true });

const { chromium } = createRequire(import.meta.url)(PLAYWRIGHT_MODULE);

/** Every glyph under `selector` on the page, saved as `<dir>/<entry id>.png`; returns the ids in page order. */
async function captureGlyphs(page, selector, idAttribute, dir) {
  const ids = [];
  for (const holder of await page.locator(selector).all()) {
    const testId = (await holder.getAttribute(idAttribute)) ?? '';
    const entryId = testId.replace(/^encyclopedia-(row|tile)-/, '');
    const fileName = `${entryId.replace(/[:#]/g, '_')}.png`;
    await holder
      .locator('app-encyclopedia-glyph')
      .first()
      .screenshot({ path: join(dir, fileName) });
    ids.push({ entryId, fileName });
  }
  return ids;
}

const browser = await chromium.launch({ headless: true });
let listed = [];
let carded = [];
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.getByTestId('lobby-encyclopedia').click();
  for (const category of CATEGORIES) {
    await page.getByTestId(`encyclopedia-category-${category}`).click();
    await page.waitForTimeout(SETTLE_MS);
    listed = listed.concat(await captureGlyphs(page, '[data-testid^="encyclopedia-row-"]', 'data-testid', listDir));
    carded = carded.concat(await captureGlyphs(page, '[data-testid^="encyclopedia-tile-"]', 'data-testid', cardDir));
  }
} finally {
  await browser.close();
}

/** `montage` over the captures, each labelled with its entry id, at the captured size (`-geometry +gap+gap`). */
function sheet(dir, entries, target, extra = []) {
  const args = [];
  for (const { entryId, fileName } of entries) args.push('-label', entryId, join(dir, fileName));
  args.push('-geometry', '+6+6', '-tile', '8x', '-pointsize', '9', '-background', '#0b1626', '-fill', '#dfeaf2');
  execFileSync('montage', [...args, ...extra, join(out, target)]);
}

sheet(listDir, listed, 'list-sheet.png');
sheet(listDir, listed, 'list-silhouettes.png', ['-colorspace', 'Gray']);
sheet(cardDir, carded, 'card-sheet.png');
console.log(`${listed.length} list glyphs, ${carded.length} card glyphs -> ${out}`);
