/**
 * market-holidays.js
 * 台灣證券交易所 (TWSE) 官方公佈之全年度休市日與補假行事曆
 *
 * 來源：TWSE OpenAPI (https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule)
 * 用途：
 *   1. 離線防禦：在未呼叫即時行情前，防止時光機在國定假日/補假日誤判為開盤日
 *   2. 線上動態擴充：支援即時行情偵測到天然災害（颱風假）或未開盤撮合時動態登錄
 */

export const MARKET_HOLIDAYS_2026 = {
  // 元旦
  '2026-01-01': { name: '中華民國開國紀念日', description: '依規定放假 1 日。' },

  // 農曆除夕及春節（含封關結算交割無交易日）
  '2026-02-12': { name: '市場無交易，僅辦理結算交割作業', description: '春節前封關結算，市場無交易。' },
  '2026-02-13': { name: '市場無交易，僅辦理結算交割作業', description: '春節前封關結算，市場無交易。' },
  '2026-02-15': { name: '農曆除夕及春節', description: '春節連假。' },
  '2026-02-16': { name: '農曆除夕及春節', description: '春節連假。' },
  '2026-02-17': { name: '農曆除夕及春節', description: '春節連假。' },
  '2026-02-18': { name: '農曆除夕及春節', description: '春節連假。' },
  '2026-02-19': { name: '農曆除夕及春節', description: '春節連假。' },
  '2026-02-20': { name: '農曆除夕及春節補假', description: '春節適逢星期日，於 2 月 20 日（星期五）補假。' },

  // 和平紀念日
  '2026-02-27': { name: '和平紀念日補假', description: '和平紀念日 2 月 28 日適逢星期六，於 2 月 27 日（星期五）補假。' },
  '2026-02-28': { name: '和平紀念日', description: '依規定放假 1 日。' },

  // 兒童節及民族掃墓節（清明連假）
  '2026-04-03': { name: '兒童節補假', description: '兒童節 4 月 4 日適逢星期六，於 4 月 3 日（星期五）補假。' },
  '2026-04-04': { name: '兒童節及民族掃墓節', description: '依規定放假 1 日。' },
  '2026-04-05': { name: '民族掃墓節', description: '依規定放假 1 日。' },
  '2026-04-06': { name: '民族掃墓節補假', description: '民族掃墓節 4 月 5 日適逢星期日，於 4 月 6 日（星期一）補假。' },

  // 勞動節
  '2026-05-01': { name: '勞動節', description: '依規定放假 1 日。' },

  // 端午節
  '2026-06-19': { name: '端午節', description: '依規定放假 1 日。' },

  // 中秋節
  '2026-09-25': { name: '中秋節', description: '依規定放假 1 日。' },

  // 孔子誕辰紀念日 / 教師節
  '2026-09-28': { name: '教師節', description: '依規定放假 1 日。' },

  // 國慶日
  '2026-10-09': { name: '國慶日補假', description: '國慶日 10 月 10 日適逢星期六，於 10 月 9 日（星期五）補假。' },
  '2026-10-10': { name: '國慶日', description: '依規定放假 1 日。' },

  // 臺灣光復紀念日
  '2026-10-25': { name: '臺灣光復紀念日', description: '依規定放假 1 日。' },
  '2026-10-26': { name: '臺灣光復紀念日補假', description: '臺灣光復紀念日 10 月 25 日適逢星期日，於 10 月 26 日（星期一）補假。' },

  // 行憲紀念日
  '2026-12-25': { name: '行憲紀念日', description: '依規定放假 1 日。' },
}

// 執行階段動態登錄之休市日（例如天然災害颱風假、臨時停止交易）
const _dynamicHolidays = new Map()

/**
 * 判斷指定日期 (YYYY-MM-DD) 是否為台股休市日
 * @param {string} dateStr - 格式 "YYYY-MM-DD"
 * @returns {boolean}
 */
export function isMarketHoliday(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false
  return Boolean(MARKET_HOLIDAYS_2026[dateStr] || _dynamicHolidays.has(dateStr))
}

/**
 * 取得休市日名稱或說明資訊
 * @param {string} dateStr - 格式 "YYYY-MM-DD"
 * @returns {{ name: string, description: string } | null}
 */
export function getMarketHolidayInfo(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  if (MARKET_HOLIDAYS_2026[dateStr]) {
    return MARKET_HOLIDAYS_2026[dateStr]
  }
  if (_dynamicHolidays.has(dateStr)) {
    return _dynamicHolidays.get(dateStr)
  }
  return null
}

/**
 * 動態登錄非預期休市日（如天然災害颱風假或交易所臨時未開盤）
 * @param {string} dateStr - 格式 "YYYY-MM-DD"
 * @param {string} [reason='天然災害休市或無撮合']
 */
export function registerDynamicHoliday(dateStr, reason = '天然災害休市或無撮合') {
  if (!dateStr || typeof dateStr !== 'string') return
  _dynamicHolidays.set(dateStr, {
    name: '臨時休市',
    description: reason,
  })
}
