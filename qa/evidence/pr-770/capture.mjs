// Ticket #768 evidence: the amoeba's held arm swinging onto the prey at the grab, and back to its flank when the prey
// escapes, over 300 ms of render time instead of one frame. Private stack 4510/4512, own Chromium, one process; built
// on qa/evidence/pr-766/capture.mjs. Usage: node capture.mjs <outDir> [pull]. Without `pull` it shoots the grab at the
// real pull (1.5 r/s); with it, `debug_set_balance` slows the pull so the hold stays full through the grip, then the
// prey is put past the arm's reach on the same line (the escape) and the let-go is shot.
import pw from '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.js';

const { chromium } = pw;
const SERVER = 'http://127.0.0.1:4510';
const CLIENT = 'http://127.0.0.1:4512/';
const [outDir, pull] = process.argv.slice(2);
const AMOEBA = ['nucleoid', 'ribosomes', 'nuclear_envelope', 'cytoskeleton', 'amoeba_pseudopods'];
const PREY_ANGLE = -0.6;
const ARM_GRAB_REACH = 0.6175;
const COVERAGE = 0.5;
/** Ticks after the grab, and after the escape, to shoot: 4 ticks (67 ms) apart through the 300 ms grip. */
const GRAB_STEPS = [1, 5, 9, 13, 17, 21];
const ESCAPE_STEPS = [1, 5, 9, 13, 17, 21];
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
const bot = await json('debug_spawn_bot', { gameId, behavior: 'idle', seed: 7 });
const preyId = bot.playerId ?? bot.id;
await json('debug_set_player', {
  gameId,
  playerId: preyId,
  mass: 12,
  level: 2,
  traits: ['nucleoid'],
  position: { x: home.x + 400, y: home.y + 400 },
});
await wait(6000);
await json('debug_pause_room', { gameId });
if (pull !== undefined) {
  console.log(
    'pull',
    await mcp('debug_set_balance', {
      gameId,
      patch: { absorption: { ENGULF_ARM_PULL_RADII_PER_SECOND: Number(pull) } },
    }),
  );
}

const own = await cellOf(ownId);
const prey = await cellOf(preyId);
console.log('traits', JSON.stringify(own.traits), 'R', own.radius, 'r', prey.radius);
const distance = own.radius * (1 + ARM_GRAB_REACH) - prey.radius * COVERAGE - 1;
await json('debug_set_player', {
  gameId,
  playerId: preyId,
  position: { x: own.x + distance * Math.cos(PREY_ANGLE), y: own.y + distance * Math.sin(PREY_ANGLE) },
});

async function catchUp() {
  const tick = (await json('debug_get_game_state', { gameId })).snapshot.tick;
  for (let attempt = 0; attempt < 240 && (await renderTick()) < tick; attempt += 1) await wait(250);
  await page.setViewportSize({ width: SHOT_SIZE, height: SHOT_SIZE });
  const start = await page.evaluate(() => window.__evolutionDebug.framesRendered());
  await page.waitForFunction((from) => window.__evolutionDebug.framesRendered() >= from + 4, start, {
    timeout: 180000,
  });
}

async function shoot(steps, label) {
  let stepped = 0;
  for (const target of steps) {
    await page.setViewportSize({ width: 640, height: 400 });
    await json('debug_step_room', { gameId, ticks: Math.max(1, target - stepped) });
    stepped = Math.max(stepped + 1, target);
    await catchUp();
    const [predator, held] = [await cellOf(ownId), await cellOf(preyId)];
    const gap = Math.hypot(held.x - predator.x, held.y - predator.y);
    console.log(
      label,
      stepped,
      'engulfing',
      predator.engulfingCellId,
      'distance/R',
      (gap / predator.radius).toFixed(3),
    );
    await page.screenshot({
      path: `${outDir}/${label}-step${String(stepped).padStart(2, '0')}.png`,
      clip: { x: (SHOT_SIZE - CROP) / 2, y: (SHOT_SIZE - CROP) / 2, width: CROP, height: CROP },
      timeout: 300000,
    });
  }
}

await shoot(GRAB_STEPS, 'grab');
if (pull !== undefined) {
  const [predator] = [await cellOf(ownId)];
  const out = predator.radius * ESCAPED_RADII;
  await json('debug_set_player', {
    gameId,
    playerId: preyId,
    position: { x: predator.x + out * Math.cos(PREY_ANGLE), y: predator.y + out * Math.sin(PREY_ANGLE) },
  });
  await shoot(ESCAPE_STEPS, 'escape');
}
await browser.close();
