import { UI_STRINGS } from '../constants/ui-strings.js'
import { SCREENER_MODES } from '../constants/screener-modes.js'

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
  const isLive = isLiveTradingDay(baseStock.history10d?.[baseStock.history10d.length - 1])
  const prevClose = (typeof quote.prevClose === 'number' && quote.prevClose > 0)
    ? quote.prevClose
    : (isLive && typeof baseStock.price === 'number' && baseStock.price > 0 ? baseStock.price : (baseStock.prevClose ?? price))

  const change = (typeof quote.change === 'number')
    ? quote.change
    : round2(price - prevClose)

  const changePct = (typeof quote.changePct === 'number' && !isNaN(quote.changePct))
    ? quote.changePct
    : (prevClose > 0 ? round2(((price - prevClose) / prevClose) * 100) : 0)


  const history = baseStock.history10d || []
  const len = history.length
  let ma5 = baseStock.ma5 ?? 0
  let ma10 = baseStock.ma10 ?? 0
  let ma20 = baseStock.ma20 ?? 0
  let vMa5 = baseStock.vMa5 ?? 0
  let vMa10 = baseStock.vMa10 ?? 0
  let kd = baseStock.kd

  if (isLive && len >= 4) {
    const last4 = history.slice(-4)
    ma5 = round2((last4.reduce((s, b) => s + (b.close || 0), 0) + price) / 5)

    if (len >= 9) {
      const last9 = history.slice(-9)
      ma10 = round2((last9.reduce((s, b) => s + (b.close || 0), 0) + price) / 10)

      if (typeof quote.volume === 'number' && quote.volume >= 0) {
        vMa5 = Math.round((last4.reduce((s, b) => s + (b.volume || 0), 0) + quote.volume) / 5)
        vMa10 = Math.round((last9.reduce((s, b) => s + (b.volume || 0), 0) + quote.volume) / 10)
      }
    }

    if (len >= 19) {
      const last19 = history.slice(-19)
      ma20 = round2((last19.reduce((s, b) => s + (b.close || 0), 0) + price) / 20)
    } else if (typeof baseStock.ma20 === 'number' && baseStock.ma20 > 0) {
      const offset = (price - (baseStock.price || price)) / 20
      ma20 = round2(baseStock.ma20 + offset)
    }

    // 動態推算盤中即時 KD(9,3)
    if (len >= 8) {
      const last8 = history.slice(-8)
      const pastHighs = last8.map(b => b.high ?? b.close ?? 0)
      const pastLows = last8.map(b => b.low ?? b.close ?? 0)
      const high = quote.high ?? Math.max(quote.open ?? price, price)
      const low = quote.low ?? Math.min(quote.open ?? price, price)
      const h9 = Math.max(...pastHighs, high)
      const l9 = Math.min(...pastLows, low)
      const rsv = h9 > l9 ? ((price - l9) / (h9 - l9)) * 100 : 50
      const prevK = baseStock.kd?.k ?? 50
      const prevD = baseStock.kd?.d ?? 50
      const k = round2(prevK * (2/3) + rsv * (1/3))
      const d = round2(prevD * (2/3) + k * (1/3))
      kd = {
        k,
        d,
        prevK: baseStock.kd?.k ?? prevK,
        prevD: baseStock.kd?.d ?? prevD,
        h8: h9,
        l8: l9,
      }
    }
  }

  const bias5 = ma5 > 0 ? round2(((price - ma5) / ma5) * 100) : 0
  const bias10 = ma10 > 0 ? round2(((price - ma10) / ma10) * 100) : 0
  const bias20 = ma20 > 0 ? round2(((price - ma20) / ma20) * 100) : 0

  const isLimitUp = changePct >= 9.5
  const isLimitDown = changePct <= -9.5

  const todayHigh = quote.high ?? Math.max(quote.open ?? price, price)
  const todayLow = quote.low ?? Math.min(quote.open ?? price, price)
  const high5d = Math.max(baseStock.high5d || 0, todayHigh)
  const high10d = Math.max(baseStock.high10d || 0, todayHigh)
  const high20d = Math.max(baseStock.high20d || 0, todayHigh)
  const low5d = baseStock.low5d ? Math.min(baseStock.low5d, todayLow) : todayLow
  const low10d = baseStock.low10d ? Math.min(baseStock.low10d, todayLow) : todayLow
  const low20d = baseStock.low20d ? Math.min(baseStock.low20d, todayLow) : todayLow

  return {
    ...baseStock,
    price,
    prevClose,
    open:      quote.open    ?? baseStock.open ?? price,
    high:      todayHigh,
    low:       todayLow,
    volume:    quote.volume  ?? baseStock.volume ?? 0,
    change,
    changePct,
    isLimitUp,
    isLimitDown,
    high5d,
    high10d,
    high20d,
    low5d,
    low10d,
    low20d,
    ma5,
    ma10,
    ma20,
    vMa5,
    vMa10,
    bias5,
    bias10,
    bias20,
    kd,
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

  // 全市場總覽模式 (不套用策略條件)
  if (activeModeId === 'ALL') {
    return { isMatch: true, reasonText: strings.passed || '全市場總覽', details: [] }
  }

  const details = diagnoseStock(stock, params, activeModeId)
  const fail = (reasonText) => ({ isMatch: false, reasonText, details })

  const price = stock.price ?? 0
  const ma5   = stock.ma5 ?? 0
  const ma10  = stock.ma10 ?? 0
  const ma20  = stock.ma20 ?? 0

  // 2. 5MA 乖離率檢驗
  const bias5 = typeof stock.bias5 === 'number'
    ? stock.bias5
    : (ma5 > 0 ? round2(((price - ma5) / ma5) * 100) : 0)

  if (typeof params.bias5Min === 'number' && bias5 < params.bias5Min) {
    return fail(strings.bias5Below ? strings.bias5Below(params.bias5Min, bias5) : '5MA乖離過低')
  }
  if (typeof params.bias5Max === 'number' && bias5 > params.bias5Max) {
    return fail(strings.bias5Above ? strings.bias5Above(params.bias5Max, bias5) : '5MA乖離過高')
  }

  // 3. 20MA 月線乖離率檢驗
  const bias20 = typeof stock.bias20 === 'number'
    ? stock.bias20
    : (ma20 > 0 ? round2(((price - ma20) / ma20) * 100) : 0)

  if (typeof params.bias20Min === 'number' && bias20 < params.bias20Min) {
    return fail(strings.bias20Below ? strings.bias20Below(params.bias20Min, bias20) : '20MA乖離過低')
  }
  if (typeof params.bias20Max === 'number' && bias20 > params.bias20Max) {
    return fail(strings.bias20Above ? strings.bias20Above(params.bias20Max, bias20) : '20MA乖離過高')
  }

  // 3.5 季線防身檢驗 (requireAboveMa60: 收盤價 >= 60MA)
  const ma60 = stock.ma60 ?? 0
  if (params.requireAboveMa60 && ma60 > 0 && price < ma60) {
    return fail(strings.belowMa60Failed || '未站穩季線防身 (現價 < 60MA)')
  }

  // 4. 均線支撐 (maAboveMode: 'BOTH' | 'ANY' | '5MA' | 'NONE')
  if (params.maAboveMode === 'BOTH') {
    const standsBoth = price >= ma5 && price >= ma10
    if (!standsBoth) {
      return fail(strings.maAboveBothFailed || '未同時站穩 5MA 與 10MA')
    }
  } else if (params.maAboveMode === 'ANY') {
    const standsAny = price >= ma5 || price >= ma10
    if (!standsAny) {
      return fail(strings.maAboveAnyFailed || '未站穩 5MA 或 10MA')
    }
  } else if (params.maAboveMode === '5MA' || params.maAboveMode === 'MA5') {
    if (price < ma5) {
      return fail(strings.maAbove5maFailed || '未站上 5MA')
    }
  }

  // 5. 當日三線價差糾結度 (checkConvergence)
  if (params.checkConvergence && typeof params.convergenceMax === 'number') {
    const conv = calculateMAConvergence(ma5, ma10, ma20)
    if (conv > params.convergenceMax) {
      return fail(strings.convergenceFailed ? strings.convergenceFailed(params.convergenceMax, conv) : `三線價差過大 (${conv}%)`)
    }
  }

  // 6. 前一交易日三線價差糾結度 (checkPrevConvergence - Mode 3 專用)
  const history = stock.history10d || []
  const len = history.length
  const lastBar = len > 0 ? history[len - 1] : null
  const isLive = isLiveTradingDay(lastBar)
  const isTodayLive = isLive && (stock.dayOffset === 0 || stock.dayOffset === undefined)

  // 昨日 (T-1) 基準 Bar
  const prevBar = isTodayLive
    ? (len >= 1 ? history[len - 1] : null)
    : (len >= 2 ? history[len - 2] : null)

  if (params.checkPrevConvergence && typeof params.prevConvergenceMax === 'number') {
    if (!prevBar || !prevBar.ma5 || !prevBar.ma10 || !prevBar.ma20) {
      return fail('缺少前一交易日均線數據')
    }

    const prevConv = calculateMAConvergence(prevBar.ma5, prevBar.ma10, prevBar.ma20)
    if (prevConv > params.prevConvergenceMax) {
      return fail(strings.prevConvergenceFailed ? strings.prevConvergenceFailed(params.prevConvergenceMax, prevConv) : `前一日三線價差過大 (${prevConv}%)`)
    }
  }

  // 7. 月線斜率向上 (Mode 2 多頭回測 & Mode 4 洗盤起漲 內建底層靈魂條件)
  if (params.requireMa20Rising || activeModeId === 'TREND_PULLBACK' || activeModeId === 'WASHOUT_IGNITION' || activeModeId === 'PULLBACK_IGNITION') {
    const prevMa20 = prevBar?.ma20

    if (typeof prevMa20 !== 'number' || ma20 <= prevMa20) {
      return fail(strings.ma20NotRising || '月線斜率未向上')
    }
  }


  // 8. 成交量門檻檢驗 (checkMinVolume)
  const volume = stock.volume ?? 0
  if (params.checkMinVolume && typeof params.minVolume === 'number' && volume < params.minVolume) {
    return fail(strings.volumeBelow ? strings.volumeBelow(params.minVolume, volume) : `成交量未達標 (${volume} 張 < ${params.minVolume} 張)`)
  }

  // 9. 排除處置股票 (checkNotDisposed)
  if (params.checkNotDisposed && stock.isDisposed) {
    return fail(strings.isDisposedStock || '此為處置股票 (關禁閉)')
  }

  const vMa5 = stock.vMa5 ?? 0

  // 10. 量縮洗盤 (checkVolContraction: 當日成交量 <= 5日量均 * ratio)
  if (params.checkVolContraction && vMa5 > 0) {
    const ratio = typeof params.volContractionRatio === 'number' ? params.volContractionRatio : 1.0
    if (volume > vMa5 * ratio) {
      return fail(ratio < 1.0
        ? (strings.strictVolContractionFailed || `未達嚴格量縮標準 (${volume} > ${Math.round(vMa5 * ratio)})`)
        : (strings.volContractionFailed || '當日成交量未達量縮標準 (≥ 5日量均)'))
    }
  }

  // 11. 量縮回踩 (checkVolPullback: 當日成交量 < 5日量均 或 < 昨日成交量；若 checkVolPullbackStrict 則必須同時小於 5日量均 AND 昨日量)
  if (params.checkVolPullback) {
    const prevVolume = prevBar?.volume ?? 0
    const isBelowVma5 = vMa5 > 0 ? volume < vMa5 : false
    const isBelowPrevVol = prevVolume > 0 ? volume < prevVolume : false

    if (params.checkVolPullbackStrict) {
      if (!isBelowVma5 || !isBelowPrevVol) {
        return fail(strings.strictVolPullbackFailed || '未達嚴格雙重量縮標準 (需同時小於5日量均與昨日量)')
      }
    } else {
      if (!isBelowVma5 && !isBelowPrevVol) {
        return fail(strings.volPullbackFailed || '未達量縮回踩標準')
      }
    }
  }


  // 12. 昨日量縮 (checkPrevVolContraction: 昨日成交量 < 昨日 5 日量均 MV5)
  if (params.checkPrevVolContraction) {
    if (isTodayLive && len >= 5) {
      const bars5 = history.slice(-5)
      const prevMV5 = Math.round(bars5.reduce((sum, b) => sum + (b.volume || 0), 0) / 5)
      const prevVol = history[len - 1]?.volume ?? 0

      if (prevMV5 > 0 && prevVol >= prevMV5) {
        return fail(strings.prevVolContractionFailed || '昨日未達量縮標準')
      }
    } else if (!isTodayLive && len >= 6) {
      const bars5 = history.slice(-6, -1)
      const prevMV5 = Math.round(bars5.reduce((sum, b) => sum + (b.volume || 0), 0) / 5)
      const prevVol = history[len - 2]?.volume ?? 0

      if (prevMV5 > 0 && prevVol >= prevMV5) {
        return fail(strings.prevVolContractionFailed || '昨日未達量縮標準')
      }
    }
  }


  // 13. 當日帶量攻擊 (checkVolExpansion: 當日成交量 > 5日量均)
  if (params.checkVolExpansion && vMa5 > 0 && volume <= vMa5) {
    return fail(strings.volExpansionFailed || '未達帶量攻擊標準 (成交量 ≤ 5日量均)')
  }

  // 14. 實體攻擊紅 K (checkRedCandle: 收 > 開 且 漲幅 >= minRedCandleChangePct)
  const open = stock.open ?? price
  const close = price
  const changePct = typeof stock.changePct === 'number'
    ? stock.changePct
    : (stock.prevClose > 0 ? round2(((price - stock.prevClose) / stock.prevClose) * 100) : 0)

  const minRedChange = typeof params.minRedCandleChangePct === 'number' ? params.minRedCandleChangePct : 1.5
  if (params.checkRedCandle && (close <= open || changePct < minRedChange)) {
    return fail(strings.redCandleFailed || '未達實體攻擊紅 K 標準')
  }

  // 14.5 狹幅震盪打底 (checkTightConsolidation: 當日漲跌幅介於 tightChgMin 與 tightChgMax 之間)
  if (params.checkTightConsolidation) {
    if (typeof params.tightChgMin === 'number' && changePct < params.tightChgMin) {
      return fail(strings.tightConsolidationFailed ? strings.tightConsolidationFailed(changePct) : `跌幅過大 (${changePct}%)`)
    }
    if (typeof params.tightChgMax === 'number' && changePct > params.tightChgMax) {
      return fail(strings.tightConsolidationFailed ? strings.tightConsolidationFailed(changePct) : `漲幅過大 (${changePct}%)`)
    }
  }


  // 15. 排除長黑倒貨 (checkAvoidLongBlack: 實體黑K跌幅 >= 1.5% 且 收在最低點附近)
  if (params.checkAvoidLongBlack && open > close) {
    const prevClose = stock.prevClose ?? open
    const dropPct = prevClose > 0 ? (open - close) / prevClose : 0
    const high = stock.high ?? price
    const low = stock.low ?? price
    const range = high - low
    const lowRatio = range > 0 ? (close - low) / range : 0.0
    const threshold = params.blackCandleRatioMax ?? 0.20

    // 同時滿足條件 A (實體跌幅 >= 1.5%) 與 條件 B (收最低點附近 <= threshold) 則排除
    if (dropPct >= 0.015 && lowRatio <= threshold) {
      return fail(strings.avoidLongBlackFailed || '觸發長黑倒貨型態')
    }
  }

  // 16. 排除長上影線避雷針 (checkAvoidLongUpperShadow: 上影線長度 > 實體紅 K 一半則排除)
  if (params.checkAvoidLongUpperShadow && close > open) {
    const high = stock.high ?? price
    const upperShadow = high - close
    const body = close - open

    if (upperShadow > body * 0.5) {
      return fail(strings.avoidUpperShadowFailed || '觸發避雷針型態')
    }
  }

  // 17. KD 動能區檢驗 (checkKd)
  if (params.checkKd) {
    const kd = stock.kd ?? { k: 50, d: 50 }
    const k = kd.k ?? 50
    const d = kd.d ?? 50

    if (typeof params.kdKMin === 'number' && k < params.kdKMin) {
      return fail(strings.kdOutOfRange ? strings.kdOutOfRange(params.kdKMin, params.kdKMax ?? 100, k) : `KD 未在多頭區 (K=${k})`)
    }
    if (typeof params.kdKMax === 'number' && k > params.kdKMax) {
      return fail(strings.kdOutOfRange ? strings.kdOutOfRange(params.kdKMin ?? 0, params.kdKMax, k) : `KD 過熱 (K=${k})`)
    }
    if (params.kdRequireCross && k <= d) {
      return fail(strings.kdCrossFailed || 'KD 未形成多頭排列 (K ≤ D)')
    }
  }

  // 18. 排除連續 3 日賣超 (excludeSell3D: 外資賣3D / 主力賣3D / 投信賣3D，含 0050 土洋對作豁免)
  if (params.excludeSell3D) {
    const cats = stock.categories || []
    const warn = stock.sellWarning || ''
    const is0050 = cats.includes('0050')
    const isForeignBuy3D = cats.includes('ForeignBuy3D')
    const isMajorBuy3D = cats.includes('MajorBuy3D')
    const isExempted = is0050 && isForeignBuy3D && isMajorBuy3D // 0050 土洋對作豁免投信賣 3D

    const isForeignSell3D = cats.includes('ForeignSell3D') || warn.includes('外資賣3D')
    const isMajorSell3D = cats.includes('MajorSell3D') || warn.includes('主力賣3D')
    const isSitcaSell3D = cats.includes('SitcaSell3D') || warn.includes('投信賣3D')

    if (isForeignSell3D || isMajorSell3D || (!isExempted && isSitcaSell3D)) {
      const triggered = []
      if (isForeignSell3D) triggered.push('外資賣3D')
      if (isMajorSell3D) triggered.push('主力賣3D')
      if (!isExempted && isSitcaSell3D) triggered.push('投信賣3D')
      const trigStr = triggered.join(' · ')
      return fail(strings.excludeSell3DFailed
        ? strings.excludeSell3DFailed(trigStr)
        : `觸發連續 3 日賣超避雷 (${trigStr})`)
    }
  }

  // 19. 排除當日賣超 1D (excludeSell1D: 外資賣1D / 主力賣1D)
  if (params.excludeSell1D) {
    const cats = stock.categories || []
    const warn = stock.sellWarning || ''
    const isForeignSell1D = cats.includes('ForeignSell1D') || warn.includes('外資賣1D')
    const isMajorSell1D = cats.includes('MajorSell1D') || warn.includes('主力賣1D')

    if (isForeignSell1D || isMajorSell1D) {
      const triggered = []
      if (isForeignSell1D) triggered.push('外資賣1D')
      if (isMajorSell1D) triggered.push('主力賣1D')
      const trigStr = triggered.join(' · ')
      return fail(strings.excludeSell1DFailed
        ? strings.excludeSell1DFailed(trigStr)
        : `觸發當日賣超避雷 (${trigStr})`)
    }
  }

  return {
    isMatch: true,
    reasonText: strings.passed || '符合篩選條件',
    details: diagnoseStock(stock, params, activeModeId),
  }
}

/**
 * 深入診斷個股在特定模式與參數下的各項指標通關狀態
 * @param {Object} stock
 * @param {Object} [params]
 * @param {string} [activeModeId]
 * @returns {Array<{ label: string, pass: boolean, desc: string }>}
 */
export function diagnoseStock(stock, params = {}, activeModeId = 'ALL') {
  if (!stock || activeModeId === 'ALL') return []
  const dLabels = UI_STRINGS.DIAGNOSIS_LABELS || {}
  const details = []

  const price = stock.price ?? 0
  const ma5   = stock.ma5 ?? 0
  const ma10  = stock.ma10 ?? 0
  const ma20  = stock.ma20 ?? 0
  const ma60  = stock.ma60 ?? 0
  const volume = stock.volume ?? 0
  const vMa5   = stock.vMa5 ?? 0
  const open   = stock.open ?? price
  const close  = price
  const changePct = typeof stock.changePct === 'number'
    ? stock.changePct
    : (stock.prevClose > 0 ? round2(((price - stock.prevClose) / stock.prevClose) * 100) : 0)

  const history = stock.history10d || []
  const len = history.length
  const lastBar = len > 0 ? history[len - 1] : null
  const isLive = isLiveTradingDay(lastBar)
  const isTodayLive = isLive && (stock.dayOffset === 0 || stock.dayOffset === undefined)
  const prevBar = isTodayLive
    ? (len >= 1 ? history[len - 1] : null)
    : (len >= 2 ? history[len - 2] : null)

  // 1. 均線支撐 (maAboveMode)
  if (params.maAboveMode === 'BOTH') {
    const pass = price >= ma5 && price >= ma10
    details.push({
      label: dLabels.maSupport || '均線支撐',
      pass,
      desc: pass
        ? `現價 ${price.toFixed(2)} 雙站穩 5MA (${ma5.toFixed(2)}) 與 10MA (${ma10.toFixed(2)})`
        : `未同時站穩 5MA (${ma5.toFixed(2)}) 與 10MA (${ma10.toFixed(2)})`,
    })
  } else if (params.maAboveMode === 'ANY') {
    const pass = price >= ma5 || price >= ma10
    details.push({
      label: dLabels.maSupport || '均線支撐',
      pass,
      desc: pass
        ? `現價 ${price.toFixed(2)} 站穩 5MA (${ma5.toFixed(2)}) 或 10MA (${ma10.toFixed(2)})`
        : `未站穩 5MA (${ma5.toFixed(2)}) 或 10MA (${ma10.toFixed(2)})`,
    })
  } else if (params.maAboveMode === '5MA' || params.maAboveMode === 'MA5') {
    const pass = price >= ma5
    details.push({
      label: dLabels.maSupport || '均線支撐',
      pass,
      desc: pass
        ? `現價 ${price.toFixed(2)} 站穩 5MA (${ma5.toFixed(2)})`
        : `未站上 5MA (${ma5.toFixed(2)})`,
    })
  }

  // 1.5 季線防身
  if (params.requireAboveMa60 && ma60 > 0) {
    const pass = price >= ma60
    details.push({
      label: dLabels.ma60Defense || '季線防身',
      pass,
      desc: pass
        ? `現價 ${price.toFixed(2)} 站穩 60MA 季線 (${ma60.toFixed(2)})`
        : `未站上 60MA 季線 (現價 ${price.toFixed(2)} < 季線 ${ma60.toFixed(2)})`,
    })
  }

  // 2. 5MA 乖離
  if (typeof params.bias5Min === 'number' || typeof params.bias5Max === 'number') {
    const bias5 = typeof stock.bias5 === 'number'
      ? stock.bias5
      : (ma5 > 0 ? round2(((price - ma5) / ma5) * 100) : 0)
    const minPass = typeof params.bias5Min === 'number' ? bias5 >= params.bias5Min : true
    const maxPass = typeof params.bias5Max === 'number' ? bias5 <= params.bias5Max : true
    const pass = minPass && maxPass
    details.push({
      label: dLabels.bias5 || '5MA 乖離',
      pass,
      desc: `5MA 乖離率 ${bias5 >= 0 ? '+' : ''}${bias5}% (區間 ${params.bias5Min ?? '-∞'}% ~ ${params.bias5Max ?? '+∞'}%)`,
    })
  }

  // 3. 20MA 乖離
  if (typeof params.bias20Min === 'number' || typeof params.bias20Max === 'number') {
    const bias20 = typeof stock.bias20 === 'number'
      ? stock.bias20
      : (ma20 > 0 ? round2(((price - ma20) / ma20) * 100) : 0)
    const minPass = typeof params.bias20Min === 'number' ? bias20 >= params.bias20Min : true
    const maxPass = typeof params.bias20Max === 'number' ? bias20 <= params.bias20Max : true
    const pass = minPass && maxPass
    details.push({
      label: dLabels.bias20 || '月線乖離',
      pass,
      desc: `20MA 乖離率 ${bias20 >= 0 ? '+' : ''}${bias20}% (區間 ${params.bias20Min ?? '-∞'}% ~ ${params.bias20Max ?? '+∞'}%)`,
    })
  }

  // 4. 三線糾結度
  if (params.checkConvergence && typeof params.convergenceMax === 'number') {
    const conv = calculateMAConvergence(ma5, ma10, ma20)
    const pass = conv <= params.convergenceMax
    details.push({
      label: dLabels.convergence || '三線糾結',
      pass,
      desc: `當日三線價差 ${conv}% (門檻 ≤ ${params.convergenceMax}%)`,
    })
  }

  // 5. 前一日三線糾結度
  if (params.checkPrevConvergence && typeof params.prevConvergenceMax === 'number') {
    if (prevBar && prevBar.ma5 && prevBar.ma10 && prevBar.ma20) {
      const prevConv = calculateMAConvergence(prevBar.ma5, prevBar.ma10, prevBar.ma20)
      const pass = prevConv <= params.prevConvergenceMax
      details.push({
        label: dLabels.prevConvergence || '昨日糾結',
        pass,
        desc: `前一日三線價差 ${prevConv}% (門檻 ≤ ${params.prevConvergenceMax}%)`,
      })
    }
  }

  // 6. 月線斜率向上
  if (params.requireMa20Rising || activeModeId === 'TREND_PULLBACK' || activeModeId === 'WASHOUT_IGNITION' || activeModeId === 'PULLBACK_IGNITION') {
    const prevMa20 = prevBar?.ma20
    const pass = typeof prevMa20 === 'number' && ma20 > prevMa20
    details.push({
      label: dLabels.ma20Slope || '月線斜率',
      pass,
      desc: pass
        ? `月線斜率向上 (今日 ${ma20.toFixed(2)} > 昨日 ${prevMa20 ? prevMa20.toFixed(2) : '-'})`
        : `月線斜率未向上 (今日 ${ma20.toFixed(2)} ≤ 昨日 ${prevMa20 ? prevMa20.toFixed(2) : '-'})`,
    })
  }

  // 7. 成交量能
  if (params.checkMinVolume && typeof params.minVolume === 'number') {
    const pass = volume >= params.minVolume
    details.push({
      label: dLabels.volume || '成交量能',
      pass,
      desc: `成交量 ${volume.toLocaleString()} 張 (門檻 ≥ ${params.minVolume.toLocaleString()} 張)`,
    })
  }

  // 8. 帶量攻擊
  if (params.checkVolExpansion && vMa5 > 0) {
    const pass = volume > vMa5
    details.push({
      label: dLabels.volExpansion || '量能攻擊',
      pass,
      desc: pass
        ? `帶量攻擊 (當日量 ${volume.toLocaleString()} 張 > 5日均量 ${vMa5.toLocaleString()} 張)`
        : `未達帶量 (當日量 ${volume.toLocaleString()} 張 ≤ 5日均量 ${vMa5.toLocaleString()} 張)`,
    })
  }

  // 9. 量縮回踩
  if (params.checkVolPullback) {
    const prevVolume = prevBar?.volume ?? 0
    const isBelowVma5 = vMa5 > 0 ? volume < vMa5 : false
    const isBelowPrevVol = prevVolume > 0 ? volume < prevVolume : false
    const pass = params.checkVolPullbackStrict
      ? (isBelowVma5 && isBelowPrevVol)
      : (isBelowVma5 || isBelowPrevVol)
    details.push({
      label: dLabels.volPullback || '量縮回踩',
      pass,
      desc: pass
        ? `量縮回踩 (當日量 ${volume.toLocaleString()} 張 < 5日量均 ${vMa5.toLocaleString()} 或 昨日量 ${prevVolume.toLocaleString()})`
        : `未達量縮 (當日量 ${volume.toLocaleString()} 張 未小於均量或昨日量)`,
    })
  }

  // 9.5 昨日量縮 (checkPrevVolContraction: 昨日成交量 < 昨日 5 日量均 MV5)
  if (params.checkPrevVolContraction) {
    let prevMV5 = 0
    let prevVol = 0
    let pass = false
    if (isTodayLive && len >= 5) {
      const bars5 = history.slice(-5)
      prevMV5 = Math.round(bars5.reduce((sum, b) => sum + (b.volume || 0), 0) / 5)
      prevVol = history[len - 1]?.volume ?? 0
      pass = prevMV5 > 0 && prevVol < prevMV5
    } else if (!isTodayLive && len >= 6) {
      const bars5 = history.slice(-6, -1)
      prevMV5 = Math.round(bars5.reduce((sum, b) => sum + (b.volume || 0), 0) / 5)
      prevVol = history[len - 2]?.volume ?? 0
      pass = prevMV5 > 0 && prevVol < prevMV5
    }
    details.push({
      label: dLabels.prevVolContraction || '昨日量縮',
      pass,
      desc: pass
        ? `昨日量縮 (昨日量 ${prevVol.toLocaleString()} 張 < 昨日均量 ${prevMV5.toLocaleString()} 張)`
        : `昨日未達量縮 (昨日量 ${prevVol.toLocaleString()} 張 ≥ 昨日均量 ${prevMV5.toLocaleString()} 張)`,
    })
  }

  // 10. 量縮洗盤
  if (params.checkVolContraction && vMa5 > 0) {
    const ratio = typeof params.volContractionRatio === 'number' ? params.volContractionRatio : 1.0
    const pass = volume <= vMa5 * ratio
    details.push({
      label: dLabels.volContraction || '量縮洗盤',
      pass,
      desc: pass
        ? `量縮洗盤 (當日量 ${volume.toLocaleString()} 張 ≤ 5日量均 ${Math.round(vMa5 * ratio).toLocaleString()} 張)`
        : `未達量縮 (當日量 ${volume.toLocaleString()} 張 > 5日量均 ${Math.round(vMa5 * ratio).toLocaleString()} 張)`,
    })
  }

  // 11. 實體攻擊紅 K
  if (params.checkRedCandle) {
    const minRedChange = typeof params.minRedCandleChangePct === 'number' ? params.minRedCandleChangePct : 1.5
    const isRed = close > open
    const pass = isRed && changePct >= minRedChange
    details.push({
      label: dLabels.redCandle || '實體紅 K',
      pass,
      desc: pass
        ? `實體攻擊紅 K (實體紅 K 漲幅 +${changePct}% ≥ ${minRedChange}%)`
        : `未達攻擊紅 K (漲幅 ${changePct >= 0 ? '+' : ''}${changePct}%，門檻 ≥ ${minRedChange}%)`,
    })
  }

  // 12. 狹幅打底
  if (params.checkTightConsolidation) {
    const minPass = typeof params.tightChgMin === 'number' ? changePct >= params.tightChgMin : true
    const maxPass = typeof params.tightChgMax === 'number' ? changePct <= params.tightChgMax : true
    const pass = minPass && maxPass
    details.push({
      label: dLabels.tightConsolidation || '狹幅打底',
      pass,
      desc: `當日震盪幅度 ${changePct >= 0 ? '+' : ''}${changePct}% (區間 ${params.tightChgMin ?? -1.5}% ~ +${params.tightChgMax ?? 1.5}%)`,
    })
  }

  // 13. 上影線收斂
  if (params.checkAvoidLongUpperShadow && close > open) {
    const high = stock.high ?? price
    const upperShadow = high - close
    const body = close - open
    const pass = upperShadow <= body * 0.5
    details.push({
      label: dLabels.upperShadow || '上影線',
      pass,
      desc: pass ? '上影線短 (≤ 實體紅 K 一半，無避雷針)' : '上影線過長 (觸發避雷針賣壓)',
    })
  }

  // 13.5 排除長黑倒貨 (checkAvoidLongBlack: 實體黑K跌幅 >= 1.5% 且 收在最低點附近)
  if (params.checkAvoidLongBlack) {
    const isBlack = open > close
    let isDump = false
    let dropPct = 0
    let lowRatio = 0
    if (isBlack) {
      const prevClose = stock.prevClose ?? open
      dropPct = prevClose > 0 ? (open - close) / prevClose : 0
      const high = stock.high ?? price
      const low = stock.low ?? price
      const range = high - low
      lowRatio = range > 0 ? (close - low) / range : 0.0
      const threshold = params.blackCandleRatioMax ?? 0.20
      if (dropPct >= 0.015 && lowRatio <= threshold) {
        isDump = true
      }
    }
    const pass = !isDump
    details.push({
      label: dLabels.avoidLongBlack || '長黑避雷',
      pass,
      desc: pass
        ? '通過 (無實體長黑摜壓至最低點)'
        : `觸發長黑倒貨型態 (實體黑K跌幅 ${(dropPct * 100).toFixed(1)}% ≥ 1.5% 且收最低點附近)`,
    })
  }

  // 14. KD 動能
  if (params.checkKd) {
    const kd = stock.kd ?? { k: 50, d: 50 }
    const k = kd.k ?? 50
    const d = kd.d ?? 50
    let pass = true
    if (typeof params.kdKMin === 'number' && k < params.kdKMin) pass = false
    if (typeof params.kdKMax === 'number' && k > params.kdKMax) pass = false
    if (params.kdRequireCross && k <= d) pass = false
    details.push({
      label: dLabels.kdMomentum || 'KD 動能',
      pass,
      desc: `K 值 ${k} / D 值 ${d} (${pass ? '多頭排列' : '未達動能區'})`,
    })
  }

  // 15. 籌碼避雷 (3D)
  if (params.excludeSell3D) {
    const cats = stock.categories || []
    const warn = stock.sellWarning || ''
    const is0050 = cats.includes('0050')
    const isForeignBuy3D = cats.includes('ForeignBuy3D')
    const isMajorBuy3D = cats.includes('MajorBuy3D')
    const isExempted = is0050 && isForeignBuy3D && isMajorBuy3D
    const isForeignSell3D = cats.includes('ForeignSell3D') || warn.includes('外資賣3D')
    const isMajorSell3D = cats.includes('MajorSell3D') || warn.includes('主力賣3D')
    const isSitcaSell3D = cats.includes('SitcaSell3D') || warn.includes('投信賣3D')
    const pass = !isForeignSell3D && !isMajorSell3D && (isExempted || !isSitcaSell3D)
    details.push({
      label: dLabels.chipsSell3D || '籌碼避雷',
      pass,
      desc: pass ? '通過 (無外資/主力/投信連續 3 日賣超)' : '未通過 (觸發連續 3 日賣超)',
    })
  }

  // 15.5 當日避雷 (1D)
  if (params.excludeSell1D) {
    const cats = stock.categories || []
    const warn = stock.sellWarning || ''
    const isForeignSell1D = cats.includes('ForeignSell1D') || warn.includes('外資賣1D')
    const isMajorSell1D = cats.includes('MajorSell1D') || warn.includes('主力賣1D')
    const triggered = []
    if (isForeignSell1D) triggered.push('外資賣1D')
    if (isMajorSell1D) triggered.push('主力賣1D')
    const pass = triggered.length === 0
    details.push({
      label: dLabels.chipsSell1D || '當日避雷',
      pass,
      desc: pass
        ? '通過 (無外資/主力當日賣超)'
        : `觸發當日賣超避雷 (${triggered.join(' · ')})`,
    })
  }

  // 16. 處置股票
  if (params.checkNotDisposed) {
    const pass = !stock.isDisposed
    details.push({
      label: dLabels.disposed || '處置檢驗',
      pass,
      desc: pass ? '正常交易 (非處置股)' : '處置中 (關禁閉)',
    })
  }

  return details
}


/**
 * 判斷當前是否處於「全新開盤交易日（即時行情階段）」
 * 規則：今天為週一至週五 (開盤交易日) 且 今天日期晚於資料庫中最新收盤日 K 日期
 * @param {Object} [sampleBar]
 * @returns {boolean}
 */
export function isLiveTradingDay(sampleBar, currentTime = new Date()) {
  if (!sampleBar || !sampleBar.date) return false
  const now = currentTime
  const day = now.getDay()
  if (day === 0 || day === 6) return false

  // 台股上午 09:00 開盤。開盤前 (00:00 ~ 08:59) 屬於盤前，尚未進入今日即時交易時段，以昨日盤後為基準
  const hour = now.getHours()
  if (hour < 9) return false

  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${d}`
  return todayStr > sampleBar.date
}

/**
 * 時光切片：將個股狀態時光倒流至指定天數前（支援近 0 ~ 5 個歷史交易日）
 * @param {Object} stock             - 原始個股物件（包含完整 history10d）
 * @param {number} dayOffset         - 倒流天數（0: 今日/最新, 1: 昨日, 2: 前日...）
 * @param {Date}   [currentTime]     - 當前時間（預設 new Date()）
 * @returns {Object}                 - 該歷史日之個股快照物件
 */
export function sliceStockAt(stock, dayOffset = 0, currentTime = new Date()) {
  if (!stock || !Array.isArray(stock.history10d) || stock.history10d.length === 0 || dayOffset <= 0) {
    return stock
  }

  const len = stock.history10d.length
  const isLive = isLiveTradingDay(stock.history10d[len - 1], currentTime)

  // 若為盤中全新交易日：T-1 對應 len - 1 (上個收盤日)；若為週末/已收盤：T-1 對應 len - 2
  const targetIndex = isLive
    ? Math.max(0, len - dayOffset)
    : Math.max(0, len - 1 - dayOffset)

  const bar = stock.history10d[targetIndex]
  if (!bar) return stock

  const prevBar = targetIndex > 0 ? stock.history10d[targetIndex - 1] : null
  const prevClose = typeof bar.prevClose === 'number'
    ? bar.prevClose
    : (prevBar ? prevBar.close : bar.open)


  const change = round2(bar.close - prevClose)
  const changePct = prevClose > 0 ? round2((change / prevClose) * 100) : 0

  // 動態推算該歷史日的 5日量均 (vMa5) 與 10日量均 (vMa10)
  const past5Bars = stock.history10d.slice(Math.max(0, targetIndex - 4), targetIndex + 1)
  const past10Bars = stock.history10d.slice(Math.max(0, targetIndex - 9), targetIndex + 1)
  const past20Bars = stock.history10d.slice(Math.max(0, targetIndex - 19), targetIndex + 1)

  const vMa5 = Math.round(past5Bars.reduce((sum, b) => sum + (b.volume || 0), 0) / past5Bars.length)
  const vMa10 = Math.round(past10Bars.reduce((sum, b) => sum + (b.volume || 0), 0) / past10Bars.length)

  const high5d = Math.max(...past5Bars.map(b => b.high ?? b.close ?? 0))
  const high10d = Math.max(...past10Bars.map(b => b.high ?? b.close ?? 0))
  const high20d = Math.max(...past20Bars.map(b => b.high ?? b.close ?? 0))
  const low5d = Math.min(...past5Bars.map(b => b.low ?? b.close ?? 0))
  const low10d = Math.min(...past10Bars.map(b => b.low ?? b.close ?? 0))
  const low20d = Math.min(...past20Bars.map(b => b.low ?? b.close ?? 0))

  const ma5 = bar.ma5 ?? 0
  const ma10 = bar.ma10 ?? 0
  const ma20 = bar.ma20 ?? 0
  const ma60 = bar.ma60 ?? stock.ma60 ?? 0

  const bias5 = ma5 > 0 ? round2(((bar.close - ma5) / ma5) * 100) : 0
  const bias20 = ma20 > 0 ? round2(((bar.close - ma20) / ma20) * 100) : 0

  const targetDate = bar.date
  let slicedCategories = stock.categories || []
  let slicedChips = stock.chips || null

  // 嘗試自 chipsHistory 載入該歷史交易日之真實標籤與籌碼集中度
  if (stock.chipsHistory && targetDate && stock.chipsHistory[targetDate]) {
    const hist = stock.chipsHistory[targetDate]
    if (Array.isArray(hist.categories)) {
      slicedCategories = hist.categories
    }
    if (hist.chips !== undefined) {
      slicedChips = hist.chips
    }
  }

  // 依據歷史 categories 動態計算避雷警示字串
  let slicedSellWarning = stock.sellWarning
  if (Array.isArray(slicedCategories)) {
    const tags = []
    if (slicedCategories.includes('ForeignSell3D')) {
      tags.push('外資賣3D')
    } else if (slicedCategories.includes('ForeignSell1D')) {
      tags.push('外資賣1D')
    }
    if (slicedCategories.includes('SitcaSell3D')) {
      tags.push('投信賣3D')
    }
    if (slicedCategories.includes('MajorSell3D')) {
      tags.push('主力賣3D')
    } else if (slicedCategories.includes('MajorSell1D')) {
      tags.push('主力賣1D')
    }
    slicedSellWarning = tags.length > 0 ? tags.join(' · ') : null
  }

  return {
    ...stock,
    price: bar.close,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    prevClose,
    volume: bar.volume,
    change,
    changePct,
    isLimitUp: changePct >= 9.5,
    isLimitDown: changePct <= -9.5,
    high5d,
    high10d,
    high20d,
    low5d,
    low10d,
    low20d,
    ma5,
    ma10,
    ma20,
    ma60,
    vMa5,
    vMa10,
    bias5,
    bias20,
    categories: slicedCategories,
    chips: slicedChips,
    sellWarning: slicedSellWarning,
    kd: {
      k: bar.k,
      d: bar.d,
      prevK: prevBar ? prevBar.k : bar.k,
      prevD: prevBar ? prevBar.d : bar.d,
    },
    // 截斷未來資料，確保前一日糾結與斜率判斷完全基於當時歷史視角
    history10d: stock.history10d.slice(0, targetIndex + 1),
    sparkline: stock.history10d.slice(Math.max(0, targetIndex - 9), targetIndex + 1).map(b => b.close),
    dayOffset,
  }
}


/**
 * 批次將全股票池時光倒流至指定天數前
 * @param {Object[]} stocks
 * @param {number}   dayOffset
 * @returns {Object[]}
 */
export function sliceStockPoolAt(stocks = [], dayOffset = 0, currentTime = new Date()) {
  if (!Array.isArray(stocks) || dayOffset <= 0) return stocks
  return stocks.map(stock => sliceStockAt(stock, dayOffset, currentTime))
}

/**
 * 執行選股篩選（支援歷史時光機回測）
 * @param {Object[]} stocks          - 完整個股陣列（已合體即時行情）
 * @param {Object}   params          - 篩選條件參數
 * @param {string}   [activeMode]    - 當前選股模式 ID
 * @param {number}   [dayOffset]     - 歷史倒流天數（0: 今日/最新, 1: 1天前, 2: 2天前...）
 * @param {Date}     [currentTime]   - 當前時間（預設 new Date()）
 * @returns {Object[]}               - 符合條件的個股陣列（包含 filterEvaluation）
 */
export function runScreener(stocks = [], params = {}, activeMode = '', dayOffset = 0, currentTime = new Date()) {
  if (!Array.isArray(stocks)) return []

  const targetStocks = dayOffset > 0 ? sliceStockPoolAt(stocks, dayOffset, currentTime) : stocks

  const results = []
  for (const stock of targetStocks) {
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

const SNAPSHOT_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 產生全市場五大模式選股快照之純文字內容
 * 包含複製時間、資料時間、一般篩選與一鍵精選
 * @param {Object} options
 * @param {Object[]} options.stocks
 * @param {Object} [options.meta]
 * @param {string} [options.quotesLastUpdated]
 * @param {number} [options.dayOffset]
 * @param {Date} [options.currentTime]
 * @returns {string}
 */
export function buildScreenerSnapshotText({
  stocks = [],
  meta = null,
  quotesLastUpdated = '',
  dayOffset = 0,
  currentTime = new Date(),
} = {}) {
  const strings = UI_STRINGS.SNAPSHOT || {}

  // 1. 複製時間 (格式：MM/DD (週X) HH:mm:ss)
  const cM = String(currentTime.getMonth() + 1).padStart(2, '0')
  const cD = String(currentTime.getDate()).padStart(2, '0')
  const cW = SNAPSHOT_WEEKDAYS[currentTime.getDay()]
  const cH = String(currentTime.getHours()).padStart(2, '0')
  const cMin = String(currentTime.getMinutes()).padStart(2, '0')
  const cS = String(currentTime.getSeconds()).padStart(2, '0')
  const copyTimeStr = `${cM}/${cD} (${cW}) ${cH}:${cMin}:${cS}`

  // 2. 資料時間 (格式：MM/DD (週X) HH:mm:ss)
  let dataTimeStr = ''
  if (quotesLastUpdated && typeof quotesLastUpdated === 'string') {
    const timeStr = quotesLastUpdated.trim()
    if (timeStr.includes('-') || timeStr.includes('/')) {
      try {
        const d = new Date(timeStr.replace(/-/g, '/'))
        if (!isNaN(d.getTime())) {
          const dM = String(d.getMonth() + 1).padStart(2, '0')
          const dD = String(d.getDate()).padStart(2, '0')
          const dW = SNAPSHOT_WEEKDAYS[d.getDay()]
          const dH = String(d.getHours()).padStart(2, '0')
          const dMin = String(d.getMinutes()).padStart(2, '0')
          const dSec = String(d.getSeconds()).padStart(2, '0')
          dataTimeStr = `${dM}/${dD} (${dW}) ${dH}:${dMin}:${dSec}`
        }
      } catch {}
    }
    if (!dataTimeStr) {
      const formattedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr
      dataTimeStr = `${cM}/${cD} (${cW}) ${formattedTime}`
    }
  } else if (meta?.updatedAt) {
    try {
      const d = new Date(meta.updatedAt)
      if (!isNaN(d.getTime())) {
        const dM = String(d.getMonth() + 1).padStart(2, '0')
        const dD = String(d.getDate()).padStart(2, '0')
        const dW = SNAPSHOT_WEEKDAYS[d.getDay()]
        const dH = String(d.getHours()).padStart(2, '0')
        const dMin = String(d.getMinutes()).padStart(2, '0')
        const dSec = String(d.getSeconds()).padStart(2, '0')
        dataTimeStr = `${dM}/${dD} (${dW}) ${dH}:${dMin}:${dSec}`
      }
    } catch {}
  }

  if (!dataTimeStr) {
    dataTimeStr = copyTimeStr
  }

  // 3. 股票項目格式化：• 2330 台積電 940 (+20、漲 2.17%) / (-10、跌 1.26%) / (0、平盤)
  function formatStockLine(stock) {
    const code = stock.code || ''
    const name = stock.name || ''
    const price = stock.price ?? '--'
    const change = typeof stock.change === 'number' ? stock.change : 0
    const changePct = typeof stock.changePct === 'number' ? Math.abs(stock.changePct).toFixed(2) : '0.00'

    let changeStr = ''
    if (change > 0) {
      changeStr = `+${change}、${strings.upPrefix || '漲 '}${changePct}%`
    } else if (change < 0) {
      changeStr = `${change}、${strings.downPrefix || '跌 '}${changePct}%`
    } else {
      changeStr = strings.flat || '0、平盤'
    }

    return `• ${code} ${name} ${price} (${changeStr})`
  }

  const lines = []
  lines.push(strings.title || '【豐盛幫手選股快照】')
  lines.push(`${strings.copyTimePrefix || '複製時間：'}${copyTimeStr}`)
  lines.push(`${strings.dataTimePrefix || '資料時間：'}${dataTimeStr}`)
  lines.push('')

  // 4. 一般篩選區段
  lines.push(strings.standardSection || '一般篩選')
  for (const [modeKey, modeObj] of Object.entries(SCREENER_MODES)) {
    const matched = runScreener(stocks, modeObj.defaultParams, modeKey, dayOffset, currentTime)
    lines.push(`■ ${modeObj.label} (${matched.length})`)
    for (const s of matched) {
      lines.push(formatStockLine(s))
    }
  }

  lines.push('')

  // 5. 一鍵精選區段
  lines.push(strings.premiumSection || '一鍵精選')
  for (const [modeKey, modeObj] of Object.entries(SCREENER_MODES)) {
    const premiumParams = {
      ...modeObj.defaultParams,
      ...(modeObj.premiumParams || {}),
    }
    const matched = runScreener(stocks, premiumParams, modeKey, dayOffset, currentTime)
    lines.push(`■ ${modeObj.label} (${matched.length})`)
    for (const s of matched) {
      lines.push(formatStockLine(s))
    }
  }

  return lines.join('\n')
}

