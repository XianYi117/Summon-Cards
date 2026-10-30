# 連線對戰本機測試：在 repo 根目錄執行 python3 -m http.server 8765，再執行 python3 tools/net_test.py normal|mismatch|betaprod|reconnect|reconnect_host
# 用 tools/mockpeer.js 在同一個瀏覽器內模擬 PeerJS，不需要網路
import asyncio, json, sys
from playwright.async_api import async_playwright
import os
SP = os.path.dirname(os.path.abspath(__file__)) + '/'
MOCK = open(SP + 'mockpeer.js').read()
BASE = 'http://localhost:8765/'

async def pick(pg, leader_idx, deck):
    await pg.wait_for_selector('#leaderGrid .card', timeout=10000)
    await pg.click(f'#leaderGrid .card >> nth={leader_idx}')
    await pg.click(f'#pickInfo .chip:has-text("{deck}")')
    await pg.click('.pick-actions button >> nth=-1')

async def autoplay(pg, steps=1):
    st = await pg.evaluate("window.__summonState && window.__summonState()")
    if not st: return None
    s = json.loads(st)
    if await pg.locator('#modal').is_visible():
        txt = await pg.inner_text('#mbox')
        if '版本不同' in txt or '連線中斷' in txt: return s
        cards = pg.locator('#mbox .mcards .card'); ok = pg.locator('#mbox button:has-text("確定")')
        if await cards.count() and await ok.count():
            await cards.first.click()
            if await ok.first.is_disabled() and await cards.count() > 1: await cards.nth(1).click()
        cb = pg.locator('#mbox .colorbtn')
        if await cb.count() and not await ok.count(): await cb.first.click()
        else:
            for t in ['確定', '知道了', '放到牌庫底', '都留在牌庫頂']:
                x = pg.locator(f'#mbox button:has-text("{t}")')
                if await x.count() and await x.first.is_enabled(): await x.first.click(); break
        return s
    if s['mode'] == 'choose' and s['res']:
        await pg.click('.hand .card >> nth=0')
        btn = pg.locator('#actbar button:has-text("出牌")')
        if await btn.count() and await btn.first.is_enabled(): await btn.first.click()
    elif s['mode'] == 'post' and s['res']:
        sk = pg.locator('#actbar button:has-text("跳過")')
        if await sk.count(): await sk.first.click()
    elif s['mode'] == 'boardpick' and s['pk']:
        await pg.locator('.card.pickable').first.click()
    return s

async def setup(b, path, tamper=None):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
    await ctx.add_init_script(MOCK)
    if tamper: await ctx.add_init_script(tamper)
    pages = [await ctx.new_page(), await ctx.new_page()]
    errs = []
    for p in pages: p.on('pageerror', lambda e: errs.append(str(e)))
    for p in pages: await p.goto(BASE + path); await p.wait_for_timeout(400)
    host, guest = pages
    await host.click('#btnOnline'); await host.click('#btnCreate')
    await host.wait_for_function("document.querySelector('#roomCode') && /\\d{4}[A-Z]/.test(document.querySelector('#roomCode').textContent)", timeout=10000)
    code = (await host.inner_text('#roomCode')).strip()
    await guest.click('#btnOnline'); await guest.fill('#joinCode', code); await guest.click('#btnJoin')
    return ctx, host, guest, errs, code

async def main(mode):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        if mode == 'normal':
            ctx, host, guest, errs, code = await setup(b, '')
            await pick(host, 0, '1.烈焰突擊'); await pick(guest, 3, '4.屬性剋制')
            await host.wait_for_function("window.__summonState && JSON.parse(window.__summonState()||'{}').turn>=1", timeout=30000)
            for i in range(400):
                a = await autoplay(host); c = await autoplay(guest)
                if a and c and a['mode'] == 'idle' and c['mode'] == 'idle' and a['turn'] >= 1 and await host.locator('text=再戰一局').count(): break
                await host.wait_for_timeout(150)
            sa = json.loads(await host.evaluate('window.__summonState()')); sb = json.loads(await guest.evaluate('window.__summonState()'))
            same = [x['s'] for x in sa['p']] == [x['s'] for x in sb['p']] and sa['turn'] == sb['turn']
            print('normal game: turns', sa['turn'], 'scores host', [x['s'] for x in sa['p']], 'guest', [x['s'] for x in sb['p']], 'in sync' if same else 'DESYNC', 'errors', errs)
        elif mode in ('reconnect', 'reconnect_host'):
            ctx, host, guest, errs, code = await setup(b, '')
            await pick(host, 0, '1.烈焰突擊'); await pick(guest, 3, '4.屬性剋制')
            await host.wait_for_function("window.__summonState && JSON.parse(window.__summonState()||'{}').turn>=1", timeout=30000)
            killed = False; seen_overlay = False; recovered = False; played_while_down = False
            victim = guest if mode == 'reconnect' else host
            for i in range(600):
                a = await autoplay(host); c = await autoplay(guest)
                if not killed and a and a['turn'] >= 2:
                    await victim.evaluate('window.__mockKill(4000)'); killed = True; t_kill = i
                if killed and not recovered:
                    hv = await host.locator('#reconn').is_visible(); gv = await guest.locator('#reconn').is_visible(); vis = hv or gv
                    if i % 10 == 0: print('  t', i - t_kill, 'host overlay', hv, 'guest overlay', gv, (await host.inner_text('#reconn'))[:30].replace('\n',' '), '|', (await guest.inner_text('#reconn'))[:30].replace('\n',' '))
                    if vis: seen_overlay = True
                    if seen_overlay and not vis: recovered = True
                if a and c and a['mode'] == 'idle' and c['mode'] == 'idle' and a['turn'] >= 1 and await host.locator('text=再戰一局').count(): break
                await host.wait_for_timeout(150)
            sa = json.loads(await host.evaluate('window.__summonState()')); sb = json.loads(await guest.evaluate('window.__summonState()'))
            same = [x['s'] for x in sa['p']] == [x['s'] for x in sb['p']] and sa['turn'] == sb['turn']
            print(mode, 'overlay shown', seen_overlay, 'recovered', recovered, 'turns', sa['turn'], 'scores', [x['s'] for x in sa['p']], [x['s'] for x in sb['p']], 'in sync' if same else 'DESYNC', 'errors', errs)
        elif mode == 'mismatch':
            # 讓其中一頁的規則引擎不同（模擬一邊是舊版）
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); await ctx.add_init_script(MOCK)
            host = await ctx.new_page(); guest = await ctx.new_page()
            await host.goto(BASE); await guest.goto(BASE); await guest.wait_for_timeout(300)
            await guest.evaluate("CARDS.F01.act += '（舊版）'")  # 只改資料不會影響已算好的 BUILD，改用重新載入時注入
            await guest.close(); guest = await ctx.new_page()
            await guest.add_init_script("Object.defineProperty(window,'__old',{value:1});")
            await guest.route('**/shared/data.js', lambda r: r.fulfill(body=open(SP + '../shared/data.js', encoding='utf8').read().replace('所有牌型：戰力 +1', '所有牌型：戰力 +2'), content_type='application/javascript'))
            await guest.goto(BASE); await guest.wait_for_timeout(300)
            await host.click('#btnOnline'); await host.click('#btnCreate')
            await host.wait_for_function("/\\d{4}[A-Z]/.test(document.querySelector('#roomCode').textContent)", timeout=10000)
            code = (await host.inner_text('#roomCode')).strip()
            await guest.click('#btnOnline'); await guest.fill('#joinCode', code); await guest.click('#btnJoin')
            await host.wait_for_timeout(1500)
            for n, pg in (('host', host), ('guest', guest)):
                print('mismatch', n, await pg.evaluate("[...document.querySelectorAll('section.screen')].filter(s=>!s.hidden).map(s=>s.id)"), (await pg.inner_text('#onMsg'))[:30])
        elif mode == 'betaprod':
            ctx = await b.new_context(); await ctx.add_init_script(MOCK)
            host = await ctx.new_page(); guest = await ctx.new_page()
            await host.goto(BASE); await guest.goto(BASE + 'beta/'); await guest.wait_for_timeout(300)
            await host.click('#btnOnline'); await host.click('#btnCreate')
            await host.wait_for_function("/\\d{4}[A-Z]/.test(document.querySelector('#roomCode').textContent)", timeout=10000)
            code = (await host.inner_text('#roomCode')).strip()
            await guest.click('#btnOnline'); await guest.fill('#joinCode', code); await guest.click('#btnJoin')
            await guest.wait_for_timeout(2500)
            print('beta joins prod room:', await guest.inner_text('#onMsg'))
        await b.close()
asyncio.run(main(sys.argv[1]))
