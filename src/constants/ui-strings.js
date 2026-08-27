/**
 * UI 文字統一管理
 * 規範：index.html、App.vue、所有元件嚴禁出現硬編碼中文字串
 * 所有面向使用者的文字必須從這裡引用
 */

export const UI_STRINGS = {
  APP: {
    title: '豐盛幫手',
    tagline: '盤中即時 · 尾盤篩選',
  },

  MARKET_REGIME: {
    SAFE: { badge: '多頭順風', title: '市場多頭順風，可執行操作' },
    CAUTION: { badge: '震盪回檔', title: '指數破 5MA，建議減量防守' },
    DANGER: { badge: '系統性風險', title: '破月線，建議空手觀望' },
  },

  SCREENER: {
    updateBtn: '取得最新價格',
    updatingBtn: '更新中…',
    resultCount: (n) => `符合 ${n} 檔`,
    noResult: '無符合條件的個股',
    disposed: '處置',
    lastUpdated: (t) => `更新於 ${t}`,
  },

  STOCK_TABLE: {
    headers: {
      code: '代號',
      name: '名稱',
      price: '現價',
      change: '漲跌',
      changePct: '漲跌幅',
      volume: '量(張)',
      ma5: '5MA',
      ma20: '月線',
      bias5: '5MA乖離',
      bias20: '月乖離',
      kd: 'KD',
      sparkline: '近10日',
    },
  },

  KD_STATUS: {
    golden: '黃金交叉',
    death: '死亡交叉',
    hot: '超買過熱',
    low: '低檔整理',
    mid: '中檔震盪',
  },

  CATEGORY_TAGS: {
    '0050': '0050',
    '0051': '0051',
    'SitcaBuy3D': '投信3D',
    'SitcaBuy5D': '投信5D',
    'ForeignBuy1D': '外資1D',
    'ForeignBuy3D': '外資3D',
    'MajorBuy1D': '主力1D',
    'MajorBuy3D': '主力3D',
    'Top100': '量大',
    'ValueTop': '值大',
    'TurnoverRate': '週轉',
    '半導體': '半導體',
  },

  SELL_WARNINGS: {
    foreign: '外資賣超',
    major: '主力賣超',
    sitca: '投信賣超',
    foreignSitca: '法人賣超',
    foreignMajor: '外資/主力賣超',
    sitcaMajor: '投信/主力賣超',
    all: '法人/主力賣超',
  },
  METRICS: {
    ma5: 'MA5',
    ma10: 'MA10',
    ma20: 'MA20',
    ma60: 'MA60',
    volume: '量(張)',
    mv5: 'MV5',
    mv10: 'MV10',
    kd: 'KD',
    expectedProfit: '預期純利',
    ceiling: '關卡',
  },

  ACTIONS: {
    copy: '複製',
    copied: '已複製',
    chips: '籌碼',
    bullbear: '多空',
    margin: '資券',
    afterMarket: '盤後',
    details: '詳情',
  },

  PANEL: {
    title: '篩選條件',
    resetBtn: '重設為預設值',
    bias5Range: '5MA 乖離率 (%)',
    bias20Range: '月線乖離率 (%)',
    minVolume: '最低成交量 (張)',
    requireVolContraction: '要求量縮整理',
    requireRedCandle: '要求實體紅 K',
    to: '至',
  },

  API_SETTINGS: {
    modalTitle: '行情 API 設定',
    modalDesc: '請輸入 GCP Cloud Function 即時行情代理微服務網址。',
    urlLabel: 'GCP Function 網址',
    urlPlaceholder: 'https://asia-east1-PROJECT.cloudfunctions.net/market-data-proxy',
    saveBtn: '儲存設定',
    clearBtn: '清除設定',
    closeBtn: '關閉',
    savedToast: '已儲存行情 API 網址',
    clearedToast: '已清除行情 API 網址',
    emptyNotice: '尚未設定行情 API 網址，請先點擊設定',
  },

  REALTIME: {
    fetchBtn: '取得最新價格',
    fetchingBtn: '更新中…',
    fetchSuccess: (count) => `已更新 ${count} 筆即時行情`,
    missingWarning: (missingCount) => `即時行情有 ${missingCount} 筆資料未回傳，嚴禁使用舊資料補齊，請重新整理或稍候再試`,
    fetchFailed: '連線行情 API 失敗，請檢查網址、CORS 或網路狀態',
    lastUpdated: (t) => `即時更新於 ${t}`,
  },
}

