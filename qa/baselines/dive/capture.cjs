// gqa-815b: dive baselines on the GPU, DPR 1. node capture.cjs <port> <outdir>
const { createRequire } = require('module');
const req = createRequire(process.env.CLIENT_DIR + '/package.json');
const { chromium } = req('@playwright/test');
const [port, out] = process.argv.slice(2);
const GPU_ARGS = ['--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-gpu'];
const SHOTS = [
  {
    vw: 1280,
    vh: 800,
    tag: '1280',
    zooms: [7.3, 4.0, 1.5, -0.3, -2.8, -3.6, -3.9, -4.05, -4.1, -4.3, -4.6, -5.2, -5.6],
  },
  { vw: 1024, vh: 640, tag: '1024', zooms: [7.3] },
  { vw: 390, vh: 844, tag: 'phone390', zooms: [-3.9] },
  { vw: 390, vh: 844, tag: 'phone390', zooms: [-4.3], whole: true },
];
const name = (tag, z) => `dive-${tag}-z${Number.isInteger(z) ? z.toFixed(1) : String(z)}.png`;
(async () => {
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
  for (const shot of SHOTS) {
    const context = await browser.newContext({ viewport: { width: shot.vw, height: shot.vh }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('app-dive-panel canvas', { timeout: 120000 });
    const renderer = await page.evaluate(() => {
      const g = document.querySelector('app-dive-panel canvas').getContext('webgl2');
      const e = g.getExtension('WEBGL_debug_renderer_info');
      return g.getParameter(e.UNMASKED_RENDERER_WEBGL);
    });
    console.error(shot.tag, renderer);
    await page.waitForFunction(
      () => window.ng.getComponent(document.querySelector('app-dive-panel')).frame()?.hasArrived,
      null,
      { timeout: 300000, polling: 250 },
    );
    await page.waitForTimeout(3000);
    for (const z of shot.zooms) {
      const slider = page.locator('#dive-zoom');
      await slider.evaluate(
        (el, v) => {
          el.value = String(v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        },
        Math.round((7.4 - z) * 1000) / 1000,
      );
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => {
        const f = window.ng.getComponent(document.querySelector('app-dive-panel')).frame();
        return { z: f.view.camera.zoom, ratio: f.view.deviceRatio };
      });
      const target = shot.whole ? page.locator('app-dive-panel') : page.locator('app-dive-panel .stage');
      await target.screenshot({ path: `${out}/${name(shot.tag, z)}` });
      console.error(name(shot.tag, z), JSON.stringify(info));
    }
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
