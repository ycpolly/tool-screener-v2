# 尾盤快選功能開發任務書

> **建立日期**：2026-09-22
> **背景**：盤後零股下單窗口 13:30–14:30，TWSE 當日籌碼約 15:30 後才發布，
>           GitHub Actions 更新排程為 18:30。導致收盤時 stock-pool.json 內的
>           ForeignSell1D / MajorSell1D 資料為昨日籌碼，excludeSell1D
>           條件在此時段會誤殺今日轉多的標的，造成洗盤起漲、動能攻擊在收盤時篩選不到。
> **解法**：新增 intradayMode 開關。開啟後略過 excludeSell1D（1D 當日）條件，
>           保留 excludeSell3D（3D 趨勢資料為昨日，仍具參考價值）。
> **嚴禁自行腦補**：有疑問請向使用者確認，不可擅自修改其他條件。
> **Push 規範**：完成並自我驗證後 commit，絕對嚴禁直接 push，待使用者審視同意。

---

## 後端 AI（Claude）負責

### 1. src/constants/screener-modes.js

在全部 5 個模式的 defaultParams 末尾新增一行：

```js
intradayMode: false,    // 尾盤快選開關（預設關閉）
                        // true = 略過 excludeSell1D 檢查，改用 3D 籌碼趨勢判斷
                        // 適用於 13:30-14:30 收盤零股下單，當日籌碼尚未更新時
```

必須對 BOTTOM_REVERSAL、BOTTOM_CONSOLIDATION、MOMENTUM_BREAKOUT、
TREND_PULLBACK、WASHOUT_IGNITION 全部加，保持介面一致性。

---

### 2. src/engine/screener.js

找到 excludeSell1D 區塊（約第 657 行），將：

```js
// 現況
if (params.excludeSell1D) {
```

改為：

```js
// 修改後：尾盤快選模式下略過當日 1D 籌碼條件
if (params.excludeSell1D && !params.intradayMode) {
```

**只改這一處**。excludeSell3D 區塊不動（3D 趨勢用昨日資料，仍有效）。
diagnoseStock() 的對應診斷區塊也需同步加入 && !params.intradayMode 判斷，
避免診斷顯示「已通過」卻與實際邏輯不一致。

---

### 3. 自我驗證（改完必做）

1. 切換至「洗盤起漲」，手動把 intradayMode 設為 true
2. 確認選出結果與 false 時有差異（1D 條件確實被略過）
3. 確認 excludeSell3D 仍然有效（3D 賣超的股票仍被排除）
4. console.log 沒有報錯

---

## 前端 AI（Gemini）負責

### 1. src/constants/ui-strings.js

在 PANEL 區塊（建議放在 excludeSell1D 之後）新增：

```js
intradayMode: '尾盤快選',
intradayModeDesc: '收盤前下單用．略過當日 1D 籌碼（改以前日 3D 趨勢判斷）',
intradayModeWarning: '當日 1D 籌碼尚未更新，僅供盤後零股下單參考',
```

---

### 2. src/components/ScreenerPanel.vue

**位置**：在每個模式的量能模組（模組 B）最頂端，所有其他控制項之前。

**視覺設計規格**：
- 用 amber / warning 色系 badge，表示這是非常態模式
- 開啟時整個 toggle 列應有提示色，讓使用者清楚知道當前處於快選狀態
- 說明文字：「尾盤快選：略過當日 1D 籌碼，改用前日 3D 趨勢」

**參考 template 結構（實際樣式由 Gemini 決定）**：

```vue
<!-- 尾盤快選 toggle（所有模式共用，置於量能模組最頂端） -->
<div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
  <label class="flex items-center gap-2 cursor-pointer select-none">
    <input
      type="checkbox"
      class="checkbox checkbox-sm rounded"
      :checked="params.intradayMode"
      @change="updateField('intradayMode', $event.target.checked)"
    />
    <span class="font-medium">{{ UI_STRINGS.PANEL.intradayMode }}</span>
  </label>
  <span
    v-if="params.intradayMode"
    class="text-xs px-2 py-0.5 rounded font-medium bg-warning/20 text-warning-content"
  >
    {{ UI_STRINGS.PANEL.intradayModeWarning }}
  </span>
</div>
```

此 toggle 應在全部 5 個模式的量能模組內都存在，確保每個策略都能切換。

---

## 分工邊界

| 工作 | 負責方 | 檔案 |
|:---|:---:|:---|
| intradayMode 邏輯判斷 | 後端 AI | src/engine/screener.js |
| intradayMode 預設參數 | 後端 AI | src/constants/screener-modes.js |
| UI toggle 元件與樣式 | 前端 AI | src/components/ScreenerPanel.vue |
| 中文字串定義 | 前端 AI | src/constants/ui-strings.js |

---

## 預期使用情境

平常（晚上 18:30 後）：intradayMode OFF
  → excludeSell1D: true 有效，當日籌碼已更新，篩選最嚴謹

尾盤零股下單（13:30–14:30）：手動開啟 intradayMode
  → excludeSell1D 被略過，3D 趨勢照常過濾
  → 使用者看到提醒 badge，知道當前處於快選模式
  → 下單後可於 18:30 後關閉，重新驗證名單
