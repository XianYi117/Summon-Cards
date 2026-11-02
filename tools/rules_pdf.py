"""遊戲規則 PDF（淺色規則書版）：內容與遊戲內「規則說明」相同的分類，卡牌、隊長、預組資料讀 shared/data.js。

用法：python3 tools/rules_pdf.py [輸出 PDF 路徑]   （預設 docs/召喚_遊戲規則.pdf）
需要：playwright（Chromium）、pypdf、reportlab。規則文字改了，請和 ui.js 的 renderRules 一起改。
"""
import json, re, html, asyncio
from playwright.async_api import async_playwright
import os, sys, tempfile
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'docs', '召喚_遊戲規則.pdf')
SP = tempfile.mkdtemp() + '/'
VER = 'vj.1102'
E = lambda x: html.escape(str(x))
data = open(os.path.join(REPO, 'shared', 'data.js'), encoding='utf8').read()
NCARDS = len(re.findall(r'^  [FWG]\d\d: \{', data, re.M))
P = [json.loads(m.group(1)) for m in re.finditer(r'  (\{"no": \d+, .*?\}),', data)]
L = re.findall(r"  (L\d\d): \{ name: '([^']*)', color: '(\w)', race: '([^']*)', skill: '([^']*)', text: '([^']*)' \}", data)
CN = {'F': '火', 'W': '水', 'G': '草', 'N': '無'}

def cnt(cards):
    d = {'F': 0, 'W': 0, 'G': 0}
    for x in cards: d[x[0]] += 1
    return f"火 {d['F']}．水 {d['W']}．草 {d['G']}"

shape = [('AAAA', '火火火火', 7, '1 張', 'g4'), ('AAAB', '火火火水', 6, '1 張', 'g3'), ('AAA', '火火火', 5, '1 張', 'g3'),
         ('AABB', '火火水水', 4, '2 張', 'g2'), ('AAB、AABC', '火火水、火火水草', 3, '1 張', 'g2'), ('AA', '火火', 2, '1 張', 'g2'),
         ('無牌型（雜色）', '火、火水、火水草', 1, '不能', 'g1')]
words = [('【補牌】', '回合開始的補牌階段。寫「【補牌】：」的效果在補到 5 張後觸發；被「對手抽牌 -1」減少時，手牌最少補到 4 張。'), ('【出牌】前', '雙方選牌之前。'),
         ('【翻牌】前', '雙方翻開出戰牌之前。'), ('【回合結束】', '回合最後一步，場上其餘卡牌進棄牌區之前。'),
         ('【多抽】', '補滿 5 張以外，額外從牌庫抽牌；不受 5 張限制。'), ('【換牌】', '棄 1 張手牌，再抽 1 張。'),
         ('【反擊】', '在對手獻祭時回應，讓對手這次獻祭無效。'), ('【啟動】石像', '回合流程第 5 步：把成對那組最左邊的出戰牌變成石像。和石像直立時的「啟動效果」不同。'), ('【我方】／【對方】／【雙方】', '效果觸發的對象範圍。'),
         ('直立石像', '直放、未獻祭的石像；啟動效果有效。'), ('已獻祭石像', '橫放的石像，沒有任何技能。'),
         ('出戰牌', '本回合翻開比戰力的牌。'), ('牌型有 AA', 'AA、AAB、AABC、AABB。'), ('牌型有 AAA', 'AAA、AAAB。'),
         ('雜色', 'AB、ABC。'), ('剋制加成', '剋制成功時的戰力加成，基本 +2。'), ('取回', '從棄牌區選牌加入手牌。'),
         ('牌庫頂／牌庫底', '牌庫最上面／最下面。'), ('本回合', '到這回合【回合結束】為止；一次性封印例外。'), ('破壞', '石像離場進擁有者的棄牌區。「石像被破壞時：本回合戰力 +1」只在戰力計算前被破壞才有作用。'), ('多啟動 1 張', '從還沒變成石像的出戰牌中，自己選 1 張也變成石像，不看牌型、不限位置。'), ('發動場上石像的獻祭效果', '雙方的直立、未封印石像都可以選（維持 L13 封印的除外），效果由我方獲得，不能選【反擊】。'), ('雙方棄掉全部手牌重抽', '雙方各自棄掉手牌，再抽回相同張數；不算補牌，不受「抽牌 -1」影響。'),
         ('（每回合執行一次）', '同一回合內最多觸發 1 次。')]

doc = f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>
:root{{--paper:#f8f3e8;--ink:#2b2620;--muted:#7a7266;--line:#d9cfbb;--brand:#3b2f55;--gold:#b08a3e;--gold-pale:#f3e6c4;--card:#fffdf8;
--F:#c8412b;--W:#2b6cb0;--G:#2f8a3e;
--f-display:"Noto Serif CJK TC","Noto Serif TC",serif;--f-body:"Noto Sans CJK TC","Noto Sans TC",sans-serif}}
@page{{size:A4}}
html,body{{margin:0;background:var(--paper)}}
body{{color:var(--ink);font-family:var(--f-body);font-size:10.3pt;line-height:1.75;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.page{{padding:0 18mm}}
.cover{{text-align:center;padding:2mm 0 5mm;margin-bottom:3mm;border-bottom:2px solid var(--brand);position:relative}}
.cover:after{{content:"";position:absolute;left:50%;bottom:-4px;width:46mm;height:6px;margin-left:-23mm;background:var(--gold);border-radius:3px}}
.cover h1{{font-family:var(--f-display);font-weight:900;font-size:36pt;letter-spacing:.2em;margin:0;color:var(--brand)}}
.cover .en{{font-size:9pt;letter-spacing:.9em;color:var(--gold);font-weight:700;margin-top:-1mm}}
.cover .ver{{font-size:9pt;color:var(--muted);margin-top:2mm}}
.cover .el{{margin-top:2.5mm;font-family:var(--f-display);font-weight:900;font-size:11pt;letter-spacing:.3em}}
h3{{font-family:var(--f-display);font-size:15pt;margin:7mm 0 3mm;color:var(--brand);letter-spacing:.08em;break-after:avoid;
  display:flex;align-items:center;gap:3mm}}
h3:before{{content:"";width:3mm;height:3mm;background:var(--gold);transform:rotate(45deg);flex:none}}
h3:after{{content:"";flex:1;height:1px;background:var(--line)}}
h4{{font-family:var(--f-display);font-size:12pt;margin:5mm 0 2mm;color:var(--brand);break-after:avoid;border-left:3px solid var(--gold);padding-left:2.5mm;line-height:1.4}}
b{{color:var(--brand)}}
ul{{margin:0 0 2mm;padding-left:5.5mm}} li{{margin:.5mm 0}} li::marker{{color:var(--gold)}}
ol{{list-style:none;counter-reset:st;margin:0 0 2mm;padding:0}}
ol li{{counter-increment:st;position:relative;padding-left:9mm;margin:1.2mm 0}}
ol li:before{{content:counter(st);position:absolute;left:0;top:.5mm;width:6mm;height:6mm;border-radius:50%;background:var(--brand);color:#fff;
  font-size:8.5pt;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1}}
p{{margin:1mm 0 2mm}}
table{{border-collapse:separate;border-spacing:0;width:100%;margin:2mm 0 3.5mm;font-size:9.8pt;border:1px solid var(--line);border-radius:2mm;break-inside:avoid}}
thead th:first-child{{border-top-left-radius:2mm}} thead th:last-child{{border-top-right-radius:2mm}}
.pb{{break-before:page}} .keep{{break-inside:avoid}}
tr{{break-inside:avoid}}
th,td{{padding:1.8mm 3mm;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}}
tbody tr:last-child td,table>tr:last-child td{{border-bottom:none}}
thead th{{background:var(--brand);color:#fff;font-weight:700;letter-spacing:.05em}}
tr:nth-child(even) td{{background:#fbf7ee}} td{{background:var(--card)}}
td.k{{white-space:nowrap;color:var(--brand);font-weight:700;background:#f4eedf}}
.box{{border:1px solid var(--gold);background:var(--gold-pale);border-radius:2mm;padding:3mm 4mm;margin:3.5mm 0;break-inside:avoid}}
.box b{{color:#7a5a17}}
.wins3{{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;break-inside:avoid}}
.wins3 div{{background:var(--card);border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:2mm;padding:3mm 3.5mm}}
.wins3 b{{display:block;font-family:var(--f-display);font-size:11pt;margin-bottom:.5mm}}
.note{{color:var(--muted);font-size:9pt}}
.g4{{color:#b3261e;font-weight:700}}.g3{{color:#b8621a;font-weight:700}}.g2{{color:#2858a8;font-weight:700}}.g1{{color:#7a7266}}
.F{{color:var(--F);font-weight:700}}.W{{color:var(--W);font-weight:700}}.G{{color:var(--G);font-weight:700}}
.sec{{margin-top:8mm}} .sec h3{{font-size:17pt}}
</style></head><body><div class="page">
<div class="cover"><h1>召喚</h1><div class="en">SUMMON</div><div class="ver">遊戲規則．版本 {VER}．角色卡 {NCARDS} 種．隊長 13 位</div><div class="el"><span class="F">火</span>　<span class="W">水</span>　<span class="G">草</span></div></div>

<h3>怎麼贏</h3>
<div class="wins3"><div><b>得分勝利</b>先拿到 4 分。每回合比戰力，贏的人得 1 分；平手都不得分。</div><div><b>隊長勝利</b>部分隊長有自己的勝利條件，達成就立刻獲勝。</div><div><b>石像勝利</b>石像卡上寫明的勝利效果。</div></div>
<p class="note">雙方同時達成勝利條件時，進入搶 1 分加賽：繼續打，下一個得分的人獲勝。</p>

<h3>卡牌構築、開始設置</h3>
<ul><li><b>構築</b>：每人組合 20 張卡牌（一種屬性最多 8 張，編號不得重複）和 1 位隊長。</li>
<li><b>設置</b>：挑選 1 位隊長，洗牌後各抽 5 張。猜拳決定第一回合的起始玩家，之後每回合輪流當起始玩家。</li></ul>

<h3>回合流程</h3>
<ol><li><b>補牌</b>：手牌補到 5 張，再處理石像【補牌】的效果，例如【多抽】、【換牌】。被「對手抽牌 -1」減少時，手牌最少補到 4 張。</li>
<li><b>出牌</b>：雙方同時選 1～4 張排好順序，蓋著出。</li>
<li><b>翻牌</b>：雙方同時翻開。</li>
<li><b>戰力計算</b>：計算牌型戰力、石像與隊長加成、屬性剋制，戰力高的人得 1 分；平手都不得分。</li>
<li><b>【啟動】石像</b>：不論輸贏，出了成對以上的牌型，就把其中 1 張變成石像（AABB 2 張）。</li>
<li><b>回合結束</b>：處理石像【回合結束】的效果，場地上的其餘卡牌進入棄牌區。</li></ol>
<div class="box"><b>獻祭</b>：可於補牌後～戰力計算之間發動，獻祭 1 座自己的石像，發動它的獻祭效果。每人每回合最多 1 次。</div>

<div class="pb"></div><h3>石像</h3>
<ul><li>每張石像有兩個技能：<b>啟動</b>是石像直立期間一直有效；<b>獻祭</b>是把石像橫放，換一次效果。</li>
<li>獻祭過的石像橫放在石像區，不再有任何能力。</li>
<li>石像會被對手破壞或封印，要想辦法保護自己的石像，也可以去拆對手的。</li></ul>

<h3>牌型大小</h3>
<p>同屬性越多越強，A、B、C 代表不同屬性。字色相同的是同一組。</p>
<table><thead><tr><th>牌型</th><th>例子</th><th>戰力</th><th>變成石像</th></tr></thead>
{''.join(f'<tr><td class="{g}">{a}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>' for a, b, c, d, g in shape)}</table>
<p><b>剋制</b>：<span class="F">火</span>剋<span class="G">草</span>、<span class="G">草</span>剋<span class="W">水</span>、<span class="W">水</span>剋<span class="F">火</span>。不限牌型，每回合都比較雙方的核心屬性，剋制的一方戰力 +2。</p>

<div class="pb"></div><div class="sec"><h3>詳細規則</h3></div>
<h4>1. 抽牌與牌庫</h4>
<ul><li>沒用完的手牌會留著，補牌時補到 5 張。被「對手抽牌 -1」減少時（可以疊加，也會減少補牌時的【多抽】），最少還是補到 4 張。</li><li>牌庫抽完時，把棄牌區洗成新牌庫繼續抽。石像區的牌不洗回。</li></ul>
<h4>2. 核心屬性與剋制</h4>
<ul><li><b>核心屬性</b>：重複最多的屬性，例如火火水草 → 火。AABB 和無牌型（雜色）看最左邊那張，例如火火水水 → 火、草火水 → 草。</li>
<li><b>剋制不限牌型</b>：每回合都比較雙方的核心屬性，例如 AA 的火對上 AAA 的草，火方照樣 +2。</li></ul>
<h4>3. 【啟動】哪一張</h4>
<ul><li>只能從成對的那組牌中【啟動】，固定取最左邊那張。AABB 時，兩組各取最左邊那張。</li>
<li>出牌時的排列順序，會決定核心屬性和哪一張變成石像。</li>
<li>無牌型不能【啟動】，卡上另有寫明的除外。</li></ul>
<h4>4. 獻祭的順序</h4>
<ul><li><b>【反擊】</b>：對手獻祭時才能發動，讓對手這次獻祭無效。</li>
<li><b>本回合對手不能獻祭</b>：主動發動；對手可以用【反擊】回應。</li>
<li><b>翻牌前</b>才能發動的獻祭：宣告核心屬性、看對手出戰牌。</li></ul>
<ol><li>翻牌前（補牌後、出牌時）雙方隨時可以獻祭；翻牌後進入獻祭時間。</li>
<li>獻祭時間從起始玩家開始，雙方輪流宣告「獻祭」或「跳過」。</li>
<li>跳過不代表放棄，對手之後獻祭時，你還是可以【反擊】。</li>
<li>雙方連續都跳過，獻祭時間就結束。</li></ol>
<div class="pb"></div><div class="keep"><h4>5. 石像的狀態與封印</h4>
<table><thead><tr><th>狀態</th><th>擺法</th><th>技能</th><th>算進屬性數量</th></tr></thead>
<tr><td>直立</td><td>直放</td><td>啟動有效，可以獻祭</td><td>算</td></tr>
<tr><td>已獻祭</td><td>橫放</td><td>沒有任何技能</td><td>不算（只算獻祭數量）</td></tr>
<tr><td>封印中</td><td>直放</td><td>啟動無效，也不能獻祭</td><td>算</td></tr></table>
<ul><li><b>破壞</b>：被破壞的石像進擁有者的棄牌區，之後會洗回牌庫。</li>
<li><b>封印通則</b>：封印讓對手有優勢的能力失效；累積的數值保留不變。</li>
<li><b>一次性封印</b>（獻祭效果，例如「本回合對手隊長效果無效」）：【戰力計算】完畢後、【啟動】石像之前解除。所以 L01 被封印的回合沒有連勝加成，但贏了照樣 +1、輸了照樣歸零；【啟動】石像後的隊長勝利條件、【回合結束】的能力也照常。</li>
<li><b>持續封印</b>（L13 雙界封印，以及之後的啟動效果封印）：選定後綁定，直到我方負責維持的石像或對手被封印的石像其中一座被破壞才解除。我方維持者啟動照常、但不能獻祭；對手被封印者啟動無效、也不能獻祭。</li></ul>
</div><h4>6. 效果處理</h4>
<ul><li>寫【補牌】的啟動效果在補牌後處理，寫【回合結束】的在回合最後處理。雙方同時觸發時，起始玩家先處理。</li><li><b>啟動效果</b>：石像直立期間一直有效，條件每次達成就發動；同樣效果的石像各自發動、可以疊加（例如 2 座看手牌的石像，各看 2 張）。標「（每回合執行一次）」的，同一座每回合最多 1 次。</li><li><b>獻祭效果</b>：每人每回合最多獻祭 1 座，【反擊】也算這 1 次。</li><li><b>隊長能力</b>：一直有效，被封印的回合無效。</li>
<li>獻祭得到的能力只持續本回合。</li>
<li>卡面不加括號說明，範圍細節以「用詞定義」為準。</li></ul>
<h4>7. 勝利的細節</h4>
<ul><li>隊長的特殊勝利條件一達成，就立刻獲勝。</li>
<li>需要指定顏色才能獲勝的隊長（L11 冥火貓妖），開局要宣告主色是哪個屬性，雙方都看得到。</li>
<li>雙方同時達成勝利條件時，進入搶 1 分加賽。</li></ul>
<div class="pb"></div><h3>用詞定義</h3><p class="note">卡面上的用詞，範圍以這張表為準。</p><table><thead><tr><th>用詞</th><th>意思</th></tr></thead>{''.join(f'<tr><td class="k">{E(a)}</td><td>{E(b)}</td></tr>' for a, b in words)}</table>
<div class="pb"></div><h3>隊長</h3>
<table><colgroup><col style="width:34mm"><col style="width:26mm"><col></colgroup><thead><tr><th>隊長</th><th>屬性．種族</th><th>能力</th></tr></thead>
{''.join(f'<tr><td class="k">{i} {E(n)}</td><td>{CN[c]}．{E(r)}</td><td><b>{E(sk)}</b>　{E(t)}</td></tr>' for i, n, c, r, sk, t in L)}</table>
<ul class="note"><li>L06「牌型為 AA」：AA、AAB、AABC、AABB 都算，都只 +1。</li>
<li>L12 專屬戰力：A、AA、AAA、AAAA＝1；AB、AAB、AAAB＝3；AABB＝4；ABC＝5；AABC＝6。屬性一律看最左一張，可以被剋制。</li>
<li>L13：【回合結束】時，每 2 座自己的同屬性直立石像（還沒在維持封印的）可以封印 1 座對手直立石像；選定後固定，之後只能用新的成對石像追加。維持的 2 座不能獻祭；維持或被封印的石像被破壞就解除；封魔者被封印時暫時失效到判定勝負。同時封印 4 座獲勝。</li></ul>
<div class="pb"></div><h3>預組</h3>
<p class="note">初階 1～3、進階 4～7；個人牌組在卡牌構築頁建立，編號接在預組與已分享的牌組後面。</p>
<table><colgroup><col style="width:30mm"><col style="width:30mm"><col></colgroup><thead><tr><th>預組</th><th>屬性</th><th>說明</th></tr></thead>
{''.join(f'<tr><td class="k">{p["no"]}.{E(p["name"])}<br><span class="note">{E(p["tier"])}</span></td><td style="white-space:nowrap">{cnt(p["cards"])}</td><td>{E(p["desc"])}</td></tr>' for p in P)}</table>
</div></body></html>'''
open(SP + 'rules3.html', 'w', encoding='utf8').write(doc)

async def go():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto('file://' + SP + 'rules3.html')
        F = f'<div style="font-size:8px;color:#7a7266;font-family:sans-serif;width:100%;text-align:center">召喚 {VER} 遊戲規則．<span class="pageNumber"></span>／<span class="totalPages"></span></div>'
        await pg.pdf(path=SP + 'rules3_raw.pdf', format='A4', print_background=True, display_header_footer=True, header_template='<span></span>', footer_template=F,
                     margin={'top': '15mm', 'bottom': '15mm', 'left': '0', 'right': '0'})
        await b.close()
asyncio.run(go())

# 每頁底下墊一張全幅深色底（Chromium 不會畫頁邊距的背景）
from pypdf import PdfReader, PdfWriter, PageObject
from reportlab.pdfgen import canvas
import io
r = PdfReader(SP + 'rules3_raw.pdf'); w = PdfWriter()
for pg in r.pages:
    W, Hh = float(pg.mediabox.width), float(pg.mediabox.height)
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(W, Hh)); c.setFillColorRGB(0xf8/255, 0xf3/255, 0xe8/255); c.rect(0, 0, W, Hh, stroke=0, fill=1); c.save()
    base = PdfReader(io.BytesIO(buf.getvalue())).pages[0]
    base.merge_page(pg); w.add_page(base)
w.write(OUT); print('輸出：', OUT)
