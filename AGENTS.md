# AGENTS.md — tool-screener-v2 執行教條

> **本文件適用於所有 AI Agent（Claude、Gemini 或其他）。**
> **每次執行任何任務前，必須先閱讀並遵守本文件全部條款。**

---

## 教條一：嚴禁自動 Push（最高優先）

**完成任何程式碼修改後，絕對嚴禁自動執行 `git push`。**

- 允許：`git add`、`git commit`（在本機建立紀錄）
- 禁止：`git push`（推送到遠端）
- 原因：使用者需要審視每一批改動並明確同意後，才授權 push

**例外**：使用者在當次明確下指令「可以 push」或「push 上去」，才可執行 push。

---

## 教條二：改動後必須更新 ARCHITECTURE.md

**每次完成一批改動後，必須連帶更新 `docs/ARCHITECTURE.md`。**

目標：確保 `docs/ARCHITECTURE.md` 永遠同步反映產品現況。

具體要求：
- 新增模組 → 在架構文件新增對應說明
- 修改資料格式 → 更新 Data Contract 區段
- 新增/移除元件 → 更新元件清單
- 變更目錄結構 → 更新目錄結構區段
- 修改選股邏輯 → 更新演算法說明

---

## 教條三：UI 元件由 Gemini 負責，邏輯層由 Claude 負責

分工邊界以 `docs/INTERFACE_CONTRACT.md` 為準。

- **Claude 負責**：`src/engine/`、`src/composables/`、`src/constants/`、`scripts/`（Python）、`App.vue` 骨架
- **Gemini 負責**：`src/components/` 所有 UI 元件的視覺實作

**Claude 不得在未確認 UI 需求前自行實作 UI 元件。**
**Gemini 不得修改 composables、engine 或 constants 的邏輯。**

---

## 教條四：資料正確性第一

- 嚴禁使用硬編碼數值或靜態舊資料補洞
- 所有計算必須基於即時或最新爬取的資料
- 處置股每次更新必須即時從 TWSE/TPEx 官方 API 拉取
- 校正邏輯（calibration）有任何修改必須附上驗證截圖或 log

---

## 教條五：UI 文字集中管理

- 所有面向使用者的中文字串，統一在 `src/constants/ui-strings.js` 管理
- 嚴禁在 `.vue` template 或 Python 輸出中硬寫靜態中文字串

---

## 教條六：需求不明確時先問

- 規格不清楚 → 先問使用者確認，不要猜測自行實作
- 特別是 UI 設計、選股邏輯參數、資料來源優先順序
