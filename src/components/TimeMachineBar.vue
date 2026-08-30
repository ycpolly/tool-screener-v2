<template>
  <div class="time-machine-bar select-none">
    <!-- 攤開式時光膠囊列 (全部統一使用資料庫中真實開盤日日期) -->
    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-sm">
      <span class="text-base-content/65 font-medium shrink-0 flex items-center gap-1 mr-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-base-content/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{{ UI_STRINGS.TIME_MACHINE.title || '全市場時光機' }}:</span>
      </span>

      <!-- 6 大時光膠囊按鈕 (T-0 ~ T-5 全部由真實日 K 提取真實日期，0 日曆誤差) -->
      <button
        v-for="d in timeMachineDates"
        :key="d.offset"
        type="button"
        class="px-2.5 py-1.5 rounded-lg text-sm transition-all shrink-0 font-numeric"
        :class="dayOffset === d.offset
          ? 'bg-base-100 text-base-content font-bold shadow-xs border border-base-300'
          : 'text-base-content/75 hover:text-base-content hover:bg-base-300/40'"
        @click="$emit('update:dayOffset', d.offset)"
      >
        <span>{{ d.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'
import { useStockPool } from '../composables/useStockPool.js'

const props = defineProps({
  dayOffset: {
    type: Number,
    default: 0,
  },
})

defineEmits(['update:dayOffset'])

const { stocks } = useStockPool()

// 從真實資料庫的 history10d 提取真實開盤日日期，完全避免日曆推算誤差
const timeMachineDates = computed(() => {
  const sample = stocks.value?.[0]?.history10d || []
  if (sample.length === 0) {
    return [0, 1, 2, 3, 4, 5].map(i => ({
      offset: i,
      label: i === 0 ? '最新' : `T-${i}`,
      shortLabel: i === 0 ? '最新' : `T-${i}`,
    }))
  }

  const dates = []
  const len = sample.length
  for (let offset = 0; offset <= Math.min(5, len - 1); offset++) {
    const targetIdx = len - 1 - offset
    const bar = sample[targetIdx]
    const dateStr = bar?.date // e.g. "2026-08-28"
    let monthDay = `T-${offset}`
    if (dateStr) {
      const parts = dateStr.split('-')
      if (parts.length === 3) {
        monthDay = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
      }
    }

    const label = offset === 0
      ? `${monthDay} (最新)`
      : `${monthDay} (T-${offset})`

    dates.push({
      offset,
      label,
      shortLabel: offset === 0 ? '最新' : `T-${offset}`,
      monthDay,
      date: dateStr,
    })
  }

  return dates
})
</script>
