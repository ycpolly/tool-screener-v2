# tool-screener-v2

> 台股波段選股工具 · 盤中即時行情與尾盤策略快照  
> 線上網址：[ycpolly.github.io/tool-screener-v2](https://ycpolly.github.io/tool-screener-v2/)

---

## 核心文件導覽（Single Source of Truth）

本專案遵循「單一可信來源」原則，所有業務規則、狀態機邏輯、資料排程與指標定義均集中於 `docs/` 資料夾管理：

1. **[系統架構與狀態機設計文件 (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)**
   - **資料時間狀態機**：盤前 / 盤中 / 收盤 / 盤後判定邏輯、更新按鈕防呆攔截與資料防護
   - **雲端兩波流更新排程**：GitHub Actions 16:38 初步名單、18:42 籌碼集中度與短沖避雷
   - **富邦 DJ 30 個官方端點清單**：15 組上市上櫃排行爬蟲與官方網址
   - **系統模組架構與規範**：Data Contract、雙模式演算法、前後端分層架構

2. **[個股卡片標籤與視覺指標完整字典 (docs/STOCK_CARD_DICTIONARY.md)](docs/STOCK_CARD_DICTIONARY.md)**
   - **18 大選股池來源標籤**：量大、值大、值增、週轉、三大法人與主力買超之官方端點與業務定義
   - **母子標籤智慧收斂**：外資買 / 主力買 / 投信買去重規則
   - **12 項通關篩選指標診斷**：均線支撐、月線斜率、三線收斂、5MA 乖離、KD 交叉量化公式

3. **[介面分工與模組契約 (docs/INTERFACE_CONTRACT.md)](docs/INTERFACE_CONTRACT.md)**
   - Claude（後端 / 邏輯 / Constants）與 Gemini（前端 / UI 元件）職責邊界與 Props / Events 契約
