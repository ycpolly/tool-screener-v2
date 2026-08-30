import { ref, readonly } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

/**
 * useStockPool — 負責載入與快取 stock-pool.json
 *
 * 職責：載入資料並計算避雷警示（法人/主力賣超）
 */

const _stocks   = ref([])
const _rankings = ref({})
const _market   = ref(null)
const _meta     = ref(null)
const _loading  = ref(false)
const _error    = ref(null)

function computeSellWarning(stockCode, rankings) {
  if (!rankings) return null

  const f1 = new Set((rankings.foreignSell1D?.stocks || []).map((s) => s.code))
  const f3 = new Set((rankings.foreignSell3D?.stocks || []).map((s) => s.code))
  const s3 = new Set((rankings.sitcaSell3D?.stocks || []).map((s) => s.code))
  const m1 = new Set((rankings.majorSell1D?.stocks || []).map((s) => s.code))
  const m3 = new Set((rankings.majorSell3D?.stocks || []).map((s) => s.code))

  const strings = UI_STRINGS.SELL_WARNINGS || {}
  const tags = []

  // 外資賣超：優先 3D，次之 1D
  if (f3.has(stockCode)) {
    tags.push(strings.foreign3D || '外資賣3D')
  } else if (f1.has(stockCode)) {
    tags.push(strings.foreign1D || '外資賣1D')
  }

  // 投信賣超：3D
  if (s3.has(stockCode)) {
    tags.push(strings.sitca3D || '投信賣3D')
  }

  // 主力賣超：優先 3D，次之 1D
  if (m3.has(stockCode)) {
    tags.push(strings.major3D || '主力賣3D')
  } else if (m1.has(stockCode)) {
    tags.push(strings.major1D || '主力賣1D')
  }

  if (tags.length === 0) return null
  return `⚠️ ${tags.join(' · ')}`
}

export function useStockPool() {
  async function loadPool() {
    _loading.value = true
    _error.value   = null

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/stock-pool.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const rawStocks   = data.stocks   ?? []
      const rawRankings = data.rankings ?? {}

      _stocks.value = rawStocks.map((s) => ({
        ...s,
        sellWarning: computeSellWarning(s.code, rawRankings),
      }))
      _rankings.value = rawRankings
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
