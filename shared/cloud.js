// 召喚｜雲端連線（Cloudflare Worker）：共享牌組、對戰紀錄、TURN 中繼
// 需先載入 data.js、decks.js。CLOUD_API 留空＝不連雲端，一切照舊只存在本機。
// 網址也可以用 localStorage 'summon_cloud_api' 覆蓋（測試用）。
const CLOUD_URL = 'https://summon-cards.dragon89711.workers.dev';
// 先只在測試版（beta）與構築頁啟用；正式版確認沒問題後把 CLOUD_ONLY_BETA 改成 false
const CLOUD_ONLY_BETA = false;
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
  // 其他裝置的編輯碼（在「我的牌組」輸入後，這台也能編輯、刪除那台建立的牌組）
  const DEVS = 'summon_devices';
  const isCode = t => /^[0-9a-f]{32,64}$/.test(t || '');
  function devices() { try { return JSON.parse(LS(DEVS) || '[]').filter(isCode); } catch { return []; } }
  // 牌組用哪一組編輯碼：via＝其他裝置編輯碼的序號（1 起），沒有＝這台裝置
  const tokenOf = d => (d && d.via && devices()[d.via - 1]) || device();
  async function call(path, { method = 'GET', body, ms = 6000, keepalive, token } = {}) {
    if (!on) throw new Error('off');
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ac && setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(api + path, {
        method, keepalive, signal: ac && ac.signal,
        headers: { 'Content-Type': 'application/json', 'X-Device': token || device() },
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
  // 存到雲端：新牌組回傳伺服器發的編號。原本的分享牌組已被刪除或不屬於這台時，改成新增一副
  async function saveDeck(d) {
    const body = { name: d.name || DEFAULT_DECK_NAME, leader: d.leader || '', cards: d.cards };
    if (d.cloud && d.no) {
      try { await call('/decks/' + d.no, { method: 'PUT', body, token: tokenOf(d) }); return d.no; }
      catch (e) { if (e.status !== 404 && e.status !== 403) throw e; }
    }
    const j = await call('/decks', { method: 'POST', body }); return j.no;
  }
  // 刪除失敗（離線）就記下來，下次同步再刪
  const DEL = 'summon_cloud_del';
  const pendingDel = () => { try { return JSON.parse(LS(DEL) || '[]').map(x => typeof x === 'number' ? { no: x } : x); } catch { return []; } };
  const setPending = l => LS(DEL, JSON.stringify(l));
  async function deleteDeck(no, via) {
    const rest = () => pendingDel().filter(x => x.no !== no);
    try { await call('/decks/' + no, { method: 'DELETE', token: tokenOf({ via }) }); setPending(rest()); }
    catch (e) { setPending(e.status === 404 || e.status === 403 ? rest() : [...rest(), { no, via }]); }
  }
  // 同步：補刪離線時刪的、上傳還沒上傳的、從其他裝置的編輯碼拉回那台的牌組。回傳是否有變動
  async function syncMine() {
    if (!on) return false;
    for (const x of pendingDel()) await deleteDeck(x.no, x.via);
    const list = loadMyDecks(); let changed = false;
    for (const d of list) {
      // up＝本機改過但還沒成功送上去（例如離線時儲存）
      if ((d.cloud && !d.up) || deckProblems(d.cards).length) continue;
      try { const no = await saveDeck(d); if (no !== d.no) delete d.via; d.no = no; d.cloud = 1; delete d.up; changed = true; } catch { break; }
    }
    // 自己名下的：在其他裝置被改過或刪掉時，這台跟著更新
    try { if (mergeFrom(list, await listDecks(), undefined)) changed = true; } catch { }
    const devs = devices();
    for (let i = 0; i < devs.length; i++) {
      try { if (mergeFrom(list, (await call('/decks', { token: devs[i] })).decks || [], i + 1)) changed = true; } catch { }
    }
    if (changed) saveMyDecks(list);
    return changed;
  }
  // 把某組編輯碼名下的雲端牌組併進本機清單（新的加進來、對方改過的更新、對方刪掉的移除）
  function mergeFrom(list, server, via) {
    let changed = false;
    const mine = server.filter(d => d.mine), gone = new Set(pendingDel().map(x => x.no));
    for (const s of mine) {
      if (gone.has(s.no)) continue;
      const i = list.findIndex(d => d.cloud && d.no === s.no);
      const fresh = { no: s.no, name: s.name, leader: s.leader || '', cards: s.cards, updated: new Date(s.updated).toISOString(), cloud: 1 };
      if (via) fresh.via = via;
      if (i < 0) { if (via) { list.push(fresh); changed = true; } }
      else if (!list[i].up && s.updated > Date.parse(list[i].updated || 0) + 1000) { list[i] = { ...fresh, ...(list[i].via ? { via: list[i].via } : {}) }; changed = true; }
    }
    // 清單沒有被截斷時，才能確定對方已經刪掉
    if (server.length < 300) {
      const keep = new Set(mine.map(d => d.no));
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].via || undefined) === via && list[i].cloud && !list[i].up && !keep.has(list[i].no)) { list.splice(i, 1); changed = true; }
    }
    return changed;
  }
  // 輸入其他裝置的編輯碼：之後就能在這台編輯、刪除那台建立的分享牌組
  async function addDevice(code) {
    code = String(code || '').trim().toLowerCase();
    if (!isCode(code)) throw new Error('編輯碼格式不對');
    if (code === device()) throw new Error('這就是這台裝置自己的編輯碼');
    const devs = devices(); let via = devs.indexOf(code) + 1;
    const server = (await call('/decks', { token: code })).decks || [];
    if (!via) { devs.push(code); LS(DEVS, JSON.stringify(devs)); via = devs.length; }
    const list = loadMyDecks(), before = list.length;
    mergeFrom(list, server, via); saveMyDecks(list);
    return list.length - before;
  }

  // ── 對戰紀錄（送出就不管，失敗也不影響遊戲）──
  function report(r) { if (on) call('/results', { method: 'POST', body: r, keepalive: true, ms: 8000 }).catch(() => { }); }
  async function stats(q = '') { return call('/stats' + q); }

  return { on, api, device, devices, addDevice, ice, peerOptions, cached, listDecks, saveDeck, deleteDeck, syncMine, report, stats };
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
