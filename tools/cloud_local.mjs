// 本機測試用：用 Node 內建 sqlite 模擬 D1，把 cloud/worker.js 跑在 http://localhost:8787
// 用法：node tools/cloud_local.mjs   （TURN 會回假的憑證）
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import worker from '../cloud/worker.js';
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE decks (no INTEGER PRIMARY KEY, name TEXT NOT NULL, leader TEXT, cards TEXT NOT NULL, owner TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE results (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, mode TEXT, build TEXT, deck0 TEXT, leader0 TEXT, deck1 TEXT, leader1 TEXT, winner INTEGER, turns INTEGER, s0 INTEGER, s1 INTEGER);`);
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  first: async () => db.prepare(sql).get(...args) ?? null,
  run: async () => db.prepare(sql).run(...args),
});
const env = { DB: { prepare: sql => stmt(sql) }, TURN_KEY_ID: 'k', TURN_KEY_TOKEN: 't' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => String(u).startsWith('https://rtc.live.cloudflare.com')
  ? new Response(JSON.stringify({ iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] }, { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp'], username: 'u', credential: 'c' }] }), { status: 201 })
  : realFetch(u, o);
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = new Request('http://localhost:8787' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const out = await worker.fetch(r, env);
  res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer()));
}).listen(8787, () => console.log('cloud local on 8787'));
