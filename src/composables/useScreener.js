import { ref, computed, readonly } from 'vue'
import { runScreener, evaluateStock, sliceStockPoolAt } from '../engine/screener.js'
import { SCREENER_MODES, DEFAULT_MODE } from '../constants/screener-modes.js'

/**
 * useScreener — 篩選邏輯層
 *
 * 職責：呼叫純引擎，管理篩選條件與時光機回測狀態，不碰 DOM
 */
export function useScreener(stocks) {
  const activeMode        = ref(DEFAULT_MODE)
  const params            = ref(DEFAULT_MODE === 'ALL' ? {} : { ...(SCREENER_MODES[DEFAULT_MODE]?.defaultParams || {}) })
  const selectedDayOffset = ref(0) // 0: 今日/最新, 1: 1天前 (T-1), 2: 2天前 (T-2)...

  // 切換模式時自動載入該模式的預設參數
  function setMode(modeId) {
    if (modeId === 'ALL') {
      activeMode.value = 'ALL'
      params.value = {}
      return
    }
    if (!SCREENER_MODES[modeId]) return
    activeMode.value = modeId
    params.value = { ...SCREENER_MODES[modeId].defaultParams }
  }

  // 切換時光機回測天數 (0 ~ 5)
  function setDayOffset(offset = 0) {
    selectedDayOffset.value = Math.max(0, Math.min(5, Number(offset) || 0))
  }

  // 篩選結果運算（包含符合與未符合分流，以及 ALL 模式時的策略命中計算）
  const screenerOutput = computed(() => {
    const rawList = stocks.value || []
    if (!Array.isArray(rawList)) return { matched: [], unmatched: [] }

    // 若啟用時光機回測，自動將股票池倒流至該歷史交易日
    const list = selectedDayOffset.value > 0
      ? sliceStockPoolAt(rawList, selectedDayOffset.value)
      : rawList

    const matched = []
    const unmatched = []

    for (const stock of list) {
      const price = stock.price ?? 0
      const ma5   = stock.ma5 ?? 0
      const ma20  = stock.ma20 ?? 0

      const bias5 = typeof stock.bias5 === 'number'
        ? stock.bias5
        : (ma5 > 0 ? Math.round((((price - ma5) / ma5) * 100 + Number.EPSILON) * 100) / 100 : 0)

      const bias20 = typeof stock.bias20 === 'number'
        ? stock.bias20
        : (ma20 > 0 ? Math.round((((price - ma20) / ma20) * 100 + Number.EPSILON) * 100) / 100 : 0)

      const enrichedStock = {
        ...stock,
        bias5,
        bias20,
      }

      if (activeMode.value === 'ALL') {
        // 在 ALL 模式下，計算這檔股票命中了哪些預設策略
        const matchedModeLabels = []
        for (const [mKey, mObj] of Object.entries(SCREENER_MODES)) {
          const evalRes = evaluateStock(enrichedStock, mObj.defaultParams, mKey)
          if (evalRes.isMatch) {
            matchedModeLabels.push(mObj.label)
          }
        }
        enrichedStock.matchedModes = matchedModeLabels
        enrichedStock.filterEvaluation = { isMatch: true, reasonText: '全市場總覽' }
        matched.push(enrichedStock)
      } else {
        const evalResult = evaluateStock(enrichedStock, params.value, activeMode.value)
        enrichedStock.filterEvaluation = evalResult
        if (evalResult.isMatch) {
          matched.push(enrichedStock)
        } else {
          unmatched.push(enrichedStock)
        }
      }
    }

    return { matched, unmatched }
  })

  // 符合條件的股票
  const results = computed(() => screenerOutput.value.matched)

  // 未符合當前模式的股票（包含淘汰原因）
  const unmatchedResults = computed(() => screenerOutput.value.unmatched)

  // 各模式即時符合檔數統計 (ALL + 3 大策略)
  const modeCounts = computed(() => {
    const rawList = stocks.value || []
    const counts = {
      ALL: rawList.length,
    }
    for (const [modeKey, modeObj] of Object.entries(SCREENER_MODES)) {
      const modeParams = activeMode.value === modeKey ? params.value : modeObj.defaultParams
      const matched = runScreener(rawList, modeParams, modeKey, selectedDayOffset.value)
      counts[modeKey] = matched.length
    }
    return counts
  })

  return {
    activeMode: readonly(activeMode),
    params,
    selectedDayOffset: readonly(selectedDayOffset),
    results,
    unmatchedResults,
    modeCounts,
    modes: SCREENER_MODES,
    setMode,
    setDayOffset,
  }
}
