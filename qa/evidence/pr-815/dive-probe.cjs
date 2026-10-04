// perf-804 dive probe. node perf804-probe.cjs <mode fall|static> <gpu|sw> <dpr> [throttle] [port]
const { createRequire } = require('module');
const req = createRequire(process.env.CLIENT_DIR + '/package.json');
const { chromium } = req('@playwright/test');
const [mode = 'fall', gl = 'gpu', dprArg = '1', throttleArg = '1', portArg = '4532'] = process.argv.slice(2);
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

const INIT = () => {
  window.__dc = { calls: 0, contexts: 0 };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && (type === 'webgl2' || type === 'webgl') && !ctx.__wrapped && this.isConnected !== undefined) {
      ctx.__wrapped = true;
      window.__dc.contexts += 1;
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const f = ctx[name];
        if (!f) continue;
        ctx[name] = function (...a) {
          window.__dc.calls += 1;
          return f.apply(this, a);
        };
      }
    }
    return ctx;
  };
  window.__long = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__long.push({ t: e.startTime, d: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: gl === 'gpu' ? GPU_ARGS : SW_ARGS });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  await page.addInitScript(INIT);
  const cdp = await context.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const t0 = Date.now();
  await page.goto(`http://localhost:${portArg}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('app-dive-panel canvas', { timeout: 120000 });
  const renderer = await page.evaluate(() => {
    const c = document.querySelector('app-dive-panel canvas');
    const g = c.getContext('webgl2');
    const e = g && g.getExtension('WEBGL_debug_renderer_info');
    return { r: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', w: c.width, h: c.height };
  });
  console.error('renderer', JSON.stringify(renderer));
  // Recorder: every rAF, the time, the panel's zoom, draw calls since the last, the governor's scale if exposed.
  await page.evaluate(() => {
    const panel = window.ng.getComponent(document.querySelector('app-dive-panel'));
    window.__panel = panel;
    window.__rec = [];
    let last = window.__dc.calls;
    const loop = (t) => {
      const f = panel.frame?.() ?? null;
      const calls = window.__dc.calls;
      window.__rec.push({
        t,
        z: f ? f.view.camera.zoom : null,
        playing: f ? f.isPlaying : false,
        arrived: f ? f.hasArrived : false,
        dc: calls - last,
        gov: f && f.view.deviceRatio !== undefined ? Math.round(f.view.deviceRatio * 100) / 100 : null,
      });
      last = calls;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const out = { mode, gl, dpr, throttle, W, H, renderer };
  if (mode === 'fall') {
    // Wait for the fall to arrive (autoplay), at most FALL_TIMEOUT s.
    const limit = Number(process.env.FALL_TIMEOUT || 900) * 1000;
    const started = Date.now();
    for (;;) {
      await page.waitForTimeout(5000);
      const st = await page.evaluate(() => {
        const r = window.__rec;
        const l = r[r.length - 1];
        return { n: r.length, z: l && l.z, playing: l && l.playing, arrived: r.some((x) => x.arrived) };
      });
      console.error(Math.round((Date.now() - started) / 1000) + 's', JSON.stringify(st));
      if (st.arrived) break;
      if (Date.now() - started > limit) throw new Error('fall did not arrive');
    }
    await page.waitForTimeout(500);
    const rec = await page.evaluate(() => window.__rec);
    const longs = await page.evaluate(() => window.__long);
    const playStart = rec.findIndex((r) => r.playing);
    const arrive = rec.findIndex((r) => r.arrived);
    const fall = rec.slice(playStart, arrive + 1);
    out.loadToPlayS = r1((rec[playStart].t - rec[0].t) / 1000);
    out.fallS = r1((rec[arrive].t - rec[playStart].t) / 1000);
    const per = {};
    let holdMs = 0,
      holdFrames = 0;
    for (let i = 1; i < fall.length; i += 1) {
      const a = fall[i - 1],
        b = fall[i];
      if (b.z === null) continue;
      const band = bandOf(b.z);
      const p = (per[band] ??= { gaps: [], dc: [], govs: [] });
      p.gaps.push(b.t - a.t);
      p.dc.push(b.dc);
      if (b.gov) p.govs.push(b.gov);
      // A hold: the zoom did not move by more than a hair over a frame while falling (past the opening's 700 ms hold).
      if (
        Math.abs(b.z - a.z) < 1e-4 &&
        Math.abs(b.z - fall[0].z) > 0.05 &&
        Math.abs(b.z - fall[fall.length - 1].z) > 0.05
      ) {
        holdMs += b.t - a.t;
        holdFrames += 1;
      }
    }
    out.holdMs = Math.round(holdMs);
    out.holdFrames = holdFrames;
    const fallT0 = fall[0].t,
      fallT1 = fall[fall.length - 1].t;
    const inFall = longs.filter((l) => l.t >= fallT0 && l.t <= fallT1);
    out.longestTaskFallMs = Math.round(Math.max(0, ...inFall.map((l) => l.d)));
    out.longestTaskAllMs = Math.round(Math.max(0, ...longs.map((l) => l.d)));
    out.bands = Object.fromEntries(
      Object.entries(per).map(([k, p]) => {
        const longsBand = inFall.filter((l) => {
          const i = fall.findIndex((r) => r.t >= l.t);
          return i >= 0 && fall[i].z !== null && bandOf(fall[i].z) === k;
        });
        return [
          k,
          {
            frames: p.gaps.length,
            p50: r1(pct(p.gaps, 0.5)),
            p95: r1(pct(p.gaps, 0.95)),
            max: r1(Math.max(...p.gaps)),
            fps: r1((1000 * p.gaps.length) / p.gaps.reduce((s, x) => s + x, 0)),
            dcP50: pct(p.dc, 0.5),
            dcMax: Math.max(...p.dc),
            longMs: Math.round(Math.max(0, ...longsBand.map((l) => l.d))),
            gov: p.govs.length
              ? [Math.min(...p.govs.map((g) => g.scale ?? g)), Math.max(...p.govs.map((g) => g.scale ?? g))]
              : null,
          },
        ];
      }),
    );
    if (process.env.SAVE_REC)
      require('fs').writeFileSync(process.env.SAVE_REC, JSON.stringify({ fall, longs: inFall }));
  } else {
    // Static: wait for the fall to arrive, then per zoom: held rAF gaps over HOLD_MS and flushed probe frames.
    await page.waitForFunction(() => window.__rec.some((r) => r.arrived), null, { timeout: 900000, polling: 500 });
    const zooms = (process.env.ZOOMS || '6,3,1,0.3,-0.6,-1.3,-1.7,-2.1,-2.3,-2.8,-3.3,-3.9,-4.2,-4.5')
      .split(',')
      .map(Number);
    const holdMs = Number(process.env.HOLD_MS || 3000);
    out.zooms = [];
    for (const z of zooms) {
      const row = await page.evaluate(
        async ({ z, holdMs }) => {
          const panel = window.__panel;
          panel.handle.scrub(z);
          await new Promise((r) => setTimeout(r, 600));
          const start = window.__rec.length;
          await new Promise((r) => setTimeout(r, holdMs));
          const rec = window.__rec.slice(start);
          const gaps = rec.slice(1).map((r, i) => r.t - rec[i].t);
          const dcs = rec.map((r) => r.dc);
          // Flushed: 10 frames back to back then a pixel read back, three times, the median.
          const c = document.querySelector('app-dive-panel canvas');
          const g = c.getContext('webgl2');
          const px = new Uint8Array(4);
          const flushed = [];
          let script = null;
          for (let k = 0; k < 3; k += 1) {
            const t = performance.now();
            script = panel.handle.probeFrames(z, 10);
            g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
            flushed.push((performance.now() - t) / 10);
          }
          flushed.sort((a, b) => a - b);
          const fr = panel.frame();
          const gov = fr && fr.view.deviceRatio;
          return { z, gaps, dcs, flushed: flushed[1], script, gov };
        },
        { z, holdMs },
      );
      const s = row.script;
      const scriptMs = s ? s.upperBandsMs + s.planetMs + s.shoreMs + s.kelpMs + s.slimeMs + s.dishMs + s.submitMs : NaN;
      out.zooms.push({
        z,
        p50: r1(pct(row.gaps, 0.5)),
        p95: r1(pct(row.gaps, 0.95)),
        fps: r1((1000 * row.gaps.length) / row.gaps.reduce((a, b) => a + b, 0)),
        dc: pct(row.dcs, 0.5),
        flushedMs: r1(row.flushed),
        scriptMs: r1(scriptMs),
        gov: row.gov,
      });
      console.error(JSON.stringify(out.zooms[out.zooms.length - 1]));
    }
  }
  out.contexts = await page.evaluate(() => window.__dc.contexts);
  out.totalS = r1((Date.now() - t0) / 1000);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
