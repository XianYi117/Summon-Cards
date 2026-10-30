// 召喚｜雲端連線（Cloudflare Worker）：共享牌組、對戰紀錄、TURN 中繼
// 需先載入 data.js、decks.js。CLOUD_API 留空＝不連雲端，一切照舊只存在本機。
// 網址也可以用 localStorage 'summon_cloud_api' 覆蓋（測試用）。
const CLOUD_URL = 'https://summon-cards.dragon89711.workers.dev';
// 先只在測試版（beta）與構築頁啟用；正式版確認沒問題後把 CLOUD_ONLY_BETA 改成 false
const CLOUD_ONLY_BETA = true;
const CLOUD_API = !CLOUD_ONLY_BETA || typeof location === 'undefined' || /\/(beta|builder)\//.test(location.pathname) ? CLOUD_URL : '';

const Cloud = (() => {
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { return null; } };
  const api = (LS('summon_cloud_api') || CLOUD_API || '').replace(/\/+$/, '');
  const on = !!api;
  function device() {
    let t = LS('summon_device');
    if (!t || !/^[0-9a-f]{32,64}$/.test(t)) {
      const b = new Uint8Array(16); (crypto.getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => b[i] = Math.random() * 256));
      t = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); LS('summon_device', t);
    }
    return t;
  }
  async function call(path, { method = 'GET', body, ms = 6000, keepalive } = {}) {
    if (!on) throw new Error('off');
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ac && setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(api + path, {
        method, keepalive, signal: ac && ac.signal,
        headers: { 'Content-Type': 'application/json', 'X-Device': device() },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status });
      return j;
    } finally { clearTimeout(timer); }
  }

  // ── TURN：先拿中繼伺服器，拿不到（逾時、沒設定）就用 PeerJS 預設 ──
  let icePromise = null;
  function ice(ms = 2500) {
    if (!on) return Promise.resolve(null);
    try { const c = JSON.parse(sessionStorage.getItem('summon_ice') || 'null'); if (c && Date.now() - c.t < 3 * 3600e3 && c.ice.length) return Promise.resolve(c.ice); } catch { }
    if (!icePromise) icePromise = call('/turn', { ms }).then(j => {
      const list = (j.iceServers || []).filter(s => [].concat(s.urls).length);
      if (list.length) try { sessionStorage.setItem('summon_ice', JSON.stringify({ t: Date.now(), ice: list })); } catch { }
      return list.length ? list : null;
    }).catch(() => null).finally(() => { icePromise = null; });
    return icePromise;
  }
  async function peerOptions() {
    const list = await ice();
    if (!list) return undefined;
    return { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...list] } };
  }

  // ── 共享牌組 ──
  const CACHE = 'summon_cloud_decks';
  function cached() { try { return JSON.parse(LS(CACHE) || '[]'); } catch { return []; } }
  async function listDecks() {
    const j = await call('/decks');
    LS(CACHE, JSON.stringify(j.decks || []));
    return j.decks || [];
  }
  // 存到雲端：新牌組回傳伺服器發的編號
  async function saveDeck(d) {
    const body = { name: d.name || DEFAULT_DECK_NAME, leader: d.leader || '', cards: d.cards };
    if (d.cloud && d.no) { await call('/decks/' + d.no, { method: 'PUT', body }); return d.no; }
    const j = await call('/decks', { method: 'POST', body }); return j.no;
  }
  // 刪除失敗（離線）就記下來，下次同步再刪
  const DEL = 'summon_cloud_del';
  const pendingDel = () => { try { return JSON.parse(LS(DEL) || '[]'); } catch { return []; } };
  async function deleteDeck(no) {
    try { await call('/decks/' + no, { method: 'DELETE' }); LS(DEL, JSON.stringify(pendingDel().filter(n => n !== no))); }
    catch (e) { if (e.status === 404 || e.status === 403) LS(DEL, JSON.stringify(pendingDel().filter(n => n !== no))); else LS(DEL, JSON.stringify([...new Set([...pendingDel(), no])])); }
  }
  // 把本機還沒上傳的牌組都傳上去（編號改用伺服器發的），回傳是否有變動
  async function syncMine() {
    if (!on) return false;
    for (const no of pendingDel()) await deleteDeck(no);
    const list = loadMyDecks(); let changed = false;
    for (const d of list) {
      if (d.cloud || deckProblems(d.cards).length) continue;
      try { d.no = await saveDeck(d); d.cloud = 1; changed = true; } catch { break; }
    }
    if (changed) saveMyDecks(list);
    return changed;
  }

  // ── 對戰紀錄（送出就不管，失敗也不影響遊戲）──
  function report(r) { if (on) call('/results', { method: 'POST', body: r, keepalive: true, ms: 8000 }).catch(() => { }); }
  async function stats(q = '') { return call('/stats' + q); }

  return { on, api, device, ice, peerOptions, cached, listDecks, saveDeck, deleteDeck, syncMine, report, stats };
})();

// 遊戲牌組選單：加入「玩家分享」（別人上傳的牌組；自己的已在個人構築）
(function addSharedDecks() {
  if (!Cloud.on || typeof DECKS === 'undefined') return;
  const mineNos = new Set(loadMyDecks().filter(d => d.cloud).map(d => d.no));
  const add = list => {
    for (const k of Object.keys(DECKS)) if (DECKS[k].tier === '分享') delete DECKS[k];
    for (const d of list.slice(0, 40)) {
      if (d.mine || mineNos.has(d.no)) continue;
      const cards = (d.cards || []).filter(id => CARDS[id]);
      if (deckProblems(cards).length) continue;
      const comp = { F: 0, W: 0, G: 0 }; cards.forEach(id => comp[id[0]]++);
      DECKS['C' + d.no] = { label: deckTitle(d), comp, fixed: cards, leader: LEADERS[d.leader] ? d.leader : '', custom: true, tier: '分享', no: d.no };
    }
  };
  add(Cloud.cached());
  if (typeof document !== 'undefined' && document.getElementById('leaderGrid')) {
    // 遊戲頁：背景更新，選牌畫面開著就重畫
    Cloud.listDecks().then(list => { add(list); if (typeof window.onCloudDecks === 'function') window.onCloudDecks(); }).catch(() => { });
  }
})();
