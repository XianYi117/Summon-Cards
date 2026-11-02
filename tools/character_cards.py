"""角色卡產生器：用舊卡圖當底圖，依新卡表重寫「卡號」與「啟動／獻祭」兩格文字，輸出 PNG、遊戲用 webp 與 A4 列印 PDF。

用法：python3 tools/character_cards.py 卡表.xlsx [輸出資料夾]
  卡表：第一頁欄位為 編號、屬性、種族、啟動效果、獻祭效果、原編號（原編號＝用哪張舊卡圖當底）
  原編號的屬性跟新屬性不同時（例如火改草），改用同屬性、同種族的舊卡當底圖。
輸出：raw/*.png（600×840）、cards/*.webp（600px）、cards/sm/*.webp（300px）、召喚卡牌_角色卡圖版.pdf
需要：pillow numpy opencv-python-headless openpyxl reportlab；字型 Noto Sans CJK、Noto Serif CJK。
"""
import os, re, sys, numpy as np, cv2, openpyxl
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(REPO, 'tools', 'out_cards')
for d in ('raw', 'cards', 'cards/sm'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
FD = os.environ.get('NOTO_DIR', '/usr/share/fonts/opentype/noto')
TXT_FONT = ImageFont.truetype(f'{FD}/NotoSansCJK-Bold.ttc', int(os.environ.get('TXT', 20)), index=3)
NUM_FONT = ImageFont.truetype(f'{FD}/NotoSerifCJK-Medium.ttc', int(os.environ.get('NUM', 46)), index=3)
INK = (28, 22, 16)
NUM_BOX = (236, 46, 364, 94)          # 卡號文字（含兩側裝飾線的內段，之後補畫回去）
BOXES = ((180, 565, 549, 652), (180, 671, 549, 773))   # 啟動、獻祭 文字區
TX, MAXW = 186, 360
LH = int(TXT_FONT.size * 1.28)

# 舊卡的種族（找火改草這類卡的底圖用）
src = open(f'{REPO}/shared/data.js', encoding='utf-8').read()
OLD = {m.group(1): m.group(2) for m in re.finditer(r'  ([FWG]\d\d): \{"name": "[^"]*", "race": "([^"]*)"', src)}

def inpaint(a, mask, rad=4):
    m = cv2.dilate(mask.astype(np.uint8) * 255, np.ones((3, 3), np.uint8), iterations=2)
    return cv2.cvtColor(cv2.inpaint(cv2.cvtColor(a, cv2.COLOR_RGB2BGR), m, rad, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)

def wrap(text, font, maxw):
    NOSTART = '，、；：）。'
    def ok(seg, i):
        a, b = seg[i - 1], seg[i]
        if b in NOSTART or a in '（【': return False
        if b == '】' or (a.isascii() and a != ' ' and b.isascii() and b != ' '): return False
        return True
    @lru_cache(None)
    def split(seg):
        if font.getlength(seg) <= maxw: return (0, 0.0, (seg,))
        best = None
        for i in range(1, len(seg)):
            if not ok(seg, i): continue
            a = seg[:i]
            if font.getlength(a) > maxw: break
            sub = split(seg[i:])
            if sub is None: continue
            pen = 0 if seg[i - 1] in '，、：；）' or seg[i] in '（【' else 1
            lines = (a,) + sub[2]; ws = [font.getlength(x) for x in lines]
            score = (len(lines), sub[0] + pen, max(ws) - min(ws))
            if best is None or score < best[0]: best = (score, lines)
        return None if best is None else (best[0][1], best[0][2], best[1])
    r = split(text.strip())
    return list(r[2]) if r else [text]

def make(new_id, base_id, act, sac):
    im = Image.open(f'{REPO}/shared/cards/{base_id}.webp').convert('RGB'); a = np.array(im)
    lum = a.astype(int).mean(2); h, w = lum.shape
    for (x0, y0, x1, y1) in (NUM_BOX,) + BOXES:
        reg = np.zeros((h, w), bool); reg[y0:y1, x0:x1] = True
        a = inpaint(a, reg & (lum < 170), 5)
    # 補回卡號兩側的裝飾線：用框外那一欄的樣子往內延伸到新卡號旁
    bb = NUM_FONT.getbbox(new_id); cx, cy = 300, 70
    L = int(cx - (bb[2] - bb[0]) / 2) - 8; R = int(cx + (bb[2] - bb[0]) / 2) + 8
    colL = a[50:76, 232].copy(); colR = a[50:76, 368].copy()
    for x in range(NUM_BOX[0], L): a[50:76, x] = colL
    for x in range(R, NUM_BOX[2]): a[50:76, x] = colR
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    d.text((cx - (bb[0] + bb[2]) / 2, cy - (bb[1] + bb[3]) / 2), new_id, font=NUM_FONT, fill=INK)
    out = []
    for box, text in zip(BOXES, (act, sac)):
        lines = wrap(text, TXT_FONT, MAXW); out.append(lines)
        g = TXT_FONT.getbbox('國'); gh = g[3] - g[1]
        top = (box[1] + box[3]) / 2 - LH * len(lines) / 2
        for i, l in enumerate(lines): d.text((TX, top + i * LH + (LH - gh) / 2 - g[1]), l, font=TXT_FONT, fill=INK)
    im.save(f'{OUT}/raw/{new_id}.png'); im.save(f'{OUT}/raw/{new_id}.jpg', quality=90)
    im.save(f'{OUT}/cards/{new_id}.webp', quality=88)
    im.resize((300, 420), Image.LANCZOS).save(f'{OUT}/cards/sm/{new_id}.webp', quality=85)
    return out

ws = openpyxl.load_workbook(XLSX).worksheets[0]
hdr = [c.value for c in ws[1]]; col = {k: hdr.index(k) for k in ('編號', '屬性', '種族', '啟動效果', '獻祭效果', '原編號')}
P = {'火': 'F', '水': 'W', '草': 'G'}
rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]
report = []
for r in rows:
    nid, attr, race, act, sac, old = (r[col[k]] for k in ('編號', '屬性', '種族', '啟動效果', '獻祭效果', '原編號'))
    base = old
    if old[0] != P[attr] or OLD.get(old) != race:   # 屬性或種族換了：找同屬性、同種族的舊卡當底
        base = next(k for k in sorted(OLD) if k[0] == P[attr] and OLD[k] == race)
    lines = make(nid, base, act, sac)
    report.append((nid, base, max(len(l) for l in lines)))
    print(nid, '←', base, '|', ' / '.join('｜'.join(l) for l in lines))
over = [x for x in report if x[2] > 3]
print('最多行數：', max(x[2] for x in report), '｜超過 3 行：', over or '無')

# A4 3×3 PDF
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
ids = [r[col['編號']] for r in rows]
W, H = A4; cw, ch = 63 * mm, 88 * mm; x0 = (W - 3 * cw) / 2; yt = (H - 3 * ch) / 2
c = canvas.Canvas(os.path.join(OUT, '召喚卡牌_角色卡圖版.pdf'), pagesize=A4); c.setTitle(f'召喚 角色卡 {len(ids)} 張')
for p in range(0, len(ids), 9):
    page = ids[p:p + 9]
    for k, id in enumerate(page):
        rr, cc = divmod(k, 3); c.drawImage(f'{OUT}/raw/{id}.jpg', x0 + cc * cw, H - yt - (rr + 1) * ch, cw, ch)
    nrow = (len(page) + 2) // 3; c.setStrokeGray(.2); c.setLineWidth(.2 * mm); ext = 5 * mm; top = H - yt; bot = top - nrow * ch
    for i in range(4): c.line(x0 + i * cw, bot - ext, x0 + i * cw, top + ext)
    for i in range(nrow + 1): c.line(x0 - ext, top - i * ch, x0 + 3 * cw + ext, top - i * ch)
    c.showPage()
c.save(); print('輸出：', OUT)
