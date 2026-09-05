/**
 * 選股模式定義
 *
 * 規範：
 * - 集中管理選股模式與各模式預設參數
 * - 新增模式：在此新增設定物件即可，不需修改核心引擎或 UI 程式碼
 */

import { UI_STRINGS } from './ui-strings.js'

export const SCREENER_MODES = {
  // Mode 1 - 跌深反轉 (Bottom Reversal)
  BOTTOM_REVERSAL: {
    id: 'BOTTOM_REVERSAL',
    label: UI_STRINGS.SCREENER_MODES.BOTTOM_REVERSAL.label,
    description: UI_STRINGS.SCREENER_MODES.BOTTOM_REVERSAL.description,
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
      excludeSell3D: true,            // 隱藏外資 / 主力 / 投信賣超 3D (含 0050 豁免)
      excludeSell1D: false,           // 隱藏外資 / 主力賣超 1D

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
    premiumParams: {
      minVolume: 2000,                // 流動性拉高至 2000 張
      minRedCandleChangePct: 3.5,     // 實體紅 K 漲幅拉高至 3.5%
      kdKMax: 25,                     // K 值上限由 40 縮至 25 (極端超賣)
    },
  },

  // Mode 2 - 底部蓄勢 (Bottom Consolidation)
  BOTTOM_CONSOLIDATION: {
    id: 'BOTTOM_CONSOLIDATION',
    label: UI_STRINGS.SCREENER_MODES.BOTTOM_CONSOLIDATION.label,
    description: UI_STRINGS.SCREENER_MODES.BOTTOM_CONSOLIDATION.description,
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
      excludeSell3D: true,            // 隱藏外資 / 主力 / 投信賣超 3D (含 0050 豁免)
      excludeSell1D: false,           // 隱藏外資 / 主力賣超 1D

      checkAvoidLongBlack: true,      // 排除長黑倒貨
      blackCandleRatioMax: 0.20,
      checkKd: true,                  // KD 脫離超賣區
      kdKMin: 20,                     // 20 <= K <= 60
      kdKMax: 60,
      kdRequireCross: true,           // K > D 黃金交叉
    },
    premiumParams: {
      convergenceMax: 2.0,            // 三線價差壓縮至 2% 以內
      tightChgMin: -1.0,              // 振幅限制在正負 1% 內
      tightChgMax: 1.0,
      bias20Max: 5.0,                 // 月線乖離上限壓低至 5%
    },
  },

  // Mode 3 - 動能攻擊 (Momentum Breakout)
  MOMENTUM_BREAKOUT: {
    id: 'MOMENTUM_BREAKOUT',
    label: UI_STRINGS.SCREENER_MODES.MOMENTUM_BREAKOUT.label,
    description: UI_STRINGS.SCREENER_MODES.MOMENTUM_BREAKOUT.description,
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
      excludeSell3D: true,          // 隱藏外資 / 主力 / 投信賣超 3D (含 0050 豁免)
      excludeSell1D: true,           // 隱藏外資 / 主力賣超 1D (發動日嚴禁當日倒貨)
      checkRedCandle: true,         // 實體攻擊紅 K (收 > 開 且 漲幅 >= 1.5%)
      minRedCandleChangePct: 1.5,
      checkAvoidLongUpperShadow: true, // 排除長上影線避雷針 (上影線 <= 實體紅K一半)
      checkKd: true,                // KD 強勢攻擊區
      kdKMin: 50,                   // K > 50
      kdKMax: 100,
      kdRequireCross: true,         // K > D 黃金交叉
    },
    premiumParams: {
      minVolume: 2000,              // 門檻拉高至 2000 張
      prevConvergenceMax: 2.0,      // 昨日三線價差緊縮至 2.0%
      minRedCandleChangePct: 3.0,   // 攻擊紅 K 漲幅至少 3.0% 以上
    },
  },

  // Mode 4 - 多頭回測 (Trend Pullback)
  TREND_PULLBACK: {
    id: 'TREND_PULLBACK',
    label: UI_STRINGS.SCREENER_MODES.TREND_PULLBACK.label,
    description: UI_STRINGS.SCREENER_MODES.TREND_PULLBACK.description,
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
      checkVolPullbackStrict: false,// 嚴格 AND 雙重量縮 (一鍵精選啟用)
      excludeSell3D: true,          // 隱藏外資 / 主力 / 投信賣超 3D (含 0050 豁免)
      excludeSell1D: false,         // 隱藏外資 / 主力賣超 1D
      checkAvoidLongBlack: true,    // 排除長黑倒貨 (實體黑K跌幅 >= 1.5% 且收相對低 <= 25%)
      blackCandleRatioMax: 0.25,
      checkKd: true,                // KD 多頭回檔
      kdKMin: 40,                   // 40 <= K <= 75
      kdKMax: 75,
      kdRequireCross: false,
    },
    premiumParams: {
      bias5Min: -1.5,               // 緊貼 5MA (-1.5% ~ +1.5%)
      bias5Max: 1.5,
      checkVolPullbackStrict: true, // 嚴格 AND 雙重量縮 (量 < 5MA均量 AND 量 < 昨日量)
    },
  },

  // Mode 5 - 洗盤起漲 (Washout Ignition)
  WASHOUT_IGNITION: {
    id: 'WASHOUT_IGNITION',
    label: UI_STRINGS.SCREENER_MODES.WASHOUT_IGNITION.label,
    description: UI_STRINGS.SCREENER_MODES.WASHOUT_IGNITION.description,
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
      excludeSell3D: true,            // 隱藏外資 / 主力 / 投信賣超 3D (含 0050 豁免)
      excludeSell1D: true,            // 隱藏外資 / 主力賣超 1D (發動日嚴禁當日倒貨)

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
    premiumParams: {
      minVolume: 2000,                // 門檻拉高至 2000 張
      minRedCandleChangePct: 3.5,     // 實體紅 K 漲幅拉高至 3.5%
      kdKMax: 55,                     // K 值上限壓低至 55
    },
  },
}

export const DEFAULT_MODE = 'ALL'
