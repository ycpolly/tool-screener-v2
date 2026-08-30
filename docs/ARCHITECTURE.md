# tool-screener-v2 架構設計文件

> 本文件記錄 v2 重構的所有設計決策與架構規範。開工前確認，開工後作為 reference。
> **最後更新：2026-08-30**（實作 Phase 3 三大選股模式、均線支撐、三線糾結與乖離率篩選演算法）

---

## 一、產品定位與核心原則

### 產品目的
台股波段選股工具，個人使用，部署於 GitHub Pages (`ycpolly.github.io/tool-screener-v2`)。

**使用情境：**
- **盤中**：看到即時行情（價格、均線、KD、量能），掌握盤面動態
- **尾盤**：根據參數條件（或手動勾選）找出合適的波段進場標的

### 核心優先順序
1. **資料正確性**（第一優先）— 金融產品，任何數字錯誤都是不可接受的
2. **UX / 快速找到資料**（第二優先）— mobile-first，盤中看手機為主
3. **架構可維護性**（持續目標）— 增刪功能不破壞現有功能，避免「改 A 壞 B」

### 設計原則（繼承自 v1 AGENTS.md，並強化）
- **嚴禁硬編碼**：所有數值、文字從資料源動態取得
- **嚴禁靜態舊資料補洞**：資料要即時，缺的就缺，不用舊的頂
- **處置股務必即時**：每次更新都從 TWSE/TPEx 官方 API 即時拉取
- **UI 文字集中管理**：統一在 `ui-strings.js`，零硬編碼殘留
- **Minimal & Clean UI**：investing.com 風格，低飽和，只有漲跌帶紅綠

---

## 二、技術選型

| 層次 | 技術 | 理由 |
| :--- | :--- | :--- |
| 打包工具 | **Vite** | 快速 HMR、模組化、GitHub Pages 部署友善 |
| 前端框架 | **Vue 3** | 資料驅動 UI，雙模式切換/參數聯動不用手動操作 DOM |
| UI 元件 | **DaisyUI** (Tailwind CSS) | 內建 light/dark theme 切換，mobile-first 原生支援 |
| 樣式策略 | **Mobile-first** | 無前綴 = 手機基礎樣式，`md:` / `lg:` 往上疊加桌機樣式 |
| 初始 Theme | `nord`（Light）+ `business`（Dark）| investing.com 風格，低飽和，可隨時更換 |
| 後端腳本 | **Python 3**（模組化重寫）| 爬蟲 + 指標計算，GitHub Actions 定時觸發 |
| 資料格式 | **JSON**（取代 v1 的 .js）| Python 與前端完全解耦，不再用 regex 改寫 JS |

---

## 三、目錄結構

```
tool-screener-v2/
│
├── .github/workflows/
│   ├── update-stock-pool.yml   ← 爬蟲機器人（平日 15:30 / 18:30 / 23:00）
│   └── deploy.yml              ← npm run build → GitHub Pages 部署
│
├── scripts/                    ← Python 後端（模組化）
│   ├── scrapers/
│   │   ├── __init__.py
│   │   ├── moneydj.py          ← 0050 / 0051 成分股（MoneyDJ）
│   │   ├── fubon.py            ← 富邦 DJ 全部 28 個 URL
│   │   ├── disposed.py         ← TWSE / TPEx 處置股官方 API
│   │   └── yahoo.py            ← Yahoo Finance 3個月日K 原始抓取
│   ├── engine/
│   │   ├── indicators.py       ← 純計算：MA / KD / Sparkline / 爆量（無 I/O）
│   │   ├── calibration.py      ← TWSE MIS 收盤價校正（v1 有 bug，重寫）
│   │   └── market_regime.py    ← 大盤風控燈號判定（SAFE / CAUTION / DANGER）
│   ├── writer.py               ← 唯一負責寫 stock-pool.json 的模組
│   └── main.py                 ← 主流程編排（只做 orchestration，不含業務邏輯）
│
├── public/
│   └── data/
│       └── stock-pool.json     ← 爬蟲每日更新輸出，前端用 fetch() 載入
│
├── src/                        ← Vue 3 前端
│   ├── main.js                 ← Vue app 進入點
│   ├── App.vue                 ← 根元件
│   ├── assets/css/
│   │   └── main.css            ← CSS 變數（漲跌色、字型 token 等）
│   ├── components/
│   │   ├── MarketBanner.vue    ← 大盤多空風控橫幅（TAIEX / OTC 燈號）
│   │   ├── ScreenerPanel.vue   ← 篩選參數面板（支援多模式擴充）
│   │   ├── StockTable.vue      ← 主選股結果表格（手機單欄 / 桌機多欄）
│   │   ├── StockRow.vue        ← 單筆個股列
│   │   ├── Sparkline.vue       ← 10日走勢圖（K棒 + 均線 + KD）
│   │   └── modals/
│   │       ├── RiskModal.vue   ← 空間與風控全貌（天花板/支撐/風報比）
│   │       └── AvoidModal.vue  ← 避雷區（法人/主力/投信 賣超）
│   ├── composables/
│   │   ├── useStockPool.js     ← 載入與快取 stock-pool.json
│   │   ├── useScreener.js      ← 篩選邏輯（呼叫 engine，不碰 DOM）
│   │   └── useRealtimeQuotes.js← GCP 即時行情（富果 API + TWSE MIS fallback）
│   ├── engine/
│   │   └── screener.js         ← 純演算法引擎（零 DOM，純函式：輸入資料 → 輸出結果）
│   └── constants/
│       └── ui-strings.js       ← 所有 UI 文字，零硬編碼殘留
│
├── index.html
├── vite.config.js
└── package.json
```

---

## 四、資料格式設計（Data Contract）

Python 輸出 → `public/data/stock-pool.json`

```json
{
  "meta": {
    "updatedAt": "2026-08-25T15:30:00+08:00",
    "totalStocks": 264
  },

  "stocks": [
    {
      "code": "2330",
      "name": "台積電",
      "market": "tse",
      "categories": ["0050", "ForeignBuy1D", "半導體"],
      "isDisposed": false,
      "price": 980.0,
      "prevClose": 975.0,
      "open": 976.0,
      "high": 985.0,
      "low": 974.0,
      "volume": 28340,
      "ma5": 972.4,
      "ma10": 965.1,
      "ma20": 958.3,
      "ma60": 920.0,
      "vMa5": 25000,
      "vMa10": 23000,
      "maxVol10d": 45000,
      "hasVolumeBurst": false,
      "high5d": 990.0,
      "high10d": 1005.0,
      "high20d": 1020.0,
      "low5d": 960.0,
      "low10d": 945.0,
      "low20d": 920.0,
      "kd": {
        "k": 58.3,
        "d": 54.1,
        "prevK": 55.0,
        "prevD": 53.2,
        "h8": 995.0,
        "l8": 950.0
      },
      "sparkline": [955, 960, 968, 972, 975, 970, 978, 982, 975, 980],
      "history10d": [
        {
          "open": 960.0, "high": 968.0, "low": 955.0, "close": 955.0,
          "prevClose": 962.0, "volume": 24000, "ma5": 958.0, "ma10": 952.0,
          "k": 42.1, "d": 45.3
        }
      ]
    }
  ],

  "rankings": {
    "holdings0050":  { "date": "2026/08/23", "sourceUrl": "...", "stocks": [] },
    "holdings0051":  { "date": "2026/08/23", "sourceUrl": "...", "stocks": [] },
    "top100Volume":  { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "valueTop":      { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "sitcaBuy3D":    { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "sitcaBuy5D":    { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "foreignBuy1D":  { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "foreignBuy3D":  { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "majorBuy1D":    { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "majorBuy3D":    { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "turnoverRate":  { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "foreignSell":   { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "majorSell":     { "date": "08/25", "sourceUrl": "...", "stocks": [] },
    "sitcaSell":     { "date": "08/25", "sourceUrl": "...", "stocks": [] }
  },

  "market": {
    "taiex": {
      "name": "加權指數",
      "price": 22350.4,
      "prevClose": 22100.0,
      "changePrice": 250.4,
      "changePct": 1.13,
      "ma5": 22100.0,
      "ma10": 21900.0,
      "ma20": 21800.0,
      "bias20": 2.52,
      "statusDesc": "多頭強勢攻擊 (+1.13%)",
      "kd": { "k": 72.4, "d": 65.1, "prevK": 68.0, "prevD": 63.5, "status": "中檔震盪" }
    },
    "otc": {
      "name": "櫃買指數",
      "price": 230.5,
      "prevClose": 228.0,
      "changePrice": 2.5,
      "changePct": 1.10,
      "ma5": 228.0,
      "ma10": 226.0,
      "ma20": 225.0,
      "bias20": 2.44,
      "statusDesc": "多頭強勢攻擊 (+1.10%)",
      "kd": { "k": 68.2, "d": 62.0, "prevK": 64.0, "prevD": 60.5, "status": "中檔震盪" }
    },
    "regime": {
      "code": "SAFE",
      "badge": "多頭順風",
      "title": "系統總風控判定：市場多頭順風",
      "subtitle": "加權與櫃買結構健康，多頭均線排列。"
    }
  }
}
```

### 重要 Data Contract 規範

- `market` 欄位統一使用英文 `"tse"` / `"otc"`，不使用 `"上市"` / `"上櫃"`（解決 v1 `calibrate_with_twse_mis()` 的市場判斷 bug）
- `categories` 為字串陣列，前端篩選與 badge 顯示的唯一依據
- `isDisposed` 每次更新必須即時從官方 API 重新拉取，嚴禁沿用上次結果
- `history10d` 的長度保證為 10 筆（不足時用最早一筆補齊，前端不需防守）

---

## 五、Python 後端重構規範

### 架構原則
```
collect  →  enrich  →  write
（抓）       （算）      （存）
```
三個階段嚴格分離，`main.py` 只負責呼叫這三個函式，不含任何業務邏輯。

### 各模組職責

| 模組 | 職責 | 不能做的事 |
| :--- | :--- | :--- |
| `scrapers/*.py` | HTTP 連線、解析 HTML/JSON | 計算任何技術指標 |
| `engine/indicators.py` | 純計算 MA/KD/Sparkline | 任何 I/O、HTTP |
| `engine/calibration.py` | TWSE MIS 校正收盤價（重寫）| 計算指標 |
| `engine/market_regime.py` | 大盤燈號判定 | 任何 I/O |
| `writer.py` | 寫入 JSON | 任何計算或抓取 |

### calibrate_with_twse_mis() 重寫要點
- `market` 判斷改用 `"tse"` / `"otc"` 英文 key，不再用中文字串比對
- 明確區分 `z`（成交價）vs `y`（昨收）：`z` 為 `-` 時代表未成交，不可用 `pz` 替代
- 每筆校正結果強制 log 輸出，方便驗證
- 盤後 `z` 確定有值時才更新，否則保留 Yahoo 原始收盤價

### 沿用函式（邏輯正確，不重寫）
- `fetch_moneydj_etf_holdings()`
- `fetch_fubon_top50()` / `fetch_fubon_buy_rank()` / `fetch_fubon_value_rank()` / `fetch_fubon_turnover_rank()`
- `fetch_disposed_stock_codes()`
- `fetch_yahoo_stock()` → 拆為 `fetch_raw_ohlcv()` + `engine/indicators.py`
- `fetch_market_indices()` + `evaluate_regime()`
- `is_valid_stock_code()` / `decode_fubon_html()`

### 富邦 DJ 28 個 URL 清單

| 分類 | 上市 endpoint | 上櫃 endpoint |
| :--- | :--- | :--- |
| 量大排行 | `zg_BE_0_1` | `zg_BE_1_1` |
| 值大排行 | `ZG_CD` | `zg_CD_1` |
| 週轉率 | `ZG_BD` | `zg_BD_1_0` |
| 投信買超 3D | `zg_DD_0_3` | `zg_DD_1_3` |
| 投信買超 5D | `zg_DD_0_5` | `zg_DD_1_5` |
| 外資買超 1D | `zg_D_0_1` | `zg_D_1_1` |
| 外資買超 3D | `zg_D_0_3` | `zg_D_1_3` |
| 主力買超 1D | `zg_F_0_1` | `zg_F_1_1` |
| 主力買超 3D | `zg_F_0_3` | `zg_F_1_3` |
| 外資賣超 1D | `zg_DA_0_1` | `zg_DA_1_1` |
| 外資賣超 3D | `zg_DA_0_3` | `zg_DA_1_3` |
| 主力賣超 1D | `zg_FA_0_1` | `zg_FA_1_1` |
| 主力賣超 3D | `zg_FA_0_3` | `zg_FA_1_3` |
| 投信賣超 3D | `zg_DE_0_3` | `zg_DE_1_3` |

---

## 六、前端架構規範

### 核心設計：純演算法引擎與 UI 完全分離

```
stock-pool.json  ─→  useStockPool.js   ← 資料載入層
                          ↓
GCP 即時行情    ─→  useRealtimeQuotes.js ← 即時更新層
                          ↓
                      useScreener.js    ← 篩選邏輯層（呼叫 engine）
                          ↓
                      screener.js       ← 純演算法引擎（零 DOM、純函式）
                          ↓
                      Vue Components    ← UI 渲染層（只讀資料，不算數學）
```

**`screener.js` 純引擎規範：**
- 輸入：股票資料陣列 + 篩選條件物件
- 輸出：篩選結果陣列
- 禁止：任何 `document.getElementById`、`innerHTML`、DOM 操作
- 可測試：直接 `node screener.js` 驗算結果

### 選股模式擴充設計

模式採設定物件方式定義，新增模式不需修改核心引擎：

```javascript
// src/constants/screener-modes.js
export const SCREENER_MODES = {
  BOTTOM_CONSOLIDATION: {
    id: 'BOTTOM_CONSOLIDATION',
    label: '底部蓄勢',
    description: '尋找籌碼乾淨、極致壓縮股（參與 D1-D3）',
    defaultParams: { maAboveMode: 'BOTH', checkConvergence: true, convergenceMax: 3.0, bias5Min: -2.0, bias5Max: 3.0, bias20Min: 0.0, bias20Max: 8.0 }
  },
  TREND_PULLBACK: {
    id: 'TREND_PULLBACK',
    label: '多頭回測',
    description: '多頭趨勢中，量縮拉回找支撐的強勢中繼股',
    defaultParams: { maAboveMode: 'ANY', checkConvergence: true, convergenceMax: 8.0, bias5Min: -3.0, bias5Max: 2.0, bias20Min: 2.0, bias20Max: 12.0, requireMa20Rising: true }
  },
  MOMENTUM_BREAKOUT: {
    id: 'MOMENTUM_BREAKOUT',
    label: '動能攻擊',
    description: '剛結束打底、今日帶量出第一根紅棒的發動股（參與 D4）',
    defaultParams: { maAboveMode: 'BOTH', checkConvergence: true, convergenceMax: 8.0, checkPrevConvergence: true, prevConvergenceMax: 3.0, bias5Min: 0.0, bias5Max: 8.0, bias20Min: 0.0, bias20Max: 12.0 }
  }
}
```


### Mobile-First 樣式策略

```html
<!-- 基礎樣式 = 手機（無前綴）-->
<!-- md: = 768px 以上 (平板) -->
<!-- lg: = 1024px 以上 (桌機) -->

<!-- 例：手機單欄顯示，桌機多欄 -->
<div class="flex flex-col lg:flex-row gap-4">

<!-- 例：手機隱藏次要資訊，桌機顯示 -->
<td class="hidden lg:table-cell">週轉率</td>
```

### Light / Dark 切換

```javascript
// 一行切換，全站自動更新
document.documentElement.setAttribute('data-theme', isDark ? 'business' : 'nord')
```

### 即時行情架構（GCP + Fallback）

```
前端觸發即時更新
  ↓
GCP Cloud Function（富果 API）→ 前 60 檔極速連線
  ↓（若 429 或超時）
TWSE MIS 批次 API → 補齊剩餘股票
  ↓
localStorage 快取（CACHED_REALTIME_QUOTES）
  ↓
useRealtimeQuotes 合體 → screener.js 重算指標 → Vue 自動更新畫面
```

---

## 七、建構階段規劃（Phase）

> **分工原則**：Claude 負責 Python 後端、邏輯層（engine/composables）；Gemini 負責 UI 元件（src/components/）。
> 詳細 Props/Events 規格見 `docs/INTERFACE_CONTRACT.md`。

### Phase 1（核心基礎）
- [x] v2 專案骨架建立（Vite + Vue 3 + DaisyUI）— 完成 2026-08-25
- [x] 資料轉換腳本（v1 JS → v2 JSON）— 完成 2026-08-25
- [x] `src/engine/screener.js` 骨架 — 完成 2026-08-25
- [x] `src/composables/` 三層架構骨架 — 完成 2026-08-25
- [x] `src/constants/screener-modes.js`、`ui-strings.js` — 完成 2026-08-25
- [x] `docs/INTERFACE_CONTRACT.md`（Claude/Gemini 分工契約）— 完成 2026-08-26
- [x] Python 腳本模組化重寫（scripts/ 全部）— 完成 2026-08-26
- [x] `calibrate_with_twse_mis()` 重寫與驗證 — 完成 2026-08-26
- [x] `stock-pool.json` 與 v1 輸出比對確認正確 — 完成 2026-08-26
  - 323 檔個股，685.5 KB，全部格式驗證通過（sparkline ≥ 5，history10d = 10）
  - market 欄位全部為 tse/otc，舊中文格式 0 筆
- [x] GitHub Actions：爬蟲機器人 + 前端部署 — 完成 2026-08-26
- [x] GCP 即時行情接入（更新 useRealtimeQuotes、合體重算、雙軌 URL 管理與嚴格資料完整性檢查）— 完成 2026-08-27

### Phase 2（UI + 核心 UX）— 由 Gemini 完成（2026-08-27 優化）
- [x] MarketBanner.vue（大盤風控橫幅，支援 SAFE/CAUTION/DANGER 色彩適配與加權/櫃買數據）
- [x] ScreenerPanel.vue（選股模式與微調面板：方案 A 頂部 4 大分段 Tabs「全部 + 3 大策略」內建即時檔數 Badge、常駐戰略提示與摘要列、兩大業務模組【均線與位階】與【量能與流動性】、標準 36px 等高行系統、180ms 數字防抖、Neutral 質感自訂標記與一鍵重設、手機單欄/電腦雙欄響應式佈局）
- [x] StockCard.vue（自適應個股卡片：字體全面導入 Open Sans + tabular-nums、代號/名稱/現價統一 18px、標籤區純文字呈現屬性與 ⚠️ 法人/主力賣超警示標籤、均線乖離加粗、KD 與走勢圖水平置中、均線/量能網格加大間距 gap-6、電腦端走勢圖置左、無彩噪、快捷列複製反饋、槽位 A 關卡與槽位 B 方案 1 策略命中/淘汰原因摘要條）
- [x] SearchBar.vue（即時個股搜尋與排序工具列：位於 ScreenerPanel 與 StockTable 之間，左側支援代號/名稱雙向模糊搜尋與一鍵清除，右側整合方案 A 攤開式膠囊排序按鈕組【漲跌幅/成交量/月乖離/代號】雙向升降切換，電腦端左右並排、手機端上下排列）
- [x] StockTable.vue（選股結果列表容器，支援「符合 N 檔」右側即時模式放寬探索建議、純淨 Empty State、下方可折疊「未符合個股與淘汰原因」清單、搜尋跨區直出與 Skeleton 載入骨架）
- [x] Sparkline.vue（純向量 SVG 三層式走勢圖：10 根 K 棒 + 5MA/10MA 雙折線 + 10 根成交量柱與 MV5 基準線爆量標記 + 10 日 KD 折線與 50 基準線、智慧防重疊演算法、色彩 Token 化、缺少歷史資料時主動 console.warn）
- [x] ThemeToggle.vue（Light/Dark 切換：DaisyUI cupcake 暖白與 dracula 吸血鬼暗紫主題切換，全站最小字體全面升級至 text-sm 14px，提升文字對比度至 80%）
- [x] 頂部 Navbar 與 API 設定 Modal 按鈕全面統一 DaisyUI 原生規格（高對比易讀 btn-neutral、鑰匙 SVG 圖示）
- [x] Navbar 標題小字版號（純文字無底色/無 Badge，點擊觸發頁面強制重載避免快取，命名規範 `vMMDD.NN`）
- [x] UI 字串對照（`src/constants/ui-strings.js`：補齊 `ForeignBuy`、`MajorBuy`、`SitcaBuy` 等所有分類標籤繁體中文對照）
- [x] App.vue 接入上述所有元件並完成響應式組裝

### Phase 3（完整功能）
- [x] 三大選股模式定義（底部蓄勢、多頭回測、動能攻擊）— 完成 2026-08-30
- [x] `screener.js` 核心均線演算法（5MA/10MA 支撐、當日/前一日三線糾結度、5MA/20MA 乖離率、Mode 2 月線向上底層條件、Mode 1 季線防身 requireAboveMa60）— 完成 2026-08-30
- [x] 量能與流動性濾網（成交量門檻、排除處置股、Mode 1 狹幅震盪打底 ±1.5%、量縮回踩、昨日量縮、帶量攻擊、實體攻擊紅 K、排除長黑倒貨/長上影線避雷針、KD 區間與多頭排列）— 完成 2026-08-30
- [x] 全市場時光機回測引擎（支援近 0~5 個交易日歷史切片 `sliceStockAt`、動態推算歷史 `vMa5` 與 `history10d` 內建 `ma60` 季線）— 完成 2026-08-31
- [ ] RiskModal（空間與風控全貌）
- [ ] AvoidModal（避雷區，法人賣超）
- [ ] 個股快捷連結（籌碼/多空/資券/盤後）
- [ ] 手機端細節優化
- [ ] 壓力天花板與扣除稅費預期純利（calculateCeilingProfit）

### 待辦與後端修正清單（Claude 負責）
- [x] **修復個股中文名稱缺漏（175 檔個股 `name == code`）**：Claude 於 2026-08-27 已完成修復，各排行股票皆正確帶出中文名稱。
- [x] **在 `history10d` 補上近 10 日月線（`ma20`）**：已於 2026-08-27 完成，在 `scripts/engine/indicators.py` 加入 `'ma20': calc_sma(sub, 20)`，為前端 Sparkline 提供完整 10 日 MA20 序列。
- [x] **在 `history10d` 補上近 10 日季線（`ma60`）**：已於 2026-08-31 完成，在 `scripts/engine/indicators.py` 加入 `'ma60': calc_sma(sub, 60)`，為時光機歷史回測提供完整 10 日 MA60 序列。


---

## 八、與 v1 的對照（避免重蹈覆轍）

| v1 問題 | v2 解決方案 |
| :--- | :--- |
| `app.js` 115KB 一個檔案包辦所有事 | 拆為 composables + engine + components |
| `update_const_block()` 用 regex 改 JS | 輸出純 JSON，完全解耦 |
| `market: '上市'` 中文字串比對導致 bug | 改用 `market: 'tse'` 英文 key |
| 選股參數與 DOM 操作混在一起 | Vue 3 reactive，資料改畫面自動更新 |
| Desktop-first，手機體驗差 | Mobile-first，從手機出發往上延伸 |
| 功能邊做邊加，格式邊改邊疊 | Data Contract 先定好，再開始實作 |
