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
      class="flex items-center justify-between px-3.5 py-2.5 bg-base-200/70 rounded-xl border border-base-300/70 text-xs sm:text-sm shrink-0"
    >
      <span class="text-base-content font-medium">
        {{ UI_STRINGS.STOCK_ENTRY_MODAL.entrySummary(entryData.totalDays, entryData.inPoolDays) }}
      </span>
      <span
        v-if="stock?.isNewEntry"
        class="text-xs font-normal text-base-content/70"
      >
        {{ UI_STRINGS.STOCK_ENTRY_MODAL.statusNewEntry }}
      </span>
    </div>

    <!-- 歷史入池表格主體 -->
    <div class="flex-1 overflow-y-auto min-h-0 border border-base-300/70 rounded-xl">
      <!-- 欄位標題 (日期 / 狀態 / 入選排行榜原因) -->
      <div class="grid grid-cols-12 bg-base-200/80 border-b border-base-300/80 text-xs font-semibold text-base-content/80 py-2.5 px-3 sticky top-0 z-10 backdrop-blur-xs">
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
          class="grid grid-cols-12 py-2.5 px-3 items-center hover:bg-base-200/40 transition-colors"
          :class="!record.isInPool ? 'opacity-40' : ''"
        >
          <!-- 1. 日期 -->
          <div class="col-span-4 sm:col-span-3 font-medium text-base-content whitespace-nowrap">
            {{ formatTimelineDate(record.date) }}
          </div>

          <!-- 2. 狀態 (普通文字，無特殊 UI) -->
          <div class="col-span-3 sm:col-span-2 text-center whitespace-nowrap font-sans">
            <span
              v-if="record.isNew"
              class="text-xs sm:text-sm font-medium text-base-content"
            >
              {{ UI_STRINGS.STOCK_ENTRY_MODAL.statusNewEntry }}
            </span>
            <span
              v-else-if="record.isInPool"
              class="text-xs sm:text-sm text-base-content/75"
            >
              {{ UI_STRINGS.STOCK_ENTRY_MODAL.statusInPool }}
            </span>
            <span
              v-else
              class="text-xs sm:text-sm text-base-content/40"
            >
              {{ UI_STRINGS.STOCK_ENTRY_MODAL.statusNotInPool }}
            </span>
          </div>

          <!-- 3. 入池原因 (官方排行榜 Badge 清單) -->
          <div class="col-span-5 sm:col-span-7 font-sans flex flex-wrap gap-1.5 items-center">
            <template v-if="record.isInPool && getRecordCategoryItems(record).length > 0">
              <template v-for="item in getRecordCategoryItems(record)" :key="item.key">
                <a
                  v-if="item.url"
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-normal bg-base-200 border border-base-300 hover:border-base-content/40 text-base-content/85 hover:text-base-content transition-colors select-none"
                  @click.stop
                >
                  <span>{{ item.label }}</span>
                  <svg class="w-2.5 h-2.5 text-base-content/50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <span
                  v-else
                  class="inline-block px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-normal bg-base-200 border border-base-300 text-base-content/80 select-none"
                >
                  {{ item.label }}
                </span>
              </template>
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
import { getCategoryUrl } from '../../constants/category-urls.js'
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
    const parts = String(dateStr).split(/[-/]/)
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      const d = parseInt(parts[2], 10)
      const dt = new Date(y, m - 1, d)
      const mm = String(m).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      const w = WEEKDAYS[dt.getDay()] || ''
      return `${mm}/${dd} (${w})`
    }
  } catch {}
  return dateStr
}

function getRecordCategoryItems(record) {
  if (!record || !record.isInPool) return []
  const cats = record.categories || []
  const tagDict = UI_STRINGS.CATEGORY_TAGS || {}
  const items = []
  const seenLabels = new Set()

  if (cats.length > 0) {
    for (const cat of cats) {
      const label = tagDict[cat] || cat
      if (!label || seenLabels.has(label)) continue
      seenLabels.add(label)
      items.push({
        key: cat,
        label,
        url: getCategoryUrl(cat, props.stock?.market),
      })
    }
  } else if (Array.isArray(record.categoryLabels)) {
    for (const label of record.categoryLabels) {
      if (!label || seenLabels.has(label)) continue
      seenLabels.add(label)
      items.push({
        key: label,
        label,
        url: null,
      })
    }
  }
  return items
}
</script>

