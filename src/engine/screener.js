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

  // 全市場總覽模式 (不套用策略條件)
  if (activeModeId === 'ALL') {
    return { isMatch: true, reasonText: strings.passed || '全市場總覽' }
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

  // 3.5 季線防身檢驗 (requireAboveMa60: 收盤價 >= 60MA)
  const ma60 = stock.ma60 ?? 0
  if (params.requireAboveMa60 && ma60 > 0 && price < ma60) {
    return { isMatch: false, reasonText: strings.belowMa60Failed || '未站穩季線防身 (現價 < 60MA)' }
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

  // 8. 成交量門檻檢驗 (checkMinVolume)
  const volume = stock.volume ?? 0
  if (params.checkMinVolume && typeof params.minVolume === 'number' && volume < params.minVolume) {
    return {
      isMatch: false,
      reasonText: strings.volumeBelow ? strings.volumeBelow(params.minVolume, volume) : `成交量未達標 (${volume} 張 < ${params.minVolume} 張)`,
    }
  }

  // 9. 排除處置股票 (checkNotDisposed)
  if (params.checkNotDisposed && stock.isDisposed) {
    return { isMatch: false, reasonText: strings.isDisposedStock || '此為處置股票 (關禁閉)' }
  }

  const vMa5 = stock.vMa5 ?? 0

  // 10. 量縮洗盤 (checkVolContraction: 當日成交量 <= 5日量均 * ratio)
  if (params.checkVolContraction && vMa5 > 0) {
    const ratio = typeof params.volContractionRatio === 'number' ? params.volContractionRatio : 1.0
    if (volume > vMa5 * ratio) {
      return {
        isMatch: false,
        reasonText: ratio < 1.0
          ? (strings.strictVolContractionFailed || `未達嚴格量縮標準 (${volume} > ${Math.round(vMa5 * ratio)})`)
          : (strings.volContractionFailed || '當日成交量未達量縮標準 (≥ 5日量均)'),
      }
    }
  }

  // 11. 量縮回踩 (checkVolPullback: 當日成交量 < 5日量均 或 < 昨日成交量)
  if (params.checkVolPullback) {
    const history = stock.history10d
    const prevBar = Array.isArray(history) && history.length >= 2 ? history[history.length - 2] : null
    const prevVolume = prevBar?.volume ?? 0
    const isBelowVma5 = vMa5 > 0 ? volume < vMa5 : false
    const isBelowPrevVol = prevVolume > 0 ? volume < prevVolume : false

    if (!isBelowVma5 && !isBelowPrevVol) {
      return { isMatch: false, reasonText: strings.volPullbackFailed || '未達量縮回踩標準' }
    }
  }

  // 12. 昨日量縮 (checkPrevPrevVolContraction: 昨日成交量 < 昨日 5 日量均 MV5)
  if (params.checkPrevVolContraction) {
    const history = stock.history10d
    if (Array.isArray(history) && history.length >= 6) {
      // 取昨日 (倒數第 2 根) 及往前共 5 根計算昨日的 MV5
      const bars5 = history.slice(-6, -1)
      const prevMV5 = Math.round(bars5.reduce((sum, b) => sum + (b.volume || 0), 0) / 5)
      const prevVol = history[history.length - 2]?.volume ?? 0

      if (prevMV5 > 0 && prevVol >= prevMV5) {
        return { isMatch: false, reasonText: strings.prevVolContractionFailed || '昨日未達量縮標準' }
      }
    }
  }

  // 13. 當日帶量攻擊 (checkVolExpansion: 當日成交量 > 5日量均)
  if (params.checkVolExpansion && vMa5 > 0 && volume <= vMa5) {
    return { isMatch: false, reasonText: strings.volExpansionFailed || '未達帶量攻擊標準 (成交量 ≤ 5日量均)' }
  }

  // 14. 實體攻擊紅 K (checkRedCandle: 收 > 開 且 漲幅 >= 1.5%)
  const open = stock.open ?? price
  const close = price
  const changePct = typeof stock.changePct === 'number'
    ? stock.changePct
    : (stock.prevClose > 0 ? round2(((price - stock.prevClose) / stock.prevClose) * 100) : 0)

  if (params.checkRedCandle && (close <= open || changePct < 1.5)) {
    return { isMatch: false, reasonText: strings.redCandleFailed || '未達實體攻擊紅 K 標準' }
  }

  // 14.5 狹幅震盪打底 (checkTightConsolidation: 當日漲跌幅介於 tightChgMin 與 tightChgMax 之間)
  if (params.checkTightConsolidation) {
    if (typeof params.tightChgMin === 'number' && changePct < params.tightChgMin) {
      return {
        isMatch: false,
        reasonText: strings.tightConsolidationFailed ? strings.tightConsolidationFailed(changePct) : `跌幅過大 (${changePct}%)`,
      }
    }
    if (typeof params.tightChgMax === 'number' && changePct > params.tightChgMax) {
      return {
        isMatch: false,
        reasonText: strings.tightConsolidationFailed ? strings.tightConsolidationFailed(changePct) : `漲幅過大 (${changePct}%)`,
      }
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
      return { isMatch: false, reasonText: strings.avoidLongBlackFailed || '觸發長黑倒貨型態' }
    }
  }

  // 16. 排除長上影線避雷針 (checkAvoidLongUpperShadow: 上影線長度 > 實體紅 K 一半則排除)
  if (params.checkAvoidLongUpperShadow && close > open) {
    const high = stock.high ?? price
    const upperShadow = high - close
    const body = close - open

    if (upperShadow > body * 0.5) {
      return { isMatch: false, reasonText: strings.avoidUpperShadowFailed || '觸發避雷針型態' }
    }
  }

  // 17. KD 動能區檢驗 (checkKd)
  if (params.checkKd) {
    const kd = stock.kd ?? { k: 50, d: 50 }
    const k = kd.k ?? 50
    const d = kd.d ?? 50

    if (typeof params.kdKMin === 'number' && k < params.kdKMin) {
      return {
        isMatch: false,
        reasonText: strings.kdOutOfRange ? strings.kdOutOfRange(params.kdKMin, params.kdKMax ?? 100, k) : `KD 未在多頭區 (K=${k})`,
      }
    }
    if (typeof params.kdKMax === 'number' && k > params.kdKMax) {
      return {
        isMatch: false,
        reasonText: strings.kdOutOfRange ? strings.kdOutOfRange(params.kdKMin ?? 0, params.kdKMax, k) : `KD 過熱 (K=${k})`,
      }
    }
    if (params.kdRequireCross && k <= d) {
      return { isMatch: false, reasonText: strings.kdCrossFailed || 'KD 未形成多頭排列 (K ≤ D)' }
    }
  }

  return { isMatch: true, reasonText: strings.passed || '符合篩選條件' }
}

/**
 * 時光切片：將個股狀態時光倒流至指定天數前（支援近 0 ~ 5 個歷史交易日）
 * @param {Object} stock     - 原始個股物件（包含完整 history10d）
 * @param {number} dayOffset - 倒流天數（0: 今日/最新, 1: 昨日, 2: 前日...）
 * @returns {Object}         - 該歷史日之個股快照物件
 */
export function sliceStockAt(stock, dayOffset = 0) {
  if (!stock || !Array.isArray(stock.history10d) || stock.history10d.length === 0 || dayOffset <= 0) {
    return stock
  }

  const len = stock.history10d.length
  const targetIndex = Math.max(0, len - 1 - dayOffset)
  const bar = stock.history10d[targetIndex]
  if (!bar) return stock

  const prevBar = targetIndex > 0 ? stock.history10d[targetIndex - 1] : null
  const prevClose = typeof bar.prevClose === 'number'
    ? bar.prevClose
    : (prevBar ? prevBar.close : bar.open)

  const change = round2(bar.close - prevClose)
  const changePct = prevClose > 0 ? round2((change / prevClose) * 100) : 0

  // 動態推算該歷史日的 5日量均 (vMa5)
  const past5Bars = stock.history10d.slice(Math.max(0, targetIndex - 4), targetIndex + 1)
  const vMa5 = Math.round(past5Bars.reduce((sum, b) => sum + (b.volume || 0), 0) / past5Bars.length)

  // 動態推算該歷史日的 10日量均 (vMa10)
  const past10Bars = stock.history10d.slice(Math.max(0, targetIndex - 9), targetIndex + 1)
  const vMa10 = Math.round(past10Bars.reduce((sum, b) => sum + (b.volume || 0), 0) / past10Bars.length)

  const ma5 = bar.ma5 ?? 0
  const ma10 = bar.ma10 ?? 0
  const ma20 = bar.ma20 ?? 0
  const ma60 = bar.ma60 ?? stock.ma60 ?? 0

  const bias5 = ma5 > 0 ? round2(((bar.close - ma5) / ma5) * 100) : 0
  const bias20 = ma20 > 0 ? round2(((bar.close - ma20) / ma20) * 100) : 0

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
    ma5,
    ma10,
    ma20,
    ma60,
    vMa5,
    vMa10,
    bias5,
    bias20,
    kd: {
      k: bar.k,
      d: bar.d,
      prevK: prevBar ? prevBar.k : bar.k,
      prevD: prevBar ? prevBar.d : bar.d,
    },
    // 截斷未來資料，確保前一日糾結與斜率判斷完全基於當時歷史視角
    history10d: stock.history10d.slice(0, targetIndex + 1),
    dayOffset,
  }
}

/**
 * 批次將全股票池時光倒流至指定天數前
 * @param {Object[]} stocks
 * @param {number}   dayOffset
 * @returns {Object[]}
 */
export function sliceStockPoolAt(stocks = [], dayOffset = 0) {
  if (!Array.isArray(stocks) || dayOffset <= 0) return stocks
  return stocks.map(stock => sliceStockAt(stock, dayOffset))
}

/**
 * 執行選股篩選（支援歷史時光機回測）
 * @param {Object[]} stocks       - 完整個股陣列（已合體即時行情）
 * @param {Object}   params       - 篩選條件參數
 * @param {string}   [activeMode] - 當前選股模式 ID
 * @param {number}   [dayOffset]  - 歷史倒流天數（0: 今日/最新, 1: 1天前, 2: 2天前...）
 * @returns {Object[]}            - 符合條件的個股陣列（包含 filterEvaluation）
 */
export function runScreener(stocks = [], params = {}, activeMode = '', dayOffset = 0) {
  if (!Array.isArray(stocks)) return []

  const targetStocks = dayOffset > 0 ? sliceStockPoolAt(stocks, dayOffset) : stocks

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

