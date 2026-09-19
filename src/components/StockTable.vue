<template>
  <div class="stock-table-container space-y-3">
    <!-- 頂部工具列：筆數統計與模式放寬建議 -->
    <div class="flex flex-wrap items-baseline justify-between gap-2 px-1 text-sm text-base-content/80">
      <div class="flex flex-wrap items-baseline gap-2.5">
        <!-- 搜尋狀態 vs 常態統計 -->
        <span v-if="isSearching" class="font-bold text-sm text-base-content shrink-0">
          {{ UI_STRINGS.SEARCH.searchResultCount(totalFilteredCount) }}
        </span>
        <span v-else class="font-bold text-sm text-base-content shrink-0">
          {{ UI_STRINGS.SCREENER.resultCount(stocks.length) }}
        </span>

        <!-- 模式放寬建議 (非搜尋時顯示) -->
        <span v-if="!isSearching && modeSuggestionText" class="text-sm text-base-content/75 leading-normal">
          {{ modeSuggestionText }}
        </span>
      </div>
    </div>

    <!-- 載入中骨架動畫 (Skeleton Loading) -->
    <div v-if="loading" class="space-y-3">
      <div
        v-for="i in 4"
        :key="i"
        class="bg-base-200 border border-base-300 rounded-xl p-4 animate-pulse space-y-3"
      >
        <div class="flex justify-between items-center">
          <div class="h-5 bg-base-300 rounded w-1/3"></div>
          <div class="h-5 bg-base-300 rounded w-1/4"></div>
        </div>
        <div class="h-4 bg-base-300 rounded w-1/2"></div>
        <div class="h-10 bg-base-300 rounded w-full"></div>
        <div class="grid grid-cols-2 gap-3 pt-2 border-t border-base-300/40">
          <div class="h-12 bg-base-300 rounded"></div>
          <div class="h-12 bg-base-300 rounded"></div>
        </div>
      </div>
    </div>

    <!-- ============================================================
         CASE A: 搜尋狀態中的結果展示 (支援跨符合與未符合直出)
         ============================================================ -->
    <template v-else-if="isSearching">
      <!-- 搜尋完全無結果 -->
      <div
        v-if="totalFilteredCount === 0"
        class="text-center py-16 px-4 bg-base-200/50 border border-dashed border-base-300 rounded-xl"
      >
        <div class="text-base-content/70 text-sm font-medium">
          {{ UI_STRINGS.SEARCH.searchNoResult }}
        </div>
      </div>

      <!-- 搜尋有結果 -->
      <div v-else class="space-y-4">
        <!-- 1. 搜尋符合策略名單 -->
        <div v-if="searchMatchedStocks.length > 0" :class="isCompact ? 'space-y-2' : 'space-y-3'">
          <div
            v-if="activeMode !== 'ALL' && searchUnmatchedStocks.length > 0"
            class="text-xs font-bold text-base-content/70 px-1"
          >
            {{ UI_STRINGS.SEARCH.matchedGroupTitle }} ({{ searchMatchedStocks.length }})
          </div>
          <StockCard
            v-for="stock in visibleSearchMatchedStocks"
            :key="stock.code"
            v-memo="[stock.code, stock.price, stock.changePct, stock.volume, isCompact, activeMode]"
            :stock="stock"
            :active-mode="activeMode"
            :is-compact="isCompact"
            @select="onCardSelect"
            @open-risk-modal="onCardOpenRiskModal"
            @open-price-calc="onCardOpenPriceCalc"
            @open-lifecycle="onCardOpenLifecycle"
          />

          <!-- 搜尋符合清單批次載入哨兵 -->
          <div
            v-if="hasMoreSearchMatched"
            ref="loadMoreSearchMatchedRef"
            class="py-3 flex items-center justify-center text-xs text-base-content/50 font-numeric select-none"
          >
            <span class="loading loading-spinner loading-xs text-base-content/40 mr-1.5"></span>
            <span>{{ UI_STRINGS.SCREENER.loadMore(visibleSearchMatchedStocks.length, searchMatchedStocks.length) }}</span>
          </div>
        </div>

        <!-- 2. 搜尋未符合策略名單 (直接展開顯示淘汰原因，無需大海撈針) -->
        <div v-if="activeMode !== 'ALL' && searchUnmatchedStocks.length > 0" :class="isCompact ? 'space-y-2' : 'space-y-3'">
          <div
            v-if="searchMatchedStocks.length > 0"
            class="text-xs font-bold text-base-content/70 px-1 pt-2 border-t border-base-300/60"
          >
            {{ UI_STRINGS.SEARCH.unmatchedGroupTitle }} ({{ searchUnmatchedStocks.length }})
          </div>
          <StockCard
            v-for="stock in visibleSearchUnmatchedStocks"
            :key="stock.code"
            v-memo="[stock.code, stock.price, stock.changePct, stock.volume, isCompact, true, activeMode]"
            :stock="stock"
            :active-mode="activeMode"
            :is-unmatched="true"
            :is-compact="isCompact"
            @select="onCardSelect"
            @open-risk-modal="onCardOpenRiskModal"
            @open-price-calc="onCardOpenPriceCalc"
            @open-lifecycle="onCardOpenLifecycle"
          />

          <!-- 搜尋未符合清單批次載入哨兵 -->
          <div
            v-if="hasMoreSearchUnmatched"
            ref="loadMoreSearchUnmatchedRef"
            class="py-3 flex items-center justify-center text-xs text-base-content/50 font-numeric select-none"
          >
            <span class="loading loading-spinner loading-xs text-base-content/40 mr-1.5"></span>
            <span>{{ UI_STRINGS.SCREENER.loadMore(visibleSearchUnmatchedStocks.length, searchUnmatchedStocks.length) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ============================================================
         CASE B: 常態無搜尋時的結果展示 (符合在上 + 未符合底部折疊)
         ============================================================ -->
    <template v-else>
      <!-- 無符合資料狀態 (Empty State) -->
      <div
        v-if="stocks.length === 0"
        class="text-center py-16 px-4 bg-base-200/50 border border-dashed border-base-300 rounded-xl"
      >
        <div class="text-base-content/70 text-sm font-medium">
          {{ UI_STRINGS.SCREENER.noResult }}
        </div>
      </div>

      <!-- 符合策略結果清單 (漸進式批次渲染 StockCard) -->
      <div v-else :class="isCompact ? 'space-y-2' : 'space-y-3'">
        <StockCard
          v-for="stock in visibleSortedStocks"
          :key="stock.code"
          v-memo="[stock.code, stock.price, stock.changePct, stock.volume, isCompact, activeMode]"
          :stock="stock"
          :active-mode="activeMode"
          :is-compact="isCompact"
          @select="onCardSelect"
          @open-risk-modal="onCardOpenRiskModal"
          @open-price-calc="onCardOpenPriceCalc"
          @open-lifecycle="onCardOpenLifecycle"
        />

        <!-- 漸進式批次載入哨兵 (向下滑動 400px 提前無感自動加載) -->
        <div
          v-if="hasMoreStocks"
          ref="loadMoreTriggerRef"
          class="py-3 flex items-center justify-center text-xs text-base-content/50 font-numeric select-none"
        >
          <span class="loading loading-spinner loading-xs text-base-content/40 mr-1.5"></span>
          <span>{{ UI_STRINGS.SCREENER.loadMore(visibleSortedStocks.length, sortedStocks.length) }}</span>
        </div>
      </div>

      <!-- 未符合個股折疊清單 (僅在策略模式且有未符合個股時顯示) -->
      <div
        v-if="activeMode !== 'ALL' && unmatchedStocks.length > 0"
        class="pt-3 border-t border-base-300/60 space-y-3"
      >
        <div class="flex items-center justify-center">
          <button
            type="button"
            class="btn btn-sm btn-ghost text-sm text-base-content/80 hover:text-base-content font-medium gap-1.5 h-8 min-h-0"
            @click="showUnmatched = !showUnmatched"
          >
            <span>{{ showUnmatched ? UI_STRINGS.SCREENER.collapseUnmatched(unmatchedStocks.length) : UI_STRINGS.SCREENER.expandUnmatched(unmatchedStocks.length) }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 transition-transform duration-200"
              :class="{ 'rotate-180': showUnmatched }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <!-- 展開未符合清單 (渲染 StockCard，isUnmatched=true) -->
        <div v-if="showUnmatched" :class="isCompact ? 'space-y-2 opacity-90' : 'space-y-3 opacity-90'">
          <StockCard
            v-for="stock in visibleSortedUnmatchedStocks"
            :key="stock.code"
            v-memo="[stock.code, stock.price, stock.changePct, stock.volume, isCompact, true, activeMode]"
            :stock="stock"
            :active-mode="activeMode"
            :is-unmatched="true"
            :is-compact="isCompact"
            @select="onCardSelect"
            @open-risk-modal="onCardOpenRiskModal"
            @open-price-calc="onCardOpenPriceCalc"
            @open-lifecycle="onCardOpenLifecycle"
          />

          <!-- 未符合清單批次載入哨兵 -->
          <div
            v-if="hasMoreUnmatchedStocks"
            ref="loadMoreUnmatchedTriggerRef"
            class="py-3 flex items-center justify-center text-xs text-base-content/50 font-numeric select-none"
          >
            <span class="loading loading-spinner loading-xs text-base-content/40 mr-1.5"></span>
            <span>{{ UI_STRINGS.SCREENER.loadMore(visibleSortedUnmatchedStocks.length, sortedUnmatchedStocks.length) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'
import StockCard from './StockCard.vue'

const props = defineProps({
  stocks: {
    type: Array,
    default: () => [],
  },
  unmatchedStocks: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  meta: {
    type: Object,
    default: null,
  },
  activeMode: {
    type: String,
    default: '',
  },
  searchQuery: {
    type: String,
    default: '',
  },
  sortKey: {
    type: String,
    default: 'changePct',
  },
  sortDir: {
    type: String,
    default: 'desc',
  },
  isCompact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'sort', 'openRiskModal', 'openPriceCalc', 'openLifecycle'])

function onCardSelect(stock) {
  emit('select', stock)
}

function onCardOpenRiskModal(stock) {
  emit('openRiskModal', stock)
}

function onCardOpenPriceCalc(stock) {
  emit('openPriceCalc', stock)
}

function onCardOpenLifecycle(stock) {
  emit('openLifecycle', stock)
}

const showUnmatched = ref(false)

// 搜尋文字比對工具
function matchStock(stock, query) {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  const code = String(stock.code || '').toLowerCase()
  const name = String(stock.name || '').toLowerCase()
  return code.includes(q) || name.includes(q)
}

// 是否處於搜尋狀態
const isSearching = computed(() => {
  return typeof props.searchQuery === 'string' && props.searchQuery.trim().length > 0
})

// 搜尋過濾後的符合名單
const searchMatchedStocks = computed(() => {
  if (!isSearching.value) return sortedStocks.value
  return sortedStocks.value.filter((s) => matchStock(s, props.searchQuery))
})

// 搜尋過濾後的未符合名單
const searchUnmatchedStocks = computed(() => {
  if (!isSearching.value) return sortedUnmatchedStocks.value
  return sortedUnmatchedStocks.value.filter((s) => matchStock(s, props.searchQuery))
})

// 搜尋模式總結果數
const totalFilteredCount = computed(() => {
  if (!isSearching.value) return props.stocks.length
  if (props.activeMode === 'ALL') {
    return searchMatchedStocks.value.length
  }
  return searchMatchedStocks.value.length + searchUnmatchedStocks.value.length
})

// 模式放寬建議
const modeSuggestionText = computed(() => {
  if (props.activeMode && UI_STRINGS.SCREENER.suggestions?.[props.activeMode]) {
    return UI_STRINGS.SCREENER.suggestions[props.activeMode]
  }
  return ''
})



// 符合股票排序
const sortedStocks = computed(() => {
  const list = [...props.stocks]
  return sortList(list, props.sortKey, props.sortDir)
})

// 未符合股票排序
const sortedUnmatchedStocks = computed(() => {
  const list = [...props.unmatchedStocks]
  return sortList(list, props.sortKey, props.sortDir)
})

// ============================================================
// 漸進式批次載入機制（首屏 30 檔，大幅縮減 DOM 與記憶體，消除行動端彈窗卡頓）
// ============================================================
const BATCH_SIZE = 30
const displayCount = ref(BATCH_SIZE)
const unmatchedDisplayCount = ref(BATCH_SIZE)
const loadMoreTriggerRef = ref(null)
const loadMoreUnmatchedTriggerRef = ref(null)
const loadMoreSearchMatchedRef = ref(null)
const loadMoreSearchUnmatchedRef = ref(null)

// 條件或模式變更時，立即重設批次載入數量
watch(
  [() => props.activeMode, () => props.searchQuery, () => props.sortKey, () => props.sortDir],
  () => {
    displayCount.value = BATCH_SIZE
    unmatchedDisplayCount.value = BATCH_SIZE
  }
)

const visibleSortedStocks = computed(() => {
  return sortedStocks.value.slice(0, displayCount.value)
})

const visibleSearchMatchedStocks = computed(() => {
  return searchMatchedStocks.value.slice(0, displayCount.value)
})

const visibleSearchUnmatchedStocks = computed(() => {
  return searchUnmatchedStocks.value.slice(0, unmatchedDisplayCount.value)
})

const visibleSortedUnmatchedStocks = computed(() => {
  return sortedUnmatchedStocks.value.slice(0, unmatchedDisplayCount.value)
})

const hasMoreStocks = computed(() => {
  return visibleSortedStocks.value.length < sortedStocks.value.length
})

const hasMoreSearchMatched = computed(() => {
  return visibleSearchMatchedStocks.value.length < searchMatchedStocks.value.length
})

const hasMoreSearchUnmatched = computed(() => {
  return visibleSearchUnmatchedStocks.value.length < searchUnmatchedStocks.value.length
})

const hasMoreUnmatchedStocks = computed(() => {
  return visibleSortedUnmatchedStocks.value.length < sortedUnmatchedStocks.value.length
})

function loadMore() {
  const total = isSearching.value ? searchMatchedStocks.value.length : sortedStocks.value.length
  if (displayCount.value < total) {
    displayCount.value = Math.min(total, displayCount.value + BATCH_SIZE)
  }
}

function loadMoreUnmatched() {
  const total = isSearching.value ? searchUnmatchedStocks.value.length : sortedUnmatchedStocks.value.length
  if (unmatchedDisplayCount.value < total) {
    unmatchedDisplayCount.value = Math.min(total, unmatchedDisplayCount.value + BATCH_SIZE)
  }
}

let observer = null

function setupObservers() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (typeof window === 'undefined' || !window.IntersectionObserver) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (entry.target === loadMoreTriggerRef.value || entry.target === loadMoreSearchMatchedRef.value) {
            loadMore()
          } else if (entry.target === loadMoreUnmatchedTriggerRef.value || entry.target === loadMoreSearchUnmatchedRef.value) {
            loadMoreUnmatched()
          }
        }
      }
    },
    { rootMargin: '400px' }
  )

  if (loadMoreTriggerRef.value) observer.observe(loadMoreTriggerRef.value)
  if (loadMoreSearchMatchedRef.value) observer.observe(loadMoreSearchMatchedRef.value)
  if (loadMoreUnmatchedTriggerRef.value) observer.observe(loadMoreUnmatchedTriggerRef.value)
  if (loadMoreSearchUnmatchedRef.value) observer.observe(loadMoreSearchUnmatchedRef.value)
}

function handleWindowScroll() {
  const threshold = window.innerHeight + 500
  if (hasMoreStocks.value && loadMoreTriggerRef.value) {
    if (loadMoreTriggerRef.value.getBoundingClientRect().top <= threshold) loadMore()
  }
  if (hasMoreSearchMatched.value && loadMoreSearchMatchedRef.value) {
    if (loadMoreSearchMatchedRef.value.getBoundingClientRect().top <= threshold) loadMore()
  }
  if (hasMoreUnmatchedStocks.value && loadMoreUnmatchedTriggerRef.value) {
    if (loadMoreUnmatchedTriggerRef.value.getBoundingClientRect().top <= threshold) loadMoreUnmatched()
  }
  if (hasMoreSearchUnmatched.value && loadMoreSearchUnmatchedRef.value) {
    if (loadMoreSearchUnmatchedRef.value.getBoundingClientRect().top <= threshold) loadMoreUnmatched()
  }
}

onMounted(() => {
  setupObservers()
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
  }
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleWindowScroll)
  }
})

watch(
  [
    loadMoreTriggerRef,
    loadMoreSearchMatchedRef,
    loadMoreUnmatchedTriggerRef,
    loadMoreSearchUnmatchedRef,
    hasMoreStocks,
    hasMoreSearchMatched,
    hasMoreUnmatchedStocks,
    hasMoreSearchUnmatched,
    showUnmatched,
  ],
  () => {
    nextTick(setupObservers)
  }
)

function getStockExpectedProfit(stock) {
  if (!stock) return -999
  if (typeof stock.ceilingProfit?.netProfitPct === 'number') {
    return stock.ceilingProfit.netProfitPct
  }
  if (Array.isArray(stock.allCeilings) && stock.allCeilings.length > 0 && typeof stock.allCeilings[0].netProfitPct === 'number') {
    return stock.allCeilings[0].netProfitPct
  }
  if (stock.high5d && stock.price && stock.price > 0) {
    return Number((((stock.high5d - stock.price) / stock.price) * 100).toFixed(2)) - 0.58
  }
  return -999
}

function sortList(list, key, dirStr) {
  const dir = dirStr === 'desc' ? -1 : 1
  return list.sort((a, b) => {
    let valA = a[key]
    let valB = b[key]

    if (key === 'bias20') {
      valA = a.price && a.ma20 ? (a.price - a.ma20) / a.ma20 : -999
      valB = b.price && b.ma20 ? (b.price - b.ma20) / b.ma20 : -999
    } else if (key === 'expectedProfit') {
      valA = getStockExpectedProfit(a)
      valB = getStockExpectedProfit(b)
    }

    if (valA === undefined || valA === null) return 1
    if (valB === undefined || valB === null) return -1

    if (typeof valA === 'string') {
      return valA.localeCompare(valB) * dir
    }
    const diff = (valA - valB) * dir
    if (diff !== 0) return diff
    return String(a.code || '').localeCompare(String(b.code || ''))
  })
}
</script>
