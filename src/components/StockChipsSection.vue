<template>
  <div v-bind="$attrs">
    <!-- 籌碼透視區塊（籌碼集中度 + 短沖避雷，頂部細分隔線 + 緊湊間距 + 基本文字色 + 百分比加粗） -->
    <div
      v-if="hasChipsSection"
      class="pt-2 pb-1.5 border-t border-base-300/40 space-y-1 text-sm font-normal text-base-content/80 leading-normal"
    >
      <!-- 籌碼集中度 (百分比加粗，正值紅字，帶明確空白) -->
      <div v-if="chipsConcentrationItems.length > 0 || chipsTrendItem" class="font-numeric flex items-baseline flex-wrap">
        <span class="mr-1.5 select-none font-sans text-base-content/75">{{ UI_STRINGS.CHIPS?.concentrationLabel || '籌碼' }}</span>

        <!-- 方案 4：籌碼趨勢箭頭徽章 -->
        <span
          v-if="chipsTrendItem"
          class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded border text-xs font-bold mr-2 select-none align-baseline"
          :class="chipsTrendItem.badgeClass"
          :title="chipsTrendItem.tooltip"
        >
          <!-- 連 3 日集中雙折線箭頭 -->
          <svg
            v-if="chipsTrendItem.icon === 'double-up'"
            class="w-3 h-3 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 12.5l4-4 4 4" />
            <path d="M4 7.5l4-4 4 4" />
          </svg>

          <!-- 連 2 日集中單折線箭頭 -->
          <svg
            v-else-if="chipsTrendItem.icon === 'up'"
            class="w-3 h-3 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 10.5l4-4 4 4" />
          </svg>

          <!-- 持平向右箭頭 -->
          <svg
            v-else-if="chipsTrendItem.icon === 'flat'"
            class="w-3 h-3 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5.5 4l4 4-4 4" />
          </svg>

          <!-- 發散向下箭頭 -->
          <svg
            v-else-if="chipsTrendItem.icon === 'down'"
            class="w-3 h-3 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 5.5l4 4 4-4" />
          </svg>

          <span>{{ chipsTrendItem.text }}</span>
        </span>

        <template v-for="(item, idx) in chipsConcentrationItems" :key="item.label">
          <span class="inline-flex items-baseline gap-1">
            <span>{{ item.label }}</span>
            <strong class="font-bold" :class="item.isPositive ? 'text-rise' : 'text-base-content'">{{ item.val }}</strong>
          </span>
          <span v-if="idx < chipsConcentrationItems.length - 1" class="text-base-content/40 mx-1.5">·</span>
        </template>
      </div>

      <!-- 短沖避雷 (基本文字色，百分比加粗，已依指令移除左側驚嘆號圖示) -->
      <div v-if="dayTradersInfo" class="font-numeric flex items-center">
        <span>
          <span>{{ UI_STRINGS.CHIPS.dayTradersPrefix || '短沖佔 ' }}</span>
          <strong class="font-bold text-base-content">{{ dayTradersInfo.pct }}</strong>
          <span v-if="dayTradersInfo.branchesText"> ({{ dayTradersInfo.branchesText }})</span>
        </span>
      </div>
    </div>

    <!-- 籌碼無資料或未建檔時之貼心提醒，避免空白疑慮 -->
    <div
      v-else-if="chipsNoticeText"
      class="pt-1.5 pb-1 border-t border-base-300/40 text-sm text-base-content/70 flex items-center gap-1.5"
    >
      <span class="font-medium text-base-content/80">{{ UI_STRINGS.CHIPS.concentrationLabel }}</span>
      <span class="text-base-content/40">·</span>
      <span>{{ chipsNoticeText }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

const props = defineProps({
  stock: {
    type: Object,
    required: true,
  },
})

const chipsConcentrationItems = computed(() => {
  const chips = props.stock.chips
  if (!chips) return []
  const { concentration1d: d1, concentration3d: d3, concentration5d: d5 } = chips
  if (d1 == null && d3 == null && d5 == null) return []
  const items = []
  if (d1 != null) items.push({ label: '1D', val: `${d1 >= 0 ? '+' : ''}${Number(d1).toFixed(1)}%`, isPositive: d1 > 0 })
  if (d3 != null) items.push({ label: '3D', val: `${d3 >= 0 ? '+' : ''}${Number(d3).toFixed(1)}%`, isPositive: d3 > 0 })
  if (d5 != null) items.push({ label: '5D', val: `${d5 >= 0 ? '+' : ''}${Number(d5).toFixed(1)}%`, isPositive: d5 > 0 })
  return items
})

const chipsTrendItem = computed(() => {
  const trend = props.stock.chipsTrend3d
  const score = props.stock.chipsScore
  if (!trend) return null

  // 1. 若只有 1 天紀錄（新進追蹤池，樣本不足以進行前後對照）
  const hist = props.stock.chipsHistory
  let isNewEntry = trend === 'NEW'
  if (!isNewEntry && hist && typeof hist === 'object') {
    const validDates = Object.keys(hist).filter(d => hist[d]?.chips?.concentration1d != null)
    if (validDates.length === 1) {
      isNewEntry = true
    }
  }

  if (isNewEntry) {
    return {
      type: 'new',
      icon: null,
      text: UI_STRINGS.CHIPS_TREND?.newBadge || '新進',
      tooltip: UI_STRINGS.CHIPS_TREND?.new || '新進追蹤池',
      badgeClass: 'text-base-content/70 bg-base-300/40 border-base-300/60',
    }
  }

  if (trend === 'UP') {
    if (score >= 3) {
      return {
        type: 'streak3',
        icon: 'double-up',
        text: UI_STRINGS.CHIPS_TREND?.streak3Badge || '連 3 集中',
        tooltip: UI_STRINGS.CHIPS_TREND?.streak3 || '籌碼連 3 日集中',
        badgeClass: 'text-rise bg-rise/10 border-rise/30',
      }
    }
    return {
      type: 'streak2',
      icon: 'up',
      text: UI_STRINGS.CHIPS_TREND?.streak2Badge || '連 2 集中',
      tooltip: UI_STRINGS.CHIPS_TREND?.streak2 || '籌碼連 2 日集中',
      badgeClass: 'text-rise bg-rise/10 border-rise/30',
    }
  }

  if (trend === 'FLAT') {
    return {
      type: 'flat',
      icon: 'flat',
      text: UI_STRINGS.CHIPS_TREND?.flatBadge || '持平',
      tooltip: UI_STRINGS.CHIPS_TREND?.flat || '籌碼持平',
      badgeClass: 'text-base-content/70 bg-base-300/40 border-base-300/60',
    }
  }

  if (trend === 'DOWN') {
    return {
      type: 'down',
      icon: 'down',
      text: UI_STRINGS.CHIPS_TREND?.divergeBadge || '發散',
      tooltip: UI_STRINGS.CHIPS_TREND?.down || '籌碼連續發散',
      badgeClass: 'text-fall bg-fall/10 border-fall/30',
    }
  }

  return null
})

const dayTradersInfo = computed(() => {
  const chips = props.stock.chips
  if (!chips) return null
  const branches = chips.dayTradersBranches ?? []
  if (branches.length === 0) return null
  const pct = typeof chips.dayTradersPct === 'number' ? chips.dayTradersPct.toFixed(1) : (chips.dayTradersPct ?? '0.0')
  return {
    pct: `${pct}%`,
    branchesText: branches.join(' · '),
  }
})

const hasChipsSection = computed(() => {
  return chipsConcentrationItems.value.length > 0 || !!dayTradersInfo.value || !!chipsTrendItem.value
})

const chipsNoticeText = computed(() => {
  if (hasChipsSection.value) return ''
  // 1. 若處於時光機歷史模式 (dayOffset > 0)
  if (props.stock.dayOffset && props.stock.dayOffset > 0) {
    return UI_STRINGS.CHIPS.missingHistorical || '該歷史日未入選追蹤池（無分點籌碼記錄）'
  }
  // 2. 若為今日且處於 17:46 ~ 19:16 第一波跑完、第二波籌碼結算前
  const now = new Date()
  const nowHour = now.getHours()
  const nowMin = now.getMinutes()
  const timeInMinutes = nowHour * 60 + nowMin
  if (now.getDay() >= 1 && now.getDay() <= 5 && timeInMinutes >= 1066 && timeInMinutes < 1156) {
    return UI_STRINGS.CHIPS.pendingSettlement || '今日分點籌碼結算中（預計 19:16 發布）'
  }
  return UI_STRINGS.CHIPS.noRecord || '無分點籌碼記錄'
})
</script>
