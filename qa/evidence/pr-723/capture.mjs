// Usage: node eng-223-capture.mjs <label> <outDir>
// One Chromium, one room (seed 223): shots at zoom 1.8, 1, far over a gel patch, and one at the wall.
import { chromium } from '@playwright/test';
const [label, outDir] = process.argv.slice(2);
const BASE = 'http://localhost:4512';
const W = 1920, H = 1080;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
p.on('console', (m) => { if (m.text().includes('[223]')) console.log(m.text()); });
let id = 0;
const call = async (name, args) => {
  id += 1;
  const text = await p.evaluate(async ([n, a, i]) => {
    const r = await fetch('/debug-mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: i, method: 'tools/call', params: { name: n, arguments: a } }) });
    const body = await r.text(); const d = body.split('\n').find((l) => l.startsWith('data:'));
    const m = JSON.parse(d === undefined ? body : d.slice(5)); return m.result?.content?.[0]?.text ?? 'null';
  }, [name, args, id]);
  try { return JSON.parse(text); } catch { return text; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto(BASE + '/');
await p.getByRole('button', { name: 'Connect & Join Lobby' }).click();
await p.locator('.conn').filter({ hasText: /connected/ }).waitFor();
const gameName = `eng223-${label}-${Date.now() % 100000}`;
await p.getByLabel('Game name').fill(gameName);
await p.getByTestId('create-seed').fill('223');
await p.getByRole('button', { name: 'Create' }).click();
await p.locator('.games li', { hasText: gameName }).filter({ hasNot: p.locator('.badge') }).first().getByRole('button', { name: 'Start' }).click();
await p.locator('canvas[data-testid="game-canvas"]').waitFor();
await p.waitForFunction(() => window.__evolutionDebug?.renderTick() !== null, null, { timeout: 120000 });
const listed = await call('debug_list_games', {});
const games = Array.isArray(listed) ? listed : (listed.games ?? []);
const gameId = games.find((g) => (g.name ?? g.gameName ?? '') === gameName)?.gameId ?? games[games.length - 1].gameId;
const conns = await call('debug_get_connections', { gameId });
const playerId = conns[0].playerId;
const state = await call('debug_get_game_state', { gameId });
const text = JSON.stringify(state);
const gel = (state.gelPatches ?? state.state?.gelPatches ?? state.snapshot?.gelPatches);
console.log('gel', JSON.stringify(gel) ?? text.slice(0, 600));
const patch = gel[0];
const only = process.env.ONLY;
const shots = [
  { name: 'zoom1.8', mass: 20, x: patch.x - 150, y: patch.y + 40 },
  { name: 'zoom1', mass: 210, x: patch.x - 330, y: patch.y + 60 },
  { name: 'far', mass: 5000, x: patch.x - 700, y: patch.y },
  { name: 'wall-zoom1.8', mass: 20, x: 0, y: -2960 },
];
for (const shot of shots.filter((s) => !only || s.name === only)) {
  await p.setViewportSize({ width: 640, height: 400 });
  await call('debug_resume_room', { gameId });
  await call('debug_set_player', { gameId, playerId, mass: shot.mass, position: { x: shot.x, y: shot.y } });
  await sleep(7000);
  await call('debug_set_player', { gameId, playerId, mass: shot.mass, position: { x: shot.x, y: shot.y } });
  await sleep(1500);
  await call('debug_pause_room', { gameId });
  await call('debug_set_player', { gameId, playerId, mass: shot.mass, position: { x: shot.x, y: shot.y } });
  await call('debug_step_room', { gameId, ticks: 1 });
  const own = (await call('debug_get_entities', { gameId, kind: 'cell' })).find?.((c) => c.playerId === playerId);
  console.log('own', shot.name, own && Math.round(own.x), own && Math.round(own.y), own && Math.round(own.mass));
  await sleep(3000);
  await p.setViewportSize({ width: W, height: H });
  const start = await p.evaluate(() => window.__evolutionDebug.framesRendered());
  await p.waitForFunction((s) => window.__evolutionDebug.framesRendered() >= s + 4, start, { timeout: 180000 });
  await p.screenshot({ path: `${outDir}/${label}-${shot.name}.png` });
  console.log('shot', shot.name);
}
await b.close();
