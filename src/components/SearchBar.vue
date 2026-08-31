<template>
  <div class="search-sort-bar flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3 w-full select-none">
    <!-- 左側：搜尋輸入框 (統一 h-9 36px 高度與 rounded-lg 方形圓角) -->
    <div
      class="flex items-center flex-1 bg-base-200 border border-base-300 rounded-lg px-3 h-9 transition-all focus-within:border-base-content/40 focus-within:bg-base-100/90"
    >
      <!-- 左側放大鏡 SVG 圖示 (清晰高辨識度) -->
      <div class="flex items-center text-base-content/70 shrink-0 mr-2 pointer-events-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <!-- 核心搜尋輸入框 (無任何亮綠色 focus 框線，最小 text-sm 14px) -->
      <input
        :value="modelValue"
        type="text"
        inputmode="search"
        :placeholder="UI_STRINGS.SEARCH.placeholder"
        class="w-full bg-transparent border-none p-0 text-sm text-base-content placeholder:text-base-content/40 placeholder:text-sm font-medium focus:outline-none focus:ring-0"
        @input="$emit('update:modelValue', $event.target.value)"
        @keydown.esc="$emit('update:modelValue', '')"
      />

      <!-- 一鍵清除按鈕 (右側，僅在有輸入內容時顯示) -->
      <button
        v-if="modelValue"
        type="button"
        class="flex items-center text-base-content/50 hover:text-base-content transition-colors shrink-0 ml-2 cursor-pointer"
        :title="UI_STRINGS.SEARCH.clear"
        @click="$emit('update:modelValue', '')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 rounded-full bg-base-300 p-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- 右側：攤開式排序按鈕組 (統一 h-9 36px 高度與 rounded-lg 方形圓角) -->
    <div class="flex items-center gap-1.5 shrink-0 overflow-x-auto py-0.5 no-scrollbar">
      <button
        v-for="opt in sortOptions"
        :key="opt.key"
        type="button"
        class="h-9 px-2.5 rounded-lg text-sm transition-colors flex items-center gap-1 shrink-0 font-numeric cursor-pointer"
        :class="sortKey === opt.key ? 'bg-base-200 border border-base-300 font-bold text-base-content' : 'text-base-content/75 hover:text-base-content hover:bg-base-200/50'"
        @click="handleToggleSort(opt.key)"
      >
        <span>{{ opt.label }}</span>
        <span v-if="sortKey === opt.key" class="text-xs font-bold font-numeric text-base-content">
          {{ sortDir === 'desc' ? '▼' : '▲' }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { UI_STRINGS } from '../constants/ui-strings.js'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  sortKey: {
    type: String,
    default: 'changePct',
  },
  sortDir: {
    type: String,
    default: 'desc',
  },
})

const emit = defineEmits(['update:modelValue', 'update:sortKey', 'update:sortDir'])

const sortOptions = [
  { key: 'changePct', label: UI_STRINGS.STOCK_TABLE.headers.changePct || '漲跌幅' },
  { key: 'volume', label: UI_STRINGS.STOCK_TABLE.headers.volume || '成交量' },
  { key: 'bias20', label: UI_STRINGS.STOCK_TABLE.headers.bias20 || '月乖離' },
  { key: 'code', label: UI_STRINGS.STOCK_TABLE.headers.code || '代號' },
]

function handleToggleSort(key) {
  if (props.sortKey === key) {
    const nextDir = props.sortDir === 'desc' ? 'asc' : 'desc'
    emit('update:sortDir', nextDir)
  } else {
    emit('update:sortKey', key)
    emit('update:sortDir', key === 'code' ? 'asc' : 'desc')
  }
}
</script>
