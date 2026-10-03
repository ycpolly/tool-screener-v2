<template>
  <div
    v-if="forwardVal"
    class="py-1 px-2.5 rounded-lg border border-base-300/60 bg-base-300/35 text-sm transition-colors"
  >
    <div
      class="flex items-center justify-between gap-1.5 select-none cursor-pointer"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-baseline gap-1.5 truncate">
        <span class="font-medium text-base-content/80">
          {{ UI_STRINGS.FORWARD_VALIDATION?.titleWithDays(forwardVal.daysCount) }}
        </span>
        <span class="text-base-content/40">·</span>
        <span class="text-base-content/75">{{ UI_STRINGS.FORWARD_VALIDATION?.cumulative }}</span>
        <strong
          class="font-numeric font-bold"
          :class="forwardVal.totalGainPct > 0 ? 'text-rise' : (forwardVal.totalGainPct < 0 ? 'text-fall' : 'text-base-content')"
        >
          {{ forwardVal.totalGainPct > 0 ? '+' : '' }}{{ forwardVal.totalGainPct }}%
        </strong>
        <span class="text-base-content/60 text-xs hidden sm:inline">
          ({{ UI_STRINGS.FORWARD_VALIDATION?.maxProfit }} {{ forwardVal.maxGainPct > 0 ? '+' : '' }}{{ forwardVal.maxGainPct }}% · {{ UI_STRINGS.FORWARD_VALIDATION?.maxDrawdown }} {{ forwardVal.maxDrawdownPct > 0 ? '+' : '' }}{{ forwardVal.maxDrawdownPct }}%)
        </span>
      </div>

      <!-- 展開/收合按鈕 -->
      <span class="text-xs text-base-content/60 flex items-center gap-0.5 shrink-0">
        <span>{{ isExpanded ? UI_STRINGS.FORWARD_VALIDATION?.collapse : UI_STRINGS.FORWARD_VALIDATION?.expand }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 transition-transform duration-200"
          :class="{ 'rotate-180': isExpanded }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>

    <!-- 展開後的迷你逐日時間軸歷程 -->
    <div
      v-if="isExpanded"
      class="pt-2 mt-2 border-t border-base-300/40 space-y-2 text-sm font-numeric select-text cursor-auto leading-normal"
      @click.stop
    >
      <!-- 進場基準列 (例如：09/17 四 (基準)) -->
      <div class="flex items-center justify-between text-base-content/75 pb-1.5 border-b border-base-300/30">
        <span class="font-medium">{{ formatTimelineDate(forwardVal.entryDate) }} ({{ UI_STRINGS.FORWARD_VALIDATION?.entryBenchmark || '基準' }})</span>
        <span class="font-bold text-base-content">{{ formatNumber(forwardVal.entryPrice) }}</span>
      </div>

      <!-- T+1 ~ T+N 逐日明細 (例如：09/18 五 (T+1)) -->
      <div
        v-for="rec in forwardVal.dailyRecords"
        :key="rec.tDay"
        class="flex items-center justify-between text-base-content/90 py-0.5"
      >
        <div class="flex items-center gap-1.5">
          <span class="font-medium text-base-content/80">{{ formatTimelineDate(rec.date) }} (T+{{ rec.tDay }})</span>
        </div>
        <div class="flex items-baseline gap-2.5">
          <span class="font-bold text-base-content">{{ formatNumber(rec.close) }}</span>
          <span
            class="font-semibold text-right w-16"
            :class="rec.dayChangePct > 0 ? 'text-rise' : (rec.dayChangePct < 0 ? 'text-fall' : 'text-base-content/70')"
          >
            {{ rec.dayChangePct > 0 ? '▴' : (rec.dayChangePct < 0 ? '▾' : '') }}{{ Math.abs(rec.dayChangePct ?? 0).toFixed(2) }}%
          </span>
          <span
            class="text-right w-16"
            :class="rec.cumChangePct > 0 ? 'text-rise' : (rec.cumChangePct < 0 ? 'text-fall' : 'text-base-content/70')"
          >
            {{ rec.cumChangePct > 0 ? '+' : '' }}{{ rec.cumChangePct }}%
          </span>
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
    default: null,
  },
  validation: {
    type: Object,
    default: null,
  },
})

const isExpanded = ref(false)

const forwardVal = computed(() => props.validation || props.stock?.forwardValidation || null)

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '--'
  return Number(num).toFixed(2)
}

function formatTimelineDate(dateStr) {
  if (!dateStr) return '--'
  const parts = String(dateStr).split(/[-/]/)
  if (parts.length >= 3) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)
    const d = new Date(year, month - 1, day)
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const w = weekDays[d.getDay()] || ''
    return `${mm}/${dd} ${w}`
  }
  return dateStr
}
</script>
