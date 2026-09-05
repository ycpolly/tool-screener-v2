<template>
  <div class="time-machine-bar select-none">
    <!-- 攤開式時光膠囊列 (支援開盤即時與歷史真實開盤日) -->
    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-sm">
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

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatTimeMachineDate(dateStr) {
  if (!dateStr) return { monthDay: '', weekDay: '' }
  const parts = dateStr.split('-')
  if (parts.length !== 3) return { monthDay: '', weekDay: '' }
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  const dateObj = new Date(y, m - 1, d)
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  const weekDay = WEEKDAYS[dateObj.getDay()] || ''
  return {
    monthDay: `${mm}/${dd}`,
    weekDay: `週${weekDay}`,
  }
}

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
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const monthDay = `${mm}/${dd}`
    const weekDay = `週${WEEKDAYS[now.getDay()] || ''}`
    const nowHour = now.getHours()
    const nowMin = now.getMinutes()
    const isClosed = (nowHour > 13) || (nowHour === 13 && nowMin >= 30)
    const tag = isClosed ? (UI_STRINGS.TIME_MACHINE.closed || '收盤') : (UI_STRINGS.TIME_MACHINE.intraday || '盤中')

    // Offset 0: 今日/最新：09/04 週五 (盤中/收盤)
    dates.push({
      offset: 0,
      label: `${monthDay} ${weekDay} (${tag})`,
      shortLabel: tag,
      monthDay,
      date: `${now.getFullYear()}-${mm}-${dd}`,
    })

    // Offset 1 ~ 5: 往前回溯歷史已收盤交易日 (T-1 為 sample[len - 1] 上個交易日)
    for (let offset = 1; offset <= Math.min(5, len); offset++) {
      const targetIdx = len - offset
      const bar = sample[targetIdx]
      const dateStr = bar?.date
      let histMonthDay = `T-${offset}`
      let histWeekDay = ''
      if (dateStr) {
        const fmt = formatTimeMachineDate(dateStr)
        histMonthDay = fmt.monthDay
        histWeekDay = fmt.weekDay
      }

      const label = histWeekDay
        ? `${histMonthDay} ${histWeekDay} (T-${offset})`
        : `${histMonthDay} (T-${offset})`

      dates.push({
        offset,
        label,
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
      let histWeekDay = ''
      if (dateStr) {
        const fmt = formatTimeMachineDate(dateStr)
        histMonthDay = fmt.monthDay
        histWeekDay = fmt.weekDay
      }

      const label = offset === 0
        ? (histWeekDay
            ? `${histMonthDay} ${histWeekDay} (${UI_STRINGS.TIME_MACHINE.postMarket || '盤後'})`
            : `${histMonthDay} (${UI_STRINGS.TIME_MACHINE.postMarket || '盤後'})`)
        : (histWeekDay
            ? `${histMonthDay} ${histWeekDay} (T-${offset})`
            : `${histMonthDay} (T-${offset})`)

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
