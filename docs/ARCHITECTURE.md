# tool-screener-v2 架構設計文件

> 本文件記錄 v2 重構的所有設計決策與架構規範。開工前確認，開工後作為 reference。
> **最後更新：2026-09-05**（完成五大模式選股快照 Screener Snapshot、清單簡約模式切換、手機端分段切換器雙行垂直排列與 SearchBar 等高 40px 優化）

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
- `history10d` 的長度保證為 10~20 筆（不足時用最早一筆補齊，前端不需防守）
- `chipsHistory` 為字典結構（`{ [YYYY-MM-DD]: { categories: string[], chips: Object } }`），由後端 `writer.py` 每日自動累積保留近 10 個交易日快照，供前端 `sliceStockAt` 時光機還原真實歷史籌碼與避雷標籤

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
  BOTTOM_REVERSAL: {
    id: 'BOTTOM_REVERSAL',
    label: '跌深反轉',
    description: '空頭超賣區爆量收紅，V型反轉發動日',
    defaultParams: { maAboveMode: 'NONE', bias5Min: -5.0, bias5Max: 5.0, bias20Min: -30.0, bias20Max: -2.0, requireAboveMa60: false, requireMa20Rising: false, minVolume: 1000, checkVolExpansion: true, checkRedCandle: true, minRedCandleChangePct: 2.0, checkAvoidLongUpperShadow: true, checkKd: true, kdKMin: 10, kdKMax: 40, kdRequireCross: true }
  },
  BOTTOM_CONSOLIDATION: {
    id: 'BOTTOM_CONSOLIDATION',
    label: '底部蓄勢',
    description: '尋找籌碼乾淨、極致壓縮股（參與 D1-D3）',
    defaultParams: { maAboveMode: 'BOTH', checkConvergence: true, convergenceMax: 3.0, bias5Min: -2.0, bias5Max: 3.0, bias20Min: 0.0, bias20Max: 8.0, requireAboveMa60: true }
  },
  MOMENTUM_BREAKOUT: {
    id: 'MOMENTUM_BREAKOUT',
    label: '動能攻擊',
    description: '剛結束打底、今日帶量出第一根紅棒的發動股（參與 D4）',
    defaultParams: { maAboveMode: 'BOTH', checkConvergence: true, convergenceMax: 8.0, checkPrevConvergence: true, prevConvergenceMax: 3.0, bias5Min: 0.0, bias5Max: 8.0, bias20Min: 0.0, bias20Max: 12.0 }
  },
  TREND_PULLBACK: {
    id: 'TREND_PULLBACK',
    label: '多頭回測',
    description: '多頭趨勢中，量縮拉回找支撐的強勢中繼股',
    defaultParams: { maAboveMode: 'ANY', checkConvergence: true, convergenceMax: 8.0, bias5Min: -3.0, bias5Max: 2.0, bias20Min: 2.0, bias20Max: 12.0, requireMa20Rising: true }
  },
  WASHOUT_IGNITION: {
    id: 'WASHOUT_IGNITION',
    label: '洗盤起漲',
    description: '趨勢多頭、指標降溫後再度帶量攻擊起漲',
    defaultParams: { maAboveMode: 'BOTH', bias5Min: 0.0, bias5Max: 8.0, bias20Min: 2.0, bias20Max: 20.0, requireMa20Rising: true, minVolume: 1000, checkVolExpansion: true, checkRedCandle: true, minRedCandleChangePct: 2.0, checkAvoidLongUpperShadow: true, checkKd: true, kdKMin: 30, kdKMax: 65, kdRequireCross: true }
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
- [x] TimeMachineBar.vue（全市場時光機切換列：方案 1 攤開式時光膠囊，自動推算近 5 個真實交易日日期【今日/8月28日/8月27日...】，點擊 1 步切換歷史回測，支援倒流中琥珀色警示橫幅與一鍵重設回到最新）
- [x] ScreenerPanel.vue（選股模式與微調面板：內嵌頂部 TimeMachineBar 時光機、方案 A 頂部 4 大分段 Tabs「全部 + 3 大策略」內建即時檔數 Badge、常駐戰略提示與摘要列、兩大業務模組【均線與位階】與【量能與流動性】、標準 36px 等高行系統、180ms 數字防抖、Neutral 質感自訂標記與一鍵重設、手機單欄/電腦雙欄響應式佈局）
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
- [x] 五大選股模式定義（底部蓄勢、多頭回測、動能攻擊、洗盤起漲、跌深反轉）— 完成 2026-08-31
- [x] `screener.js` 核心均線演算法（5MA/10MA 支撐、當日/前一日三線糾結度、5MA/20MA 乖離率、Mode 2 & Mode 4 月線向上底層條件、Mode 1 季線防身 requireAboveMa60）— 完成 2026-08-31
- [x] 量能與流動性濾網（成交量門檻、排除處置股、Mode 1 狹幅震盪打底 ±1.5%、量縮回踩、昨日量縮、帶量攻擊、實體攻擊紅 K、排除長黑倒貨/長上影線避雷針、KD 區間與多頭排列）— 完成 2026-08-30
- [x] 全市場時光機回測引擎（支援近 0~5 個交易日歷史切片 `sliceStockAt`、開盤交易日 `isLiveTradingDay` 智慧即時與歷史對位、動態推算歷史 `vMa5/10`、歷史 `high5d/10d/20d`、歷史 `low5d/10d/20d` 與嚴格未來資料截斷）— 完成 2026-08-31
- [x] 盤中動態指標引擎與 Sparkline 實時同步（即時重算 MA5/10/20、MV5/10、乖離率、KD、漲停紅底白字/跌停綠底白字、Sparkline 動態注入第 10 根即時 K 棒）— 完成 2026-08-31




### Phase 4（進階籌碼與短沖避雷、卡片診斷重構）
- [x] 1D / 3D / 5D 籌碼集中度爬蟲模組（`scripts/scrapers/chips.py`，支援多執行緒平行爬取與歷史交易日自訂區間計算）— 完成 2026-08-31
- [x] 知名短沖 / 隔日沖主力分點自動辨識名冊（凱基台北、凱基松山、富邦建國、元大土城永寧、高盛、瑞銀、摩根士丹利、美林等）— 完成 2026-08-31
- [x] 後端兩波流更新排程（16:38 第一批選股名單與大盤燈號更新；18:42 第二批券商分點出爐，注入籌碼集中度與短沖避雷數據，避開整點尖峰提前上線）— 完成 2026-08-31（2026-09-03 優化為零散時間）
- [x] StockCard UI 集中度標籤與短沖避雷警示列渲染（手機/電腦雙端響應式，已移除驚嘆號回歸純文字流）— 完成 2026-08-31
- [x] 五大選股模式籌碼避雷濾網（`excludeSell3D` / `excludeSell1D`）與 0050 土洋對作豁免機制（0050 且外資主力雙買 3D 時豁免投信被動賣壓）— 完成 2026-08-31
- [x] 五大選股模式「一鍵精選（嚴格限縮）」開關（`premiumParams`，包含 2000 張熱門股、三線極致糾結 2%、AND 雙重量縮真空、實體紅 K ≥ 3.5% 等頂級量化參數）— 完成 2026-08-31
- [x] StockCard 槽位 B 篩選評估理由「就地向下展開診斷清單」（支援符合與未符合雙向 `✓`/`✗` 明細與實測量化數值，一鍵收合，無 Modal 遮擋）— 完成 2026-08-31
- [x] StockCard 技術指標與排版重構（KD 動能指標整合至 MA/MV 底列形成完整指標看板，Sparkline 走勢圖獨立展示；電腦端改為 3/5/4 寬裕比例；全站按鈕移除陰影回歸乾淨純扁平）— 完成 2026-08-31
- [x] StockPoolModal.vue（選股池來源總覽 Modal：整合 17 大富邦 DJ / MoneyDJ / 證交所爬蟲端點、大類與來源雙層 Tab 切換、直式 v1 對帳表格由上至下嚴格保留 `#1`~`#N` 爬蟲順序、完整顯示買賣超張數與數值、點擊股票直連主畫面篩選）— 完成 2026-08-31
- [x] chipsHistory 籌碼與標籤時光機快照累積機制（後端 `writer.py` 自動延續保存近 10 個交易日之真實 `categories` 與 `chips`，前端 `sliceStockAt` 時光機切換時同步還原歷史籌碼、短沖名單與避雷標籤）— 完成 2026-09-01
- [x] 盤前交易日狀態機邊界修復（`isLiveTradingDay` 與 `App.vue` 納入上午 09:00 前之盤前狀態，盤前 00:00~08:59 嚴格以昨晚盤後為基準，時光機與頂部狀態列不偷跑顯示今日盤中）— 完成 2026-09-03
- [x] 策略展開診斷清單關鍵風控項補齊（`diagnoseStock` 補齊「長黑避雷 checkAvoidLongBlack」、「當日避雷 excludeSell1D」、「昨日量縮 checkPrevVolContraction」，確保未符合時清單能 100% 精準對應紅字 ✗ 淘汰理由）— 完成 2026-09-03
- [x] StockCard 未達標摘要與診斷清單體驗優化（未符合外層預覽改為彙整「N 項未達標：未站穩 5MA · 成交量不足」全條件概覽；籌碼集中度正值紅字高亮；展開診斷標籤冒號改全形「：」；移除容器 select-none 徹底釋放滑鼠反藍選取與右鍵複製文字權限；診斷指標項目全面收錄於 `UI_STRINGS.DIAGNOSIS_LABELS` 實現單一來源維護）— 完成 2026-09-03
- [x] 全市場五大模式選股快照（Screener Snapshot：純前端 5ms 高效批次運算，一鍵複製一般篩選與一鍵精選五大策略純文字清單；支援 iOS Safari / Android 原生 Web Share API 直通 LINE 分享面板與桌機剪貼簿自動自適應降級、自帶複製時間與資料時間雙時間戳記、平盤 `(0、平盤)` 標註、第二級 UI `btn-outline btn-neutral` 按鈕、綠色打勾微動效與 Toast 提示）— 完成 2026-09-05
- [x] 選股清單顯示模式切換（Display Mode Toggle：SearchBar 右側整合 Icon Toggle 按鈕，支援完整卡片與簡約模式 Compact Mode 流暢切換；簡約模式僅收納首行即時報價與槽位 B 篩選評估理由，卡片內距緊縮為 py-2.5 px-3.5，同時保留槽位 B 就地展開指標診斷功能，同步作用於符合與未符合名單，並以 localStorage 持久化偏好習慣）— 完成 2026-09-05
- [x] 手機端 UI 精緻化對齊（Mobile UI Polish：ScreenerPanel 頂部 6 大分段切換器在手機端全面改採 `flex-col` 固定兩行排列【上層標籤、下層 (數量)】，徹底根除字元寬度差異導致的參差高低折行，電腦端維持單行橫排；SearchBar 搜尋輸入框與排序/模式按鈕統一調升為 h-10 40px 標準高度，內部 input 填滿 h-full，解決手機端搜尋列視覺過於扁平問題並確保按鈕觸控高度 100% 對齊）— 完成 2026-09-05
- [x] UI 視覺與層級第二波優化（處置標籤改採低飽和漲價磚紅 `text-rise` 替換刺眼亮紅 `text-error`；移除時光機前綴文字與時鐘圖示釋出全寬；時光機按鈕日期規格化為補零 `MM/DD 週W (盤後)/(T-N)`；更新時間列格式精簡為 `YY/MM/DD 週W HH:mm`；手機端主要字級由 `text-xs` 收斂至 `text-sm` 14px，統一時間戳記、更新按鈕與 Tab 數量顯示）— 完成 2026-09-05
- [x] UI 視覺與層級第三波優化（資料時間戳記保留盤前/盤中/收盤/盤後中文前綴，格式為 `盤後 26/09/04 週五 22:34`；五大模式名稱、標籤與戰略說明集中收斂至 `src/constants/ui-strings.js` 之 `UI_STRINGS.SCREENER_MODES`，徹底杜絕分散定義；SearchBar 輸入框修復因父層 `flex-col` 與 `flex-1` 導致手機端高度塌陷為 20.61px 之問題，改採 `w-full md:flex-1 h-10 min-h-10 shrink-0` 徹底鎖定 40px 高度）— 完成 2026-09-05
- [x] 「一鍵精選」全域控制項提升（Relocate Premium Toggle to Action Bar：由 ScreenerPanel 說明列遷移至頂部更新控制列，與快照、更新按鈕並排；手機端採 32px 方形星芒圖示微按鈕與快照按鈕對稱，電腦端展開顯示「一鍵精選/精選中」，在全部模式時自動停用；同時徹底釋放 ScreenerPanel 戰略提示空間，實現單行飽滿通欄展示）— 完成 2026-09-05
- [x] LINE 選股快照純文字排版精簡重構（Screener Snapshot Format 1：適配 LINE 窄對話泡泡，股票項目由單行改為雙行排版【首行代號名稱現價，次行以 ▲ / ▼ / 0 醒目幾何符號呈現漲跌點數與百分比】；全域時間精簡為 `MM/DD W HH:mm:ss 複製/資料`；模式標題升級為 `＝＝ 模式 (N) ＝＝`；區段改為 `【一般篩選】` 與 `【一鍵精選】`；頂部操作列快照與一鍵精選按鈕位置左右對調【左快照、右精選】；項目間保持整齊空行，杜絕文字折行，提升閱讀流暢度）— 完成 2026-09-05（v0905.03）
- [x] 手機端模式主訴與調整參數垂直分行（ScreenerPanel Mobile Layout：手機端由橫排並列改為垂直分行【上層：模式主訴滿版通欄，下層靠右：調整參數 / 重設自訂按鈕組】，電腦端維持單行橫排；徹底釋放手機橫向寬度，根除長文案在手機端尾字擠壓折行的問題；同時重設自訂按鈕樣式改為經典 btn-ghost 純文字微按鈕，維持視覺沉穩一致）— 完成 2026-09-05
- [x] 盤前與休市行情更新攔截與基底資料庫防護（Pre-market Update Intercept & Database Protection：週一至五 00:00~08:59 盤前與週末休市時段點擊「更新」時自動攔截，彈出輕量提示 Toast『尚未開盤（09:00 正式開盤），維持盤後選股結果』或『週末休市，維持週五盤後選股結果』，阻斷不必要之 API 請求；底層 `mergeRealtimeQuote` 與 `mergeAllRealtimeQuotes` 新增雙重保險防護，非即時開盤時段一律保護原始基底資料，嚴禁 0 成交量或試撮價沖銷既有選股名單；全域 Toast 支援 success 打勾與 info 圓形驚嘆號雙圖示自適應）— 完成 2026-09-05（v0905.04）
- [x] 個股標籤官方排行榜 URL 智慧對照模組（`src/constants/category-urls.js`：收錄 17 大選股來源標籤對應之富邦 DJ / 證交所官方排行榜完整端點；自動依據個股 `market` 屬性判定上市 `_0_` 或上櫃 `_1_` 智慧派發專屬網址，如 3624 光頡自動匹配上櫃 `zg_D_1_1.djhtm`、2330 台積電自動匹配上市 `zg_D_0_1.djhtm`；提供 `getStockCategoryItems` 格式化陣列供卡片超連結渲染）— 完成 2026-09-05

- [ ] RiskModal（空間與風控全貌）
- [ ] AvoidModal（避雷區，法人賣超）
- [ ] 個股快捷連結（籌碼/多空/資券/盤後）
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
