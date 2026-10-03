# 時光機覆盤：後續交易日表現驗證功能開發任務書

> **建立日期**：2026-10-03  
> **背景**：當使用者在週末或盤後使用時光機切換至歷史交易日（例如 9/30）進行選股覆盤時，最核心的需求是驗證「被選中的標的（或被排除的避雷標的）在後續交易日（如 10/1、10/2）究竟有沒有漲、有沒有破停損」。過去使用者必須手動複製股票代碼至搜尋列並切回今日，體驗繁瑣。  
> **解法**：在時光機歷史模式（`dayOffset > 0` 且有後續交易日）下，卡片自動掛載 `stock.forwardValidation` 物件。前端 UI 於卡片內渲染一條「結論優先、點擊可就地向下展開逐日明細」的覆盤驗證膠囊條。  
> **分工邊界**：  
> - **後端 AI (Claude)**：負責 `src/engine/screener.js` 切片運算、`src/constants/ui-strings.js` 字串維護、`docs/INTERFACE_CONTRACT.md` 型別定義與單元測試（已全數完成）。  
> - **前端 AI (Gemini)**：負責 `src/components/StockCard.vue` 的 UI 元件渲染、排版適配與展開收合動效。  
> **Push 規範**：完成並自我檢查後 commit，絕對嚴禁自動 push，待使用者審視同意。  

---

## 一、後端 AI（Claude）已完成之資料合約

### 1. `stock.forwardValidation` 資料結構

當且僅當 `dayOffset > 0` 且該歷史日之後**存在真實後續交易日**時，`stock.forwardValidation` 會被自動注入；若處於最新交易日（T-0）或無後續資料時，該欄位為 `null` 或 `undefined`。

```typescript
interface ForwardValidation {
  daysCount: number             // 後續交易日天數 (1 代表 T+1, 2 代表 T+2...)
  entryDate: string             // 選出進場基準日 (YYYY-MM-DD，例如 '2026-09-30')
  entryPrice: number            // 選出進場基準收盤價 (例如 186.00)
  finalPrice: number            // 最新收盤價 (例如 192.00)
  finalChange: number           // 累計漲跌點數 (例如 +6.00)
  totalGainPct: number          // 累計漲跌幅 % (例如 +3.23)
  maxGainPct: number            // 後續波段最高獲利幅 % (MFE，例如 +5.41)
  maxDrawdownPct: number        // 後續波段最深拉回跌幅 % (MAE，例如 -0.54)
  dailyRecords: Array<{
    tDay: number                // 1, 2, 3... 對應 T+1, T+2...
    date: string                // 該日日期 (YYYY-MM-DD，例如 '2026-10-01')
    open: number                // 開盤價
    high: number                // 最高價
    low: number                 // 最低價
    close: number               // 收盤價
    volume: number              // 成交量（張）
    dayChange: number           // 當日相較於前一日之漲跌點數
    dayChangePct: number        // 當日相較於前一日之漲跌幅 %
    cumChange: number           // 相較於選出進場基準之累計點數
    cumChangePct: number        // 相較於選出進場基準之累計漲跌幅 %
  }>
}
```

### 2. UI 字串對照（`src/constants/ui-strings.js` 已就位）

已於 `UI_STRINGS.FORWARD_VALIDATION` 新增以下字串：

```javascript
FORWARD_VALIDATION: {
  titlePrefix: '後續驗證',
  titleWithDays: (days) => `後續驗證 T+${days}`,
  cumulative: '累計',
  maxProfit: '最高',
  maxDrawdown: '最深',
  entryBenchmark: '選出基準',
  latestClose: '最新收盤',
  expand: '展開',
  collapse: '收合',
  empty: '最新交易日（尚無後續交易資料）',
}
```

---

## 二、前端 AI（Gemini）負責實作：`src/components/StockCard.vue`

### 1. 放置位置與觸發條件

- **觸發條件**：`v-if="stock.forwardValidation"`
- **放置位置**：
  - **簡約模式 (Compact Mode)**：置於首行報價下方、槽位 B（篩選理由）上方（或槽位 B 正下方）。
  - **完整模式 (Full Mode，手機端與桌機端)**：置於第 1 層（核心報價）與第 2 層（分類標籤）之間，或作為第 1.5 層的覆盤條。
- **原則**：最新交易日（T-0）時 `stock.forwardValidation` 為空，該 DOM 節點完全不渲染，維持平日原本的極簡乾淨排版。

---

### 2. 視覺設計與互動規格（符合 investing.com 極簡風格）

#### ① 未展開狀態（單行精簡結論膠囊，高度 ~30px）
- 採用輕量中性背景：`bg-base-300/40 border border-base-300/60 rounded-lg py-1 px-2.5 text-xs sm:text-sm`。
- **左側摘要文字**：
  - 標籤：`UI_STRINGS.FORWARD_VALIDATION.titleWithDays(stock.forwardValidation.daysCount)`（如 `後續驗證 T+2`）。
  - 累計漲跌幅：加粗數值，正值採 `text-rise`（漲紅），負值採 `text-fall`（跌綠），如 `累計 +3.23%`。
  - 波段極值括號：`text-base-content/70`，顯示 `(最高 +5.41% · 最深 -0.54%)`。
- **右側展開收合按鈕**：
  - 文字「展開 / 收合」配細緻小箭頭 SVG（旋轉 180 度動效，與現有天花板和診斷清單樣式一致）。
  - 支援點擊 toggle `isForwardExpanded`。

#### ② 展開狀態（迷你直式時間軸，字級 text-xs font-numeric）
- 展開後上方附細邊框分隔線 `border-t border-base-300/40 mt-1.5 pt-1.5 space-y-1.5`。
- **首列（進場基準日）**：
  - 顯示基準日與基準價格：`09/30 (三) 選出基準收盤價 186.00`。
- **後續逐日歷程**：
  - 依序渲染 `stock.forwardValidation.dailyRecords`。
  - 每一行結構：
    `[MM/DD (W) T+N] [收盤價] [當日漲跌點數與百分比] [累計漲跌幅]`
  - 漲跌數值標準紅綠上色（`text-rise` / `text-fall`）。
  - 允許使用者用滑鼠反藍選取與複製文字（`select-text cursor-auto`）。

---

### 3. 參考 Template 結構範例

```vue
<!-- 時光機覆盤：後續交易日驗證膠囊條 -->
<div
  v-if="stock.forwardValidation"
  class="my-1.5 py-1 px-2.5 rounded-lg border border-base-300/60 bg-base-300/35 text-xs sm:text-sm transition-colors"
>
  <div
    class="flex items-center justify-between gap-1.5 select-none cursor-pointer"
    @click="isForwardExpanded = !isForwardExpanded"
  >
    <div class="flex items-baseline gap-1.5 truncate">
      <span class="font-medium text-base-content/80">
        {{ UI_STRINGS.FORWARD_VALIDATION.titleWithDays(stock.forwardValidation.daysCount) }}
      </span>
      <span class="text-base-content/40">·</span>
      <span class="text-base-content/75">{{ UI_STRINGS.FORWARD_VALIDATION.cumulative }}</span>
      <strong
        class="font-numeric font-bold"
        :class="stock.forwardValidation.totalGainPct > 0 ? 'text-rise' : (stock.forwardValidation.totalGainPct < 0 ? 'text-fall' : 'text-base-content')"
      >
        {{ stock.forwardValidation.totalGainPct > 0 ? '+' : '' }}{{ stock.forwardValidation.totalGainPct }}%
      </strong>
      <span class="text-base-content/60 text-xs hidden sm:inline">
        ({{ UI_STRINGS.FORWARD_VALIDATION.maxProfit }} +{{ stock.forwardValidation.maxGainPct }}% · {{ UI_STRINGS.FORWARD_VALIDATION.maxDrawdown }} {{ stock.forwardValidation.maxDrawdownPct }}%)
      </span>
    </div>

    <!-- 展開/收合按鈕 -->
    <span class="text-xs text-base-content/60 flex items-center gap-0.5 shrink-0">
      <span>{{ isForwardExpanded ? UI_STRINGS.FORWARD_VALIDATION.collapse : UI_STRINGS.FORWARD_VALIDATION.expand }}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5 transition-transform duration-200"
        :class="{ 'rotate-180': isForwardExpanded }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  </div>

  <!-- 展開後的迷你逐日時間軸歷程 -->
  <div
    v-if="isForwardExpanded"
    class="pt-2 mt-2 border-t border-base-300/40 space-y-1.5 text-xs font-numeric select-text cursor-auto"
    @click.stop
  >
    <!-- 進場基準列 -->
    <div class="flex items-center justify-between text-base-content/70 pb-1 border-b border-base-300/30">
      <span>{{ stock.forwardValidation.entryDate }} {{ UI_STRINGS.FORWARD_VALIDATION.entryBenchmark }}</span>
      <span class="font-bold text-base-content">{{ formatNumber(stock.forwardValidation.entryPrice) }}</span>
    </div>

    <!-- T+1 ~ T+N 逐日明細 -->
    <div
      v-for="rec in stock.forwardValidation.dailyRecords"
      :key="rec.tDay"
      class="flex items-center justify-between text-base-content/85"
    >
      <div class="flex items-center gap-1.5">
        <span class="font-medium text-base-content/70">T+{{ rec.tDay }} ({{ rec.date.slice(5) }})</span>
      </div>
      <div class="flex items-baseline gap-2.5">
        <span class="font-bold text-base-content">{{ formatNumber(rec.close) }}</span>
        <span
          class="font-semibold text-right w-16"
          :class="rec.dayChangePct > 0 ? 'text-rise' : (rec.dayChangePct < 0 ? 'text-fall' : 'text-base-content/70')"
        >
          {{ rec.dayChangePct > 0 ? '▲' : (rec.dayChangePct < 0 ? '▼' : '') }}{{ Math.abs(rec.dayChangePct).toFixed(2) }}%
        </span>
        <span
          class="text-right w-16 text-xs"
          :class="rec.cumChangePct > 0 ? 'text-rise' : (rec.cumChangePct < 0 ? 'text-fall' : 'text-base-content/60')"
        >
          {{ rec.cumChangePct > 0 ? '+' : '' }}{{ rec.cumChangePct }}%
        </span>
      </div>
    </div>
  </div>
</div>
```

---

## 三、驗收檢核清單（改完必做）

1. **最新日驗證**：時光機切至 T-0（今日/最新收盤），卡片上**不可出現**後續驗證膠囊條。
2. **歷史日驗證**：時光機切至 T-1、T-2、T-3，卡片上能正確顯示 `後續驗證 T+N`，點擊可流暢展開/收合。
3. **分流驗證**：確認「符合名單」、「未符合名單」及「搜尋結果」皆能正常運作顯示。
4. **手機排版驗證**：在手機寬度（375px）下檢查膠囊列文字與展開清單，確保不出現任何突兀折行或破版。
5. **控制台檢查**：Console 無任何 Vue warning 或 JavaScript error。
