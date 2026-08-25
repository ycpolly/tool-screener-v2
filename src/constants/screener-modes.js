/**
 * 選股模式定義
 *
 * 新增模式：在這裡加入新物件即可，不需修改任何引擎或 UI 程式碼
 */

export const SCREENER_MODES = {
  LOW_ENTRY: {
    id: 'LOW_ENTRY',
    label: '低接卡位',
    description: '量縮整理、站穩均線、KD 中低檔',
    defaultParams: {
      bias5Min: -3.0,
      bias5Max: 5.0,
      bias20Min: -2.0,
      bias20Max: 8.0,
      minVolume: 1000,
      kdMode: 'low',        // 'low' | 'momentum'
      requireVolContraction: true,
      requireRedCandle: false,
    },
  },
  MOMENTUM: {
    id: 'MOMENTUM',
    label: '爆量走強',
    description: '放量攻擊、實體紅K、KD 高檔強勢',
    defaultParams: {
      bias5Min: 0.0,
      bias5Max: 8.0,
      bias20Min: 0.0,
      bias20Max: 12.0,
      minVolume: 1000,
      kdMode: 'momentum',
      requireVolContraction: false,
      requireRedCandle: true,
    },
  },
  // 預留位置：未來新增模式
  // REVERSAL: { ... },
  // BREAKOUT: { ... },
}

export const DEFAULT_MODE = 'LOW_ENTRY'
