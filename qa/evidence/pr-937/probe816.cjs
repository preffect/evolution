// Ticket #816's probe (PR #937): node probe816.cjs <gpu|sw> <dpr> [cpu throttle] [port], with
// CLIENT_DIR=<packages/client>; runset.sh runs a list of scenarios. Records every animation frame (time, zoom, canvas
// ratio) and the governor's feed, prints the fall's per-band fps and ratio, then each held zoom's (ZOOMS, HOLD_MS).
// Needs temporary hooks, never in the PR: temp-hooks.patch (window.__diveHeavy: a full-canvas filter of HEAVY
// iterations, fill-bound like a slower GPU; window.__govFeed: each frame the governor hears; window.__diveK: scales the
// dive's DPR caps), and for main's behaviour (OFF=1) one line at the top of `judgeSpan` in
// dive-resolution-governor.ts, `if (globalThis.__gov816Off) return;`, with `probeFailMs` read as 2000 when it is set.
// Options (env): VW, VH (viewport); ZOOMS held after arrival for HOLD_MS each; SAVE=<file> keeps every rAF and the
// governor's feed; FALL=0 skips waiting for the autoplay fall; HEAVY=<iterations>; OFF=1; K=<DPR cap scale>;
// SWEEP=<iterations,...> at zoom ZS to calibrate the filter.
const os = require('os');
const { createRequire } = require('module');
const req = createRequire(process.env.CLIENT_DIR + '/package.json');
const { chromium } = req('@playwright/test');
const [gl = 'gpu', dprArg = '1', throttleArg = '1', portArg = '4502'] = process.argv.slice(2);
const dpr = Number(dprArg),
  throttle = Number(throttleArg);
const W = Number(process.env.VW || 1280),
  H = Number(process.env.VH || 800);
const GPU_ARGS = ['--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-gpu'];
const SW_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const BANDS = [
  ['planet', 4.4],
  ['shore', 0.35],
  ['kelp+drop', -1.95],
  ['slime', -3.7],
  ['dish', -99],
];
const bandOf = (z) => BANDS.find(([, low]) => z >= low)[0];
const pct = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const fpsOf = (gaps) => r1((1000 * gaps.length) / gaps.reduce((s, x) => s + x, 0));
const load = () => os.loadavg().map(r2);

(async () => {
  const browser = await chromium.launch({ headless: true, args: gl === 'gpu' ? GPU_ARGS : SW_ARGS });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  if (process.env.HEAVY)
    await page.addInitScript((n) => {
      window.__diveHeavy = n;
    }, Number(process.env.HEAVY));
  if (process.env.OFF === '1')
    await page.addInitScript(() => {
      window.__gov816Off = true;
    });
  if (process.env.K)
    await page.addInitScript((k) => {
      window.__diveK = k;
    }, Number(process.env.K));
  page.on('console', (m) => {
    if (m.type() === 'error' && process.env.CONSOLE) console.error('console', m.text().slice(0, 300));
  });
  const cdp = await context.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const out = { gl, dpr, throttle, W, H, loadStart: load() };
  await page.goto(`http://localhost:${portArg}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('app-dive-panel canvas', { timeout: 120000 });
  out.renderer = await page.evaluate(() => {
    const c = document.querySelector('app-dive-panel canvas');
    const g = c.getContext('webgl2');
    const e = g && g.getExtension('WEBGL_debug_renderer_info');
    return { r: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', css: [c.clientWidth, c.clientHeight] };
  });
  await page.evaluate(() => {
    const panel = window.ng.getComponent(document.querySelector('app-dive-panel'));
    window.__panel = panel;
    window.__rec = [];
    const loop = (t) => {
      const f = panel.frame?.() ?? null;
      window.__rec.push([
        t,
        f ? f.view.camera.zoom : null,
        f && f.isPlaying ? 1 : 0,
        f && f.hasArrived ? 1 : 0,
        f ? f.view.deviceRatio : null,
        document.querySelector('app-dive-panel canvas')?.width,
      ]);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  if (process.env.FALL !== '0') {
    const started = Date.now();
    for (;;) {
      await page.waitForTimeout(3000);
      const arrived = await page.evaluate(() => window.__rec.some((r) => r[3]));
      if (arrived) break;
      if (Date.now() - started > 600000) throw new Error('fall did not arrive');
    }
    await page.waitForTimeout(300);
    const rec = await page.evaluate(() => window.__rec);
    const playStart = rec.findIndex((r) => r[2]);
    const arrive = rec.findIndex((r) => r[3]);
    const fall = rec.slice(playStart, arrive + 1);
    out.loadToPlayS = r1((rec[playStart][0] - rec[0][0]) / 1000);
    out.fallS = r1((rec[arrive][0] - rec[playStart][0]) / 1000);
    const per = {};
    for (let i = 1; i < fall.length; i += 1) {
      const b = fall[i];
      if (b[1] === null) continue;
      const p = (per[bandOf(b[1])] ??= { gaps: [], govs: [] });
      p.gaps.push(b[0] - fall[i - 1][0]);
      if (b[4]) p.govs.push(b[4]);
    }
    out.fall = Object.fromEntries(
      Object.entries(per).map(([k, p]) => [
        k,
        {
          n: p.gaps.length,
          fps: fpsOf(p.gaps),
          p50: r1(pct(p.gaps, 0.5)),
          p95: r1(pct(p.gaps, 0.95)),
          gov: [r2(Math.min(...p.govs)), r2(Math.max(...p.govs))],
        },
      ]),
    );
    out.loadAfterFall = load();
  } else {
    await page.waitForFunction(() => window.__panel.frame?.() != null, null, { timeout: 300000 });
    await page.waitForTimeout(Number(process.env.SETTLE_MS || 30000));
  }
  if (process.env.SWEEP) {
    out.sweep = [];
    await page.evaluate((z) => window.__panel.handle.scrub(z), Number(process.env.ZS || -4.3));
    for (const n of process.env.SWEEP.split(',').map(Number)) {
      const i0 = await page.evaluate((n) => {
        window.__diveHeavy = n;
        return window.__rec.length;
      }, n);
      await page.waitForTimeout(4000);
      const rec = await page.evaluate((i) => window.__rec.slice(i), i0);
      const gaps = rec.slice(1).map((r, i) => r[0] - rec[i][0]);
      const row = {
        n,
        fps: fpsOf(gaps),
        p50: r1(pct(gaps, 0.5)),
        p10: r1(pct(gaps, 0.1)),
        p90: r1(pct(gaps, 0.9)),
        gov: [r2(rec[0][4]), r2(rec[rec.length - 1][4])],
      };
      out.sweep.push(row);
      console.error(JSON.stringify(row));
    }
  }
  const zooms = (process.env.ZOOMS || '').split(',').filter(Boolean).map(Number);
  const holdMs = Number(process.env.HOLD_MS || 20000);
  out.holds = [];
  for (const z of zooms) {
    const startIdx = await page.evaluate((z) => {
      window.__panel.handle.scrub(z);
      return window.__rec.length;
    }, z);
    await page.waitForTimeout(holdMs);
    const rec = (await page.evaluate((i) => window.__rec.slice(i), startIdx)).filter((r) => r[1] !== null);
    const t0 = rec[0][0];
    const gaps = rec.slice(1).map((r, i) => [r[0] - t0, r[0] - rec[i][0], r[4]]);
    const last5 = gaps.filter((g) => g[0] > holdMs - 5000).map((g) => g[1]);
    const first3 = gaps.filter((g) => g[0] <= 3000).map((g) => g[1]);
    const changes = [];
    let prev = rec[0][4];
    for (const r of rec) {
      if (r[4] !== prev) changes.push([r1((r[0] - t0) / 1000), r2(r[4])]);
      prev = r[4];
    }
    const row = {
      z,
      govStart: r2(rec[0][4]),
      fpsFirst3s: fpsOf(first3),
      fpsLast5s: fpsOf(last5),
      p50Last5: r1(pct(last5, 0.5)),
      govEnd: r2(rec[rec.length - 1][4]),
      canvasW: rec[rec.length - 1][5],
      changes,
      load: load(),
    };
    out.holds.push(row);
    console.error(JSON.stringify(row));
  }
  if (process.env.SAVE)
    require('fs').writeFileSync(
      process.env.SAVE,
      JSON.stringify({
        rec: await page.evaluate(() => window.__rec),
        feed: await page.evaluate(() => window.__govFeed),
      }),
    );
  out.loadEnd = load();
  console.log(JSON.stringify(out));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
