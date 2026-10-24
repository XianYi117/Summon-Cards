// 召喚 vj.1023.0 卡牌資料
const COLOR_NAME = { F: '火', W: '水', G: '草', N: '無' };
const BEATS = { F: 'G', G: 'W', W: 'F' }; // 火剋草、草剋水、水剋火

const CARDS = {
  F01: { name: '烈焰先鋒', race: '獸', act: '所有牌型戰力 +1', sac: '本場戰力 +2', role: '通用戰力' },
  F02: { name: '火花信使', race: '元素', act: '【補牌】+1', sac: '抽 2', role: '延遲抽牌' },
  F03: { name: '熔岩拾荒者', race: '礦', act: 'AABB 戰力 +1', sac: '取回 2', role: '對子／回收' },
  F04: { name: '爆炎復仇者', race: '龍', act: '落後時戰力 +2', sac: '【反擊】對手獻祭無效', role: '逆轉' },
  F05: { name: '餘燼旅人', race: '不死', act: '核心為火：戰力 +1', sac: '本回合不受剋制', role: '屬性防禦' },
  F06: { name: '灰燼使者', race: '靈體', act: '石像被破壞時抽 2', sac: '破壞對手 1 座直立石像', role: '反破壞' },
  F07: { name: '赤焰收藏家', race: '魔', act: '每 2 座直立火石像：戰力 +1', sac: '【反擊】對手獻祭無效', role: '石像累積' },
  F08: { name: '焰尾獵手', race: '蟲', act: '出戰牌全同屬性：戰力 +2', sac: '從牌庫選 1 張加入手牌', role: '純色牌型' },
  F09: { name: '爐心工匠', race: '機械', act: '對手額外抽牌時 -1 張', sac: '1 張手牌與牌庫頂交換', role: '抽牌干擾' },
  W01: { name: '潮汐信使', race: '海', act: '【補牌】時棄 1 抽 2', sac: '抽 2', role: '手牌汰換' },
  W02: { name: '深海拾荒者', race: '甲殼', act: '【補牌】時隨機取回 1', sac: '本場戰力 +2', role: '持續回收' },
  W03: { name: '深淵守衛', race: '魚', act: '對手戰力 -1', sac: '封印對手 1 座直立石像（本回合）', role: '防剋制／封印' },
  W04: { name: '激流破壞者', race: '元素', act: 'AABB 戰力 +1', sac: '破壞對手 1 座直立石像', role: '雙對子' },
  W05: { name: '沉船探索者', race: '機械', act: '落後時戰力 +2', sac: '取回 2', role: '逆轉／回收' },
  W06: { name: '水鏡旅人', race: '元素', act: '查看對手 2 張手牌', sac: '本回合不受剋制', role: '情報' },
  W07: { name: '泡沫收藏家', race: '甲殼', act: '每 2 座直立水石像：戰力 +1', sac: '棄牌區 2 張洗回牌庫', role: '循環牌庫' },
  W08: { name: '暗潮掠奪者', race: '影', act: '【補牌】時對手隨機棄 1', sac: '本回合對手獻祭無效', role: '棄牌干擾' },
  W09: { name: '靜海預言者', race: '海', act: '所有牌型戰力 +1', sac: '獲勝時多得 1 分', role: '強力獻祭' },
  G01: { name: '森林信使', race: '精靈', act: '核心為草：戰力 +1', sac: '本場戰力 +2', role: '屬性加成' },
  G02: { name: '樹根拾荒者', race: '樹妖', act: 'AAA 戰力 +2', sac: '取回 2', role: '對子／回收' },
  G03: { name: '荊棘復仇者', race: '樹妖', act: '對手直立石像較多：戰力 +2', sac: '破壞對手 1 座直立石像', role: '反石像' },
  G04: { name: '苔蘚旅人', race: '礦', act: '【補牌】+1', sac: '抽 2', role: '延遲抽牌' },
  G05: { name: '古樹守護者', race: '人馬', act: '對手戰力 -1', sac: '封印對手隊長（本回合）', role: '隊長封印' },
  G06: { name: '孢子收藏家', race: '菌', act: '對手額外抽牌時 -1 張', sac: '本回合對手獻祭無效', role: '抽牌封鎖' },
  G07: { name: '泥沼氣', race: '毒', act: 'AAA 戰力 +2', sac: '複製 1 次直立、未封印石像的獻祭效果', role: '複製' },
  G08: { name: '花冠幻術師', race: '神', act: 'AAAA 戰力 +3', sac: '變換 1 張自己出戰牌的屬性', role: '四連／變換' },
  G09: { name: '修復者', race: '妖', act: '石像被破壞時抽 2', sac: '看對手 2 張手牌', role: '破壞補償' },
};
for (const id in CARDS) { CARDS[id].id = id; CARDS[id].color = id[0]; }

const LEADERS = {
  L01: { name: '烈焰統帥', color: 'F', race: '龍', skill: '絕對勝利', text: '每贏 1 回合戰力 +1，輸了歸零' },
  L02: { name: '深海智者', color: 'W', race: '魚', skill: '潮汐交換', text: '出牌前：手牌與牌庫頂換 1 張' },
  L03: { name: '森林守望者', color: 'G', race: '精靈', skill: '森林之力', text: '核心為草：戰力 +1' },
  L04: { name: '烈火守望者', color: 'F', race: '元素', skill: '烈火之力', text: '核心為火：戰力 +1' },
  L05: { name: '深海守望者', color: 'W', race: '海', skill: '深海之力', text: '核心為水：戰力 +1' },
  L06: { name: '雙生指揮官', color: 'N', race: '雙生妖魔', skill: '雙生共鳴', text: '每組對子：戰力 +1' },
  L07: { name: '暗影偵察者', color: 'N', race: '影', skill: '暗中窺探', text: '出牌前：看對手 2 張手牌' },
  L08: { name: '無冕暴君', color: 'N', race: '魔', skill: '孤家寡人', text: '5 座已獻祭石像：獲勝' },
  L09: { name: '豐饒掌管者', color: 'N', race: '矮靈', skill: '餘裕之手', text: '【補牌】補至 6 張' },
  L10: { name: '三界召喚師', color: 'N', race: '靈體', skill: '三界契約', text: '火水草直立石像各 2 座：獲勝' },
  L11: { name: '冥火貓妖', color: 'N', race: '獸', skill: '主色號令', text: '選主色；主色石像 2 座：戰力 +2；4 座：獲勝' },
  L12: { name: '幻術蠱王', color: 'N', race: '蟲', skill: '變色之術', text: '雜色越強（ABC 5、AABC 6）；最左張決定屬性，剋制不限牌型、不會被剋；沒成對時召喚最左 1 張' },
  L13: { name: '封魔者', color: 'N', race: '人', skill: '雙界封印', text: '整理時：每 2 座同屬性直立石像封印對手 1 座（選定後固定）；封印 4 座：獲勝' },
};
for (const id in LEADERS) LEADERS[id].id = id;

const DECKS = {
  FW: { label: '火水', comp: { F: 7, W: 7, G: 6 } },
  GF: { label: '草火', comp: { G: 7, F: 7, W: 6 } },
  WG: { label: '水草', comp: { W: 7, G: 7, F: 6 } },
  RND: { label: '隨機', comp: null },
};

const img = id => `cards/${id}.webp`;
