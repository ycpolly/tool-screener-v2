<template>
  <dialog :class="{ 'modal-open': isOpen }" class="modal modal-bottom sm:modal-middle select-none z-50">
    <div
      class="modal-box max-w-lg w-full bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl max-h-[90vh] flex flex-col safe-pb-modal"
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between pb-2.5 border-b border-base-300/80 shrink-0">
        <div class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 class="text-base sm:text-lg font-bold text-base-content flex items-center gap-1.5">
            <span class="font-numeric">{{ stock?.code }}</span>
            <span>{{ stock?.name }}</span>
            <span class="text-base-content/80 font-medium text-sm sm:text-base">{{ UI_STRINGS.QUICK_CALC.titleSuffix }}</span>
          </h3>
        </div>

        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
          :aria-label="UI_STRINGS.QUICK_CALC.closeBtn"
          @click="$emit('close')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

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

      <!-- Modal Footer -->
      <div class="modal-action pt-2 border-t border-base-300/80 shrink-0">
        <button
          type="button"
          class="btn btn-sm btn-neutral h-8 min-h-0 px-4 rounded-lg cursor-pointer shadow-none"
          @click="$emit('close')"
        >
          {{ UI_STRINGS.QUICK_CALC.closeBtn }}
        </button>
      </div>
    </div>

    <!-- 背景遮罩 (點擊關閉) -->
    <form method="dialog" class="modal-backdrop" @click="$emit('close')">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../../constants/ui-strings.js'
import { calculateQuickCalcTable, formatPrice } from '../../engine/tick-size.js'

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

defineEmits(['close'])

const rows = computed(() => {
  if (!props.stock) return []
  return calculateQuickCalcTable(props.stock.price, props.stock.prevClose)
})
</script>
