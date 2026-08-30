<template>
  <div class="stock-table-container space-y-3">
    <!-- 頂部工具列：筆數統計與模式放寬建議 -->
    <div class="flex flex-wrap items-baseline justify-between gap-2 px-1 text-sm text-base-content/80">
      <div class="flex flex-wrap items-baseline gap-2.5">
        <span class="font-bold text-sm text-base-content shrink-0">
          {{ UI_STRINGS.SCREENER.resultCount(stocks.length) }}
        </span>
        <span v-if="modeSuggestionText" class="text-sm text-base-content/75 leading-normal">
          {{ modeSuggestionText }}
        </span>
      </div>

      <!-- 排序功能暫時註解：待後續討論後再優化
      <div class="flex items-center gap-1 font-medium">
        <span class="text-base-content/70 mr-1">排序:</span>
        <button
          v-for="opt in sortOptions"
          :key="opt.key"
          type="button"
          class="btn btn-ghost btn-sm font-normal"
          :class="{ 'btn-active font-bold text-base-content': currentSortKey === opt.key }"
          @click="toggleSort(opt.key)"
        >
          <span>{{ opt.label }}</span>
          <span v-if="currentSortKey === opt.key" class="ml-0.5 font-numeric text-xs">
            {{ currentSortDir === 'desc' ? '▼' : '▲' }}
          </span>
        </button>
      </div>
      -->
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

    <!-- 無符合資料狀態 (Empty State) -->
    <div
      v-else-if="stocks.length === 0"
      class="text-center py-16 px-4 bg-base-200/50 border border-dashed border-base-300 rounded-xl"
    >
      <div class="text-base-content/70 text-sm font-medium">
        {{ UI_STRINGS.SCREENER.noResult }}
      </div>
    </div>

    <!-- 結果清單 (渲染 StockCard) -->
    <div v-else class="space-y-3">
      <StockCard
        v-for="stock in sortedStocks"
        :key="stock.code"
        :stock="stock"
        :active-mode="activeMode"
        @select="$emit('select', stock)"
        @open-risk-modal="$emit('openRiskModal', stock)"
      />
    </div>

    <!-- 未符合個股折疊清單 (僅在策略模式且有未符合個股時顯示) -->
    <div
      v-if="!loading && activeMode !== 'ALL' && unmatchedStocks.length > 0"
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
      <div v-if="showUnmatched" class="space-y-3 opacity-90">
        <StockCard
          v-for="stock in unmatchedStocks"
          :key="stock.code"
          :stock="stock"
          :active-mode="activeMode"
          :is-unmatched="true"
          @select="$emit('select', stock)"
          @open-risk-modal="$emit('openRiskModal', stock)"
        />
      </div>
    </div>
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
})

const showUnmatched = ref(false)

const modeSuggestionText = computed(() => {
  if (props.activeMode && UI_STRINGS.SCREENER.suggestions?.[props.activeMode]) {
    return UI_STRINGS.SCREENER.suggestions[props.activeMode]
  }
  return ''
})

const emit = defineEmits(['select', 'sort', 'openRiskModal'])

const sortOptions = [
  { key: 'changePct', label: UI_STRINGS.STOCK_TABLE.headers.changePct },
  { key: 'volume', label: UI_STRINGS.STOCK_TABLE.headers.volume },
  { key: 'bias20', label: UI_STRINGS.STOCK_TABLE.headers.bias20 },
  { key: 'code', label: UI_STRINGS.STOCK_TABLE.headers.code },
]

const currentSortKey = ref('changePct')
const currentSortDir = ref('desc') // 'desc' | 'asc'

function toggleSort(key) {
  if (currentSortKey.value === key) {
    currentSortDir.value = currentSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    currentSortKey.value = key
    currentSortDir.value = key === 'code' ? 'asc' : 'desc'
  }
  emit('sort', currentSortKey.value, currentSortDir.value)
}

const formattedUpdatedAt = computed(() => {
  if (!props.meta?.updatedAt) return ''
  try {
    const d = new Date(props.meta.updatedAt)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  } catch {
    return props.meta.updatedAt
  }
})

const sortedStocks = computed(() => {
  const list = [...props.stocks]
  const key = currentSortKey.value
  const dir = currentSortDir.value === 'desc' ? -1 : 1

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
})
</script>
