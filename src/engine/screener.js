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
 * 計算四捨五入至小數第 2 位
 * @param {number} val
 * @returns {number}
 */
function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

/**
 * 動態產生大盤指數狀態描述
 * @param {number} price
 * @param {number} ma5
 * @param {number} ma20
 * @param {number} chgPct
 * @returns {string}
 */
function computeIndexStatusDesc(price, ma5, ma20, chgPct) {
  const sign = chgPct >= 0 ? '+' : ''
  const chgStr = `${sign}${chgPct.toFixed(2)}%`
  if (price < ma20) {
    return chgPct >= 0 ? `月線下方弱勢反彈 (${chgStr})` : `破月線空頭下殺 (${chgStr})`
  }
  if (price < ma5) {
    return `回測月線震盪 (破5MA) (${chgStr})`
  }
  if (price >= ma5 && price >= ma20 && ma5 >= ma20) {
    return `多頭強勢攻擊 (${chgStr})`
  }
  return `多頭震盪整理 (${chgStr})`
}

/**
 * 判定大盤多空燈號 (SAFE / CAUTION / DANGER)
 * @param {Object} taiex
 * @param {Object} otc
 * @returns {Object}
 */
function evaluateMarketRegime(taiex, otc) {
  function isDanger(idx) {
    if (!idx || !idx.price) return false
    const price = idx.price
    const ma20 = idx.ma20 ?? price
    const belowMa20 = price < ma20
    const kd = idx.kd ?? {}
    const k = kd.k ?? 50
    const pk = kd.prevK ?? 50
    const d = kd.d ?? 50
    const kdFalling = k <= d && k < pk
    const crash = (idx.changePct ?? 0) < -1.2 && kdFalling
    return belowMa20 || crash
  }

  function isCaution(idx) {
    if (!idx || !idx.price) return false
    const price = idx.price
    const ma5 = idx.ma5 ?? price
    const ma10 = idx.ma10 ?? price
    const ma20 = idx.ma20 ?? price
    const aboveMa20 = price >= ma20
    const brokeShort = price < ma5 || price < ma10
    const mildPullback = (idx.changePct ?? 0) >= -1.2 && (idx.changePct ?? 0) <= -0.8
    return (brokeShort && aboveMa20) || mildPullback
  }

  if (isDanger(taiex) || isDanger(otc)) {
    return {
      code: 'DANGER',
      badge: '系統性風險',
      title: '系統總風控判定：市場處於系統性風險（建議空手觀望）',
      subtitle: '大盤或櫃買遭遇系統性賣壓，破月線風險高。建議維持空手，勿盲目抄底。',
    }
  }

  if (isCaution(taiex) || isCaution(otc)) {
    return {
      code: 'CAUTION',
      badge: '震盪回檔',
      title: '系統總風控判定：市場震盪回檔（建議減量防守）',
      subtitle: '指數跌破 5MA 但守在月線之上，建議減量至 3-5 成，暫停追高。',
    }
  }

  return {
    code: 'SAFE',
    badge: '多頭順風',
    title: '系統總風控判定：市場多頭順風（可執行波段操作）',
    subtitle: '加權與櫃買結構健康，多頭均線排列，適合執行低接與爆量操作。',
  }
}

/**
 * 即時合體：將歷史基底個股與即時行情合併，重算當日指標
 * @param {Object} baseStock - stock-pool.json 中的個股基底
 * @param {Object} quote     - GCP 即時行情回傳的個股報價
 * @returns {Object}         - 合體後的完整個股物件
 */
export function mergeRealtimeQuote(baseStock, quote) {
  if (!quote || typeof quote.price !== 'number' || quote.price <= 0) {
    return baseStock
  }

  const price = quote.price
  const prevClose = (typeof quote.prevClose === 'number' && quote.prevClose > 0)
    ? quote.prevClose
    : (baseStock.prevClose ?? price)

  const change = (typeof quote.change === 'number')
    ? quote.change
    : round2(price - prevClose)

  const changePct = prevClose > 0
    ? round2(((price - prevClose) / prevClose) * 100)
    : (quote.changePct ?? 0)

  const ma5 = baseStock.ma5 ?? 0
  const ma20 = baseStock.ma20 ?? 0

  const bias5 = ma5 > 0 ? round2(((price - ma5) / ma5) * 100) : 0
  const bias20 = ma20 > 0 ? round2(((price - ma20) / ma20) * 100) : 0

  return {
    ...baseStock,
    price,
    prevClose,
    open:      quote.open    ?? baseStock.open ?? price,
    high:      quote.high    ?? baseStock.high ?? price,
    low:       quote.low     ?? baseStock.low  ?? price,
    volume:    quote.volume  ?? baseStock.volume ?? 0,
    change,
    changePct,
    bias5,
    bias20,
  }
}

/**
 * 即時合體：將大盤基底與加權 (t00) 及櫃買 (o00) 即時行情合併
 * @param {Object} baseMarket - stock-pool.json 中的 market 物件
 * @param {Object} quotesMap  - GCP 即時行情回傳的報價 Map
 * @returns {Object}          - 更新後的大盤與風控燈號物件
 */
export function mergeMarketQuotes(baseMarket, quotesMap = {}) {
  if (!baseMarket) return baseMarket

  const newMarket = JSON.parse(JSON.stringify(baseMarket))

  // 更新加權指數 (t00)
  const t00 = quotesMap['t00']
  if (t00 && typeof t00.price === 'number' && t00.price > 0 && newMarket.taiex) {
    const price = t00.price
    const prevClose = (typeof t00.prevClose === 'number' && t00.prevClose > 0)
      ? t00.prevClose
      : newMarket.taiex.prevClose
    const changePrice = round2(price - prevClose)
    const changePct = prevClose > 0 ? round2((changePrice / prevClose) * 100) : 0
    const ma5 = newMarket.taiex.ma5 ?? price
    const ma20 = newMarket.taiex.ma20 ?? price
    const bias20 = ma20 > 0 ? round2(((price - ma20) / ma20) * 100) : 0

    newMarket.taiex.price = price
    newMarket.taiex.prevClose = prevClose
    newMarket.taiex.changePrice = changePrice
    newMarket.taiex.changePct = changePct
    newMarket.taiex.bias20 = bias20
    newMarket.taiex.statusDesc = computeIndexStatusDesc(price, ma5, ma20, changePct)
  }

  // 更新櫃買指數 (o00)
  const o00 = quotesMap['o00']
  if (o00 && typeof o00.price === 'number' && o00.price > 0 && newMarket.otc) {
    const price = o00.price
    const prevClose = (typeof o00.prevClose === 'number' && o00.prevClose > 0)
      ? o00.prevClose
      : newMarket.otc.prevClose
    const changePrice = round2(price - prevClose)
    const changePct = prevClose > 0 ? round2((changePrice / prevClose) * 100) : 0
    const ma5 = newMarket.otc.ma5 ?? price
    const ma20 = newMarket.otc.ma20 ?? price
    const bias20 = ma20 > 0 ? round2(((price - ma20) / ma20) * 100) : 0

    newMarket.otc.price = price
    newMarket.otc.prevClose = prevClose
    newMarket.otc.changePrice = changePrice
    newMarket.otc.changePct = changePct
    newMarket.otc.bias20 = bias20
    newMarket.otc.statusDesc = computeIndexStatusDesc(price, ma5, ma20, changePct)
  }

  // 重新判定整體市場風控燈號
  newMarket.regime = evaluateMarketRegime(newMarket.taiex, newMarket.otc)

  return newMarket
}

/**
 * 批次將即時行情合體至所有個股與大盤
 * @param {Object[]} baseStocks
 * @param {Object}   baseMarket
 * @param {Object}   quotesMap
 * @returns {{ stocks: Object[], market: Object }}
 */
export function mergeAllRealtimeQuotes(baseStocks = [], baseMarket = null, quotesMap = {}) {
  if (!quotesMap || Object.keys(quotesMap).length === 0) {
    return { stocks: baseStocks, market: baseMarket }
  }

  const mergedStocks = baseStocks.map(stock => {
    const quote = quotesMap[stock.code]
    return quote ? mergeRealtimeQuote(stock, quote) : stock
  })

  const mergedMarket = baseMarket ? mergeMarketQuotes(baseMarket, quotesMap) : baseMarket

  return {
    stocks: mergedStocks,
    market: mergedMarket,
  }
}

/**
 * 執行選股篩選
 * @param {Object[]} stocks   - 完整個股陣列（已合體即時行情）
 * @param {Object}   params   - 篩選條件參數
 * @returns {Object[]}        - 符合條件的個股陣列
 */
export function runScreener(stocks, params) {
  if (!Array.isArray(stocks)) return []
  return stocks.filter(stock => evaluate(stock, params))
}

/**
 * 評估單一個股是否通過篩選條件
 * @param {Object} stock
 * @param {Object} params
 * @returns {boolean}
 */
function evaluate(stock, params) {
  // 目前回傳全部通過，供 Phase 1 / Phase 2 UI 開發使用，Phase 3 將補齊完整篩選規則
  return true
}
