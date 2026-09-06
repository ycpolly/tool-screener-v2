/**
 * 台股升降單位 (Tick Size) 與價格速算邏輯
 * 依據台灣證券交易所 (TWSE) 與證券櫃檯買賣中心 (TPEx) 升降單位規定：
 * - 未滿 10 元：0.01 元
 * - 10 元至未滿 50 元：0.05 元
 * - 50 元至未滿 100 元：0.10 元
 * - 100 元至未滿 500 元：0.50 元
 * - 500 元至未滿 1000 元：1.00 元
 * - 1000 元以上：5.00 元
 */

/**
 * 取得台股股價對應之升降單位 (Tick Size)
 * @param {number} price 
 * @returns {number}
 */
export function getTickSize(price) {
  if (price < 10) return 0.01
  if (price < 50) return 0.05
  if (price < 100) return 0.10
  if (price < 500) return 0.50
  if (price < 1000) return 1.00
  return 5.00
}

/**
 * 將價格對齊最近的合法跳動檔位 (四捨五入)
 * @param {number} price 
 * @returns {number}
 */
export function roundToTick(price) {
  if (price <= 0) return 0
  const tick = getTickSize(price)
  const steps = Math.round(price / tick)
  const rounded = Number((steps * tick).toFixed(4))
  // 二次檢查跨級距 (例如 49.99 跨到 50.05 不符合 50 以上跳 0.1 的規則)
  const newTick = getTickSize(rounded)
  if (newTick !== tick) {
    const newSteps = Math.round(rounded / newTick)
    return Number((newSteps * newTick).toFixed(2))
  }
  return Number(rounded.toFixed(2))
}

/**
 * 取得官方當日漲停價 (+10% 無條件捨去至該跳動單位，不得超過 10%)
 * @param {number} prevClose 
 * @returns {number}
 */
export function getLimitUpPrice(prevClose) {
  if (!prevClose || prevClose <= 0) return 0
  const rawMax = Number((prevClose * 1.10).toFixed(4))
  const tick = getTickSize(rawMax)
  const steps = Math.floor(rawMax / tick + 1e-9)
  return Number((steps * tick).toFixed(2))
}

/**
 * 格式化台股價格
 * < 50: 2位小數 (24.60)
 * 50 ~ 500: 1位小數 (104.0, 104.5)
 * >= 500: 整數 (520, 1050)
 * @param {number} price 
 * @returns {string}
 */
export function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price)) return '--'
  const p = Number(price)
  if (p < 50) return p.toFixed(2)
  if (p < 500) return p.toFixed(1)
  return p.toFixed(0)
}

/**
 * 計算由高至低 (+10% 至 +1%) 的雙欄速算目標價
 * @param {number} price 當前現價
 * @param {number} prevClose 前一日收盤價
 * @returns {Array<{ pct: number, pctLabel: string, curPrice: string, prevPrice: string }>}
 */
export function calculateQuickCalcTable(price, prevClose) {
  const pcts = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  const validPrice = typeof price === 'number' && price > 0 ? price : 0
  const validPrev = typeof prevClose === 'number' && prevClose > 0 ? prevClose : validPrice

  return pcts.map((pct) => {
    // 基於現價
    const curVal = validPrice > 0 ? roundToTick(validPrice * (1 + pct / 100)) : 0
    // 基於昨收 (10% 依官方漲停規則)
    const prevVal = validPrev > 0
      ? (pct === 10 ? getLimitUpPrice(validPrev) : roundToTick(validPrev * (1 + pct / 100)))
      : 0

    return {
      pct,
      pctLabel: `+${pct}%`,
      curPrice: curVal > 0 ? formatPrice(curVal) : '--',
      prevPrice: prevVal > 0 ? formatPrice(prevVal) : '--',
    }
  })
}
