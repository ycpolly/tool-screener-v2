/**
 * screener.js — 純演算法引擎
 *
 * 規範：
 * - 本模組不得含有任何 DOM 操作（document / window / innerHTML 等）
 * - 輸入：股票資料陣列 + 篩選條件物件
 * - 輸出：篩選結果陣列
 * - 可直接 `node screener.js` 執行測試
 */

/**
 * 過濾無效股票代碼（排除 ETF、權證）
 * @param {string} code
 * @returns {boolean}
 */
export function isValidStockCode(code) {
  if (!code) return false
  const s = String(code).trim()
  if (s.startsWith('00')) return false
  if (s.length > 4) return false
  return true
}

/**
 * 即時合體：將歷史基底與即時行情合併，重算當日指標
 * @param {Object} baseStock - stock-pool.json 中的個股基底
 * @param {Object} quote     - GCP 即時行情回傳的個股報價
 * @returns {Object}         - 合體後的完整個股物件
 */
export function mergeRealtimeQuote(baseStock, quote) {
  if (!quote || !quote.price) return baseStock

  const price = quote.price

  // 即時重算均線（今日價替換基底最後一筆）
  const ma5  = baseStock.ma5  // 盤中使用基底均線，精確重算由 GCP 側完成
  const ma20 = baseStock.ma20

  return {
    ...baseStock,
    price,
    open:    quote.open    ?? baseStock.open,
    high:    quote.high    ?? baseStock.high,
    low:     quote.low     ?? baseStock.low,
    volume:  quote.volume  ?? baseStock.volume,
    change:  price - (baseStock.prevClose ?? price),
    changePct: baseStock.prevClose
      ? ((price - baseStock.prevClose) / baseStock.prevClose) * 100
      : 0,
  }
}

/**
 * 執行選股篩選
 * @param {Object[]} stocks   - 完整個股陣列（已合體即時行情）
 * @param {Object}   params   - 篩選條件參數
 * @returns {Object[]}        - 符合條件的個股陣列
 */
export function runScreener(stocks, params) {
  return stocks.filter(stock => evaluate(stock, params))
}

/**
 * 評估單一個股是否通過篩選條件
 * @param {Object} stock
 * @param {Object} params
 * @returns {boolean}
 */
function evaluate(stock, params) {
  // TODO: Phase 2 實作各篩選條件
  // 目前回傳全部通過，供 Phase 1 UI 開發使用
  return true
}
