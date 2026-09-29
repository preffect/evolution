// Ticket #771 evidence: the amoeba's whole arm fan turning to flank the prey at the grab, sliding from one prey to the
// next on a switch, and turning back after an escape, over 300 ms of render time instead of one frame. Private stack
// 4530/4532, own Chromium, one process; built on qa/evidence/pr-770/capture.mjs. Usage: node capture.mjs <outDir> <pull>:
// `debug_set_balance` slows the pull so the hold stays full through each ease.
import pw from '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.js';

const { chromium } = pw;
const SERVER = 'http://127.0.0.1:4530';
const CLIENT = 'http://127.0.0.1:4532/';
const [outDir, pull, only] = process.argv.slice(2);
const AMOEBA = ['nucleoid', 'ribosomes', 'nuclear_envelope', 'cytoskeleton', 'amoeba_pseudopods'];
const PREY_A_ANGLE = 2.2;
const PREY_B_ANGLE = -0.6;
const ARM_GRAB_REACH = 0.6175;
const COVERAGE = 0.5;
/** Ticks after each event to shoot: 0 is the frame before it, then 4 ticks (67 ms) apart through the 300 ms ease. */
const STEPS = [0, 1, 5, 9, 13, 17, 21];
/** Where the escaped prey is put: past the arm's reach, on the same line. */
const ESCAPED_RADII = 2.4;
/** A tall square viewport: the camera frames a fixed number of radii, so the cell grows with the viewport. */
const SHOT_SIZE = 1600;
const CROP = 640;

async function mcp(name, args) {
  const response = await fetch(`${SERVER}/debug-mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const text = await response.text();
  const parsed = JSON.parse(text.slice(text.indexOf('{')));
  return parsed.result?.content?.[0]?.text ?? JSON.stringify(parsed);
}
const json = async (name, args) => {
  const text = await mcp(name, args);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name}: ${text}`);
  }
};

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const click = (label) =>
  page.evaluate((text) => {
    const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent.trim() === text);
    button?.click();
    return Boolean(button);
  }, label);
const renderTick = () => page.evaluate(() => window.__evolutionDebug?.renderTick() ?? -1);
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(CLIENT);
await wait(2500);
await page.evaluate(() => localStorage.clear());
await page.reload();
await wait(2500);
await click('Connect & Join Lobby');
await wait(1000);
await click('Create');
await wait(1000);
await click('Start');
await wait(4000);

let gameId = null;
let ownId = null;
for (const game of await json('debug_list_games', {})) {
  const room = await json('debug_get_room', { gameId: game.gameId });
  if ((room.connected ?? []).length > 0) [gameId, ownId] = [game.gameId, room.connected[0]];
}
const cellOf = async (playerId) =>
  (await json('debug_get_entities', { gameId, kind: 'cell' })).find((cell) => cell.playerId === playerId);
const home = await cellOf(ownId);
await json('debug_set_player', {
  gameId,
  playerId: ownId,
  mass: 60,
  level: 6,
  traits: AMOEBA,
  position: { x: home.x, y: home.y },
});
async function spawnPrey(seed, offset) {
  const bot = await json('debug_spawn_bot', { gameId, behavior: 'idle', seed });
  const id = bot.playerId ?? bot.id;
  const position = { x: home.x + offset, y: home.y + 400 };
  await json('debug_set_player', { gameId, playerId: id, mass: 12, level: 2, traits: ['nucleoid'], position });
  return id;
}
const preyA = await spawnPrey(7, 400);
const preyB = await spawnPrey(8, -400);
await wait(6000);
await json('debug_pause_room', { gameId });
console.log(
  'pull',
  await mcp('debug_set_balance', { gameId, patch: { absorption: { ENGULF_ARM_PULL_RADII_PER_SECOND: Number(pull) } } }),
);

const own = await cellOf(ownId);
const grabDistance = (preyRadius) => own.radius * (1 + ARM_GRAB_REACH) - preyRadius * COVERAGE - 1;
/** Puts `preyId` `distance` from the amoeba along `angle`. */
async function place(preyId, angle, distance) {
  const predator = await cellOf(ownId);
  const position = { x: predator.x + distance * Math.cos(angle), y: predator.y + distance * Math.sin(angle) };
  await json('debug_set_player', { gameId, playerId: preyId, position });
}
const away = own.radius * ESCAPED_RADII * 2;

async function catchUp() {
  const tick = (await json('debug_get_game_state', { gameId })).snapshot.tick;
  for (let attempt = 0; attempt < 240 && (await renderTick()) < tick; attempt += 1) await wait(250);
  await page.setViewportSize({ width: SHOT_SIZE, height: SHOT_SIZE });
  const start = await page.evaluate(() => window.__evolutionDebug.framesRendered());
  await page.waitForFunction((from) => window.__evolutionDebug.framesRendered() >= from + 4, start, {
    timeout: 180000,
  });
}

async function snap(path) {
  await catchUp();
  await page.screenshot({
    path,
    clip: { x: (SHOT_SIZE - CROP) / 2, y: (SHOT_SIZE - CROP) / 2, width: CROP, height: CROP },
    timeout: 300000,
  });
  await page.setViewportSize({ width: 640, height: 400 });
}

/** Shoots the frame before `event`, then runs it and shoots `STEPS` ticks after it. */
async function shoot(label, event) {
  let stepped = 0;
  for (const target of STEPS) {
    if (target === 0) {
      await snap(`${outDir}/${label}-before.png`);
      await event();
      continue;
    }
    await json('debug_step_room', { gameId, ticks: Math.max(1, target - stepped) });
    stepped = Math.max(stepped + 1, target);
    console.log(label, stepped, 'engulfing', (await cellOf(ownId)).engulfingCellId);
    await snap(`${outDir}/${label}-step${String(stepped).padStart(2, '0')}.png`);
  }
}

const [a, b] = [await cellOf(preyA), await cellOf(preyB)];
console.log('traits', JSON.stringify(own.traits), 'R', own.radius, 'r', a.radius, 'A', a.id, 'B', b.id);
await place(preyB, PREY_B_ANGLE, away);
if (only === 'escape') {
  await place(preyB, PREY_B_ANGLE, grabDistance(b.radius));
  await json('debug_step_room', { gameId, ticks: 20 });
  await shoot('escape', () => place(preyB, PREY_B_ANGLE, away));
  await browser.close();
  process.exit(0);
}
await shoot('grab', () => place(preyA, PREY_A_ANGLE, grabDistance(a.radius)));
await json('debug_step_room', { gameId, ticks: 10 });
await shoot('switch', async () => {
  await place(preyA, PREY_A_ANGLE, away);
  await place(preyB, PREY_B_ANGLE, grabDistance(b.radius));
});
await json('debug_step_room', { gameId, ticks: 10 });
await shoot('escape', () => place(preyB, PREY_B_ANGLE, away));
await browser.close();
