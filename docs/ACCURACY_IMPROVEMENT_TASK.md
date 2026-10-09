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
     - 若僅有 1 日紀錄：`chipsTrend3d: 'NEW'`，`chipsScore: 1`（新進追蹤池）。
     - 其餘情況：`chipsTrend3d: 'FLAT'`，`chipsScore: 1`。
   - 寫入 `stock.chipsTrend3d` 與 `stock.chipsScore`，且時光機 `sliceStockAt` 支援歷史動態倒流重算。

#### 【前端 Gemini 職責】（✅ 已實作完成並驗證通過）
1. **`src/components/StockChipsSection.vue`**（籌碼透視子元件）：
   - **資料來源**：`props.stock.chipsTrend3d`（`'UP' | 'FLAT' | 'DOWN' | 'NEW' | null`）與 `props.stock.chipsScore`（`number | null`）。
   - **視覺呈現**：內嵌於「籌碼」主題詞後方括號內呈現定調，括號內文字統一加粗（`font-bold`），徹底消除手機端折行：
     - `UP` 且 `chipsScore === 3`：`籌碼 (集中 3)`（紅色 `font-bold text-rise`）。
     - `UP` 且 `chipsScore === 2`：`籌碼 (集中 2)`（紅色 `font-bold text-rise`）。
     - `NEW`（如 3339 泰谷）：`籌碼 (新進)`（次要色 `font-bold text-base-content/60`）。
     - `FLAT`：`籌碼 (持平)`（次要色 `font-bold text-base-content/60`）。
     - `DOWN`：`籌碼 (發散)`（弱勢色 `font-bold text-fall`）。
     - 若 `chips == null` 或無趨勢時自動降級顯示 `籌碼 1D +XX% ...`。

---

## 三、第二階段 (Phase 2)：基本面與同業估值擴充 (Fubon 爬蟲) 【後端已完成 ✅ 2026-10-09 / 待前端 Gemini 接手 ⏳】

### 方案 3（股本）& 方案 6（本益比折同業）

#### 【資料來源】
* **富邦個股基本資料網址**：`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zca/zca_{code}.djhtm`
* **頁面包含欄位**：
  * 「實收資本額」：例如 `股本(億, 台幣)` -> `11.52`。
  * 「本益比」：例如 `19.31`。
  * 「同業平均本益比」：例如 `33.19`。
  * 「收盤價」：頁面當時收盤價（例如 `184`）。

#### 【後端 Claude 職責】（✅ 已實作完成並驗證通過）
1. **`scripts/scrapers/fubon.py`**：
   - 實作 `fetch_stock_fundamentals(code: str) -> dict` 與 `batch_fetch_fundamentals(codes: List[str]) -> dict`。
   - 提取實收資本額（單位：億元，`paidInCapital`）。
   - 提取同業 PE（`industryPe`）。
   - 提取近 4 季 EPS 合計（Trailing EPS）：$\text{trailingEps} = \frac{\text{fubonPrice}}{\text{fubonPe}}$。
   - **快取架構設計 (`cache/fundamentals.json`)**：
     - **股本 TTL = 28 天**（約 4 週更新一次，依使用者規範）。
     - **同業 PE TTL = 7 天**（每週更新一次）。
     - 405 檔股票快取命中 100%，耗時 < 0.1s；新入池標的多執行緒 (10 workers) 自動補齊。
2. **`scripts/writer.py` 與 `scripts/main.py`**：
   - 每交易日自動根據個股最新盤後/盤中真實收盤價動態計算高頻本益比：
     $$\text{pe} = \text{round}\left(\frac{\text{todayPrice}}{\text{trailingEps}}, 2\right)$$
   - 計算同業折溢價 %：
     $$\text{peDiscount} = \text{round}\left(\frac{\text{pe} - \text{industryPe}}{\text{industryPe}} \times 100, 2\right)$$
   - 注入各個股物件：
     ```json
     {
       "paidInCapital": 11.52,
       "pe": 19.31,
       "industryPe": 33.19,
       "peDiscount": -41.82,
       "trailingEps": 9.5287
     }
     ```
   - 若虧損或無 PE（如台泥、中石化、生技股顯示 N/A），欄位安全返回 `null`。
3. **`src/engine/screener.js`**：
   - 時光機歷史切片回溯 `sliceStockAt` 支援歷史倒流重算：當回溯至歷史基準日，自動依該歷史日收盤價與 `trailingEps` 動態還原當時歷史 `pe` 與 `peDiscount`。
4. **`src/constants/ui-strings.js`**：
   - 新增 `FUNDAMENTALS` 字串字典。
5. **`.github/workflows/update-stock-pool.yml`**：
   - 將 `cache/fundamentals.json` 納入 commit 與 push，確保 GitHub Actions 保持快取溫暖。

#### 【前端 Gemini 職責】（⏳ 待 Gemini 實作）
1. **`src/components/StockCard.vue`**：
   - **股本規模展示**：
     - 若 `stock.paidInCapital` 存在，顯示股本規模（例如 `股本 11.5 億` 或 `11.5 億`）。
     - 若 `stock.paidInCapital <= 30`（億元），標註為「輕型股」波段爆發標籤。
   - **估值優勢展示**：
     - 若 `stock.pe` 存在且 `stock.industryPe` 存在：
       - 折價（`peDiscount < 0`，例如 `-41.8%`）：顯示 `折 -41.8%`，給予估值保護綠色 Badge。
       - 溢價（`peDiscount > 0`，例如 `+30.6%`）：顯示 `溢 +30.6%`。
     - 若 `stock.pe == null`：優雅隱藏或顯示 `PE --`，不引發破版。

---

## 四、第三階段 (Phase 3)：月營收年增率 (TWSE / TPEx OpenAPI 擴充) 【後端已完成 ✅ 2026-10-09 / 前端已完成 ✅ 2026-10-09】

### 方案 1：月營收年增率（YoY Revenue Growth）

#### 【資料來源】
* **證券交易所與櫃買中心官方 OpenAPI**：每月 10 日前強制公告。
* **URL**：
  * 上市：`https://openapi.twse.com.tw/v1/opendata/t187ap05_L`
  * 上櫃：`https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O`

#### 【後端 Claude 職責】（✅ 已實作完成並驗證通過）
1. **`scripts/scrapers/revenue.py`（新增模組）**：
   - 串接上市櫃雙 OpenAPI，全市場 1,978 檔月營收彙總，輸出為 `cache/revenue.json`（TTL = 7 天）。
   - 欄位包含：當月營收、去年同月增減 % (`revenueYoY`)、上月比較增減 % (`revenueMoM`)、資料月份 (`revenueLatestMonth`)。
2. **`scripts/writer.py` 與 `scripts/main.py`**：
   - 比對代號，寫入個股：
     ```json
     {
       "revenueYoY": 33.5,
       "revenueMoM": -2.81,
       "revenueLatestMonth": "2026-08"
     }
     ```
   - 股票池 516 檔覆蓋率達 99.6%（514 檔有效匹配）。
3. **`src/constants/ui-strings.js`**：
   - 新增 `REVENUE` 字典。
4. **`.github/workflows/update-stock-pool.yml`**：
   - 將 `cache/revenue.json` 納入 commit 與 push，維持 GitHub Actions 快取溫暖。

#### 【前端 Gemini 職責】（✅ 已實作完成並驗證通過）
1. **`src/components/StockFundamentalsSection.vue`**：
   - **資料來源**：`props.stock.revenueYoY`、`props.stock.revenueMoM`、`props.stock.revenueLatestMonth`。
   - **視覺呈現**：
     - 若 `stock.revenueYoY` 存在，在估值列下方渲染專屬「營收」資訊行：`營收 · 8月 · 年增 +33.5% (高成長) · 月增 -2.8%`。
     - 年增率（YoY）與月增率（MoM）數值加粗，正值紅字（`text-rise`）、負值綠字（`text-fall`）。
     - 年增率 ≥ 30% 給予微型紅色晶亮邊框 Badge `(高成長)`，強化選股催化劑可讀性。
     - 若無營收資料自動安全隱藏，不引發版面錯位。

---

## 五、第四階段 (Phase 4)：篩選引擎評分與排序升級 【後端已完成 ✅ 2026-10-09 / 前端已完成 ✅ 2026-10-09】

### 【後端 Claude 職責】（✅ 已實作完成並驗證通過）
1. **`src/engine/screener.js`**：
   - 實作純量化評分函式 `calculateRankScore(stock)`：
     - **總分公式**：$$\text{rankScore} = \text{Base}(40) + S_{\text{rev}}(15) + S_{\text{rs}}(15) + S_{\text{cap}}(12) + S_{\text{val}}(10) + S_{\text{chip}}(8)$$
     - **起跳分數 (40 分)**：通過策略型態篩選基準分。
     - **營收催化劑 ($S_{\text{rev}}$, 0 ~ 15 分)**：YoY $\ge +50\% \rightarrow 15$；$\ge +20\% \rightarrow 10$；$\ge +5\% \rightarrow 5$；$\ge -5\% \rightarrow 2$；$< -5\% \rightarrow 0$；MoM $\ge +10\%$ 額外 $+1$ 分（上限 15）。
     - **相對大盤強弱 ($S_{\text{rs}}$, 0 ~ 15 分)**：RS $\ge +10\% \rightarrow 15$；$0 < \text{RS} < +10\% \rightarrow \text{clamp}(3, 14, \text{round}(\text{RS} \times 1.2) + 3)$；$\ge -3\% \rightarrow 1$；$< -3\% \rightarrow 0$。
     - **股本規模 ($S_{\text{cap}}$, 0 ~ 12 分)**：$\le 15$ 億 $\rightarrow 12$；$\le 30$ 億 $\rightarrow 9$；$\le 60$ 億 $\rightarrow 6$；$\le 100$ 億 $\rightarrow 3$；$> 100$ 億 $\rightarrow 0$。
     - **估值保護 ($S_{\text{val}}$, 0 ~ 10 分)**：$\text{peDiscount} \le -30\% \rightarrow 10$；$\le -15\% \rightarrow 7$；$\le 0\% \rightarrow 4$；$\le 25\% \rightarrow 1$；$> 25\% \rightarrow 0$；無 PE 或虧損 $\rightarrow 0$。
     - **籌碼集中趨勢 ($S_{\text{chip}}$, 0 ~ 8 分)**：$\text{chipsScore} \ge 3 \rightarrow 8$；$= 2 \rightarrow 5$；$\text{FLAT/NEW} \rightarrow 2$；$\text{DOWN} \rightarrow 0$。
   - 時光機歷史切片回溯 `sliceStockAt` 支援歷史倒流重算，產出當時真實之 `rankScore` 與 `rankBreakdown`。
2. **`src/composables/useScreener.js`**：
   - 於 `screenerOutput` 計算各個股之 `rankScore` 與 `rankBreakdown`。
3. **`src/App.vue`**：
   - 監聽 `activeMode`：當切換至策略型態模式（Mode 1 ~ 5）時，自動將預設排序切換為 `sortKey = 'rankScore'`、`sortDir = 'desc'`（高分置頂）；切回 `ALL` 時還原為漲跌幅排序。
4. **`src/components/SearchBar.vue` 與 `src/components/StockTable.vue`**：
   - 排序選單新增「評分」按鈕（`rankScore`）。
   - `StockTable.vue` 之 `sortList` 支援 `rankScore` 排序，同分時以漲跌幅降冪作次要排序。
5. **`scripts/writer.py`**：
   - 實作 `_compute_rank_score`，使 `public/data/stock-pool.json` 原生包含 `rankScore` 與 `rankBreakdown`。
6. **`docs/INTERFACE_CONTRACT.md`**：
   - 增補第八節：綜合量化評分與細項拆解 UI 規格。

### 【前端 Gemini 職責】（✅ 已實作完成並驗證通過）
1. **`src/components/StockRankScoreSlot.vue`（新增獨立子元件）**：
   - **呈現位置**：於個股卡片底部的「符合『XX』選股條件」列下方（或緊鄰處），渲染獨立的評分摘要行。
   - **摘要行樣式**：
     - 顯示 `評分 81分：起跳40 · 營收+10 · RS+9 · 股本+12 · 估值+10 · 籌碼+0`。
     - 強調純文字加粗（`font-bold`），不依賴高飽和顏色，與卡片整體低調奢華風格完美融合。
     - 右側提供自然平滑之旋轉 SVG 箭頭指示展開/收合。
   - **就地展開細項目錄**：
     - 點擊切換就地展開 6 大維度（起跳、營收、RS、股本、估值、籌碼）實測清單。
     - 得分項帶清晰的粗體 `✓`，未得分項（0分）帶中性灰 `-`。
     - 每一項清晰揭示 `得分/滿分` 與實測條件文字 `desc`。
     - 支援雙向折疊收合，完全 mobile-first 零破版，所有文字集中於 `ui-strings.js`。
2. **`src/components/StockCard.vue`**：
   - 同步於手機端佈局與電腦端 3 欄佈局完整掛載 `StockRankScoreSlot.vue`。

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
