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
            v-for="stock in searchMatchedStocks"
            :key="stock.code"
            :stock="stock"
            :active-mode="activeMode"
            :is-compact="isCompact"
            @select="$emit('select', stock)"
            @open-risk-modal="$emit('openRiskModal', stock)"
          />
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
            v-for="stock in searchUnmatchedStocks"
            :key="stock.code"
            :stock="stock"
            :active-mode="activeMode"
            :is-unmatched="true"
            :is-compact="isCompact"
            @select="$emit('select', stock)"
            @open-risk-modal="$emit('openRiskModal', stock)"
          />
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

      <!-- 符合策略結果清單 (渲染 StockCard) -->
      <div v-else :class="isCompact ? 'space-y-2' : 'space-y-3'">
        <StockCard
          v-for="stock in sortedStocks"
          :key="stock.code"
          :stock="stock"
          :active-mode="activeMode"
          :is-compact="isCompact"
          @select="$emit('select', stock)"
          @open-risk-modal="$emit('openRiskModal', stock)"
        />
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
            v-for="stock in sortedUnmatchedStocks"
            :key="stock.code"
            :stock="stock"
            :active-mode="activeMode"
            :is-unmatched="true"
            :is-compact="isCompact"
            @select="$emit('select', stock)"
            @open-risk-modal="$emit('openRiskModal', stock)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
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

defineEmits(['select', 'sort', 'openRiskModal'])

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

function sortList(list, key, dirStr) {
  const dir = dirStr === 'desc' ? -1 : 1
  return list.sort((a, b) => {
    let valA = a[key]
    let valB = b[key]

    if (key === 'bias20') {
      valA = a.price && a.ma20 ? (a.price - a.ma20) / a.ma20 : -999
      valB = b.price && b.ma20 ? (b.price - b.ma20) / b.ma20 : -999
    }

    if (valA === undefined || valA === null) return 1
    if (valB === undefined || valB === null) return -1

    if (typeof valA === 'string') {
      return valA.localeCompare(valB) * dir
    }
    return (valA - valB) * dir
  })
}
</script>
