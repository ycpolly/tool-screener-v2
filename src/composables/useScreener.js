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
    if (!SCREENER_MODES[modeId]) return
    activeMode.value = modeId
    params.value = { ...SCREENER_MODES[modeId].defaultParams }
  }

  // 篩選結果（computed 自動響應 stocks / params 變化）
  const results = computed(() =>
    runScreener(stocks.value, params.value)
  )

  return {
    activeMode: readonly(activeMode),
    params,
    results,
    modes: SCREENER_MODES,
    setMode,
  }
}
