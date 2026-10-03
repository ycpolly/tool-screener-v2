<template>
  <div
    v-if="filterEvaluationText"
    class="text-sm font-normal leading-normal py-1.5 px-3 rounded-lg border transition-colors mt-1"
    :class="[
      isUnmatched ? 'bg-base-300/30 border-base-300/60 text-base-content/75' : 'bg-base-300/50 border-base-300/80 text-base-content',
      hasEvaluationDetails ? 'cursor-pointer hover:bg-base-300/70' : ''
    ]"
    @click="hasEvaluationDetails && (isDetailsExpanded = !isDetailsExpanded)"
  >
    <div class="flex items-center justify-between gap-1.5 select-none">
      <span class="font-medium flex-1">{{ filterEvaluationText }}</span>
      <span
        v-if="hasEvaluationDetails"
        class="text-xs text-base-content/60 flex items-center gap-0.5 shrink-0"
      >
        <span>{{ isDetailsExpanded ? (isUnmatched ? (UI_STRINGS.SCREENER.collapseDiagnosis || UI_STRINGS.PANEL.collapseDiagnosis || '收合') : (UI_STRINGS.SCREENER.collapseDetails || UI_STRINGS.PANEL.collapseDetails || '收合')) : (isUnmatched ? (UI_STRINGS.SCREENER.expandDiagnosis || UI_STRINGS.PANEL.expandDiagnosis || '展開') : (UI_STRINGS.SCREENER.expandDetails || UI_STRINGS.PANEL.expandDetails || '展開')) }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 transition-transform duration-200"
          :class="{ 'rotate-180': isDetailsExpanded }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>

    <!-- 展開後的純文字指標通關診斷清單 (允許選取複製文字) -->
    <div
      v-if="isDetailsExpanded && hasEvaluationDetails"
      class="pt-2 mt-2 border-t border-base-300/40 space-y-1 text-xs sm:text-sm font-numeric select-text cursor-auto"
      @click.stop
    >
      <div
        v-for="(item, idx) in evaluationDetails"
        :key="idx"
        class="flex items-start gap-1.5 leading-relaxed"
      >
        <span
          class="shrink-0 font-bold"
          :class="item.pass ? 'text-success' : 'text-error'"
        >
          {{ item.pass ? '✓' : '✗' }}
        </span>
        <span class="text-base-content/90">
          <strong class="text-base-content font-semibold">{{ item.label }}：</strong>{{ item.desc }}
        </span>
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
  activeMode: {
    type: String,
    default: '',
  },
  isUnmatched: {
    type: Boolean,
    default: false,
  },
  filterEvaluation: {
    type: Object,
    default: null,
  },
})

const isDetailsExpanded = ref(false)

const evaluationDetails = computed(() => {
  return props.stock?.filterEvaluation?.details || props.filterEvaluation?.details || []
})

const hasEvaluationDetails = computed(() => {
  return evaluationDetails.value.length > 0
})

const filterEvaluationText = computed(() => {
  // Case 1: 在「全部股票 (ALL)」模式下
  if (props.activeMode === 'ALL') {
    const matchedModes = props.stock?.matchedModes || []
    if (matchedModes.length > 0) {
      return UI_STRINGS.SCREENER.matchedStrategy(matchedModes.join(' · '))
    }
    return UI_STRINGS.SCREENER.noMatchedStrategy
  }

  // Case 2: 在特定模式下，若為「未符合/淘汰個股」
  if (props.isUnmatched) {
    const details = evaluationDetails.value || []
    const failedItems = details.filter((item) => !item.pass)

    if (failedItems.length > 0) {
      const shortMap = UI_STRINGS.SCREENER.shortFailLabels || {}
      const labels = failedItems.map((item) => {
        if (item.label === '均線支撐') {
          if (item.desc && (item.desc.includes('10MA') || item.desc.includes('雙均線'))) {
            return '未站穩均線'
          }
          return shortMap['均線支撐'] || '未站穩 5MA'
        }
        const rawKey = item.label || ''
        const noSpaceKey = rawKey.replace(/\s+/g, '')
        const spacedKey = rawKey
          .replace(/([A-Za-z0-9]+)([\u4e00-\u9fa5]+)/g, '$1 $2')
          .replace(/([\u4e00-\u9fa5]+)([A-Za-z0-9]+)/g, '$1 $2')
        return shortMap[rawKey] || shortMap[noSpaceKey] || shortMap[spacedKey] || rawKey
      })
      const reasonsText = labels.join(' · ')
      return UI_STRINGS.SCREENER.unmatchedSummary
        ? UI_STRINGS.SCREENER.unmatchedSummary(failedItems.length, reasonsText)
        : `${failedItems.length} 項未達標：${reasonsText}`
    }

    const reason = props.stock?.filterEvaluation?.reasonText || props.filterEvaluation?.reasonText
    if (!reason) return null
    return `${UI_STRINGS.SCREENER.unmatchedReasonPrefix}${reason}`
  }

  // Case 3: 在特定模式下，若為「符合個股」
  const modeLabels = {
    BOTTOM_REVERSAL: '跌深反轉',
    BOTTOM_CONSOLIDATION: '底部蓄勢',
    MOMENTUM_BREAKOUT: '動能攻擊',
    TREND_PULLBACK: '多頭回測',
    WASHOUT_IGNITION: '洗盤起漲',
  }
  const currentModeName = modeLabels[props.activeMode] || ''
  if (currentModeName) {
    return UI_STRINGS.SCREENER.matchedCondition(currentModeName)
  }

  return props.stock?.filterEvaluation?.reasonText || null
})
</script>
