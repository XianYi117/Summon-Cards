# 召喚｜Cloudflare 雲端（共享牌組＋對戰紀錄＋TURN 中繼）

| 檔案 | 內容 |
|---|---|
| `worker.js` | Cloudflare Worker 程式（貼到後台即可） |
| `schema.sql` | D1 資料表（已在資料庫 `summon-cards` 建好） |
| `../shared/cloud.js` | 遊戲與構築頁的串接；`CLOUD_API` 填 Worker 網址後啟用，留空＝完全不連雲端 |
| `../tools/cloud_local.mjs` | 本機模擬（Node 內建 sqlite），`node tools/cloud_local.mjs` 開在 8787 埠 |

## 部署步驟（Cloudflare 後台）

1. **Workers & Pages → Create → Create Worker**，名稱填 `summon-cards`，按 Deploy。
2. 進入該 Worker → **Edit code**，把 `worker.js` 全部內容貼上取代 → **Deploy**。
3. Worker → **Settings → Bindings → Add → D1 database**：變數名稱 `DB`，資料庫選 `summon-cards`。
4. 左側選單 **Realtime → TURN Server → Create**（名稱隨意），會給一組 **Turn Token ID** 和 **API Token**（API Token 只顯示一次）。
5. Worker → **Settings → Variables and Secrets → Add**，類型選 **Secret**：
   - `TURN_KEY_ID` ＝ Turn Token ID
   - `TURN_KEY_TOKEN` ＝ API Token
6. 打開 `https://summon-cards.<你的子網域>.workers.dev/` 看到 `{"ok":true,...}` 就完成，把這個網址填進 `shared/cloud.js` 的 `CLOUD_API`。

## API

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/turn` | 產生 4 小時有效的 TURN 憑證 |
| GET | `/decks` | 最近 300 副共享牌組（`mine` 表示是不是這台裝置建的） |
| POST | `/decks` | 新增，回傳資料庫發的編號（從 12 起） |
| PUT／DELETE | `/decks/:no` | 修改／刪除，只有建立的裝置可以 |
| POST | `/results` | 記錄一場對戰（雙方牌組、隊長、勝方、回合、比分；不記玩家身分） |
| GET | `/stats?by=deck\|leader&mode=online\|ai&days=30` | 勝率統計（平手算半勝） |

- 裝置辨識：瀏覽器自己產生隨機「裝置碼」（localStorage `summon_device`），伺服器只存它的 SHA-256。清掉瀏覽器資料就無法再修改原本上傳的牌組（但牌組本身還在，大家仍可使用）。
- 只接受 `https://xianyi117.github.io` 與本機 8765 埠的請求。
- 費用：Workers、D1 免費額度遠超過目前用量；TURN 每月 1,000 GB 免費，只有直連失敗時才會走中繼。
