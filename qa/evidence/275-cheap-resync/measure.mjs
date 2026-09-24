import WebSocket from 'ws';
const URL = 'ws://127.0.0.1:4540/ws?clientId=';
const MCP = 'http://127.0.0.1:4540/debug-mcp';
async function mcp(name, args) {
  const r = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const t = await r.text();
  return JSON.parse(t.slice(t.indexOf('{'))).result?.content?.[0]?.text;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(id) {
  const ws = new WebSocket(URL + id);
  const log = { gameState: 0, gameStateBytes: [], deltaBytes: [], deltas: 0, types: [], gameId: null };
  ws.on('message', (raw) => {
    const text = raw.toString();
    const m = JSON.parse(text);
    log.types.push(m.type);
    if (m.type === 'game_state') {
      log.gameState += 1;
      log.gameStateBytes.push(text.length);
      log.gameId = m.gameId;
      ws.send(JSON.stringify({ type: 'snapshot_ack', tick: m.snapshot.tick }));
    }
    if (m.type === 'game_snapshot') {
      log.deltas += 1;
      log.deltaBytes.push(text.length);
      if (log.deltas % 2 === 0) ws.send(JSON.stringify({ type: 'snapshot_ack', tick: m.snapshot.tick }));
    }
    if (m.type === 'lobby_update') {
      const g = m.games.find((x) => x.creatorId === id);
      if (g) log.gameId = g.gameId;
    }
  });
  return new Promise((resolve) => ws.on('open', () => resolve({ ws, log })));
}
const send = (ws, m) => ws.send(JSON.stringify(m));
const id = 'm275-' + Date.now();
const a = await client(id);
send(a.ws, { type: 'join_lobby', playerName: 'M', avatarIndex: 0 });
send(a.ws, {
  type: 'create_game',
  gameName: 'm275',
  config: { maxPlayers: 2, seed: 42, mode: 'free_for_all', roundDurationSeconds: 600, endCondition: 'timer' },
});
await sleep(500);
send(a.ws, { type: 'start_game', gameId: a.log.gameId });
await sleep(3000);
const median = (xs) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)];
console.log(
  'types',
  [...new Set(a.log.types)].join(','),
  'bytes: game_state',
  a.log.gameStateBytes[0],
  'delta median',
  median(a.log.deltaBytes),
);
const gameId = a.log.gameId;
await mcp('debug_pause_room', { gameId });
await sleep(300);
let before = a.log.gameState;
await mcp('debug_step_room', { gameId, ticks: 89 });
await sleep(1500);
console.log('paused step 89: game_state', a.log.gameState - before);
await mcp('debug_resume_room', { gameId });
await sleep(1000);
before = a.log.gameState;
const b = await client(id);
await sleep(1500);
console.log('tab takeover: game_state to the new socket', b.log.gameState, 'to the old', a.log.gameState - before);
b.ws.close();
await sleep(300);
const c = await client(id);
await sleep(1500);
console.log('reconnect in grace: game_state', c.log.gameState);
c.ws.close();
a.ws.close();
