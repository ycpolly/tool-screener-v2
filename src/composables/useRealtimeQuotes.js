import { ref, readonly } from 'vue'

/**
 * useRealtimeQuotes — GCP 即時行情
 *
 * 職責：呼叫 GCP Cloud Function，管理即時報價快取
 * 資料來源：富果 API（前 60 檔）+ TWSE MIS 批次（剩餘）
 */

const CACHE_KEY = 'CACHED_REALTIME_QUOTES_V2'
const GCP_URL   = import.meta.env.VITE_GCP_URL ?? ''

const _quotes  = ref({})   // { [code]: { price, open, high, low, volume, ... } }
const _loading = ref(false)
const _lastUpdated = ref(null)

// 從 localStorage 恢復上次快取
try {
  const cached = localStorage.getItem(CACHE_KEY)
  if (cached) {
    const parsed = JSON.parse(cached)
    _quotes.value = parsed.quotes ?? {}
    _lastUpdated.value = parsed.updatedAt ?? null
  }
} catch { /* 快取損壞時靜默忽略 */ }

export function useRealtimeQuotes() {
  async function fetchQuotes(codes) {
    if (!GCP_URL) {
      console.warn('[useRealtimeQuotes] VITE_GCP_URL 未設定')
      return
    }
    if (!codes?.length) return

    _loading.value = true
    try {
      const res = await fetch(GCP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes }),
      })
      if (!res.ok) throw new Error(`GCP HTTP ${res.status}`)

      const data = await res.json()
      const now  = new Date().toISOString()

      // 合併更新報價（保留未回傳個股的舊快取）
      _quotes.value = { ..._quotes.value, ...data }
      _lastUpdated.value = now

      // 持久化快取
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        quotes: _quotes.value,
        updatedAt: now,
      }))
    } catch (err) {
      console.error('[useRealtimeQuotes] 更新失敗:', err)
    } finally {
      _loading.value = false
    }
  }

  function getQuote(code) {
    return _quotes.value[code] ?? null
  }

  return {
    quotes:      readonly(_quotes),
    loading:     readonly(_loading),
    lastUpdated: readonly(_lastUpdated),
    fetchQuotes,
    getQuote,
  }
}
