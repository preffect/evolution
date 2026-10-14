// recover.cjs <port> <dpr> <loadIters> <loadMs> <zoom> <tag>: holds the dive at <zoom>, runs a second GPU page for
// loadMs, then watches the ratio come back; screenshots the dive canvas at each distinct ratio.
// graphics-qa, PR #937. Paths below are the reviewer's (OUT, loader.html, CLIENT_DIR): edit before reuse.
const os = require('os'),
  fs = require('fs');
const { createRequire } = require('module');
const req = createRequire('/workspace/.worktrees/fix/816-governor-slightly-slow-gpu/packages/client/package.json');
const { chromium } = req('@playwright/test');
const [port, dprA, itersA, loadMsA, zoomA, tag] = process.argv.slice(2);
const GPU_ARGS = ['--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-gpu'];
const load = () => os.loadavg().map((x) => Math.round(x * 100) / 100);
const OUT = '/home/vscode/.claude/jobs/c391c4f2/tmp/runs/';
(async () => {
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: Number(dprA) });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('app-dive-panel canvas', { timeout: 120000 });
  await page.evaluate(() => {
    const panel = window.ng.getComponent(document.querySelector('app-dive-panel'));
    window.__panel = panel;
    window.__rec = [];
    const loop = (t) => {
      const f = panel.frame?.() ?? null;
      window.__rec.push([t, f ? f.view.camera.zoom : null, f && f.hasArrived ? 1 : 0, f ? f.view.deviceRatio : null]);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  for (;;) {
    await page.waitForTimeout(2000);
    if (await page.evaluate(() => window.__rec.some((r) => r[2]))) break;
  }
  const ev = { tag, loadStart: load(), marks: {} };
  const mark = async (k) => {
    ev.marks[k] = await page.evaluate(() => performance.now());
  };
  await page.evaluate((z) => window.__panel.handle.scrub(z), Number(zoomA));
  await page.waitForTimeout(8000);
  await mark('baseline');
  const shots = {};
  const shot = async (label) => {
    const r = await page.evaluate(() => window.__rec.at(-1)[3]);
    const name = `${tag}-${label}-r${r.toFixed(2)}.png`;
    await page.locator('app-dive-panel canvas').screenshot({ path: OUT + name });
    shots[label] = name;
  };
  await shot('before');
  const lb = await chromium.launch({ headless: true, args: GPU_ARGS });
  const lp = await (await lb.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await lp.goto('file:///home/vscode/.claude/jobs/c391c4f2/tmp/loader.html#' + itersA);
  await mark('loadOn');
  await page.waitForTimeout(Number(loadMsA) - 3000);
  await shot('loaded');
  await page.waitForTimeout(3000);
  ev.loaderFrames = await lp.evaluate(() => window.frames);
  await lb.close();
  await mark('loadOff');
  ev.loadAtOff = load();
  await page.waitForTimeout(70000);
  await shot('after');
  await mark('end');
  const rec = await page.evaluate(() => window.__rec);
  const t0 = ev.marks.baseline;
  const seg = rec.filter((r) => r[0] >= t0);
  ev.changes = [];
  let prev = seg[0][3];
  for (const r of seg) {
    if (r[3] !== prev)
      ev.changes.push([Math.round((r[0] - ev.marks.loadOff) / 100) / 10, Math.round(r[3] * 1000) / 1000]);
    prev = r[3];
  }
  const fps = (a, b) => {
    const s = rec.filter((r) => r[0] >= a && r[0] < b);
    return Math.round(((s.length - 1) * 10000) / (s.at(-1)[0] - s[0][0])) / 10;
  };
  ev.fpsBaseline = fps(t0, ev.marks.loadOn);
  ev.fpsLoaded = fps(ev.marks.loadOn, ev.marks.loadOff);
  ev.fpsAfter = fps(ev.marks.loadOff, ev.marks.end);
  ev.shots = shots;
  ev.loadEnd = load();
  fs.writeFileSync(OUT + 'rec-' + tag + '.json', JSON.stringify({ marks: ev.marks, rec }));
  console.log(JSON.stringify(ev));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
