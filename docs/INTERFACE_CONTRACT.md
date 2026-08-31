# INTERFACE CONTRACT — tool-screener-v2

> **用途**：Claude 負責架構與邏輯層，Gemini 負責 UI 元件與 CSS 樣式。
> 本文件是雙方的溝通邊界，所有 Props / Events / Types 以此為準。
>
> 最後更新：2026-08-26

---

## 一、資料模型（Data Types）

以下為所有元件共享的核心型別，Gemini 在 Props 中可以直接引用這些結構。

### `Stock`（個股物件）

```typescript
interface Stock {
  // 識別
  code:        string       // 股票代號，e.g. "2330"
  name:        string       // 股票名稱，e.g. "台積電"
  market:      'tse'|'otc' // 上市 = tse，上櫃 = otc
  categories:  string[]    // 來源標籤，e.g. ["0050","ForeignBuy1D"]
  isDisposed:  boolean      // 是否為處置股

  // 即時行情（盤中更新）
  price:       number       // 現價
  prevClose:   number       // 昨收
  open:        number       // 今開
  high:        number       // 今高
  low:         number       // 今低
  change:      number       // 漲跌價差
  changePct:   number       // 漲跌幅 %（正=漲，負=跌）
  volume:      number       // 成交量（張）
  isLimitUp?:  boolean      // 是否觸及漲停 (漲幅 >= +9.5%，UI 呈現紅底白字)
  isLimitDown?: boolean     // 是否觸及跌停 (跌幅 <= -9.5%，UI 呈現綠底白字)


  // 均線基底（盤後更新）
  ma5:   number
  ma10:  number
  ma20:  number
  ma60:  number
  vMa5:  number             // 5日均量（張）
  vMa10: number             // 10日均量（張）
  maxVol10d:     number
  hasVolumeBurst: boolean   // 近10日是否有爆量走強訊號

  // 近期高低價
  high5d: number;  high10d: number;  high20d: number
  low5d:  number;  low10d:  number;  low20d:  number

  // KD(9,3)
  kd: {
    k:     number
    d:     number
    prevK: number
    prevD: number
    h8:    number           // 前8日最高
    l8:    number           // 前8日最低
  }

  // Sparkline
  sparkline:  number[]      // 近10日收盤價陣列
  history10d: DayBar[]      // 近10日完整日K（含 ma5/ma10/kd）
}

interface DayBar {
  open: number;  high: number;  low: number;  close: number
  prevClose: number;  volume: number
  ma5: number;  ma10: number;  ma20: number
  k: number;  d: number
}
```

### `MarketData`（大盤指數）

```typescript
interface IndexData {
  name:        string       // "加權指數" | "櫃買指數"
  price:       number
  prevClose:   number
  changePrice: number
  changePct:   number
  ma5:  number;  ma10: number;  ma20: number
  bias20:      number       // 月線乖離率 %
  statusDesc:  string       // 動態描述，e.g. "多頭強勢攻擊 (+1.13%)"
  kd: { k: number; d: number; prevK: number; prevD: number; status: string }
}

interface MarketData {
  taiex:  IndexData
  otc:    IndexData
  regime: {
    code:     'SAFE' | 'CAUTION' | 'DANGER'
    badge:    string    // 短標題，e.g. "多頭順風"
    title:    string    // 長標題
    subtitle: string    // 說明文字
  }
}
```

### `ScreenerParams`（篩選條件）

```typescript
interface ScreenerParams {
  // 均線支撐與糾結度
  maAboveMode:               'BOTH' | 'ANY'  // 站穩 5MA/10MA 模式（BOTH: 雙站穩，ANY: 單站穩）
  requireAboveMa60?:         boolean         // 是否要求站穩季線防身 (收盤價 >= 60MA)
  checkConvergence:          boolean         // 是否啟用當日三線價差過濾
  convergenceMax:            number          // 當日三線價差上限（%）
  checkPrevConvergence?:     boolean         // 是否啟用前一交易日三線價差過濾（Mode 3 專用）
  prevConvergenceMax?:       number          // 前一交易日三線價差上限（%）
  requireMa20Rising?:         boolean         // 是否要求月線斜率向上（Mode 2 內建）

  // 乖離率區間
  bias5Min:                  number          // 5MA 乖離率下限（%）
  bias5Max:                  number          // 5MA 乖離率上限（%）
  bias20Min:                 number          // 20MA 月線乖離率下限（%）
  bias20Max:                 number          // 20MA 月線乖離率上限（%）

  // 量能與流動性
  minVolume?:                number          // 最低成交量（張）
  checkMinVolume?:           boolean         // 是否啟用成交量門檻
  checkNotDisposed?:         boolean         // 是否排除處置股
  checkVolContraction?:      boolean         // 當日量縮洗盤 (量 <= 5日量均 * volContractionRatio)
  volContractionRatio?:      number          // 量縮洗盤門檻比率（預設 1.0，即小於等於 5 日均量）

  checkVolPullback?:         boolean         // 量縮回踩 (量 < 5日量均 或 < 昨日量)
  checkPrevVolContraction?:  boolean         // 昨日量縮 (昨日量 < 昨日5日量均 MV5)
  checkVolExpansion?:        boolean         // 當日帶量攻擊 (量 > 5日量均)

  // K棒形態與影線
  checkTightConsolidation?:  boolean         // 狹幅震盪打底
  tightChgMin?:              number          // 狹幅打底漲跌幅下限（%）（預設 -1.5%）
  tightChgMax?:              number          // 狹幅打底漲跌幅上限（%）（預設 +1.5%）
  checkRedCandle?:           boolean         // 實體攻擊紅 K (收 > 開 且 漲幅 >= 1.5%)
  checkAvoidLongBlack?:      boolean         // 排除長黑倒貨
  blackCandleRatioMax?:      number          // 長黑倒貨下影線佔比上限（預設 0.20 或 0.25）
  checkAvoidLongUpperShadow?: boolean        // 排除長上影線避雷針 (上影線 <= 實體紅K一半)

  // KD 動能指標
  checkKd?:                  boolean         // 是否啟用 KD 動能區過濾
  kdKMin?:                   number          // K 值下限
  kdKMax?:                   number          // K 值上限
  kdRequireCross?:           boolean         // 是否要求 K > D 黃金交叉/多頭排列
}


```

### `ScreenerMode`（選股模式）

```typescript
interface ScreenerMode {
  id:            'BOTTOM_REVERSAL' | 'BOTTOM_CONSOLIDATION' | 'MOMENTUM_BREAKOUT' | 'TREND_PULLBACK' | 'WASHOUT_IGNITION' | string
  label:         string
  description:   string
  defaultParams: ScreenerParams
}
```

---

### 【五大選股模式底層寫死 / 隱形條件交接規格書（供前端 UI 註記）】

> **重要說明**：
> 為確保量化選股之極致嚴謹度，防止使用者誤調破壞交易系統的底層防護，引擎內部設有 **6 大底層寫死 / 隱形靈魂條件**。
> 前端 AI 在實作或更新 `ScreenerPanel.vue` 時，請務必依據下表**在 UI 介面上以標籤副標題、灰字小字（Hint）或 Badge 明確標註**，讓使用者一目了然其風控意涵。

#### 1. 六大底層寫死條件一覽表

| # | 條件類型 | 引擎底層寫死常數 / 機制 | 影響模式 | 建議 UI 呈現文字與小字註記 |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **月線斜率向上**<br>*(底層靈魂條件)* | `ma20 > prevMa20`<br>*(引擎強制執行)* | **多頭回測<br>洗盤起漲** | 🔹 **UI 標註**：`月線斜率向上 (當日 20MA > 前一日 20MA)`<br>💡 *底層強制條件：鎖定多頭生命線扣抵向上，殺掉假多頭* |
| **2** | **狹幅震盪打底**<br>*(固定區間)* | `-1.5% <= changePct <= +1.5%`<br>*(區間固定 ±1.5%)* | **底部蓄勢** | 🔹 **UI 標籤**：`狹幅震盪打底 (漲跌幅 -1.5% ~ +1.5%)`<br>💡 *底層固定區間：排除實體紅K已噴出股票，鎖定十字星打底* |
| **3** | **排除長黑倒貨**<br>*(固定跌幅門檻)* | 實體跌幅 `dropPct >= 1.5%`<br>且收最低附近 `lowRatio <= 0.20` | **底部蓄勢<br>多頭回測** | 🔹 **UI 標籤**：`排除長黑倒貨 (實體跌幅 ≥ 1.5% 且收最低)`<br>💡 *底層固定門檻：避免買進主力出貨、收盤摜壓之實體長黑* |
| **4** | **實體攻擊紅 K**<br>*(動能型門檻)* | `close > open 且`<br>`changePct >= 1.5%` | **動能攻擊** | 🔹 **UI 標籤**：`實體攻擊紅 K (收盤 > 開盤 且 漲幅 ≥ 1.5%)`<br>💡 *底層固定門檻：確保破浪發動當日有實質攻擊漲幅* |
| **5** | **實體強攻/反轉紅 K**<br>*(起漲/反轉門檻)* | `close > open 且`<br>`changePct >= 2.0%` | **洗盤起漲<br>跌深反轉** | 🔹 **UI 標籤**：`實體攻擊/反轉紅 K (收盤 > 開盤 且 漲幅 ≥ 2.0%)`<br>💡 *底層固定門檻：洗盤或抄底必須有主力強攻表態 (≥2%)* |
| **6** | **排除長上影線**<br>*(固定避雷針比例)* | `upperShadow > realBody * 0.5`<br>*(上影線 > 實體一半則剔除)* | **動能攻擊<br>洗盤起漲<br>跌深反轉** | 🔹 **UI 標籤**：`排除長上影線 (上影線 ≤ 實體紅K一半)`<br>💡 *底層固定比例：嚴格排除上方沉重解套賣壓* |

---

#### 2. 各模式專屬底層條件與前端註記指南

##### ① 底部蓄勢 (`BOTTOM_CONSOLIDATION`)
- **狹幅震盪打底**：UI 顯示 `狹幅震盪打底 (漲跌幅 -1.5% ~ +1.5%)`。
- **排除長黑倒貨**：UI 顯示 `排除長黑倒貨 (實體跌幅 ≥ 1.5% 且收最低)`。

##### ② 動能攻擊 (`MOMENTUM_BREAKOUT`)
- **實體攻擊紅 K**：UI 顯示 `實體攻擊紅 K (收盤 > 開盤 且 漲幅 ≥ 1.5%)`。
- **昨日量縮洗盤**：UI 顯示 `昨日成交量 < 昨日 5 日均量 (MV5)`。
- **排除長上影線**：UI 顯示 `排除長上影線避雷針 (上影線 ≤ 實體紅K一半)`。

##### ③ 洗盤起漲 (`WASHOUT_IGNITION`)
- **月線斜率向上**：UI 顯示 `月線斜率向上 (當日 20MA > 前一日 20MA)`。*(引擎強制判定)*
- **實體攻擊紅 K**：UI 顯示 `實體攻擊紅 K (收盤 > 開盤 且 漲幅 ≥ 2.0%)`。
- **排除長上影線**：UI 顯示 `排除長上影線避雷針 (上影線 ≤ 實體紅K一半)`。

##### ④ 多頭回測 (`TREND_PULLBACK`)
- **月線斜率向上**：UI 顯示 `月線斜率向上 (當日 20MA > 前一日 20MA)`。*(引擎強制判定)*
- **排除長黑倒貨**：UI 顯示 `排除長黑倒貨 (實體跌幅 ≥ 1.5% 且收最低)`。

##### ⑤ 跌深反轉 (`BOTTOM_REVERSAL`)
- **均線站穩策略**：UI 均線支撐顯示 `無限制 (交由 5MA 乖離 -5%~+5% 控管)`。
- **實體反轉紅 K**：UI 顯示 `實體反轉紅 K (收盤 > 開盤 且 漲幅 ≥ 2.0%)`。
- **排除長上影線**：UI 顯示 `排除長上影線避雷針 (上影線 ≤ 實體紅K一半)`。

---



---

## 二、元件規格（Component Specs）

### 【Gemini 負責實作的 UI 元件】

---

#### `MarketBanner.vue`

> 大盤多空風控橫幅，固定在主內容頂部

**Props：**
```typescript
props: {
  taiex:  IndexData | null
  otc:    IndexData | null
  regime: MarketData['regime'] | null
  loading: boolean             // 顯示骨架載入動畫
}
```

**視覺規格：**
- 橫幅背景依 `regime.code` 變色：`SAFE`=綠調、`CAUTION`=黃調、`DANGER`=紅調（低飽和）
- 左側：regime badge + title + subtitle
- 右側：TAIEX 與 OTC 各一張迷你數據卡（現價、漲跌幅%、bias20）
- 手機版：折疊為一行 badge，點擊展開詳情

**不得做的事：** 不做任何數據計算，所有數值直接顯示 props 傳入的值

---

#### `ScreenerPanel.vue`

> 篩選條件控制面板，包含模式切換與參數輸入

**Props：**
```typescript
props: {
  modes:      Record<string, ScreenerMode>
  activeMode: string
  params:     ScreenerParams
}
```

**Events：**
```typescript
emits: {
  'update:activeMode': (modeId: string) => void
  'update:params':     (params: ScreenerParams) => void
  'reset':             () => void          // 重設為當前模式預設值
}
```

**視覺規格：**
- 手機版：預設折疊，點擊「篩選條件」展開（drawer 或 bottom sheet）
- 桌機版：左側邊欄（固定寬度 240px）或頂部橫向展開
- 模式切換：Tab 或 SegmentedControl 樣式
- 參數輸入：數字 input，`inputmode="decimal"`，支援手機數字鍵盤
- 「重設預設值」按鈕：在每個模式 Tab 底部

---

#### `StockTable.vue`

> 主選股結果列表，手機卡片 / 桌機表格自動切換

**Props：**
```typescript
props: {
  stocks:  Stock[]         // 已篩選的結果（排序由外部完成）
  loading: boolean
  meta:    { updatedAt: string; totalStocks: number } | null
}
```

**Events：**
```typescript
emits: {
  'select': (stock: Stock) => void    // 點擊個股，觸發詳情 Modal
  'sort':   (key: string, dir: 'asc'|'desc') => void
}
```

**視覺規格：**
- `< lg`：`StockCard` 卡片列表，垂直堆疊
- `>= lg`：`StockRow` 表格，欄位：代號、名稱、現價、漲跌幅、量、5MA、月線、5MA乖、月乖、KD、Sparkline
- 表格欄位可點擊排序（附箭頭指示方向）
- 結果數量與最後更新時間顯示於列表頂部

---

#### `StockCard.vue`

> 自適應個股卡片（`StockTable` 內部使用，手機 5 層垂直展開 / 電腦 3 欄式寬扁卡片）

**Props：**
```typescript
props: {
  stock: Stock,
  ceilingProfit?: { ceilingType: string; ceilingPrice: number; netProfitPct: number; passed: boolean } | null,
  filterEvaluation?: { isMatch: boolean; reasonText: string } | null,
}
```

**Events：**
```typescript
emits: {
  'select': (stock: Stock) => void
  'openRiskModal': (stock: Stock) => void
}
```

**視覺規格：**
- 圓角卡片 `bg-base-200`，邊框 `border-base-300`，字體符合 18px 標準
- 手機版 (< 1024px)：5 層自然垂直展開（代號名稱現價 → 標籤純文字 → 關卡純利槽位 → Sparkline與KD → 左右3排均線/量能網格 → 篩選結果槽位 → 複製/外部快捷連結）
- 電腦版 (>= 1024px)：3 欄式寬扁卡片（左欄報價操作、中欄走勢KD、右欄均線量能比對、通欄篩選結果底列）
- Highlight 數據以加粗（`font-bold`）呈現，無彩色 Badge 噪音
- 點擊「複製」具備單色微互動提示

---

#### `Sparkline.vue`

> 純向量 SVG 三層式走勢圖（10 根 K 棒 + 5/10/20 均線折線 + 10 根成交量柱與 MV5 基準線爆量標記 + 10 日 KD 折線與 50 基準線）

**Props：**
```typescript
props: {
  history?:   DayBar[]    // 近 10 日完整日 K（含 open/high/low/close/prevClose/volume/ma5/ma10/ma20/k/d）
  stock?:     Stock       // 個股完整物件（取得 vMa5、ma20 等）
  stockCode?: string      // 個股代號（供 missing data console 警示）
}
```

**視覺規格：**
- ViewBox `0 0 192 140`，外層容器 `w-full max-w-[220px] h-auto`
- 上層 (Y: 6~58)：10 根 K 棒（實體/影線）+ 5MA（`--color-ma5` 活力橘）/ 10MA（`--color-ma10` 科技藍）/ 20MA（`--color-ma20` 暖鵝黃）折線 + 右側標籤（簡寫為 `5`, `10`, `20`）智慧 3 線防重疊演算法
- 中層 (Y: 66~96)：10 根成交量柱（對照昨收漲紅跌綠）+ MV5 基準虛線 + 右側標籤（簡寫為 `5`）+ 爆量（>= 2*MV5）紅色倒三角標記（▼）
- 下層 (Y: 104~134)：10 日 KD(9,3) 折線（橘 K / 藍 D）+ Y=50 基準虛線與 `50` 標籤 + 右側 `K`、`D` 標籤
- 當歷史資料不足 10 筆時，乾淨顯示 `-- 暫無 10 日走勢數據 --` 並在瀏覽器 console 印出 warning 警示，絕不偽造假 K 線

---

#### `ThemeToggle.vue`（可選獨立元件）

**Props：**
```typescript
props: {
  isDark: boolean
}
```

**Events：**
```typescript
emits: {
  'toggle': () => void
}
```

---

### 【Claude 負責，Gemini 不需要動的】

| 元件 / 模組 | 說明 |
| :--- | :--- |
| `src/engine/screener.js` | 純篩選演算法（無 DOM） |
| `src/composables/useStockPool.js` | JSON 資料載入 |
| `src/composables/useScreener.js` | 篩選狀態管理 |
| `src/composables/useRealtimeQuotes.js` | GCP 即時行情 |
| `src/constants/screener-modes.js` | 模式定義 |
| `src/constants/ui-strings.js` | UI 文字 |
| `scripts/` (所有 Python) | 後端爬蟲與資料處理 |

---

## 三、Logic 層規格（Composables Interface）

Gemini 在需要資料時，直接呼叫以下 composables，不需要自行 fetch：

### `useStockPool()`

```typescript
const {
  stocks:   Readonly<Ref<Stock[]>>,
  rankings: Readonly<Ref<Record<string, RankingData>>>,
  market:   Readonly<Ref<MarketData | null>>,
  meta:     Readonly<Ref<{ updatedAt: string; totalStocks: number } | null>>,
  loading:  Readonly<Ref<boolean>>,
  error:    Readonly<Ref<string | null>>,
  loadPool: () => Promise<void>,
} = useStockPool()
```

### `useScreener(stocks)`

```typescript
const {
  activeMode: Readonly<Ref<string>>,
  params:     Ref<ScreenerParams>,          // 可寫，UI 直接綁定
  results:    Readonly<ComputedRef<Stock[]>>, // 自動重算
  modes:      Record<string, ScreenerMode>,
  setMode:    (modeId: string) => void,
} = useScreener(stocks)
```

### `useRealtimeQuotes()`

```typescript
const {
  gcpUrl:       Readonly<Ref<string>>,
  quotes:       Readonly<Ref<Record<string, QuoteData>>>,
  loading:      Readonly<Ref<boolean>>,
  lastUpdated:  Readonly<Ref<string | null>>,
  error:        Readonly<Ref<string | null>>,
  missingCodes: Readonly<Ref<string[]>>,
  isConfigured: Readonly<ComputedRef<boolean>>,
  saveGcpUrl:   (url: string) => void,
  clearGcpUrl:  () => void,
  fetchQuotes:  (codes: string[]) => Promise<Record<string, QuoteData> | null>,
  getQuote:     (code: string) => QuoteData | null,
} = useRealtimeQuotes()
```


---

## 四、目錄結構規範

```
src/
├── App.vue                    ← Claude 負責（狀態組裝）
├── main.js                    ← Claude 負責
│
├── engine/
│   └── screener.js            ← Claude 負責（純演算法）
│
├── composables/               ← Claude 負責（邏輯層）
│   ├── useStockPool.js
│   ├── useScreener.js
│   └── useRealtimeQuotes.js
│
├── constants/                 ← Claude 負責
│   ├── screener-modes.js
│   └── ui-strings.js
│
├── components/                ← Gemini 負責（UI 元件）
│   ├── MarketBanner.vue       ← Gemini
│   ├── ScreenerPanel.vue      ← Gemini
│   ├── StockTable.vue         ← Gemini
│   ├── StockCard.vue          ← Gemini
│   ├── StockRow.vue           ← Gemini
│   ├── Sparkline.vue          ← Gemini（基本版由 Claude 已建，Gemini 優化）
│   ├── ThemeToggle.vue        ← Gemini
│   └── modals/
│       ├── RiskModal.vue      ← Gemini（Phase 3）
│       └── AvoidModal.vue     ← Gemini（Phase 3）
│
└── style.css                  ← Claude 定義 tokens，Gemini 可擴充元件樣式
```

---

## 五、CSS Token 規範

**Gemini 只能使用以下 token，不得自訂顏色 hex 值：**

```css
/* 漲跌色 */
var(--color-rise)          /* 台股漲：磚紅 */
var(--color-fall)          /* 台股跌：苔綠 */
var(--color-flat)          /* 平盤：中性灰 */

/* DaisyUI semantic tokens（自動適配 light/dark）*/
bg-base-100 / bg-base-200 / bg-base-300
text-base-content
border-base-300
bg-primary / text-primary
bg-error / text-error
bg-warning / text-warning
bg-success / text-success

/* 字型 */
font-numeric               /* 等寬數字，對齊小數點 */
```

**禁止：**
- 在元件內寫死 `#xxxxxx` 或 `rgb(...)` 顏色
- 使用 `style="color: red"` 等 inline style 覆蓋 token
- 引入新的第三方 CSS 框架

---

## 六、開發注意事項

### Gemini 給的元件必須符合：
1. **只接收 Props，不自行 fetch 資料** — 所有資料由 Claude 的 composables 提供
2. **必須 emit 正確的 event** — 不在元件內部直接修改資料
3. **使用 `UI_STRINGS` 取得文字** — 不在 template 裡硬寫中文字串
4. **Mobile-first** — 無前綴 = 手機，`md:` / `lg:` 往上疊加

### Claude 給的 composables 保證：
1. `results` 是 computed，stocks 或 params 改了會自動重算，不需手動呼叫
2. `loadPool()` 只需在 `App.vue` 的 `onMounted` 呼叫一次
3. `params` 是可寫的 ref，`ScreenerPanel` 可以直接 `v-model:params`
