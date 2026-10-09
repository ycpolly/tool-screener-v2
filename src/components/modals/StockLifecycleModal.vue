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
              <span
                class="font-numeric cursor-pointer hover:underline touch-manipulation"
                :title="UI_STRINGS.SEARCH?.searchCodeTooltip"
                @click="$emit('searchCode', stock?.code)"
              >
                {{ stock?.code }}
              </span>
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
              :highlight-date="selectedDate"
            />
          </div>

          <!-- 下半部：橫向時間軸 Carousel (左邊過去 T-7 ➔ 中間選出日 ➔ 時光分界線 ➔ 右邊後續 T+1~T+N) -->
          <div
            ref="carouselRef"
            class="flex items-stretch gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 touch-pan-x scroll-smooth"
          >
            <template v-for="item in carouselItems" :key="item.type === 'divider' ? 'divider' : item.key">
              <!-- 時光分界線 -->
              <div
                v-if="item.type === 'divider'"
                class="flex flex-col items-center justify-center shrink-0 px-1 py-1 text-[11px] font-medium text-base-content/40 select-none"
              >
                <div class="w-px h-full bg-base-300 relative flex items-center justify-center">
                  <span class="absolute bg-base-200 border border-base-300 rounded-full px-1.5 py-0.5 text-[10px] text-base-content/70 whitespace-nowrap shadow-2xs">
                    {{ UI_STRINGS.LIFECYCLE.forwardDivider }} ➔
                  </span>
                </div>
              </div>

              <!-- 卡片：歷史日（含選出日）或 後續驗證日 -->
              <div
                v-else
                :ref="el => { if (item.isAnchor) anchorCardRef = el }"
                class="w-[104px] sm:w-[96px] shrink-0 rounded-xl p-2.5 flex flex-col items-center justify-between text-center space-y-1.5 font-numeric select-none transition-all cursor-pointer"
                :class="[
                  selectedDate && isSameDate(selectedDate, item.date)
                    ? 'border-2 border-base-content/50'
                    : 'border ' + (item.isAnchor ? 'border-base-content/30 shadow-xs hover:border-base-content/50' : 'border-base-300/70 hover:border-base-content/30'),
                  item.isAnchor ? 'bg-base-200/90' : 'bg-base-200/40'
                ]"
                @click="toggleDate(item.date)"
              >
                <!-- 1. 日期 -->
                <div class="text-xs text-base-content/75 font-medium whitespace-nowrap">
                  <span v-if="item.isFuture">{{ formatFutureRowDate(item.date, item.tDay) }}</span>
                  <span v-else>
                    {{ formatRowDate(item.date) }}
                    <span v-if="item.isAnchor && hasForwardData" class="text-[10px] text-primary font-semibold ml-0.5">
                      ({{ UI_STRINGS.LIFECYCLE.entryDayBadge }})
                    </span>
                  </span>
                </div>

                <!-- 2. 當日收盤價與漲跌 (兩行疊加) -->
                <div class="space-y-0.5 whitespace-nowrap" :class="getRowColorClass(item.changePct)">
                  <div class="text-sm sm:text-base font-bold">
                    {{ formatPrice(item.price) }}
                  </div>
                  <div class="text-[10px] font-semibold">
                    {{ formatRowChange(item.change, item.changePct, item.price) }}
                  </div>
                </div>

                <!-- 3. 符合策略模式標籤 或 後續累計損益 -->
                <div class="text-xs font-sans w-full truncate pt-1.5 border-t border-base-300/60">
                  <!-- 後續日顯示累計漲跌幅 -->
                  <div v-if="item.isFuture" class="font-numeric font-semibold text-xs truncate" :class="getRowColorClass(item.cumChangePct)">
                    {{ UI_STRINGS.LIFECYCLE.cumGainLabel(item.cumChangePct) }}
                  </div>
                  <!-- 歷史日顯示選股模式 -->
                  <template v-else>
                    <span
                      v-if="item.matchedModes && item.matchedModes.length > 0"
                      class="font-medium text-base-content inline-block max-w-full truncate"
                      :title="item.matchedModes.map(m => m.label).join(' · ')"
                    >
                      {{ item.matchedModes[0].label }}
                      <span v-if="!item.isInPool" class="font-normal text-base-content/50 text-[11px] ml-0.5">
                        {{ UI_STRINGS.LIFECYCLE.notInPoolSuffix }}
                      </span>
                    </span>
                    <span
                      v-else-if="!item.isInPool"
                      class="font-normal text-base-content/40 inline-block max-w-full truncate text-[11px]"
                    >
                      {{ UI_STRINGS.LIFECYCLE.notInPool }}
                    </span>
                    <span v-else class="text-base-content/35 font-numeric">
                      {{ UI_STRINGS.LIFECYCLE.noMatch }}
                    </span>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- ============================================================
             版面 2：俐落三欄式表格 (viewMode === 'table')
             ============================================================ -->
        <div v-else class="flex-1 overflow-y-auto min-h-0 border border-base-300/70 rounded-xl">
          <!-- 欄位標題 (日期 | 收盤 (漲跌) | 符合模式) -->
          <div class="flex items-center justify-between py-2 px-3 bg-base-200/50 border-b border-base-300/70 text-xs font-semibold text-base-content/70">
            <span class="w-24 sm:w-28 shrink-0 text-left">{{ UI_STRINGS.LIFECYCLE.colDate }}</span>
            <span class="flex-1 text-center">{{ UI_STRINGS.LIFECYCLE.colPrice }}</span>
            <span class="w-24 sm:w-28 shrink-0 text-right">{{ UI_STRINGS.LIFECYCLE.colModes }}</span>
          </div>

          <!-- 表格列 (近 7 個歷史交易日 + 後續驗證日) -->
          <div class="divide-y divide-base-300/40 text-xs sm:text-sm font-numeric">
            <div
              v-for="row in allTableRows"
              :key="row.key"
              class="flex items-center justify-between py-2.5 px-3 hover:bg-base-200/30 transition-colors"
              :class="row.isAnchor ? 'bg-base-200/40 font-semibold' : ''"
            >
              <!-- 欄 1：日期 -->
              <div class="w-24 sm:w-28 shrink-0 text-left text-base-content/75 font-numeric whitespace-nowrap">
                <span v-if="row.isFuture">{{ formatFutureRowDate(row.date, row.tDay) }}</span>
                <span v-else>
                  {{ formatRowDate(row.date) }}
                  <span v-if="row.isAnchor && hasForwardData" class="text-[10px] text-primary font-semibold ml-0.5">
                    ({{ UI_STRINGS.LIFECYCLE.entryDayBadge }})
                  </span>
                </span>
              </div>

              <!-- 欄 2：收盤 (漲跌) -->
              <div
                class="flex-1 text-center font-medium whitespace-nowrap px-1"
                :class="getRowColorClass(row.changePct)"
              >
                <span>{{ formatPrice(row.price) }}</span>
                <span class="ml-1 text-xs sm:text-sm font-semibold">{{ formatRowChange(row.change, row.changePct, row.price) }}</span>
              </div>

              <!-- 欄 3：符合模式 或 累計漲跌 -->
              <div class="w-24 sm:w-28 shrink-0 text-right font-sans">
                <div v-if="row.isFuture" class="font-numeric font-semibold text-xs sm:text-sm" :class="getRowColorClass(row.cumChangePct)">
                  {{ UI_STRINGS.LIFECYCLE.cumGainLabel(row.cumChangePct) }}
                </div>
                <template v-else>
                  <div v-if="row.matchedModes && row.matchedModes.length > 0" class="flex flex-wrap items-center justify-end gap-1">
                    <span
                      v-for="m in row.matchedModes"
                      :key="m.id"
                      class="inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-base-200 border border-base-300 text-base-content"
                    >
                      {{ m.label }}
                      <span v-if="!row.isInPool" class="font-normal text-base-content/60 text-[10px] ml-0.5">
                        {{ UI_STRINGS.LIFECYCLE.notInPoolSuffix }}
                      </span>
                    </span>
                  </div>
                  <span v-else-if="!row.isInPool" class="text-xs text-base-content/40 font-normal">
                    {{ UI_STRINGS.LIFECYCLE.notInPool }}
                  </span>
                  <span v-else class="text-xs text-base-content/35 font-numeric">
                    {{ UI_STRINGS.LIFECYCLE.noMatch }}
                  </span>
                </template>
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

defineEmits(['close', 'searchCode'])

const viewMode = ref('timeline')
const carouselRef = ref(null)
const anchorCardRef = ref(null)
const selectedDate = ref('')

function isSameDate(d1, d2) {
  if (!d1 || !d2) return false
  return String(d1).replace(/\//g, '-').slice(0, 10) === String(d2).replace(/\//g, '-').slice(0, 10)
}

function toggleDate(dateStr) {
  if (isSameDate(selectedDate.value, dateStr)) {
    selectedDate.value = ''
  } else {
    selectedDate.value = dateStr
  }
}

// 歷史 7 個交易日軌跡 (T-0 到 T-7)
const rows = computed(() => {
  if (!props.isOpen || !props.stock) return []
  return getStockLifecycle(props.stock, 7)
})

// 後續驗證日資料 (若有時光機歷史回測未來天數)
const forwardRows = computed(() => {
  const fv = props.stock?.forwardValidation
  if (!fv || !Array.isArray(fv.dailyRecords) || fv.dailyRecords.length === 0) {
    return []
  }
  return fv.dailyRecords.map((r) => ({
    key: `forward-${r.tDay}-${r.date}`,
    isFuture: true,
    isAnchor: false,
    tDay: r.tDay,
    date: r.date,
    price: r.close,
    change: r.dayChange,
    changePct: r.dayChangePct,
    cumChangePct: r.cumChangePct,
    volume: r.volume,
  }))
})

const hasForwardData = computed(() => forwardRows.value.length > 0)

// 橫向時間軸卡片（含過去歷史、選出日、時光分界線、後續驗證）
const carouselItems = computed(() => {
  const pastRows = [...rows.value].reverse().map(r => ({
    ...r,
    key: `past-${r.offset}-${r.date}`,
    isFuture: false,
    isAnchor: r.offset === 0,
    type: 'card',
  }))

  if (!hasForwardData.value) {
    return pastRows
  }

  return [
    ...pastRows,
    { type: 'divider' },
    ...forwardRows.value.map(f => ({ ...f, type: 'card' })),
  ]
})

// 表格總列（依時間順序：未來在最上，或最新歷史在最上）
const allTableRows = computed(() => {
  const past = rows.value.map(r => ({
    ...r,
    key: `past-${r.offset}-${r.date}`,
    isFuture: false,
    isAnchor: r.offset === 0,
  }))

  if (!hasForwardData.value) {
    return past
  }

  // 表格中：後續驗證按 T+N (由大到小) 排在最上方，接著是選出日 (T-0) 及過往歷史
  const reversedForward = [...forwardRows.value].reverse()
  return [...reversedForward, ...past]
})

function scrollToAnchor() {
  nextTick(() => {
    if (!carouselRef.value) return

    if (anchorCardRef.value) {
      // 若有後續資料，將選出日 (anchor) 對齊在可視區偏右側，露出右方的時光分界線
      const container = carouselRef.value
      const card = anchorCardRef.value
      const cardLeft = card.offsetLeft
      const cardWidth = card.offsetWidth
      const containerWidth = container.clientWidth
      
      // 計算目標滾動位置：使 anchor 卡片置於右側 (保留約 30px 給分界線露出)
      const targetScroll = cardLeft - containerWidth + cardWidth + (hasForwardData.value ? 40 : 16)
      container.scrollLeft = Math.max(0, targetScroll)
    } else {
      carouselRef.value.scrollLeft = carouselRef.value.scrollWidth
    }
  })
}

watch([() => props.isOpen, () => props.stock?.code, viewMode], ([open, code, mode]) => {
  if (!open) {
    selectedDate.value = ''
  }
  if (open && mode === 'timeline') {
    setTimeout(scrollToAnchor, 60)
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

function formatFutureRowDate(dateStr, tDay) {
  if (!dateStr) return '--'
  const clean = String(dateStr).replace(/\//g, '-')
  const parts = clean.split('-')
  if (parts.length < 3) return dateStr
  const mm = String(parts[1]).padStart(2, '0')
  const dd = String(parts[2]).padStart(2, '0')
  const suffix = tDay ? ` (T+${tDay})` : ''
  return `${mm}/${dd}${suffix}`
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
    return `▴${absChg} (${absPct}%)`
  }
  if (changePct < 0) {
    return `▾${absChg} (${absPct}%)`
  }
  return `0.00 (0.00%)`
}

function getRowColorClass(changePct) {
  if (changePct > 0) return 'text-rise'
  if (changePct < 0) return 'text-fall'
  return 'text-base-content'
}
</script>
