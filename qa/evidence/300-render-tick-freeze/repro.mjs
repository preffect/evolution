import pw from '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.js';
const { chromium } = pw;
const SERVER = 'http://127.0.0.1:4500';
const STEP = Number(process.env.STEP ?? 89);
const MODE = process.env.MODE ?? 'step';
async function mcp(name, args) {
  const r = await fetch(`${SERVER}/debug-mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const t = await r.text();
  const d = JSON.parse(t.slice(t.indexOf('{')));
  return d.result?.content?.[0]?.text ?? JSON.stringify(d);
}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
const click = (t) =>
  page.evaluate((text) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text);
    if (b) b.click();
    return Boolean(b);
  }, t);
await page.goto('http://127.0.0.1:4502/');
await page.waitForTimeout(1500);
await click('Connect & Join Lobby');
await page.waitForTimeout(800);
await click('Create');
await page.waitForTimeout(800);
await click('Start');
await page.waitForTimeout(3000);
const games = JSON.parse(await mcp('debug_list_games', {}));
let gameId = null;
for (const g of games.games ?? games) {
  const id = g.gameId ?? g.id;
  const room = JSON.parse(await mcp('debug_get_room', { gameId: id }));
  if ((room.connected ?? []).length > 0) gameId = id;
}
const serverTick = async () => {
  const s = JSON.parse(await mcp('debug_get_room', { gameId }));
  return s.tick ?? s.tickCount ?? s.room?.tick;
};
const probe = async (label) => {
  const c = await page.evaluate(() => ({
    r: window.__evolutionDebug?.renderTick(),
    f: window.__evolutionDebug?.framesRendered(),
  }));
  console.log(label, JSON.stringify(c));
};
console.log('game', gameId);
await probe('live');
await mcp('debug_pause_room', { gameId });
await page.waitForTimeout(1500);
await probe('paused');
if (MODE === 'step') {
  console.log(await mcp('debug_step_room', { gameId, ticks: STEP }));
} else if (MODE === 'stall') {
  await mcp('debug_resume_room', { gameId });
  await page.waitForTimeout(1000);
  await probe('running');
  await page.evaluate(() => {
    const end = performance.now() + 2500;
    while (performance.now() < end) {
      /* stall ingest */
    }
  });
  await probe('after stall');
} else {
  await mcp('debug_resume_room', { gameId });
}
for (let i = 0; i < 6; i += 1) {
  await page.waitForTimeout(1000);
  await probe(`after+${i + 1}s`);
}
if (MODE === 'step') {
  await mcp('debug_resume_room', { gameId });
  for (let i = 0; i < 4; i += 1) {
    await page.waitForTimeout(1000);
    await probe(`resumed+${i + 1}s`);
  }
}
console.log((await mcp('debug_get_room', { gameId })).slice(0, 600));
await browser.close();
