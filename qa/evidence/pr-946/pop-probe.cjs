// Ticket #817 probe: node pop-probe.cjs <fall|scrub> <gpu|sw> <port> <outdir> [runTag]
// fall: fresh load, the autoplay's fall, stage shots taken back to back while the zoom is in 5.6–6.8.
// scrub: after arrival, stage shots at fixed zooms.
const { createRequire } = require('module');
const req = createRequire(process.env.CLIENT_DIR + '/package.json');
const { chromium } = req('@playwright/test');
const fs = require('fs');
const [mode, gl, port, out, tag = 'r'] = process.argv.slice(2);
const GPU_ARGS = ['--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-gpu'];
const SW_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: gl === 'gpu' ? GPU_ARGS : SW_ARGS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: Number(process.env.DPR || 1),
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('app-dive-panel canvas', { timeout: 120000 });
  const renderer = await page.evaluate(() => {
    const g = document.querySelector('app-dive-panel canvas').getContext('webgl2');
    const e = g.getExtension('WEBGL_debug_renderer_info');
    return g.getParameter(e.UNMASKED_RENDERER_WEBGL);
  });
  console.error('renderer', renderer);
  const zoomOf = () =>
    page.evaluate(() => {
      const f = window.ng.getComponent(document.querySelector('app-dive-panel')).frame();
      return f
        ? { z: f.view.camera.zoom, playing: f.isPlaying, arrived: f.hasArrived, ratio: f.view.deviceRatio }
        : null;
    });
  const stage = page.locator('app-dive-panel .stage');
  if (mode === 'fall') {
    const shots = [];
    const started = Date.now();
    for (;;) {
      const s = await zoomOf();
      if (s && s.z < 5.6) break;
      if (Date.now() - started > 600000) throw new Error('timeout');
      if (s && s.z <= 6.8) {
        const before = s.z;
        const file = `${out}/${tag}-${gl}-z${before.toFixed(3)}.png`;
        await stage.screenshot({ path: file });
        const after = (await zoomOf()).z;
        shots.push({ file, before, after, ratio: s.ratio });
      } else {
        await page.waitForTimeout(30);
      }
    }
    console.log(JSON.stringify({ renderer, shots }, null, 1));
  } else {
    await page.waitForFunction(
      () => window.ng.getComponent(document.querySelector('app-dive-panel')).frame()?.hasArrived,
      null,
      { timeout: 600000, polling: 250 },
    );
    await page.waitForTimeout(2000);
    const zooms = (process.env.ZOOMS || '6.6,6.5,6.4,6.3,6.2,6.1,6.0,5.9,5.8,5.7').split(',').map(Number);
    for (const z of zooms) {
      await page.locator('#dive-zoom').evaluate(
        (el, v) => {
          el.value = String(v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        },
        Math.round((7.4 - z) * 1000) / 1000,
      );
      await page.waitForTimeout(Number(process.env.SETTLE || 2500));
      const s = await zoomOf();
      await stage.screenshot({ path: `${out}/${tag}-${gl}-scrub-z${z.toFixed(2)}.png` });
      console.error(z, JSON.stringify(s));
    }
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
