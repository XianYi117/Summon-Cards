// 召喚 Summon Cards｜Cloudflare Worker
// 功能：共享個人牌組（D1）、對戰紀錄與統計（D1）、TURN 中繼憑證（Cloudflare Realtime TURN）
// 部署方式見 cloud/README.md。需要的設定：
//   D1 綁定        DB              → 資料庫 summon-cards
//   Secret         TURN_KEY_ID     → Realtime TURN 金鑰 ID
//   Secret         TURN_KEY_TOKEN  → Realtime TURN 金鑰的 API Token
// 不做帳號：每個瀏覽器自己產生一組隨機「裝置碼」放在 X-Device 標頭，伺服器只存它的 SHA-256。
// 只有建立牌組的裝置能修改／刪除該牌組；所有人都能讀取。

const ORIGINS = [
  'https://xianyi117.github.io',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
];
const FIRST_NO = 12;          // 預組佔 1～11，個人牌組從 12 起
const MAX_DECKS_PER_DEVICE = 100;
const LIST_LIMIT = 300;
const TURN_TTL = 4 * 3600;    // TURN 憑證 4 小時

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Device',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (origin && !ORIGINS.includes(origin)) return json({ error: 'origin' }, 403);

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/' ) return json({ ok: true, name: 'summon-cards', time: Date.now() });

      // ── TURN 中繼憑證 ──
      if (path === '/turn' && req.method === 'GET') {
        if (!env.TURN_KEY_ID || !env.TURN_KEY_TOKEN) return json({ iceServers: [] });
        const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.TURN_KEY_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: TURN_TTL }),
        });
        if (!r.ok) return json({ error: 'turn', status: r.status }, 502);
        const j = await r.json();
        // 瀏覽器會擋 53 埠，先濾掉避免等逾時
        const iceServers = (j.iceServers || []).map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53\b/.test(u)) }));
        return json({ iceServers, ttl: TURN_TTL }, 200, { 'Cache-Control': 'no-store' });
      }

      // ── 共享牌組 ──
      if (path === '/decks' && req.method === 'GET') {
        const me = await owner(req);
        const { results } = await env.DB.prepare(
          `SELECT no, name, leader, cards, updated, owner = ?1 AS mine FROM decks WHERE deleted = 0 ORDER BY updated DESC LIMIT ${LIST_LIMIT}`
        ).bind(me || '').all();
        return json({ decks: results.map(d => ({ no: d.no, name: d.name, leader: d.leader || '', cards: JSON.parse(d.cards), updated: d.updated, mine: !!d.mine })) });
      }
      if (path === '/decks' && req.method === 'POST') {
        const me = await owner(req); if (!me) return json({ error: 'device' }, 400);
        const d = checkDeck(await body(req)); if (d.error) return json(d, 400);
        const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM decks WHERE owner = ? AND deleted = 0').bind(me).first();
        if (cnt.n >= MAX_DECKS_PER_DEVICE) return json({ error: 'too many decks' }, 429);
        const now = Date.now();
        for (let tries = 0; tries < 5; tries++) {
          try {
            const row = await env.DB.prepare(
              `INSERT INTO decks (no, name, leader, cards, owner, created, updated)
               VALUES ((SELECT MAX(${FIRST_NO - 1}, COALESCE(MAX(no), 0)) + 1 FROM decks), ?, ?, ?, ?, ?, ?) RETURNING no`
            ).bind(d.name, d.leader, JSON.stringify(d.cards), me, now, now).first();
            return json({ no: row.no }, 201);
          } catch (e) { if (!/UNIQUE|constraint/i.test(String(e))) throw e; }
        }
        return json({ error: 'busy' }, 503);
      }
      const m = path.match(/^\/decks\/(\d+)$/);
      if (m && (req.method === 'PUT' || req.method === 'DELETE')) {
        const me = await owner(req); if (!me) return json({ error: 'device' }, 400);
        const no = +m[1];
        const row = await env.DB.prepare('SELECT owner, deleted FROM decks WHERE no = ?').bind(no).first();
        if (!row || row.deleted) return json({ error: 'not found' }, 404);
        if (row.owner !== me) return json({ error: 'not yours' }, 403);
        if (req.method === 'DELETE') {
          await env.DB.prepare('UPDATE decks SET deleted = 1, updated = ? WHERE no = ?').bind(Date.now(), no).run();
          return json({ ok: true });
        }
        const d = checkDeck(await body(req)); if (d.error) return json(d, 400);
        await env.DB.prepare('UPDATE decks SET name = ?, leader = ?, cards = ?, updated = ? WHERE no = ?')
          .bind(d.name, d.leader, JSON.stringify(d.cards), Date.now(), no).run();
        return json({ ok: true, no });
      }

      // ── 對戰紀錄 ──
      if (path === '/results' && req.method === 'POST') {
        const r = await body(req);
        const s = (v, n = 40) => String(v ?? '').slice(0, n);
        const i = (v, lo, hi) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null; };
        if (![0, 1, -1].includes(r.winner)) return json({ error: 'winner' }, 400);
        await env.DB.prepare(
          'INSERT INTO results (t, mode, build, deck0, leader0, deck1, leader1, winner, turns, s0, s1) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(Date.now(), s(r.mode, 10), s(r.build, 20), s(r.deck0), s(r.leader0, 4), s(r.deck1), s(r.leader1, 4),
          r.winner, i(r.turns, 0, 99), i(r.s0, 0, 9), i(r.s1, 0, 9)).run();
        return json({ ok: true }, 201);
      }
      // 統計：/stats?by=deck|leader&mode=online|ai&days=30
      if (path === '/stats' && req.method === 'GET') {
        const by = url.searchParams.get('by') === 'leader' ? 'leader' : 'deck';
        const mode = url.searchParams.get('mode');
        const days = Math.min(3650, Math.max(1, +url.searchParams.get('days') || 3650));
        const since = Date.now() - days * 86400000;
        const where = 't >= ?1' + (mode ? ' AND mode = ?2' : '');
        const sql = `SELECT k, COUNT(*) AS games, SUM(win) AS wins, SUM(draw) AS draws FROM (
            SELECT ${by}0 AS k, winner = 0 AS win, winner = -1 AS draw FROM results WHERE ${where}
            UNION ALL
            SELECT ${by}1 AS k, winner = 1 AS win, winner = -1 AS draw FROM results WHERE ${where}
          ) GROUP BY k ORDER BY games DESC LIMIT 500`;
        const st = env.DB.prepare(sql);
        const { results } = await (mode ? st.bind(since, mode) : st.bind(since)).all();
        const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM results WHERE ${where}`).bind(...(mode ? [since, mode] : [since])).first();
        return json({ by, games: total.n, rows: results.map(x => ({ ...x, rate: x.games ? Math.round(1000 * (x.wins + x.draws / 2) / x.games) / 10 : 0 })) });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server', detail: String(e).slice(0, 200) }, 500);
    }
  },
};

async function body(req) {
  const t = await req.text();
  if (t.length > 4000) throw new Error('body too large');
  try { return JSON.parse(t || '{}'); } catch { return {}; }
}
async function owner(req) {
  const t = req.headers.get('X-Device') || '';
  if (!/^[0-9a-f]{32,64}$/.test(t)) return '';
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function checkDeck(d) {
  const cards = Array.isArray(d.cards) ? [...new Set(d.cards.map(String))] : [];
  if (cards.length !== 20 || !cards.every(id => /^[FWG]\d{2}$/.test(id))) return { error: 'cards' };
  const cnt = { F: 0, W: 0, G: 0 }; cards.forEach(id => cnt[id[0]]++);
  if (Math.max(cnt.F, cnt.W, cnt.G) > 8) return { error: 'attr max' };
  const leader = /^L\d{2}$/.test(d.leader || '') ? d.leader : '';
  const name = String(d.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || '個人牌組';
  return { cards: cards.sort(), leader, name };
}
