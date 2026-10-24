// 召喚｜畫面與互動
(function () {
  const { Game, AI, shape, coreOf, summonList, LEVEL_NAME } = window.Engine;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  let speed = 1;
  const wait = ms => new Promise(r => setTimeout(r, ms * speed));
  const info = id => CARDS[id] || LEADERS[id];

  function cardEl(id, o = {}) {
    const c = el('div', 'card' + (o.down ? ' down' : '') + (o.cls ? ' ' + o.cls : ''));
    if (o.w) c.style.setProperty('--w', o.w);
    if (id) c.dataset.id = id;
    if (o.uid) c.dataset.uid = o.uid;
    const nm = id && info(id) ? info(id).name : '卡背';
    c.innerHTML = `<div class="inner"><div class="face">${id ? `<img src="${img(id)}" alt="${id} ${nm}" loading="lazy">` : ''}</div><div class="back"></div></div><div class="shade"></div><div class="glare"></div>`;
    return c;
  }
  function tilt(c, strength = 14) {
    const inner = c.querySelector('.inner');
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      inner.style.transform = `${c.classList.contains('down') ? 'rotateY(180deg) ' : ''}rotateX(${(.5 - y) * strength}deg) rotateY(${(x - .5) * strength}deg)`;
      c.style.setProperty('--gx', x * 100 + '%'); c.style.setProperty('--gy', y * 100 + '%');
      c.classList.add('lit');
    });
    c.addEventListener('pointerleave', () => { inner.style.transform = ''; c.classList.remove('lit'); });
  }

  // ---------- 畫面切換 ----------
  const screens = ['home', 'pick', 'vs', 'battle', 'rules', 'gallery', 'online'];
  function show(id) { screens.forEach(s => $('#' + s).hidden = s !== id); if (id === 'battle') fitStage(); }
  document.querySelectorAll('[data-home]').forEach(b => b.onclick = () => show('home'));

  // ---------- 首頁 ----------
  (function home() {
    const fan = $('#homeFan'); const ids = ['L04', 'L11', 'L13', 'L12', 'L02'];
    ids.forEach((id, k) => {
      const c = cardEl(id); const a = (k - 2) * 13;
      c.style.transform = `translateX(-50%) rotate(${a}deg) translateY(${Math.abs(k - 2) * 8}px)`;
      c.style.animationDelay = k * 80 + 'ms'; c.style.zIndex = 5 - Math.abs(k - 2);
      fan.appendChild(c);
    });
    $('#btnStart').onclick = () => { cfg = { me: {}, foe: {} }; pickStep = 'me'; renderPick(); show('pick'); };
    $('#btnRules').onclick = () => { renderRules(); show('rules'); };
    $('#btnGallery').onclick = () => { renderGallery('all'); show('gallery'); };
  })();

  // ---------- 選角 ----------
  let cfg = { me: {}, foe: {} }, pickStep = 'me';
  const leaderIds = Object.keys(LEADERS);
  function renderPick() {
    const s = cfg[pickStep], isFoe = pickStep === 'foe';
    $('#pickStep').textContent = net.on ? `連線對戰．房間 ${net.code}` : isFoe ? 'STEP 2 / 2' : 'STEP 1 / 2';
    $('#pickTitle').textContent = isFoe ? '選擇對手的隊長與牌組' : '選擇你的隊長與牌組';
    renderNetPick();
    const grid = $('#leaderGrid'); grid.innerHTML = '';
    grid.classList.toggle('has-pick', !!s.leader);
    const list = isFoe ? [...leaderIds, 'RANDOM'] : leaderIds;
    for (const id of list) {
      const c = id === 'RANDOM' ? cardEl(null, { down: true }) : cardEl(id);
      c.tabIndex = 0; c.setAttribute('role', 'button');
      c.setAttribute('aria-label', id === 'RANDOM' ? '隨機隊長' : `${id} ${LEADERS[id].name}`);
      if (s.leader === id) c.classList.add('chosen');
      const choose = () => { if (net.on && net.myCfg) return; s.leader = id; if (id !== 'L11') delete s.main; renderPick(); if (innerWidth < 760) $('#pickInfo').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      c.onclick = choose; c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } };
      if (id !== 'RANDOM') tilt(c, 10);
      grid.appendChild(c);
    }
    const inf = $('#pickInfo'); inf.innerHTML = '';
    if (!s.leader) inf.appendChild(el('div', 'empty', '點選一張隊長卡。<br>每位隊長都有專屬能力，部分隊長還有特殊勝利條件。'));
    else if (s.leader === 'RANDOM') inf.append(el('h3', '', '隨機隊長'), el('div', 'desc', '開戰時從 13 位隊長中隨機決定。'));
    else {
      const L = LEADERS[s.leader];
      inf.append(el('div', 'lab', `${s.leader}．${COLOR_NAME[L.color]}屬性．${L.race}`), el('h3', '', L.name), el('div', 'skill', L.skill), el('div', 'desc', L.text));
      if (s.leader === 'L11') {
        inf.appendChild(el('div', 'lab', '主色（開局公開）'));
        const row = el('div', 'chips');
        for (const col of ['F', 'W', 'G']) {
          const b = el('button', 'colorbtn ' + col, COLOR_NAME[col]); b.setAttribute('aria-pressed', s.main === col);
          b.onclick = () => { s.main = col; renderPick(); }; row.appendChild(b);
        }
        inf.appendChild(row);
      }
    }
    inf.appendChild(el('div', 'lab', '牌組'));
    const dk = el('div', 'chips');
    for (const key of Object.keys(DECKS)) {
      const d = DECKS[key];
      const sub = d.comp ? `<small>${Object.entries(d.comp).map(([k, v]) => `<span class="dot ${k}"></span>${COLOR_NAME[k]}${v}`).join(' ')}</small>` : '<small>三色 7／7／6 隨機</small>';
      const b = el('button', 'chip', `<span>${d.label}</span>${sub}`); b.setAttribute('aria-pressed', s.deck === key);
      b.onclick = () => { s.deck = key; if (s.leader === 'L11' && !s.mainTouched && d.comp) s.main = Object.keys(d.comp)[0]; renderPick(); };
      dk.appendChild(b);
    }
    inf.appendChild(dk);
    const ok = s.leader && s.deck && (s.leader !== 'L11' || s.main);
    const act = el('div', 'pick-actions');
    const next = el('button', 'btn primary', net.on ? (net.myCfg ? '已準備，等待對手…' : '準備完成') : isFoe ? '確認對手' : '下一步'); next.disabled = !ok || (net.on && !!net.myCfg);
    next.onclick = () => { if (net.on) { net.ready(); renderPick(); return; } if (!isFoe) { pickStep = 'foe'; renderPick(); } else { finalizeCfg(); renderVS(); show('vs'); } };
    act.appendChild(next); inf.appendChild(act);
    if (net.on) { const np = el('div', 'netpick'); np.id = 'netPick'; inf.appendChild(np); renderNetPick(); }
    if (s.leader === 'L11' && !s.main) inf.appendChild(el('div', 'empty', '請選擇冥火貓妖的主色。'));
  }
  $('#pickBack').onclick = () => { if (net.on) { if (net.conn) net.send({ k: 'bye' }); net.close(); show('home'); return; } if (pickStep === 'foe') { pickStep = 'me'; renderPick(); } else show('home'); };
  function finalizeCfg() {
    const f = cfg.foe;
    f.realLeader = f.leader === 'RANDOM' ? leaderIds[Math.floor(Math.random() * leaderIds.length)] : f.leader;
    if (f.realLeader !== 'L11') delete f.main;
  }
  function renderVS() {
    const side = (box, s, who) => {
      box.innerHTML = '';
      const id = s.realLeader || s.leader;
      const c = cardEl(id); tilt(c, 10); box.appendChild(c);
      box.appendChild(el('div', 'nm', `${who}．${LEADERS[id].name}`));
      box.appendChild(el('div', 'dk', `牌組：${DECKS[s.deck].label}${s.main ? `．主色${COLOR_NAME[s.main]}` : ''}${s.leader === 'RANDOM' ? '．隨機隊長' : ''}`));
    };
    side($('#vsFoe'), cfg.foe, '對手'); side($('#vsMe'), cfg.me, '我方');
  }
  $('#vsBack').onclick = () => { pickStep = 'me'; renderPick(); show('pick'); };
  $('#vsStart').onclick = () => startBattle();

  // ---------- 規則 ----------
  function renderRules() {
    const pw = [['AAAA', '火火火火', 7, '1 張'], ['AAAB', '火火火水', 6, '1 張'], ['AAA', '火火火', 5, '1 張'], ['AABB', '火火水水', 4, '2 張'], ['AAB、AABC', '火火水、火火水草', 3, '1 張'], ['AA', '火火', 2, '1 張'], ['沒有成對', '火、火水、火水草', 1, '不能']];
    $('#rulesBody').innerHTML = `
<h3>怎麼贏</h3>
<div class="wins3"><div><b>得分勝利</b>先拿到 4 分。每回合比戰力，贏的人得 1 分。</div><div><b>隊長勝利</b>部分隊長有自己的勝利條件，達成就立刻獲勝。</div><div><b>石像勝利</b>石像卡上寫明的勝利效果。</div></div>
<h3>卡牌構築、開始設置</h3>
<ul><li><b>構築</b>：每人組合 20 張卡牌（一種屬性最多 7 張，編號不得重複）和 1 位隊長。</li>
<li><b>設置</b>：挑選 1 位隊長，洗牌後各抽 5 張。猜拳決定第一回合的起始玩家，之後每回合輪流當起始玩家。</li></ul>
<h3>回合流程</h3>
<ol><li><b>補牌</b>：手牌補到 5 張，再處理石像「每回合」的效果，例如多抽、讓對手棄牌。</li>
<li><b>出牌</b>：選 1～4 張排好順序，蓋著出。</li><li><b>翻牌</b>：雙方同時翻開。</li>
<li><b>戰力計算</b>：計算牌型戰力、屬性剋制條件，戰力獲勝的人取得 1 分；平手都不得分。</li>
<li><b>召喚石像</b>：不論輸贏，出了成對以上的牌型，就把其中 1 張變成石像（兩對 2 張）。</li>
<li><b>整理</b>：場地上的其餘卡牌進入棄牌區。</li></ol>
<div class="box"><b>獻祭</b>：可於補牌後～戰力計算之間發動，獻祭 1 座自己的石像，發動它的獻祭效果。每人每回合最多 1 次。</div>
<h3>石像</h3>
<ul><li>每張石像有兩個技能：<b>啟動</b>是石像直立期間一直有效；<b>獻祭</b>是把石像橫放，換一次效果。</li>
<li>獻祭過的石像橫放在石像區，不再有任何能力。</li><li>石像會被對手破壞或封印，要想辦法保護自己的石像，也可以去拆對手的。</li></ul>
<h3>牌型大小</h3>
<p>同顏色越多越強，A、B、C 代表不同屬性。</p>
<div class="tbl"><table><tr><th>牌型</th><th>例子</th><th>戰力</th><th>變成石像</th></tr>${pw.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</table></div>
<p><b>剋制</b>：火剋草、草剋水、水剋火。雙方牌型等級相同時，剋制的一方戰力 +2。</p>
<details><summary>詳細規則</summary>
<h3>1. 抽牌與牌庫</h3><ul><li>沒用完的手牌會留著，補牌時補到 5 張。</li><li>牌庫抽完時，把棄牌區洗成新牌庫繼續抽。石像區的牌不洗回。</li></ul>
<h3>2. 核心屬性與剋制</h3><ul><li><b>核心屬性</b>：重複最多的顏色，例如火火水草 → 火。兩對或沒有成對時，看最左邊那張。</li><li><b>牌型等級</b>由低到高：單張、一對、兩對、三同屬、四同屬。AAB、AABC 都算一對，AAAB 算三同屬。</li><li>只有雙方等級相同時才判定剋制，剋制成功 +2。</li></ul>
<h3>3. 召喚哪一張</h3><ul><li>只能從成對的那組牌中召喚，固定取最左邊那張。兩對時，兩組各取最左邊那張。</li><li>所以出牌時的排列順序，會決定哪一張變成石像。遊戲中依你點選的順序由左到右排列。</li></ul>
<h3>4. 獻祭的順序</h3><ol><li>從起始玩家開始，雙方輪流宣告「獻祭」或「跳過」。</li><li>跳過不代表放棄，對手之後獻祭時，你還是可以回應。</li><li>雙方連續都跳過，獻祭時間就結束。</li></ol>
<h3>5. 石像的狀態</h3><div class="tbl"><table><tr><th>狀態</th><th>擺法</th><th>技能</th><th>算進屬性數量</th></tr><tr><td>直立</td><td>直放</td><td>啟動有效，可以獻祭</td><td>算</td></tr><tr><td>已獻祭</td><td>橫放</td><td>沒有任何技能</td><td>不算（只算獻祭數量）</td></tr><tr><td>封印中</td><td>直放</td><td>啟動無效，也不能獻祭</td><td>算</td></tr></table></div>
<ul><li><b>破壞</b>：被破壞的石像進棄牌區，之後會洗回牌庫。</li><li><b>封印通則</b>：被封印的能力在封印期間完全不生效，有利和不利的部分都一樣；累積的數值保留不變。</li></ul>
<h3>6. 效果處理</h3><ul><li>每回合觸發的啟動效果，都在補牌後處理。雙方同時觸發時，起始玩家先處理。</li><li>技能帶來的額外抽牌不受 5 張限制，但下回合補牌仍以 5 張為準。</li><li>獻祭得到的能力只持續本回合。</li></ul>
<h3>7. 勝利的細節</h3><ul><li>隊長的特殊勝利條件一達成，就立刻獲勝。</li><li>雙方同時達成勝利條件時，進入搶 1 分加賽。</li></ul>
<h3>8. 隊長說明</h3><div class="tbl"><table><tr><th>隊長</th><th>說明</th></tr>${leaderIds.map(id => `<tr><td>${id} ${LEADERS[id].name}</td><td>${LEADERS[id].text}</td></tr>`).join('')}</table></div>
<p>L12 專屬戰力：A、AA、AAA、AAAA＝1；AB、AAB、AAAB＝3；AABB＝4；ABC＝5；AABC＝6。對手不能剋制 L12。</p>
</details>`;
  }

  // ---------- 圖鑑 ----------
  function renderGallery(filter) {
    const fl = $('#galFilter'); fl.innerHTML = '';
    for (const [k, lab] of [['all', '全部'], ['F', '火'], ['W', '水'], ['G', '草'], ['L', '隊長']]) {
      const b = el('button', 'chip', lab); b.setAttribute('aria-pressed', filter === k); b.onclick = () => renderGallery(k); fl.appendChild(b);
    }
    const grid = $('#galGrid'); grid.innerHTML = '';
    const ids = [...Object.keys(CARDS), ...leaderIds].filter(id => filter === 'all' || (filter === 'L' ? id[0] === 'L' : id[0] === filter && id[0] !== 'L'));
    for (const id of ids) {
      const c = cardEl(id); c.tabIndex = 0; c.setAttribute('role', 'button');
      c.onclick = () => openBig(id); c.onkeydown = e => { if (e.key === 'Enter') openBig(id); };
      grid.appendChild(c);
    }
  }
  function openBig(id) {
    const m = $('#galModal'), b = $('#galBox'); b.innerHTML = '';
    const c = cardEl(id, { cls: 'big-card' }); tilt(c, 18); b.appendChild(c);
    const d = info(id);
    b.appendChild(el('h3', '', `${id}．${d.name}`));
    if (id[0] === 'L') b.appendChild(el('p', '', `${COLOR_NAME[d.color]}屬性．${d.race}．${d.skill}：${d.text}`));
    else b.appendChild(el('p', '', `${COLOR_NAME[d.color]}屬性．${d.race}．${d.role}<br><b style="color:var(--gold-hi)">啟動</b> ${d.act}<br><b style="color:var(--gold-hi)">獻祭</b> ${d.sac}`));
    const x = el('button', 'btn small', '關閉'); x.onclick = () => m.hidden = true; b.appendChild(x);
    m.hidden = false; m.onclick = e => { if (e.target === m) m.hidden = true; };
  }

  // ================= 對戰 =================
  let G = null, scale = 1, mode = 'idle', sel = [], fresh = new Set(), freshPlay = new Set(), freshStatue = new Set(), sacFx = new Set();
  let ME = 0; const P = slot => slot === 0 ? ME : 1 - ME; // 畫面位置(0=我方) → 引擎玩家編號
  let resolver = null, pickables = null, revealed = false, lastSettle = null, logs = [], t0 = 0, tEnd = 0, clockT = null;
  const mmss = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  function tickClock() { const c = $('#clock'); if (c) c.textContent = '⏱ ' + mmss((tEnd || Date.now()) - t0); }
  const stage = $('#stage');
  function fitStage() {
    const w = innerWidth, h = innerHeight;
    scale = Math.min(w / 1280, h / 720);
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`; stage.style.transformOrigin = '50% 50%';
  }
  addEventListener('resize', () => { if (!$('#battle').hidden) fitStage(); });
  function relRect(e) { const s = stage.getBoundingClientRect(), r = e.getBoundingClientRect(); return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale }; }

  // 懸停說明
  let tipTimer = null;
  function bindHover(c, id, extra) {
    c.addEventListener('pointerenter', e => {
      const t = $('#tip'); const d = info(id); if (!d) return;
      t.innerHTML = id[0] === 'L' ? `<b>${d.name}</b>．${d.skill}<br>${d.text}${extra || ''}` : `<b>${d.name}</b>（${COLOR_NAME[d.color]}）<br><b>啟動</b> ${d.act}<br><b>獻祭</b> ${d.sac}${extra || ''}`;
      const r = relRect(c); let x = r.x + r.w + 8, y = r.y;
      if (x + 230 > 1280) x = r.x - 230; if (y + 120 > 720) y = 720 - 130; if (y < 0) y = 4;
      t.style.left = x + 'px'; t.style.top = y + 'px'; t.hidden = false;
      clearTimeout(tipTimer); tipTimer = setTimeout(() => showDetail(id, true), 700);
    });
    c.addEventListener('pointerleave', () => { $('#tip').hidden = true; clearTimeout(tipTimer); $('#detail').classList.remove('focus'); });
  }
  function showDetail(id, focus) {
    const d = $('#detail'); d.innerHTML = '';
    if (!id) { d.appendChild(el('div', 'hint', '把滑鼠停在任何卡上，這裡會顯示完整說明。')); return; }
    const x = info(id); d.appendChild(cardEl(id));
    d.appendChild(el('div', 'dn', `${x.name}`));
    if (id[0] === 'L') { d.appendChild(el('div', 'dm', `${id}．${COLOR_NAME[x.color]}屬性．${x.race}`)); d.appendChild(el('div', 'row', `<b>${x.skill}</b>${x.text}`)); }
    else { d.appendChild(el('div', 'dm', `${id}．${COLOR_NAME[x.color]}屬性．${x.race}．${x.role}`)); d.appendChild(el('div', 'row', `<b>啟動</b>${x.act}`)); d.appendChild(el('div', 'row', `<b>獻祭</b>${x.sac}`)); }
    d.classList.toggle('focus', !!focus);
  }

  function startBattle(online) {
    if (online) {
      ME = online.me;
      const ctrls = []; ctrls[ME] = NetHuman; ctrls[1 - ME] = Remote;
      G = new Game({ players: online.cfgs, seed: online.seed, controllers: ctrls, ui: { ev: onEvent, log: addLog } });
    } else {
      ME = 0; net.on = false;
      const me = cfg.me, foe = cfg.foe;
      G = new Game({
        players: [{ leader: me.leader, deck: me.deck, main: me.main }, { leader: foe.realLeader, deck: foe.deck, main: foe.main }],
        controllers: [Human, AI], ui: { ev: onEvent, log: addLog },
      });
    }
    $('#netState').hidden = true;
    mode = 'idle'; sel = []; fresh = new Set(G.p[ME].hand.map(c => c.uid)); freshPlay.clear(); freshStatue.clear(); sacFx.clear(); revealed = false; lastSettle = null; logs = [];
    t0 = Date.now(); tEnd = 0; clearInterval(clockT); clockT = setInterval(tickClock, 1000); tickClock();
    $('#powers').innerHTML = ''; $('#modal').hidden = true; $('#fx').innerHTML = '';
    show('battle'); showDetail(null); renderAll();
    G.turnLoop().catch(err => { console.error(err); banner('發生錯誤，請重新開局'); });
  }
  function addLog(text, who) {
    if (who == null && ME === 1) text = text.replace(/戰力 (\S+) 對 (\S+)，/, '戰力 $2 對 $1，').replace(/我方|對手/, m => m === '我方' ? '對手' : '我方');
    if (who === 0 || who === 1) who = who === ME ? 0 : 1;
    logs.push({ text, who, turn: G ? G.turn : 0, t: Date.now() - t0 }); }

  // ---------- 繪製 ----------
  const PHASE = { setup: '準備', draw: '補牌', choose: '出牌', reveal: '翻牌', post: '獻祭時間', settle: '戰力計算', summon: '召喚石像', end: '整理' };
  function renderAll() {
    if (!G) return;
    $('#tip').hidden = true;
    $('#turnNo').textContent = `回合 ${G.turn}．起始：${G.first === ME ? '我方' : '對手'}`;
    $('#phase').textContent = PHASE[G.phase] || '';
    renderSide(0); renderSide(1); renderOrbs(); renderStatues(0); renderStatues(1); renderPlays(); renderHand(); renderFoeHand(); renderAct();
  }
  function goalText(p) {
    const up = G.upright(p), o = G.opp(p.idx);
    const c = { F: 0, W: 0, G: 0 }; up.forEach(s => c[s.id[0]]++);
    switch (p.leader) {
      case 'L01': return `連勝加成 +${p.l01}`;
      case 'L08': return `已獻祭石像 ${p.statues.filter(s => !s.up).length}／5`;
      case 'L10': return `直立 火${c.F} 水${c.W} 草${c.G}（各 2）`;
      case 'L11': return `主色${COLOR_NAME[p.main]} 直立 ${c[p.main]}／4`;
      case 'L13': return `封印中 ${o.statues.filter(s => s.byL13).length}／3`;
    }
    return '';
  }
  function renderSide(i) {
    const p = G.p[P(i)], box = i === 0 ? $('#sideMe') : $('#sideFoe'); box.innerHTML = '';
    const pl = el('div', 'pl ' + (i === 0 ? 'me' : 'foe') + (p.lsealed ? ' sealedL' : ''));
    const c = cardEl(p.leader); bindHover(c, p.leader, p.lsealed ? '<br><b>本回合被封印</b>' : ''); pl.appendChild(c);
    const g = goalText(p);
    pl.appendChild(el('div', '', `<div class="pn">${i === 0 ? '我方' : '對手'}．${LEADERS[p.leader].name}</div>
      <div class="ps">得分 <b>${p.score}</b>／4<br>牌庫 <b>${p.deck.length}</b>．棄牌 <b>${p.disc.length}</b>${i === 1 ? `．手牌 <b>${p.hand.length}</b>` : ''}</div>
      ${g ? `<div class="goal">${g}</div>` : ''}${p.lsealed ? '<div class="goal" style="color:#d9c2ff">隊長被封印</div>' : ''}`));
    box.appendChild(pl);
  }
  function renderOrbs() {
    for (const [i, box] of [[0, $('#orbsMe')], [1, $('#orbsFoe')]]) {
      const prev = +box.dataset.n || 0; box.innerHTML = '';
      const n = Math.min(4, G.p[P(i)].score);
      const order = i === 0 ? [0, 1, 2, 3] : [3, 2, 1, 0];
      for (const k of order) { const o = el('div', 'orb' + (k < n ? ' on' : '') + (k < n && k >= prev ? ' pop' : '')); box.appendChild(o); }
      box.dataset.n = n;
    }
  }
  function renderStatues(i) {
    const p = G.p[P(i)], z = i === 0 ? $('#zMeSt') : $('#zFoeSt');
    z.innerHTML = '';
    const keep = el('div', 'st-keep'), sac = el('div', 'st-sac');
    keep.appendChild(el('span', 'zl', i === 0 ? '我方石像區' : '對手石像區'));
    sac.appendChild(el('span', 'zl', '獻祭區'));
    const up = p.statues.filter(s => s.up), down = p.statues.filter(s => !s.up);
    keep.classList.toggle('crowd', up.length > 7);
    for (const s of [...up, ...down]) {
      const c = cardEl(s.id, { uid: s.uid });
      if (s.sealed) c.classList.add('sealed'); if (s.maint) c.classList.add('maint');
      if (freshStatue.has(s.uid)) c.classList.add('petrify');
      if (sacFx.has(s.uid)) c.classList.add('sacfx');
      if (pickables && pickables.list.includes(s)) { c.classList.add('pickable'); c.onclick = () => pickables && pickables.on(s); }
      const st = !s.up ? '<br><b>已獻祭</b>' : s.sealed ? '<br><b>封印中</b>' : s.maint ? '<br><b>維持雙界封印中</b>' : '';
      bindHover(c, s.id, st);
      (s.up ? keep : sac).appendChild(c);
    }
    z.append(keep, sac);
    freshStatue.forEach(u => { if (p.statues.some(s => s.uid === u)) setTimeout(() => freshStatue.delete(u), 50); });
  }
  function renderPlays() {
    for (const i of [0, 1]) {
      const z = i === 0 ? $('#zMePlay') : $('#zFoePlay'); z.innerHTML = '';
      for (const c of G.played[P(i)]) {
        const down = i === 1 && !revealed;
        const e = cardEl(c.id, { uid: c.uid, down });
        if (freshPlay.has(c.uid)) e.classList.add(i === 0 ? 'fly-me' : 'fly-foe');
        if (c.as) e.querySelector('.shade').style.boxShadow = `inset 0 0 0 4px var(--${{ F: 'fire', W: 'water', G: 'grass' }[c.as]})`;
        if (!down) bindHover(e, c.id, c.as ? `<br><b>本回合視為${COLOR_NAME[c.as]}屬性</b>` : '');
        if (lastSettle && lastSettle.w === P(i)) e.classList.add('win');
        z.appendChild(e);
      }
    }
    freshPlay.clear();
  }
  function renderHand() {
    const h = $('#hand'); h.innerHTML = ''; const cards = G.p[ME].hand; const n = cards.length;
    h.classList.toggle('locked', mode !== 'choose');
    cards.forEach((c, k) => {
      const e = cardEl(c.id, { uid: c.uid }); const off = k - (n - 1) / 2;
      e.style.setProperty('--rot', off * 3.5 + 'deg'); e.style.setProperty('--ty', Math.abs(off) * 6 + 'px');
      if (fresh.has(c.uid)) e.classList.add('drawn');
      const si = sel.indexOf(c); if (si >= 0) { e.classList.add('sel'); e.appendChild(el('div', 'ord', si + 1)); }
      if (pickables && pickables.cards && pickables.cards.includes(c)) e.classList.add('sel');
      e.onclick = () => {
        if (mode !== 'choose') return;
        const j = sel.indexOf(c); if (j >= 0) sel.splice(j, 1); else if (sel.length < 4) sel.push(c);
        renderHand(); renderAct();
      };
      tilt(e, 16); bindHover(e, c.id); h.appendChild(e);
    });
    fresh.clear();
  }
  function renderFoeHand() {
    const h = $('#foeHand'); h.innerHTML = '';
    G.p[1 - ME].hand.forEach(() => h.appendChild(cardEl(null, { down: true })));
  }
  function renderCheat(name) {
    const l12 = G.lead(G.p[ME], 'L12');
    const rows = l12
      ? [['A、AA、AAA、AAAA', 1, '依牌型'], ['AB、AAB、AAAB', 3, '依牌型'], ['AABB', 4, 2], ['ABC', 5, 1], ['AABC', 6, 1]]
      : [['AAAA', 7, 1], ['AAAB', 6, 1], ['AAA', 5, 1], ['AABB', 4, 2], ['AAB、AABC', 3, 1], ['AA', 2, 1], ['A、AB、ABC', 1, 0]];
    const hit = r => name && r[0].split('、').includes(name);
    $('#cheat').innerHTML = `<h4>牌型速查<small>${l12 ? 'L12 專屬戰力' : 'A、B、C＝不同屬性'}</small></h4>
      <table><tr class="hd"><td>牌型</td><td>戰力</td><td>石像</td></tr>${rows.map(r => `<tr class="${hit(r) ? 'on' : ''}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
      <div class="kz"><span class="F">火</span>剋<span class="G">草</span>．<span class="G">草</span>剋<span class="W">水</span>．<span class="W">水</span>剋<span class="F">火</span><br>雙方牌型同等級時，剋制方 +2</div>`;
  }
  function renderAct() {
    const a = $('#actbar'); a.innerHTML = '';
    renderCheat(mode === 'choose' && sel.length ? shape(sel)[2] : null);
    if (mode === 'choose') {
      if (sel.length) {
        const [, cat, name] = shape(sel);
        const ctx = { core: [null, null], cat: [cat, cat], bonus: [0, 0], immune: [false, false] };
        ctx.bonus[ME] = G.ctx.bonus[ME];
        ctx.core[ME] = G.lead(G.p[ME], 'L12') ? sel[0].id[0] : coreOf(sel, cat);
        const pw = G.power(ME, sel, ctx);
        const sm = summonList(sel, cat, G.lead(G.p[ME], 'L12'));
        a.appendChild(el('div', 'preview', `${name}．${LEVEL_NAME[cat]}．核心${COLOR_NAME[ctx.core[ME]]}．戰力<b>${pw}</b>${sm.length ? `　召喚：${sm.map(c => CARDS[c.id].name).join('、')}` : '　不召喚'}`));
      } else a.appendChild(el('div', 'preview', '點選 1～4 張手牌，點選順序就是由左到右的排列'));
      const go = el('button', 'btn primary', '出牌'); go.disabled = !sel.length;
      go.onclick = () => { if (!resolver || mode !== 'choose') return; const r = resolver; resolver = null; mode = 'wait'; const s = sel.slice(); sel = []; renderHand(); renderAct(); r(s); };
      const sac = el('button', 'btn', '發動（獻祭）'); sac.disabled = !G.canSacList(ME).length;
      sac.title = sac.disabled ? (G.p[ME].sacUsed ? '本回合已經獻祭過' : G.ctx && G.ctx.blocked[ME] ? '本回合被封鎖，不能獻祭' : '沒有可以獻祭的石像') : '';
      sac.onclick = () => humanPreSac();
      if (sac.disabled === false && !resolver) sac.disabled = true;
      const clr = el('button', 'btn ghost', '清除'); clr.disabled = !sel.length; clr.onclick = () => { sel = []; renderHand(); renderAct(); };
      a.append(go, sac, clr);
    } else if (mode === 'post') {
      a.appendChild(el('div', 'preview', '點選發光的石像來獻祭，或按跳過'));
      const skip = el('button', 'btn primary', '跳過'); skip.onclick = () => { if (!resolver || mode !== 'post') return; const r = resolver; resolver = null; pickables = null; mode = 'wait'; renderAll(); r(null); };
      a.appendChild(skip);
    } else if (mode === 'boardpick') {
      a.appendChild(el('div', 'preview', '點選場上發光的石像'));
      if (boardSkip) { const sk = el('button', 'btn', '不反擊'); sk.onclick = () => boardSkip(); a.appendChild(sk); }
    } else if (mode === 'presac') {
      a.appendChild(el('div', 'preview', '點選要獻祭的石像'));
      const back = el('button', 'btn ghost', '取消'); back.onclick = () => { pickables = null; mode = 'choose'; renderAll(); };
      a.appendChild(back);
    }
  }
  function banner(text, ms) {
    $('#bannerText').textContent = text; $('#banner').hidden = false;
    if (ms) return wait(ms).then(() => { $('#banner').hidden = true; });
  }
  function hideBanner() { $('#banner').hidden = true; }

  // ---------- 特效 ----------
  function shatter(statueUid, big) {
    const e = stage.querySelector(`.zone.st .card[data-uid="${statueUid}"]`); if (!e) return;
    const r = relRect(e); const id = e.dataset.id; const fx = $('#fx');
    const n = big ? 4 : 3;
    for (let a = 0; a < n; a++) for (let b = 0; b < n + 1; b++) {
      const s = el('div', 'shard'); const w = r.w / n, h = r.h / (n + 1);
      Object.assign(s.style, { left: r.x + a * w + 'px', top: r.y + b * h + 'px', width: w + 'px', height: h + 'px', backgroundImage: `url(${img(id)})`, backgroundSize: `${r.w}px ${r.h}px`, backgroundPosition: `${-a * w}px ${-b * h}px` });
      const dx = (a - n / 2 + .5) * (big ? 60 : 30) + (Math.random() * 30 - 15), dy = (big ? 40 : -60) + (b - n / 2) * 30 + Math.random() * 40;
      s.style.setProperty('--dx', dx + 'px'); s.style.setProperty('--dy', dy + 'px'); s.style.setProperty('--dr', (Math.random() * 120 - 60) + 'deg');
      if (!big) s.style.filter = 'grayscale(1) brightness(1.6) sepia(.4)';
      fx.appendChild(s); setTimeout(() => s.remove(), 1000);
    }
    flash(r);
  }
  function flash(r) { const f = el('div', 'flash'); const sz = Math.max(r.w, r.h) * 1.8; Object.assign(f.style, { left: r.x + r.w / 2 - sz / 2 + 'px', top: r.y + r.h / 2 - sz / 2 + 'px', width: sz + 'px', height: sz + 'px' }); $('#fx').appendChild(f); setTimeout(() => f.remove(), 700); }
  function floatText(text, x, y, color) { const t = el('div', 'float-txt', text); Object.assign(t.style, { left: x + 'px', top: y + 'px', color }); $('#fx').appendChild(t); setTimeout(() => t.remove(), 1300); }
  function flashStatue(uid) { const e = stage.querySelector(`.zone.st .card[data-uid="${uid}"]`); if (e) flash(relRect(e)); }

  // ---------- 引擎事件 ----------
  const who = i => i === ME ? '我方' : '對手';
  async function onEvent(name, d) {
    switch (name) {
      case 'turnStart':
        revealed = false; lastSettle = null; $('#powers').innerHTML = ''; renderAll();
        await banner(`第 ${d.turn} 回合．${who(d.first)}先`, 900); break;
      case 'draw':
        if (d.i === ME) d.cards.forEach(c => fresh.add(c.uid));
        renderAll(); await wait(d.i === ME ? 380 : 120); break;
      case 'discard': case 'retrieve': renderAll(); await wait(300); break;
      case 'peek':
        if (d.i === ME) await modalCards('對手的手牌（隨機 2 張）', d.cards, { view: true });
        else await banner('對手查看了你 2 張手牌', 900);
        break;
      case 'seal': renderAll(); await wait(450); break;
      case 'sacrifice':
        sacFx.add(d.statue.uid); renderAll(); flashStatue(d.statue.uid);
        await banner(`${who(d.i)}獻祭 ${CARDS[d.statue.id].name}：${CARDS[d.statue.id].sac}`, 1100); sacFx.delete(d.statue.uid); break;
      case 'counter':
        sacFx.add(d.statue.uid); renderAll(); flashStatue(d.statue.uid);
        await banner(`${who(d.i)}反擊！${CARDS[d.target.id].name} 的效果無效`, 1200); sacFx.delete(d.statue.uid); break;
      case 'destroy': shatter(d.statue.uid, true); await wait(250); renderAll(); await wait(550); break;
      case 'reveal':
        mode = 'wait'; G.played[0].forEach(c => freshPlay.add(c.uid)); G.played[1].forEach(c => freshPlay.add(c.uid));
        renderAll(); await wait(550); revealed = true;
        stage.querySelectorAll('#zFoePlay .card').forEach(c => c.classList.remove('down'));
        await wait(650); renderAll(); break;
      case 'pass': if (d.i !== ME) await banner('對手跳過', 600); break;
      case 'g08': renderAll(); await wait(500); break;
      case 'settle': await showSettle(d); break;
      case 'summon':
        d.statues.forEach(s => freshStatue.add(s.uid));
        G.played[d.i] = []; renderAll(); await wait(d.statues.length ? 950 : 250); break;
      case 'gameover': await showResult(d); break;
    }
  }
  async function showSettle(d) {
    lastSettle = d; mode = 'wait'; renderAll();
    const box = $('#powers'); box.innerHTML = '';
    for (const i of [1, 0]) {
      const p = el('div', 'pw ' + (i === 0 ? 'me' : 'foe') + (d.w === P(i) ? ' won' : ''));
      p.style.top = (i === 0 ? 352 : 228) + 'px';
      const brk = d.br[P(i)].map(([l, v]) => `${l} ${v > 0 && l.indexOf('牌型') ? '+' : ''}${v}`).join('．');
      p.innerHTML = `<div class="num">0</div><div class="brk">${brk}</div>`;
      box.appendChild(p);
      const numEl = p.querySelector('.num'); const target = d.pw[P(i)];
      for (let k = 0; k <= Math.max(0, target); k++) setTimeout(() => numEl.textContent = k, k * 60 * speed);
      if (target < 0) numEl.textContent = target;
    }
    await wait(900);
    if (d.w !== null) { floatText(`+${d.gain}`, d.w === ME ? 560 : 700, 300, d.w === ME ? 'var(--me)' : 'var(--foe)'); renderOrbs(); renderSide(0); renderSide(1); }
    await banner(d.w === null ? `平手，雙方都不得分` : `${who(d.w)}得 ${d.gain} 分`, 1300);
  }
  async function showResult(d) {
    const w = d.winner; const howTxt = { points: '先拿到 4 分', leader: '達成隊長勝利條件', sudden: '加賽搶下 1 分', end: '回合上限，比較分數' }[d.how] || '';
    if (!tEnd) { tEnd = Date.now(); clearInterval(clockT); tickClock(); saveHistory(w === ME ? 0 : w === 1 - ME ? 1 : -1, d.how); }
    const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
    const rw = w === ME ? 0 : w === 1 - ME ? 1 : -1;
    b.appendChild(el('div', 'result ' + (rw === 0 ? 'win' : 'lose'), rw === 0 ? '勝利' : rw === 1 ? '敗北' : '平手'));
    b.appendChild(el('p', '', `${howTxt}．比分 ${G.p[ME].score} 比 ${G.p[1 - ME].score}．共 ${G.turn} 回合．用時 ${mmss(tEnd - t0)}`));
    const hist = loadHistory();
    if (hist.length > 1) b.appendChild(el('div', 'hist', '<b>最近對局</b>' + hist.slice(0, 5).map(h => `<span class="${h.w === 0 ? 'me' : h.w === 1 ? 'foe' : ''}">${h.date}　${h.w === 0 ? '勝' : h.w === 1 ? '敗' : '平'}　${h.score}　${h.turns} 回合　${mmss(h.ms)}</span>`).join('')));
    const r = el('div', 'mrow');
    const again = el('button', 'btn primary', '再戰一局');
    again.onclick = () => { m.hidden = true; if (net.on) { G = null; clearInterval(clockT); net.toPick(); } else { finalizeCfg(); startBattle(); } };
    if (net.on && !net.conn) again.disabled = true;
    const home = el('button', 'btn', '回首頁'); home.onclick = () => { m.hidden = true; G = null; clearInterval(clockT); if (net.on) net.close(); show('home'); };
    const lg = el('button', 'btn ghost', '對局紀錄'); lg.onclick = () => openLog(() => showResult(d));
    r.append(again, home, lg); b.appendChild(r); m.hidden = false;
  }
  function loadHistory() { try { return JSON.parse(localStorage.getItem('summon_hist') || '[]'); } catch { return []; } }
  function saveHistory(w, how) {
    const d = new Date(), date = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const h = [{ date, w, how, score: `${G.p[ME].score}:${G.p[1 - ME].score}`, online: !!net.on, turns: G.turn, ms: tEnd - t0 }, ...loadHistory()].slice(0, 20);
    try { localStorage.setItem('summon_hist', JSON.stringify(h)); } catch { }
  }
  function openLog(after) {
    const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
    b.appendChild(el('h3', '', `對局紀錄<small class="lgt">　${tEnd ? '總用時' : '已進行'} ${mmss((tEnd || Date.now()) - t0)}</small>`));
    const box = el('div', 'logbox');
    logs.slice().reverse().forEach(l => box.appendChild(el('p', l.who === 0 ? 'me' : l.who === 1 ? 'foe' : '', `<i class="ts">${mmss(l.t)}</i>回合 ${l.turn}．${l.who === 0 ? '我方' : l.who === 1 ? '對手' : ''} ${l.text}`)));
    if (!logs.length) box.appendChild(el('p', '', '還沒有紀錄'));
    b.appendChild(box);
    const x = el('button', 'btn small', '關閉'); x.onclick = () => { m.hidden = true; if (after) after(); }; b.appendChild(x);
    m.hidden = false;
  }
  $('#btnRuleQ').onclick = () => {
    if (!$('#modal').hidden) return;
    const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
    b.appendChild(el('h3', '', '規則速覽'));
    b.appendChild(el('div', 'logbox', `<p><b>怎麼贏</b>：先拿 4 分；或達成隊長的特殊勝利條件。</p>
<p><b>1 補牌</b>：手牌補到 5 張，處理石像【補牌】效果。</p>
<p><b>2 出牌</b>：選 1～4 張，點選順序＝由左到右。</p>
<p><b>3 翻牌</b>：雙方同時翻開。</p>
<p><b>4 戰力計算</b>：牌型戰力＋石像＋隊長＋剋制，高的人得 1 分，平手都不得分。</p>
<p><b>5 召喚石像</b>：不論輸贏，成對的那組最左邊 1 張變石像（兩對 2 張）。</p>
<p><b>6 整理</b>：其餘出戰牌進棄牌區。</p>
<p><b>獻祭</b>：補牌後到戰力計算前，每回合可以獻祭 1 座石像，發動它的獻祭效果；獻祭後橫放在獻祭區。</p>
<p><b>核心屬性</b>：重複最多的顏色；兩對或沒成對時看最左邊那張。</p>
<p><b>剋制</b>：火剋草、草剋水、水剋火，雙方牌型同等級時剋制方 +2。等級：單張＜一對＜兩對＜三同屬＜四同屬。</p>`));
    const x = el('button', 'btn small', '關閉'); x.onclick = () => m.hidden = true; b.appendChild(x);
    m.hidden = false;
  };
  $('#btnLog').onclick = () => { if ($('#modal').hidden) openLog(); };
  $('#btnSpeed').onclick = e => { speed = speed === 1 ? .4 : 1; e.currentTarget.setAttribute('aria-pressed', speed !== 1); e.currentTarget.textContent = speed === 1 ? '加速' : '正常'; };
  $('#btnQuit').onclick = () => {
    const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
    b.appendChild(el('h3', '', '要離開這局對戰嗎？')); b.appendChild(el('p', '', net.on ? '離開會中斷連線，對手會看到你已離線。' : '這局的進度不會保留。'));
    const r = el('div', 'mrow'); const y = el('button', 'btn primary', '離開'); const n = el('button', 'btn', '繼續對戰');
    y.onclick = () => { m.hidden = true; G = null; resolver = null; clearInterval(clockT); if (net.on) net.close(); show('home'); }; n.onclick = () => m.hidden = true;
    r.append(n, y); b.appendChild(r); m.hidden = false;
  };

  // ---------- 彈窗選擇 ----------
  function modalCards(title, cards, o = {}) {
    return new Promise(res => {
      const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
      b.appendChild(el('h3', '', title));
      if (o.sub) b.appendChild(el('p', '', o.sub));
      const row = el('div', 'mcards'); const chosen = [];
      const n = o.n || 1;
      const ok = el('button', 'btn primary', o.view ? '知道了' : '確定');
      cards.forEach(c => {
        const id = c.id; const e = cardEl(id); bindHover(e, id);
        if (!o.view) e.onclick = () => {
          const k = chosen.indexOf(c); if (k >= 0) chosen.splice(k, 1); else { if (chosen.length >= n) chosen.shift(); chosen.push(c); }
          row.querySelectorAll('.card').forEach((x, j) => x.classList.toggle('sel', chosen.includes(cards[j])));
          ok.disabled = chosen.length !== Math.min(n, cards.length);
        };
        row.appendChild(e);
      });
      b.appendChild(row);
      const r = el('div', 'mrow');
      if (!o.view) ok.disabled = true;
      ok.onclick = () => { m.hidden = true; $('#tip').hidden = true; res(o.view ? [] : chosen.slice()); };
      r.appendChild(ok);
      if (o.optional) { const sk = el('button', 'btn ghost', o.skipText || '跳過'); sk.onclick = () => { m.hidden = true; $('#tip').hidden = true; res([]); }; r.appendChild(sk); }
      b.appendChild(r); m.hidden = false;
    });
  }
  function modalG08(cards) {
    return new Promise(res => {
      const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
      b.appendChild(el('h3', '', '花冠幻術師：變換 1 張出戰牌的屬性'));
      let pick = null, color = null;
      const row = el('div', 'mcards'), cols = el('div', 'mrow');
      const ok = el('button', 'btn primary', '確定'); ok.disabled = true;
      const upd = () => { row.querySelectorAll('.card').forEach((x, j) => x.classList.toggle('sel', cards[j] === pick)); cols.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.c === color)); ok.disabled = !(pick && color); };
      cards.forEach(c => { const e = cardEl(c.id); e.onclick = () => { pick = c; upd(); }; row.appendChild(e); });
      for (const c of ['F', 'W', 'G']) { const x = el('button', 'colorbtn ' + c, COLOR_NAME[c]); x.dataset.c = c; x.onclick = () => { color = c; upd(); }; cols.appendChild(x); }
      ok.onclick = () => { m.hidden = true; res({ card: pick, color }); };
      b.append(row, el('p', '', '變成：'), cols, ok); m.hidden = false;
    });
  }

  function boardPick(list, text, skipText) {
    return new Promise(res => {
      const prev = mode; mode = 'boardpick';
      boardSkip = skipText ? () => { pickables = null; boardSkip = null; mode = prev; hideBanner(); renderAll(); res(null); } : null;
      pickables = { list, on: st => { pickables = null; boardSkip = null; mode = prev; hideBanner(); renderAll(); res(st); } };
      banner(text); renderAll();
    });
  }
  let boardSkip = null;
  async function humanPreSac() {
    if (mode !== 'choose' || !resolver) return;
    const list = G.canSacList(ME); if (!list.length) return;
    mode = 'presac';
    pickables = { list, on: async st => {
      if (mode !== 'presac' || !resolver) return;
      pickables = null; mode = 'busy'; renderAll();
      if (net.on) net.send({ k: 'presac', uid: st.uid });
      await G.sacrifice(ME, st, 'pre');
      if (!G) return;
      if (G.winner === null) { mode = 'choose'; renderAll(); }
      else if (resolver) { const r = resolver; resolver = null; r([]); }
    } };
    renderAll();
  }

  // ---------- 玩家控制 ----------
  const Human = {
    choose(g, i) {
      return new Promise(res => {
        resolver = res; mode = 'choose'; sel = []; hideBanner(); renderAll();
        banner('選擇出戰牌', 800);
      });
    },
    decideSac(g, i, phase) {
      return new Promise(res => {
        const list = g.canSacList(i);
        resolver = res; mode = 'post';
        pickables = { list, on: st => { if (!resolver) return; const r = resolver; resolver = null; pickables = null; mode = 'wait'; renderAll(); r(st); } };
        renderAll(); banner('獻祭時間：可以獻祭 1 座石像，或跳過');
      }).then(v => { hideBanner(); return v; });
    },
    respondCounter(g, j, effId, opts) {
      return boardPick(opts, `對手獻祭 ${CARDS[effId].name}：${CARDS[effId].sac}。點發光的石像反擊，或不反擊`, '不反擊');
    },
    async pick(g, i, kind, o) {
      switch (kind) {
        case 'retrieve': return modalCards(`取回：從棄牌區選 ${o.n} 張`, o.cards, { n: o.n });
        case 'tutor': return modalCards(o.title, o.cards, { n: 1 });
        case 'discardOne': return modalCards(o.title, o.cards, { n: 1 });
        case 'swap': return modalCards(o.title, o.cards, { n: 1 });
        case 'l02': return modalCards(o.title, o.cards, { n: 1, optional: true, skipText: '不交換' });
        case 'destroy': case 'seal': case 'copy': { const s = await boardPick(o.statues, o.title + '：點選場上發光的石像'); return s ? [s] : []; }
        case 'g08': return modalG08(o.cards);
      }
      return [];
    },
  };

  // ================= 連線對戰 =================
  const PEER_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const ROOM_PREFIX = 'summon-cards-vj1023-';
  const net = {
    on: false, host: false, peer: null, conn: null, code: '', myCfg: null, peerCfg: null, game: 0, queue: [], waiters: [],
    send(m) { if (this.conn && this.conn.open) this.conn.send({ ...m, g: this.game }); },
    close(silent) {
      const c = this.conn; this.conn = null;
      try { c && c.close(); } catch { } try { this.peer && this.peer.destroy(); } catch { }
      this.peer = null; this.on = false; this.queue = []; this.waiters.forEach(w => w.rej && w.rej()); this.waiters = [];
    },
    // 對戰中的訊息佇列
    next(kind) {
      return new Promise(res => {
        const take = () => { const m = this.queue.shift(); if (m.k !== kind && !(kind === 'choose' && (m.k === 'presac' || m.k === 'play'))) console.warn('同步異常', kind, m); res(m); };
        if (this.queue.length) take(); else { $('#netState').hidden = false; this.waiters.push({ take: () => { $('#netState').hidden = true; take(); } }); }
      });
    },
    onData(m) {
      if (!m || typeof m !== 'object') return;
      switch (m.k) {
        case 'hello': return;
        case 'cfg': this.peerCfg = m.cfg; renderNetPick(); if (this.host) this.tryStart(); return;
        case 'start': this.beginGame(m); return;
        case 'bye': this.lost('對手已離開房間'); return;
      }
      if (m.g !== this.game) return;
      this.queue.push(m);
      const w = this.waiters.shift(); if (w) w.take();
    },
    lost(text) {
      const was = this.conn; this.conn = null;
      if (!this.on) return;
      if (G && G.winner === null) { G = null; resolver = null; clearInterval(clockT); }
      const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
      b.append(el('h3', '', '連線中斷'), el('p', '', text || '和對手的連線已中斷。'));
      const ok = el('button', 'btn primary', '回首頁'); ok.onclick = () => { m.hidden = true; this.close(); show('home'); };
      b.appendChild(ok); m.hidden = false;
    },
    bind(conn) {
      this.conn = conn;
      conn.on('data', d => this.onData(d));
      conn.on('close', () => { if (this.conn === conn) this.lost(); });
      conn.on('error', () => { if (this.conn === conn) this.lost(); });
    },
    toPick() { this.myCfg = null; cfg = { me: {}, foe: {} }; pickStep = 'me'; renderPick(); show('pick'); renderNetPick(); },
    ready() {
      const s = cfg.me; this.myCfg = { leader: s.leader, deck: s.deck, main: s.leader === 'L11' ? s.main : undefined };
      this.send({ k: 'cfg', cfg: this.myCfg }); renderNetPick();
      if (this.host) this.tryStart();
    },
    tryStart() {
      if (!this.myCfg || !this.peerCfg) return;
      const m = { k: 'start', seed: (Math.random() * 2 ** 31) | 0, cfgs: [this.myCfg, this.peerCfg], game: this.game + 1 };
      this.send(m); this.beginGame(m);
    },
    beginGame(m) {
      this.game = m.game; this.queue = []; this.waiters = [];
      const me = this.host ? 0 : 1;
      cfg = { me: { ...m.cfgs[me] }, foe: { ...m.cfgs[1 - me], realLeader: m.cfgs[1 - me].leader } };
      this.myCfg = null; this.peerCfg = null;
      renderVS(); show('vs'); $('#vsStart').hidden = true; $('#vsBack').hidden = true;
      $('#vsHint').hidden = false;
      setTimeout(() => { if (!this.on) return; $('#vsStart').hidden = false; $('#vsBack').hidden = false; $('#vsHint').hidden = true; startBattle({ me, seed: m.seed, cfgs: m.cfgs }); }, 2600);
    },
  };
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = PEER_SRC; sc.onload = res; sc.onerror = () => rej(new Error('load')); document.head.appendChild(sc); });
  }
  function onlineMsg(text, err) { const e = $('#onMsg'); e.textContent = text; e.classList.toggle('err', !!err); }
  async function createRoom() {
    onlineMsg('建立房間中…');
    try { await loadPeer(); } catch { onlineMsg('連線元件載入失敗，請確認網路後再試', true); return; }
    const code = String(Math.floor(1000 + Math.random() * 9000)) + 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)];
    net.close(); net.on = true; net.host = true; net.code = code; net.game = 0;
    const peer = new window.Peer(ROOM_PREFIX + code); net.peer = peer;
    peer.on('open', () => { $('#roomCode').textContent = code; $('#roomBox').hidden = false; onlineMsg('把房間代碼告訴朋友，等待對手加入…'); });
    peer.on('connection', conn => {
      if (net.conn) { conn.on('open', () => { conn.send({ k: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
      conn.on('open', () => { net.bind(conn); conn.send({ k: 'hello' }); net.toPick(); });
    });
    peer.on('error', e => { if (e.type === 'unavailable-id') { net.close(); createRoom(); } else if (!net.conn) onlineMsg('建立房間失敗：' + (e.type || '網路錯誤'), true); });
  }
  async function joinRoom() {
    const code = $('#joinCode').value.trim().toUpperCase();
    if (!/^\d{4}[A-Z]$/.test(code)) { onlineMsg('請輸入 4 個數字＋1 個英文字母的房間代碼，例如 3842K', true); return; }
    onlineMsg('連線中…');
    try { await loadPeer(); } catch { onlineMsg('連線元件載入失敗，請確認網路後再試', true); return; }
    net.close(); net.on = true; net.host = false; net.code = code; net.game = 0;
    const peer = new window.Peer(); net.peer = peer;
    let timer = setTimeout(() => { if (!net.conn) { onlineMsg('找不到這個房間，請確認代碼或請對方重新建立', true); net.close(); } }, 12000);
    peer.on('open', () => {
      const conn = peer.connect(ROOM_PREFIX + code, { reliable: true });
      conn.on('open', () => { clearTimeout(timer); net.bind(conn); net.toPick(); });
      conn.on('data', d => { if (d && d.k === 'full') { onlineMsg('這個房間已經滿了', true); net.close(); show('online'); } });
    });
    peer.on('error', e => { clearTimeout(timer); if (!net.conn) { onlineMsg(e.type === 'peer-unavailable' ? '找不到這個房間，請確認代碼' : '連線失敗：' + (e.type || '網路錯誤'), true); net.close(); } });
  }
  function renderNetPick() {
    const box = $('#netPick'); if (!box) return;
    if (!net.on) return;
    box.innerHTML = `房間 <b>${net.code}</b>．你是${net.host ? '房主' : '挑戰者'}<br>你：${net.myCfg ? '<b class="ok">已準備</b>' : '選擇中'}　對手：${net.peerCfg ? '<b class="ok">已準備</b>' : '選擇中'}`;
  }
  $('#btnOnline').onclick = () => { net.close(); $('#roomBox').hidden = true; onlineMsg(''); show('online'); };
  $('#btnCreate').onclick = createRoom;
  $('#btnJoin').onclick = joinRoom;
  $('#joinCode').onkeydown = e => { if (e.key === 'Enter') joinRoom(); };
  $('#onlineBack').onclick = () => { net.close(); show('home'); };
  addEventListener('beforeunload', () => { if (net.conn) try { net.conn.send({ k: 'bye' }); } catch { } });

  // 對手（遠端）控制器：照收到的訊息執行
  const byUid = (pool, uids) => (uids || []).map(u => pool.find(x => x.uid === u)).filter(Boolean);
  const Remote = {
    async choose(g, i) {
      for (;;) {
        const m = await net.next('choose');
        if (m.k === 'presac') {
          const st = g.p[i].statues.find(s => s.uid === m.uid);
          if (st) await g.sacrifice(i, st, 'pre');
          if (g.winner !== null) return [];
        } else return byUid(g.p[i].hand, m.uids);
      }
    },
    async decideSac(g, i) { const m = await net.next('sac'); return m.uid == null ? null : g.canSacList(i).find(s => s.uid === m.uid) || null; },
    async respondCounter(g, j, effId, opts) { const m = await net.next('counter'); return m.uid == null ? null : opts.find(s => s.uid === m.uid) || null; },
    async pick(g, i, kind, o) {
      const m = await net.next('pick');
      if (kind === 'g08') return m.g08 ? { card: o.cards.find(c => c.uid === m.g08.uid), color: m.g08.color } : null;
      return byUid(o.cards || o.statues, m.uids);
    },
  };
  // 本機玩家（連線版）：決定後同步給對手
  const NetHuman = {
    async choose(g, i) { const r = await Human.choose(g, i); net.send({ k: 'play', uids: r.map(c => c.uid) }); return r; },
    async decideSac(g, i, ph) { const r = await Human.decideSac(g, i, ph); net.send({ k: 'sac', uid: r ? r.uid : null }); return r; },
    async respondCounter(g, j, effId, opts) { const r = await Human.respondCounter(g, j, effId, opts); net.send({ k: 'counter', uid: r ? r.uid : null }); return r; },
    async pick(g, i, kind, o) {
      const r = await Human.pick(g, i, kind, o);
      if (kind === 'g08') net.send({ k: 'pick', g08: r && r.card ? { uid: r.card.uid, color: r.color } : null });
      else net.send({ k: 'pick', uids: (r || []).map(x => x.uid) });
      return r;
    },
  };

  window.__summonState = () => G && JSON.stringify({ me: ME, turn: G.turn, phase: G.phase, first: G.first, q: net.queue.length, w: net.waiters.length, p: G.p.map(p => ({ s: p.score, h: p.hand.map(c => c.uid), d: p.deck.length, x: p.disc.length, st: p.statues.map(t => t.uid + (t.up ? '' : 'v') + (t.sealed ? 's' : '')), u: p.sacUsed })) });
  show('home');
})();
