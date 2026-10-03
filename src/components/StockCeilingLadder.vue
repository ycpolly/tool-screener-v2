<template>
  <div
    v-if="ceilingInfo"
    class="text-sm font-normal leading-normal px-2.5 rounded-lg border border-base-300/60 bg-base-300/40 text-base-content transition-colors"
    :class="size === 'compact' ? 'py-1' : 'py-1.5'"
  >
    <div
      class="flex items-center justify-between gap-1.5 select-none cursor-pointer"
      @click="isCeilingExpanded = !isCeilingExpanded"
    >
      <div class="flex items-baseline gap-1.5 truncate">
        <span class="text-base-content/80">{{ ceilingInfo.type }}</span>
        <strong class="font-numeric font-bold text-base-content">{{ formatNumber(ceilingInfo.price) }}</strong>
        <span class="text-base-content/40">·</span>
        <span class="text-base-content/80">{{ UI_STRINGS.METRICS.expectedProfit }}</span>
        <strong class="font-numeric font-bold text-base-content">{{ formatPercent(ceilingInfo.netProfitPct) }}</strong>
      </div>
      <span class="text-xs text-base-content/60 flex items-center gap-0.5 shrink-0">
        <span>{{ isCeilingExpanded ? UI_STRINGS.CEILINGS.collapseLabel : UI_STRINGS.CEILINGS.expandLabel }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 transition-transform duration-200"
          :class="{ 'rotate-180': isCeilingExpanded }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>

    <!-- 展開後的三明治價格天梯 (純文字、無彩色、標準字級 text-sm font-numeric) -->
    <div
      v-if="isCeilingExpanded"
      class="pt-2 mt-2 border-t border-base-300/40 space-y-1 text-sm font-normal leading-normal font-numeric select-text cursor-auto"
      @click.stop
    >
      <!-- 1. 上方天花板 (由高至低排列，最高在最頂) -->
      <div class="space-y-2.5">
        <div
          v-for="(item, idx) in ladderCeilings"
          :key="`c-${idx}`"
          class="flex items-center justify-between text-base-content/85"
        >
          <span class="truncate font-sans">{{ item.type }}</span>
          <div class="flex items-baseline gap-3 shrink-0">
            <span class="font-medium">{{ formatNumber(item.price) }}</span>
            <span class="w-16 text-right">{{ formatPercent(item.netProfitPct) }}</span>
          </div>
        </div>
        <div v-if="ladderCeilings.length === 0" class="text-base-content/60 text-sm">
          {{ UI_STRINGS.CEILINGS.emptyCeilings }}
        </div>
      </div>

      <!-- 2. 中間現價基準線 (同列排版，加上下中等透明度邊框) -->
      <div class="flex items-center justify-between border-y border-base-content/20 py-1.5 my-2.5 text-base-content font-medium">
        <span class="truncate font-sans">{{ UI_STRINGS.STOCK_TABLE.headers.price || '現價' }}</span>
        <div class="flex items-baseline gap-3 shrink-0">
          <span class="font-bold">{{ formatNumber(stock.price) }}</span>
          <span class="w-16 text-right font-bold">0.00%</span>
        </div>
      </div>

      <!-- 3. 下方地板 (由高至低排列，最近支撐在現價下方，最深在最底) -->
      <div class="space-y-2.5">
        <div
          v-for="(item, idx) in ladderSupports"
          :key="`s-${idx}`"
          class="flex items-center justify-between text-base-content/85"
        >
          <span class="truncate font-sans">{{ item.type }}</span>
          <div class="flex items-baseline gap-3 shrink-0">
            <span class="font-medium">{{ formatNumber(item.price) }}</span>
            <span class="w-16 text-right">-{{ Number(item.riskLossPct).toFixed(2) }}%</span>
          </div>
        </div>
        <div v-if="ladderSupports.length === 0" class="text-base-content/60 text-sm">
          {{ UI_STRINGS.CEILINGS.emptySupports }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

const props = defineProps({
  stock: {
    type: Object,
    required: true,
  },
  ceilingProfit: {
    type: Object,
    default: null,
  },
  size: {
    type: String,
    default: 'normal',
  },
})

const isCeilingExpanded = ref(false)

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '--'
  return Number(num).toFixed(2)
}

function formatPercent(val) {
  if (val === null || val === undefined || isNaN(val)) return '--'
  const sign = val > 0 ? '+' : ''
  return `${sign}${Number(val).toFixed(2)}%`
}

const ladderCeilings = computed(() => {
  const ceilings = props.stock.allCeilings
  if (Array.isArray(ceilings) && ceilings.length > 0) {
    return [...ceilings].sort((a, b) => b.price - a.price)
  }
  return []
})

const ladderSupports = computed(() => {
  const supports = props.stock.supportLevels
  if (Array.isArray(supports) && supports.length > 0) {
    return [...supports].sort((a, b) => b.price - a.price)
  }
  return []
})

const ceilingInfo = computed(() => {
  if (props.ceilingProfit) return props.ceilingProfit
  if (props.stock.ceilingProfit) return props.stock.ceilingProfit
  const ceilings = props.stock.allCeilings
  if (Array.isArray(ceilings) && ceilings.length > 0) {
    return ceilings[0]
  }
  if (props.stock.high5d && props.stock.price) {
    const profit = Number((((props.stock.high5d - props.stock.price) / props.stock.price) * 100).toFixed(2))
    return {
      type: `5日高`,
      price: props.stock.high5d,
      netProfitPct: profit,
      passed: profit > 0,
    }
  }
  return null
})
</script>
