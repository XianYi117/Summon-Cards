// 測試用：在同一個瀏覽器內，用 BroadcastChannel 模擬 PeerJS（Peer、DataConnection）
(() => {
  const bus = new BroadcastChannel('mockpeer');
  const peers = {}; const conns = {};
  let seq = 0;
  const rid = () => Math.random().toString(36).slice(2, 8) + (seq++);
  class Emitter { constructor() { this.h = {}; } on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } emit(e, ...a) { (this.h[e] || []).forEach(f => { try { f(...a); } catch (x) { console.error(x); } }); } }
  class Conn extends Emitter {
    constructor(id, me, other) { super(); this.id = id; this.me = me; this.peer = other; this.open = false; conns[id] = this; }
    send(d) { if (!this.open) return; if (window.__mockDrop) return; bus.postMessage({ t: 'data', cid: this.id, to: this.peer, d: JSON.parse(JSON.stringify(d)) }); }
    close() { if (!this.open) return; this.open = false; bus.postMessage({ t: 'close', cid: this.id, to: this.peer }); this.emit('close'); }
  }
  class Peer extends Emitter {
    constructor(id) {
      super(); this.id = id || 'anon-' + rid(); this.destroyed = false; this.disconnected = false;
      bus.postMessage({ t: 'claim', id: this.id });
      peers[this.id] = this;
      setTimeout(() => { if (this.taken) this.emit('error', { type: 'unavailable-id' }); else this.emit('open', this.id); }, 30);
    }
    connect(target) {
      const c = new Conn(rid(), this.id, target);
      if (!window.__mockOffline) bus.postMessage({ t: 'conn', cid: c.id, from: this.id, to: target });
      c._timer = setTimeout(() => { if (!c.open) this.emit('error', { type: 'peer-unavailable' }); }, 1500);
      return c;
    }
    reconnect() { this.disconnected = false; setTimeout(() => this.emit('open', this.id), 20); }
    destroy() { this.destroyed = true; Object.values(conns).filter(c => c.me === this.id).forEach(c => c.close()); delete peers[this.id]; }
  }
  bus.onmessage = ({ data: m }) => {
    if (m.t === 'claim' && peers[m.id]) bus.postMessage({ t: 'taken', id: m.id });
    if (m.t === 'taken' && peers[m.id]) peers[m.id].taken = true;
    if (m.t === 'conn' && peers[m.to] && !peers[m.to].destroyed && !window.__mockOffline) {
      const c = new Conn(m.cid, m.to, m.from); c.open = true;
      peers[m.to].emit('connection', c);
      bus.postMessage({ t: 'accept', cid: m.cid });
      setTimeout(() => c.emit('open'), 10);
    }
    if (m.t === 'accept' && conns[m.cid]) { const c = conns[m.cid]; clearTimeout(c._timer); c.open = true; c.emit('open'); }
    if (m.t === 'data' && conns[m.cid] && conns[m.cid].me === m.to && !window.__mockDrop) conns[m.cid].emit('data', m.d);
    if (m.t === 'close' && conns[m.cid] && conns[m.cid].me === m.to && conns[m.cid].open) { conns[m.cid].open = false; conns[m.cid].emit('close'); }
  };
  window.Peer = Peer;
  window.__mockKill = (ms) => { window.__mockOffline = true; Object.values(conns).forEach(c => c.close()); setTimeout(() => { window.__mockOffline = false; }, ms || 0); };
})();
