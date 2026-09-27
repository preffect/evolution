async (page) => {
  // Ticket #745 evidence: one paramecium per seat colour in a paused room, captured once per shader build.
  const LABEL = 'after';
  const SERVER = 'http://127.0.0.1:4530';
  const CLIENT = 'http://127.0.0.1:4532/';
  const OUT = '/workspace/.worktrees/gfx-745/.qa/screenshots/';
  const PARAMECIUM = ['nucleoid', 'ribosomes', 'nuclear_envelope', 'cytoskeleton', 'cilia', 'paramecium_cilia'];
  const SEATS = 8;
  const RING_RADIUS = 175;
  const MASS = 40;
  const log = [];
  async function mcp(name, args) {
    const response = await page.request.post(`${SERVER}/debug-mcp`, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      data: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    const text = await response.text();
    const body = JSON.parse(text.slice(text.indexOf('{')));
    return body.result?.content?.[0]?.text ?? JSON.stringify(body);
  }
  const json = async (name, args) => {
    const text = await mcp(name, args);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${name}: ${text}`);
    }
  };
  const click = (label) =>
    page.evaluate((text) => {
      const button = [...document.querySelectorAll('button')].find((each) => each.textContent.trim() === text);
      if (button) button.click();
      return Boolean(button);
    }, label);
  const renderTick = () => page.evaluate(() => window.__evolutionDebug?.renderTick() ?? -1);
  const wait = (ms) => page.waitForTimeout(ms);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(CLIENT);
  await wait(2500);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await wait(2500);
  log.push('join ' + (await click('Connect & Join Lobby')));
  await wait(1000);
  log.push('create ' + (await click('Create')));
  await wait(1000);
  log.push('start ' + (await click('Start')));
  await wait(4000);
  let gameId = null;
  let ownId = null;
  for (const game of await json('debug_list_games', {})) {
    const room = await json('debug_get_room', { gameId: game.gameId });
    if ((room.connected ?? []).length > 0) {
      gameId = game.gameId;
      ownId = room.connected[0];
    }
  }
  await json('debug_set_seed', { gameId, seed: 42 }).catch(() => null);
  const own = (await json('debug_get_entities', { gameId, kind: 'cell' })).find((cell) => cell.playerId === ownId);
  const players = [ownId];
  for (let seat = 1; seat < SEATS; seat += 1) {
    const bot = await json('debug_spawn_bot', { gameId, behavior: 'idle', seed: seat });
    players.push(bot.playerId ?? bot.id);
  }
  // The own cell (seat 0, Cyan) stays where the camera holds it; seats 1-7 ring it clockwise from the top.
  const place = (index) => {
    if (index === 0) return { x: own.x, y: own.y };
    const angle = ((index - 1) / (SEATS - 1)) * 2 * Math.PI - Math.PI / 2;
    return { x: own.x + RING_RADIUS * Math.cos(angle), y: own.y + RING_RADIUS * Math.sin(angle) };
  };
  for (const [index, playerId] of players.entries()) {
    await json('debug_set_player', {
      gameId,
      playerId,
      mass: MASS,
      level: 6,
      traits: PARAMECIUM,
      position: place(index),
    });
  }
  await wait(5000);
  await json('debug_pause_room', { gameId });
  const tick = (await json('debug_get_game_state', { gameId })).snapshot.tick;
  for (let attempt = 0; attempt < 60 && (await renderTick()) < tick; attempt += 1) await wait(250);
  await wait(800);
  await page.screenshot({ path: `${OUT}${LABEL}-seats.png` });
  log.push(`shot ${LABEL} at render tick ${await renderTick()}, players ${players.length}`);
  await page.goto('about:blank');
  return log.join('\n');
};
