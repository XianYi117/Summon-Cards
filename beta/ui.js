// 召喚｜畫面與互動
(function () {
  const { Game, AI, shape, coreOf, summonList, colorOf, LEVEL_NAME } = window.Engine;
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
    c.innerHTML = `<div class="inner"><div class="face">${id ? `<img src="${img(id, o.hi)}" alt="${id} ${nm}" decoding="async"${o.lazy ? ' loading="lazy"' : ''}>` : ''}</div><div class="back"></div></div><div class="shade"></div><div class="glare"></div>`;
    return c;
  }
  // 滑鼠懸停時卡片傾斜＋高亮；用 requestAnimationFrame 節流（每個畫面最多算一次），觸控裝置不啟用
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function tilt(c, strength = 14) {
    if (!canHover) return;
    const inner = c.querySelector('.inner');
    let ev = null, raf = 0;
    const apply = () => {
      raf = 0; if (!ev) return;
      const r = c.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      inner.style.transform = `${c.classList.contains('down') ? 'rotateY(180deg) ' : ''}rotateX(${(.5 - y) * strength}deg) rotateY(${(x - .5) * strength}deg)`;
    };
    c.addEventListener('pointerenter', () => c.classList.add('lit'));
    c.addEventListener('pointermove', e => { ev = e; if (!raf) raf = requestAnimationFrame(apply); });
    c.addEventListener('pointerleave', () => { ev = null; if (raf) cancelAnimationFrame(raf); raf = 0; inner.style.transform = ''; c.classList.remove('lit'); });
  }

  // ---------- 畫面切換 ----------
  const screens = ['home', 'pick', 'vs', 'battle', 'rules', 'gallery', 'online', 'watchScr'];
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
  // 隨機隊長只從這些隊長中挑（L10～L13 調整中，暫不參與隨機；仍可手動選）
  const RANDOM_LEADERS = leaderIds.filter(id => !['L10', 'L11', 'L12', 'L13'].includes(id));
  let showAllShared = false;
  window.onCloudDecks = () => { if (!$('#pick').hidden) renderPick(); };
  function renderPick() {
    const s = cfg[pickStep], isFoe = pickStep === 'foe';
    $('#pickStep').textContent = net.on ? `連線對戰．房間 ${net.code}` : isFoe ? 'STEP 2 / 2' : 'STEP 1 / 2';
    $('#pickTitle').textContent = isFoe ? '選擇對手的隊長與牌組' : '選擇你的隊長與牌組';
    renderNetPick();
    const grid = $('#leaderGrid'); grid.innerHTML = '';
    grid.classList.toggle('has-pick', !!s.leader);
    const list = [...leaderIds, 'RANDOM'];
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
    else if (s.leader === 'RANDOM') inf.append(el('h3', '', '隨機隊長'), el('div', 'desc', `開戰時從 L01～L09（${RANDOM_LEADERS.length} 位）中隨機決定；L10～L13 調整中，不會被隨機選到，但可以手動選擇。`));
    else {
      const L = LEADERS[s.leader];
      inf.append(el('div', 'lab', `${s.leader}．${COLOR_NAME[L.color]}屬性．${L.race}`), el('h3', '', L.name), el('div', 'skill', L.skill), el('div', 'desc', L.text));
      if (s.leader === 'L11') {
        inf.appendChild(el('div', 'lab', '宣告主色（開局公開，雙方都看得到）'));
        const row = el('div', 'chips');
        for (const col of ['F', 'W', 'G']) {
          const b = el('button', 'colorbtn ' + col, COLOR_NAME[col]); b.setAttribute('aria-pressed', s.main === col);
          b.onclick = () => { s.main = col; s.mainTouched = true; renderPick(); }; row.appendChild(b);
        }
        inf.appendChild(row);
      }
    }
    inf.appendChild(el('div', 'lab', '牌組'));
    for (const [tier, title] of [['初階', '初階預組'], ['進階', '進階預組'], ['個人', '個人構築'], ['分享', '玩家分享'], ['其他', '其他']]) {
      let keys = Object.keys(DECKS).filter(k => (DECKS[k].tier || '其他') === tier);
      if (!keys.length) continue;
      // 玩家分享太多時先收合，只顯示最新 6 副（選中的那副一定顯示）
      const more = tier === '分享' && keys.length > 6 && !showAllShared;
      if (more) keys = keys.filter((k, i) => i < 6 || k === s.deck);
      inf.appendChild(el('div', 'dtier', title + (tier === '分享' ? `<small>．${Object.keys(DECKS).filter(k => DECKS[k].tier === '分享').length} 副</small>` : '')));
      const dk = el('div', 'chips decks');
      for (const key of keys) {
        const d = DECKS[key];
        const sub = d.fixed ? `<small>${d.custom ? '自訂．' : ''}${Object.entries(d.comp).filter(([, v]) => v).map(([k, v]) => `<span class="dot ${k}"></span>${COLOR_NAME[k]}${v}`).join(' ')}${d.leader ? `．${LEADERS[d.leader].name}` : ''}</small>` : d.comp ? `<small>${Object.entries(d.comp).map(([k, v]) => `<span class="dot ${k}"></span>${COLOR_NAME[k]}${v}`).join(' ')}</small>` : `<small>全部 ${Object.keys(CARDS).length} 張中隨機 20 張．每屬性最多 ${ATTR_MAX}</small>`;
        const b = el('button', 'chip', `<span>${d.label}</span>${sub}`); b.setAttribute('aria-pressed', s.deck === key);
        b.onclick = () => {
          s.deck = key;
          if (d.leader && !(net.on && net.myCfg)) { s.leader = d.leader; if (d.leader !== 'L11') delete s.main; }
          if (s.leader === 'L11' && !s.mainTouched && d.comp) s.main = Object.entries(d.comp).sort((a, b) => b[1] - a[1])[0][0];
          renderPick();
        };
        dk.appendChild(b);
      }
      if (more) { const mb = el('button', 'chip', '<span>顯示全部…</span>'); mb.onclick = () => { showAllShared = true; renderPick(); }; dk.appendChild(mb); }
      inf.appendChild(dk);
    }
    if (DECKS[s.deck] && DECKS[s.deck].desc) inf.appendChild(el('div', 'desc', DECKS[s.deck].desc));
    const brow = el('div', 'mrow'); brow.style.justifyContent = 'flex-start';
    const bl = el('button', 'btn ghost small', '＋ 新增牌組'); bl.onclick = () => { location.href = SHARED_BASE + '../builder/#new'; };
    const bm = el('button', 'btn ghost small', '管理我的牌組（編輯／刪除）'); bm.onclick = () => { location.href = SHARED_BASE + '../builder/#manage'; };
    brow.append(bl, bm); inf.appendChild(brow);
    const ok = s.leader && s.deck && (s.leader !== 'L11' || s.main);
    const act = el('div', 'pick-actions');
    const next = el('button', 'btn primary', net.on ? (net.myCfg ? '已準備，等待對手…' : '準備完成') : isFoe ? '確認對手' : '下一步'); next.disabled = !ok || (net.on && !!net.myCfg);
    next.onclick = () => { if (net.on) { net.ready(); renderPick(); return; } if (!isFoe) { pickStep = 'foe'; renderPick(); } else { finalizeCfg(); renderVS(); show('vs'); } };
    act.appendChild(next); inf.appendChild(act);
    if (net.on) { const np = el('div', 'netpick'); np.id = 'netPick'; inf.appendChild(np); renderNetPick(); }
    if (s.leader === 'L11' && !s.main) inf.appendChild(el('div', 'empty', '請選擇冥火貓妖的主色。'));
  }
  $('#pickBack').onclick = () => { if (net.on) { if (net.conn) net.send({ k: 'bye' }); net.close(); show('home'); return; } if (pickStep === 'foe') { pickStep = 'me'; renderPick(); } else show('home'); };
  // 依牌組類型抽出 20 張（每色張數照設定，色內隨機）
  function rollDeck(type) {
    if (DECKS[type] && DECKS[type].fixed) return DECKS[type].fixed.slice();
    const comp = (DECKS[type] || DECKS.RND).comp;
    if (!comp) return randomDeckIds();
    const out = [];
    for (const col of ['F', 'W', 'G']) {
      const ids = Object.keys(CARDS).filter(id => id[0] === col).sort(() => Math.random() - .5);
      out.push(...ids.slice(0, comp[col]).sort());
    }
    return out;
  }
  function resolveSide(s) {
    s.realLeader = s.leader === 'RANDOM' ? RANDOM_LEADERS[Math.floor(Math.random() * RANDOM_LEADERS.length)] : s.leader;
    if (s.realLeader !== 'L11') delete s.main;
    else if (!s.main) s.main = ['F', 'W', 'G'][Math.floor(Math.random() * 3)];
    s.cards = rollDeck(s.deck);
  }
  function finalizeCfg() { resolveSide(cfg.me); resolveSide(cfg.foe); }
  // 查看牌組：依屬性列出 20 張
  function openDeckView(cards, title) {
    const m = $('#deckView'); m.innerHTML = '';
    const box = el('div', 'dvbox');
    const cnt = { F: 0, W: 0, G: 0 }; cards.forEach(id => cnt[id[0]]++);
    box.appendChild(el('h3', '', `${title}<small>　火 ${cnt.F}．水 ${cnt.W}．草 ${cnt.G}，共 ${cards.length} 張</small>`));
    const grid = el('div', 'dvgrid');
    for (const id of cards) {
      const d = CARDS[id], row = el('div', 'dvcard ' + id[0]);
      row.appendChild(cardEl(id));
      row.appendChild(el('div', 'dvtx', `<b>${id} ${d.name}</b><span><i>啟動</i>${d.act}</span><span><i>獻祭</i>${d.sac}</span>`));
      grid.appendChild(row);
    }
    box.appendChild(grid);
    const x = el('button', 'btn', '關閉'); x.onclick = () => { m.hidden = true; }; box.appendChild(x);
    m.appendChild(box); m.hidden = false; m.onclick = e => { if (e.target === m) m.hidden = true; };
  }
  function renderVS() {
    const side = (box, s, who) => {
      box.innerHTML = '';
      const id = s.realLeader || s.leader;
      const c = cardEl(id, { hi: true }); tilt(c, 10); box.appendChild(c);
      box.appendChild(el('div', 'nm', `${who}．${LEADERS[id].name}`));
      box.appendChild(el('div', 'dk', `牌組：${s.deckLabel || (DECKS[s.deckType || s.deck] || { label: '自訂' }).label}${s.main ? `．宣告主色 <span class="ctag ${s.main}">${COLOR_NAME[s.main]}</span>` : ''}${s.leader === 'RANDOM' || s.randLeader ? '．隨機隊長' : ''}`));
    };
    preloadCards([cfg.me.realLeader, cfg.foe.realLeader, ...(cfg.me.cards || []), ...(cfg.foe.cards || [])]);
    side($('#vsFoe'), cfg.foe, '對手'); side($('#vsMe'), cfg.me, '我方');
    $('#vsReroll').hidden = net.on || !!(DECKS[cfg.me.deck] && DECKS[cfg.me.deck].fixed);
  }
  $('#vsBack').onclick = () => { pickStep = 'me'; renderPick(); show('pick'); };
  $('#vsStart').onclick = () => startBattle();
  $('#vsDeck').onclick = () => openDeckView(cfg.me.cards || [], '我方牌組');
  $('#vsReroll').onclick = () => { cfg.me.cards = rollDeck(cfg.me.deck); openDeckView(cfg.me.cards, '我方牌組（重新抽過）'); };

  // ---------- 規則 ----------
  const grpOf = n => /^AAAA/.test(n) ? 'g4' : /^AAA/.test(n) ? 'g3' : /^A、AB|無牌型/.test(n) ? 'g1' : 'g2';
  function renderRules() {
    const pw = [['AAAA', '火火火火', 7, '1 張'], ['AAAB', '火火火水', 6, '1 張'], ['AAA', '火火火', 5, '1 張'], ['AABB', '火火水水', 4, '2 張'], ['AAB、AABC', '火火水、火火水草', 3, '1 張'], ['AA', '火火', 2, '1 張'], ['無牌型（雜色）', '火、火水、火水草', 1, '不能']];
    const words = [['【補牌】', '回合開始的補牌階段。寫「【補牌】：」的效果在補到 5 張後觸發。'], ['【出牌】前', '雙方選牌之前。'], ['【翻牌】前', '雙方翻開出戰牌之前。'],
      ['【整理】', '回合最後的整理階段，場上其餘卡牌進棄牌區之前。'], ['【多抽】', '補滿 5 張以外，額外從牌庫抽牌；不受 5 張限制。'], ['【換牌】', '棄 1 張手牌，再抽 1 張。'],
      ['【反擊】', '在對手獻祭時回應，讓對手這次獻祭無效。'], ['【啟動】石像', '回合流程第 5 步：把成對那組最左邊的出戰牌變成石像。和石像直立時的「啟動效果」不同。'], ['【我方】／【對方】／【雙方】', '效果觸發的對象範圍。'], ['直立石像', '直放、未獻祭的石像；啟動效果有效。'],
      ['已獻祭石像', '橫放的石像，沒有任何技能。'], ['出戰牌', '本回合翻開比戰力的牌。'], ['牌型有 AA', 'AA、AAB、AABC、AABB。'], ['牌型有 AAA', 'AAA、AAAB。'], ['雜色', 'AB、ABC。'],
      ['剋制加成', '剋制成功時的戰力加成，基本 +2。'], ['取回', '從棄牌區選牌加入手牌。'], ['牌庫頂／牌庫底', '牌庫最上面／最下面。'], ['本回合', '到這回合整理階段結束為止；一次性封印例外。'], ['（每回合執行一次）', '同一回合內最多觸發 1 次。']];
    const cc = cards => { const c = { F: 0, W: 0, G: 0 }; cards.forEach(id => c[id[0]]++); return `火 ${c.F}．水 ${c.W}．草 ${c.G}`; };
    $('#rulesBody').innerHTML = `
<h3>怎麼贏</h3>
<div class="wins3"><div><b>得分勝利</b>先拿到 4 分。每回合比戰力，贏的人得 1 分；平手都不得分。</div><div><b>隊長勝利</b>部分隊長有自己的勝利條件，達成就立刻獲勝。</div><div><b>石像勝利</b>石像卡上寫明的勝利效果。</div></div>
<p class="rnote">雙方同時達成勝利條件時，進入搶 1 分加賽：繼續打，下一個得分的人獲勝。</p>
<h3>卡牌構築、開始設置</h3>
<ul><li><b>構築</b>：每人組合 20 張卡牌（一種屬性最多 8 張，編號不得重複）和 1 位隊長。</li>
<li><b>設置</b>：挑選 1 位隊長，洗牌後各抽 5 張。猜拳決定第一回合的起始玩家，之後每回合輪流當起始玩家。</li></ul>
<h3>回合流程</h3>
<ol><li><b>補牌</b>：手牌補到 5 張，再處理石像【補牌】的效果，例如【多抽】、【換牌】。</li>
<li><b>出牌</b>：雙方同時選 1～4 張排好順序，蓋著出。</li><li><b>翻牌</b>：雙方同時翻開。</li>
<li><b>戰力計算</b>：計算牌型戰力、石像與隊長加成、屬性剋制，戰力高的人得 1 分；平手都不得分。</li>
<li><b>【啟動】石像</b>：不論輸贏，出了成對以上的牌型，就把其中 1 張變成石像（AABB 2 張）。</li>
<li><b>整理</b>：處理石像【整理】的效果，場地上的其餘卡牌進入棄牌區。</li></ol>
<div class="box"><b>獻祭</b>：可於補牌後～戰力計算之間發動，獻祭 1 座自己的石像，發動它的獻祭效果。每人每回合最多 1 次。</div>
<h3>石像</h3>
<ul><li>每張石像有兩個技能：<b>啟動</b>是石像直立期間一直有效；<b>獻祭</b>是把石像橫放，換一次效果。</li>
<li>獻祭過的石像橫放在石像區，不再有任何能力。</li><li>石像會被對手破壞或封印，要想辦法保護自己的石像，也可以去拆對手的。</li></ul>
<h3>牌型大小</h3>
<p>同屬性越多越強，A、B、C 代表不同屬性。字色相同的是同一組。</p>
<div class="tbl"><table><tr><th>牌型</th><th>例子</th><th>戰力</th><th>變成石像</th></tr>${pw.map(r => `<tr><td class="${grpOf(r[0])}">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</table></div>
<p><b>剋制</b>：<span class="F">火</span>剋<span class="G">草</span>、<span class="G">草</span>剋<span class="W">水</span>、<span class="W">水</span>剋<span class="F">火</span>。不限牌型，每回合都比較雙方的核心屬性，剋制的一方戰力 +2。</p>
<details><summary>詳細規則</summary>
<h4>1. 抽牌與牌庫</h4><ul><li>沒用完的手牌會留著，補牌時補到 5 張。</li><li>牌庫抽完時，把棄牌區洗成新牌庫繼續抽。石像區的牌不洗回。</li></ul>
<h4>2. 核心屬性與剋制</h4><ul><li><b>核心屬性</b>：重複最多的屬性，例如火火水草 → 火。AABB 和無牌型（雜色）看最左邊那張，例如火火水水 → 火、草火水 → 草。</li><li><b>剋制不限牌型</b>：每回合都比較雙方的核心屬性，例如 AA 的火對上 AAA 的草，火方照樣 +2。</li></ul>
<h4>3. 【啟動】哪一張</h4><ul><li>只能從成對的那組牌中【啟動】，固定取最左邊那張。AABB 時，兩組各取最左邊那張。</li><li>出牌時點選的順序就是由左到右的排列，會決定核心屬性和哪一張變成石像。</li><li>無牌型不能【啟動】，卡上另有寫明的除外。</li></ul>
<h4>4. 獻祭的順序</h4><ul><li><b>【反擊】</b>：對手獻祭時才能發動，讓對手這次獻祭無效。</li><li><b>本回合對手不能獻祭</b>：主動發動；對手可以用【反擊】回應。</li><li><b>翻牌前</b>才能發動的獻祭：宣告核心屬性、看對手出戰牌。看對手出戰牌要在對手已出牌、自己還沒出牌時才看得到。</li></ul>
<ol><li>翻牌前（補牌後、出牌時）雙方隨時可以獻祭；翻牌後進入獻祭時間，畫面會顯示雙方目前戰力。</li><li>獻祭時間從起始玩家開始，雙方輪流宣告「獻祭」或「跳過」。</li><li>跳過不代表放棄，對手之後獻祭時，你還是可以【反擊】。</li><li>雙方連續都跳過，獻祭時間就結束。</li></ol>
<h4>5. 石像的狀態與封印</h4><div class="tbl"><table><tr><th>狀態</th><th>擺法</th><th>技能</th><th>算進屬性數量</th></tr><tr><td>直立</td><td>直放</td><td>啟動有效，可以獻祭</td><td>算</td></tr><tr><td>已獻祭</td><td>橫放</td><td>沒有任何技能</td><td>不算（只算獻祭數量）</td></tr><tr><td>封印中</td><td>直放</td><td>啟動無效，也不能獻祭</td><td>算</td></tr></table></div>
<ul><li><b>破壞</b>：被破壞的石像進擁有者的棄牌區，之後會洗回牌庫。</li><li><b>封印通則</b>：封印讓對手有優勢的能力失效；累積的數值保留不變。</li>
<li><b>一次性封印</b>（獻祭效果，例如「本回合對手隊長效果無效」）：【戰力計算】完畢後、【啟動】石像之前解除。所以 L01 被封印的回合沒有連勝加成，但贏了照樣 +1、輸了照樣歸零；【啟動】石像後的隊長勝利條件、整理階段的能力也照常。</li>
<li><b>持續封印</b>（L13 雙界封印，以及之後的啟動效果封印）：選定後綁定，直到我方負責維持的石像或對手被封印的石像其中一座被破壞才解除。我方維持者啟動照常、但不能獻祭；對手被封印者啟動無效、也不能獻祭。</li></ul>
<h4>6. 效果處理</h4><ul><li>寫【補牌】的啟動效果在補牌後處理，寫【整理】的在整理階段處理。雙方同時觸發時，起始玩家先處理。</li><li>獻祭得到的能力只持續本回合。</li><li>卡面不加括號說明，範圍細節以「用詞定義」為準。</li></ul>
<h4>7. 勝利的細節</h4><ul><li>隊長的特殊勝利條件一達成，就立刻獲勝。</li><li>需要指定顏色才能獲勝的隊長（L11 冥火貓妖），開局要<b>宣告</b>主色是哪個屬性，雙方都看得到。</li><li>雙方同時達成勝利條件時，進入搶 1 分加賽。</li></ul>
</details>
<details><summary>用詞定義</summary>
<p class="rnote">卡面上的用詞，範圍以這張表為準。</p>
<div class="tbl"><table><tr><th>用詞</th><th>意思</th></tr>${words.map(w => `<tr><td class="rk">${w[0]}</td><td>${w[1]}</td></tr>`).join('')}</table></div>
</details>
<details><summary>隊長</summary>
<div class="tbl"><table><tr><th>隊長</th><th>屬性．種族</th><th>能力</th></tr>${leaderIds.map(id => { const L = LEADERS[id]; return `<tr><td class="rk">${id} ${L.name}</td><td>${COLOR_NAME[L.color]}．${L.race}</td><td><b>${L.skill}</b>　${L.text}</td></tr>`; }).join('')}</table></div>
<ul class="rnote"><li>L06「牌型為 AA」：AA、AAB、AABC、AABB 都算，都只 +1。</li><li>L12 專屬戰力：A、AA、AAA、AAAA＝1；AB、AAB、AAAB＝3；AABB＝4；ABC＝5；AABC＝6。L12 的屬性一律看最左一張（不管牌型），可以剋制對手，也會被剋制。</li>
<li>L13：整理階段，每 2 座自己的同屬性直立石像（還沒在維持封印的）可以封印 1 座對手直立石像；選定後固定，之後只能用新的成對石像追加。維持的 2 座不能獻祭；維持或被封印的石像被破壞就解除；封魔者被封印時暫時失效到判定勝負。同時封印 4 座獲勝。</li></ul>
</details>
<details><summary>預組</summary>
<p class="rnote">初階 1～3、進階 4～11；個人牌組在卡牌構築頁建立，編號從 12 接著排。</p>
<div class="tbl"><table><tr><th>預組</th><th>屬性</th><th>說明</th></tr>${PRESETS.map(p => `<tr><td class="rk">${p.no}.${p.name}<br><small>${p.tier}</small></td><td style="white-space:nowrap">${cc(p.cards)}</td><td>${p.desc}</td></tr>`).join('')}</table></div>
</details>`;
  }


  // ---------- 圖鑑 ----------
  function renderGallery(filter) {
    const fl = $('#galFilter'); fl.innerHTML = '';
    const f = typeof filter === 'object' && filter ? filter : { col: filter || 'all', role: 'all' };
    for (const [k, lab] of [['all', '全部'], ['F', '火'], ['W', '水'], ['G', '草'], ['L', '隊長']]) {
      const b = el('button', 'chip', lab); b.setAttribute('aria-pressed', f.col === k); b.onclick = () => renderGallery({ col: k, role: k === 'L' ? 'all' : f.role }); fl.appendChild(b);
    }
    if (f.col !== 'L') {
      const br = el('div', 'chips rolechips');
      for (const k of ['all', ...ROLES]) { const b = el('button', 'chip small', k === 'all' ? '全部定位' : k); b.setAttribute('aria-pressed', f.role === k); b.onclick = () => renderGallery({ col: f.col, role: k }); br.appendChild(b); }
      fl.appendChild(br);
    }
    const grid = $('#galGrid'); grid.innerHTML = '';
    const ids = [...Object.keys(CARDS), ...leaderIds].filter(id => (f.col === 'all' || (f.col === 'L' ? id[0] === 'L' : id[0] === f.col)) && (f.role === 'all' || (id[0] !== 'L' && CARDS[id].roles.includes(f.role))));
    for (const id of ids) {
      const c = cardEl(id, { lazy: true }); c.tabIndex = 0; c.setAttribute('role', 'button');
      c.onclick = () => openBig(id); c.onkeydown = e => { if (e.key === 'Enter') openBig(id); };
      grid.appendChild(c);
    }
  }
  function openBig(id) {
    const m = $('#galModal'), b = $('#galBox'); b.innerHTML = '';
    const c = cardEl(id, { cls: 'big-card', hi: true }); tilt(c, 18); b.appendChild(c);
    const d = info(id);
    b.appendChild(el('h3', '', `${id}．${d.name}`));
    if (id[0] === 'L') b.appendChild(el('p', '', `${COLOR_NAME[d.color]}屬性．${d.race}．${d.skill}：${d.text}`));
    else b.appendChild(el('p', '', `${COLOR_NAME[d.color]}屬性．${d.race}．定位：${d.role}<br><b style="color:var(--gold-hi)">啟動</b> ${d.act}<br><b style="color:var(--gold-hi)">獻祭</b> ${d.sac}`));
    const x = el('button', 'btn small', '關閉'); x.onclick = () => m.hidden = true; b.appendChild(x);
    m.hidden = false; m.onclick = e => { if (e.target === m) m.hidden = true; };
  }

  // ================= 對戰 =================
  let G = null, scale = 1, mode = 'idle', sel = [], fresh = new Set(), freshPlay = new Set(), freshStatue = new Set(), sacFx = new Set();
  let lockCards = [null, null]; const sacTurn = new Set(); // 本回合獻祭的石像 // 同時出牌：已鎖定但尚未翻開的牌
  let ME = 0, spectating = false;
  const SN = slot => spectating ? (slot === 0 ? '玩家 A' : '玩家 B') : (slot === 0 ? '我方' : '對手'); const P = slot => slot === 0 ? ME : 1 - ME; // 畫面位置(0=我方) → 引擎玩家編號
  let resolver = null, pickables = null, revealed = false, lastSettle = null, logs = [], t0 = 0, tEnd = 0, clockT = null;
  const mmss = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  function tickClock() { const c = $('#clock'); if (c) c.textContent = '⏱ ' + mmss((tEnd || Date.now()) - t0); }
  const stage = $('#stage');
  function fitStage() {
    const w = innerWidth, h = innerHeight;
    scale = Math.min(w / 1280, h / 720);
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
    // 畫面縮小時，提示框和卡片說明的字反向放大（最多 1.5 倍），保持看得清楚
    stage.style.setProperty('--ts', Math.min(1.5, Math.max(1, 1 / scale)).toFixed(3)); stage.style.transformOrigin = '50% 50%';
  }
  addEventListener('resize', () => { if (!$('#battle').hidden) fitStage(); });
  function relRect(e) { const s = stage.getBoundingClientRect(), r = e.getBoundingClientRect(); return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale }; }

  // 懸停說明
  let tipTimer = null, focusOff = null, ovShow = null, ovHide = null;
  // 彈窗中的卡：停 0.15 秒顯示詳細資訊，移開 0.5 秒後收起
  function hoverOver(e, id) {
    e.addEventListener('pointerenter', () => { clearTimeout(ovHide); clearTimeout(ovShow); ovShow = setTimeout(() => detailOver(id), 150); });
    e.addEventListener('pointerleave', () => { clearTimeout(ovShow); clearTimeout(ovHide); ovHide = setTimeout(() => detailOver(null), 500); });
  }
  function bindHover(c, id, extra) {
    c.addEventListener('pointerenter', e => {
      const t = $('#tip'); const d = info(id); if (!d) return;
      t.innerHTML = id[0] === 'L' ? `<b>${d.name}</b>．${d.skill}<br>${d.text}${extra || ''}` : `<b>${d.name}</b>（${COLOR_NAME[d.color]}）<br><b>啟動</b> ${d.act}<br><b>獻祭</b> ${d.sac}${extra || ''}`;
      const r = relRect(c); t.hidden = false;
      const tw = t.offsetWidth, th = t.offsetHeight;
      let x, y;
      if (c.closest('#hand')) { x = Math.min(1280 - tw - 8, Math.max(8, r.x + r.w / 2 - tw / 2)); y = Math.max(4, r.y - th - 14); }  // 手牌：顯示在卡片正上方
      else { x = r.x + r.w + 8; y = r.y; if (x + tw > 1280) x = r.x - tw - 8; if (y + th > 716) y = 716 - th; if (y < 4) y = 4; }
      t.style.left = x + 'px'; t.style.top = y + 'px';
      clearTimeout(tipTimer); clearTimeout(focusOff); tipTimer = setTimeout(() => showDetail(id, true), 150);
    });
    c.addEventListener('pointerleave', () => { $('#tip').hidden = true; clearTimeout(tipTimer); clearTimeout(focusOff); focusOff = setTimeout(hideDetail, 500); });
  }
  function hideDetail() { $('#detail').classList.remove('show', 'focus', 'over'); }
  function showDetail(id, focus) {
    const d = $('#detail'); d.innerHTML = '';
    if (!id) { hideDetail(); return; }
    d.classList.add('show');
    const x = info(id); d.appendChild(cardEl(id));
    d.appendChild(el('div', 'dn', `${x.name}`));
    if (id[0] === 'L') { d.appendChild(el('div', 'dm', `${id}．${COLOR_NAME[x.color]}屬性．${x.race}`)); d.appendChild(el('div', 'row', `<b>${x.skill}</b>${x.text}`)); }
    else { d.appendChild(el('div', 'dm', `${id}．${COLOR_NAME[x.color]}屬性．${x.race}．${x.role}`)); d.appendChild(el('div', 'row', `<b>啟動</b>${x.act}`)); d.appendChild(el('div', 'row', `<b>獻祭</b>${x.sac}`)); }
    d.classList.toggle('focus', !!focus);
  }

  const lockFx = c => ({ ...c, async choose(g, i, ph) { const r = await c.choose(g, i, ph); if (G === g && g.phase === 'choose') { lockCards[i] = r; renderAll(); } return r; } });
  // 每場對局的畫面事件只處理「目前這一場」；被新的一場取代的舊對局會停在原地不再前進
  let curGame = null;
  const uiFor = () => { const token = {}; curGame = token; return { ev: (n, d) => curGame === token ? onEvent(n, d) : new Promise(() => {}), log: (t, w) => { if (curGame === token) addLog(t, w); } }; };
  function startBattle(online) {
    lockCards = [null, null];
    if (online && online.spectate) {
      // 觀戰：用對局端的亂數種子與牌組重建同一場，照收到的決定重播
      spectating = true; ME = 0;
      G = new Game({ players: online.cfgs, seed: online.seed, controllers: [lockFx(SpecCtrl), lockFx(SpecCtrl)], ui: uiFor() });
    } else if (online) {
      spectating = false; ME = online.me;
      const ctrls = []; ctrls[ME] = lockFx(NetHuman); ctrls[1 - ME] = lockFx(Remote);
      if (net.host) { ctrls[0] = rec.wrap(ctrls[0]); ctrls[1] = rec.wrap(ctrls[1]); }
      G = new Game({ players: online.cfgs, seed: online.seed, controllers: ctrls, ui: uiFor() });
      if (net.host) rec.begin({ seed: online.seed, cfgs: online.cfgs });
    } else {
      spectating = false; ME = 0; net.on = false; watch.close();
      const me = cfg.me, foe = cfg.foe, seed = (Math.random() * 2 ** 31) | 0;
      const players = [{ leader: me.realLeader, deck: me.cards, main: me.main }, { leader: foe.realLeader, deck: foe.cards, main: foe.main }];
      G = new Game({ players, seed, controllers: [rec.wrap(lockFx(Human)), rec.wrap(lockFx(AI))], ui: uiFor() });
      rec.begin({ seed, cfgs: players });
    }
    rec.ui();
    preloadCards(G.p.flatMap(p => [p.leader, ...p.deck.map(c => c.id), ...p.hand.map(c => c.id)]));
    $('#netState').hidden = true; $('#deckView').hidden = true; sacTurn.clear();
    mode = 'idle'; sel = []; fresh = new Set(G.p[ME].hand.map(c => c.uid)); freshPlay.clear(); freshStatue.clear(); sacFx.clear(); revealed = false; lastSettle = null; logs = [];
    t0 = Date.now(); tEnd = 0; clearInterval(clockT); clockT = setInterval(tickClock, 1000); tickClock();
    $('#powers').innerHTML = ''; $('#modal').hidden = true; $('#fx').innerHTML = ''; effOpen = null;
    show('battle'); showDetail(null); renderAll();
    G.turnLoop().catch(err => { console.error(err); banner('發生錯誤，請重新開局'); });
  }
  function addLog(text, who) {
    if (who == null && spectating) text = text.replace('我方', '玩家 A').replace('對手', '玩家 B');
    if (who == null && ME === 1) text = text.replace(/戰力 (\S+) 對 (\S+)，/, '戰力 $2 對 $1，').replace(/我方|對手/, m => m === '我方' ? '對手' : '我方');
    if (who === 0 || who === 1) who = who === ME ? 0 : 1;
    logs.push({ text, who, turn: G ? G.turn : 0, t: Date.now() - t0 }); }

  // ---------- 繪製 ----------
  const PHASE = { setup: '準備', draw: '補牌', choose: '出牌', reveal: '翻牌', post: '獻祭時間', settle: '戰力計算', summon: '【啟動】石像', end: '整理' };
  function renderAll() {
    if (!G) return;
    $('#tip').hidden = true;
    $('#turnNo').textContent = `回合 ${G.turn}．起始：${SN(G.first === ME ? 0 : 1)}`;
    $('#phase').textContent = PHASE[G.phase] || '';
    renderSide(0); renderSide(1); renderOrbs(); renderStatues(0); renderStatues(1); renderPlays(); renderHand(); renderFoeHand(); renderAct(); renderLive(); renderEff();
  }
  // 翻牌後到戰力計算前：即時顯示雙方目前戰力
  // 明細標籤：卡號後面補上卡名（例：G01 → G01 森林信使）
  const lab = l => l.replace(/\b([FWG]\d\d)\b/g, m => CARDS[m] ? `${m} ${CARDS[m].name}` : m);
  const brkText = br => br.map(([l, v]) => `${lab(l)} ${v > 0 && l.indexOf('牌型') ? '+' : ''}${v}`).join('．');
  function renderLive() {
    const box = $('#powers');
    if (mode === 'choose' && sel.length && !lastSettle) {
      const [, cat] = shape(sel);
      const ctx = { core: [null, null], cat: [cat, cat], bonus: [0, 0], immune: [false, false] };
      ctx.bonus[ME] = G.ctx.bonus[ME]; ctx.core[ME] = (G.ctx && G.ctx.coreSet[ME]) || (G.lead(G.p[ME], 'L12') || G.fx(G.p[ME], 'leftCore') ? colorOf(sel[0]) : coreOf(sel, cat));
      const x = G.power(ME, sel, ctx, true);
      box.innerHTML = '';
      const p = el('div', 'pw live me'); p.style.top = '352px';
      p.innerHTML = `<div class="num">${x.total}</div><div class="brk"><b class="lv">預估戰力（不含剋制）</b><br>${brkText(x.br)}</div>`;
      box.appendChild(p); return;
    }
    const on = G.phase === 'post' && revealed && !lastSettle && G.played[0].length && G.played[1].length;
    if (!on) { if (box.querySelector('.pw.live')) box.innerHTML = ''; return; }
    const ev = G.evaluate(G.played, G.ctx, true);
    box.innerHTML = '';
    for (const i of [1, 0]) {
      const idx = P(i);
      const p = el('div', 'pw live ' + (i === 0 ? 'me' : 'foe') + (ev.w === idx ? ' lead' : ''));
      p.style.top = (i === 0 ? 352 : 228) + 'px';
      const brk = brkText(ev.br[idx]);
      p.innerHTML = `<div class="num">${ev.pw[idx]}</div><div class="brk"><b class="lv">目前戰力${ev.w === idx ? '．領先' : ev.w === null ? '．平手' : ''}</b><br>${brk}</div>`;
      box.appendChild(p);
    }
  }

  function goalText(p) {
    const up = G.upright(p), o = G.opp(p.idx);
    const c = { F: 0, W: 0, G: 0 }; up.forEach(s => c[s.id[0]]++);
    switch (p.leader) {
      case 'L01': return `連勝加成 +${p.l01}`;
      case 'L08': return `已獻祭石像 ${p.statues.filter(s => !s.up).length}／5`;
      case 'L10': return `直立 ${c.F + c.W + c.G}／7．火${c.F}．水${c.W}．草${c.G}（各 2）`;
      case 'L11': return `主色 <span class="ctag ${p.main}">${COLOR_NAME[p.main]}</span> 直立 ${c[p.main]}／4`;
      case 'L13': return `封印中 ${o.statues.filter(s => s.byL13).length}／4`;
    }
    return '';
  }
  function renderSide(i) {
    const p = G.p[P(i)], box = i === 0 ? $('#sideMe') : $('#sideFoe'); box.innerHTML = '';
    const pl = el('div', 'pl ' + (i === 0 ? 'me' : 'foe') + (p.lsealed ? ' sealedL' : ''));
    const c = cardEl(p.leader); bindHover(c, p.leader, p.lsealed ? '<br><b>被封印（到判定勝負）</b>' : ''); pl.appendChild(c);
    const g = goalText(p);
    pl.appendChild(el('div', '', `<div class="pn">${SN(i)}．${LEADERS[p.leader].name}</div>
      <div class="ps">得分 <b>${p.score}</b>／4<br>牌庫 <b>${p.deck.length}</b>．棄牌 <b>${p.disc.length}</b>${i === 1 ? `．手牌 <b>${p.hand.length}</b>` : ''}</div>
      ${g ? `<div class="goal">${g}</div>` : ''}${p.lsealed ? '<div class="goal" style="color:#d9c2ff">隊長被封印</div>' : ''}`));
    box.appendChild(pl);
    $(i === 0 ? '#pileMe' : '#pileFoe').innerHTML = `查看${SN(i)}棄牌 <b>${p.disc.length}</b>`;
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
    keep.appendChild(el('span', 'zl', SN(i) + '石像區'));
    sac.appendChild(el('span', 'zl', '獻祭區'));
    const up = p.statues.filter(s => s.up), down = [...p.statues.filter(s => !s.up && !sacTurn.has(s.uid)), ...p.statues.filter(s => !s.up && sacTurn.has(s.uid))];
    sac.classList.toggle('hot', down.some(s => sacTurn.has(s.uid)));
    keep.classList.toggle('crowd', up.length > 7);
    for (const s of [...up, ...down]) {
      const c = cardEl(s.id, { uid: s.uid });
      if (s.sealed) c.classList.add('sealed'); if (s.maint) c.classList.add('maint');
      if (freshStatue.has(s.uid)) c.classList.add('petrify');
      if (sacFx.has(s.uid)) c.classList.add('sacfx');
      if (!s.up && sacTurn.has(s.uid)) c.classList.add('justsac');
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
      const idx = P(i);
      if (!G.played[idx].length && lockCards[idx]) {
        for (const c of lockCards[idx]) { const e = cardEl(i === 0 ? c.id : null, { down: i === 1, cls: 'locked' }); if (i === 0) bindHover(e, c.id); z.appendChild(e); }
        z.appendChild(el('span', 'lockt', i === 0 ? '已出牌，等待對手' : '對手已出牌'));
        continue;
      }
      for (const c of G.played[idx]) {
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
    const h = $('#hand'); h.innerHTML = ''; const cards = G.p[ME].hand.filter(c => !(lockCards[ME] && lockCards[ME].includes(c)) && !(G.played[ME] || []).includes(c)); const n = cards.length;
    h.classList.toggle('locked', mode !== 'choose' && !spectating);
    cards.forEach((c, k) => {
      const e = cardEl(c.id, { uid: c.uid }); const off = k - (n - 1) / 2;
      e.style.setProperty('--rot', off * 3.5 + 'deg'); e.style.setProperty('--ty', Math.abs(off) * 6 + 'px');
      if (fresh.has(c.uid)) e.classList.add('drawn');
      if (c.as) { e.querySelector('.shade').style.boxShadow = `inset 0 0 0 5px var(--${{ F: 'fire', W: 'water', G: 'grass' }[c.as]})`; e.appendChild(el('div', 'astag ' + c.as, `視為${COLOR_NAME[c.as]}`)); }
      const si = sel.indexOf(c); if (si >= 0) { e.classList.add('sel'); e.appendChild(el('div', 'ord', si + 1)); }
      if (pickables && pickables.cards && pickables.cards.includes(c)) e.classList.add('sel');
      e.onclick = () => {
        if (mode !== 'choose') return;
        const j = sel.indexOf(c); if (j >= 0) sel.splice(j, 1); else if (sel.length < 4) sel.push(c);
        renderHand(); renderAct(); renderLive();
      };
      tilt(e, 16); bindHover(e, c.id, c.as ? `<br><b>本回合視為${COLOR_NAME[c.as]}屬性</b>` : ''); h.appendChild(e);
    });
    fresh.clear();
  }
  function renderFoeHand() {
    const h = $('#foeHand'); h.innerHTML = '';
    h.classList.toggle('open', spectating);
    G.p[1 - ME].hand.forEach(c => { if (!spectating) { h.appendChild(cardEl(null, { down: true })); return; } const e = cardEl(c.id, { uid: c.uid }); bindHover(e, c.id); h.appendChild(e); });
  }
  // 效果一覽：分成「啟動效果」與「獻祭效果」兩個按鈕，打開後同時列出雙方
  let effOpen = null;
  const cname = id => `${id} ${CARDS[id].name}`;
  function effList(idx, kind) {
    const p = G.p[idx], c = G.ctx, L = LEADERS[p.leader], out = [];
    if (kind === 'act') {
      out.push({ t: 'lead', h: `${p.leader} ${L.name}（隊長）`, d: L.text + (p.leader === 'L01' ? `（目前 +${p.l01}）` : '') + (p.leader === 'L11' ? `（主色 <span class="ctag ${p.main}">${COLOR_NAME[p.main]}</span>）` : ''), off: p.lsealed ? '被封印（到判定勝負）' : '' });
      if (c) {
        if (c.bonus[idx]) out.push({ t: 'buff', h: '本回合', d: `戰力 ${c.bonus[idx] > 0 ? '+' : ''}${c.bonus[idx]}` });
        if (c.immune[idx]) out.push({ t: 'buff', h: '本回合', d: '不受剋制' });
        if (c.extraPt[idx]) out.push({ t: 'buff', h: '本回合', d: '獲勝時多得 1 分' });
      }
      for (const s of p.statues.filter(x => x.up)) out.push({ t: 'st', id: s.id, h: cname(s.id), d: CARDS[s.id].act, off: s.sealed ? (s.byL13 ? '被雙界封印' : '封印中') : '', note: s.byL13 && !s.sealed ? '雙界封印暫時失效（封魔者被封印）' : '' });
      if (!p.statues.some(x => x.up)) out.push({ t: 'info', h: '沒有直立石像', d: '' });
    } else {
      if (p.sacUsed) out.push({ t: 'debuff', h: '本回合', d: '已經獻祭過' });
      if (c && c.blocked[idx]) out.push({ t: 'debuff', h: '本回合', d: '不能獻祭' });
      for (const s of p.statues.filter(x => x.up)) out.push({ t: 'st', id: s.id, h: cname(s.id), d: CARDS[s.id].sac, off: s.sealed ? (s.byL13 ? '被雙界封印，不能獻祭' : '封印中，不能獻祭') : s.maint && !p.lsealed ? '維持雙界封印中，不能獻祭' : '', note: s.id === 'G08' ? '出牌階段：變換手牌；翻牌後：變換出戰牌' : '' });
      if (!p.statues.some(x => x.up)) out.push({ t: 'info', h: '沒有可獻祭的石像', d: '' });
      const down = p.statues.filter(x => !x.up);
      if (down.length) out.push({ t: 'info', h: `已獻祭 ${down.length} 座`, d: down.map(x => cname(x.id)).join('、') });
    }
    return out;
  }
  function renderEff() {
    $('#effMe').setAttribute('aria-pressed', effOpen === 'act');
    $('#effFoe').setAttribute('aria-pressed', effOpen === 'sac');
    const pn = $('#effPanel');
    pn.hidden = effOpen === null;
    if (effOpen === null) return;
    const col = slot => {
      const items = effList(P(slot), effOpen);
      return `<div class="effcol ${slot === 0 ? 'me' : 'foe'}"><h4>${SN(slot)}</h4>${items.map(e => `<div class="eff ${e.t}${e.off ? ' off' : ''}"${e.id ? ` data-id="${e.id}"` : ''}><b>${e.h}</b>${e.d}${e.off ? `<em>${e.off}</em>` : ''}${e.note ? `<em>${e.note}</em>` : ''}</div>`).join('')}</div>`;
    };
    pn.innerHTML = `<div class="effhd"><span>${effOpen === 'act' ? '啟動效果一覽' : '獻祭效果一覽'}</span><button class="btn ghost small" id="effX">關閉</button></div><div class="effcols">${col(0)}${col(1)}</div>`;
    $('#effX').onclick = () => { effOpen = null; renderEff(); };
    pn.querySelectorAll('.eff[data-id]').forEach(e => { e.addEventListener('pointerenter', () => { clearTimeout(focusOff); showDetail(e.dataset.id, true); }); e.addEventListener('pointerleave', () => { focusOff = setTimeout(hideDetail, 500); }); });
  }
  $('#effMe').onclick = () => { effOpen = effOpen === 'act' ? null : 'act'; if (G) renderEff(); };
  $('#effFoe').onclick = () => { effOpen = effOpen === 'sac' ? null : 'sac'; if (G) renderEff(); };
  $('#pileMe').onclick = () => { if (G) openPile(ME); };
  $('#pileFoe').onclick = () => { if (G) openPile(1 - ME); };
  function renderCheat(name) {
    const l12 = G.lead(G.p[ME], 'L12');
    const rows = l12
      ? [['A、AA、AAA、AAAA', 1, 1], ['AB、AAB、AAAB', 3, 1], ['AABB', 4, 2], ['ABC', 5, 1], ['AABC', 6, 1]]
      : [['AAAA', 7, 1], ['AAAB', 6, 1], ['AAA', 5, 1], ['AABB', 4, 2], ['AAB、AABC', 3, 1], ['AA', 2, 1], ['A、AB、ABC', 1, 0]];
    const hit = r => name && r[0].split('、').includes(name);
    $('#cheat').innerHTML = `<h4>牌型速查<small>${l12 ? 'L12 專屬戰力' : 'A、B、C＝不同屬性'}</small></h4>
      <table><tr class="hd"><td>牌型</td><td>戰力</td><td>石像</td></tr>${rows.map(r => `<tr class="${hit(r) ? 'on' : ''}"><td class="${l12 ? '' : grpOf(r[0])}">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
      <div class="kz"><span class="F">火</span>剋<span class="G">草</span>．<span class="G">草</span>剋<span class="W">水</span>．<span class="W">水</span>剋<span class="F">火</span><br>不限牌型，剋制方 +2；AABB、雜色看最左</div>`;
  }
  function renderAct() {
    const a = $('#actbar'); a.innerHTML = '';
    renderCheat(mode === 'choose' && sel.length ? shape(sel)[2] : null);
    if (spectating) { a.appendChild(el('div', 'preview', `<b>觀戰中</b>．房號 ${watch.code}<br>上方是玩家 B、下方是玩家 A，雙方手牌都看得到${watch.catching ? '<br>正在快轉追上目前進度…' : ''}`)); return; }
    if (mode === 'choose') {
      if (sel.length) {
        const [, cat, name] = shape(sel);
        const ctx = { core: [null, null], cat: [cat, cat], bonus: [0, 0], immune: [false, false] };
        ctx.bonus[ME] = G.ctx.bonus[ME];
        ctx.core[ME] = (G.ctx && G.ctx.coreSet[ME]) || (G.lead(G.p[ME], 'L12') || G.fx(G.p[ME], 'leftCore') ? colorOf(sel[0]) : coreOf(sel, cat));
        const pw = G.power(ME, sel, ctx);
        const sm = summonList(sel, cat, G.lead(G.p[ME], 'L12') || G.fx(G.p[ME], 'mixSummon') > 0);
        a.appendChild(el('div', 'preview', `${name}．${LEVEL_NAME[cat]}．核心${COLOR_NAME[ctx.core[ME]]}．戰力<b>${pw}</b>${sm.length ? `　【啟動】：${sm.map(c => CARDS[c.id].name).join('、')}` : '　不【啟動】石像'}`));
      } else a.appendChild(el('div', 'preview', '點選 1～4 張手牌，點選順序就是由左到右的排列'));
      const go = el('button', 'btn primary', '出牌'); go.disabled = !sel.length;
      go.onclick = () => { if (!resolver || mode !== 'choose') return; const r = resolver; resolver = null; mode = 'wait'; const s = sel.slice(); sel = []; lockCards[ME] = s; renderAll(); r(s); };
      const sac = el('button', 'btn', '發動（獻祭）'); sac.disabled = !G.canSacList(ME).length;
      sac.title = sac.disabled ? (G.p[ME].sacUsed ? '本回合已經獻祭過' : G.ctx && G.ctx.blocked[ME] ? '本回合被封鎖，不能獻祭' : '沒有可以獻祭的石像') : '';
      sac.onclick = () => humanPreSac();
      if (!sac.disabled && (!resolver || (net.on && (net.sacQ.length || net.sacBusy)))) sac.disabled = true;
      const clr = el('button', 'btn ghost', '清除'); clr.disabled = !sel.length; clr.onclick = () => { sel = []; renderHand(); renderAct(); renderLive(); };
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
  const who = i => SN(i === ME ? 0 : 1);
  async function onEvent(name, d) {
    switch (name) {
      case 'turnStart':
        sacTurn.clear(); lockCards = [null, null]; revealed = false; lastSettle = null; $('#powers').innerHTML = ''; renderAll();
        await banner(`第 ${d.turn} 回合．${who(d.first)}先`, 900); break;
      case 'draw':
        if (d.i === ME) d.cards.forEach(c => fresh.add(c.uid));
        renderAll(); await wait(d.i === ME ? 380 : 120); break;
      case 'discard': case 'retrieve': renderAll(); await wait(300); break;
      case 'peek':
        if (spectating) await banner(`${who(d.i)}查看了對手 ${d.cards.length} 張手牌`, 700);
        else if (d.i === ME) await modalCards(`對手的手牌（隨機 ${d.cards.length} 張${d.src ? '．' + d.src : ''}${d.want > d.cards.length ? `．對手只有 ${d.cards.length} 張` : ''}）`, d.cards, { view: true });
        else await banner(`對手查看了你 ${d.cards.length} 張手牌`, 900);
        break;
      case 'seal': renderAll(); await wait(450); break;
      case 'unseal': renderAll(); break;
      case 'sacrifice':
        if (rec.start && !spectating && G.phase === 'choose') rec.push({ k: 'presac', who: d.i, uid: d.statue.uid });
        sacTurn.add(d.statue.uid); sacFx.add(d.statue.uid); renderAll(); flashStatue(d.statue.uid);
        await banner(`${who(d.i)}獻祭 ${CARDS[d.statue.id].name}：${CARDS[d.statue.id].sac}`, 1100); sacFx.delete(d.statue.uid); break;
      case 'counter':
        sacTurn.add(d.statue.uid); sacFx.add(d.statue.uid); renderAll(); flashStatue(d.statue.uid);
        await banner(`${who(d.i)}反擊！${CARDS[d.target.id].name} 的效果無效`, 1200); sacFx.delete(d.statue.uid); break;
      case 'destroy': shatter(d.statue.uid, true); await wait(250); renderAll(); await wait(550); break;
      case 'reveal':
        mode = 'wait'; lockCards = [null, null]; G.played[0].forEach(c => freshPlay.add(c.uid)); G.played[1].forEach(c => freshPlay.add(c.uid));
        renderAll(); await wait(550); revealed = true;
        stage.querySelectorAll('#zFoePlay .card').forEach(c => c.classList.remove('down'));
        await wait(650); renderAll(); break;
      case 'pass': if (d.i !== ME) await banner('對手跳過', 600); break;
      case 'g08': if (d.hand && d.i !== ME) await banner(`${who(d.i)}變換了 1 張手牌的屬性`, 900); renderAll(); await wait(400); break;
      case 'statueMove': renderAll(); await wait(450); break;
      case 'coreSet': await banner(`${who(d.i)}宣告本回合核心屬性為${COLOR_NAME[d.color]}`, 1100); break;
      case 'peekPlay':
        if (spectating) await banner(`${who(d.i)}翻牌前看了對手 ${d.cards.length} 張出戰牌`, 800);
        else if (d.i === ME) await modalCards(`對手的出戰牌（最左邊 ${d.cards.length} 張）`, d.cards, { view: true });
        else await banner(`對手看了你 ${d.cards.length} 張出戰牌`, 900);
        break;
      case 'settle': {
        // 對局紀錄：在戰力那一行補上雙方出牌與戰力明細
        const last = logs[logs.length - 1];
        if (last && last.text.startsWith('戰力')) last.detail = [0, 1].map(slot => {
          const idx = P(slot), cards = G.played[idx];
          const adv = d.adv && d.adv[idx];
          return { who: slot, text: `${SN(slot)} ${d.pw[idx]}：出 ${cards.map(c => cname(c.id) + (c.as ? `（視為${COLOR_NAME[c.as]}）` : '')).join('、')}<br>　＝ ${brkText(d.br[idx])}${adv ? '' : ''}` };
        });
        await showSettle(d); break;
      }
      case 'summon':
        d.statues.forEach(s => freshStatue.add(s.uid));
        G.played[d.i] = []; renderAll(); await wait(d.statues.length ? 950 : 250); break;
      case 'gameover': if (rec.start && !spectating) setTimeout(() => rec.end(), 4000); mode = 'idle'; resolver = null; pickables = null; lockCards = [null, null]; hideBanner(); await showResult(d); break;
    }
  }
  async function showSettle(d) {
    lastSettle = d; mode = 'wait'; renderAll();
    const box = $('#powers'); box.innerHTML = '';
    for (const i of [1, 0]) {
      const p = el('div', 'pw ' + (i === 0 ? 'me' : 'foe') + (d.w === P(i) ? ' won' : ''));
      p.style.top = (i === 0 ? 352 : 228) + 'px';
      const brk = brkText(d.br[P(i)]);
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
    if (!tEnd) { tEnd = Date.now(); clearInterval(clockT); tickClock(); if (!spectating) { saveHistory(w === ME ? 0 : w === 1 - ME ? 1 : -1, d.how); reportResult(w); } }
    const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
    if (spectating) {
      b.appendChild(el('div', 'result win', w === 0 ? '玩家 A 勝利' : w === 1 ? '玩家 B 勝利' : '平手'));
      b.appendChild(el('p', '', `${howTxt}．比分 ${G.p[0].score} 比 ${G.p[1].score}．共 ${G.turn} 回合`));
      b.appendChild(el('p', '', '對局結束。留在這裡會自動觀看同一個房號的下一場。'));
      const r = el('div', 'mrow');
      const home = el('button', 'btn', '離開觀戰'); home.onclick = () => { m.hidden = true; G = null; clearInterval(clockT); watch.close(); show('home'); };
      const lg = el('button', 'btn ghost', '對局紀錄'); lg.onclick = () => openLog(() => showResult(d));
      r.append(home, lg); b.appendChild(r); m.hidden = false; return;
    }
    const rw = w === ME ? 0 : w === 1 - ME ? 1 : -1;
    b.appendChild(el('div', 'result ' + (rw === 0 ? 'win' : 'lose'), rw === 0 ? '勝利' : rw === 1 ? '敗北' : '平手'));
    b.appendChild(el('p', '', `${howTxt}．比分 ${G.p[ME].score} 比 ${G.p[1 - ME].score}．共 ${G.turn} 回合．用時 ${mmss(tEnd - t0)}`));
    const hist = loadHistory();
    if (hist.length > 1) b.appendChild(el('div', 'hist', '<b>最近對局</b>' + hist.slice(0, 5).map(h => `<span class="${h.w === 0 ? 'me' : h.w === 1 ? 'foe' : ''}">${h.date}　${h.w === 0 ? '勝' : h.w === 1 ? '敗' : '平'}　${h.score}　${h.turns} 回合　${mmss(h.ms)}</span>`).join('')));
    const r = el('div', 'mrow');
    const again = el('button', 'btn primary', '再戰一局');
    again.onclick = () => { m.hidden = true; if (net.on) { G = null; clearInterval(clockT); net.toPick(); } else { finalizeCfg(); startBattle(); } };
    if (net.on && !net.conn) again.disabled = true;
    const home = el('button', 'btn', '回首頁'); home.onclick = () => { m.hidden = true; G = null; clearInterval(clockT); rec.end(); if (net.on) net.close(); show('home'); };
    const lg = el('button', 'btn ghost', '對局紀錄'); lg.onclick = () => openLog(() => showResult(d));
    r.append(again, home, lg); b.appendChild(r); m.hidden = false;
  }
  function loadHistory() { try { return JSON.parse(localStorage.getItem('summon_hist') || '[]'); } catch { return []; } }
  // 對戰紀錄送雲端（沒設定雲端就什麼都不做）。連線對戰只由房主送，避免重複
  function reportResult(w) {
    if (typeof Cloud === 'undefined' || !Cloud.on || (net.on && !net.host)) return;
    const side = i => i === ME ? cfg.me : cfg.foe;
    const label = s => s.deckLabel || (DECKS[s.deck] || {}).label || s.deck || '';
    Cloud.report({ mode: net.on ? 'online' : 'ai', build: BUILD, deck0: label(side(0)), leader0: side(0).realLeader || side(0).leader, deck1: label(side(1)), leader1: side(1).realLeader || side(1).leader,
      winner: w === 0 || w === 1 ? w : -1, turns: G.turn, s0: G.p[0].score, s1: G.p[1].score });
  }
  function saveHistory(w, how) {
    const d = new Date(), date = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const h = [{ date, w, how, score: `${G.p[ME].score}:${G.p[1 - ME].score}`, online: !!net.on, turns: G.turn, ms: tEnd - t0 }, ...loadHistory()].slice(0, 20);
    try { localStorage.setItem('summon_hist', JSON.stringify(h)); } catch { }
  }
  function openPile(idx) {
    if (!G || !$('#modal').hidden) return;
    const p = G.p[idx], m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
    b.appendChild(el('h3', '', `${SN(idx === ME ? 0 : 1)}棄牌堆<small class="lgt">　共 ${p.disc.length} 張．1 是最上面那張</small>`));
    const row = el('div', 'mcards pile');
    const list = p.disc.slice().reverse();
    list.forEach((c, k) => { const w = el('div', 'pcard'); const e = cardEl(c.id); hoverOver(e, c.id); w.append(el('span', 'pno', k + 1), e); row.appendChild(w); });
    if (!list.length) row.appendChild(el('p', '', '棄牌堆是空的'));
    b.appendChild(row);
    const x = el('button', 'btn small', '關閉'); x.onclick = () => { m.hidden = true; detailOver(null); }; b.appendChild(x);
    m.hidden = false;
  }
  function openLog(after) {
    const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
    b.appendChild(el('h3', '', `對局紀錄<small class="lgt">　${tEnd ? '總用時' : '已進行'} ${mmss((tEnd || Date.now()) - t0)}</small>`));
    const box = el('div', 'logbox');
    logs.slice().reverse().forEach(l => box.appendChild(el('p', l.who === 0 ? 'me' : l.who === 1 ? 'foe' : '', `<i class="ts">${mmss(l.t)}</i>回合 ${l.turn}．${l.who === 0 ? SN(0) : l.who === 1 ? SN(1) : ''} ${l.text}${l.detail ? `<span class="lgd">${l.detail.map(x => `<span class="${x.who === 0 ? 'me' : 'foe'}">${x.text}</span>`).join('')}</span>` : ''}`)));
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
<p><b>2 出牌</b>：雙方同時選 1～4 張，點選順序＝由左到右。</p>
<p><b>3 翻牌</b>：雙方同時翻開。</p>
<p><b>4 戰力計算</b>：牌型戰力＋石像＋隊長＋剋制，高的人得 1 分，平手都不得分。</p>
<p><b>5 【啟動】石像</b>：不論輸贏，成對的那組最左邊 1 張變石像（AABB 2 張）。</p>
<p><b>6 整理</b>：處理【整理】效果，其餘出戰牌進棄牌區。</p>
<p><b>獻祭</b>：補牌後到戰力計算前，每回合可以獻祭 1 座石像，發動它的獻祭效果；獻祭後橫放在獻祭區。翻牌後雙方輪流宣告獻祭或跳過，畫面會顯示目前戰力。</p>
<p><b>核心屬性</b>：重複最多的屬性；AABB 和無牌型（雜色）看最左邊那張。</p>
<p><b>剋制</b>：火剋草、草剋水、水剋火，不限牌型，剋制方 +2。</p>`));
    const x = el('button', 'btn small', '關閉'); x.onclick = () => m.hidden = true; b.appendChild(x);
    m.hidden = false;
  };
  $('#btnLog').onclick = () => { if ($('#modal').hidden) openLog(); };
  $('#btnSpeed').onclick = e => { speed = speed === 1 ? .4 : 1; e.currentTarget.setAttribute('aria-pressed', speed !== 1); e.currentTarget.textContent = speed === 1 ? '加速' : '正常'; };
  $('#btnQuit').onclick = () => {
    const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
    b.appendChild(el('h3', '', spectating ? '要離開觀戰嗎？' : '要離開這局對戰嗎？')); b.appendChild(el('p', '', spectating ? '之後可以再用房號回來觀看。' : net.on ? '離開會中斷連線，對手會看到你已離線。' : '這局的進度不會保留。'));
    const r = el('div', 'mrow'); const y = el('button', 'btn primary', '離開'); const n = el('button', 'btn', '繼續對戰');
    y.onclick = () => { m.hidden = true; G = null; resolver = null; clearInterval(clockT); if (spectating) watch.close(); else rec.end(); if (net.on) net.close(); show('home'); }; n.onclick = () => m.hidden = true;
    r.append(n, y); b.appendChild(r); m.hidden = false;
  };

  // ---------- 彈窗選擇 ----------
  // 彈窗看牌時，左上詳細資訊浮到遮罩上方一起顯示
  function detailOver(id) { const d = $('#detail'); $('#tip').hidden = true; if (id) { clearTimeout(ovHide); showDetail(id, true); d.classList.add('over'); } else { clearTimeout(ovShow); hideDetail(); } }
  function modalCards(title, cards, o = {}) {
    return new Promise(res => {
      const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
      b.appendChild(el('h3', '', title));
      if (o.sub) b.appendChild(el('p', '', o.sub));
      const row = el('div', 'mcards'); const chosen = [];
      const n = o.n || 1;
      const ok = el('button', 'btn primary', o.view ? '知道了' : o.okText || '確定');
      cards.forEach(c => {
        const id = c.id; const e = cardEl(id); hoverOver(e, id);
        if (!o.view) e.onclick = () => {
          const k = chosen.indexOf(c); if (k >= 0) chosen.splice(k, 1); else { if (chosen.length >= n) chosen.shift(); chosen.push(c); }
          row.querySelectorAll('.card').forEach((x, j) => x.classList.toggle('sel', chosen.includes(cards[j])));
          ok.disabled = o.upTo ? !chosen.length : chosen.length !== Math.min(n, cards.length);
        };
        row.appendChild(e);
      });
      b.appendChild(row);
      const r = el('div', 'mrow');
      if (!o.view) ok.disabled = true;
      ok.onclick = () => { m.hidden = true; detailOver(null); res(o.view ? [] : chosen.slice()); };
      r.appendChild(ok);
      if (o.optional) { const sk = el('button', 'btn ghost', o.skipText || '跳過'); sk.onclick = () => { m.hidden = true; detailOver(null); res([]); }; r.appendChild(sk); }
      b.appendChild(r); m.hidden = false;
    });
  }
  function modalG08(cards, title) {
    return new Promise(res => {
      const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
      b.appendChild(el('h3', '', title || '變換 1 張出戰牌的屬性'));
      let pick = null, color = null;
      const row = el('div', 'mcards'), cols = el('div', 'mrow');
      const ok = el('button', 'btn primary', '確定'); ok.disabled = true;
      const upd = () => { row.querySelectorAll('.card').forEach((x, j) => x.classList.toggle('sel', cards[j] === pick)); cols.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.c === color)); ok.disabled = !(pick && color); };
      cards.forEach(c => { const e = cardEl(c.id); hoverOver(e, c.id); e.onclick = () => { pick = c; upd(); }; row.appendChild(e); });
      for (const c of ['F', 'W', 'G']) { const x = el('button', 'colorbtn ' + c, COLOR_NAME[c]); x.dataset.c = c; x.onclick = () => { color = c; upd(); }; cols.appendChild(x); }
      ok.onclick = () => { m.hidden = true; detailOver(null); res({ card: pick, color }); };
      b.append(row, el('p', '', '變成：'), cols, ok); m.hidden = false;
    });
  }

  function modalColor(title, opts) {
    return new Promise(res => {
      const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
      b.appendChild(el('h3', '', title));
      const r = el('div', 'mrow');
      for (const o of opts) { const x = el('button', 'colorbtn ' + o.color, COLOR_NAME[o.color]); x.onclick = () => { m.hidden = true; res([o]); }; r.appendChild(x); }
      b.appendChild(r); m.hidden = false;
    });
  }
  function boardPick(list, text, skipText) {
    return new Promise(res => {
      const prev = mode === 'presac' || mode === 'boardpick' ? (resolver ? 'choose' : 'wait') : mode; mode = 'boardpick';
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
      if (net.on) { net.requestSac(st.uid); return; }
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
        banner('選擇出戰牌（雙方同時）', 800);
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
        case 'swap': case 'handBottom': case 'discBottom': return modalCards(o.title, o.cards, { n: 1 });
        case 'scry': return modalCards(o.title, o.cards, { n: o.n, upTo: true, okText: '放到牌庫底', skipText: '都留在牌庫頂', optional: true });
        case 'color': return modalColor(o.title, o.cards);
        case 'statue': { const s = await boardPick(o.statues, o.title + '：點選場上發光的石像'); return s ? [s] : []; }
        case 'l02': return modalCards(o.title, o.cards, { n: 2, upTo: true, okText: '放回牌庫底', skipText: '不放回' , optional: true });
        case 'destroy': case 'seal': case 'copy': { const s = await boardPick(o.statues, o.title + '：點選場上發光的石像'); return s ? [s] : []; }
        case 'g08': return modalG08(o.cards, o.title);
        case 'l13': {
          const out = [];
          for (let k = 0; k < o.n; k++) { const left = o.statues.filter(s => !out.includes(s)); if (!left.length) break; const s = await boardPick(left, `雙界封印：點選要封印的對手石像（${k + 1}／${o.n}）`); if (s) out.push(s); }
          return out;
        }
      }
      return [];
    },
  };

  // ================= 連線對戰 =================
  const GAME_KINDS = ['play', 'sac', 'counter', 'pick', 'reqsac', 'presac'];
  const RECONNECT_SEC = 60;
  // 手機切回這個頁面時，如果連線已斷，馬上開始重連
  document.addEventListener('visibilitychange', () => { if (!document.hidden && net.on && net.inGame() && (!net.conn || !net.conn.open)) net.dropped(); });
  const PEER_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const ROOM_PREFIX = 'summon-cards-beta-';  // 測試版與正式版房號分開，彼此連不到
  // 連線版本：規則引擎＋卡牌資料＋連線協定的指紋。雙方不同就不能開局（避免一邊新版一邊舊版，結果對不上）
  const NET_PROTO = 2;
  const BUILD = (() => {
    const src = String(Game) + JSON.stringify(CARDS) + JSON.stringify(LEADERS) + NET_PROTO;
    let h = 2166136261; for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  })();
  function versionMismatch(where) {
    const text = `雙方的遊戲版本不同：${where}的版本跟你不一樣，繼續玩會出現結果對不上的情況。請${where === '對手' ? '兩個人都' : ''}重新整理網頁（電腦按 Ctrl+F5，手機下拉重新整理）後再連線。`;
    if (where === '對局端') { show('watchScr'); watch.msg(text, true); return; }
    $('#roomBox').hidden = true; show('online'); onlineMsg(text, true);
  }
  const net = {
    on: false, host: false, peer: null, conn: null, code: '', myCfg: null, peerCfg: null, game: 0, queues: {}, waiters: {}, sacQ: [], sacBusy: false, idleW: [],
    send(m) {
      m = { ...m, g: this.game };
      if (GAME_KINDS.includes(m.k)) { m.s = ++this.outSeq; this.out.push(m); }
      if (this.conn && this.conn.open) try { this.conn.send(m); } catch { }
    },
    // 斷線重連用：對局中送出的動作都編號留存（out），收到的動作記到 inSeq；重連後補送對方沒收到的
    out: [], outSeq: 0, inSeq: 0, pend: {}, reconn: null,
    close(silent) {
      const c = this.conn; this.conn = null;
      try { c && c.close(); } catch { } try { this.peer && this.peer.destroy(); } catch { }
      this.peer = null; this.on = false; this.resetGame();
    },
    // 對戰中的訊息佇列
    resetGame() { this.queues = {}; this.waiters = {}; this.sacQ = []; this.sacBusy = false; this.idleW = []; this.out = []; this.outSeq = 0; this.inSeq = 0; this.pend = {}; this.stopReconn(); },
    // 依種類排隊的訊息（出牌、獻祭、反擊、選擇…）
    next(kind) {
      return new Promise(res => {
        const q = this.queues[kind] || (this.queues[kind] = []);
        if (q.length) return res(q.shift());
        (this.waiters[kind] || (this.waiters[kind] = [])).push(res);
        this.netWait();
      });
    },
    netWait() { const n = Object.values(this.waiters).reduce((a, w) => a + w.length, 0); const e = $('#netState'); if (e) e.hidden = !n; },
    // 出牌期間的獻祭：由房主決定先後順序，雙方照同樣順序處理
    requestSac(uid) { if (this.host) this.orderSac(ME, uid); else this.send({ k: 'reqsac', uid }); },
    orderSac(who, uid) { this.send({ k: 'presac', who, uid }); this.enqueueSac(who, uid); },
    enqueueSac(who, uid) { this.sacQ.push({ who, uid }); this.pumpSac(); },
    async pumpSac() {
      if (this.sacBusy) return; this.sacBusy = true;
      while (this.sacQ.length) {
        const { who, uid } = this.sacQ.shift(); const g = G; if (!g) break;
        const st = g.p[who].statues.find(x => x.uid === uid);
        if (st) await g.sacrifice(who, st, 'pre');
        if (G !== g) break;
        if (who === ME && mode === 'busy') mode = resolver ? 'choose' : 'wait';
        renderAll();
      }
      this.sacBusy = false; const w = this.idleW; this.idleW = []; w.forEach(f => f());
      if (G) renderAct();
    },
    sacIdle() { return this.sacBusy || this.sacQ.length ? new Promise(r => this.idleW.push(r)) : Promise.resolve(); },
    onData(m) {
      if (!m || typeof m !== 'object') return;
      switch (m.k) {
        case 'hello': if ((m.build || 'old') !== BUILD) this.mismatch(); return;
        case 'mismatch': this.mismatch(true); return;
        case 'cfg': if (m.build !== BUILD) { this.mismatch(); return; } this.peerCfg = m.cfg; renderNetPick(); if (this.host) this.tryStart(); return;
        case 'start': if (m.build !== BUILD) { this.mismatch(); return; } this.beginGame(m); return;
        case 'bye': this.lost('對手已離開房間'); return;
        case 'watchcode': rec.remoteCode = m.code; rec.ui(); return;
        case 'rejoin': // 對手斷線後回來（房主收到）
          if (m.build !== BUILD || m.game !== this.game || m.code !== this.code) { this.send({ k: 'full' }); return; }
          this.send({ k: 'resume', got: this.inSeq }); this.resend(m.got); this.resumed(); return;
        case 'resume': this.resend(m.got); this.resumed(); return;
      }
      if (m.g !== this.game) return;
      // 依編號依序處理：重複的丟掉，跳號的先暫存
      if (m.s) {
        if (m.s <= this.inSeq) return;
        if (m.s > this.inSeq + 1) { this.pend[m.s] = m; return; }
        this.inSeq = m.s; this.handle(m);
        while (this.pend[this.inSeq + 1]) { const n = this.pend[this.inSeq + 1]; delete this.pend[this.inSeq + 1]; this.inSeq = n.s; this.handle(n); }
        return;
      }
      this.handle(m);
    },
    handle(m) {
      if (m.k === 'reqsac') { if (this.host) this.orderSac(1 - ME, m.uid); return; }
      if (m.k === 'presac') { if (!this.host) this.enqueueSac(m.who, m.uid); return; }
      const w = this.waiters[m.k];
      if (w && w.length) { w.shift()(m); this.netWait(); }
      else (this.queues[m.k] || (this.queues[m.k] = [])).push(m);
    },
    mismatch(remote) { if (!remote) this.send({ k: 'mismatch' }); const c = this.conn; this.conn = null; this.on = false; setTimeout(() => { try { c && c.close(); } catch { } this.close(); }, 300); versionMismatch('對手'); },
    resend(got) { for (const x of this.out) if (x.s > got && this.conn && this.conn.open) try { this.conn.send(x); } catch { } },
    inGame() { return !!(G && G.winner === null && this.game > 0 && !spectating); },
    // 對局中斷線：不結束對局，60 秒內自動重連
    dropped() {
      if (!this.inGame()) { this.lost(); return; }
      if (this.reconn) return;
      const until = Date.now() + RECONNECT_SEC * 1000;
      const box = $('#reconn'); box.hidden = false;
      const tick = () => {
        const left = Math.ceil((until - Date.now()) / 1000);
        if (left <= 0) { this.stopReconn(); this.lost('對手超過 ' + RECONNECT_SEC + ' 秒沒有回來，對局結束。'); return; }
        box.innerHTML = `<b>連線中斷</b>正在重新連線…（${left} 秒）<small>${this.host ? '等待對手回來' : '正在重新連到房主'}</small>`;
        if (this.peer && !this.peer.destroyed && this.peer.disconnected) try { this.peer.reconnect(); } catch { }
        if (!this.host && (!this.conn || !this.conn.open) && Date.now() - (this.lastTry || 0) > 2900) this.tryRejoin();
        else if (!this.host && this.conn && this.conn.open) this.sendRejoin();
      };
      this.reconn = setInterval(tick, 1000); tick();
    },
    tryRejoin() {
      this.lastTry = Date.now();
      if (!this.peer || this.peer.destroyed || this.peer.disconnected) return;
      const conn = this.peer.connect(ROOM_PREFIX + this.code, { reliable: true });
      this.bind(conn);
      conn.on('open', () => { if (!this.reconn) { try { conn.close(); } catch { } return; } this.sendRejoin(); });
    },
    sendRejoin() { try { this.conn.send({ k: 'rejoin', build: BUILD, game: this.game, code: this.code, got: this.inSeq, g: this.game }); } catch { } },
    resumed() { if (!this.reconn) return; this.stopReconn(); banner('已重新連線，繼續對戰', 900); },
    stopReconn() { if (this.reconn) { clearInterval(this.reconn); this.reconn = null; } const b = $('#reconn'); if (b) b.hidden = true; },
    lost(text) {
      this.stopReconn();
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
      conn.on('close', () => { if (this.conn === conn) this.dropped(); });
      conn.on('error', () => { if (this.conn === conn) this.dropped(); });
    },
    toPick() { this.myCfg = null; cfg = { me: {}, foe: {} }; pickStep = 'me'; renderPick(); show('pick'); renderNetPick(); },
    ready() {
      const s = cfg.me; resolveSide(s);
      this.myCfg = { leader: s.realLeader, deck: s.cards, deckType: s.deck, deckLabel: (DECKS[s.deck] || {}).label, main: s.realLeader === 'L11' ? s.main : undefined, randLeader: s.leader === 'RANDOM' };
      this.send({ k: 'cfg', cfg: this.myCfg, build: BUILD }); renderNetPick();
      if (this.host) this.tryStart();
    },
    tryStart() {
      if (!this.myCfg || !this.peerCfg) return;
      const m = { k: 'start', seed: (Math.random() * 2 ** 31) | 0, cfgs: [this.myCfg, this.peerCfg], game: this.game + 1, build: BUILD };
      this.send(m); this.beginGame(m);
    },
    beginGame(m) {
      this.game = m.game; this.resetGame();
      const me = this.host ? 0 : 1;
      cfg = { me: { ...m.cfgs[me], realLeader: m.cfgs[me].leader, cards: m.cfgs[me].deck }, foe: { ...m.cfgs[1 - me], realLeader: m.cfgs[1 - me].leader } };
      this.myCfg = null; this.peerCfg = null;
      renderVS(); show('vs'); $('#vsStart').hidden = true; $('#vsBack').hidden = true;
      $('#vsHint').hidden = false;
      let left = 10; $('#vsHint').textContent = `對戰將在 ${left} 秒後開始，可以先查看自己的牌組`;
      const tick = setInterval(() => {
        if (!this.on) { clearInterval(tick); return; }
        left--; $('#vsHint').textContent = `對戰將在 ${left} 秒後開始，可以先查看自己的牌組`;
        if (left > 0) return;
        clearInterval(tick); $('#vsStart').hidden = false; $('#vsBack').hidden = false; $('#vsHint').hidden = true;
        startBattle({ me, seed: m.seed, cfgs: m.cfgs.map(c => ({ leader: c.leader, deck: c.deck, main: c.main })) });
      }, 1000);
    },
  };
  // 有雲端時用 Cloudflare TURN 中繼（手機網路、學校公司網路也連得上）；拿不到就用 PeerJS 預設
  const peerOpts = () => typeof Cloud !== 'undefined' ? Cloud.peerOptions() : Promise.resolve(undefined);
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = PEER_SRC; sc.onload = res; sc.onerror = () => rej(new Error('load')); document.head.appendChild(sc); });
  }
  function onlineMsg(text, err) { const e = $('#onMsg'); e.textContent = text; e.classList.toggle('err', !!err); }
  async function createRoom() {
    onlineMsg('建立房間中…');
    try { await loadPeer(); } catch { onlineMsg('連線元件載入失敗，請確認網路後再試', true); return; }
    const po = await peerOpts();
    const code = String(Math.floor(1000 + Math.random() * 9000)) + 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)];
    net.close(); net.on = true; net.host = true; net.code = code; net.game = 0;
    const peer = new window.Peer(ROOM_PREFIX + code, po); net.peer = peer;
    peer.on('open', () => { $('#roomCode').textContent = code; $('#roomBox').hidden = false; onlineMsg('把房間代碼告訴朋友，等待對手加入…'); });
    peer.on('connection', conn => {
      if (net.reconn && (!net.conn || !net.conn.open)) { net.bind(conn); return; } // 立刻開始聽，等對方送 rejoin
      if (net.conn) { conn.on('open', () => { conn.send({ k: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
      conn.on('open', () => { net.bind(conn); conn.send({ k: 'hello', build: BUILD }); if (rec.ready) conn.send({ k: 'watchcode', code: rec.code }); net.toPick(); });
    });
    peer.on('disconnected', () => { if (net.inGame()) try { peer.reconnect(); } catch { } });
    peer.on('error', e => { if (net.reconn) return; if (e.type === 'unavailable-id') { net.close(); createRoom(); } else if (!net.conn) onlineMsg('建立房間失敗：' + (e.type || '網路錯誤'), true); });
  }
  async function joinRoom() {
    const code = $('#joinCode').value.trim().toUpperCase();
    if (!/^\d{4}[A-Z]$/.test(code)) { onlineMsg('請輸入 4 個數字＋1 個英文字母的房間代碼，例如 3842K', true); return; }
    onlineMsg('連線中…');
    try { await loadPeer(); } catch { onlineMsg('連線元件載入失敗，請確認網路後再試', true); return; }
    const po = await peerOpts();
    net.close(); net.on = true; net.host = false; net.code = code; net.game = 0;
    const peer = new window.Peer(undefined, po); net.peer = peer;
    let timer = setTimeout(() => { if (!net.conn) { onlineMsg('找不到這個房間，請確認代碼或請對方重新建立', true); net.close(); } }, 12000);
    peer.on('open', () => {
      const conn = peer.connect(ROOM_PREFIX + code, { reliable: true });
      conn.on('open', () => { clearTimeout(timer); net.bind(conn); conn.send({ k: 'hello', build: BUILD }); net.toPick(); });
      conn.on('data', d => { if (d && d.k === 'full') { onlineMsg('這個房間已經滿了', true); net.close(); show('online'); } });
    });
    peer.on('disconnected', () => { if (net.inGame()) try { peer.reconnect(); } catch { } });
    peer.on('error', e => { clearTimeout(timer); if (net.reconn) return; if (!net.conn) { onlineMsg(e.type === 'peer-unavailable' ? '找不到這個房間，請確認代碼' : '連線失敗：' + (e.type || '網路錯誤'), true); net.close(); } });
  }
  function renderNetPick() {
    const box = $('#netPick'); if (!box) return;
    if (!net.on) return;
    box.innerHTML = `房間 <b>${net.code}</b>．版本 ${BUILD}．你是${net.host ? '房主' : '挑戰者'}<br>你：${net.myCfg ? '<b class="ok">已準備</b>' : '選擇中'}　對手：${net.peerCfg ? '<b class="ok">已準備</b>' : '選擇中'}`;
  }
  $('#btnOnline').onclick = () => { if (typeof Cloud !== 'undefined') Cloud.ice(); net.close(); $('#roomBox').hidden = true; onlineMsg(''); show('online'); };
  $('#btnCreate').onclick = createRoom;
  $('#btnJoin').onclick = joinRoom;
  $('#joinCode').onkeydown = e => { if (e.key === 'Enter') joinRoom(); };
  $('#onlineBack').onclick = () => { net.close(); show('home'); };
  addEventListener('beforeunload', () => { if (net.conn) try { net.conn.send({ k: 'bye' }); } catch { } });

  // 對手（遠端）控制器：照收到的訊息執行
  const byUid = (pool, uids) => (uids || []).map(u => pool.find(x => x.uid === u)).filter(Boolean);
  const Remote = {
    async choose(g, i) {
      const m = await net.next('play');
      await net.sacIdle();
      return byUid(g.p[i].hand, m.uids);
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

  // ================= 觀戰 =================
  // 對局端（電腦對戰的玩家、連線對戰的房主）記錄每一個決定並轉送給觀戰者；
  // 觀戰者用同一個亂數種子和牌組重建這一場，照記錄重播。紀錄只放在記憶體，對局結束就清掉。
  const WATCH_PREFIX = ROOM_PREFIX + 'w-';
  const WATCH_MAX = 5;
  const newCode = () => String(Math.floor(1000 + Math.random() * 9000)) + 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)];
  const rec = {
    peer: null, code: '', ready: false, failed: false, conns: [], start: null, log: [], seq: 0, t0: 0, remoteCode: '',
    async ensure() {
      if (this.peer || this.failed) return;
      try { await loadPeer(); } catch { this.failed = true; this.ui(); return; }
      const po = await peerOpts();
      const mk = () => {
        const code = newCode(); const peer = new window.Peer(WATCH_PREFIX + code, po); this.peer = peer;
        peer.on('open', () => { this.code = code; this.ready = true; this.ui(); if (net.on && net.host) net.send({ k: 'watchcode', code }); });
        peer.on('connection', conn => this.accept(conn));
        peer.on('error', e => {
          if (e.type === 'unavailable-id') { try { peer.destroy(); } catch { } this.peer = null; mk(); }
          else if (!this.ready) { this.failed = true; this.peer = null; this.ui(); }
        });
      };
      mk();
    },
    accept(conn) {
      conn.on('open', () => {
        if (this.conns.length >= WATCH_MAX) { conn.send({ k: 'full' }); setTimeout(() => { try { conn.close(); } catch { } }, 400); return; }
        this.conns.push(conn); this.ui();
        conn.send({ k: 'build', build: BUILD });
        conn.send(this.start ? { k: 'sync', start: this.start, log: this.log, elapsed: Date.now() - this.t0 } : { k: 'idle' });
      });
      const drop = () => { if (this.conns.includes(conn)) { this.conns = this.conns.filter(c => c !== conn); this.ui(); } };
      conn.on('close', drop); conn.on('error', drop);
    },
    cast(m) { for (const c of this.conns) try { if (c.open) c.send(m); } catch { } },
    begin(start) { this.start = start; this.log = []; this.seq = 0; this.t0 = Date.now(); this.cast({ k: 'start', start }); this.ensure(); this.ui(); },
    end() { if (!this.start) return; this.start = null; this.log = []; this.seq = 0; this.cast({ k: 'idle' }); this.ui(); },
    push(m) { if (!this.start || !G || spectating) return; m.seq = ++this.seq; m.turn = G.turn; this.log.push(m); this.cast({ k: 'ev', m }); },
    wrap(c) {
      return {
        ...c,
        choose: async (g, i, ph) => { const r = await c.choose(g, i, ph); this.push({ k: 'play', who: i, uids: (r || []).map(x => x.uid) }); return r; },
        decideSac: async (g, i, ph) => { const r = await c.decideSac(g, i, ph); this.push({ k: 'sac', who: i, uid: r ? r.uid : null }); return r; },
        respondCounter: async (g, j, e, o) => { const r = await c.respondCounter(g, j, e, o); this.push({ k: 'counter', who: j, uid: r ? r.uid : null }); return r; },
        pick: async (g, i, kind, o) => {
          const r = await c.pick(g, i, kind, o);
          this.push(kind === 'g08' ? { k: 'pick', who: i, g08: r && r.card ? { uid: r.card.uid, color: r.color } : null } : { k: 'pick', who: i, uids: (r || []).map(x => x.uid) });
          return r;
        },
      };
    },
    ui() {
      const e = $('#watchInfo'); if (!e) return;
      if (spectating) { e.innerHTML = `觀戰中．房號 <b>${watch.code}</b>`; return; }
      if (net.on && !net.host) { e.innerHTML = this.remoteCode ? `觀戰房號 <b>${this.remoteCode}</b>` : ''; return; }
      if (this.failed) { e.textContent = '觀戰：未連網，暫時無法開放'; return; }
      e.innerHTML = this.ready ? `觀戰房號 <b>${this.code}</b>．觀戰 ${this.conns.length}／${WATCH_MAX}` : '觀戰房號建立中…';
    },
  };

  const watch = {
    peer: null, conn: null, code: '', q: {}, w: {}, pre: [], preBusy: false, preW: [], catching: false, saved: 1,
    reset() { this.q = {}; this.w = {}; this.pre = []; this.preBusy = false; const pw = this.preW; this.preW = []; pw.forEach(f => f()); },
    msg(t, err) { const e = $('#wMsg'); if (e) { e.textContent = t; e.classList.toggle('err', !!err); } },
    close() {
      const c = this.conn, p = this.peer; this.conn = null; this.peer = null;
      try { c && c.close(); } catch { } try { p && p.destroy(); } catch { }
      if (spectating) { spectating = false; if (this.catching) { this.catching = false; speed = this.saved; } }
      this.reset();
    },
    async join() {
      const code = $('#wCode').value.trim().toUpperCase();
      if (!/^\d{4}[A-Z]$/.test(code)) { this.msg('請輸入 4 個數字＋1 個英文字母的觀戰房號，例如 3842K', true); return; }
      this.msg('連線中…');
      try { await loadPeer(); } catch { this.msg('連線元件載入失敗，請確認網路後再試', true); return; }
      const po = await peerOpts();
      this.close(); this.code = code;
      const peer = new window.Peer(undefined, po); this.peer = peer;
      const timer = setTimeout(() => { if (!this.conn) { this.msg('找不到這個觀戰房號，請確認對局還在進行', true); this.close(); } }, 12000);
      peer.on('open', () => {
        this.okBuild = false;
        const conn = peer.connect(WATCH_PREFIX + code, { reliable: true });
        conn.on('open', () => { clearTimeout(timer); if (this.peer !== peer) return; this.conn = conn; if (!spectating) this.msg('已連上，等待對局資料…'); });
        conn.on('data', d => this.onData(d));
        conn.on('close', () => { if (this.conn === conn) this.lost(); });
      });
      peer.on('error', e => { clearTimeout(timer); if (!this.conn) { this.msg(e.type === 'peer-unavailable' ? '找不到這個觀戰房號，請確認對局還在進行' : '連線失敗：' + (e.type || '網路錯誤'), true); this.close(); } });
    },
    lost() {
      this.conn = null;
      if (G && spectating && G.winner === null) { G = null; resolver = null; clearInterval(clockT); }
      const m = $('#modal'), b = $('#mbox'); b.innerHTML = '';
      b.append(el('h3', '', '觀戰結束'), el('p', '', '對局端已離開或對局已結束。'));
      const ok = el('button', 'btn primary', '回首頁'); ok.onclick = () => { m.hidden = true; this.close(); show('home'); };
      b.appendChild(ok); m.hidden = false;
    },
    onData(m) {
      if (!m || typeof m !== 'object') return;
      switch (m.k) {
        case 'build': if (m.build !== BUILD) { this.close(); versionMismatch('對局端'); } else this.okBuild = true; return;
        case 'full': this.msg('這個房間的觀戰人數已滿（最多 5 人）', true); this.close(); return;
        case 'idle': if (!G || !spectating) this.msg('已連上。目前沒有進行中的對局，下一場開始時會自動進入觀戰。'); return;
        case 'sync': if (!this.okBuild) { this.close(); versionMismatch('對局端'); return; } this.begin(m.start, m.log || [], m.elapsed || 0); return;
        case 'start': this.begin(m.start, [], 0); return;
        case 'ev': if (spectating && G) this.add(m.m); return;
      }
    },
    begin(start, log, elapsed) {
      this.reset();
      this.catching = log.length > 0;
      if (this.catching) { if (speed) this.saved = speed; speed = 0; }
      startBattle({ spectate: true, seed: start.seed, cfgs: start.cfgs });
      t0 = Date.now() - elapsed;
      for (const m of log) this.add(m);
      renderAct();
    },
    add(m) {
      if (m.k === 'presac') { this.pre.push(m); this.pump(); return; }
      const key = m.k + m.who, w = this.w[key];
      if (w && w.length) w.shift()(m); else (this.q[key] || (this.q[key] = [])).push(m);
    },
    next(kind, who, g) {
      if (g && g !== G) return new Promise(() => {});
      return new Promise(res => {
        const key = kind + who, q = this.q[key];
        if (q && q.length) return res(q.shift());
        (this.w[key] || (this.w[key] = [])).push(res);
        if (this.catching) { this.catching = false; speed = this.saved || 1; renderAct(); banner('已追上進度，現在是即時觀戰', 1200); }
      });
    },
    async pump() {
      if (this.preBusy) return; this.preBusy = true;
      while (this.pre.length && G && spectating && G.winner === null) {
        const m = this.pre[0];
        if (m.turn !== G.turn || G.phase !== 'choose') break;
        const st = G.p[m.who].statues.find(x => x.uid === m.uid);
        if (st) await G.sacrifice(m.who, st, 'pre');
        this.pre.shift();
        if (G) renderAll();
      }
      this.preBusy = false; const pw = this.preW; this.preW = []; pw.forEach(f => f());
    },
    async presacBefore(seq) {
      for (let k = 0; k < 200; k++) {
        if (!G || G.winner !== null || !this.pre.some(m => m.seq < seq)) return;
        const p = new Promise(r => this.preW.push(r)); this.pump(); await p;
        if (!this.preBusy && this.pre.some(m => m.seq < seq) && (this.pre[0].turn !== G.turn || G.phase !== 'choose')) await new Promise(r => setTimeout(r, 30));
      }
    },
  };
  const SpecCtrl = {
    async choose(g, i) { watch.pump(); const m = await watch.next('play', i, g); await watch.presacBefore(m.seq); return byUid(g.p[i].hand, m.uids); },
    async decideSac(g, i) { const m = await watch.next('sac', i, g); return m.uid == null ? null : g.canSacList(i).find(s => s.uid === m.uid) || null; },
    async respondCounter(g, j, effId, opts) { const m = await watch.next('counter', j, g); return m.uid == null ? null : opts.find(s => s.uid === m.uid) || null; },
    async pick(g, i, kind, o) {
      const m = await watch.next('pick', i, g);
      if (kind === 'g08') return m.g08 ? { card: o.cards.find(c => c.uid === m.g08.uid), color: m.g08.color } : null;
      return byUid(o.cards || o.statues, m.uids);
    },
  };
  $('#btnWatch').onclick = () => { watch.close(); watch.msg(''); show('watchScr'); };
  $('#wJoin').onclick = () => watch.join();
  $('#wCode').onkeydown = e => { if (e.key === 'Enter') watch.join(); };
  $('#wBack').onclick = () => { watch.close(); show('home'); };

  window.__summonLog = () => logs.map(l => `${l.turn}|${l.who}|${l.text}`);
  window.__summonState = () => G && JSON.stringify({ mode, pk: pickables ? pickables.list.map(x => x.id) : null, res: !!resolver, me: ME, turn: G.turn, phase: G.phase, first: G.first, q: Object.values(net.queues).reduce((a, x) => a + x.length, 0), w: Object.values(net.waiters).reduce((a, x) => a + x.length, 0), p: G.p.map(p => ({ s: p.score, h: p.hand.map(c => c.uid), d: p.deck.length, x: p.disc.length, st: p.statues.map(t => t.uid + (t.up ? '' : 'v') + (t.sealed ? 's' : '')), u: p.sacUsed })) });
  show('home');
})();
