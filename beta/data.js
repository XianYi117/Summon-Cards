// 召喚 vj.1030.0 卡牌資料（108 張；fa＝啟動效果代號、fs＝獻祭效果代號，由規則引擎實作）
const COLOR_NAME = { F: '火', W: '水', G: '草', N: '無' };
const BEATS = { F: 'G', G: 'W', W: 'F' }; // 火剋草、草剋水、水剋火

const CARDS = {
  F01: {"name": "火魔", "race": "魔", "act": "屬性剋制成功時，收回一張至手牌", "sac": "看對手 2 張手牌", "role": "剋屬", "fa": "cRecall", "fs": "peek2"},
  F02: {"name": "火鳥", "race": "鳥", "act": "屬性被對手剋制時對手戰力 -1", "sac": "本回合不受剋制", "role": "剋屬", "fa": "cPunish", "fs": "immune"},
  F03: {"name": "火狐", "race": "狐", "act": "屬性剋制成功時戰力 +2", "sac": "從牌庫選 1 張加入手牌", "role": "剋屬、循環續航", "fa": "cPlus2", "fs": "tutor"},
  F04: {"name": "火魔", "race": "魔", "act": "屬性判定由最左一張決定", "sac": "發動我方 1 座直立、未封印石像的獻祭效果（不獻祭它）", "role": "剋屬、獻祭", "fa": "leftCore", "fs": "copy"},
  F05: {"name": "火狐", "race": "狐", "act": "【出牌】前：看對手 2 張手牌", "sac": "本回合不受剋制", "role": "剋屬", "fa": "peekHand", "fs": "immune"},
  F06: {"name": "火獸", "race": "獸", "act": "AABB：戰力 +2", "sac": "本回合戰力 +1，【多抽】 1 張", "role": "牌型、循環續航", "fa": "aabb2", "fs": "plus1draw1"},
  F07: {"name": "火鬼", "race": "鬼", "act": "雜色（AB、ABC）：戰力 +2", "sac": "【我方】已獻祭石像 1 座放入棄牌區", "role": "牌型、獻祭", "fa": "mix2", "fs": "mySacToDisc"},
  F08: {"name": "火鳥", "race": "鳥", "act": "牌型有 AA：戰力 +1", "sac": "本回合不受剋制", "role": "牌型、剋屬", "fa": "pair1", "fs": "immune"},
  F09: {"name": "火獸", "race": "獸", "act": "無法成立牌型時：將最左 1 張啟動為石像", "sac": "本回合對手不能獻祭（可被【反擊】回應）", "role": "牌型、干擾控制", "fa": "mixSummon", "fs": "block"},
  F10: {"name": "火鬼", "race": "鬼", "act": "對手【多抽】時，少 1 張（每回合執行一次）", "sac": "本回合對手戰力 -2", "role": "干擾控制", "fa": "cutDraw", "fs": "oppMinus2"},
  F11: {"name": "火龍", "race": "龍", "act": "對手【多抽】時，少 1 張（每回合執行一次）", "sac": "本回合全場石像的啟動效果無效", "role": "干擾控制", "fa": "cutDraw", "fs": "actOff"},
  F12: {"name": "火鳥", "race": "鳥", "act": "對手戰力 -1", "sac": "本回合我方核心屬性改為指定屬性（翻牌前宣告）", "role": "干擾控制、剋屬", "fa": "oppM1", "fs": "setCore"},
  F13: {"name": "火鬼", "race": "鬼", "act": "對手每有 3 座已獻祭石像：對手戰力 -1", "sac": "本回合對手隊長效果無效", "role": "干擾控制", "fa": "oppSac3", "fs": "sealLeader"},
  F14: {"name": "火魔", "race": "魔", "act": "【整理】時：手牌 1 張放到牌庫底", "sac": "1 張手牌與牌庫頂 1 張交換", "role": "循環續航", "fa": "endHandBottom", "fs": "swapTop"},
  F15: {"name": "火獸", "race": "獸", "act": "【補牌】：【多抽】 1 張", "sac": "1 張手牌與牌庫頂 1 張交換", "role": "循環續航", "fa": "drawPlus1", "fs": "swapTop"},
  F16: {"name": "火狐", "race": "狐", "act": "【補牌】：【換牌】1 張（棄 1 張手牌，再抽 1 張）", "sac": "棄牌區 2 張洗回牌庫", "role": "循環續航", "fa": "drawSwap", "fs": "discBack2"},
  F17: {"name": "火龍", "race": "龍", "act": "【補牌】：從棄牌區隨機取回 1 張", "sac": "本回合對手不能獻祭（可被【反擊】回應）", "role": "循環續航、干擾控制", "fa": "drawRetrieve", "fs": "block"},
  F18: {"name": "火魔", "race": "魔", "act": "【補牌】：看牌庫頂 2 張，放回牌庫頂或牌庫底", "sac": "看牌庫頂 3 張，選 1 張加入手牌，其餘放回牌庫底", "role": "循環續航", "fa": "drawScry", "fs": "top3"},
  F19: {"name": "火鬼", "race": "鬼", "act": "【我方】獻祭石像時：【多抽】 1 張", "sac": "翻牌前看對手 2 張出戰牌", "role": "獻祭、剋屬", "fa": "onMySac", "fs": "peekPlay2"},
  F20: {"name": "火龍", "race": "龍", "act": "【整理】：我方已獻祭石像 1 座洗回牌庫", "sac": "從棄牌區取回 2 張", "role": "獻祭、循環續航", "fa": "endSacBack", "fs": "retrieve2"},
  F21: {"name": "火鬼", "race": "鬼", "act": "對手直立石像比我方多：戰力 +2", "sac": "我方 1 座直立石像回到手牌", "role": "逆轉追趕", "fa": "fewer2", "fs": "statueToHand"},
  F22: {"name": "火獸", "race": "獸", "act": "我方每 2 座直立火石像：戰力 +1", "sac": "變換 1 張手牌或出戰牌的屬性（本回合有效）", "role": "同色石像、剋屬", "fa": "stF", "fs": "recolor"},
  F23: {"name": "火龍", "race": "龍", "act": "我方每 2 座直立火石像：戰力 +1", "sac": "對手選 1 張手牌放回牌庫底", "role": "同色石像、干擾控制", "fa": "stF", "fs": "oppBottom"},
  F24: {"name": "火鳥", "race": "鳥", "act": "對手直立石像比我方多：戰力 +2", "sac": "【我方】已獻祭石像 1 座加入手牌", "role": "逆轉追趕、獻祭", "fa": "fewer2", "fs": "mySacToHand"},
  F25: {"name": "火龍", "race": "龍", "act": "【我方】本回合破壞對手石像：戰力 +1", "sac": "本回合我方剋制加成 +2", "role": "破壞、剋屬", "fa": "destroyed1", "fs": "counterPlus2"},
  F26: {"name": "火獸", "race": "獸", "act": "【我方】本回合破壞對手石像：戰力 +1", "sac": "變換 1 張手牌或出戰牌的屬性（本回合有效）", "role": "破壞、剋屬", "fa": "destroyed1", "fs": "recolor"},
  F27: {"name": "火魔", "race": "魔", "act": "【對方】石像被破壞時：【多抽】 1 張", "sac": "【反擊】讓對手這次獻祭無效", "role": "破壞、干擾控制", "fa": "onOppBroken", "fs": "counter"},
  F28: {"name": "火鳥", "race": "鳥", "act": "【補牌】：上回合落敗時，【多抽】 1 張", "sac": "【對方】已獻祭石像 1 座放入棄牌區", "role": "逆轉追趕、獻祭", "fa": "drawLost", "fs": "oppSacToDisc"},
  F29: {"name": "火狐", "race": "狐", "act": "【補牌】：上回合落敗時，【多抽】 1 張", "sac": "本回合戰力 +2", "role": "逆轉追趕", "fa": "drawLost", "fs": "plus2"},
  F30: {"name": "火獸", "race": "獸", "act": "對手直立石像比我方多：戰力 +2", "sac": "【反擊】讓對手這次獻祭無效", "role": "逆轉追趕、干擾控制", "fa": "fewer2", "fs": "counter"},
  F31: {"name": "火狐", "race": "狐", "act": "【補牌】：上回合平手時，【多抽】 1 張", "sac": "本回合對手隊長效果無效", "role": "逆轉追趕、干擾控制", "fa": "drawTie", "fs": "sealLeader"},
  F32: {"name": "火魔", "race": "魔", "act": "AAA：戰力 +2", "sac": "對手選 1 張手牌放回牌庫底", "role": "牌型、干擾控制", "fa": "aaa2", "fs": "oppBottom"},
  F33: {"name": "火鳥", "race": "鳥", "act": "AAAA：戰力 +3", "sac": "本回合對手戰力 -2", "role": "牌型、干擾控制", "fa": "aaaa3", "fs": "oppMinus2"},
  F34: {"name": "火魔", "race": "魔", "act": "牌型有 AAA：戰力 +1", "sac": "【我方】已獻祭石像 1 座洗回牌庫", "role": "牌型、獻祭", "fa": "trip1", "fs": "mySacToDeck"},
  F35: {"name": "火鳥", "race": "鳥", "act": "核心為火：戰力 +1", "sac": "本回合我方剋制加成 +2", "role": "同色石像、剋屬", "fa": "coreF", "fs": "counterPlus2"},
  F36: {"name": "火獸", "race": "獸", "act": "核心為火：戰力 +1", "sac": "【多抽】 2 張", "role": "同色石像、循環續航", "fa": "coreF", "fs": "draw2"},
  G01: {"name": "草蟲", "race": "蟲", "act": "屬性被對手剋制時對手隨機棄一張手牌", "sac": "本回合不受剋制", "role": "剋屬", "fa": "cDiscard", "fs": "immune"},
  G02: {"name": "草蟲", "race": "蟲", "act": "屬性剋制成功時，收回一張至手牌", "sac": "本回合戰力 +1，【多抽】 1 張", "role": "剋屬、循環續航", "fa": "cRecall", "fs": "plus1draw1"},
  G03: {"name": "草仙", "race": "仙", "act": "屬性剋制成功時戰力 +2", "sac": "破壞對手 1 座直立石像（放入對手棄牌區）", "role": "剋屬、破壞", "fa": "cPlus2", "fs": "destroy"},
  G04: {"name": "草花", "race": "花", "act": "屬性剋制成功時戰力 +2", "sac": "【我方】已獻祭石像 1 座加入手牌", "role": "剋屬、獻祭", "fa": "cPlus2", "fs": "mySacToHand"},
  G05: {"name": "草精", "race": "精", "act": "屬性剋制成功時戰力 +2", "sac": "本回合我方剋制加成 +2", "role": "剋屬", "fa": "cPlus2", "fs": "counterPlus2"},
  G06: {"name": "草花", "race": "花", "act": "AABB：戰力 +2", "sac": "發動我方 1 座直立、未封印石像的獻祭效果（不獻祭它）", "role": "牌型、獻祭", "fa": "aabb2", "fs": "copy"},
  G07: {"name": "草鹿", "race": "鹿", "act": "雜色（AB、ABC）：戰力 +2", "sac": "【我方】已獻祭石像 1 座重新直立", "role": "牌型、獻祭", "fa": "mix2", "fs": "mySacUp"},
  G08: {"name": "草精", "race": "精", "act": "雜色（AB、ABC）：戰力 +2", "sac": "從牌庫選 1 張加入手牌", "role": "牌型、循環續航", "fa": "mix2", "fs": "tutor"},
  G09: {"name": "草仙", "race": "仙", "act": "對手【多抽】時，少 1 張（每回合執行一次）", "sac": "【對方】已獻祭石像 1 座放入棄牌區", "role": "干擾控制、獻祭", "fa": "cutDraw", "fs": "oppSacToDisc"},
  G10: {"name": "草樹", "race": "樹", "act": "對手【多抽】時，少 1 張（每回合執行一次）", "sac": "【雙方】各 1 座已獻祭石像放入棄牌區", "role": "干擾控制、獻祭", "fa": "cutDraw", "fs": "bothSacToDisc"},
  G11: {"name": "草精", "race": "精", "act": "對手補牌上限 -1", "sac": "本回合我方剋制不限牌型等級", "role": "干擾控制、剋屬", "fa": "oppCap", "fs": "noop"},
  G12: {"name": "草樹", "race": "樹", "act": "【對方】獻祭石像時：我方【多抽】 1 張", "sac": "本回合對手不能獻祭（可被【反擊】回應）", "role": "干擾控制", "fa": "onOppSac", "fs": "block"},
  G13: {"name": "草花", "race": "花", "act": "【整理】：棄牌區 1 張放回牌庫底", "sac": "【多抽】 2 張", "role": "循環續航", "fa": "endDiscBottom", "fs": "draw2"},
  G14: {"name": "草蟲", "race": "蟲", "act": "【補牌】：【多抽】 1 張", "sac": "破壞對手 1 座直立石像（放入對手棄牌區）", "role": "循環續航、破壞", "fa": "drawPlus1", "fs": "destroy"},
  G15: {"name": "草樹", "race": "樹", "act": "牌型有 AA：戰力 +1", "sac": "【多抽】 2 張", "role": "牌型、循環續航", "fa": "pair1", "fs": "draw2"},
  G16: {"name": "草鹿", "race": "鹿", "act": "【補牌】：【換牌】1 張（棄 1 張手牌，再抽 1 張）", "sac": "【多抽】 2 張", "role": "循環續航", "fa": "drawSwap", "fs": "draw2"},
  G17: {"name": "草精", "race": "精", "act": "【補牌】：【換牌】1 張（棄 1 張手牌，再抽 1 張）", "sac": "從棄牌區取回 2 張", "role": "循環續航", "fa": "drawSwap", "fs": "retrieve2"},
  G18: {"name": "草仙", "race": "仙", "act": "【我方】獻祭石像時：【多抽】 1 張", "sac": "從棄牌區取回 2 張", "role": "獻祭、循環續航", "fa": "onMySac", "fs": "retrieve2"},
  G19: {"name": "草仙", "race": "仙", "act": "【整理】：我方已獻祭石像 1 座洗回牌庫", "sac": "本回合我方剋制加成 +2", "role": "獻祭、剋屬", "fa": "endSacBack", "fs": "counterPlus2"},
  G20: {"name": "草蟲", "race": "蟲", "act": "牌型有 AA：戰力 +1", "sac": "變換 1 張手牌或出戰牌的屬性（本回合有效）", "role": "牌型、剋屬", "fa": "pair1", "fs": "recolor"},
  G21: {"name": "草樹", "race": "樹", "act": "【我方】石像被破壞時：【多抽】 2 張", "sac": "本回合對手不能獻祭（可被【反擊】回應）", "role": "同色石像、干擾控制", "fa": "onMyBroken2", "fs": "block"},
  G22: {"name": "草鹿", "race": "鹿", "act": "我方每 2 座直立草石像：戰力 +1", "sac": "發動我方 1 座直立、未封印石像的獻祭效果（不獻祭它）", "role": "同色石像、獻祭", "fa": "stG", "fs": "copy"},
  G23: {"name": "草蟲", "race": "蟲", "act": "我方每 2 座直立草石像：戰力 +1", "sac": "【我方】已獻祭石像 1 座加入手牌", "role": "同色石像、獻祭", "fa": "stG", "fs": "mySacToHand"},
  G24: {"name": "草仙", "race": "仙", "act": "【雙方】任一石像被破壞時：【多抽】 1 張", "sac": "本回合戰力 +1，【多抽】 1 張", "role": "破壞、循環續航", "fa": "onAnyBroken", "fs": "plus1draw1"},
  G25: {"name": "草花", "race": "花", "act": "【補牌】：上回合平手時，【多抽】 1 張", "sac": "從牌庫選 1 張加入手牌", "role": "逆轉追趕、循環續航", "fa": "drawTie", "fs": "tutor"},
  G26: {"name": "草樹", "race": "樹", "act": "屬性剋制成功時戰力 +2", "sac": "本回合獲勝時：多得 1 分", "role": "剋屬、獻祭", "fa": "cPlus2", "fs": "extraPt"},
  G27: {"name": "草精", "race": "精", "act": "【補牌】：分數落後時，【多抽】 1 張", "sac": "本回合戰力 +2", "role": "逆轉追趕", "fa": "drawBehind", "fs": "plus2"},
  G28: {"name": "草鹿", "race": "鹿", "act": "分數落後時：戰力 +2", "sac": "本回合對手隊長效果無效", "role": "逆轉追趕、干擾控制", "fa": "behind2", "fs": "sealLeader"},
  G29: {"name": "草蟲", "race": "蟲", "act": "分數落後時：戰力 +2", "sac": "從牌庫選 1 張加入手牌", "role": "逆轉追趕、循環續航", "fa": "behind2", "fs": "tutor"},
  G30: {"name": "草精", "race": "精", "act": "上回合落敗時：戰力 +1", "sac": "本回合戰力 +2", "role": "逆轉追趕", "fa": "lost1", "fs": "plus2"},
  G31: {"name": "草仙", "race": "仙", "act": "對手直立石像比我方多：戰力 +2", "sac": "從牌庫選 1 張加入手牌", "role": "逆轉追趕、循環續航", "fa": "fewer2", "fs": "tutor"},
  G32: {"name": "草鹿", "race": "鹿", "act": "AAA：戰力 +2", "sac": "本回合獲勝時：多得 1 分", "role": "牌型、獻祭", "fa": "aaa2", "fs": "extraPt"},
  G33: {"name": "草樹", "race": "樹", "act": "AAAA：戰力 +3", "sac": "【反擊】讓對手這次獻祭無效", "role": "牌型、干擾控制", "fa": "aaaa3", "fs": "counter"},
  G34: {"name": "草鹿", "race": "鹿", "act": "核心為草：戰力 +1", "sac": "本回合不受剋制", "role": "同色石像、剋屬", "fa": "coreG", "fs": "immune"},
  G35: {"name": "草花", "race": "花", "act": "核心為草：戰力 +1", "sac": "從棄牌區取回 2 張", "role": "同色石像、循環續航", "fa": "coreG", "fs": "retrieve2"},
  G36: {"name": "草蟲", "race": "蟲", "act": "出戰牌全同屬性：戰力 +2", "sac": "從牌庫選 1 張加入手牌", "role": "牌型、循環續航", "fa": "mono2", "fs": "tutor"},
  W01: {"name": "水龜", "race": "龜", "act": "屬性被對手剋制時對手隨機棄一張手牌", "sac": "翻牌前看對手 2 張出戰牌", "role": "剋屬", "fa": "cDiscard", "fs": "peekPlay2"},
  W02: {"name": "水人", "race": "人", "act": "屬性被對手剋制時對手戰力 -1", "sac": "翻牌前看對手 2 張出戰牌", "role": "剋屬", "fa": "cPunish", "fs": "peekPlay2"},
  W03: {"name": "水魚", "race": "魚", "act": "屬性剋制成功時戰力 +2", "sac": "發動我方 1 座直立、未封印石像的獻祭效果（不獻祭它）", "role": "剋屬、獻祭", "fa": "cPlus2", "fs": "copy"},
  W04: {"name": "水靈", "race": "靈", "act": "屬性判定由最左一張決定", "sac": "本回合戰力 +1，【多抽】 1 張", "role": "剋屬、循環續航", "fa": "leftCore", "fs": "plus1draw1"},
  W05: {"name": "水靈", "race": "靈", "act": "【翻牌】前：看對手 1 張出戰牌", "sac": "本回合我方核心屬性改為指定屬性（翻牌前宣告）", "role": "剋屬", "fa": "peekPlay1", "fs": "setCore"},
  W06: {"name": "水魚", "race": "魚", "act": "雜色（AB、ABC）：戰力 +2", "sac": "【我方】已獻祭石像 1 座加入手牌", "role": "牌型、獻祭", "fa": "mix2", "fs": "mySacToHand"},
  W07: {"name": "水龜", "race": "龜", "act": "雜色（AB、ABC）：戰力 +2", "sac": "本回合對手隊長效果無效", "role": "牌型、干擾控制", "fa": "mix2", "fs": "sealLeader"},
  W08: {"name": "水人", "race": "人", "act": "牌型有 AA：戰力 +1", "sac": "【對方】已獻祭石像 1 座放入棄牌區", "role": "牌型、獻祭", "fa": "pair1", "fs": "oppSacToDisc"},
  W09: {"name": "水蛇", "race": "蛇", "act": "無法成立牌型時：將最左 1 張啟動為石像", "sac": "隨機將對手 1 張手牌棄掉", "role": "牌型、干擾控制", "fa": "mixSummon", "fs": "oppRandDiscard"},
  W10: {"name": "水蛇", "race": "蛇", "act": "牌型有 AA：戰力 +1", "sac": "隨機將對手 1 張手牌棄掉", "role": "牌型、干擾控制", "fa": "pair1", "fs": "oppRandDiscard"},
  W11: {"name": "水妖", "race": "妖", "act": "【對方】獻祭石像時：我方【多抽】 1 張", "sac": "對手選 1 張手牌放回牌庫底", "role": "干擾控制", "fa": "onOppSac", "fs": "oppBottom"},
  W12: {"name": "水龜", "race": "龜", "act": "【對方】獻祭石像時：我方【多抽】 1 張", "sac": "【對方】已獻祭石像 1 座重新直立", "role": "干擾控制、獻祭", "fa": "onOppSac", "fs": "oppSacUp"},
  W13: {"name": "水妖", "race": "妖", "act": "對手每有 3 座已獻祭石像：對手戰力 -1", "sac": "本回合對手不能獻祭（可被【反擊】回應）", "role": "干擾控制", "fa": "oppSac3", "fs": "block"},
  W14: {"name": "水蛇", "race": "蛇", "act": "【補牌】：【多抽】 1 張", "sac": "【我方】已獻祭石像 1 座洗回牌庫", "role": "循環續航、獻祭", "fa": "drawPlus1", "fs": "mySacToDeck"},
  W15: {"name": "水蛇", "race": "蛇", "act": "【補牌】：【換牌】1 張（棄 1 張手牌，再抽 1 張）", "sac": "看牌庫頂 3 張，選 1 張加入手牌，其餘放回牌庫底", "role": "循環續航", "fa": "drawSwap", "fs": "top3"},
  W16: {"name": "水妖", "race": "妖", "act": "【補牌】：從棄牌區隨機取回 1 張", "sac": "本回合戰力 +1，【多抽】 1 張", "role": "循環續航", "fa": "drawRetrieve", "fs": "plus1draw1"},
  W17: {"name": "水魚", "race": "魚", "act": "【補牌】：看牌庫頂 2 張，放回牌庫頂或牌庫底", "sac": "從棄牌區取回 2 張", "role": "循環續航", "fa": "drawScry", "fs": "retrieve2"},
  W18: {"name": "水妖", "race": "妖", "act": "【我方】獻祭石像時：【多抽】 1 張", "sac": "看牌庫頂 3 張，選 1 張加入手牌，其餘放回牌庫底", "role": "獻祭、循環續航", "fa": "onMySac", "fs": "top3"},
  W19: {"name": "水龜", "race": "龜", "act": "【我方】本回合有獻祭石像：戰力 +1", "sac": "本回合獲勝時：多得 1 分", "role": "獻祭", "fa": "sacced1", "fs": "extraPt"},
  W20: {"name": "水人", "race": "人", "act": "我方每 2 座已獻祭石像：所有牌型戰力 +1", "sac": "破壞對手 1 座直立石像（放入對手棄牌區）", "role": "獻祭、破壞", "fa": "sac2", "fs": "destroy"},
  W21: {"name": "水靈", "race": "靈", "act": "【我方】石像被破壞時：從棄牌區取回 1 張", "sac": "我方 1 座直立石像回到手牌", "role": "同色石像", "fa": "onMyBrokenRet", "fs": "statueToHand"},
  W22: {"name": "水靈", "race": "靈", "act": "我方每 2 座直立水石像：戰力 +1", "sac": "我方 1 座直立石像回到手牌", "role": "同色石像", "fa": "stW", "fs": "statueToHand"},
  W23: {"name": "水靈", "race": "靈", "act": "我方每 2 座直立水石像：戰力 +1", "sac": "破壞對手 1 座直立石像（放入對手棄牌區）", "role": "同色石像、破壞", "fa": "stW", "fs": "destroy"},
  W24: {"name": "水魚", "race": "魚", "act": "【補牌】：上回合平手時，【多抽】 1 張", "sac": "本回合對手隊長效果無效", "role": "逆轉追趕、干擾控制", "fa": "drawTie", "fs": "sealLeader"},
  W25: {"name": "水龜", "race": "龜", "act": "上回合落敗時：戰力 +1", "sac": "【多抽】 2 張", "role": "逆轉追趕、循環續航", "fa": "lost1", "fs": "draw2"},
  W26: {"name": "水魚", "race": "魚", "act": "【補牌】：看牌庫頂 2 張，放回牌庫頂或牌庫底", "sac": "隨機將對手 1 張手牌棄掉", "role": "循環續航、干擾控制", "fa": "drawScry", "fs": "oppRandDiscard"},
  W27: {"name": "水蛇", "race": "蛇", "act": "屬性判定由最左一張決定", "sac": "發動我方 1 座直立、未封印石像的獻祭效果（不獻祭它）", "role": "剋屬、獻祭", "fa": "leftCore", "fs": "copy"},
  W28: {"name": "水妖", "race": "妖", "act": "【補牌】：分數落後時，【多抽】 1 張", "sac": "本回合我方剋制加成 +2", "role": "逆轉追趕、剋屬", "fa": "drawBehind", "fs": "counterPlus2"},
  W29: {"name": "水人", "race": "人", "act": "分數落後時：戰力 +2", "sac": "【我方】已獻祭石像 1 座加入手牌", "role": "逆轉追趕、獻祭", "fa": "behind2", "fs": "mySacToHand"},
  W30: {"name": "水龜", "race": "龜", "act": "對手直立石像比我方多：戰力 +2", "sac": "本回合對手戰力 -2", "role": "逆轉追趕、干擾控制", "fa": "fewer2", "fs": "oppMinus2"},
  W31: {"name": "水靈", "race": "靈", "act": "【補牌】：上回合平手時，【多抽】 1 張", "sac": "1 張手牌與牌庫頂 1 張交換", "role": "逆轉追趕、循環續航", "fa": "drawTie", "fs": "swapTop"},
  W32: {"name": "水魚", "race": "魚", "act": "所有牌型：戰力 +1", "sac": "本回合我方剋制不限牌型等級", "role": "剋屬", "fa": "all1", "fs": "noop"},
  W33: {"name": "水妖", "race": "妖", "act": "牌型有 AAA：戰力 +1", "sac": "從牌庫選 1 張加入手牌", "role": "牌型、循環續航", "fa": "trip1", "fs": "tutor"},
  W34: {"name": "水人", "race": "人", "act": "核心為水：戰力 +1", "sac": "本回合我方剋制加成 +2", "role": "同色石像、剋屬", "fa": "coreW", "fs": "counterPlus2"},
  W35: {"name": "水靈", "race": "靈", "act": "核心為水：戰力 +1", "sac": "看牌庫頂 3 張，選 1 張加入手牌，其餘放回牌庫底", "role": "同色石像、循環續航", "fa": "coreW", "fs": "top3"},
  W36: {"name": "水龜", "race": "龜", "act": "出戰牌全同屬性：戰力 +2", "sac": "本回合我方核心屬性改為指定屬性（翻牌前宣告）", "role": "牌型、剋屬", "fa": "mono2", "fs": "setCore"},
};
for (const id in CARDS) { CARDS[id].id = id; CARDS[id].color = id[0]; CARDS[id].roles = CARDS[id].role.split('、'); }
const ROLES = ['剋屬', '牌型', '循環續航', '獻祭', '干擾控制', '逆轉追趕', '同色石像', '破壞'];

const LEADERS = {
  L01: { name: '烈焰統帥', color: 'F', race: '龍', skill: '絕對勝利', text: '每贏 1 回合戰力 +1，輸了歸零' },
  L02: { name: '深海智者', color: 'W', race: '魚', skill: '潮汐交換', text: '【補牌】時，手牌 0～2 張放回牌庫底，並補滿手牌' },
  L03: { name: '森林守望者', color: 'G', race: '精靈', skill: '森林之力', text: '核心為草：戰力 +1' },
  L04: { name: '烈火守望者', color: 'F', race: '元素', skill: '烈火之力', text: '核心為火：戰力 +1' },
  L05: { name: '深海守望者', color: 'W', race: '海', skill: '深海之力', text: '核心為水：戰力 +1' },
  L06: { name: '雙生指揮官', color: 'N', race: '雙生妖魔', skill: '雙生共鳴', text: '牌型為 AA：戰力 +1' },
  L07: { name: '暗影偵察者', color: 'N', race: '影', skill: '暗中窺探', text: '出牌前：看對手 2 張手牌' },
  L08: { name: '無冕暴君', color: 'N', race: '魔', skill: '孤家寡人', text: '5 座已獻祭石像：獲勝' },
  L09: { name: '豐饒掌管者', color: 'N', race: '矮靈', skill: '餘裕之手', text: '【補牌】補至 6 張' },
  L10: { name: '三界召喚師', color: 'N', race: '靈體', skill: '三界契約', text: '直立石像 7 座，且火水草各至少 2 座：獲勝' },
  L11: { name: '冥火貓妖', color: 'N', race: '獸', skill: '主色號令', text: '選主色；主色石像 2 座：戰力 +2；4 座：獲勝' },
  L12: { name: '幻術蠱王', color: 'N', race: '蟲', skill: '變色之術', text: '雜色越強（ABC 5、AABC 6）；最左張決定屬性，剋制不限牌型、不會被剋；無牌型時召喚最左 1 張' },
  L13: { name: '封魔者', color: 'N', race: '人', skill: '雙界封印', text: '整理時：每 2 座同屬性直立石像封印對手 1 座（選定後固定）；封印 4 座：獲勝' },
};
for (const id in LEADERS) LEADERS[id].id = id;

const DECKS = {
  FW: { label: '火水', comp: { F: 8, W: 8, G: 4 } },
  GF: { label: '草火', comp: { G: 8, F: 8, W: 4 } },
  WG: { label: '水草', comp: { W: 8, G: 8, F: 4 } },
  RND: { label: '隨機', comp: null },
};
const ATTR_MAX = 8; // 一種屬性最多 8 張
// 隨機牌組：全部卡中隨機抽 20 張，任一屬性超過 8 張就重抽（每種合法組合機率相同）
function randomDeckIds(rand = Math.random) {
  const all = Object.keys(CARDS);
  for (;;) {
    const a = all.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const pick = a.slice(0, 20), cnt = { F: 0, W: 0, G: 0 };
    pick.forEach(id => cnt[id[0]]++);
    if (Math.max(cnt.F, cnt.W, cnt.G) <= ATTR_MAX) return pick.sort();
  }
}

// 卡圖：場上用小圖（cards/sm/，300px 寬），圖鑑大圖與對戰前畫面用原圖
const img = (id, hi) => hi ? `cards/${id}.webp` : `cards/sm/${id}.webp`;
// 開頁後在背景預載全部小圖，對戰中翻牌不用再等下載
const IMG_CACHE = [];
(window.requestIdleCallback || (f => setTimeout(f, 300)))(() => {
  for (const id of [...Object.keys(CARDS), ...Object.keys(LEADERS)]) { const im = new Image(); im.decoding = 'async'; im.src = img(id); IMG_CACHE.push(im); }
});
