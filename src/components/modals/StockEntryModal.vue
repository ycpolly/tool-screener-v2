<template>
  <BaseStockModal
    :is-open="isOpen"
    :stock="stock"
    :title-suffix="UI_STRINGS.STOCK_ENTRY_MODAL.titleSuffix"
    :close-aria-label="UI_STRINGS.STOCK_ENTRY_MODAL.closeBtn"
    box-class="max-w-xl"
    @close="$emit('close')"
    @search-code="$emit('searchCode', $event)"
  >
    <!-- 頂部統計摘要列 -->
    <div
      v-if="entryData.totalDays > 0"
      class="flex items-center justify-between px-3 py-2 bg-base-200/70 rounded-xl border border-base-300/60 text-xs sm:text-sm shrink-0"
    >
      <span class="text-base-content font-medium">
        {{ UI_STRINGS.STOCK_ENTRY_MODAL.entrySummary(entryData.totalDays, entryData.inPoolDays) }}
      </span>
      <span
        v-if="stock?.isNewEntry"
        class="badge badge-sm font-sans font-bold bg-base-300 text-base-content/85"
      >
        {{ UI_STRINGS.STOCK_ENTRY_MODAL.statusNewEntry }}
      </span>
    </div>

    <!-- 歷史入池表格主體 -->
    <div class="flex-1 overflow-y-auto min-h-0 border border-base-300/70 rounded-xl">
      <!-- 欄位標題 (日期 / 狀態 / 入選排行榜原因) -->
      <div class="grid grid-cols-12 bg-base-200/80 border-b border-base-300/80 text-xs font-semibold text-base-content/80 py-2 px-3 sticky top-0 z-10 backdrop-blur-xs">
        <div class="col-span-4 sm:col-span-3 text-left">
          {{ UI_STRINGS.STOCK_ENTRY_MODAL.colDate }}
        </div>
        <div class="col-span-3 sm:col-span-2 text-center">
          {{ UI_STRINGS.STOCK_ENTRY_MODAL.colStatus }}
        </div>
        <div class="col-span-5 sm:col-span-7 text-left">
          {{ UI_STRINGS.STOCK_ENTRY_MODAL.colReasons }}
        </div>
      </div>

      <!-- 資料列 (按日期由新到舊排) -->
      <div
        v-if="entryData.records.length > 0"
        class="divide-y divide-base-300/40 text-xs sm:text-sm font-numeric"
      >
        <div
          v-for="record in entryData.records"
          :key="record.date"
          class="grid grid-cols-12 py-2 px-3 items-center hover:bg-base-200/30 transition-colors"
          :class="!record.isInPool ? 'opacity-40' : ''"
        >
          <!-- 1. 日期 -->
          <div class="col-span-4 sm:col-span-3 font-medium text-base-content whitespace-nowrap">
            {{ formatTimelineDate(record.date) }}
          </div>

          <!-- 2. 狀態 -->
          <div class="col-span-3 sm:col-span-2 text-center whitespace-nowrap">
            <span
              v-if="record.isNew"
              class="inline-block px-1.5 py-0.5 rounded text-[11px] font-sans font-bold bg-primary/10 text-primary border border-primary/20"
            >
              {{ UI_STRINGS.STOCK_ENTRY_MODAL.statusNewEntry }}
            </span>
            <span
              v-else-if="record.isInPool"
              class="inline-block px-1.5 py-0.5 rounded text-[11px] font-sans font-medium bg-base-300 text-base-content/85"
            >
              {{ UI_STRINGS.STOCK_ENTRY_MODAL.statusInPool }}
            </span>
            <span
              v-else
              class="inline-block px-1.5 py-0.5 rounded text-[11px] font-sans font-medium text-base-content/50"
            >
              {{ UI_STRINGS.STOCK_ENTRY_MODAL.statusNotInPool }}
            </span>
          </div>

          <!-- 3. 入池原因 (官方排行榜 Badge 清單) -->
          <div class="col-span-5 sm:col-span-7 font-sans flex flex-wrap gap-1 items-center">
            <template v-if="record.isInPool && record.categoryLabels.length > 0">
              <span
                v-for="label in record.categoryLabels"
                :key="label"
                class="inline-block px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-base-200 border border-base-300/80 text-base-content/90 select-none"
              >
                {{ label }}
              </span>
            </template>
            <span
              v-else-if="record.isInPool"
              class="text-xs text-base-content/50"
            >
              {{ UI_STRINGS.STOCK_ENTRY_MODAL.emptyReasons }}
            </span>
            <span
              v-else
              class="text-xs text-base-content/40"
            >
              -
            </span>
          </div>
        </div>
      </div>

      <!-- 無資料狀態 -->
      <div
        v-else
        class="py-10 text-center text-xs sm:text-sm text-base-content/50"
      >
        {{ UI_STRINGS.STOCK_ENTRY_MODAL.noRecords }}
      </div>
    </div>
  </BaseStockModal>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../../constants/ui-strings.js'
import { getStockEntryRecords } from '../../engine/screener.js'
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

const entryData = computed(() => {
  if (!props.stock) return { totalDays: 0, inPoolDays: 0, records: [] }
  return getStockEntryRecords(props.stock)
})

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatTimelineDate(dateStr) {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      const d = parseInt(parts[2], 10)
      const dt = new Date(y, m - 1, d)
      const w = WEEKDAYS[dt.getDay()]
      return `${m}/${d} (${w})`
    }
  } catch {}
  return dateStr
}
</script>
