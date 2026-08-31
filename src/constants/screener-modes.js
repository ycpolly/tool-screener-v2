/**
 * 選股模式定義
 *
 * 規範：
 * - 集中管理選股模式與各模式預設參數
 * - 新增模式：在此新增設定物件即可，不需修改核心引擎或 UI 程式碼
 */

export const SCREENER_MODES = {
  // Mode 1 - 跌深反轉 (Bottom Reversal)
  BOTTOM_REVERSAL: {
    id: 'BOTTOM_REVERSAL',
    label: '跌深反轉',
    description: '空頭超賣區爆量收紅，V型反轉發動日',
    defaultParams: {
      // 均線位階與乖離
      maAboveMode: 'NONE',            // (預設) 無限制，由乖離區間精準控管
      bias5Min: -5.0,                 // 5MA 乖離率 -5% ~ +5% (允許強彈逼近短均線)
      bias5Max: 5.0,
      bias20Min: -30.0,               // 20MA 乖離率 -30% ~ -2% (強制在月線之下，確保絕對跌深)
      bias20Max: -2.0,
      requireAboveMa60: false,        // 不啟用季線防護 (跌深股必在季線下)
      requireMa20Rising: false,       // 不強制月線向上 (空頭反彈時月線通常向下)

      // 均線糾結度
      checkConvergence: false,        // 不啟用當日糾結 (空頭均線呈向下發散)
      convergenceMax: 8.0,
      checkPrevConvergence: false,    // 不啟用前日糾結
      prevConvergenceMax: 3.0,

      // 量能與流動性
      minVolume: 1000,                // 當日成交量 >= 1000 張
      checkMinVolume: true,
      checkNotDisposed: true,         // 排除處置股
      checkVolExpansion: true,        // 低檔爆量攻擊 (當日量 > 5日量均)

      // K 棒型態排雷
      checkRedCandle: true,           // 實體反轉紅 K (收盤 > 開盤 且 漲幅 >= 2%)
      minRedCandleChangePct: 2.0,
      checkAvoidLongUpperShadow: true,// 排除長上影線 (上影線 <= 實體一半)

      // KD 動能輔助
      checkKd: true,                  // KD 輔助
      kdKMin: 10,                     // 低檔超賣區轉折 (K 介於 10 ~ 40)
      kdKMax: 40,
      kdRequireCross: true,           // KD 黃金交叉 (K > D)
    },
  },

  // Mode 2 - 底部蓄勢 (Bottom Consolidation)
  BOTTOM_CONSOLIDATION: {
    id: 'BOTTOM_CONSOLIDATION',
    label: '底部蓄勢',
    description: '尋找籌碼乾淨、極致壓縮股（參與 D1-D3）',
    defaultParams: {
      // 均線與位階
      maAboveMode: 'BOTH',            // (嚴) 同時站穩 5MA 與 10MA
      requireAboveMa60: true,         // [新增] 站穩季線防身 (收盤價 >= 60MA)
      checkConvergence: true,         // 當日三線價差開關
      convergenceMax: 3.0,            // 當日三線價差 <= 3%
      bias5Min: -2.0,                 // 5MA 乖離率下限 (%)
      bias5Max: 3.0,                  // 5MA 乖離率上限 (%)
      bias20Min: 0.0,                 // 20MA 乖離率下限 (%)
      bias20Max: 8.0,                 // 20MA 乖離率上限 (%)
      checkPrevConvergence: false,    // 前一日三線價差開關
      prevConvergenceMax: 3.0,
      requireMa20Rising: false,

      // 量能與流動性
      minVolume: 500,                 // 當日成交量 >= 500 張
      checkMinVolume: true,
      checkNotDisposed: true,         // 排除處置股
      checkVolContraction: true,      // 量縮洗盤 (當日量 <= 5日均量)
      volContractionRatio: 1.0,       // [更新] 當日成交量 <= 5日均量 * 1.0
      checkTightConsolidation: true,  // [新增] 狹幅震盪打底
      tightChgMin: -1.5,              // [新增] 當日漲跌幅下限 -1.5%
      tightChgMax: 1.5,               // [新增] 當日漲跌幅上限 +1.5% (排除噴出假蓄勢)

      checkAvoidLongBlack: true,      // 排除長黑倒貨
      blackCandleRatioMax: 0.20,
      checkKd: true,                  // KD 脫離超賣區
      kdKMin: 20,                     // 20 <= K <= 60
      kdKMax: 60,
      kdRequireCross: true,           // K > D 黃金交叉
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
      requireAboveMa60: false,
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
      minRedCandleChangePct: 1.5,
      checkAvoidLongUpperShadow: true, // 排除長上影線避雷針 (上影線 <= 實體紅K一半)
      checkKd: true,                // KD 強勢攻擊區
      kdKMin: 50,                   // K > 50
      kdKMax: 100,
      kdRequireCross: true,         // K > D 黃金交叉
    },
  },

  // Mode 4 - 多頭回測 (Trend Pullback)
  TREND_PULLBACK: {
    id: 'TREND_PULLBACK',
    label: '多頭回測',
    description: '多頭趨勢中，量縮拉回找支撐的強勢中繼股',
    defaultParams: {
      // 均線與糾結
      maAboveMode: 'ANY',           // (寬) 站穩 5MA 或 10MA
      requireAboveMa60: false,
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

  // Mode 5 - 洗盤起漲 (Washout Ignition)
  WASHOUT_IGNITION: {
    id: 'WASHOUT_IGNITION',
    label: '洗盤起漲',
    description: '趨勢多頭、指標降溫後再度帶量攻擊起漲',
    defaultParams: {
      // 均線與位階
      maAboveMode: 'BOTH',            // (嚴) 同時站穩 5MA 與 10MA
      requireAboveMa60: false,
      bias5Min: 0.0,                  // 5MA 乖離率 0% ~ +8% (發動日必站上短均)
      bias5Max: 8.0,
      bias20Min: 2.0,                 // 20MA 乖離率 +2% ~ +20% (強迫股價在月線之上)
      bias20Max: 20.0,
      requireMa20Rising: true,        // 今日 20MA > 昨日 20MA (月線斜率向上)
      checkConvergence: false,        // 不啟用當日糾結 (洗盤剛結束，均線通常有開口)
      convergenceMax: 8.0,
      checkPrevConvergence: false,    // 不啟用前日糾結
      prevConvergenceMax: 3.0,

      // 量能與流動性
      minVolume: 1000,                // 當日成交量 >= 1000 張
      checkMinVolume: true,
      checkNotDisposed: true,         // 排除處置股
      checkVolExpansion: true,        // 洗盤後帶量攻擊 (當日成交量 > 5日均量)

      // K 棒型態排雷
      checkRedCandle: true,           // 實體攻擊紅 K (收盤 > 開盤)
      minRedCandleChangePct: 2.0,     // 漲幅 >= 2.0%
      checkAvoidLongUpperShadow: true,// 排除長上影線 (上影線 <= 實體一半)

      // KD 動能輔助
      checkKd: true,                  // KD 輔助
      kdKMin: 30,                     // 中檔降溫區 (K 介於 30 ~ 65)
      kdKMax: 65,
      kdRequireCross: true,           // KD 多頭排列 (K > D)
    },
  },
}

export const DEFAULT_MODE = 'ALL'
