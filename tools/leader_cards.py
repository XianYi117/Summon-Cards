"""隊長卡產生器：依 shared/data.js 的隊長資料，重畫隊長卡的種族圓章與能力文字，輸出 PNG 與 A4 列印 PDF。

用法：python3 tools/leader_cards.py [輸出資料夾]   （預設 tools/out_leaders/）
輸出：png/L01～L13.png（四角透明）、召喚卡牌_13隊長卡圖版.pdf（A4 3×3、63×88 mm、無間隔、裁切格線）
更新 docs/ 時把 PDF 複製到 docs/召喚卡牌_13隊長卡圖版.pdf。

需要：pip install opencv-python-headless pillow numpy scipy reportlab；字型 Noto Sans CJK TC（Bold、Black）。
底圖用 shared/cards/L??.webp：文字框整個重寫；種族圓章只重畫 REDO_EMBLEM 裡的隊長（其餘保留原圖）。
字級：ABIL（能力，預設 25）、SKILL（能力名稱，預設 26），可用環境變數調整；25 是 L13 放得下 3 行的上限。
"""
import re, json, sys, os, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
REPO=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(REPO,'tools','out_leaders'); os.makedirs(os.path.join(OUT,'raw'),exist_ok=True); os.makedirs(os.path.join(OUT,'png'),exist_ok=True)
FONT_DIR=os.environ.get('NOTO_DIR','/usr/share/fonts/opentype/noto')
BOLD=f'{FONT_DIR}/NotoSansCJK-Bold.ttc'
src=open(f'{REPO}/shared/data.js',encoding='utf-8').read()
L={}
for m in re.finditer(r"  (L\d\d): \{ name: '([^']*)', color: '(.)', race: '([^']*)', skill: '([^']*)', text: '([^']*)' \}",src):
    L[m.group(1)]=dict(name=m.group(2),color=m.group(3),race=m.group(4),skill=m.group(5),text=m.group(6))
assert len(L)==13, len(L)
REDO_EMBLEM=('L03','L04','L05','L06','L07','L09','L10')   # 2026-10-30 種族改過的隊長
CX,CY,R=515,75,46            # 種族圓章中心與半徑
EMB_CENTER=(513.5,78.0)      # 原圖單字中心
BOX1=(178,552,552,643)       # 能力名稱 內框
BOX2=(178,664,552,771)       # 能力 內框
INK=(24,19,14)
BLACK=f'{FONT_DIR}/NotoSansCJK-Black.ttc'

def inpaint(arr, mask, rad=4):
    m=cv2.dilate(mask.astype(np.uint8)*255, np.ones((3,3),np.uint8), iterations=2)
    return cv2.cvtColor(cv2.inpaint(cv2.cvtColor(arr,cv2.COLOR_RGB2BGR), m, rad, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)

from functools import lru_cache
def wrap(text, font, maxw):
    # 先在「；」後換行；放不下時找「行數最少 → 盡量斷在標點 → 各行長度最平均」的斷法
    NOSTART='，、；：）。'
    def ok_break(seg,i):
        a,b=seg[i-1],seg[i]
        if b in NOSTART or a=='（': return False
        if (a.isascii() and a!=' ') and (b.isascii() and b!=' '): return False   # 不拆英數
        if a==' ' or b==' ': return False
        return True
    @lru_cache(None)
    def split(seg):
        if font.getlength(seg)<=maxw: return (0,0.0,(seg,))
        best=None
        for i in range(1,len(seg)):
            if not ok_break(seg,i): continue
            a=seg[:i]
            if font.getlength(a)>maxw: break
            sub=split(seg[i:])
            if sub is None: continue
            pen = 0 if seg[i-1] in '，、：' or seg[i]=='（' else 1
            lines=(a,)+sub[2]
            ws=[font.getlength(x) for x in lines]
            score=(len(lines), sub[0]+pen, max(ws)-min(ws))
            if best is None or score<best[0]: best=(score,lines)
        return None if best is None else (best[0][1], best[0][2], best[1])
    out=[]
    for p in [p for p in re.split(r'(?<=；)', text) if p]:
        r=split(p); out+=list(r[2]) if r else [p]
    return [l.strip() for l in out if l.strip()]

def draw_center_v(d, box, lines, font, lh):
    x0,y0,x1,y1=box; total=lh*len(lines); top=(y0+y1)/2-total/2
    for i,l in enumerate(lines):
        bb=font.getbbox('國'); gh=bb[3]-bb[1]
        y=top+i*lh+(lh-gh)/2-bb[1]
        d.text((185,y),l,font=font,fill=INK)

ABIL_SIZE=int(os.environ.get('ABIL',25)); SKILL_SIZE=int(os.environ.get('SKILL',26)); MAXW=int(os.environ.get('MAXW',360)); LH=int(ABIL_SIZE*1.3)
report=[]
for id,c in L.items():
    im=Image.open(f'{REPO}/shared/cards/{id}.webp').convert('RGB'); a=np.array(im); h,w=a.shape[:2]
    Y,X=np.mgrid[0:h,0:w]; lum=a.mean(axis=2); sat=a.max(axis=2).astype(int)-a.min(axis=2)
    # 1) 種族圓章：只在種族有改時重畫
    old_lum_in=(X-CX)**2+(Y-CY)**2<(R-3)**2
    redo_emblem = id in REDO_EMBLEM
    if redo_emblem:
        circ=(X-CX)**2+(Y-CY)**2<(R-4)**2
        bgl=np.median(lum[circ]); 
        mask=circ&(lum>bgl+45)&(sat<90)
        a=inpaint(a,mask,5)
    # 2) 文字框：全部依資料重畫
    for (x0,y0,x1,y1) in (BOX1,BOX2):
        reg=np.zeros((h,w),bool); reg[y0:y1,x0:x1]=True
        mask=reg&(lum<150)
        a=inpaint(a,mask,4)
    im=Image.fromarray(a); d=ImageDraw.Draw(im)
    if redo_emblem:
        n=len(c['race']); size=44 if n==1 else max(18,int(70/n))
        f=ImageFont.truetype(BOLD,size,index=3); bb=f.getbbox(c['race'])
        x=EMB_CENTER[0]-(bb[0]+bb[2])/2; y=EMB_CENTER[1]-(bb[1]+bb[3])/2
        d.text((x,y),c['race'],font=f,fill=(250,243,231))
    f1=ImageFont.truetype(BLACK,SKILL_SIZE,index=3); draw_center_v(d,BOX1,[c["skill"]],f1,SKILL_SIZE+6)
    f2=ImageFont.truetype(BLACK,ABIL_SIZE,index=3); lines=wrap(c['text'],f2,MAXW); draw_center_v(d,BOX2,lines,f2,LH)
    im.save(f'{OUT}/raw/{id}.png')
    report.append((id,c['race'],c['skill'],lines))
for r in report: print(*r)

# ---------- 去白角、排版 PDF ----------
from scipy import ndimage
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
RAW=os.path.join(OUT,'raw'); PNG=os.path.join(OUT,'png')
ids=sorted(L)
for id in ids:
    a=np.array(Image.open(f'{RAW}/{id}.png').convert('RGB')).astype(float); h,w=a.shape[:2]
    mn=a.min(axis=2); lab,_=ndimage.label(mn>90)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    mask=np.isin(lab,list(border)); t=np.clip((mn-40)/195,0,1); alpha=np.ones((h,w)); alpha[mask]=1-t[mask]
    ring=ndimage.binary_dilation(mask)&~mask; alpha[ring]=np.minimum(alpha[ring],1-0.5*t[ring])
    rgb=a.copy(); rgb[mask|ring]=[15,15,15]
    Image.fromarray(np.dstack([rgb,alpha*255]).astype(np.uint8),'RGBA').save(f'{PNG}/{id}.png',optimize=True)
os.chdir(OUT)
W,H=A4; cw,ch=63*mm,88*mm; x0=(W-3*cw)/2; yt=(H-3*ch)/2
c=canvas.Canvas('召喚卡牌_13隊長卡圖版.pdf',pagesize=A4); c.setTitle('召喚 隊長 L01–L13')
for p in range(0,13,9):
    page=ids[p:p+9]
    for k,id in enumerate(page):
        r,col=divmod(k,3); c.drawImage(f'{PNG}/{id}.png',x0+col*cw,H-yt-(r+1)*ch,cw,ch,mask='auto')
    rows=(len(page)+2)//3; c.setStrokeGray(.2); c.setLineWidth(.2*mm); ext=5*mm; top=H-yt; bot=top-rows*ch
    for i in range(4): c.line(x0+i*cw, bot-ext, x0+i*cw, top+ext)
    for i in range(rows+1): c.line(x0-ext, top-i*ch, x0+3*cw+ext, top-i*ch)
    c.showPage()
c.save()
print('輸出：', OUT)
