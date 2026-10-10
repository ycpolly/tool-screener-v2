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
              <span class="text-base-content/80 font-medium text-xs sm:text-sm shrink-0">
                · {{ UI_STRINGS.REL_STRENGTH?.modalTitle || '相對大盤 5 日強弱 (RS) 明細' }}
              </span>
            </h3>
          </div>

          <!-- 關閉按鈕 -->
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
            :aria-label="UI_STRINGS.REL_STRENGTH?.closeBtn || '關閉'"
            @click="$emit('close')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 無資料提示 -->
        <div
          v-if="!rsDetails"
          class="py-12 text-center text-sm text-base-content/50 border border-base-300/70 rounded-xl font-numeric"
        >
          {{ UI_STRINGS.REL_STRENGTH?.emptyData || '暫無對照數據' }}
        </div>

        <!-- 內容主體 (可滾動區) -->
        <div v-else class="flex-1 overflow-y-auto min-h-0 space-y-3 pr-0.5">
          <!-- 1. 核心對比 3 格摘要卡 (個股 5 日 vs 大盤 5 日 vs 超額 RS) -->
          <div class="grid grid-cols-3 gap-2 font-numeric">
            <!-- 卡片 1：個股 5 日走勢 -->
            <div class="bg-base-200/50 border border-base-300/70 rounded-xl p-2.5 flex flex-col justify-between text-center space-y-1">
              <div class="text-[11px] font-sans text-base-content/65 font-medium truncate">
                {{ UI_STRINGS.REL_STRENGTH?.stockCardTitle || '個股 5 日走勢' }}
              </div>
              <div class="text-xs text-base-content/80 truncate">
                {{ formatNumber(rsDetails.stockBasePrice) }} ➔ {{ formatNumber(rsDetails.stockPrice) }}
              </div>
              <div class="text-sm sm:text-base font-bold" :class="getColorClass(rsDetails.stockChg5d)">
                {{ formatSignedPct(rsDetails.stockChg5d) }}
              </div>
            </div>

            <!-- 卡片 2：大盤 5 日走勢 -->
            <div class="bg-base-200/50 border border-base-300/70 rounded-xl p-2.5 flex flex-col justify-between text-center space-y-1">
              <div class="text-[11px] font-sans text-base-content/65 font-medium truncate">
                {{ rsDetails.benchmarkName || (UI_STRINGS.REL_STRENGTH?.benchCardTitle || '大盤 5 日走勢') }}
              </div>
              <div class="text-xs text-base-content/80 truncate">
                {{ formatNumber(rsDetails.benchBasePrice, 0) }} ➔ {{ formatNumber(rsDetails.benchPrice, 0) }}
              </div>
              <div class="text-sm sm:text-base font-bold" :class="getColorClass(rsDetails.benchChg5d)">
                {{ formatSignedPct(rsDetails.benchChg5d) }}
              </div>
            </div>

            <!-- 卡片 3：超額強弱度 (RS) -->
            <div class="bg-base-200/70 border border-base-300/80 rounded-xl p-2.5 flex flex-col justify-between text-center space-y-1">
              <div class="text-[11px] font-sans text-base-content/75 font-semibold truncate">
                {{ UI_STRINGS.REL_STRENGTH?.rsCardTitle || '超額強弱度 (RS)' }}
              </div>
              <div class="text-[11px] font-sans text-base-content/60 truncate">
                {{ rsDetails.relStrength >= 0 ? (UI_STRINGS.REL_STRENGTH?.strongerThanMarket || '強於大盤') : (UI_STRINGS.REL_STRENGTH?.weakerThanMarket || '弱於大盤') }}
              </div>
              <div class="text-sm sm:text-base font-bold" :class="getColorClass(rsDetails.relStrength)">
                {{ formatSignedPct(rsDetails.relStrength) }}
              </div>
            </div>
          </div>

          <!-- 2. 白話公式與基準日 Callout 提示 -->
          <div class="bg-base-200/30 border border-base-300/60 rounded-xl p-2.5 text-xs text-base-content/80 space-y-1">
            <div class="flex items-center gap-1 font-medium">
              <span class="font-bold text-base-content">{{ UI_STRINGS.REL_STRENGTH?.formulaTitle || '計算公式' }}：</span>
              <span>{{ UI_STRINGS.REL_STRENGTH?.formulaText || '個股 5 日累計漲跌幅 － 大盤 5 日累計漲跌幅' }}</span>
            </div>
            <div class="text-[11px] text-base-content/60 flex items-center gap-1 font-numeric">
              <span>{{ UI_STRINGS.REL_STRENGTH?.baseVsCurrent || '基準日 (T-5) ➔ 今日 (T-0)' }}：</span>
              <span>{{ formatDate(rsDetails.baseDate) }} ➔ {{ formatDate(rsDetails.currentDate) }}</span>
            </div>
          </div>

          <!-- 3. 5 日逐日對照時間序列明細表 -->
          <div class="border border-base-300/70 rounded-xl overflow-hidden">
            <!-- 欄位表頭 -->
            <div class="grid grid-cols-12 bg-base-200/60 border-b border-base-300/70 py-2 px-3 text-[11px] font-semibold text-base-content/70 font-numeric text-center">
              <span class="col-span-3 text-left font-sans">{{ UI_STRINGS.REL_STRENGTH?.colDate || '交易日' }}</span>
              <span class="col-span-3 text-right">{{ stock?.name || '個股' }}</span>
              <span class="col-span-3 text-right">{{ rsDetails.benchmarkName || '大盤' }}</span>
              <span class="col-span-3 text-right font-sans">{{ UI_STRINGS.REL_STRENGTH?.colRsCum || '超額 RS' }}</span>
            </div>

            <!-- 表格列清單 (由基準日 T-5 依序排至 T-0) -->
            <div class="divide-y divide-base-300/40 text-xs font-numeric">
              <div
                v-for="item in daysList"
                :key="item.date"
                class="grid grid-cols-12 items-center py-2 px-3 hover:bg-base-200/30 transition-colors"
                :class="item.isToday ? 'bg-base-200/40 font-semibold' : ''"
              >
                <!-- 欄 1：日期與週期標籤 (例如 10/01 基準) -->
                <div class="col-span-3 text-left whitespace-nowrap min-w-0">
                  <div class="text-base-content/80 font-medium">{{ formatDate(item.date) }}</div>
                  <div class="text-[10px] text-base-content/50 font-sans truncate">{{ item.dayLabel }}</div>
                </div>

                <!-- 欄 2：個股價格 (當日收盤 + 累計 %) -->
                <div class="col-span-3 text-right whitespace-nowrap min-w-0">
                  <div class="text-base-content font-medium">{{ formatPrice(item.stockPrice) }}</div>
                  <div class="text-[11px]" :class="getColorClass(item.stockCumChg)">
                    {{ formatSignedPct(item.stockCumChg) }}
                  </div>
                </div>

                <!-- 欄 3：大盤點數 (當日收盤 + 累計 %) -->
                <div class="col-span-3 text-right whitespace-nowrap min-w-0">
                  <div class="text-base-content/80 font-medium">{{ formatNumber(item.benchPrice, 0) }}</div>
                  <div class="text-[11px]" :class="getColorClass(item.benchCumChg)">
                    {{ formatSignedPct(item.benchCumChg) }}
                  </div>
                </div>

                <!-- 欄 4：超額 RS 累計 % -->
                <div class="col-span-3 text-right font-bold whitespace-nowrap min-w-0" :class="getColorClass(item.rsCum)">
                  {{ formatSignedPct(item.rsCum) }}
                </div>
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

const rsDetails = computed(() => {
  return props.stock?.rsDetails || null
})

const daysList = computed(() => {
  if (!rsDetails.value || !Array.isArray(rsDetails.value.days)) return []
  const len = rsDetails.value.days.length
  return rsDetails.value.days.map((item, idx) => ({
    ...item,
    isToday: idx === len - 1,
  }))
})

function formatDate(dateStr) {
  if (!dateStr) return '--'
  const parts = String(dateStr).replace(/\//g, '-').split('-')
  if (parts.length >= 3) {
    return `${parts[1]}/${parts[2]}`
  }
  return dateStr
}

function formatPrice(val) {
  if (val == null || isNaN(val)) return '--'
  return Number(val).toFixed(2)
}

function formatNumber(val, decimals = 1) {
  if (val == null || isNaN(val)) return '--'
  const num = Number(val)
  return decimals === 0 ? num.toLocaleString(undefined, { maximumFractionDigits: 0 }) : num.toFixed(decimals)
}

function formatSignedPct(val) {
  if (val == null || isNaN(val)) return '--'
  const num = Number(val)
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
}

function getColorClass(val) {
  if (val == null || isNaN(val)) return 'text-base-content'
  const num = Number(val)
  if (num > 0) return 'text-rise'
  if (num < 0) return 'text-fall'
  return 'text-base-content'
}
</script>
