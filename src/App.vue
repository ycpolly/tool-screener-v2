<template>
  <div :data-theme="isDark ? 'dracula' : 'cupcake'" class="min-h-dvh bg-base-100 text-base-content antialiased flex flex-col">
    <!-- 頂部 Navbar -->
    <header class="sticky top-0 z-40 bg-base-100/90 backdrop-blur border-b border-base-300 h-13 flex items-center px-4 md:px-6">
      <div class="flex items-baseline gap-2">
        <h1 class="font-bold text-base md:text-lg tracking-tight text-base-content">
          {{ UI_STRINGS.APP.title }}
        </h1>
        <span
          class="text-xs sm:text-sm font-numeric font-normal text-base-content/80 select-none cursor-pointer"
          title="點擊重新整理頁面"
          @click="reloadPage"
        >
          {{ UI_STRINGS.APP.version }}
        </span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <!-- 行情 API 設定按鈕 (與主題切換一致的 rounded-lg h-8 w-8) -->
        <button
          class="btn btn-sm btn-ghost h-8 w-8 min-h-0 p-0 rounded-lg text-base-content/80 hover:text-base-content transition-colors cursor-pointer flex items-center justify-center"
          :title="UI_STRINGS.API_SETTINGS.modalTitle"
          :aria-label="UI_STRINGS.API_SETTINGS.modalTitle"
          @click="openApiModal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </button>

        <!-- 主題切換按鈕 (快捷日夜切換) -->
        <ThemeToggle :is-dark="isDark" @toggle="toggleTheme" />
      </div>
    </header>

    <!-- 主體內容容器 (Mobile-first, max-w-screen-xl) -->
    <main class="container mx-auto px-3 sm:px-4 py-3 md:py-5 max-w-screen-xl space-y-3.5 flex-1">
      <!-- 基礎資料池錯誤 -->
      <div v-if="poolError" class="alert alert-error text-sm">
        <span>{{ poolError }}</span>
        <button class="btn btn-sm btn-outline" @click="loadPool">重試</button>
      </div>

      <!-- 即時行情警告 / 錯誤 (資料完整性警示) -->
      <div v-if="quotesError" class="alert alert-warning text-sm shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ quotesError }}</span>
      </div>

      <!-- 即時數據脈搏與更新控制列 (Data Pulse & Action Bar) -->
      <div class="flex items-center justify-between px-3 py-2 bg-base-200/60 border border-base-300/60 rounded-xl">
        <!-- 左側：資料時間戳記與連線狀態點 -->
        <div class="flex items-center gap-2 text-xs sm:text-sm font-numeric text-base-content/80">
          <span
            class="inline-block w-2 h-2 rounded-full shrink-0"
            :class="quotesLoading ? 'bg-warning animate-ping' : (quotesLastUpdated ? 'bg-success shadow-xs' : 'bg-primary/80')"
          ></span>
          <span class="font-medium tracking-wide">
            {{ dataTimestampText || '資料載入中…' }}
          </span>
        </div>

        <!-- 右側：更新操作按鈕 (預留未來自動更新開關空間，統一 rounded-lg h-8，無陰影) -->
        <div class="flex items-center gap-2">
          <button
            class="btn btn-sm btn-neutral gap-1.5 font-medium h-8 min-h-0 px-2.5 rounded-lg cursor-pointer shadow-none"
            :disabled="poolLoading || quotesLoading"
            @click="handleFetchRealtime"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              :class="{ 'animate-spin': quotesLoading }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="text-xs sm:text-sm">
              {{ quotesLoading ? UI_STRINGS.REALTIME.fetchingBtn : UI_STRINGS.REALTIME.fetchBtn }}
            </span>
          </button>
        </div>
      </div>

      <!-- 核心工作區：先聚焦打磨 StockCard -->
      <template v-if="!poolError">
        <!-- 模式選股與微調面板 -->
        <ScreenerPanel
          :modes="modes"
          :active-mode="activeMode"
          :params="params"
          :mode-counts="modeCounts"
          :results-count="results.length"
          :total-count="activeStocks.length"
          :day-offset="selectedDayOffset"
          :updated-at="meta?.updatedAt || ''"
          :is-premium="isPremium"
          @update:active-mode="setMode"
          @update:params="params = $event"
          @update:day-offset="setDayOffset"
          @toggle-premium="togglePremium"
          @reset="resetParams"
        />

        <!-- 即時個股搜尋與排序工具列 (介於 ScreenerPanel 與 StockTable 之間) -->
        <SearchBar
          v-model="searchQuery"
          :sort-key="sortKey"
          :sort-dir="sortDir"
          @update:sort-key="sortKey = $event"
          @update:sort-dir="sortDir = $event"
        />

        <!-- 選股結果列表 (專注展示 StockCard) -->
        <StockTable
          :stocks="results"
          :unmatched-stocks="unmatchedResults"
          :loading="poolLoading"
          :meta="activeMeta"
          :active-mode="activeMode"
          :search-query="searchQuery"
          :sort-key="sortKey"
          :sort-dir="sortDir"
          @select="handleSelectStock"
          @open-risk-modal="handleOpenRiskModal"
        />
      </template>
    </main>

    <!-- API 設定 Modal -->
    <dialog class="modal" :class="{ 'modal-open': showApiModal }">
      <div class="modal-box bg-base-200 border border-base-300 max-w-md">
        <h3 class="font-bold text-base md:text-lg mb-2">
          {{ UI_STRINGS.API_SETTINGS.modalTitle }}
        </h3>
        <p class="text-sm text-base-content/80 mb-4">
          {{ UI_STRINGS.API_SETTINGS.modalDesc }}
        </p>

        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text text-sm font-medium">{{ UI_STRINGS.API_SETTINGS.urlLabel }}</span>
          </label>
          <input
            v-model="inputUrl"
            type="text"
            class="input input-bordered input-sm w-full font-mono text-sm"
            :placeholder="UI_STRINGS.API_SETTINGS.urlPlaceholder"
          />
        </div>

        <div class="modal-action flex justify-between items-center">
          <button
            class="btn btn-sm btn-ghost text-error hover:bg-error/10 font-normal"
            @click="handleClearApi"
          >
            {{ UI_STRINGS.API_SETTINGS.clearBtn }}
          </button>
          <div class="flex gap-2">
            <button
              class="btn btn-sm btn-ghost font-normal"
              @click="closeApiModal"
            >
              {{ UI_STRINGS.API_SETTINGS.closeBtn }}
            </button>
            <button
              class="btn btn-sm btn-neutral font-medium"
              @click="handleSaveApi"
            >
              {{ UI_STRINGS.API_SETTINGS.saveBtn }}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="closeApiModal">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { UI_STRINGS } from './constants/ui-strings.js'
import { useStockPool } from './composables/useStockPool.js'
import { useScreener } from './composables/useScreener.js'
import { useRealtimeQuotes } from './composables/useRealtimeQuotes.js'
import { mergeAllRealtimeQuotes } from './engine/screener.js'

import ThemeToggle from './components/ThemeToggle.vue'
import MarketBanner from './components/MarketBanner.vue'
import ScreenerPanel from './components/ScreenerPanel.vue'
import SearchBar from './components/SearchBar.vue'
import StockTable from './components/StockTable.vue'

const searchQuery = ref('')
const sortKey     = ref('changePct')
const sortDir     = ref('desc')
const isDark      = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('tool_theme', isDark.value ? 'dracula' : 'cupcake')
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dracula' : 'cupcake')
}

// 1. 載入盤後基礎資料池
const { stocks: baseStocks, market: baseMarket, meta, loading: poolLoading, error: poolError, loadPool } = useStockPool()

// 2. 即時行情微服務
const {
  gcpUrl,
  quotes,
  loading: quotesLoading,
  lastUpdated: quotesLastUpdated,
  error: quotesError,
  isConfigured,
  saveGcpUrl,
  clearGcpUrl,
  fetchQuotes,
} = useRealtimeQuotes()

// 3. 資料即時合體（歷史基底 + GCP 盤中報價）
const mergedData = computed(() =>
  mergeAllRealtimeQuotes(baseStocks.value, baseMarket.value, quotes.value)
)

const activeStocks = computed(() => mergedData.value.stocks)
const activeMarket = computed(() => mergedData.value.market)
const activeMeta   = computed(() => {
  if (!meta.value) return null
  return {
    ...meta.value,
    lastRealtimeUpdate: quotesLastUpdated.value,
  }
})

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 頂部導覽列資料時間戳記文字（包含 年/月/日、星期 與 撮合時間，三階段區分：盤中/收盤/盤後）
const dataTimestampText = computed(() => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const weekDay = WEEKDAYS[now.getDay()]

  if (quotesLastUpdated.value) {
    const timeStr = quotesLastUpdated.value
    // 依據時間判定是否為 13:30 之後的收盤撮合行情
    const nowHour = now.getHours()
    const nowMin = now.getMinutes()
    const isClosedIntraday = (nowHour > 13) || (nowHour === 13 && nowMin >= 30)
    const prefix = isClosedIntraday
      ? (UI_STRINGS.APP.prefixClosed || '收盤 ')
      : (UI_STRINGS.APP.prefixIntraday || '盤中 ')

    if (timeStr.includes('-') || timeStr.includes('/')) {
      return `${prefix}${timeStr}`
    }
    return `${prefix}${yyyy}/${mm}/${dd} (${weekDay}) ${timeStr}`
  }

  const rawUpdated = meta.value?.updatedAt
  if (!rawUpdated) return ''
  try {
    const d = new Date(rawUpdated)
    if (!isNaN(d.getTime())) {
      const dY = d.getFullYear()
      const dM = String(d.getMonth() + 1).padStart(2, '0')
      const dD = String(d.getDate()).padStart(2, '0')
      const dW = WEEKDAYS[d.getDay()]
      const hh = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      const prefix = UI_STRINGS.APP.prefixPostMarket || '盤後 '
      return `${prefix}${dY}/${dM}/${dD} (${dW}) ${hh}:${min}`
    }
  } catch {}
  return `${UI_STRINGS.APP.prefixPostMarket || '盤後 '}${rawUpdated}`
})



// 4. 篩選邏輯層
const {
  activeMode,
  params,
  selectedDayOffset,
  isPremium,
  results,
  unmatchedResults,
  modeCounts,
  modes,
  setMode,
  setDayOffset,
  togglePremium,
  resetParams,
} = useScreener(activeStocks)

function handleSelectStock(stock) {
  console.log('[Stock Selected]', stock.code, stock.name)
}


function handleOpenRiskModal(stock) {
  console.log('[Open Risk Modal]', stock.code, stock.name)
}

// 5. 即時更新與 API 設定 Modal
const showApiModal = ref(false)
const inputUrl     = ref('')

function openApiModal() {
  inputUrl.value = gcpUrl.value || ''
  showApiModal.value = true
}

function closeApiModal() {
  showApiModal.value = false
}

function handleSaveApi() {
  saveGcpUrl(inputUrl.value)
  showApiModal.value = false
  if (isConfigured.value) {
    handleFetchRealtime()
  }
}

function handleClearApi() {
  clearGcpUrl()
  inputUrl.value = ''
  showApiModal.value = false
}

function handleFetchRealtime() {
  if (!isConfigured.value) {
    openApiModal()
    return
  }
  if (!baseStocks.value || baseStocks.value.length === 0) return
  const codes = baseStocks.value.map(s => s.code)
  fetchQuotes(codes)
}

function reloadPage() {
  window.location.reload()
}

onMounted(() => {
  const savedTheme = localStorage.getItem('tool_theme')
  if (savedTheme) {
    isDark.value = savedTheme === 'dracula' || savedTheme === 'night' || savedTheme === 'dim' || savedTheme === 'business' || savedTheme === 'dark'
  } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    isDark.value = true
  }
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dracula' : 'cupcake')

  loadPool()
})
</script>
