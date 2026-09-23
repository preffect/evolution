import pw from '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.js';
const { chromium } = pw;
const URL = 'http://127.0.0.1:4502/';
const FLIPS = Number(process.env.FLIPS ?? 6);
const W = Number(process.env.W ?? 320), H = Number(process.env.H ?? 200);

const browser = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const click = (t) => page.evaluate((text) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text);
  if (b) b.click();
  return Boolean(b);
}, t);
await page.goto(URL);
await page.waitForTimeout(1500);
await click('Connect & Join Lobby');
await page.waitForTimeout(800);
await click('Create');
await page.waitForTimeout(800);
await click('Start');
await page.waitForTimeout(4000);
const canvas = await page.$('canvas');
const box = await canvas.boundingBox();
const cy = box.y + box.height / 2;
const right = box.x + box.width * 0.9, left = box.x + box.width * 0.1;
await page.mouse.move(right, cy);
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.__samples = [];
  const loop = () => {
    const api = window.__evolutionDebug;
    const p = api?.prediction?.();
    const input = api?.input?.()?.lastSentInput;
    window.__samples.push({ t: performance.now(), d: p?.displayed?.x ?? null, i: p?.interpolated?.x ?? null, seq: input?.sequence, tx: input?.targetX, own: p?.displayed?.x });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
const flips = [];
let toLeft = true;
for (let n = 0; n < FLIPS; n += 1) {
  await page.waitForTimeout(1800);
  const t0 = await page.evaluate(() => performance.now());
  await page.mouse.move(toLeft ? left : right, cy);
  flips.push({ t0, sign: toLeft ? -1 : 1 });
  toLeft = !toLeft;
}
await page.waitForTimeout(1800);
const samples = await page.evaluate(() => window.__samples);
await browser.close();

// Per flip: the time from the pointer move until each series' velocity reverses sign.
const velocity = (key) => samples.slice(1).map((s, k) => ({ t: s.t, v: s[key] === null || samples[k][key] === null ? null : (s[key] - samples[k][key]) / (s.t - samples[k].t) }));
const frameMs = (samples.at(-1).t - samples[0].t) / samples.length;
const result = { framesMs: frameMs.toFixed(1), flips: [] };
for (const { t0, sign } of flips) {
  const row = {};
  for (const key of ['d', 'i']) {
    const hit = velocity(key).find((s) => s.t > t0 && s.v !== null && s.v * sign > 0);
    row[key === 'd' ? 'predictedMs' : 'interpolatedMs'] = hit ? Math.round(hit.t - t0) : null;
    // Onset: the first frame the cell's speed along the old heading falls below 90 % of its steady value.
    const before = velocity(key).filter((s) => s.t > t0 - 400 && s.t <= t0 && s.v !== null);
    const steady = before.reduce((a, s) => a + s.v, 0) / Math.max(1, before.length);
    const onset = velocity(key).find((s) => s.t > t0 && s.v !== null && Math.abs(steady) > 1e-6 && s.v / steady < 0.9);
    row[key === 'd' ? 'predictedOnsetMs' : 'interpolatedOnsetMs'] = onset ? Math.round(onset.t - t0) : null;
  }
  result.flips.push(row);
}
const median = (xs) => { const s = xs.filter((x) => x !== null).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
result.medianPredictedMs = median(result.flips.map((f) => f.predictedMs));
result.medianInterpolatedMs = median(result.flips.map((f) => f.interpolatedMs));
result.medianPredictedOnsetMs = median(result.flips.map((f) => f.predictedOnsetMs));
result.medianInterpolatedOnsetMs = median(result.flips.map((f) => f.interpolatedOnsetMs));
console.log(JSON.stringify(result));
