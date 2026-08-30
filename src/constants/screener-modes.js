/**
 * 選股模式定義
 *
 * 規範：
 * - 集中管理選股模式與各模式預設參數
 * - 新增模式：在此新增設定物件即可，不需修改核心引擎或 UI 程式碼
 */

export const SCREENER_MODES = {
  // Mode 1 - 底部蓄勢 (Bottom Consolidation)
  BOTTOM_CONSOLIDATION: {
    id: 'BOTTOM_CONSOLIDATION',
    label: '底部蓄勢',
    description: '尋找籌碼乾淨、極致壓縮股（參與 D1-D3）',
    defaultParams: {
      maAboveMode: 'BOTH',        // (嚴) 同時站穩 5MA 與 10MA
      checkConvergence: true,     // 當日三線價差開關
      convergenceMax: 3.0,        // 當日三線價差 <= 3%
      bias5Min: -2.0,             // 5MA 乖離率下限 (%)
      bias5Max: 3.0,              // 5MA 乖離率上限 (%)
      bias20Min: 0.0,             // 20MA 乖離率下限 (%)
      bias20Max: 8.0,             // 20MA 乖離率上限 (%)
      checkPrevConvergence: false,// 前一日三線價差開關
      prevConvergenceMax: 3.0,    // 前一日三線價差 <= 3%
      requireMa20Rising: false,   // 是否要求月線斜率向上
    },
  },

  // Mode 2 - 多頭回測 (Trend Pullback)
  TREND_PULLBACK: {
    id: 'TREND_PULLBACK',
    label: '多頭回測',
    description: '多頭趨勢中，量縮拉回找支撐的強勢中繼股',
    defaultParams: {
      maAboveMode: 'ANY',         // (寬) 站穩 5MA 或 10MA
      checkConvergence: true,     // 當日三線價差開關
      convergenceMax: 8.0,        // 當日三線價差 <= 8%
      bias5Min: -3.0,             // 5MA 乖離率下限 (%)
      bias5Max: 2.0,              // 5MA 乖離率上限 (%)
      bias20Min: 2.0,             // 20MA 乖離率下限 (%)
      bias20Max: 12.0,            // 20MA 乖離率上限 (%)
      checkPrevConvergence: false,// 前一日三線價差開關
      prevConvergenceMax: 3.0,    // 前一日三線價差 <= 3%
      requireMa20Rising: true,    // [底層靈魂條件] 當日 20MA > 前一日 20MA
    },
  },

  // Mode 3 - 動能攻擊 (Momentum Breakout)
  MOMENTUM_BREAKOUT: {
    id: 'MOMENTUM_BREAKOUT',
    label: '動能攻擊',
    description: '剛結束打底、今日帶量出第一根紅棒的發動股（參與 D4）',
    defaultParams: {
      maAboveMode: 'BOTH',        // (嚴) 同時站穩 5MA 與 10MA
      checkConvergence: true,     // 當日三線價差開關
      convergenceMax: 8.0,        // 當日三線價差 <= 8%
      checkPrevConvergence: true, // [新條件] 前一日三線價差開關
      prevConvergenceMax: 3.0,    // 前一日三線價差 <= 3%
      bias5Min: 0.0,              // 5MA 乖離率下限 (%)
      bias5Max: 8.0,              // 5MA 乖離率上限 (%)
      bias20Min: 0.0,             // 20MA 乖離率下限 (%)
      bias20Max: 12.0,            // 20MA 乖離率上限 (%)
      requireMa20Rising: false,   // 是否要求月線斜率向上
    },
  },
}

export const DEFAULT_MODE = 'BOTTOM_CONSOLIDATION'
