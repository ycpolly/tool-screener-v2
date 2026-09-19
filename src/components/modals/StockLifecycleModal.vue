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
          <div class="flex items-center gap-2 min-w-0">
            <h3 class="text-base sm:text-lg font-bold text-base-content flex items-center gap-1.5 truncate">
              <span class="font-numeric">{{ stock?.code }}</span>
              <span class="truncate">{{ stock?.name }}</span>
              <span class="text-base-content/80 font-medium text-sm sm:text-base shrink-0">· {{ UI_STRINGS.LIFECYCLE.titleSuffix }}</span>
            </h3>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- AB 測試版面切換器：時間軸 vs 表格 -->
            <div class="join bg-base-200 p-0.5 rounded-lg border border-base-300 text-xs">
              <button
                type="button"
                class="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
                :class="viewMode === 'timeline' ? 'bg-base-100 text-base-content font-bold shadow-xs' : 'text-base-content/60 hover:text-base-content'"
                @click="viewMode = 'timeline'"
              >
                {{ UI_STRINGS.LIFECYCLE.viewTimeline }}
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
                :class="viewMode === 'table' ? 'bg-base-100 text-base-content font-bold shadow-xs' : 'text-base-content/60 hover:text-base-content'"
                @click="viewMode = 'table'"
              >
                {{ UI_STRINGS.LIFECYCLE.viewTable }}
              </button>
            </div>

            <!-- 關閉按鈕 -->
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
        </div>

        <!-- 無資料狀態 -->
        <div v-if="rows.length === 0" class="py-12 text-center text-sm text-base-content/50 border border-base-300/70 rounded-xl">
          {{ UI_STRINGS.LIFECYCLE.noData }}
        </div>

        <!-- ============================================================
             版面 1：走勢圖 + 橫向時間軸 Carousel (viewMode === 'timeline')
             ============================================================ -->
        <div v-else-if="viewMode === 'timeline'" class="flex-1 overflow-y-auto min-h-0 space-y-3">
          <!-- 上半部：Sparkline 技術走勢圖 -->
          <div class="bg-base-200/30 border border-base-300/60 rounded-xl py-2 px-3 flex items-center justify-center">
            <Sparkline
              :history="stock.history10d"
              :stock="stock"
              :stock-code="stock.code"
            />
          </div>

          <!-- 下半部：橫向時間軸 Carousel (左邊過去 T-7 ➔ 右邊最新 T-0) -->
          <div
            ref="carouselRef"
            class="flex gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 touch-pan-x scroll-smooth"
          >
            <div
              v-for="row in timelineRows"
              :key="row.offset"
              class="w-[104px] sm:w-[96px] shrink-0 border rounded-xl p-2.5 flex flex-col items-center justify-between text-center space-y-1.5 font-numeric select-none transition-colors"
              :class="row.offset === 0
                ? 'bg-base-200/90 border-base-content/25 shadow-xs'
                : 'bg-base-200/40 border-base-300/70'"
            >
              <!-- 1. 日期 -->
              <div class="text-xs text-base-content/75 font-medium whitespace-nowrap">
                {{ formatRowDate(row.date) }}
              </div>

              <!-- 2. 當日收盤價與漲跌 (兩行疊加) -->
              <div class="space-y-0.5 whitespace-nowrap" :class="getRowColorClass(row.changePct)">
                <div class="text-sm sm:text-base font-bold">
                  {{ formatPrice(row.price) }}
                </div>
                <div class="text-[10px] font-semibold">
                  {{ formatRowChange(row.change, row.changePct, row.price) }}
                </div>
              </div>

              <!-- 3. 符合策略模式標籤 (單行居中，未符合顯示 '--') -->
              <div class="text-xs font-sans w-full truncate pt-1 border-t border-base-300/60">
                <span
                  v-if="row.matchedModes && row.matchedModes.length > 0"
                  class="font-medium text-base-content inline-block max-w-full truncate"
                  :title="row.matchedModes.map(m => m.label).join(' · ')"
                >
                  {{ row.matchedModes[0].label }}
                </span>
                <span v-else class="text-base-content/35 font-numeric">
                  {{ UI_STRINGS.LIFECYCLE.noMatch }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================================================
             版面 2：俐落三欄式表格 (viewMode === 'table')
             ============================================================ -->
        <div v-else class="flex-1 overflow-y-auto min-h-0 border border-base-300/70 rounded-xl">
          <!-- 欄位標題 (日期 | 收盤 (漲跌) | 符合模式) -->
          <div class="flex items-center justify-between py-2 px-3 bg-base-200/50 border-b border-base-300/70 text-xs font-semibold text-base-content/70">
            <span class="w-20 shrink-0 text-left">{{ UI_STRINGS.LIFECYCLE.colDate }}</span>
            <span class="flex-1 text-center">{{ UI_STRINGS.LIFECYCLE.colPrice }}</span>
            <span class="w-24 sm:w-28 shrink-0 text-right">{{ UI_STRINGS.LIFECYCLE.colModes }}</span>
          </div>

          <!-- 表格列 (近 7 個歷史交易日，由近到遠排) -->
          <div class="divide-y divide-base-300/40 text-xs sm:text-sm font-numeric">
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
import { ref, computed, watch, nextTick } from 'vue'
import { UI_STRINGS } from '../../constants/ui-strings.js'
import { getStockLifecycle } from '../../engine/screener.js'
import Sparkline from '../Sparkline.vue'

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

const viewMode = ref('timeline')
const carouselRef = ref(null)

const rows = computed(() => {
  if (!props.isOpen || !props.stock) return []
  return getStockLifecycle(props.stock, 7)
})

// 方案 A：橫向時間軸由左至右為由過去 (T-7) 至最新 (T-0)，與上方走勢圖同向
const timelineRows = computed(() => {
  return [...rows.value].reverse()
})

function scrollToLatest() {
  nextTick(() => {
    if (carouselRef.value) {
      carouselRef.value.scrollLeft = carouselRef.value.scrollWidth
    }
  })
}

watch([() => props.isOpen, viewMode], ([open, mode]) => {
  if (open && mode === 'timeline') {
    setTimeout(scrollToLatest, 60)
  }
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
