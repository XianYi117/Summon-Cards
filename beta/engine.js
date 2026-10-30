// 召喚 vj.1030.0 對戰引擎（規則＋電腦 AI）
// 卡牌效果依 data.js 的代號實作：fa＝啟動效果、fs＝獻祭效果
(function (root) {
  let UID = 1;
  let RNG = Math.random;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rnd = n => Math.floor(RNG() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const colorOf = c => c.as || c.id[0];
  const FA = id => CARDS[id] ? CARDS[id].fa : null;
  const FS = id => CARDS[id] ? CARDS[id].fs : null;

  // 牌型：回傳 [基礎戰力, 等級類別, 名稱]
  function shape(cards) {
    const cnt = {};
    cards.forEach(c => { const k = colorOf(c); cnt[k] = (cnt[k] || 0) + 1; });
    const t = Object.values(cnt).sort((a, b) => b - a).join('');
    const map = { '4': [7, '4', 'AAAA'], '31': [6, '3', 'AAAB'], '3': [5, '3', 'AAA'], '22': [4, '22', 'AABB'], '21': [3, '2', 'AAB'], '211': [3, '2', 'AABC'], '2': [2, '2', 'AA'] };
    if (map[t]) return map[t];
    return [1, '1', ['', 'A', 'AB', 'ABC'][cards.length] || 'A'];
  }
  const LEVEL_NAME = { '1': '無牌型', '2': '成對', '22': '成對', '3': '三同屬', '4': '四同屬' };
  const L12_POWER = { A: 1, AA: 1, AAA: 1, AAAA: 1, AB: 3, AAB: 3, AAAB: 3, AABB: 4, ABC: 5, AABC: 6 };
  const PAIR_GROUP = ['AA', 'AAB', 'AABC', 'AABB']; // 牌型有 AA
  const TRIP_GROUP = ['AAA', 'AAAB'];              // 牌型有 AAA
  const MIX = ['AB', 'ABC'];                       // 雜色
  // 核心屬性：重複最多的屬性；AABB 與無牌型看最左一張
  function coreOf(cards, cat) {
    if (cat === '22' || cat === '1') return colorOf(cards[0]);
    const cnt = {}; let best = null;
    cards.forEach(c => { const k = colorOf(c); cnt[k] = (cnt[k] || 0) + 1; });
    for (const c of cards) { const k = colorOf(c); if (best === null || cnt[k] > cnt[best]) best = k; }
    return best;
  }
  // leftSummon：L12 或「無法成立牌型時：將最左 1 張啟動為石像」
  function summonList(cards, cat, leftSummon) {
    if (cat === '1') return leftSummon ? [cards[0]] : [];
    const cnt = {};
    cards.forEach(c => { const k = colorOf(c); cnt[k] = (cnt[k] || 0) + 1; });
    if (cat === '22') {
      const out = [];
      for (const c of cards) if (cnt[colorOf(c)] >= 2 && !out.some(o => colorOf(o) === colorOf(c))) out.push(c);
      return out;
    }
    const main = coreOf(cards, cat);
    return [cards.find(c => colorOf(c) === main)];
  }

  // AI 評估值（依效果代號）
  const ACT_VAL = {
    all1: 1.1, coreF: .8, coreW: .8, coreG: .8, pair1: .7, trip1: .6, aabb2: .6, aaa2: .7, aaaa3: .5, mix2: .5, mono2: .6,
    stF: .7, stW: .7, stG: .7, sac2: .6, fewer2: .7, behind2: .7, lost1: .5, sacced1: .5, destroyed1: .3, oppM1: 1, oppSac3: .3,
    cPlus2: .8, cPunish: .5, cRecall: .5, cDiscard: .5, leftCore: .3, peekHand: .4, peekPlay1: .4, mixSummon: .4,
    cutDraw: .4, oppCap: .9, drawPlus1: .9, drawSwap: .6, drawRetrieve: .6, drawScry: .5, drawLost: .5, drawTie: .3, drawBehind: .5,
    onMySac: .5, onOppSac: .5, endHandBottom: .2, endSacBack: .3, endDiscBottom: .3, onOppBroken: .3, onMyBroken2: .5, onAnyBroken: .4, onMyBrokenRet: .4,
  };
  const SAC_VAL = {
    destroy: .9, extraPt: .9, plus2: .8, oppMinus2: .8, counter: .7, block: .7, counterPlus2: .6, immune: .5, plus1draw1: .7, draw2: .6,
    tutor: .6, top3: .6, retrieve2: .6, copy: .6, actOff: .6, sealLeader: .6, setCore: .6, recolor: .6, peek2: .3, peekPlay2: .4,
    oppBottom: .5, oppRandDiscard: .5, swapTop: .3, discBack2: .2, statueToHand: .4, mySacToHand: .5, mySacUp: .6, mySacToDisc: .2,
    mySacToDeck: .3, oppSacToDisc: .4, bothSacToDisc: .3, oppSacUp: .1, noop: 0,
  };
  const aval = id => ACT_VAL[FA(id)] || .3;
  const cval = id => aval(id) + .5 * (SAC_VAL[FS(id)] || .3);
  const PRE_ONLY = ['setCore', 'peekPlay2']; // 翻牌前才能發動
  const NO_COPY = ['copy', 'counter'];

  function buildDeck(type) {
    if (Array.isArray(type)) return shuffle(type.map(id => ({ uid: UID++, id })));
    const comp = (DECKS[type] || DECKS.RND).comp;
    if (!comp) return shuffle(randomDeckIds(RNG).map(id => ({ uid: UID++, id })));
    const deck = [];
    for (const col of ['F', 'W', 'G']) {
      const ids = Object.keys(CARDS).filter(id => id[0] === col);
      shuffle(ids).slice(0, comp[col]).forEach(id => deck.push({ uid: UID++, id }));
    }
    return shuffle(deck);
  }

  class Game {
    constructor(cfg) {
      if (cfg.seed != null) { RNG = mulberry(cfg.seed); UID = 1; } else RNG = Math.random;
      this.ui = cfg.ui || { ev: async () => {} };
      this.ctrl = cfg.controllers;
      this.p = cfg.players.map((pc, i) => ({
        idx: i, leader: pc.leader, deckType: pc.deck, deck: buildDeck(pc.cards || pc.deck), hand: [], disc: [], statues: [],
        score: 0, l01: 0, main: pc.main || null, lsealed: false, sacUsed: false, lastRes: null,
        sacThisTurn: false, destroyedOpp: false, peeked: [], peekedPlay: [], wantPeek: 0,
      }));
      for (const p of this.p) if (p.leader === 'L11' && !p.main) {
        const cnt = {}; p.deck.forEach(c => cnt[c.id[0]] = (cnt[c.id[0]] || 0) + 1);
        p.main = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      }
      this.first = rnd(2); this.turn = 0; this.winner = null; this.how = null; this.sudden = false;
      this.ctx = null; this.played = [[], []]; this.phase = 'setup'; this.actOff = false;
      this.locked = [null, null]; this._wait = [null, null];
      this.log = [];
      this.p.forEach((p, i) => this.rawDraw(i, 5, true));
    }
    opp(i) { return this.p[1 - i]; }
    note(text, who) { this.log.push({ turn: this.turn, who, text }); if (this.ui.log) this.ui.log(text, who); }
    // 本回合全場啟動效果無效時，沒有任何石像的啟動效果生效
    active(p) { return this.actOff ? [] : p.statues.filter(s => s.up && !s.sealed); }
    upright(p) { return p.statues.filter(s => s.up); }
    sacked(p) { return p.statues.filter(s => !s.up); }
    fx(p, key) { return this.active(p).filter(s => FA(s.id) === key).length; }
    lead(p, code) { return p.leader === code && !p.lsealed; }
    canSacList(i) {
      const p = this.p[i];
      if (p.sacUsed || (this.ctx && this.ctx.blocked[i])) return [];
      return p.statues.filter(s => s.up && !s.sealed && !(s.maint && !p.lsealed) && FS(s.id) !== 'counter' && (this.phase === 'choose' || !PRE_ONLY.includes(FS(s.id))));
    }
    counterList(j) {
      const p = this.p[j];
      if (p.sacUsed || (this.ctx && this.ctx.blocked[j])) return [];
      return p.statues.filter(s => s.up && !s.sealed && !(s.maint && !p.lsealed) && FS(s.id) === 'counter');
    }
    cname(id) { return `${id} ${CARDS[id].name}`; }

    // ---------- 抽牌 ----------
    refill(p, silent) { if (!p.deck.length && p.disc.length) { p.deck = shuffle(p.disc); p.disc = []; if (!silent) this.note('棄牌區洗回牌庫', p.idx); } }
    rawDraw(i, n, silent) {
      const p = this.p[i]; const got = [];
      for (let k = 0; k < n; k++) {
        this.refill(p, silent);
        if (p.deck.length) { const c = p.deck.pop(); p.hand.push(c); got.push(c); }
      }
      return got;
    }
    async draw(i, n) { const got = this.rawDraw(i, n); if (got.length) await this.ui.ev('draw', { i, cards: got }); return got; }
    // 【多抽】：對手的「對手【多抽】時，少 1 張」每座每回合最多減 1 次
    async extraDraw(i, n) {
      if (n <= 0) return [];
      let m = n;
      for (const s of this.active(this.opp(i)).filter(s => FA(s.id) === 'cutDraw')) {
        if (m <= 0) break;
        if (s._cut === this.turn) continue;
        s._cut = this.turn; m--;
      }
      if (m < n) this.note(`【多抽】${n} 張被減少為 ${m} 張`, i);
      return this.draw(i, m);
    }
    async retrieve(i, n, random) {
      const p = this.p[i]; if (!p.disc.length || n <= 0) return [];
      let pick;
      if (random) pick = [p.disc[rnd(p.disc.length)]];
      else pick = await this.ctrl[i].pick(this, i, 'retrieve', { cards: p.disc.slice(), n: Math.min(n, p.disc.length), title: `從棄牌區取回 ${Math.min(n, p.disc.length)} 張` });
      pick = (pick || []).filter(c => p.disc.includes(c));
      for (const c of pick) { p.disc.splice(p.disc.indexOf(c), 1); p.hand.push(c); }
      if (pick.length) { this.note(`取回 ${pick.map(c => c.id).join('、')}`, i); await this.ui.ev('retrieve', { i, cards: pick }); }
      return pick;
    }

    // ---------- 勝利 ----------
    altWin(i) {
      const p = this.p[i], o = this.opp(i);
      if (p.lsealed) return false;
      const up = this.upright(p);
      if (p.leader === 'L08') return this.sacked(p).length >= 5;
      if (p.leader === 'L10') { const c = { F: 0, W: 0, G: 0 }; up.forEach(s => c[s.id[0]]++); return up.length >= 7 && c.F >= 2 && c.W >= 2 && c.G >= 2; }
      if (p.leader === 'L11') return up.filter(s => s.id[0] === p.main).length >= 4;
      if (p.leader === 'L13') return o.statues.filter(s => s.up && s.byL13).length >= 4;
      return false;
    }
    checkAlt() {
      if (this.winner !== null) return true;
      const a = [this.altWin(0), this.altWin(1)];
      if (a[0] && a[1]) { if (!this.sudden) { this.sudden = true; this.note('雙方同時達成勝利條件，進入搶 1 分加賽'); } return false; }
      if (a[0] || a[1]) { this.winner = a[0] ? 0 : 1; this.how = 'leader'; if (this._onWin) this._onWin(); return true; }
      return false;
    }

    // ---------- 石像移動 ----------
    removeStatue(owner, s) {
      const p = this.p[owner]; const k = p.statues.indexOf(s); if (k < 0) return false;
      p.statues.splice(k, 1); this.releaseL13(); return true;
    }
    // 破壞：i 破壞對手的 target
    async destroy(i, target) {
      const p = this.p[i], o = this.opp(i), own = 1 - i;
      // 被破壞那一刻的觸發數量（在移除前計算，所以包含被破壞的那座本身）
      const myBroken2 = this.fx(o, 'onMyBroken2');
      const myRet = this.fx(o, 'onMyBrokenRet');
      const anyO = this.fx(o, 'onAnyBroken');
      if (!this.removeStatue(own, target)) return;
      o.disc.push({ uid: target.uid, id: target.id });
      p.destroyedOpp = true;
      this.note(`破壞了 ${target.id}`, i);
      await this.ui.ev('destroy', { i, owner: own, statue: target });
      if (myBroken2) await this.extraDraw(own, 2 * myBroken2);
      for (let k = 0; k < myRet; k++) await this.retrieve(own, 1);
      if (anyO) await this.extraDraw(own, anyO);
      const oppB = this.fx(p, 'onOppBroken') + this.fx(p, 'onAnyBroken');
      if (oppB) await this.extraDraw(i, oppB);
      this.checkAlt();
    }

    // ---------- 補牌階段 ----------
    async drawPhase() {
      const order = [this.first, 1 - this.first];
      for (const i of order) {
        const p = this.p[i], o = this.opp(i);
        const cap = Math.max(1, (this.lead(p, 'L09') ? 6 : 5) - this.fx(o, 'oppCap'));
        if (p.hand.length < cap) await this.draw(i, cap - p.hand.length);
        // L02 潮汐交換：補牌後，0～2 張手牌放回牌庫底，再補滿手牌
        if (this.lead(p, 'L02') && p.hand.length) {
          const back = ((await this.ctrl[i].pick(this, i, 'l02', { cards: p.hand.slice(), n: 2, title: 'L02 潮汐交換：選 0～2 張手牌放回牌庫底，再補滿手牌' })) || []).filter(c => p.hand.includes(c)).slice(0, 2);
          for (const c of back) { p.hand.splice(p.hand.indexOf(c), 1); p.deck.unshift(c); }
          if (back.length) {
            this.note(`潮汐交換：${back.length} 張手牌放回牌庫底，再補滿手牌`, i); await this.ui.ev('discard', { i, cards: [] });
            if (p.hand.length < cap) await this.draw(i, cap - p.hand.length);
          }
        }
      }
      // 【補牌】觸發的啟動效果，起始玩家先處理
      for (const i of order) {
        const p = this.p[i], o = this.opp(i);
        let k = this.fx(p, 'drawPlus1')
          + (p.lastRes === 'lose' ? this.fx(p, 'drawLost') : 0)
          + (p.lastRes === 'tie' ? this.fx(p, 'drawTie') : 0)
          + (p.score < o.score ? this.fx(p, 'drawBehind') : 0);
        if (k) { this.note(`【補牌】【多抽】${k} 張`, i); await this.extraDraw(i, k); }
        for (let n = this.fx(p, 'drawSwap'); n > 0; n--) {
          if (!p.hand.length) break;
          const [c] = await this.ctrl[i].pick(this, i, 'discardOne', { cards: p.hand.slice(), n: 1, title: '【換牌】：棄 1 張手牌，再抽 1 張' });
          if (!c || !p.hand.includes(c)) break;
          p.hand.splice(p.hand.indexOf(c), 1); p.disc.push(c); await this.ui.ev('discard', { i, cards: [c] });
          await this.draw(i, 1);
        }
        for (let n = this.fx(p, 'drawRetrieve'); n > 0; n--) await this.retrieve(i, 1, true);
        for (let n = this.fx(p, 'drawScry'); n > 0; n--) await this.scry(i, 2);
      }
      // 出牌前：看對手手牌（L07、【出牌】前：看對手 2 張手牌）
      for (const i of order) {
        const p = this.p[i], o = this.opp(i);
        if ((this.lead(p, 'L07') || this.fx(p, 'peekHand')) && o.hand.length) await this.peek(i, 2);
      }
      this.checkAlt();
    }
    // 看牌庫頂 n 張，各自決定放回牌庫頂或牌庫底
    async scry(i, n) {
      const p = this.p[i]; this.refill(p);
      const top = p.deck.slice(-n).reverse(); if (!top.length) return;
      const bottom = ((await this.ctrl[i].pick(this, i, 'scry', { cards: top.slice(), n: top.length, title: `看牌庫頂 ${top.length} 張：選要放到牌庫底的牌（其餘留在牌庫頂）` })) || []).filter(c => top.includes(c));
      for (const c of bottom) { p.deck.splice(p.deck.indexOf(c), 1); p.deck.unshift(c); }
      this.note(`看牌庫頂 ${top.length} 張，${bottom.length} 張放到牌庫底`, i);
    }
    // L13：封印一旦選定就固定；維持石像（2 座）或被封印的石像離場才解除
    releaseL13() {
      for (const i of [0, 1]) {
        const p = this.p[i], o = this.opp(i);
        for (const t of o.statues.filter(x => x.byL13)) {
          const keep = p.statues.filter(m => m.maint === t.uid && m.up);
          if (keep.length < 2 || !t.up) { t.byL13 = false; if (!t.tmpSeal) t.sealed = false; p.statues.forEach(m => { if (m.maint === t.uid) m.maint = null; }); this.note(`雙界封印解除：${t.id}`, i); }
        }
        p.statues.forEach(m => { if (m.maint && !o.statues.some(t => t.uid === m.maint && t.byL13)) m.maint = null; });
      }
    }
    // 封魔者被封印時（到判定勝負為止），雙界封印暫時失效
    syncL13() {
      for (const i of [0, 1]) {
        const p = this.p[i], o = this.opp(i);
        for (const t of o.statues.filter(x => x.byL13)) t.sealed = !p.lsealed || !!t.tmpSeal;
      }
    }
    async l13Cleanup() {
      this.releaseL13(); this.syncL13();
      for (const i of [this.first, 1 - this.first]) {
        const p = this.p[i], o = this.opp(i);
        if (!this.lead(p, 'L13')) continue;
        const c = {}; this.upright(p).filter(s => !s.maint).forEach(s => (c[s.id[0]] = c[s.id[0]] || []).push(s));
        let slots = 0; Object.values(c).forEach(a => slots += Math.floor(a.length / 2));
        const tg = o.statues.filter(s => s.up && !s.sealed && !s.byL13);
        const n = Math.min(slots, tg.length);
        if (!n) continue;
        const picked = (await this.ctrl[i].pick(this, i, 'l13', { statues: tg, n, title: `雙界封印：選擇 ${n} 座對手石像封印（選定後不能更換）` })) || [];
        const chosen = [...new Set(picked)].filter(s => tg.includes(s)).slice(0, n);
        for (const s of tg) if (chosen.length < n && !chosen.includes(s)) chosen.push(s);
        const pairs = []; for (const col in c) for (let k = 0; k + 1 < c[col].length; k += 2) pairs.push([c[col][k], c[col][k + 1]]);
        chosen.forEach((t, k) => { t.sealed = true; t.byL13 = true; pairs[k].forEach(m => m.maint = t.uid); });
        this.note(`雙界封印：封印 ${chosen.map(s => s.id).join('、')}`, i);
        await this.ui.ev('seal', { i });
      }
    }
    async peek(i, n) {
      const o = this.opp(i);
      const cards = shuffle(o.hand.slice()).slice(0, n);
      this.p[i].peeked = cards; // 電腦 AI 出牌時會用到看過的牌
      await this.ui.ev('peek', { i, cards });
    }

    // ---------- 鎖定出牌與「翻牌前看對手出戰牌」 ----------
    // 對手先鎖定、自己還沒鎖定時，才看得到（看最左邊的 n 張）
    revealPlay(i) {
      const p = this.p[i], cards = this.locked[1 - i];
      if (!p.wantPeek || !cards || this.locked[i]) return false;
      p.peekedPlay = cards.slice(0, p.wantPeek); p.wantPeek = 0;
      this.note(`翻牌前看到對手 ${p.peekedPlay.length} 張出戰牌`, i);
      this.ui.ev('peekPlay', { i, cards: p.peekedPlay });
      return true;
    }
    onLock(i, cards) {
      this.locked[i] = cards || [];
      this.revealPlay(1 - i);
      const w = this._wait[1 - i]; if (w) { this._wait[1 - i] = null; w(this.locked[i]); }
    }
    // 電腦 AI：等對手先鎖定再出牌；雙方都在等時，起始玩家先出
    waitOppLock(i) {
      if (this.locked[1 - i]) return Promise.resolve(this.locked[1 - i]);
      return new Promise(res => {
        this._wait[i] = res;
        if (this._wait[1 - i]) { const f = this.first; const w = this._wait[f]; this._wait[f] = null; w(null); }
      });
    }

    // ---------- 戰力 ----------
    power(i, cards, ctx, withBreak) {
      const p = this.p[i], o = this.opp(i);
      const [base0, , name] = shape(cards);
      const br = [];
      let base = base0;
      if (this.lead(p, 'L12')) base = L12_POWER[name] || 1;
      br.push([`牌型 ${name}${this.lead(p, 'L12') ? '（專屬）' : ''}`, base]);
      const core = ctx.core[i];
      const add = (label, v) => { if (v) br.push([label, v]); };
      if (this.lead(p, 'L01')) add('L01 連勝', p.l01);
      if (this.lead(p, 'L03') && core === 'G') add('L03 森林之力', 1);
      if (this.lead(p, 'L04') && core === 'F') add('L04 烈火之力', 1);
      if (this.lead(p, 'L05') && core === 'W') add('L05 深海之力', 1);
      if (this.lead(p, 'L06') && PAIR_GROUP.includes(name)) add('L06 雙生共鳴', 1);
      if (this.lead(p, 'L11') && this.upright(p).filter(s => s.id[0] === p.main).length >= 2) add('L11 主色號令', 2);
      const upP = this.upright(p), upO = this.upright(o).length, sacP = this.sacked(p).length;
      const colors = new Set(cards.map(colorOf));
      for (const s of this.active(p)) {
        const nm = s.id;
        switch (FA(s.id)) {
          case 'all1': add(nm, 1); break;
          case 'coreF': if (core === 'F') add(nm, 1); break;
          case 'coreW': if (core === 'W') add(nm, 1); break;
          case 'coreG': if (core === 'G') add(nm, 1); break;
          case 'pair1': if (PAIR_GROUP.includes(name)) add(nm, 1); break;
          case 'trip1': if (TRIP_GROUP.includes(name)) add(nm, 1); break;
          case 'aabb2': if (name === 'AABB') add(nm, 2); break;
          case 'aaa2': if (name === 'AAA') add(nm, 2); break;
          case 'aaaa3': if (name === 'AAAA') add(nm, 3); break;
          case 'mix2': if (MIX.includes(name)) add(nm, 2); break;
          case 'mono2': if (cards.length && colors.size === 1) add(nm, 2); break;
          case 'stF': add(nm, Math.floor(upP.filter(x => x.id[0] === 'F').length / 2)); break;
          case 'stW': add(nm, Math.floor(upP.filter(x => x.id[0] === 'W').length / 2)); break;
          case 'stG': add(nm, Math.floor(upP.filter(x => x.id[0] === 'G').length / 2)); break;
          case 'sac2': add(nm, Math.floor(sacP / 2)); break;
          case 'fewer2': if (upO > upP.length) add(nm, 2); break;
          case 'behind2': if (p.score < o.score) add(nm, 2); break;
          case 'lost1': if (p.lastRes === 'lose') add(nm, 1); break;
          case 'sacced1': if (p.sacThisTurn) add(nm, 1); break;
          case 'destroyed1': if (p.destroyedOpp) add(nm, 1); break;
        }
      }
      for (const s of this.active(o)) {
        if (FA(s.id) === 'oppM1') add(`對手 ${s.id}`, -1);
        else if (FA(s.id) === 'oppSac3') add(`對手 ${s.id}`, -Math.floor(sacP / 3));
      }
      add('獻祭加成', ctx.bonus[i]);
      if (ctx.minus) add('對手獻祭', -ctx.minus[i]);
      const total = br.reduce((a, b) => a + b[1], 0);
      return withBreak ? { total, br } : total;
    }
    // 剋制：每回合都判定（不限牌型）；不受剋制、L12 不會被剋
    counterAdv(ctx) {
      const adv = [false, false];
      for (const i of [0, 1]) {
        const o = this.opp(i), j = 1 - i;
        const oImm = ctx.immune[j] || this.lead(o, 'L12');
        if (ctx.core[i] && ctx.core[j] && BEATS[ctx.core[i]] === ctx.core[j] && !oImm) adv[i] = true;
      }
      return adv;
    }
    evaluate(played, ctx, withBreak) {
      if (ctx === this.ctx) [0, 1].forEach(i => { if (played[i].length) this.setCore(i); });
      const adv = this.counterAdv(ctx);
      const r = [0, 1].map(i => this.power(i, played[i], ctx, true));
      for (const i of [0, 1]) {
        if (!adv[i]) continue;
        const x = r[i], p = this.p[i], j = 1 - i;
        x.br.push(['屬性剋制', 2]); x.total += 2;
        const c2 = 2 * this.fx(p, 'cPlus2'); if (c2) { x.br.push(['剋制成功', c2]); x.total += c2; }
        const cb = (ctx.cbonus || [0, 0])[i]; if (cb) { x.br.push(['剋制加成', cb]); x.total += cb; }
        // 被剋制的一方：「屬性被對手剋制時對手戰力 -1」
        const pun = this.fx(this.p[j], 'cPunish'); if (pun) { x.br.push(['被剋方反制', -pun]); x.total -= pun; }
      }
      const pw = r.map(x => x.total);
      const w = pw[0] > pw[1] ? 0 : pw[1] > pw[0] ? 1 : null;
      return withBreak ? { w, pw, br: r.map(x => x.br), adv } : { w, pw, adv };
    }
    setCore(i) {
      const cards = this.played[i]; if (!cards.length) return;
      const [, cat] = shape(cards); const p = this.p[i];
      this.ctx.cat[i] = cat;
      this.ctx.core[i] = this.ctx.coreSet[i] || (this.lead(p, 'L12') || this.fx(p, 'leftCore') ? colorOf(cards[0]) : coreOf(cards, cat));
    }

    // ---------- 獻祭 ----------
    // 同一時間只處理一個獻祭（同時出牌期間雙方都可能獻祭）
    sacrifice(i, st, phase) {
      const run = () => this._sacrifice(i, st, phase);
      const job = (this._sacLock || Promise.resolve()).then(run, run);
      this._sacLock = job.catch(() => {});
      return job;
    }
    async onSacrificed(i) {
      const p = this.p[i], j = 1 - i;
      const a = this.fx(p, 'onMySac'), b = this.fx(this.p[j], 'onOppSac');
      if (a) await this.extraDraw(i, a);
      if (b) await this.extraDraw(j, b);
    }
    async _sacrifice(i, st, phase) {
      const p = this.p[i];
      if (this.winner !== null) return false;
      if (!this.canSacList(i).includes(st)) return false;
      st.up = false; p.sacUsed = true; p.sacThisTurn = true;
      this.note(`獻祭 ${st.id}：${CARDS[st.id].sac}`, i);
      await this.ui.ev('sacrifice', { i, statue: st });
      const j = 1 - i;
      const opts = this.counterList(j);
      if (opts.length) {
        const r = await this.ctrl[j].respondCounter(this, j, st.id, opts);
        if (r && opts.includes(r)) {
          r.up = false; this.p[j].sacUsed = true; this.p[j].sacThisTurn = true;
          this.note(`【反擊】${r.id}：讓 ${st.id} 的效果無效`, j);
          await this.ui.ev('counter', { i: j, statue: r, target: st });
          await this.onSacrificed(i); await this.onSacrificed(j);
          this.checkAlt();
          return true;
        }
      }
      await this.resolve(i, FS(st.id), phase, st);
      await this.onSacrificed(i);
      this.checkAlt();
      return true;
    }
    async pickStatue(i, list, title, purpose) {
      if (!list.length) return null;
      const r = await this.ctrl[i].pick(this, i, 'statue', { statues: list.slice(), n: 1, title, purpose });
      const s = (r || [])[0];
      return list.includes(s) ? s : list[0];
    }
    async resolve(i, key, phase, src) {
      const p = this.p[i], o = this.opp(i), j = 1 - i, ctx = this.ctx;
      switch (key) {
        case 'peek2': if (o.hand.length) await this.peek(i, 2); break;
        case 'immune': ctx.immune[i] = true; break;
        case 'tutor': {
          if (!p.deck.length) break;
          const [c] = (await this.ctrl[i].pick(this, i, 'tutor', { cards: p.deck.slice(), n: 1, title: '從牌庫選 1 張加入手牌' })) || [];
          if (c && p.deck.includes(c)) { p.deck.splice(p.deck.indexOf(c), 1); p.hand.push(c); shuffle(p.deck); await this.ui.ev('draw', { i, cards: [c] }); }
          break;
        }
        case 'copy': {
          const tg = p.statues.filter(s => s.up && !s.sealed && s !== src && !NO_COPY.includes(FS(s.id)) && (this.phase === 'choose' || !PRE_ONLY.includes(FS(s.id))));
          const t = await this.pickStatue(i, tg, '選擇要發動獻祭效果的我方石像（不獻祭它）', 'copy');
          if (t) { this.note(`發動 ${t.id} 的獻祭效果：${CARDS[t.id].sac}`, i); await this.resolve(i, FS(t.id), phase, t); }
          break;
        }
        case 'plus1draw1': ctx.bonus[i] += 1; await this.extraDraw(i, 1); break;
        case 'plus2': ctx.bonus[i] += 2; break;
        case 'draw2': await this.extraDraw(i, 2); break;
        case 'mySacToDisc': case 'mySacToDeck': case 'mySacToHand': case 'mySacUp': {
          const tg = this.sacked(p).filter(s => key !== 'mySacUp' || s !== src);
          const purpose = { mySacToDisc: '放入棄牌區', mySacToDeck: '洗回牌庫', mySacToHand: '加入手牌', mySacUp: '重新直立' }[key];
          const t = await this.pickStatue(i, tg, `選擇我方 1 座已獻祭石像：${purpose}`, key); if (!t) break;
          if (key === 'mySacUp') { t.up = true; t.sealed = false; }
          else {
            this.removeStatue(i, t); const c = { uid: t.uid, id: t.id };
            if (key === 'mySacToDisc') p.disc.push(c);
            else if (key === 'mySacToDeck') { p.deck.push(c); shuffle(p.deck); }
            else p.hand.push(c);
          }
          this.note(`已獻祭石像 ${t.id}：${purpose}`, i); await this.ui.ev('statueMove', { i });
          break;
        }
        case 'oppSacToDisc': case 'oppSacUp': {
          const t = await this.pickStatue(i, this.sacked(o), `選擇對手 1 座已獻祭石像：${key === 'oppSacUp' ? '重新直立' : '放入棄牌區'}`, key); if (!t) break;
          if (key === 'oppSacUp') { t.up = true; t.sealed = false; } else { this.removeStatue(j, t); o.disc.push({ uid: t.uid, id: t.id }); }
          this.note(`對手已獻祭石像 ${t.id}：${key === 'oppSacUp' ? '重新直立' : '放入棄牌區'}`, i); await this.ui.ev('statueMove', { i });
          break;
        }
        case 'bothSacToDisc': {
          const a = await this.pickStatue(i, this.sacked(p), '選擇我方 1 座已獻祭石像放入棄牌區', 'mySacToDisc');
          if (a) { this.removeStatue(i, a); p.disc.push({ uid: a.uid, id: a.id }); }
          const b = await this.pickStatue(i, this.sacked(o), '選擇對手 1 座已獻祭石像放入棄牌區', 'oppSacToDisc');
          if (b) { this.removeStatue(j, b); o.disc.push({ uid: b.uid, id: b.id }); }
          this.note('雙方各 1 座已獻祭石像放入棄牌區', i); await this.ui.ev('statueMove', { i });
          break;
        }
        case 'block': ctx.blocked[j] = true; this.note('本回合對手不能獻祭', i); break;
        case 'oppMinus2': ctx.minus[j] += 2; break;
        case 'actOff': this.actOff = true; this.note('本回合全場石像的啟動效果無效（到判定勝負）', i); await this.ui.ev('seal', { i }); break;
        case 'setCore': {
          const opts = ['F', 'W', 'G'].map(c => ({ uid: 'c' + c, color: c }));
          const [r] = (await this.ctrl[i].pick(this, i, 'color', { cards: opts, n: 1, title: '本回合我方核心屬性改為：' })) || [];
          const c = (r && r.color) || 'F'; ctx.coreSet[i] = c;
          this.note(`宣告本回合核心屬性為${COLOR_NAME[c]}`, i); await this.ui.ev('coreSet', { i, color: c });
          break;
        }
        case 'sealLeader': o.lsealed = true; this.syncL13(); this.note('本回合對手隊長效果無效（到判定勝負）', i); await this.ui.ev('seal', { i }); break;
        case 'swapTop': {
          this.refill(p);
          if (p.hand.length && p.deck.length) {
            const [c] = (await this.ctrl[i].pick(this, i, 'swap', { cards: p.hand.slice(), n: 1, title: '選 1 張手牌與牌庫頂交換' })) || [];
            if (c && p.hand.includes(c)) { p.hand.splice(p.hand.indexOf(c), 1); const top = p.deck.pop(); p.deck.push(c); p.hand.push(top); await this.ui.ev('draw', { i, cards: [top] }); }
          }
          break;
        }
        case 'discBack2': {
          for (let k = 0; k < 2 && p.disc.length; k++) p.deck.push(p.disc.splice(rnd(p.disc.length), 1)[0]);
          shuffle(p.deck); this.note('棄牌區 2 張洗回牌庫', i); break;
        }
        case 'top3': {
          this.refill(p);
          const top = p.deck.slice(-3).reverse(); if (!top.length) break;
          const [c] = (await this.ctrl[i].pick(this, i, 'tutor', { cards: top.slice(), n: 1, title: '看牌庫頂 3 張：選 1 張加入手牌，其餘放回牌庫底' })) || [];
          const pick = top.includes(c) ? c : top[0];
          for (const x of top) p.deck.splice(p.deck.indexOf(x), 1);
          p.hand.push(pick); top.filter(x => x !== pick).forEach(x => p.deck.unshift(x));
          await this.ui.ev('draw', { i, cards: [pick] });
          break;
        }
        case 'peekPlay2': p.wantPeek += 2; this.revealPlay(i); break;
        case 'retrieve2': await this.retrieve(i, 2); break;
        case 'statueToHand': {
          const t = await this.pickStatue(i, this.upright(p), '選擇我方 1 座直立石像回到手牌', 'statueToHand'); if (!t) break;
          this.removeStatue(i, t); p.hand.push({ uid: t.uid, id: t.id });
          this.note(`${t.id} 回到手牌`, i); await this.ui.ev('statueMove', { i });
          break;
        }
        case 'recolor': {
          if (this.phase !== 'choose' && this.played[i].length) { // 翻牌後：變換 1 張出戰牌
            const r = await this.ctrl[i].pick(this, i, 'g08', { cards: this.played[i].slice(), title: '變換 1 張出戰牌的屬性（本回合有效）' });
            if (r && r.card) { r.card.as = r.color; this.setCore(i); this.note(`把 ${r.card.id} 變成${COLOR_NAME[r.color]}屬性`, i); await this.ui.ev('g08', { i }); }
          } else { // 出牌階段：變換 1 張手牌，對手看不到是哪一張
            if (!p.hand.length) break;
            const r = await this.ctrl[i].pick(this, i, 'g08', { cards: p.hand.slice(), hand: true, title: '變換 1 張手牌的屬性（本回合有效）' });
            if (r && r.card) { r.card.as = r.color; this.note('變換 1 張手牌的屬性', i); await this.ui.ev('g08', { i, hand: true, card: r.card }); }
          }
          break;
        }
        case 'oppBottom': {
          if (!o.hand.length) break;
          const [c] = (await this.ctrl[j].pick(this, j, 'handBottom', { cards: o.hand.slice(), n: 1, title: '對手要求：選 1 張手牌放回牌庫底' })) || [];
          const x = o.hand.includes(c) ? c : o.hand[0];
          o.hand.splice(o.hand.indexOf(x), 1); o.deck.unshift(x);
          this.note('對手選 1 張手牌放回牌庫底', i); await this.ui.ev('discard', { i: j, cards: [] });
          break;
        }
        case 'counterPlus2': ctx.cbonus[i] += 2; break;
        case 'destroy': {
          const t = await this.pickStatue(i, this.upright(o), '選擇要破壞的對手直立石像', 'destroy');
          if (t) await this.destroy(i, t);
          break;
        }
        case 'extraPt': ctx.extraPt[i] = true; break;
        case 'oppRandDiscard': if (o.hand.length) {
          const c = o.hand.splice(rnd(o.hand.length), 1)[0]; o.disc.push(c);
          this.note(`讓對手隨機棄掉 ${c.id}`, i); await this.ui.ev('discard', { i: j, cards: [c] });
        } break;
        case 'noop': this.note('剋制已不限牌型，這個效果沒有額外作用', i); break;
      }
    }

    // ---------- 回合 ----------
    async turnLoop() {
      while (this.winner === null && this.turn < 60) {
        await this.playTurn();
      }
      if (this.winner === null) { this.how = 'end'; const [a, b] = [this.p[0].score, this.p[1].score]; this.winner = a === b ? -1 : a > b ? 0 : 1; }
      await this.ui.ev('gameover', { winner: this.winner, how: this.how });
      return this.winner;
    }
    async playTurn() {
      this.turn++;
      this.p.forEach(p => { p.sacUsed = false; p.lsealed = false; p.peeked = []; p.peekedPlay = []; p.wantPeek = 0; p.sacThisTurn = false; p.destroyedOpp = false; });
      this.actOff = false; this.locked = [null, null]; this._wait = [null, null];
      this.syncL13();
      this.ctx = { core: [null, null], cat: [null, null], bonus: [0, 0], minus: [0, 0], cbonus: [0, 0], coreSet: [null, null], immune: [false, false], blocked: [false, false], extraPt: [false, false] };
      this.played = [[], []];
      this.phase = 'draw';
      await this.ui.ev('turnStart', { turn: this.turn, first: this.first });
      await this.drawPhase(); if (this.winner !== null) return;
      if (this.p.some(p => !p.hand.length)) { this.winner = -2; return; }
      // 出牌（含出牌前獻祭）
      this.phase = 'choose';
      this.p.forEach(p => { p.wantPeek += this.fx(p, 'peekPlay1'); });
      const order = [this.first, 1 - this.first];
      const choice = await Promise.race([
        Promise.all([0, 1].map(i => Promise.resolve(this.ctrl[i].choose(this, i, 'pre')).then(r => { this.onLock(i, r); return r; }))),
        new Promise(r => { this._onWin = () => r(null); }),
      ]);
      this._onWin = null;
      if (this.winner !== null || !choice) return;
      await this._sacLock;
      for (const i of [0, 1]) {
        const hand = this.p[i].hand;
        let cs = (choice[i] || []).filter(c => hand.includes(c)).slice(0, 4);
        if (!cs.length) cs = hand.slice(0, 1);
        this.played[i] = cs;
        for (const c of cs) hand.splice(hand.indexOf(c), 1);
      }
      this.phase = 'reveal';
      [0, 1].forEach(i => this.setCore(i));
      await this.ui.ev('reveal', { played: this.played });
      // 公開後獻祭：輪流宣告，雙方連續跳過就結束
      this.phase = 'post';
      let passes = 0, k = 0;
      while (passes < 2 && this.winner === null) {
        const i = order[k++ % 2];
        if (!this.canSacList(i).length) { passes++; continue; }
        const st = await this.ctrl[i].decideSac(this, i, 'post');
        if (!st) { passes++; await this.ui.ev('pass', { i }); continue; }
        passes = 0;
        await this.sacrifice(i, st, 'post');
      }
      if (this.winner !== null) return;
      // 戰力計算
      this.phase = 'settle';
      const ev = this.evaluate(this.played, this.ctx, true);
      let gain = 0;
      if (ev.w !== null) {
        const p = this.p[ev.w]; gain = this.ctx.extraPt[ev.w] ? 2 : 1;
        p.score += gain;
        if (p.leader === 'L01') p.l01++;
        const l = this.opp(ev.w); if (l.leader === 'L01') l.l01 = 0;
      }
      this.p.forEach((p, i) => { p.lastRes = ev.w === null ? 'tie' : ev.w === i ? 'win' : 'lose'; });
      this.note(ev.w === null ? `戰力 ${ev.pw[0]} 對 ${ev.pw[1]}，平手` : `戰力 ${ev.pw[0]} 對 ${ev.pw[1]}，${ev.w === 0 ? '我方' : '對手'}得 ${gain} 分`);
      await this.ui.ev('settle', { ...ev, gain });
      // 判定勝負時觸發：剋制成功收回、被剋制時讓對手棄牌
      const recall = [0, 1].map(i => ev.adv[i] ? this.fx(this.p[i], 'cRecall') : 0);
      for (const i of order) {
        const n = ev.adv[1 - i] ? this.fx(this.p[i], 'cDiscard') : 0; const o = this.opp(i);
        for (let m = 0; m < n && o.hand.length; m++) {
          const c = o.hand.splice(rnd(o.hand.length), 1)[0]; o.disc.push(c);
          this.note(`被剋制反制：對手隨機棄掉 ${c.id}`, i); await this.ui.ev('discard', { i: 1 - i, cards: [c] });
        }
      }
      // 一次性封印與「本回合全場啟動效果無效」只到判定勝負為止
      this.actOff = false;
      this.p.forEach(p => { p.lsealed = false; p.statues.forEach(s => { if (s.tmpSeal) { s.tmpSeal = false; s.sealed = false; } }); });
      this.syncL13();
      await this.ui.ev('unseal', {});
      // 召喚
      this.phase = 'summon';
      for (const i of (ev.w !== null ? [ev.w, 1 - ev.w] : order)) {
        const p = this.p[i], cards = this.played[i];
        const [, cat] = shape(cards);
        const sm = summonList(cards, cat, this.lead(p, 'L12') || this.fx(p, 'mixSummon') > 0);
        const newS = sm.map(c => ({ uid: c.uid, id: c.id, up: true, sealed: false }));
        p.statues.push(...newS);
        for (const c of cards) { delete c.as; if (!sm.includes(c)) p.disc.push(c); }
        if (newS.length) this.note(`【啟動】石像 ${newS.map(s => s.id).join('、')}`, i);
        await this.ui.ev('summon', { i, statues: newS, rest: cards.filter(c => !sm.includes(c)) });
      }
      // 屬性剋制成功時，收回一張至手牌（本回合的出戰牌）
      for (const i of order) {
        const p = this.p[i];
        for (let n = recall[i]; n > 0; n--) {
          const cand = p.disc.filter(c => this.played[i].some(x => x.uid === c.uid));
          if (!cand.length) break;
          const [c] = (await this.ctrl[i].pick(this, i, 'retrieve', { cards: cand, n: 1, title: '剋制成功：收回 1 張本回合出戰牌' })) || [];
          const x = cand.includes(c) ? c : cand[0];
          p.disc.splice(p.disc.indexOf(x), 1); p.hand.push(x);
          this.note(`收回 ${x.id}`, i); await this.ui.ev('retrieve', { i, cards: [x] });
        }
      }
      this.p.forEach(p => [...p.hand, ...p.disc, ...p.deck].forEach(c => { delete c.as; }));
      // 整理
      this.phase = 'end';
      for (const i of order) {
        const p = this.p[i];
        for (let n = this.fx(p, 'endHandBottom'); n > 0 && p.hand.length; n--) {
          const [c] = (await this.ctrl[i].pick(this, i, 'handBottom', { cards: p.hand.slice(), n: 1, title: '【整理】：選 1 張手牌放到牌庫底' })) || [];
          const x = p.hand.includes(c) ? c : p.hand[0]; p.hand.splice(p.hand.indexOf(x), 1); p.deck.unshift(x);
          this.note('【整理】手牌 1 張放到牌庫底', i);
        }
        for (let n = this.fx(p, 'endSacBack'); n > 0; n--) {
          const t = await this.pickStatue(i, this.sacked(p), '【整理】：選我方 1 座已獻祭石像洗回牌庫', 'mySacToDeck'); if (!t) break;
          this.removeStatue(i, t); p.deck.push({ uid: t.uid, id: t.id }); shuffle(p.deck);
          this.note(`【整理】已獻祭石像 ${t.id} 洗回牌庫`, i); await this.ui.ev('statueMove', { i });
        }
        for (let n = this.fx(p, 'endDiscBottom'); n > 0 && p.disc.length; n--) {
          const [c] = (await this.ctrl[i].pick(this, i, 'discBottom', { cards: p.disc.slice(), n: 1, title: '【整理】：選棄牌區 1 張放回牌庫底' })) || [];
          const x = p.disc.includes(c) ? c : p.disc[0]; p.disc.splice(p.disc.indexOf(x), 1); p.deck.unshift(x);
          this.note(`【整理】${x.id} 放回牌庫底`, i);
        }
      }
      await this.l13Cleanup();
      // 勝利
      if (this.sudden && ev.w !== null) { this.winner = ev.w; this.how = 'sudden'; return; }
      const sc = this.p.map(p => p.score >= 4);
      if (sc[0] || sc[1]) { this.winner = sc[0] && sc[1] ? (this.p[0].score > this.p[1].score ? 0 : 1) : (sc[0] ? 0 : 1); this.how = 'points'; return; }
      if (this.checkAlt()) return;
      this.first = 1 - this.first;
      this.phase = 'end';
    }
  }

  // ================= 電腦 AI =================
  // 出牌：抽樣推估對手可能的出牌，算出每種出法（含剋制）的勝率，
  // 再加上比分、召喚石像、隊長第二勝利條件與保留手牌的價值，選總分最高的出法。
  const ALT_LEADERS = ['L08', 'L10', 'L11', 'L13'];
  const combosOf = hand => {
    const out = [];
    const rec = (start, cur) => { if (cur.length) out.push(cur.slice()); if (cur.length === 4) return; for (let k = start; k < hand.length; k++) { cur.push(hand[k]); rec(k + 1, cur); cur.pop(); } };
    rec(0, []); return out;
  };
  const shuffled = a => { const b = a.slice(); for (let k = b.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [b[k], b[j]] = [b[j], b[k]]; } return b; };
  const leftCoreOf = (g, p) => g.lead(p, 'L12') || g.fx(p, 'leftCore') > 0;

  const AI = {
    P: { win: 3, keep: .2, card: 0, streak: .6, K: 10 },
    goalValue(g, p, sm) {
      let v = 0; const up = g.upright(p);
      if (p.leader === 'L11') { const n = up.filter(s => s.id[0] === p.main).length; v += sm.filter(c => c.id[0] === p.main).length * (n >= 2 ? 1.6 : 1.1); }
      if (p.leader === 'L10') { const h = { F: 0, W: 0, G: 0 }; up.forEach(s => h[s.id[0]]++); v += sm.filter(c => h[c.id[0]] < 2).length * 1.1 + (up.length < 7 ? sm.length * .4 : 0); }
      if (p.leader === 'L13') { const h = { F: 0, W: 0, G: 0 }; up.forEach(s => h[s.id[0]]++); v += sm.filter(c => h[c.id[0]] % 2 === 1).length * .8 + sm.length * .2; }
      if (p.leader === 'L08') v += .5 * sm.length;
      // 同色石像系：召喚同色石像更有價值
      for (const c of sm) { const k = { F: 'stF', W: 'stW', G: 'stG' }[c.id[0]]; v += .4 * g.fx(p, k); }
      return v;
    },
    altAfter(g, p, sm) {
      if (!sm.length || !g.lead(p, p.leader)) return false;
      const up = g.upright(p).concat(sm);
      if (p.leader === 'L11') return up.filter(s => s.id[0] === p.main).length >= 4;
      if (p.leader === 'L10') { const c = { F: 0, W: 0, G: 0 }; up.forEach(s => c[s.id[0]]++); return up.length >= 7 && c.F >= 2 && c.W >= 2 && c.G >= 2; }
      return false;
    },
    // 一手牌可能的排列：最多的屬性排左邊；AABB、無牌型、最左決定屬性時，每種屬性都試著放最左
    orders(g, p, cards) {
      const cnt = {}; cards.forEach(c => cnt[c.id[0]] = (cnt[c.id[0]] || 0) + 1);
      const val = c => AI.goalValue(g, p, [c]) + cval(c.id);
      const base = cards.slice().sort((a, b) => (cnt[b.id[0]] - cnt[a.id[0]]) || (val(b) - val(a)));
      const cols = [...new Set(base.map(c => c.id[0]))];
      const [, cat] = shape(base);
      if (!(leftCoreOf(g, p) || cat === '22' || cat === '1') || cols.length < 2) return [base];
      return cols.filter(col => !(cat === '22' && cnt[col] < 2)).map(col => base.filter(c => c.id[0] === col).concat(base.filter(c => c.id[0] !== col)));
    },
    evalPlay(g, i, cs) {
      const p = g.p[i]; const [, cat] = shape(cs); const l12 = g.lead(p, 'L12');
      const set = g.ctx && g.ctx.coreSet[i];
      const core = set || (leftCoreOf(g, p) ? colorOf(cs[0]) : coreOf(cs, cat));
      const ctx = { core: [null, null], cat: [null, null], bonus: [0, 0], minus: [0, 0], immune: [false, false] };
      ctx.core[i] = core; ctx.cat[i] = cat;
      if (g.ctx) { ctx.bonus[i] = g.ctx.bonus[i]; ctx.minus[i] = g.ctx.minus[i]; }
      return { i, cs, cat, core, l12, pw: g.power(i, cs, ctx), left: l12 || g.fx(p, 'mixSummon') > 0, imm: !!(g.ctx && g.ctx.immune[i]) };
    },
    // 對手模型：從對手看不到的牌（手牌＋牌庫）抽樣成手牌；看過的手牌一定在裡面，看過的出戰牌一定會出
    oppSamples(g, i, K) {
      const j = 1 - i, o = g.p[j], me = g.p[i];
      const playKnown = (me.peekedPlay || []).filter(c => o.hand.includes(c));
      const known = [...new Set([...playKnown, ...(me.peeked || []).filter(c => o.hand.includes(c))])];
      const pool = o.hand.concat(o.deck).filter(c => !known.includes(c));
      const out = [];
      for (let k = 0; k < K; k++) {
        const hand = known.concat(shuffled(pool).slice(0, Math.max(0, o.hand.length - known.length)));
        if (!hand.length) continue;
        let best = null;
        for (const comb of combosOf(hand)) {
          if (playKnown.some(c => !comb.includes(c))) continue;
          const e = AI.evalPlay(g, j, AI.orders(g, o, comb)[0]);
          const v = e.pw + .3 * summonList(e.cs, e.cat, e.left).length - .25 * e.cs.length;
          if (!best || v > best.v) best = { ...e, v };
        }
        if (best) out.push(best);
      }
      return out;
    },
    // a 剋 b 時 a 多出的戰力
    clash(g, a, b) {
      if (!a.core || !b.core || BEATS[a.core] !== b.core || b.imm || b.l12) return 0;
      const pa = g.p[a.i], pb = g.p[b.i];
      return 2 + 2 * g.fx(pa, 'cPlus2') + ((g.ctx && g.ctx.cbonus) ? g.ctx.cbonus[a.i] : 0) - g.fx(pb, 'cPunish');
    },
    winOdds(g, me, samples) {
      let w = 0, t = 0;
      for (const o of samples) {
        const a = me.pw + AI.clash(g, me, o), b = o.pw + AI.clash(g, o, me);
        if (a > b) w++; else if (a === b) t++;
      }
      const n = samples.length || 1;
      return { win: w / n, tie: t / n, lose: (n - w - t) / n };
    },
    keepValue(rest) {
      const cnt = {}; rest.forEach(c => cnt[c.id[0]] = (cnt[c.id[0]] || 0) + 1);
      return AI.P.keep * Object.values(cnt).reduce((a, n) => a + (n >= 2 ? n : n * .2), 0);
    },
    bestPlay(g, i) {
      const p = g.p[i], o = g.opp(i);
      const P = AI.P, samples = AI.oppSamples(g, i, P.K);
      let winV = P.win * (p.score >= 3 ? 2.5 : 1), loseV = P.win * (o.score >= 3 ? 2.5 : 1);
      if (p.leader === 'L01') { winV += P.streak * (p.l01 + 1); loseV += P.streak * p.l01; }
      if (g.ctx && g.ctx.extraPt[i]) winV *= 1.6;
      const altW = ALT_LEADERS.includes(p.leader) ? 1.4 : 1;
      let best = null;
      for (const comb of combosOf(p.hand)) {
        for (const cs of AI.orders(g, p, comb)) {
          const e = AI.evalPlay(g, i, cs);
          const odds = AI.winOdds(g, e, samples);
          const sm = summonList(cs, e.cat, e.left);
          let v = odds.win * winV - odds.lose * loseV;
          v += sm.reduce((a, c) => a + .55 + .4 * cval(c.id), 0) + AI.goalValue(g, p, sm) * altW;
          if (AI.altAfter(g, p, sm)) v += 50;
          v += (e.l12 ? 0 : AI.keepValue(p.hand.filter(c => !cs.includes(c)))) - P.card * cs.length;
          v += Math.random() * .3;
          if (!best || v > best.v) best = { v, cs };
        }
      }
      return best ? best.cs : p.hand.slice(0, 1);
    },
    threat(g, j) {
      const p = g.p[j]; const up = g.upright(p);
      if (p.leader === 'L11') return up.filter(s => s.id[0] === p.main).length >= 3;
      if (p.leader === 'L10') { const c = { F: 0, W: 0, G: 0 }; up.forEach(s => c[s.id[0]]++); return Math.min(2, c.F) + Math.min(2, c.W) + Math.min(2, c.G) >= 5 && up.length >= 6; }
      if (p.leader === 'L08') return g.sacked(p).length >= 4;
      if (p.leader === 'L13') return up.length >= 5;
      return p.score >= 3;
    },
    async choose(g, i) {
      await AI.preSac(g, i);
      if (g.p[i].wantPeek > 0 && !g.locked[1 - i]) await g.waitOppLock(i);
      return AI.bestPlay(g, i);
    },
    targetValue(g, i, s) {
      const opp = g.opp(i);
      return aval(s.id) * (s.sealed ? 0 : 1) + (opp.leader === 'L11' && s.id[0] === opp.main ? 1.5 : 0) + (opp.leader === 'L10' ? .8 : 0) + (opp.leader === 'L13' ? .4 : 0) + (s.maint ? 1.2 : 0) - (['onMyBroken2', 'onMyBrokenRet', 'onAnyBroken'].includes(FA(s.id)) ? .4 : 0);
    },
    predictCore(g, i) {
      const cnt = {}; for (const s of AI.oppSamples(g, i, 8)) cnt[s.core] = (cnt[s.core] || 0) + 1;
      const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      return best && cnt[best] >= 4 ? best : null;
    },
    leaderThreat(g, j) {
      const p = g.p[j]; if (p.lsealed) return 0;
      if (p.leader === 'L01') return p.l01;
      if (p.leader === 'L11') return g.upright(p).filter(s => s.id[0] === p.main).length >= 2 ? 2 : 0;
      if (p.leader === 'L12' || p.leader === 'L13') return 1.5;
      return ['L03', 'L04', 'L05', 'L06'].includes(p.leader) ? .8 : .3;
    },
    // 翻牌前獻祭：依局面評估
    async preSac(g, i) {
      const p = g.p[i], o = g.opp(i); const opts = g.canSacList(i); if (!opts.length) return;
      const by = k => opts.filter(s => FS(s.id) === k).sort((a, b) => aval(a.id) - aval(b.id))[0];
      const threat = AI.threat(g, 1 - i);
      const bestTarget = Math.max(0, ...g.upright(o).map(s => AI.targetValue(g, i, s)));
      const oppSac = g.canSacList(1 - i).map(s => SAC_VAL[FS(s.id)] || .3);
      const cnt = {}; p.hand.forEach(c => cnt[c.id[0]] = (cnt[c.id[0]] || 0) + 1);
      const maxSame = Math.max(0, ...Object.values(cnt));
      let st = null;
      if (!st && by('destroy') && g.upright(o).length && (threat || bestTarget >= 1.2)) st = by('destroy');
      if (!st && by('block') && (threat || Math.max(0, ...oppSac) >= .8)) st = by('block');
      if (!st && by('sealLeader') && AI.leaderThreat(g, 1 - i) >= 2) st = by('sealLeader');
      if (!st && by('setCore') && AI.predictCore(g, i)) st = by('setCore');
      if (!st && by('oppSacToDisc') && o.leader === 'L08' && g.sacked(o).length >= 3) st = by('oppSacToDisc');
      if (!st && maxSame <= 2) for (const k of ['draw2', 'top3', 'tutor', 'retrieve2', 'mySacToHand', 'statueToHand', 'swapTop']) if (!st && by(k)) st = by(k);
      if (!st && (by('oppBottom') || by('oppRandDiscard')) && o.hand.length >= 4) st = by('oppRandDiscard') || by('oppBottom');
      if (!st && by('peekPlay2') && !g.locked[1 - i]) st = by('peekPlay2');
      if (!st && by('mySacUp') && g.sacked(p).some(s => aval(s.id) >= .7)) st = by('mySacUp');
      if (!st && p.leader === 'L08' && g.lead(p, 'L08')) st = opts.slice().sort((a, b) => cval(a.id) - cval(b.id))[0] || null;
      if (st) await g.sacrifice(i, st, 'pre');
    },
    // 模擬一個會改變戰力的獻祭效果，回傳新的判定
    simulate(g, i, key, st) {
      const ctx = g.ctx, o = g.opp(i), j = 1 - i;
      const save = JSON.stringify({ b: ctx.bonus, m: ctx.minus, c: ctx.cbonus, im: ctx.immune });
      const undo = [];
      switch (key) {
        case 'plus2': ctx.bonus[i] += 2; break;
        case 'plus1draw1': ctx.bonus[i] += 1; break;
        case 'oppMinus2': ctx.minus[j] += 2; break;
        case 'immune': ctx.immune[i] = true; break;
        case 'counterPlus2': ctx.cbonus[i] += 2; break;
        case 'actOff': { const was = g.actOff; g.actOff = true; undo.push(() => { g.actOff = was; }); break; }
        case 'sealLeader': { const was = o.lsealed; o.lsealed = true; undo.push(() => { o.lsealed = was; }); break; }
        case 'recolor': return AI.bestG08(g, i) ? { w: i } : null;
        case 'copy': {
          for (const t of g.p[i].statues.filter(s => s.up && !s.sealed && s !== st && !NO_COPY.includes(FS(s.id)))) {
            const e = AI.simulate(g, i, FS(t.id), t); if (e && e.w === i) { AI._copy = t; return e; }
          }
          return null;
        }
        default: return null;
      }
      // 「本回合有獻祭石像：戰力 +1」也一起算
      const was = g.p[i].sacThisTurn; g.p[i].sacThisTurn = true;
      const e = g.evaluate(g.played, ctx);
      g.p[i].sacThisTurn = was;
      undo.forEach(f => f());
      const s = JSON.parse(save); ctx.bonus = s.b; ctx.minus = s.m; ctx.cbonus = s.c; ctx.immune = s.im;
      g.evaluate(g.played, ctx);
      return e;
    },
    async decideSac(g, i, phase) {
      const p = g.p[i], o = g.opp(i); const opts = g.canSacList(i); if (!opts.length) return null;
      const by = k => opts.filter(s => FS(s.id) === k).sort((a, b) => aval(a.id) - aval(b.id))[0];
      const ev = g.evaluate(g.played, g.ctx);
      if (ev.w === i) {
        if (by('extraPt')) return by('extraPt');
        if (ev.pw[i] - ev.pw[1 - i] <= 2 && g.canSacList(1 - i).length && by('block')) return by('block');
        if (by('destroy') && AI.threat(g, 1 - i)) return by('destroy');
        if (p.leader === 'L08' && g.lead(p, 'L08')) return opts.slice().sort((a, b) => cval(a.id) - cval(b.id))[0] || null;
        return null;
      }
      // 落後或平手：找能翻盤的獻祭（便宜的先）
      const cands = opts.slice().sort((a, b) => cval(a.id) - cval(b.id));
      let tieSave = null;
      for (const s of cands) {
        const e = AI.simulate(g, i, FS(s.id), s);
        if (!e) continue;
        if (e.w === i) return s;
        if (ev.w !== null && e.w === null && !tieSave) tieSave = s;
      }
      if (tieSave) return tieSave;
      if (by('destroy') && g.upright(o).length) return by('destroy');
      if (by('oppSacToDisc') && o.leader === 'L08' && g.sacked(o).length >= 3) return by('oppSacToDisc');
      if (p.hand.length <= 2) for (const k of ['draw2', 'retrieve2', 'top3', 'tutor']) if (by(k)) return by(k);
      if (p.leader === 'L08' && g.lead(p, 'L08')) return cands[0] || null;
      return null;
    },
    async respondCounter(g, j, effId, opts) {
      const k = FS(effId);
      const imp = ['destroy', 'extraPt', 'block', 'sealLeader', 'actOff', 'mySacUp', 'oppSacToDisc'].includes(k) || (g.phase === 'post' && ['plus2', 'plus1draw1', 'oppMinus2', 'immune', 'counterPlus2', 'recolor', 'copy'].includes(k));
      return imp ? opts[0] : null;
    },
    bestG08(g, i) {
      let best = null; const cards = g.played[i];
      if (!cards.length) return null;
      for (const c of cards) for (const col of ['F', 'W', 'G']) {
        if (col === colorOf(c)) continue;
        const old = c.as; c.as = col;
        const e = g.evaluate(g.played, g.ctx);
        if (e.w === i && (!best || e.pw[i] > best.v)) best = { v: e.pw[i], card: c, color: col };
        if (old) c.as = old; else delete c.as;
      }
      g.evaluate(g.played, g.ctx);
      return best;
    },
    async pick(g, i, kind, o) {
      const p = g.p[i], opp = g.opp(i);
      const fit = c => { const cnt = {}; p.hand.forEach(x => cnt[x.id[0]] = (cnt[x.id[0]] || 0) + 1); return (cnt[c.id[0]] || 0) + cval(c.id) * .3; };
      switch (kind) {
        case 'retrieve': return o.cards.slice().sort((a, b) => fit(b) - fit(a)).slice(0, o.n);
        case 'tutor': return [o.cards.slice().sort((a, b) => fit(b) - fit(a))[0]];
        case 'discardOne': case 'swap': case 'handBottom': return [o.cards.slice().sort((a, b) => fit(a) - fit(b))[0]];
        case 'discBottom': return [o.cards.slice().sort((a, b) => cval(b.id) - cval(a.id))[0]];
        case 'scry': return o.cards.filter(c => fit(c) < 1.3);
        case 'color': { const c = AI.predictCore(g, i); const want = c ? Object.keys(BEATS).find(k => BEATS[k] === c) : (g.p[i].hand[0] || { id: 'F' }).id[0]; return [o.cards.find(x => x.color === want) || o.cards[0]]; }
        case 'l02': {
          const cnt = {}; o.cards.forEach(c => cnt[c.id[0]] = (cnt[c.id[0]] || 0) + 1);
          const left = col => (p.deck.filter(c => c.id[0] === col).length);
          const main = Object.keys(cnt).sort((a, b) => (cnt[b] - cnt[a]) || (left(b) - left(a)))[0];
          if (cnt[main] >= 4) return [];
          const pairs = Object.keys(cnt).filter(k => cnt[k] >= 2);
          const keep = cnt[main] >= 3 ? [main] : pairs.length >= 2 ? pairs : [main];
          return o.cards.filter(c => !keep.includes(c.id[0])).sort((a, b) => cval(a.id) - cval(b.id)).slice(0, 2);
        }
        case 'statue': {
          const L = o.statues.slice(); const pur = o.purpose;
          if (pur === 'destroy') return [L.sort((a, b) => AI.targetValue(g, i, b) - AI.targetValue(g, i, a))[0]];
          if (pur === 'copy') { const t = AI._copy && L.includes(AI._copy) ? AI._copy : L.sort((a, b) => (SAC_VAL[FS(b.id)] || 0) - (SAC_VAL[FS(a.id)] || 0))[0]; AI._copy = null; return [t]; }
          if (pur === 'oppSacUp' || pur === 'mySacToDeck' || pur === 'mySacToDisc') return [L.sort((a, b) => cval(a.id) - cval(b.id))[0]];
          if (pur === 'statueToHand') return [L.sort((a, b) => (a.sealed ? -1 : 0) - (b.sealed ? -1 : 0) || cval(a.id) - cval(b.id))[0]];
          return [L.sort((a, b) => cval(b.id) - cval(a.id))[0]];
        }
        case 'l13': return o.statues.slice().sort((a, b) => aval(b.id) - aval(a.id)).slice(0, o.n);
        case 'g08': {
          if (o.hand) { // 出牌階段：把手牌變成最多的那個屬性
            const cnt = {}; p.hand.forEach(c => cnt[colorOf(c)] = (cnt[colorOf(c)] || 0) + 1);
            const main = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
            const c = p.hand.find(x => colorOf(x) !== main); return c ? { card: c, color: main } : null;
          }
          const b = AI.bestG08(g, i); return b ? { card: b.card, color: b.color } : null;
        }
      }
      return [];
    },
  };

  root.Engine = { Game, AI, shape, coreOf, summonList, colorOf, LEVEL_NAME, L12_POWER, PAIR_GROUP, TRIP_GROUP, cval, FA, FS, PRE_ONLY };
})(typeof window !== 'undefined' ? window : globalThis);
