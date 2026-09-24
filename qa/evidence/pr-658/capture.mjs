// Ticket #190 evidence: the stage toast and the connection banner's `stale` state, each at 1280 x 800, one
// player in front (a background tab stops acknowledging snapshots, and the server then stops sending them).
// Private stack 4500/4502, own Chromium, one process: `node qa/evidence/pr-658/capture.mjs`.
import pw from '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.js';
const { chromium } = pw;
const SERVER = 'http://127.0.0.1:4500';
const CLIENT = 'http://127.0.0.1:4502/';
const OUT = new URL('./', import.meta.url).pathname;
const EUKARYOTE = ['nucleoid', 'ribosomes', 'nuclear_envelope', 'cytoskeleton'];
const VIEWPORT = { width: 1280, height: 800 };

async function mcp(name, args) {
  const r = await fetch(`${SERVER}/debug-mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const t = await r.text();
  const d = JSON.parse(t.slice(t.indexOf('{')));
  const text = d.result?.content?.[0]?.text ?? JSON.stringify(d);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'],
});
const wait = (page, ms) => page.waitForTimeout(ms);
const click = (page, text) =>
  page.evaluate((label) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label && !x.disabled);
    if (b) b.click();
    return Boolean(b);
  }, text);
const toastOf = (page) =>
  page.evaluate(() => {
    const t = document.querySelector('[data-testid="toast"]');
    return t ? `${t.getAttribute('data-toast-kind')}: ${t.textContent.trim()}` : null;
  });

async function openPlayer() {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(CLIENT);
  await wait(page, 2500);
  console.log('connect', await click(page, 'Connect & Join Lobby'));
  await wait(page, 1000);
  return page;
}

const host = await openPlayer();
console.log('create', await click(host, 'Create'));
await wait(host, 1000);
console.log('start', await click(host, 'Start'));
await wait(host, 4000);

// The room with a player connected: an earlier run's room lingers, paused, with nobody in it.
let gameId = null;
let hostId = null;
for (const game of await mcp('debug_list_games', {})) {
  const room = await mcp('debug_get_room', { gameId: game.gameId });
  if ((room.connected ?? []).length > 0) [gameId, hostId] = [game.gameId, room.connected[0]];
}
console.log('game', gameId, 'host', hostId);

// Stage: the host becomes a eukaryote.
await mcp('debug_set_player', { gameId, playerId: hostId, level: 6, mass: 60, traits: EUKARYOTE });
await wait(host, 800);
console.log('stage toast:', await toastOf(host));
await host.screenshot({ path: `${OUT}toast-stage-1280x800.png` });

// Stale: the room stops broadcasting; after SNAPSHOT_STALE_MS the banner says so, and the dish dims with the toast (whose
// time is counted in room ticks) held, dimmed, under the banner's row.
console.log(await mcp('debug_pause_room', { gameId }));
await wait(host, 3000);
console.log(
  'banner:',
  await host.evaluate(() => {
    const b = document.querySelector('[data-testid="connection-banner"]');
    return b ? `${b.getAttribute('data-connection-state')}: ${b.textContent.trim()}` : null;
  }),
);
await host.screenshot({ path: `${OUT}banner-stale-1280x800.png` });

await browser.close();
