async (page) => {
  const LABEL = globalThis.__gfx646Label ?? 'x';
  const SERVER = 'http://127.0.0.1:4510';
  const OUT = '/workspace/.worktrees/gfx-646/.qa/screenshots/';
  const AMOEBA = ['nucleoid', 'ribosomes', 'nuclear_envelope', 'cytoskeleton', 'amoeba_pseudopods'];
  const PLAIN = ['nucleoid', 'ribosomes', 'nuclear_envelope', 'cytoskeleton'];
  const log = [];
  async function mcp(name, args) {
    const r = await page.request.post(`${SERVER}/debug-mcp`, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      data: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    const t = await r.text();
    const d = JSON.parse(t.slice(t.indexOf('{')));
    return d.result?.content?.[0]?.text ?? JSON.stringify(d);
  }
  const json = async (name, args) => { const text = await mcp(name, args); try { return JSON.parse(text); } catch { throw new Error(`${name}: ${text}`); } };
  const click = (t) => page.evaluate((text) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text); if (b) b.click(); return Boolean(b); }, t);
  const renderTick = () => page.evaluate(() => window.__evolutionDebug?.renderTick() ?? -1);
  const wait = (ms) => page.waitForTimeout(ms);
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto('http://127.0.0.1:4512/');
  await wait(2500);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await wait(2500);
  log.push('join ' + await click('Connect & Join Lobby')); await wait(1000);
  log.push('create ' + await click('Create')); await wait(1000);
  log.push('start ' + await click('Start')); await wait(4000);
  const games = await json('debug_list_games', {});
  let gameId = null, ownId = null;
  for (const g of games) { const room = await json('debug_get_room', { gameId: g.gameId }); if ((room.connected ?? []).length > 0) { gameId = g.gameId; ownId = room.connected[0]; } }
  await json('debug_set_seed', { gameId, seed: 42 }).catch(() => null);
  const cellOf = async (playerId) => (await json('debug_get_entities', { gameId, kind: 'cell' })).find((c) => c.playerId === playerId);
  const own = await cellOf(ownId);
  const cx = own.x, cy = own.y;
  await json('debug_set_player', { gameId, playerId: ownId, mass: 40, level: 6, traits: AMOEBA, position: { x: cx, y: cy } });
  const plain = await json('debug_spawn_bot', { gameId, behavior: 'idle', seed: 3 });
  await json('debug_set_player', { gameId, playerId: plain.playerId ?? plain.id, mass: 40, level: 6, traits: PLAIN, position: { x: cx - 95, y: cy } });
  const wild = await json('debug_spawn_bot', { gameId, behavior: 'idle', seed: 4 });
  const wildId = wild.playerId ?? wild.id;
  await json('debug_set_player', { gameId, playerId: wildId, mass: 90, level: 6, traits: AMOEBA, position: { x: cx + 125, y: cy + 10 } });
  const catchUp = async () => { const tick = (await json('debug_get_game_state', { gameId })).snapshot.tick; for (let i = 0; i < 60 && (await renderTick()) < tick; i += 1) await wait(250); await wait(600); };
  const shot = async (name) => { await page.screenshot({ path: `${OUT}${LABEL}-${name}.png` }); log.push(`shot ${name} ${await renderTick()}`); };
  await wait(6000);
  await json('debug_pause_room', { gameId });
  await catchUp(); await shot('rest-a');
  await json('debug_step_room', { gameId, ticks: 60 }); await catchUp(); await shot('rest-b');
  await json('debug_resume_room', { gameId });
  await page.keyboard.down('KeyD'); await wait(1500);
  await json('debug_pause_room', { gameId }); await catchUp(); await shot('swim');
  await page.keyboard.up('KeyD');
  await json('debug_resume_room', { gameId });
  const me = await cellOf(ownId);
  await json('debug_set_player', { gameId, playerId: wildId, position: { x: me.x + 400, y: me.y + 400 } });
  const prey = await json('debug_spawn_bot', { gameId, behavior: 'idle', seed: 5 });
  await json('debug_set_player', { gameId, playerId: ownId, mass: 80, position: { x: me.x, y: me.y } });
  await json('debug_set_player', { gameId, playerId: prey.playerId ?? prey.id, mass: 30, level: 2, traits: ['nucleoid'], position: { x: me.x + 70, y: me.y + 10 } });
  await page.keyboard.down('KeyD');
  let engulfed = false;
  for (let i = 0; i < 40 && !engulfed; i += 1) {
    await wait(150);
    const mine = await cellOf(ownId);
    if (mine?.engulfingCellId) { engulfed = true; await wait(500); await json('debug_pause_room', { gameId }); await page.keyboard.up('KeyD'); await catchUp(); await shot('engulf'); }
  }
  await page.keyboard.up('KeyD');
  log.push('engulfed ' + engulfed);
  await page.goto('about:blank');
  return log.join('\n');
}
