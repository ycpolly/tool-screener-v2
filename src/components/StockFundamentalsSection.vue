<template>
  <div v-bind="$attrs">
    <!-- 基本面估值區塊（股本規模 + 動態 PE 與同業折溢價，頂部細分隔線 + 緊湊間距 + 等寬數字） -->
    <div
      v-if="hasFundamentalsSection"
      class="pt-1.5 pb-1 border-t border-base-300/40 text-sm font-normal text-base-content/80 leading-normal flex items-baseline flex-wrap font-numeric"
    >
      <!-- 主題詞：估值 -->
      <span class="mr-1.5 font-sans text-base-content/70 select-none">{{ UI_STRINGS.FUNDAMENTALS?.sectionLabel || '估值' }}</span>
      <span class="text-base-content/40 mr-1.5 select-none">·</span>

      <!-- 股本規模：股本 11.5億 (輕) / 股本 42.4億 (中) / 股本 2593億 (大) -->
      <span v-if="capitalInfo" class="inline-flex items-baseline">
        <span class="font-sans mr-1">{{ UI_STRINGS.FUNDAMENTALS?.capital || '股本' }}</span>
        <strong class="font-bold text-base-content">{{ capitalInfo.val }}</strong>
        <span class="font-sans mr-1">{{ UI_STRINGS.FUNDAMENTALS?.capitalUnit || '億' }}</span>
        <span class="select-none font-sans" :class="capitalInfo.typeClass">({{ capitalInfo.type }})</span>
      </span>

      <!-- 分隔符號 -->
      <span v-if="capitalInfo && peInfo" class="text-base-content/40 mx-1.5 select-none">·</span>

      <!-- 本益比資訊：PE 19.3 (同業 33.2 · 便宜 42%) / PE (虧損) / PE -- -->
      <span v-if="peInfo" class="inline-flex items-baseline">
        <span class="mr-1 select-none">{{ UI_STRINGS.FUNDAMENTALS?.pe || 'PE' }}</span>
        <strong v-if="peInfo.hasPe" class="font-bold text-base-content mr-1">{{ peInfo.peValue }}</strong>
        <span v-if="peInfo.bracketText" class="select-none" :class="peInfo.bracketClass">
          ({{ peInfo.bracketText }})
        </span>
        <span v-else-if="peInfo.noDataText" class="text-base-content/40 select-none">
          {{ peInfo.noDataText }}
        </span>
      </span>
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

// 股本規模解析
const capitalInfo = computed(() => {
  const cap = props.stock.paidInCapital
  if (cap == null || typeof cap !== 'number' || isNaN(cap)) return null

  // 100 億以上取整數（如 2593億），100 億以下保留 1 位小數（如 11.5億）
  const formattedVal = cap >= 100 ? String(Math.round(cap)) : cap.toFixed(1)

  let type = ''
  let typeClass = ''
  if (cap <= 30) {
    type = UI_STRINGS.FUNDAMENTALS?.capLight || '輕'
    typeClass = 'font-bold text-base-content'
  } else if (cap <= 100) {
    type = UI_STRINGS.FUNDAMENTALS?.capMid || '中'
    typeClass = 'font-normal text-base-content/65'
  } else {
    type = UI_STRINGS.FUNDAMENTALS?.capLarge || '大'
    typeClass = 'font-normal text-base-content/65'
  }

  return {
    val: formattedVal,
    type,
    typeClass,
  }
})

// 本益比與同業對照解析
const peInfo = computed(() => {
  const stock = props.stock
  const pe = stock.pe
  const indPe = stock.industryPe
  const discount = stock.peDiscount

  // 1. 若有有效本益比數值
  if (pe != null && typeof pe === 'number' && !isNaN(pe)) {
    const peFormatted = pe.toFixed(1)

    // 若有同業 PE 對照
    if (indPe != null && typeof indPe === 'number' && !isNaN(indPe)) {
      const indFormatted = indPe.toFixed(1)
      let comparisonText = ''

      if (discount != null && typeof discount === 'number' && !isNaN(discount)) {
        const absPct = Math.round(Math.abs(discount))
        if (discount < 0) {
          comparisonText = ` · ${UI_STRINGS.FUNDAMENTALS?.cheaperPrefix || '便宜'} ${absPct}%`
        } else if (discount > 0) {
          comparisonText = ` · ${UI_STRINGS.FUNDAMENTALS?.expensivePrefix || '偏貴'} ${absPct}%`
        }
      }

      return {
        hasPe: true,
        peValue: peFormatted,
        bracketText: `${UI_STRINGS.FUNDAMENTALS?.industry || '同業'} ${indFormatted}${comparisonText}`,
        bracketClass: 'text-base-content/80',
      }
    }

    return {
      hasPe: true,
      peValue: peFormatted,
      bracketText: null,
      bracketClass: '',
    }
  }

  // 2. 虧損股判定（有基本面股本或同業資料，但本益比為 null）
  if (stock.paidInCapital != null || stock.industryPe != null) {
    return {
      hasPe: false,
      peValue: null,
      bracketText: UI_STRINGS.FUNDAMENTALS?.loss || '虧損',
      bracketClass: 'text-base-content/65 font-medium',
    }
  }

  // 3. 真正無資料
  return {
    hasPe: false,
    peValue: null,
    bracketText: null,
    noDataText: UI_STRINGS.FUNDAMENTALS?.noData || '--',
  }
})

// 是否具備基本面資訊區塊
const hasFundamentalsSection = computed(() => {
  return !!capitalInfo.value || (peInfo.value && (peInfo.value.hasPe || peInfo.value.bracketText != null))
})
</script>
