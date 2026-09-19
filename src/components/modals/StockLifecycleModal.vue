<template>
  <Teleport to="body">
    <dialog
      v-if="isOpen"
      :class="{ 'modal-open': isOpen }"
      class="modal modal-bottom sm:modal-middle select-none z-50"
    >
      <div
        class="modal-box max-w-lg w-full bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl max-h-[90vh] flex flex-col safe-pb-modal"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-2.5 border-b border-base-300/80 shrink-0">
          <div class="flex items-center gap-2">
            <h3 class="text-base sm:text-lg font-bold text-base-content flex items-center gap-1.5">
              <span class="font-numeric">{{ stock?.code }}</span>
              <span>{{ stock?.name }}</span>
              <span class="text-base-content/80 font-medium text-sm sm:text-base">· {{ UI_STRINGS.LIFECYCLE.titleSuffix }}</span>
            </h3>
          </div>

          <button
            type="button"
            class="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
            :aria-label="UI_STRINGS.LIFECYCLE.closeBtn"
            @click="$emit('close')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 三欄近日表現表格主體 -->
        <div class="flex-1 overflow-y-auto min-h-0 border border-base-300/70 rounded-xl">
          <!-- 欄位標題 (日期 | 收盤 (漲跌) | 符合模式) -->
          <div class="flex items-center justify-between py-2 px-3 bg-base-200/50 border-b border-base-300/70 text-xs font-semibold text-base-content/70">
            <span class="w-20 shrink-0 text-left">{{ UI_STRINGS.LIFECYCLE.colDate }}</span>
            <span class="flex-1 text-center">{{ UI_STRINGS.LIFECYCLE.colPrice }}</span>
            <span class="w-24 sm:w-28 shrink-0 text-right">{{ UI_STRINGS.LIFECYCLE.colModes }}</span>
          </div>

          <!-- 無資料狀態 -->
          <div v-if="rows.length === 0" class="py-12 text-center text-sm text-base-content/50">
            {{ UI_STRINGS.LIFECYCLE.noData }}
          </div>

          <!-- 表格列 (近 7 個歷史交易日，由近到遠排) -->
          <div v-else class="divide-y divide-base-300/40 text-xs sm:text-sm font-numeric">
            <div
              v-for="row in rows"
              :key="row.offset"
              class="flex items-center justify-between py-2.5 px-3 hover:bg-base-200/30 transition-colors"
            >
              <!-- 欄 1：日期 -->
              <div class="w-20 shrink-0 text-left text-base-content/75 font-numeric whitespace-nowrap">
                {{ formatRowDate(row.date) }}
              </div>

              <!-- 欄 2：收盤 (漲跌) -->
              <div
                class="flex-1 text-center font-medium whitespace-nowrap px-1"
                :class="getRowColorClass(row.changePct)"
              >
                <span>{{ formatPrice(row.price) }}</span>
                <span class="ml-1 text-xs sm:text-sm font-semibold">{{ formatRowChange(row.change, row.changePct, row.price) }}</span>
              </div>

              <!-- 欄 3：符合模式 (乾淨無彩色中性標籤) -->
              <div class="w-24 sm:w-28 shrink-0 text-right font-sans">
                <div v-if="row.matchedModes && row.matchedModes.length > 0" class="flex flex-wrap items-center justify-end gap-1">
                  <span
                    v-for="m in row.matchedModes"
                    :key="m.id"
                    class="inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-base-200 border border-base-300 text-base-content"
                  >
                    {{ m.label }}
                  </span>
                </div>
                <span v-else class="text-xs text-base-content/35 font-numeric">
                  {{ UI_STRINGS.LIFECYCLE.noMatch }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 背景遮罩 (點擊關閉) -->
      <form method="dialog" class="modal-backdrop" @click="$emit('close')">
        <button>close</button>
      </form>
    </dialog>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../../constants/ui-strings.js'
import { getStockLifecycle } from '../../engine/screener.js'

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
  if (!props.isOpen || !props.stock) return []
  return getStockLifecycle(props.stock, 7)
})

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatRowDate(dateStr) {
  if (!dateStr) return '--'
  const clean = String(dateStr).replace(/\//g, '-')
  const parts = clean.split('-')
  if (parts.length < 3) return dateStr
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  const dateObj = new Date(y, m - 1, d)
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  const weekDay = WEEKDAYS[dateObj.getDay()] || ''
  return `${mm}/${dd} (${weekDay})`
}

function formatPrice(num) {
  if (num === null || num === undefined || isNaN(num)) return '--'
  return Number(num).toFixed(2)
}

function formatRowChange(change, changePct, price) {
  if (changePct === null || changePct === undefined || isNaN(changePct)) return ''
  const absPct = Math.abs(Number(changePct)).toFixed(2)
  let chgVal = change
  if ((chgVal === undefined || chgVal === null || isNaN(chgVal)) && price) {
    chgVal = Number((price * (changePct / 100) / (1 + changePct / 100)).toFixed(2))
  }
  const absChg = chgVal !== undefined && chgVal !== null && !isNaN(chgVal)
    ? Number(Math.abs(Number(chgVal))).toFixed(2)
    : '0.00'

  if (changePct > 0) {
    return `▲${absChg} (${absPct}%)`
  }
  if (changePct < 0) {
    return `▼${absChg} (${absPct}%)`
  }
  return `0.00 (0.00%)`
}

function getRowColorClass(changePct) {
  if (changePct > 0) return 'text-rise'
  if (changePct < 0) return 'text-fall'
  return 'text-base-content'
}
</script>
