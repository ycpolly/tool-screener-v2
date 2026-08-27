import { ref, computed, readonly } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

/**
 * useRealtimeQuotes — GCP 即時行情與大盤同步
 *
 * 職責：
 * - 管理 GCP Cloud Function API 網址（localStorage 優先，fallback 為 .env.local）
 * - 透過 HTTP GET ?symbols=... 批次抓取全選股池與加權 (t00)、櫃買 (o00) 即時報價
 * - 嚴格遵循「資料正確性第一」：若有缺漏代碼，立即在 console 報錯並於 UI 提示，絕不拿舊資料補洞
 */

const STORAGE_KEY_URL = 'GCP_FUNCTION_URL'

// 初始化 GCP URL：優先讀取 localStorage，若無則讀取 Vite 環境變數
function getInitialGcpUrl() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_URL)
    if (saved && saved.trim()) return saved.trim()
  } catch { /* 靜默忽略 */ }
  return (import.meta.env.VITE_GCP_URL ?? '').trim()
}

const _gcpUrl      = ref(getInitialGcpUrl())
const _quotes      = ref({})   // { [code]: { price, open, high, low, volume, change, changePct, ... } }
const _loading     = ref(false)
const _lastUpdated = ref(null)
const _error       = ref(null)
const _missing     = ref([])

export function useRealtimeQuotes() {
  const isConfigured = computed(() => !!_gcpUrl.value)

  /**
   * 儲存並更新 GCP Cloud Function 網址
   * @param {string} url
   */
  function saveGcpUrl(url) {
    const cleanUrl = (url ?? '').trim()
    _gcpUrl.value = cleanUrl
    try {
      if (cleanUrl) {
        localStorage.setItem(STORAGE_KEY_URL, cleanUrl)
      } else {
        localStorage.removeItem(STORAGE_KEY_URL)
      }
    } catch (err) {
      console.warn('[useRealtimeQuotes] 無法寫入 localStorage:', err)
    }
  }

  /**
   * 清除已儲存的 GCP 網址
   */
  function clearGcpUrl() {
    saveGcpUrl('')
  }

  /**
   * 批次拉取即時行情（個股 + t00 加權 + o00 櫃買）
   * @param {string[]} codes - 個股代碼陣列
   * @returns {Promise<Object|null>} - 回傳即時報價 Map 或 null
   */
  async function fetchQuotes(codes = []) {
    const baseUrl = _gcpUrl.value
    if (!baseUrl) {
      _error.value = UI_STRINGS.API_SETTINGS.emptyNotice
      console.warn('[useRealtimeQuotes] 未設定 GCP API 網址')
      return null
    }

    if (!codes || codes.length === 0) return null

    // 整合個股代碼與大盤加權 (t00)、櫃買 (o00)
    const targetCodes = Array.from(new Set([...codes, 't00', 'o00']))
    const symbolsParam = encodeURIComponent(targetCodes.join(','))
    const requestUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}symbols=${symbolsParam}`

    _loading.value = true
    _error.value = null
    _missing.value = []

    try {
      const res = await fetch(requestUrl, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const json = await res.json()

      if (!json || !json.success || !json.data) {
        throw new Error('API 回傳格式無效')
      }

      const returnedData = json.data
      const missingList = []

      // 嚴格資料正確性檢查：比對所有請求的代碼
      for (const code of targetCodes) {
        const item = returnedData[code]
        if (!item || typeof item.price !== 'number' || item.price <= 0) {
          missingList.push(code)
        }
      }

      if (missingList.length > 0) {
        _missing.value = missingList
        console.warn(`[useRealtimeQuotes] ⚠️ 即時行情回傳不完整，共遺漏 ${missingList.length} 筆:`, missingList)
        _error.value = UI_STRINGS.REALTIME.missingWarning(missingList.length)
      }

      // 只採納本次正式回傳且具有有效價格的資料（嚴禁使用舊快取補洞）
      const validQuotes = {}
      for (const [code, item] of Object.entries(returnedData)) {
        if (item && typeof item.price === 'number' && item.price > 0) {
          validQuotes[code] = item
        }
      }

      _quotes.value = validQuotes
      _lastUpdated.value = new Date().toLocaleTimeString('zh-TW', { hour12: false })

      return validQuotes
    } catch (err) {
      console.error('[useRealtimeQuotes] 連線行情 API 失敗:', err)
      _error.value = UI_STRINGS.REALTIME.fetchFailed
      return null
    } finally {
      _loading.value = false
    }
  }

  /**
   * 取得單一個股的即時報價
   * @param {string} code
   * @returns {Object|null}
   */
  function getQuote(code) {
    return _quotes.value[code] ?? null
  }

  return {
    gcpUrl:       readonly(_gcpUrl),
    quotes:       readonly(_quotes),
    loading:      readonly(_loading),
    lastUpdated:  readonly(_lastUpdated),
    error:        readonly(_error),
    missingCodes: readonly(_missing),
    isConfigured,
    saveGcpUrl,
    clearGcpUrl,
    fetchQuotes,
    getQuote,
  }
}
