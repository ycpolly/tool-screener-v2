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
      // 均線與糾結
      maAboveMode: 'BOTH',          // (嚴) 同時站穩 5MA 與 10MA
      checkConvergence: true,       // 當日三線價差開關
      convergenceMax: 3.0,          // 當日三線價差 <= 3%
      bias5Min: -2.0,               // 5MA 乖離率下限 (%)
      bias5Max: 3.0,                // 5MA 乖離率上限 (%)
      bias20Min: 0.0,               // 20MA 乖離率下限 (%)
      bias20Max: 8.0,               // 20MA 乖離率上限 (%)
      checkPrevConvergence: false,  // 前一日三線價差開關
      prevConvergenceMax: 3.0,
      requireMa20Rising: false,

      // 量能與流動性
      minVolume: 500,               // 當日成交量 >= 500 張
      checkMinVolume: true,
      checkNotDisposed: true,       // 排除處置股
      checkVolContraction: true,    // 量縮洗盤 (當日量 < 5日量均)
      checkAvoidLongBlack: true,    // 排除長黑倒貨 (實體黑K跌幅 >= 1.5% 且收最低 <= 20%)
      blackCandleRatioMax: 0.20,
      checkKd: true,                // KD 脫離超賣區
      kdKMin: 20,                   // 20 <= K <= 60
      kdKMax: 60,
      kdRequireCross: true,         // K > D 黃金交叉
    },
  },

  // Mode 2 - 多頭回測 (Trend Pullback)
  TREND_PULLBACK: {
    id: 'TREND_PULLBACK',
    label: '多頭回測',
    description: '多頭趨勢中，量縮拉回找支撐的強勢中繼股',
    defaultParams: {
      // 均線與糾結
      maAboveMode: 'ANY',           // (寬) 站穩 5MA 或 10MA
      checkConvergence: true,       // 當日三線價差開關
      convergenceMax: 8.0,          // 當日三線價差 <= 8%
      bias5Min: -3.0,               // 5MA 乖離率下限 (%)
      bias5Max: 2.0,                // 5MA 乖離率上限 (%)
      bias20Min: 2.0,               // 20MA 乖離率下限 (%)
      bias20Max: 12.0,              // 20MA 乖離率上限 (%)
      checkPrevConvergence: false,
      prevConvergenceMax: 3.0,
      requireMa20Rising: true,      // [底層靈魂條件] 當日 20MA > 前一日 20MA

      // 量能與流動性
      minVolume: 500,               // 當日成交量 >= 500 張
      checkMinVolume: true,
      checkNotDisposed: true,       // 排除處置股
      checkVolPullback: true,       // 量縮回踩 (當日量 < 5日量均 或 < 昨日量)
      checkAvoidLongBlack: true,    // 排除長黑倒貨 (實體黑K跌幅 >= 1.5% 且收相對低 <= 25%)
      blackCandleRatioMax: 0.25,
      checkKd: true,                // KD 多頭回檔
      kdKMin: 40,                   // 40 <= K <= 75
      kdKMax: 75,
      kdRequireCross: false,
    },
  },

  // Mode 3 - 動能攻擊 (Momentum Breakout)
  MOMENTUM_BREAKOUT: {
    id: 'MOMENTUM_BREAKOUT',
    label: '動能攻擊',
    description: '剛結束打底、今日帶量出第一根紅棒的發動股（參與 D4）',
    defaultParams: {
      // 均線與糾結
      maAboveMode: 'BOTH',          // (嚴) 同時站穩 5MA 與 10MA
      checkConvergence: true,       // 當日三線價差開關
      convergenceMax: 8.0,          // 當日三線價差 <= 8%
      checkPrevConvergence: true,   // [新條件] 前一日三線價差開關
      prevConvergenceMax: 3.0,      // 前一日三線價差 <= 3%
      bias5Min: 0.0,                // 5MA 乖離率下限 (%)
      bias5Max: 8.0,                // 5MA 乖離率上限 (%)
      bias20Min: 0.0,               // 20MA 乖離率下限 (%)
      bias20Max: 12.0,              // 20MA 乖離率上限 (%)
      requireMa20Rising: false,

      // 量能與流動性
      minVolume: 1000,              // 當日成交量 >= 1000 張
      checkMinVolume: true,
      checkPrevVolContraction: true,// 昨日成交量 < 昨日 5 日量均 (MV5)
      checkNotDisposed: true,       // 排除處置股
      checkVolExpansion: true,      // 當日帶量攻擊 (當日量 > 5日量均)
      checkRedCandle: true,         // 實體攻擊紅 K (收 > 開 且 漲幅 >= 1.5%)
      checkAvoidLongUpperShadow: true, // 排除長上影線避雷針 (上影線 <= 實體紅K一半)
      checkKd: true,                // KD 強勢攻擊區
      kdKMin: 50,                   // K > 50
      kdKMax: 100,
      kdRequireCross: true,         // K > D 黃金交叉
    },
  },
}

export const DEFAULT_MODE = 'BOTTOM_CONSOLIDATION'
