<template>
  <BaseStockModal
    :is-open="isOpen"
    :stock="stock"
    :title-suffix="UI_STRINGS.QUICK_CALC.titleSuffix"
    :close-aria-label="UI_STRINGS.QUICK_CALC.closeBtn"
    @close="$emit('close')"
    @search-code="$emit('searchCode', $event)"
  >
    <!-- 雙欄速算表格主體 -->
    <div class="flex-1 overflow-y-auto min-h-0 border border-base-300/70 rounded-xl">
      <!-- 頂部副標題列 (基於現價 vs 基於昨收) -->
      <div class="grid grid-cols-2 bg-base-200/70 border-b border-base-300/80 text-xs sm:text-sm font-medium text-base-content">
        <div class="py-2 px-3 text-center border-r border-base-300/70 font-numeric">
          {{ UI_STRINGS.QUICK_CALC.basedOnCurrent(formatPrice(stock?.price)) }}
        </div>
        <div class="py-2 px-3 text-center font-numeric">
          {{ UI_STRINGS.QUICK_CALC.basedOnPrevClose(formatPrice(stock?.prevClose)) }}
        </div>
      </div>

      <!-- 欄位標題 (漲幅 / 價格 | 漲幅 / 價格) -->
      <div class="grid grid-cols-2 bg-base-200/40 border-b border-base-300/60 text-xs font-semibold text-base-content/70">
        <div class="grid grid-cols-2 py-1.5 px-3 border-r border-base-300/70">
          <span class="text-left">{{ UI_STRINGS.QUICK_CALC.colGain }}</span>
          <span class="text-right">{{ UI_STRINGS.QUICK_CALC.colPrice }}</span>
        </div>
        <div class="grid grid-cols-2 py-1.5 px-3">
          <span class="text-left">{{ UI_STRINGS.QUICK_CALC.colGain }}</span>
          <span class="text-right">{{ UI_STRINGS.QUICK_CALC.colPrice }}</span>
        </div>
      </div>

      <!-- 表格列 (+10% 至 +1%，由高至低排) -->
      <div class="divide-y divide-base-300/40 text-sm font-numeric">
        <div
          v-for="row in rows"
          :key="row.pct"
          class="grid grid-cols-2 hover:bg-base-200/30 transition-colors"
        >
          <!-- 左欄：基於現價 -->
          <div class="grid grid-cols-2 py-1.5 px-3 border-r border-base-300/70 items-center">
            <span class="text-left font-medium text-rise">
              {{ row.pctLabel }}
            </span>
            <span class="text-right font-bold text-base-content">
              {{ row.curPrice }}
            </span>
          </div>

          <!-- 右欄：基於昨收 -->
          <div class="grid grid-cols-2 py-1.5 px-3 items-center">
            <span class="text-left font-medium text-rise">
              {{ row.pctLabel }}
            </span>
            <span class="text-right font-bold text-base-content">
              {{ row.prevPrice }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </BaseStockModal>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../../constants/ui-strings.js'
import { calculateQuickCalcTable, formatPrice } from '../../engine/tick-size.js'
import BaseStockModal from './BaseStockModal.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  stock: {
    type: Object,
    default: null,
  },
})

defineEmits(['close', 'searchCode'])

const rows = computed(() => {
  if (!props.isOpen || !props.stock) return []
  return calculateQuickCalcTable(props.stock.price, props.stock.prevClose)
})
</script>
