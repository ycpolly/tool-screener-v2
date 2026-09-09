<template>
  <div :data-theme="isDark ? 'dracula' : 'cupcake'" class="min-h-dvh bg-base-100 text-base-content antialiased flex flex-col">
    <!-- 頂部 Navbar -->
    <header class="sticky top-0 z-40 bg-base-100/90 backdrop-blur border-b border-base-300 h-13 flex items-center px-4 md:px-6">
      <div class="flex items-baseline gap-2">
        <h1 class="font-bold text-base md:text-lg tracking-tight text-base-content">
          {{ UI_STRINGS.APP.title }}
        </h1>
        <span
          class="text-sm font-numeric font-normal text-base-content/80 select-none cursor-pointer"
          title="點擊重新整理頁面"
          @click="reloadPage"
        >
          {{ UI_STRINGS.APP.version }}
        </span>
      </div>

      <div class="ml-auto flex items-center gap-1.5 sm:gap-2">
        <!-- 選股池來源總覽按鈕 (與 API 設定一致的 rounded-lg h-9 w-9) -->
        <button
          class="btn btn-sm btn-ghost h-9 w-9 min-h-0 p-0 rounded-lg text-base-content/80 hover:text-base-content transition-colors cursor-pointer flex items-center justify-center"
          :title="UI_STRINGS.STOCK_POOL_MODAL.title"
          :aria-label="UI_STRINGS.STOCK_POOL_MODAL.title"
          @click="openPoolModal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </button>

        <!-- 行情 API 設定按鈕 (與主題切換一致的 rounded-lg h-9 w-9) -->
        <button
          class="btn btn-sm btn-ghost h-9 w-9 min-h-0 p-0 rounded-lg text-base-content/80 hover:text-base-content transition-colors cursor-pointer flex items-center justify-center"
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

    <!-- 主體內容容器 (Mobile-first, max-w-screen-xl, 支援 iPhone 底部安全區域) -->
    <main class="container mx-auto px-3 sm:px-4 pt-3 safe-pb-main md:py-5 max-w-screen-xl space-y-3.5 flex-1">
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
        <div class="flex items-center gap-2 text-sm font-numeric text-base-content/80">
          <span
            class="inline-block w-2 h-2 rounded-full shrink-0"
            :class="(poolLoading || quotesLoading) ? 'bg-warning animate-ping' : (isPostMarketTime ? 'bg-base-content/40' : (quotesLastUpdated ? 'bg-success shadow-xs' : 'bg-primary/80'))"
          ></span>
          <span class="font-medium tracking-wide">
            {{ dataTimestampText || '資料載入中…' }}
          </span>
        </div>

        <!-- 右側：一鍵精選、快照與更新操作按鈕 (統一 rounded-lg h-9，無陰影) -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- 選股快照按鈕 (第二級 UI: btn-outline btn-neutral，純剪貼簿 SVG) -->
          <button
            class="btn btn-sm btn-outline btn-neutral h-9 w-9 min-h-0 p-0 rounded-lg cursor-pointer shadow-none transition-all flex items-center justify-center"
            :title="UI_STRINGS.SNAPSHOT.copyBtnTitle"
            :aria-label="UI_STRINGS.SNAPSHOT.copyBtnTitle"
            :disabled="poolLoading || activeStocks.length === 0"
            @click="handleCopySnapshot"
          >
            <!-- 正常狀態：剪貼簿圖示 -->
            <svg
              v-if="!copiedRecently"
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <!-- 成功狀態：打勾圖示 (綠色) -->
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </button>

          <!-- 一鍵精選按鈕 (深色 Neutral / Outline，手機為 36px 圖示按鈕，電腦端展開顯示文字) -->
          <button
            class="btn btn-sm h-9 min-h-0 w-9 p-0 sm:w-auto sm:px-3 rounded-lg cursor-pointer shadow-none transition-all flex items-center justify-center gap-1.5"
            :class="[
              isPremium
                ? 'btn-neutral font-bold'
                : 'btn-outline btn-neutral',
              activeMode === 'ALL' ? 'opacity-40 cursor-not-allowed' : ''
            ]"
            :title="activeMode === 'ALL' ? (UI_STRINGS.SCREENER.premiumDisabledInAll || '全市場模式未套用策略') : (isPremium ? (UI_STRINGS.SCREENER.premiumActive || '已啟用一鍵精選') : (UI_STRINGS.SCREENER.premiumToggle || '一鍵精選'))"
            :aria-label="isPremium ? (UI_STRINGS.SCREENER.premiumActive || '已啟用一鍵精選') : (UI_STRINGS.SCREENER.premiumToggle || '一鍵精選')"
            :disabled="activeMode === 'ALL'"
            @click="togglePremium"
          >
            <!-- 俐落簡約 SVG 星芒圖示 -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span class="hidden sm:inline text-xs sm:text-sm font-medium">
              {{ isPremium ? (UI_STRINGS.SCREENER.premiumActiveText || '精選中') : (UI_STRINGS.SCREENER.premiumToggle || '一鍵精選') }}
            </span>
          </button>

          <button
            class="btn btn-sm btn-neutral gap-1.5 font-medium h-9 min-h-0 px-3 rounded-lg cursor-pointer shadow-none"
            :disabled="poolLoading || quotesLoading"
            @click="handleFetchRealtime"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              :class="{ 'animate-spin': poolLoading || quotesLoading }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="text-sm font-medium">
              {{ (poolLoading || quotesLoading) ? UI_STRINGS.REALTIME.fetchingBtn : UI_STRINGS.REALTIME.fetchBtn }}
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
          :is-compact="isCompact"
          @update:sort-key="sortKey = $event"
          @update:sort-dir="sortDir = $event"
          @toggle-compact="toggleCompact"
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
          :is-compact="isCompact"
          @select="handleSelectStock"
          @open-risk-modal="handleOpenRiskModal"
          @open-price-calc="handleOpenPriceCalc"
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

    <!-- 選股池來源總覽 Modal -->
    <StockPoolModal
      :is-open="showPoolModal"
      :stocks="baseStocks"
      :rankings="baseRankings"
      :updated-at="meta?.updatedAt"
      @close="closePoolModal"
      @select-stock="handleSelectStockFromPool"
    />

    <!-- 價格速算 Bottom Sheet Modal -->
    <PriceCalcModal
      :is-open="showPriceCalcModal"
      :stock="selectedCalcStock"
      @close="closePriceCalcModal"
    />

    <!-- 空間與風控全貌 Modal (Gemini 完成 RiskModal.vue 後引入掛載) -->
    <!--
    <RiskModal
      :is-open="showRiskModal"
      :stock="selectedRiskStock"
      @close="handleCloseRiskModal"
    />
    -->

    <!-- 輕量 Toast 提示 (快照複製、盤前與休市提示) -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div v-if="toastText" class="fixed safe-bottom-toast left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 max-w-sm w-full">
        <div class="alert alert-neutral shadow-lg py-2.5 px-4 text-sm rounded-xl flex items-center justify-center gap-2 border border-base-content/10">
          <svg
            v-if="toastType === 'success'"
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-success shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-info shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="font-medium">{{ toastText }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, onMounted } from 'vue'
import { UI_STRINGS } from './constants/ui-strings.js'
import { useStockPool } from './composables/useStockPool.js'
import { useScreener } from './composables/useScreener.js'
import { useRealtimeQuotes } from './composables/useRealtimeQuotes.js'
import { mergeAllRealtimeQuotes, buildScreenerSnapshotText } from './engine/screener.js'

import ThemeToggle from './components/ThemeToggle.vue'
import MarketBanner from './components/MarketBanner.vue'
import ScreenerPanel from './components/ScreenerPanel.vue'
import SearchBar from './components/SearchBar.vue'
import StockTable from './components/StockTable.vue'
import StockPoolModal from './components/modals/StockPoolModal.vue'
import PriceCalcModal from './components/modals/PriceCalcModal.vue'

const searchQuery = ref('')
const sortKey     = ref('changePct')
const sortDir     = ref('desc')
const isDark      = ref(false)
const isCompact   = ref(false)

const showPriceCalcModal = ref(false)
const selectedCalcStock = shallowRef(null)

function handleOpenPriceCalc(stock) {
  selectedCalcStock.value = stock
  showPriceCalcModal.value = true
}

function closePriceCalcModal() {
  showPriceCalcModal.value = false
  selectedCalcStock.value = null
}

function toggleCompact() {
  isCompact.value = !isCompact.value
  localStorage.setItem('tool_display_mode', isCompact.value ? 'compact' : 'full')
}

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('tool_theme', isDark.value ? 'dracula' : 'cupcake')
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dracula' : 'cupcake')
}

// 1. 載入盤後基礎資料池
const { stocks: baseStocks, rankings: baseRankings, market: baseMarket, meta, loading: poolLoading, error: poolError, loadPool } = useStockPool()

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
  clearError: clearQuotesError,
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

function formatFriendlyTime(isoString) {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${mm}/${dd} ${hh}:${min}`
  } catch {
    return ''
  }
}

// 頂部導覽列資料時間戳記文字（包含 年/月/日、星期 與 撮合時間，三階段區分：盤中/收盤/盤後）
const isPostMarketTime = computed(() => {
  const now = new Date()
  const nowHour = now.getHours()
  const nowMin = now.getMinutes()
  const timeInMinutes = nowHour * 60 + nowMin
  // 19:16 (1156分) 之後 或 隔日開盤前 (00:00 ~ 08:59)：以盤後爬蟲資料庫為準
  return timeInMinutes >= 1156 || nowHour < 9
})

const dataTimestampText = computed(() => {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const weekDay = WEEKDAYS[now.getDay()]

  const rawUpdated = meta.value?.updatedAt

  // 1. 晚間 19:16 後 / 隔日清晨 09:00 前：以盤後爬蟲資料庫為準
  if (isPostMarketTime.value && rawUpdated) {
    try {
      const d = new Date(rawUpdated)
      if (!isNaN(d.getTime())) {
        const dY = String(d.getFullYear()).slice(-2)
        const dM = String(d.getMonth() + 1).padStart(2, '0')
        const dD = String(d.getDate()).padStart(2, '0')
        const dW = WEEKDAYS[d.getDay()]
        const hh = String(d.getHours()).padStart(2, '0')
        const min = String(d.getMinutes()).padStart(2, '0')

        const nowHour = now.getHours()
        const isPreMarket = nowHour < 9 && now.getDay() >= 1 && now.getDay() <= 5
        const prefix = isPreMarket
          ? (UI_STRINGS.APP.prefixPreMarket || '盤前 ')
          : (UI_STRINGS.APP.prefixPostMarket || '盤後 ')

        return `${prefix}${dY}/${dM}/${dD} 週${dW} ${hh}:${min}`
      }
    } catch {}
    return `${UI_STRINGS.APP.prefixPostMarket || '盤後 '}${rawUpdated}`
  }

  // 2. 09:00 ~ 19:16 之間若有 GCP 即時行情：
  if (quotesLastUpdated.value) {
    const timeStr = quotesLastUpdated.value
    const nowHour = now.getHours()
    const nowMin = now.getMinutes()
    const isClosedIntraday = (nowHour > 13) || (nowHour === 13 && nowMin >= 30)
    const prefix = isClosedIntraday
      ? (UI_STRINGS.APP.prefixClosed || '收盤 ')
      : (UI_STRINGS.APP.prefixIntraday || '盤中 ')

    if (timeStr.includes('-') || timeStr.includes('/')) {
      return `${prefix}${timeStr}`
    }
    const cleanTime = timeStr.length > 5 ? timeStr.slice(0, 5) : timeStr
    return `${prefix}${yy}/${mm}/${dd} 週${weekDay} ${cleanTime}`
  }

  // 3. 無即時報價時之 fallback
  if (!rawUpdated) return ''
  try {
    const d = new Date(rawUpdated)
    if (!isNaN(d.getTime())) {
      const dY = String(d.getFullYear()).slice(-2)
      const dM = String(d.getMonth() + 1).padStart(2, '0')
      const dD = String(d.getDate()).padStart(2, '0')
      const dW = WEEKDAYS[d.getDay()]
      const hh = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      const prefix = UI_STRINGS.APP.prefixPostMarket || '盤後 '
      return `${prefix}${dY}/${dM}/${dD} 週${dW} ${hh}:${min}`
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



// 5. 選股池來源總覽 Modal
const showPoolModal = ref(false)

function openPoolModal() {
  showPoolModal.value = true
}

function closePoolModal() {
  showPoolModal.value = false
}

function handleSelectStockFromPool(stock) {
  searchQuery.value = stock.code
  closePoolModal()
}

// 6. 空間與風控全貌 Modal 狀態 (選股卡點擊關卡純利槽位觸發)
const showRiskModal = ref(false)
const selectedRiskStock = ref(null)

function handleOpenRiskModal(stock) {
  selectedRiskStock.value = stock
  showRiskModal.value = true
}

function handleCloseRiskModal() {
  showRiskModal.value = false
  selectedRiskStock.value = null
}

// 7. 即時更新與 API 設定 Modal
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

async function handleFetchRealtime() {
  const now = new Date()
  const day = now.getDay()
  const isWeekend = day === 0 || day === 6
  const hour = now.getHours()
  const min = now.getMinutes()
  const timeInMinutes = hour * 60 + min

  // 09:00 (540分) ~ 19:16 (1156分) 之間為交易與收盤過渡期（含機器人備援重疊區間）
  const isMarketOrTransitionTime = !isWeekend && timeInMinutes >= 540 && timeInMinutes <= 1156

  const oldUpdatedAt = meta.value?.updatedAt

  // 1. 無論任何時段，皆強制向雲端重新請求 stock-pool.json（以動態時間戳記穿透瀏覽器快取）
  const newPoolData = await loadPool()
  const currentUpdatedAt = newPoolData?.meta?.updatedAt || meta.value?.updatedAt
  const friendlyTime = formatFriendlyTime(currentUpdatedAt) || '最新'

  // 2. 若在 09:00 ~ 19:16 交易與收盤過渡期，且已設定 GCP：同時抓取即時/收盤報價
  if (isMarketOrTransitionTime) {
    if (!isConfigured.value) {
      openApiModal()
      return
    }

    if (baseStocks.value && baseStocks.value.length > 0) {
      const codes = baseStocks.value.map(s => s.code)
      // 18:00 之後若 MIS 撮合伺服器陸續離線，啟用靜默降級，不跳刺眼黃色警告
      const quotesResult = await fetchQuotes(codes, { silentIfOffline: hour >= 18 })
      if (quotesResult && Object.keys(quotesResult).length > 0) {
        triggerToast(UI_STRINGS.REALTIME.syncRealtimeSuccess(Object.keys(quotesResult).length, friendlyTime), 'success')
        return
      }
    }
  }

  // 3. 盤後時段（19:16 後、清晨、週末）或 GCP 靜默回退：
  // 清除即時行情錯誤，避免黃色警告殘留，給予最讓人安心的確定回饋
  clearQuotesError()

  if (oldUpdatedAt && currentUpdatedAt && oldUpdatedAt !== currentUpdatedAt) {
    triggerToast(UI_STRINGS.REALTIME.poolUpdatedNew(friendlyTime), 'success')
  } else {
    triggerToast(UI_STRINGS.REALTIME.poolAlreadyLatest(friendlyTime), 'info')
  }
}

function reloadPage() {
  window.location.reload()
}

// 7. 選股快照複製與行動端原生分享
const copiedRecently = ref(false)
const toastText = ref('')
const toastType = ref('success')
let copyTimer = null
let toastTimer = null

function triggerToast(text, type = 'info', duration = 5000) {
  toastText.value = text
  toastType.value = type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastText.value = ''
  }, duration)
}

function triggerSuccessFeedback() {
  copiedRecently.value = true
  triggerToast(UI_STRINGS.SNAPSHOT.copiedToast, 'success')

  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copiedRecently.value = false
  }, 1500)
}

async function copyTextToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    triggerSuccessFeedback()
  } catch (err) {
    console.error('[Snapshot Copy Failed]', err)
  }
}

async function handleCopySnapshot() {
  if (!activeStocks.value || activeStocks.value.length === 0) return

  const text = buildScreenerSnapshotText({
    stocks: activeStocks.value,
    meta: meta.value,
    quotesLastUpdated: quotesLastUpdated.value,
    dayOffset: selectedDayOffset.value,
  })

  // 1. 行動裝置優先（iOS Safari / Android）：呼叫原生 Web Share API 滑出系統分享面板 (直通 LINE)
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  if (isMobile && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: UI_STRINGS.SNAPSHOT?.title || '【豐盛幫手選股快照】',
        text,
      })
      triggerSuccessFeedback()
      return
    } catch (err) {
      // 使用者在 iOS 分享面板按下「取消」時系統會拋出 AbortError，靜默結束即可
      if (err?.name === 'AbortError') {
        return
      }
      // 其餘異常自動降級至剪貼簿
      await copyTextToClipboard(text)
      return
    }
  }

  // 2. 電腦桌機端 (PC / Mac) 或不支援原生分享環境：直接複製至剪貼簿
  await copyTextToClipboard(text)
}

onMounted(() => {
  const savedTheme = localStorage.getItem('tool_theme')
  if (savedTheme) {
    isDark.value = savedTheme === 'dracula' || savedTheme === 'night' || savedTheme === 'dim' || savedTheme === 'business' || savedTheme === 'dark'
  } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    isDark.value = true
  }
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dracula' : 'cupcake')

  const savedDisplayMode = localStorage.getItem('tool_display_mode')
  if (savedDisplayMode === 'compact') {
    isCompact.value = true
  }

  loadPool()
})
</script>
