import { ref, readonly } from 'vue'

/**
 * useStockPool — 負責載入與快取 stock-pool.json
 *
 * 職責：只做 I/O，不做任何計算或 UI 操作
 */

const _stocks   = ref([])
const _rankings = ref({})
const _market   = ref(null)
const _meta     = ref(null)
const _loading  = ref(false)
const _error    = ref(null)

export function useStockPool() {
  async function loadPool() {
    _loading.value = true
    _error.value   = null

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/stock-pool.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      _stocks.value   = data.stocks   ?? []
      _rankings.value = data.rankings ?? {}
      _market.value   = data.market   ?? null
      _meta.value     = data.meta     ?? null
    } catch (err) {
      _error.value = err.message
      console.error('[useStockPool] 載入失敗:', err)
    } finally {
      _loading.value = false
    }
  }

  return {
    stocks:   readonly(_stocks),
    rankings: readonly(_rankings),
    market:   readonly(_market),
    meta:     readonly(_meta),
    loading:  readonly(_loading),
    error:    readonly(_error),
    loadPool,
  }
}
