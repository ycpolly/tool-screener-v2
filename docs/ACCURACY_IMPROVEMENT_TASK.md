# 五大模式準確度提升功能開發任務書

> **建立日期**：2026-10-04  
> **關聯文件**：[ACCURACY_IMPROVEMENT_PLAN.md](file:///c:/Users/roroc/git/tool-screener-v2/docs/ACCURACY_IMPROVEMENT_PLAN.md)  
> **核心目標**：解決 2026-10-01 多頭回測等模式選出多檔股票時（如 12 檔），無法在第一時間鎖定最強波段股（如 4551 智伸科）之問題。透過補充「相對大盤強弱」、「籌碼集中連續趨勢」、「股本規模」、「本益比折同業」、「月營收動能」等維度，建立量化優先級與綜合評分排序。  
> **分工邊界**：  
> - **後端 AI (Claude)**：負責 `scripts/`（Python 爬蟲與指標計算）、`src/engine/`（篩選評分與排序）、`src/constants/screener-modes.js`、`docs/ARCHITECTURE.md` 更新。  
> - **前端 AI (Gemini)**：負責 `src/constants/ui-strings.js` 字串維護、`src/components/StockCard.vue`、`src/components/MarketBanner.vue`、`src/components/ScreenerPanel.vue` 的視覺排版。  
> **Push 規範**：完成後自我驗證並 commit，絕對嚴禁自動 push，待使用者審查同意後始可執行。

---

## 一、分階段實作規劃

| 階段 | 包含方案 | 實作策略與技術來源 | 預估效益 | 難度 |
| :--- | :--- | :--- | :---: | :---: |
| **第一階段 (Phase 1)** | 方案 2：相對大盤強弱 (RS)<br>方案 4：籌碼集中度連續趨勢 | **零新爬蟲**：利用現有 `sparkline`、`history10d`、`market` 與 `chipsHistory` 計算 | ⭐⭐⭐⭐⭐ | 低 |
| **第二階段 (Phase 2)** | 方案 3：股本大小 (實收資本額)<br>方案 6：本益比 vs 同業平均折價 | **富邦 DJ 個股頁面**：一次性/每週爬取富邦個股基本資料 HTML 解析 | ⭐⭐⭐⭐ | 中 |
| **第三階段 (Phase 3)** | 方案 1：月營收年增率 (YoY) | **MOPS 公開資訊觀測站 API**：每月 10 號排程抓取全市場月營收快取檔案 | ⭐⭐⭐⭐⭐ | 中 |
| **第四階段 (Phase 4)** | 綜合評分排序與模式規則升級 | **篩選引擎加權**：在 `screener.js` 實作排序評分，將具備催化劑之標的優先置頂 | ⭐⭐⭐⭐⭐ | 中 |

---

## 二、第一階段 (Phase 1)：現有資料零爬蟲擴充 【後端已完成 ✅ 2026-10-04 / 前端已完成 ✅ 2026-10-04】

### 1. 方案 2：相對大盤強弱度（Relative Strength）

#### 【後端 Claude 職責】（✅ 已實作完成並驗證通過）
1. **`scripts/engine/market_regime.py`**：
   - 在產出 `market.taiex` 與 `market.otc` 物件時，計算大盤加權指數與櫃買指數之近 5 日累計漲跌幅：
     $$\text{chg5d} = \frac{\text{close}_{\text{today}} - \text{close}_{5\text{D ago}}}{\text{close}_{5\text{D ago}}} \times 100$$
   - 寫入欄位：`market.taiex.chg5d`、`market.otc.chg5d`（型態：`number`，單位：`%`，例如 `-1.82`）。

2. **`scripts/writer.py`**：
   - 遍歷個股時，由個股 `sparkline` 或 `history10d` 計算近 5 日漲跌幅 `stockChg5d`。
   - 上市股對照 `market.taiex.chg5d`，上櫃股（`market == 'otc'`）對照 `market.otc.chg5d`：
     $$\text{relStrength5d} = \text{stockChg5d} - \text{benchmarkChg5d}$$
   - 寫入 `stock.relStrength5d`（型態：`number`，四捨五入至小數點後 2 位，如 `+3.25`）。

#### 【前端 Gemini 職責】（✅ 已實作完成並驗證通過）
1. **`src/constants/ui-strings.js`**：
   - 定義字串字典：
     ```javascript
     REL_STRENGTH: {
       label: '相對強弱',
       stronger: '強於大盤',
       weaker: '弱於大盤',
       prefix: 'RS',
       benchmark5d: '5D',
       benchmarkTaiex: '加權 5D',
       benchmarkOtc: '櫃買 5D',
     },
     CHIPS_TREND: {
       up: '籌碼連續集中',
       down: '籌碼連續發散',
       flat: '籌碼持平',
       streak3: '連 3 日集中',
       streak2: '連 2 日集中',
       streak3Badge: '連 3 集中',
       streak2Badge: '連 2 集中',
       flatBadge: '持平',
       divergeBadge: '發散',
     }
     ```
2. **`src/components/MarketBanner.vue`**：
   - **資料來源**：`props.taiex.chg5d` 與 `props.otc.chg5d`（型態：`number`，單位：`%`，例如 `+0.66` 與 `+3.18`）。
   - **視覺呈現**：於頂部大盤條加權與櫃買迷你數據卡旁補充顯示近 5 日基準值（例如：`5D +0.7%` / `5D +3.2%`），提供透明交叉對照。
3. **`src/components/StockCard.vue`**：
   - **資料來源**：`props.stock.relStrength5d`（型態：`number | null`，例如 `+13.1`）。
   - **視覺呈現**：於卡片首行報價或指標區新增相對強弱微型 Badge（正值為強勢紅字/綠色膠囊，負值為弱勢文字）：
     - 範例：`RS +13.1%`（智伸科）、`RS +9.6%`（大量）。

---

### 2. 方案 4：籌碼集中度連續趨勢（Chips Concentration Trend）

#### 【後端 Claude 職責】（✅ 已實作完成並驗證通過）
1. **`scripts/writer.py` 與 `src/engine/screener.js`**：
   - 讀取個股既有的 `chipsHistory`（近 10 日歷史快照）。
   - 取出最近 3 個有籌碼紀錄之交易日的「集中度 %（`concentration1d`）」。
   - 判斷趨勢：
     - 若 $D_0 > D_1 > D_2$：`chipsTrend3d: 'UP'`，連續上升天數 `chipsScore: 3`。
     - 若 $D_0 > D_1$：`chipsTrend3d: 'UP'`，連續上升天數 `chipsScore: 2`。
     - 若 $D_0 < D_1 < D_2$：`chipsTrend3d: 'DOWN'`，`chipsScore: 0`。
     - 其餘情況：`chipsTrend3d: 'FLAT'`，`chipsScore: 1`。
   - 寫入 `stock.chipsTrend3d` 與 `stock.chipsScore`，且時光機 `sliceStockAt` 支援歷史動態倒流重算。

#### 【前端 Gemini 職責】（✅ 已實作完成並驗證通過）
1. **`src/components/StockChipsSection.vue`**（籌碼透視子元件）：
   - **資料來源**：`props.stock.chipsTrend3d`（`'UP' | 'FLAT' | 'DOWN' | null`）與 `props.stock.chipsScore`（`number | null`）。
   - **視覺呈現**：在現有「籌碼集中度 1D · 3D · 5D」數值旁，附加微型標記（文字皆不加粗）：
     - `UP` 且 `chipsScore === 3`：顯示紅色雙箭頭 + `連 3 集中`（相容亮色模式）。
     - `UP` 且 `chipsScore === 2`：顯示紅色單箭頭 + `連 2 集中`。
     - `FLAT`：純文字徽章 `持平`（無箭頭）。
     - `DOWN`：純文字徽章 `發散`（無箭頭）。
     - 若 `chips == null` 或無資料時不顯示，維持原「未入選追蹤池」等提示。

---

## 三、第二階段 (Phase 2)：基本面與同業估值擴充 (Fubon 爬蟲)

### 方案 3（股本）& 方案 6（本益比折同業）

#### 【資料來源】
* **富邦個股基本資料網址**：`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zca/zca_{code}.djhtm`
* **頁面包含欄位**：
  * 「實收資本額」：例如 `1,152 百萬元` 或 `11.52 億元`。
  * 「本益比」：例如 `19.52`。
  * 「同業平均本益比」：例如 `32.39`。

#### 【後端 Claude 職責】
1. **`scripts/scrapers/fubon.py`**：
   - 新增 `fetch_stock_fundamentals(code: str) -> dict`。
   - 複用現有的 `urllib.request` 與 `decode_fubon_html`，發送請求並解析 HTML 表格：
     - 提取資本額，統一轉換為「億元（`float`）」，對應欄位 `paidInCapital`。
     - 提取個股 PE，對應欄位 `pe`。
     - 提取同業 PE，對應欄位 `industryPe`。
     - 計算折溢價：
       $$\text{peDiscount} = \frac{\text{pe} - \text{industryPe}}{\text{industryPe}} \times 100$$
   - 批次抓取快取設計：由於資本額與同業 PE 變動頻率低，後端應建立 `cache/fundamentals.json` 本地快取，每週僅需全量更新一次，平日爬蟲只針對新納入選股池之標的進行增量查詢。
2. **`scripts/writer.py`**：
   - 注入各個股物件：
     ```json
     {
       "paidInCapital": 11.52,
       "pe": 19.52,
       "industryPe": 32.39,
       "peDiscount": -39.7
     }
     ```

#### 【前端 Gemini 職責】
1. **`src/constants/ui-strings.js`**：
   - 定義字串：
     ```javascript
     FUNDAMENTALS: {
       capital: '股本',
       capitalUnit: '億',
       smallCapitalBadge: '輕型股',
       pe: '本益比',
       industryPe: '同業PE',
       peDiscount: '同業折價',
     }
     ```
2. **`src/components/StockCard.vue`**：
   - 呈現股本規模：`股本 11.5 億`；若 `paidInCapital <= 30` 標註為輕型/波段彈性股。
   - 呈現估值優勢：`PE 19.5 (同業 32.4) 折 -40%`，具備顯著折價優勢時給予綠色估值保護標籤。

---

## 四、第三階段 (Phase 3)：月營收年增率 (MOPS API 擴充)

### 方案 1：月營收年增率（YoY Revenue Growth）

#### 【資料來源】
* **公開資訊觀測站 API (MOPS)**：每月 10 日彙總公告。
* **URL**：`https://mops.twse.com.tw/mops/web/ajax_t05st10_ifrs`（或證交所官方 OpenAPI 下載全市場彙總檔）。

#### 【後端 Claude 職責】
1. **`scripts/scrapers/mops.py`（新增模組）**：
   - 每月月初排程拉取上市/上櫃月營收彙總表，輸出為 `cache/revenue_latest.json`。
   - 欄位包含：當月營收、去年同期營收、去年同月增減 % (`revenueYoY`)、上月增減 % (`revenueMoM`)、資料月份 (`revenueLatestMonth`)。
2. **`scripts/writer.py`**：
   - 比對代號，寫入個股：
     ```json
     {
       "revenueYoY": 33.5,
       "revenueMoM": 8.3,
       "revenueLatestMonth": "2026-08"
     }
     ```

#### 【前端 Gemini 職責】
1. **`src/constants/ui-strings.js`**：
   - 定義字串：
     ```javascript
     REVENUE: {
       yoy: '營收年增',
       mom: '營收月增',
       monthSuffix: '月',
     }
     ```
2. **`src/components/StockCard.vue`**：
   - 呈現營收動能標籤：`營收年增 +33.5% (08月)`；年增率 > 20% 給予金色/亮色高亮徽章。

---

## 五、第四階段 (Phase 4)：篩選引擎評分與排序升級

### 【後端 Claude 職責】
1. **`src/engine/screener.js`**：
   - 在各模式（特別是「多頭回測」、「洗盤起漲」、「底部蓄勢」）之候選名單中，新增 `rankScore` 綜合評分加權：
     - **相對強弱度加分**：`relStrength5d > 0` 基礎加分，每 +1% 累加分數。
     - **籌碼集中趨勢加分**：`chipsTrend3d === 'UP'` 且 `chipsScore >= 3` 給予高額波段主力進駐加分。
     - **股本彈性加分**：`paidInCapital <= 30` 億給予小股本彈性加分；`> 100` 億微幅降權。
     - **估值保護加分**：`peDiscount <= -20%` 給予折價加分。
     - **營收催化劑加分**：`revenueYoY >= 20%` 優先加分。
   - 最終選出清單預設依照 `rankScore` 由大至小排序，使 4551 智伸科等具備全方位動能的標的自動置於卡片第一位。

---

## 六、資料合約標準 (Data Contract)

更新 `public/data/stock-pool.json` 的個股標準 Schema：

```typescript
interface StockPoolItem {
  code: string                  // 股票代號 (例: '4551')
  name: string                  // 股票名稱 (例: '智伸科')
  market: 'tse' | 'otc'         // 上市 / 上櫃
  
  // ── 新增：Phase 1 ──
  relStrength5d?: number        // 相對大盤近 5 日強弱度 % (例: 3.25)
  chipsTrend3d?: 'UP' | 'FLAT' | 'DOWN' // 近 3 日籌碼集中趨勢
  chipsScore?: number           // 籌碼連續集中天數 (例: 3)
  
  // ── 新增：Phase 2 ──
  paidInCapital?: number        // 實收資本額 (億元，例: 11.52)
  pe?: number                   // 個股本益比 (例: 19.52)
  industryPe?: number           // 同業平均本益比 (例: 32.39)
  peDiscount?: number           // 同業折溢價 % (例: -39.7)
  
  // ── 新增：Phase 3 ──
  revenueYoY?: number           // 最新月營收年增率 % (例: 33.5)
  revenueMoM?: number           // 最新月營收月增率 % (例: 8.3)
  revenueLatestMonth?: string   // 營收資料月份 (例: '2026-08')
  
  // ── 新增：Phase 4 ──
  rankScore?: number            // 模式綜合評分 (依分數高至低排序)
}
```

---

## 七、驗收與防禦標準 (Acceptance Criteria)

1. **零硬編碼數值**：所有股本、PE、營收必須來自即時爬蟲或標準快取，不可預寫死靜態數值。
2. **防爆防破防空值**：當某檔股票於 Fubon 基本資料頁或 MOPS 查無資料時，欄位應優雅保持 `null` 或 `undefined`，不得引發前端渲染報錯或 Python 腳本中斷。
3. **時光機歷史相容性**：時光機歷史切片回溯時，若歷史日無當時營收或同業 PE，UI 與評分邏輯應退回基準技術籌碼判斷，不產生未定義異常。
4. **Console 零錯誤**：瀏覽器 Console 不得有任何 NaN、undefined property 或 Vue warning。
5. **Git Push 嚴格管控**：全數改動僅允許 local commit，嚴禁自動 push，待使用者親自審閱回測表現後始得放行。
