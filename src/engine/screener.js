import { UI_STRINGS } from '../constants/ui-strings.js'

/**
 * screener.js — 純演算法引擎
 *
 * 規範：
 * - 本模組不得含有任何 DOM 操作（document / window / innerHTML 等）
 * - 輸入：股票資料陣列 + 篩選條件物件
 * - 輸出：篩選結果陣列
 * - 可直接 node screener.js 執行測試
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
 * 計算 5MA, 10MA, 20MA 均線糾結度（%）
 * 公式：(MAX(MA5, MA10, MA20) - MIN(MA5, MA10, MA20)) / MIN(MA5, MA10, MA20) * 100
 * @param {number} ma5
 * @param {number} ma10
 * @param {number} ma20
 * @returns {number}
 */
export function calculateMAConvergence(ma5, ma10, ma20) {
  if (!ma5 || !ma10 || !ma20 || ma5 <= 0 || ma10 <= 0 || ma20 <= 0) {
    return 999.0
  }
  const minMA = Math.min(ma5, ma10, ma20)
  const maxMA = Math.max(ma5, ma10, ma20)
  return round2(((maxMA - minMA) / minMA) * 100)
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
 * 評估單一個股是否通過篩選條件（均線支撐 / 糾結度 / 乖離區間 / 月線斜率）
 * @param {Object} stock - 個股物件
 * @param {Object} params - 篩選參數
 * @param {string} [activeModeId] - 當前選股模式 ID
 * @returns {{ isMatch: boolean, reasonText: string }}
 */
export function evaluateStock(stock, params = {}, activeModeId = '') {
  const strings = UI_STRINGS.FILTER_REASONS || {}

  // 1. 代碼檢驗
  if (!isValidStockCode(stock.code)) {
    return { isMatch: false, reasonText: strings.invalidCode || '非有效代碼' }
  }

  const price = stock.price ?? 0
  const ma5   = stock.ma5 ?? 0
  const ma10  = stock.ma10 ?? 0
  const ma20  = stock.ma20 ?? 0

  // 2. 5MA 乖離率檢驗
  const bias5 = typeof stock.bias5 === 'number'
    ? stock.bias5
    : (ma5 > 0 ? round2(((price - ma5) / ma5) * 100) : 0)

  if (typeof params.bias5Min === 'number' && bias5 < params.bias5Min) {
    return { isMatch: false, reasonText: strings.bias5Below ? strings.bias5Below(params.bias5Min, bias5) : '5MA乖離過低' }
  }
  if (typeof params.bias5Max === 'number' && bias5 > params.bias5Max) {
    return { isMatch: false, reasonText: strings.bias5Above ? strings.bias5Above(params.bias5Max, bias5) : '5MA乖離過高' }
  }

  // 3. 20MA 月線乖離率檢驗
  const bias20 = typeof stock.bias20 === 'number'
    ? stock.bias20
    : (ma20 > 0 ? round2(((price - ma20) / ma20) * 100) : 0)

  if (typeof params.bias20Min === 'number' && bias20 < params.bias20Min) {
    return { isMatch: false, reasonText: strings.bias20Below ? strings.bias20Below(params.bias20Min, bias20) : '20MA乖離過低' }
  }
  if (typeof params.bias20Max === 'number' && bias20 > params.bias20Max) {
    return { isMatch: false, reasonText: strings.bias20Above ? strings.bias20Above(params.bias20Max, bias20) : '20MA乖離過高' }
  }

  // 4. 均線支撐 (maAboveMode: 'BOTH' | 'ANY')
  if (params.maAboveMode === 'BOTH') {
    const standsBoth = price >= ma5 && price >= ma10
    if (!standsBoth) {
      return { isMatch: false, reasonText: strings.maAboveBothFailed || '未同時站穩 5MA 與 10MA' }
    }
  } else if (params.maAboveMode === 'ANY') {
    const standsAny = price >= ma5 || price >= ma10
    if (!standsAny) {
      return { isMatch: false, reasonText: strings.maAboveAnyFailed || '未站穩 5MA 或 10MA' }
    }
  }

  // 5. 當日三線價差糾結度 (checkConvergence)
  if (params.checkConvergence && typeof params.convergenceMax === 'number') {
    const conv = calculateMAConvergence(ma5, ma10, ma20)
    if (conv > params.convergenceMax) {
      return {
        isMatch: false,
        reasonText: strings.convergenceFailed ? strings.convergenceFailed(params.convergenceMax, conv) : `三線價差過大 (${conv}%)`,
      }
    }
  }

  // 6. 前一交易日三線價差糾結度 (checkPrevConvergence - Mode 3 專用)
  if (params.checkPrevConvergence && typeof params.prevConvergenceMax === 'number') {
    const history = stock.history10d
    const prevBar = Array.isArray(history) && history.length >= 2 ? history[history.length - 2] : null

    if (!prevBar || !prevBar.ma5 || !prevBar.ma10 || !prevBar.ma20) {
      return { isMatch: false, reasonText: '缺少前一交易日均線數據' }
    }

    const prevConv = calculateMAConvergence(prevBar.ma5, prevBar.ma10, prevBar.ma20)
    if (prevConv > params.prevConvergenceMax) {
      return {
        isMatch: false,
        reasonText: strings.prevConvergenceFailed ? strings.prevConvergenceFailed(params.prevConvergenceMax, prevConv) : `前一日三線價差過大 (${prevConv}%)`,
      }
    }
  }

  // 7. 月線斜率向上 (Mode 2 內建底層條件 / requireMa20Rising)
  if (params.requireMa20Rising || activeModeId === 'TREND_PULLBACK') {
    const history = stock.history10d
    const prevBar = Array.isArray(history) && history.length >= 2 ? history[history.length - 2] : null
    const prevMa20 = prevBar?.ma20

    if (typeof prevMa20 !== 'number' || ma20 <= prevMa20) {
      return { isMatch: false, reasonText: strings.ma20NotRising || '月線斜率未向上' }
    }
  }


  return { isMatch: true, reasonText: strings.passed || '符合篩選條件' }
}

/**
 * 執行選股篩選
 * @param {Object[]} stocks       - 完整個股陣列（已合體即時行情）
 * @param {Object}   params       - 篩選條件參數
 * @param {string}   [activeMode] - 當前選股模式 ID
 * @returns {Object[]}            - 符合條件的個股陣列（包含 filterEvaluation）
 */
export function runScreener(stocks = [], params = {}, activeMode = '') {
  if (!Array.isArray(stocks)) return []

  const results = []
  for (const stock of stocks) {
    const price = stock.price ?? 0
    const ma5   = stock.ma5 ?? 0
    const ma20  = stock.ma20 ?? 0

    const bias5 = typeof stock.bias5 === 'number'
      ? stock.bias5
      : (ma5 > 0 ? round2(((price - ma5) / ma5) * 100) : 0)

    const bias20 = typeof stock.bias20 === 'number'
      ? stock.bias20
      : (ma20 > 0 ? round2(((price - ma20) / ma20) * 100) : 0)

    const enrichedStock = {
      ...stock,
      bias5,
      bias20,
    }

    const evalResult = evaluateStock(enrichedStock, params, activeMode)
    enrichedStock.filterEvaluation = evalResult

    if (evalResult.isMatch) {
      results.push(enrichedStock)
    }
  }

  return results
}

