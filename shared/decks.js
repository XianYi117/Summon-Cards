// 召喚｜自訂牌組（需先載入 data.js）
// 牌組由卡牌構築（builder/）建立，存在瀏覽器 localStorage，與遊戲（beta/）共用
// 牌組代碼格式：L03.F01.F03.W12…（隊長可省略），可放在遊戲網址 beta/index.html#deck=代碼&name=名稱
const DECK_STORE = 'summon_decks';
function deckCode(d) { return [d.leader, ...d.cards].filter(Boolean).join('.'); }
function parseDeckCode(code) {
  const ids = String(code || '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const leader = ids.find(id => LEADERS[id]) || '';
  const cards = [...new Set(ids.filter(id => CARDS[id]))].sort();
  return { leader, cards };
}
function deckProblems(cards) {
  const out = [], cnt = { F: 0, W: 0, G: 0 };
  cards.forEach(id => cnt[id[0]]++);
  if (cards.length !== 20) out.push(`需要 20 張（目前 ${cards.length}）`);
  for (const c of ['F', 'W', 'G']) if (cnt[c] > ATTR_MAX) out.push(`${COLOR_NAME[c]}屬性 ${cnt[c]} 張，超過 ${ATTR_MAX}`);
  if (new Set(cards).size !== cards.length) out.push('有重複編號');
  return out;
}
function loadMyDecks() { try { return JSON.parse(localStorage.getItem(DECK_STORE) || '[]').filter(d => d && Array.isArray(d.cards)); } catch { return []; } }
function saveMyDecks(list) { try { localStorage.setItem(DECK_STORE, JSON.stringify(list)); return true; } catch { return false; } }
// 把合法的自訂牌組加進遊戲的牌組選單（fixed＝固定 20 張，不再隨機）
(function addCustomDecks() {
  const add = (key, d) => {
    const cards = d.cards.filter(id => CARDS[id]);
    if (deckProblems(cards).length) return;
    const comp = { F: 0, W: 0, G: 0 }; cards.forEach(id => comp[id[0]]++);
    DECKS[key] = { label: d.name || '自訂牌組', comp, fixed: cards, leader: LEADERS[d.leader] ? d.leader : '', custom: true };
  };
  loadMyDecks().forEach((d, i) => add('MY' + i, d));
  const h = new URLSearchParams(location.hash.slice(1));
  if (typeof document !== 'undefined' && h.get('deck')) add('LINK', { ...parseDeckCode(h.get('deck')), name: h.get('name') || '分享牌組' });
})();
