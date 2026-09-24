// Ticket #192 evidence: the amoeba form at rest (three moments of its lobe cycle), swimming, and reaching for prey,
// beside a plain eukaryote for comparison. Private stack 4590/4592, own Chromium, one process.
import pw from '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.js';
const { chromium } = pw;
const SERVER = 'http://127.0.0.1:4590';
const CLIENT = 'http://127.0.0.1:4592/';
const OUT = new URL('../screenshots/', import.meta.url).pathname;
const AMOEBA = ['nucleoid', 'ribosomes', 'nuclear_envelope', 'cytoskeleton', 'amoeba_pseudopods'];
const PLAIN = ['nucleoid', 'ribosomes', 'nuclear_envelope', 'cytoskeleton'];

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
const json = async (name, args) => {
  const text = await mcp(name, args);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name}: ${text}`);
  }
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) console.log('console error:', m.text().slice(0, 200));
});
const click = (t) =>
  page.evaluate((text) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text);
    if (b) b.click();
    return Boolean(b);
  }, t);
const renderTick = () => page.evaluate(() => window.__evolutionDebug?.renderTick() ?? -1);
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(CLIENT);
await wait(2500);
await page.evaluate(() => localStorage.clear());
await page.reload();
await wait(2500);
console.log('join', await click('Connect & Join Lobby'));
await wait(1000);
console.log('create', await click('Create'));
await wait(1000);
console.log('start', await click('Start'));
await wait(4000);

const games = await json('debug_list_games', {});
let gameId = null;
let ownId = null;
for (const g of games) {
  const room = await json('debug_get_room', { gameId: g.gameId });
  if ((room.connected ?? []).length > 0) {
    gameId = g.gameId;
    ownId = room.connected[0];
  }
}
const cellOf = async (playerId) => (await json('debug_get_entities', { gameId, kind: 'cell' })).find((c) => c.playerId === playerId);
const ownCell = await cellOf(ownId);
const cx = ownCell.x;
const cy = ownCell.y;
console.log('game', gameId, 'own', ownId, 'at', cx, cy);

await json('debug_set_player', { gameId, playerId: ownId, mass: 40, level: 6, traits: AMOEBA, position: { x: cx, y: cy } });
const plainBot = await json('debug_spawn_bot', { gameId, behavior: 'idle', seed: 3 });
const plainId = plainBot.playerId ?? plainBot.id;
await json('debug_set_player', { gameId, playerId: plainId, mass: 40, level: 6, traits: PLAIN, position: { x: cx - 95, y: cy } });
console.log('bots', plainId);

async function catchUp(label) {
  const tick = (await json('debug_get_game_state', { gameId })).snapshot.tick;
  for (let i = 0; i < 60 && (await renderTick()) < tick; i += 1) await wait(250);
  await wait(600);
  return tick;
}
async function shot(name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('shot', name, await renderTick());
}

// Let the camera settle on the new mass, then freeze.
await wait(6000);
await json('debug_pause_room', { gameId });
await catchUp('rest');
await shot('gd192-rest-a');
for (const suffix of ['b', 'c']) {
  await json('debug_step_room', { gameId, ticks: 60 });
  await catchUp(suffix);
  await shot(`gd192-rest-${suffix}`);
}

// Swimming: hold D while the room runs, freeze mid-stroke.
await json('debug_resume_room', { gameId });
await page.keyboard.down('KeyD');
await wait(1500);
await json('debug_pause_room', { gameId });
await catchUp('swim');
await shot('gd192-swim-a');
await json('debug_step_room', { gameId, ticks: 20 });
await catchUp('swim-b');
await shot('gd192-swim-b');
await page.keyboard.up('KeyD');

// Reaching for prey: a small plain cell just ahead; the amoeba (heavier) swims onto it.
await json('debug_resume_room', { gameId });
const me = await cellOf(ownId);
const preyBot = await json('debug_spawn_bot', { gameId, behavior: 'idle', seed: 5 });
const preyId = preyBot.playerId ?? preyBot.id;
await json('debug_set_player', { gameId, playerId: ownId, mass: 80, position: { x: me.x, y: me.y } });
await json('debug_set_player', { gameId, playerId: preyId, mass: 30, level: 2, traits: ['nucleoid'], position: { x: me.x + 70, y: me.y + 10 } });
await page.keyboard.down('KeyD');
let engulfShots = 0;
for (let i = 0; i < 40 && engulfShots < 2; i += 1) {
  await wait(150);
  const mine = await cellOf(ownId);
  if (mine?.engulfingCellId) {
    await json('debug_pause_room', { gameId });
    await page.keyboard.up('KeyD');
    await catchUp('engulf');
    await shot(`gd192-engulf-${engulfShots === 0 ? 'a' : 'b'}`);
    engulfShots += 1;
    await json('debug_step_room', { gameId, ticks: 12 });
    await catchUp('engulf-b');
    await shot('gd192-engulf-b');
    engulfShots += 1;
  }
}
await page.keyboard.up('KeyD');
console.log('engulf shots', engulfShots);
await page.goto('about:blank');
await browser.close();
