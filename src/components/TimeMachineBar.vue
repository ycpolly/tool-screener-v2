<template>
  <div class="time-machine-bar select-none">
    <!-- 攤開式時光膠囊列 (支援開盤即時與歷史真實開盤日) -->
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
        <span>{{ UI_STRINGS.TIME_MACHINE.title || '時光機' }}</span>
      </span>

      <!-- 6 大時光膠囊按鈕 (T-0 ~ T-5 全部由真實日 K 提取真實日期，0 日曆誤差) -->
      <button
        v-for="d in timeMachineDates"
        :key="d.offset"
        type="button"
        class="px-2.5 py-1.5 rounded-lg text-sm transition-all shrink-0 font-numeric cursor-pointer"
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
import { isLiveTradingDay } from '../engine/screener.js'

const props = defineProps({
  dayOffset: {
    type: Number,
    default: 0,
  },
})

defineEmits(['update:dayOffset'])

const { stocks } = useStockPool()

// 智慧時光機日期列表：開盤交易日 (週一至五) 顯示「今日即時」，非交易日/已收盤顯示「最新收盤」
const timeMachineDates = computed(() => {
  const sample = stocks.value?.[0]?.history10d || []
  if (sample.length === 0) {
    return [0, 1, 2, 3, 4, 5].map(i => ({
      offset: i,
      label: i === 0 ? '最新' : `T-${i}`,
      shortLabel: i === 0 ? '最新' : `T-${i}`,
    }))
  }

  const len = sample.length
  const isLive = isLiveTradingDay(sample[len - 1])
  const dates = []

  if (isLive) {
    // 盤中全新交易日 (依 13:30 前後區分「盤中」或「收盤」)
    const now = new Date()
    const m = now.getMonth() + 1
    const d = now.getDate()
    const monthDay = `${m}/${d}`
    const nowHour = now.getHours()
    const nowMin = now.getMinutes()
    const isClosed = (nowHour > 13) || (nowHour === 13 && nowMin >= 30)
    const tag = isClosed ? (UI_STRINGS.TIME_MACHINE.closed || '收盤') : (UI_STRINGS.TIME_MACHINE.intraday || '盤中')

    // Offset 0: 今日 (盤中) 或 (收盤)
    dates.push({
      offset: 0,
      label: `${monthDay} (${tag})`,
      shortLabel: tag,
      monthDay,
      date: `${now.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    })

    // Offset 1 ~ 5: 往前回溯歷史已收盤交易日 (T-1 為 sample[len - 1] 上個交易日)
    for (let offset = 1; offset <= Math.min(5, len); offset++) {
      const targetIdx = len - offset
      const bar = sample[targetIdx]
      const dateStr = bar?.date
      let histMonthDay = `T-${offset}`
      if (dateStr) {
        const parts = dateStr.split('-')
        if (parts.length === 3) {
          histMonthDay = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
        }
      }

      dates.push({
        offset,
        label: `${histMonthDay} (T-${offset})`,
        shortLabel: `T-${offset}`,
        monthDay: histMonthDay,
        date: dateStr,
      })
    }
  } else {
    // 週末休市或盤後已由 Python 更新當日日K (顯示「盤後」)
    for (let offset = 0; offset <= Math.min(5, len - 1); offset++) {
      const targetIdx = len - 1 - offset
      const bar = sample[targetIdx]
      const dateStr = bar?.date
      let histMonthDay = `T-${offset}`
      if (dateStr) {
        const parts = dateStr.split('-')
        if (parts.length === 3) {
          histMonthDay = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
        }
      }

      const label = offset === 0
        ? `${histMonthDay} (${UI_STRINGS.TIME_MACHINE.postMarket || '盤後'})`
        : `${histMonthDay} (T-${offset})`

      dates.push({
        offset,
        label,
        shortLabel: offset === 0 ? (UI_STRINGS.TIME_MACHINE.postMarket || '盤後') : `T-${offset}`,
        monthDay: histMonthDay,
        date: dateStr,
      })
    }
  }


  return dates
})
</script>
