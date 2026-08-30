import { ref, computed, readonly } from 'vue'
import { runScreener, mergeRealtimeQuote } from '../engine/screener.js'
import { SCREENER_MODES, DEFAULT_MODE } from '../constants/screener-modes.js'

/**
 * useScreener — 篩選邏輯層
 *
 * 職責：呼叫純引擎，管理篩選條件狀態，不碰 DOM
 */
export function useScreener(stocks) {
  const activeMode = ref(DEFAULT_MODE)
  const params     = ref({ ...SCREENER_MODES[DEFAULT_MODE].defaultParams })

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

  // 篩選結果（computed 自動響應 stocks / params / activeMode 變化）
  const results = computed(() =>
    runScreener(stocks.value, params.value, activeMode.value)
  )

  // 各模式即時符合檔數統計 (ALL + 3 大策略)
  const modeCounts = computed(() => {
    const list = stocks.value || []
    const counts = {
      ALL: list.length,
    }
    for (const [modeKey, modeObj] of Object.entries(SCREENER_MODES)) {
      const modeParams = activeMode.value === modeKey ? params.value : modeObj.defaultParams
      const matched = runScreener(list, modeParams, modeKey)
      counts[modeKey] = matched.length
    }
    return counts
  })

  return {
    activeMode: readonly(activeMode),
    params,
    results,
    modeCounts,
    modes: SCREENER_MODES,
    setMode,
  }
}
