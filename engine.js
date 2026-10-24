// 召喚 vj.1023.0 對戰引擎（規則＋電腦 AI）
(function (root) {
  let UID = 1;
  let RNG = Math.random;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rnd = n => Math.floor(RNG() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const colorOf = c => c.as || c.id[0];

  // 牌型：回傳 [基礎戰力, 等級類別, 名稱]
  function shape(cards) {
    const cnt = {};
    cards.forEach(c => { const k = colorOf(c); cnt[k] = (cnt[k] || 0) + 1; });
    const t = Object.values(cnt).sort((a, b) => b - a).join('');
    const map = { '4': [7, '4', 'AAAA'], '31': [6, '3', 'AAAB'], '3': [5, '3', 'AAA'], '22': [4, '22', 'AABB'], '21': [3, '2', 'AAB'], '211': [3, '2', 'AABC'], '2': [2, '2', 'AA'] };
    if (map[t]) return map[t];
    return [1, '1', ['', 'A', 'AB', 'ABC'][cards.length] || 'A'];
  }
  const LEVEL_NAME = { '1': '單張', '2': '一對', '22': '兩對', '3': '三同屬', '4': '四同屬' };
  const L12_POWER = { A: 1, AA: 1, AAA: 1, AAAA: 1, AB: 3, AAB: 3, AAAB: 3, AABB: 4, ABC: 5, AABC: 6 };
  function coreOf(cards, cat) {
    if (cat === '22' || cat === '1') return colorOf(cards[0]);
    const cnt = {}; let best = null;
    cards.forEach(c => { const k = colorOf(c); cnt[k] = (cnt[k] || 0) + 1; });
    for (const c of cards) { const k = colorOf(c); if (best === null || cnt[k] > cnt[best]) best = k; }
    return best;
  }
  function summonList(cards, cat, l12) {
    if (cat === '1') return l12 ? [cards[0]] : [];
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
  const pairsCount = name => ({ AA: 1, AAB: 1, AABC: 1, AABB: 2 }[name] || 0);

  // AI 評估值
  const STATIC_VAL = { F01: 1, W09: 1, F04: .7, W05: .7, G03: .6, W03: .9, G05: .9, F07: .6, W07: .6, F05: .4, G01: .4, F03: .3, W04: .3, G02: .4, G07: .4, G08: .3, F08: .5, F02: .7, G04: .7, W01: .6, W02: .8, W08: .8, F09: .3, G06: .3, F06: .3, G09: .3, W06: .1 };
  const SAC_VAL = { F06: .9, W04: .9, G03: .9, W03: .7, F04: .6, F07: .6, W08: .7, G06: .7, W09: .9, G08: .7, F01: .6, W02: .6, G01: .6, F05: .4, W06: .4, G07: .6, F02: .4, W01: .4, G04: .4, F03: .4, W05: .4, G02: .4, F08: .4, F09: .2, W07: .2, G05: .3, G09: .1 };
  const cval = id => (STATIC_VAL[id] || .3) + .5 * (SAC_VAL[id] || .3);
  const COUNTERS = ['F04', 'F07'];
  const COPYABLE = id => id !== 'G07' && !COUNTERS.includes(id);

  function buildDeck(type) {
    let comp = (DECKS[type] || DECKS.RND).comp;
    if (!comp) comp = [DECKS.FW, DECKS.GF, DECKS.WG][rnd(3)].comp;
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
        idx: i, leader: pc.leader, deckType: pc.deck, deck: buildDeck(pc.deck), hand: [], disc: [], statues: [],
        score: 0, l01: 0, main: pc.main || null, lsealed: false, sacUsed: false,
      }));
      for (const p of this.p) if (p.leader === 'L11' && !p.main) {
        const cnt = {}; p.deck.forEach(c => cnt[c.id[0]] = (cnt[c.id[0]] || 0) + 1);
        p.main = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      }
      this.first = rnd(2); this.turn = 0; this.winner = null; this.how = null; this.sudden = false;
      this.ctx = null; this.played = [[], []]; this.phase = 'setup';
      this.log = [];
      this.p.forEach((p, i) => this.rawDraw(i, 5, true));
    }
    opp(i) { return this.p[1 - i]; }
    note(text, who) { this.log.push({ turn: this.turn, who, text }); if (this.ui.log) this.ui.log(text, who); }
    active(p) { return p.statues.filter(s => s.up && !s.sealed); }
    upright(p) { return p.statues.filter(s => s.up); }
    count(p, id) { return this.active(p).filter(s => s.id === id).length; }
    lead(p, code) { return p.leader === code && !p.lsealed; }
    canSacList(i) {
      const p = this.p[i];
      if (p.sacUsed || (this.ctx && this.ctx.blocked[i])) return [];
      return p.statues.filter(s => s.up && !s.sealed && !(s.maint && !p.lsealed));
    }

    // ---------- 抽牌 ----------
    rawDraw(i, n, silent) {
      const p = this.p[i]; const got = [];
      for (let k = 0; k < n; k++) {
        if (!p.deck.length && p.disc.length) { p.deck = shuffle(p.disc); p.disc = []; if (!silent) this.note('棄牌區洗回牌庫', i); }
        if (p.deck.length) { const c = p.deck.pop(); p.hand.push(c); got.push(c); }
      }
      return got;
    }
    async draw(i, n) { const got = this.rawDraw(i, n); if (got.length) await this.ui.ev('draw', { i, cards: got }); return got; }
    async extraDraw(i, n) {
      const red = this.count(this.opp(i), 'F09') + this.count(this.opp(i), 'G06');
      const m = Math.max(0, n - red);
      if (red && n) this.note(`額外抽牌 ${n} 張被減少為 ${m} 張`, i);
      return this.draw(i, m);
    }
    async retrieve(i, n, random) {
      const p = this.p[i]; if (!p.disc.length) return;
      let pick;
      if (random) pick = [p.disc[rnd(p.disc.length)]];
      else pick = await this.ctrl[i].pick(this, i, 'retrieve', { cards: p.disc.slice(), n: Math.min(n, p.disc.length) });
      for (const c of pick) { const k = p.disc.indexOf(c); if (k >= 0) { p.disc.splice(k, 1); p.hand.push(c); } }
      if (pick.length) { this.note(`取回 ${pick.map(c => CARDS[c.id].name).join('、')}`, i); await this.ui.ev('retrieve', { i, cards: pick }); }
    }

    // ---------- 勝利 ----------
    altWin(i) {
      const p = this.p[i], o = this.opp(i);
      if (p.lsealed) return false;
      const up = this.upright(p);
      if (p.leader === 'L08') return p.statues.filter(s => !s.up).length >= 5;
      if (p.leader === 'L10') { const c = { F: 0, W: 0, G: 0 }; up.forEach(s => c[s.id[0]]++); return c.F >= 2 && c.W >= 2 && c.G >= 2; }
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

    // ---------- 破壞 ----------
    async destroy(i, target) {
      const o = this.opp(i);
      const k = o.statues.indexOf(target); if (k < 0) return;
      const wasActive = target.up && !target.sealed;
      o.statues.splice(k, 1); o.disc.push({ uid: target.uid, id: target.id });
      this.releaseL13(); // 維持石像或被封印的石像被破壞：解除對應的封印
      this.note(`破壞了 ${CARDS[target.id].name}`, i);
      await this.ui.ev('destroy', { i, owner: 1 - i, statue: target });
      const n = this.count(o, 'F06') + this.count(o, 'G09') + (wasActive && ['F06', 'G09'].includes(target.id) ? 1 : 0);
      if (n) await this.extraDraw(1 - i, 2 * n);
      this.checkAlt();
    }

    // ---------- 補牌階段 ----------
    async drawPhase() {
      const order = [this.first, 1 - this.first];
      for (const i of order) {
        const p = this.p[i]; const cap = this.lead(p, 'L09') ? 6 : 5;
        if (p.hand.length < cap) await this.draw(i, cap - p.hand.length);
      }
      for (const i of order) {
        const p = this.p[i], o = this.opp(i);
        const k = this.count(p, 'F02') + this.count(p, 'G04');
        if (k) { this.note(`【補牌】多抽 ${k} 張`, i); await this.extraDraw(i, k); }
        for (let n = this.count(p, 'W01'); n > 0; n--) {
          if (p.hand.length) {
            const [c] = await this.ctrl[i].pick(this, i, 'discardOne', { cards: p.hand.slice(), n: 1, title: 'W01：選 1 張手牌棄掉，再抽 2 張' });
            p.hand.splice(p.hand.indexOf(c), 1); p.disc.push(c); await this.ui.ev('discard', { i, cards: [c] });
          }
          await this.extraDraw(i, 2);
        }
        for (let n = this.count(p, 'W02'); n > 0; n--) await this.retrieve(i, 1, true);
        for (let n = this.count(p, 'W08'); n > 0; n--) if (o.hand.length) {
          const c = o.hand.splice(rnd(o.hand.length), 1)[0]; o.disc.push(c);
          this.note(`W08 讓對手棄掉 ${CARDS[c.id].name}`, i); await this.ui.ev('discard', { i: 1 - i, cards: [c] });
        }
      }
      // 出牌前能力
      for (const i of order) {
        const p = this.p[i], o = this.opp(i);
        if (this.lead(p, 'L02') && p.hand.length) {
          const c = await this.ctrl[i].pick(this, i, 'l02', { cards: p.hand.slice(), n: 1, optional: true, title: 'L02 潮汐交換：選 1 張手牌與牌庫頂交換（可跳過）' });
          if (c && c.length) {
            if (!p.deck.length && p.disc.length) { p.deck = shuffle(p.disc); p.disc = []; }
            if (p.deck.length) {
              const x = c[0]; p.hand.splice(p.hand.indexOf(x), 1); const top = p.deck.pop(); p.deck.push(x); p.hand.push(top);
              this.note('潮汐交換：1 張手牌與牌庫頂交換', i); await this.ui.ev('draw', { i, cards: [top] });
            }
          }
        }
        const peeks = (this.lead(p, 'L07') ? 1 : 0) + this.count(p, 'W06');
        if (peeks && o.hand.length) await this.peek(i, 2);
      }
      this.checkAlt();
    }
    // L13：封印一旦選定就固定；維持石像（2 座）或被封印的石像離場才解除
    releaseL13() {
      for (const i of [0, 1]) {
        const p = this.p[i], o = this.opp(i);
        for (const t of o.statues.filter(x => x.byL13)) {
          const keep = p.statues.filter(m => m.maint === t.uid && m.up);
          if (keep.length < 2 || !t.up) { t.byL13 = false; if (!t.tmpSeal) t.sealed = false; p.statues.forEach(m => { if (m.maint === t.uid) m.maint = null; }); this.note(`雙界封印解除：${CARDS[t.id].name}`, i); }
        }
        p.statues.forEach(m => { if (m.maint && !o.statues.some(t => t.uid === m.maint && t.byL13)) m.maint = null; });
      }
    }
    // 封魔者被封印的回合，雙界封印暫時失效
    syncL13() {
      for (const i of [0, 1]) {
        const p = this.p[i], o = this.opp(i);
        for (const t of o.statues.filter(x => x.byL13)) t.sealed = !p.lsealed || !!t.tmpSeal;
      }
    }
    // 整理階段：用還沒在維持封印的成對石像，追加封印
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
        this.note(`雙界封印：封印 ${chosen.map(s => CARDS[s.id].name).join('、')}`, i);
        await this.ui.ev('seal', { i });
      }
    }
    async peek(i, n) {
      const o = this.opp(i);
      const cards = shuffle(o.hand.slice()).slice(0, n);
      await this.ui.ev('peek', { i, cards });
    }

    // ---------- 戰力 ----------
    power(i, cards, ctx, withBreak) {
      const p = this.p[i], o = this.opp(i);
      const [base0, cat, name] = shape(cards);
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
      if (this.lead(p, 'L06')) add('L06 雙生共鳴', pairsCount(name));
      if (this.lead(p, 'L11') && this.upright(p).filter(s => s.id[0] === p.main).length >= 2) add('L11 主色號令', 2);
      const upP = this.upright(p).length, upO = this.upright(o).length;
      for (const s of this.active(p)) {
        const id = s.id, nm = id;
        if (id === 'F01' || id === 'W09') add(nm, 1);
        else if ((id === 'F03' || id === 'W04') && name === 'AABB') add(nm, 1);
        else if ((id === 'F04' || id === 'W05') && p.score < o.score) add(nm, 2);
        else if (id === 'F05' && core === 'F') add(nm, 1);
        else if (id === 'G01' && core === 'G') add(nm, 1);
        else if (id === 'F07') add(nm, Math.floor(this.upright(p).filter(x => x.id[0] === 'F').length / 2));
        else if (id === 'W07') add(nm, Math.floor(this.upright(p).filter(x => x.id[0] === 'W').length / 2));
        else if (id === 'F08' && new Set(cards.map(colorOf)).size === 1) add(nm, 2);
        else if ((id === 'G02' || id === 'G07') && name === 'AAA') add(nm, 2);
        else if (id === 'G03' && upO > upP) add(nm, 2);
        else if (id === 'G08' && name === 'AAAA') add(nm, 3);
      }
      for (const s of this.active(o)) if (s.id === 'W03' || s.id === 'G05') add(`對手 ${s.id}`, -1);
      add('獻祭加成', ctx.bonus[i]);
      const total = br.reduce((a, b) => a + b[1], 0);
      return withBreak ? { total, br } : total;
    }
    counterAdv(ctx) {
      const adv = [false, false];
      for (const i of [0, 1]) {
        const p = this.p[i], o = this.opp(i), j = 1 - i;
        const same = ctx.cat[i] === ctx.cat[j] || this.lead(p, 'L12');
        const oImm = ctx.immune[j] || this.lead(o, 'L12');
        if (same && BEATS[ctx.core[i]] === ctx.core[j] && !oImm) adv[i] = true;
      }
      return adv;
    }
    evaluate(played, ctx, withBreak) {
      const adv = this.counterAdv(ctx);
      const r = [0, 1].map(i => {
        const x = this.power(i, played[i], ctx, true);
        if (adv[i]) { x.br.push(['屬性剋制', 2]); x.total += 2; }
        return x;
      });
      const pw = r.map(x => x.total);
      const w = pw[0] > pw[1] ? 0 : pw[1] > pw[0] ? 1 : null;
      return withBreak ? { w, pw, br: r.map(x => x.br), adv } : { w, pw };
    }
    setCore(i) {
      const cards = this.played[i]; const [, cat] = shape(cards);
      this.ctx.cat[i] = cat;
      this.ctx.core[i] = this.lead(this.p[i], 'L12') ? colorOf(cards[0]) : coreOf(cards, cat);
    }

    // ---------- 獻祭 ----------
    // 同一時間只處理一個獻祭（同時出牌期間雙方都可能獻祭）
    sacrifice(i, st, phase) {
      const run = () => this._sacrifice(i, st, phase);
      const job = (this._sacLock || Promise.resolve()).then(run, run);
      this._sacLock = job.catch(() => {});
      return job;
    }
    async _sacrifice(i, st, phase) {
      const p = this.p[i];
      if (this.winner !== null) return false;
      if (!this.canSacList(i).includes(st)) return false;
      st.up = false; p.sacUsed = true;
      this.note(`獻祭 ${CARDS[st.id].name}：${CARDS[st.id].sac}`, i);
      await this.ui.ev('sacrifice', { i, statue: st });
      if (!COUNTERS.includes(st.id)) {
        const j = 1 - i;
        const opts = this.canSacList(j).filter(s => COUNTERS.includes(s.id));
        if (opts.length) {
          const r = await this.ctrl[j].respondCounter(this, j, st.id, opts);
          if (r) {
            r.up = false; this.p[j].sacUsed = true;
            this.note(`【反擊】${CARDS[r.id].name}：讓 ${CARDS[st.id].name} 的效果無效`, j);
            await this.ui.ev('counter', { i: j, statue: r, target: st });
            this.checkAlt();
            return true;
          }
        }
      }
      await this.resolve(i, st.id, phase);
      this.checkAlt();
      return true;
    }
    async resolve(i, id, phase) {
      const p = this.p[i], o = this.opp(i), ctx = this.ctx;
      switch (id) {
        case 'F01': case 'W02': case 'G01': ctx.bonus[i] += 2; break;
        case 'F02': case 'W01': case 'G04': await this.extraDraw(i, 2); break;
        case 'F03': case 'W05': case 'G02': await this.retrieve(i, 2); break;
        case 'F05': case 'W06': ctx.immune[i] = true; break;
        case 'F06': case 'W04': case 'G03': {
          const tg = o.statues.filter(s => s.up);
          if (tg.length) { const [t] = await this.ctrl[i].pick(this, i, 'destroy', { statues: tg, n: 1, title: '選擇要破壞的對手石像' }); if (t) await this.destroy(i, t); }
          break;
        }
        case 'F08': {
          if (p.deck.length) {
            const [c] = await this.ctrl[i].pick(this, i, 'tutor', { cards: p.deck.slice(), n: 1, title: '從牌庫選 1 張加入手牌' });
            if (c) { p.deck.splice(p.deck.indexOf(c), 1); p.hand.push(c); shuffle(p.deck); await this.ui.ev('draw', { i, cards: [c] }); }
          }
          break;
        }
        case 'F09': {
          if (!p.deck.length && p.disc.length) { p.deck = shuffle(p.disc); p.disc = []; }
          if (p.hand.length && p.deck.length) {
            const [c] = await this.ctrl[i].pick(this, i, 'swap', { cards: p.hand.slice(), n: 1, title: '選 1 張手牌與牌庫頂交換' });
            if (c) { p.hand.splice(p.hand.indexOf(c), 1); const top = p.deck.pop(); p.deck.push(c); p.hand.push(top); await this.ui.ev('draw', { i, cards: [top] }); }
          }
          break;
        }
        case 'W03': {
          const tg = o.statues.filter(s => s.up && !s.sealed);
          if (tg.length) { const [t] = await this.ctrl[i].pick(this, i, 'seal', { statues: tg, n: 1, title: '選擇要封印的對手石像（本回合）' }); if (t) { t.sealed = true; t.tmpSeal = true; this.note(`封印 ${CARDS[t.id].name}`, i); await this.ui.ev('seal', { i }); } }
          break;
        }
        case 'W07': {
          for (let k = 0; k < 2 && p.disc.length; k++) p.deck.push(p.disc.splice(rnd(p.disc.length), 1)[0]);
          shuffle(p.deck); break;
        }
        case 'W08': case 'G06': ctx.blocked[1 - i] = true; this.note('本回合對手不能獻祭', i); break;
        case 'W09': ctx.extraPt[i] = true; break;
        case 'G05': o.lsealed = true; this.syncL13(); this.note('封印對手隊長到回合結束', i); await this.ui.ev('seal', { i }); break;
        case 'G07': {
          const tg = [...this.p[i].statues, ...o.statues].filter(s => s.up && !s.sealed && COPYABLE(s.id) && !(id === 'G08' && phase !== 'post'));
          const ok = tg.filter(s => s.id !== 'G08' || phase === 'post');
          if (ok.length) {
            const [t] = await this.ctrl[i].pick(this, i, 'copy', { statues: ok, n: 1, title: '選擇要複製獻祭效果的石像' });
            if (t) { this.note(`複製 ${CARDS[t.id].name} 的獻祭效果`, i); await this.resolve(i, t.id, phase); }
          }
          break;
        }
        case 'G08': {
          if (phase !== 'post') break;
          const r = await this.ctrl[i].pick(this, i, 'g08', { cards: this.played[i].slice(), title: '選 1 張自己的出戰牌，變換屬性' });
          if (r) { r.card.as = r.color; this.setCore(i); this.note(`把 ${CARDS[r.card.id].name} 變成${COLOR_NAME[r.color]}屬性`, i); await this.ui.ev('g08', { i }); }
          break;
        }
        case 'G09': if (o.hand.length) await this.peek(i, 2); break;
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
      this.p.forEach(p => { p.sacUsed = false; p.lsealed = false; });
      this.syncL13();
      this.ctx = { core: [null, null], cat: [null, null], bonus: [0, 0], immune: [false, false], blocked: [false, false], extraPt: [false, false] };
      this.played = [[], []];
      this.phase = 'draw';
      await this.ui.ev('turnStart', { turn: this.turn, first: this.first });
      await this.drawPhase(); if (this.winner !== null) return;
      if (this.p.some(p => !p.hand.length)) { this.winner = -2; return; }
      // 出牌（含出牌前獻祭）
      this.phase = 'choose';
      const order = [this.first, 1 - this.first];
      // 雙方同時選牌；期間任一方獻祭造成獲勝就直接結束
      const choice = await Promise.race([
        Promise.all([0, 1].map(i => this.ctrl[i].choose(this, i, 'pre'))),
        new Promise(r => { this._onWin = () => r(null); }),
      ]);
      this._onWin = null;
      if (this.winner !== null || !choice) return;
      await this._sacLock;
      for (const i of [0, 1]) {
        const hand = this.p[i].hand;
        let cs = (choice[i] || []).filter(c => hand.includes(c));
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
        if (this.lead(p, 'L01')) p.l01++;
        const l = this.opp(ev.w); if (this.lead(l, 'L01')) l.l01 = 0;
      }
      this.note(ev.w === null ? `戰力 ${ev.pw[0]} 對 ${ev.pw[1]}，平手` : `戰力 ${ev.pw[0]} 對 ${ev.pw[1]}，${ev.w === 0 ? '我方' : '對手'}得 ${gain} 分`);
      await this.ui.ev('settle', { ...ev, gain });
      // 召喚
      this.phase = 'summon';
      for (const i of (ev.w !== null ? [ev.w, 1 - ev.w] : order)) {
        const p = this.p[i], cards = this.played[i];
        const [, cat] = shape(cards);
        const sm = summonList(cards, cat, this.lead(p, 'L12'));
        const newS = sm.map(c => ({ uid: c.uid, id: c.id, up: true, sealed: false }));
        p.statues.push(...newS);
        for (const c of cards) { delete c.as; if (!sm.includes(c)) p.disc.push(c); }
        if (newS.length) this.note(`召喚石像 ${newS.map(s => CARDS[s.id].name).join('、')}`, i);
        await this.ui.ev('summon', { i, statues: newS, rest: cards.filter(c => !sm.includes(c)) });
      }
      this.p.forEach(p => p.statues.forEach(s => { if (s.tmpSeal) { s.tmpSeal = false; s.sealed = false; } }));
      this.phase = 'end';
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
  const AI = {
    goalValue(g, p, sm) {
      let v = 0; const up = g.upright(p);
      if (p.leader === 'L11') v += sm.filter(c => c.id[0] === p.main).length;
      if (p.leader === 'L10') { const h = { F: 0, W: 0, G: 0 }; up.forEach(s => h[s.id[0]]++); v += sm.filter(c => h[c.id[0]] < 2).length * .9; }
      if (p.leader === 'L13') { const h = { F: 0, W: 0, G: 0 }; up.forEach(s => h[s.id[0]]++); v += sm.filter(c => h[c.id[0]] % 2 === 1).length * .6; }
      if (p.leader === 'L08') v += .4 * sm.length;
      return v;
    },
    order(g, p, cards) {
      const cnt = {}; cards.forEach(c => cnt[c.id[0]] = (cnt[c.id[0]] || 0) + 1);
      if (g.lead(p, 'L12')) return cards.sort((a, b) => cval(b.id) - cval(a.id));
      return cards.sort((a, b) => (cnt[b.id[0]] - cnt[a.id[0]]) || ((AI.goalValue(g, p, [b]) + cval(b.id)) - (AI.goalValue(g, p, [a]) + cval(a.id))));
    },
    bestPlay(g, i) {
      const p = g.p[i]; const hand = p.hand; let best = null;
      const combos = [];
      const rec = (start, cur) => { if (cur.length) combos.push(cur.slice()); if (cur.length === 4) return; for (let k = start; k < hand.length; k++) { cur.push(hand[k]); rec(k + 1, cur); cur.pop(); } };
      rec(0, []);
      for (const comb of combos) {
        const cs = AI.order(g, p, comb.slice());
        const [, cat] = shape(cs);
        const ctx = { core: [null, null], cat: [cat, cat], bonus: [0, 0], immune: [false, false] };
        ctx.core[i] = g.lead(p, 'L12') ? cs[0].id[0] : coreOf(cs, cat); ctx.core[1 - i] = ctx.core[i];
        let v = g.power(i, cs, ctx) + (Math.random() * 2 - 1);
        const sm = summonList(cs, cat, g.lead(p, 'L12'));
        v += sm.reduce((a, c) => a + .6 + .4 * cval(c.id), 0) + AI.goalValue(g, p, sm) - .5 * cs.length;
        if (!best || v > best.v) best = { v, cs };
      }
      return best.cs;
    },
    threat(g, j) {
      const p = g.p[j]; const up = g.upright(p);
      if (p.leader === 'L11') return up.filter(s => s.id[0] === p.main).length >= 3;
      if (p.leader === 'L10') { const c = { F: 0, W: 0, G: 0 }; up.forEach(s => c[s.id[0]]++); return Math.min(2, c.F) + Math.min(2, c.W) + Math.min(2, c.G) >= 5; }
      if (p.leader === 'L08') return p.statues.filter(s => !s.up).length >= 4;
      if (p.leader === 'L13') return up.length >= 5;
      return p.score >= 3;
    },
    async choose(g, i) {
      await AI.preSac(g, i);
      return AI.bestPlay(g, i);
    },
    async preSac(g, i) {
      const o = g.opp(i); const opts = g.canSacList(i); if (!opts.length) return;
      const by = id => opts.find(s => s.id === id);
      const threat = AI.threat(g, 1 - i);
      let st = null;
      for (const id of ['F06', 'W04', 'G03']) if (!st && by(id) && g.upright(o).length && (threat || Math.random() < .35)) st = by(id);
      if (!st && by('W03') && g.active(o).length && Math.random() < .3) st = by('W03');
      if (!st && g.p[i].hand.length <= 4) for (const id of ['F02', 'W01', 'G04', 'F03', 'W05', 'G02']) if (!st && by(id) && Math.random() < .5) st = by(id);
      if (!st && by('F08') && Math.random() < .3) st = by('F08');
      if (st) await g.sacrifice(i, st, 'pre');
    },
    async decideSac(g, i, phase) {
      const o = g.opp(i); const opts = g.canSacList(i); if (!opts.length) return null;
      const by = id => opts.find(s => s.id === id);
      const ctx = g.ctx; const ev = g.evaluate(g.played, ctx);
      if (ev.w === i) {
        if (by('W09')) return by('W09');
        if (ev.pw[i] - ev.pw[1 - i] <= 2 && g.canSacList(1 - i).length) for (const id of ['W08', 'G06']) if (by(id)) return by(id);
        return null;
      }
      for (const id of ['F01', 'W02', 'G01']) if (by(id)) {
        ctx.bonus[i] += 2; const e2 = g.evaluate(g.played, ctx); ctx.bonus[i] -= 2;
        if (e2.w === i || (ev.w !== null && e2.w === null)) return by(id);
      }
      for (const id of ['F05', 'W06']) if (by(id)) {
        ctx.immune[i] = true; const e2 = g.evaluate(g.played, ctx); ctx.immune[i] = false;
        if (e2.w !== ev.w) return by(id);
      }
      if (by('G08') && AI.bestG08(g, i)) return by('G08');
      for (const id of ['F06', 'W04', 'G03']) if (by(id) && g.active(o).length) return by(id);
      if (by('W03') && g.active(o).length) return by('W03');
      if (by('G07') && AI.copyTarget(g, i, phase)) return by('G07');
      return null;
    },
    async respondCounter(g, j, effId, opts) {
      const imp = ['F06', 'W04', 'G03', 'W09', 'G08', 'W08', 'G06', 'G07'].includes(effId) || (g.phase === 'post' && ['F01', 'W02', 'G01', 'F05', 'W06'].includes(effId));
      return imp ? opts[0] : null;
    },
    bestG08(g, i) {
      let best = null; const cards = g.played[i];
      for (const c of cards) for (const col of ['F', 'W', 'G']) {
        if (col === c.id[0] && !c.as) continue;
        const old = c.as; c.as = col;
        const saveCore = g.ctx.core[i], saveCat = g.ctx.cat[i]; g.setCore(i);
        const e = g.evaluate(g.played, g.ctx);
        if (e.w === i && (!best || e.pw[i] > best.v)) best = { v: e.pw[i], card: c, color: col };
        if (old) c.as = old; else delete c.as; g.ctx.core[i] = saveCore; g.ctx.cat[i] = saveCat;
      }
      return best;
    },
    copyTarget(g, i, phase) {
      const pref = ['W09', 'F06', 'W04', 'G03', 'F01', 'W02', 'G01'];
      const all = [...g.p[i].statues, ...g.opp(i).statues].filter(s => s.up && !s.sealed && COPYABLE(s.id));
      for (const id of pref) { const s = all.find(x => x.id === id); if (s) return s; }
      return all[0] || null;
    },
    async pick(g, i, kind, o) {
      const p = g.p[i], opp = g.opp(i);
      const fit = c => { const cnt = {}; p.hand.forEach(x => cnt[x.id[0]] = (cnt[x.id[0]] || 0) + 1); return (cnt[c.id[0]] || 0) + cval(c.id) * .3; };
      switch (kind) {
        case 'retrieve': return o.cards.sort((a, b) => cval(b.id) - cval(a.id)).slice(0, o.n);
        case 'tutor': return [o.cards.sort((a, b) => fit(b) - fit(a))[0]];
        case 'discardOne': case 'swap': return [o.cards.sort((a, b) => fit(a) - fit(b))[0]];
        case 'l02': { const w = o.cards.sort((a, b) => fit(a) - fit(b))[0]; return fit(w) < 1.2 ? [w] : []; }
        case 'destroy': case 'seal': {
          const v = s => (STATIC_VAL[s.id] || .3) * (s.sealed ? 0 : 1) + (opp.leader === 'L11' && s.id[0] === opp.main ? 1.5 : 0) + (opp.leader === 'L10' ? .8 : 0) + (s.maint ? 1.2 : 0) - (['F06', 'G09'].includes(s.id) ? .4 : 0);
          return [o.statues.sort((a, b) => v(b) - v(a))[0]];
        }
        case 'l13': return o.statues.slice().sort((a, b) => (STATIC_VAL[b.id] || .3) - (STATIC_VAL[a.id] || .3)).slice(0, o.n);
        case 'copy': { const t = AI.copyTarget(g, i, g.phase); return [o.statues.includes(t) ? t : o.statues[0]]; }
        case 'g08': { const b = AI.bestG08(g, i); return b ? { card: b.card, color: b.color } : null; }
      }
      return [];
    },
  };

  root.Engine = { Game, AI, shape, coreOf, summonList, colorOf, LEVEL_NAME, L12_POWER, COUNTERS, cval };
})(typeof window !== 'undefined' ? window : globalThis);
