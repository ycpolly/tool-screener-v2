<template>
  <div class="search-sort-bar flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3 w-full select-none">
    <!-- 左側：搜尋輸入框 (手機端 w-full h-10 min-h-10 shrink-0，電腦端 md:flex-1 彈性延伸) -->
    <div
      class="flex items-center w-full md:flex-1 h-10 min-h-10 shrink-0 bg-base-200 border border-base-300 rounded-lg px-3.5 transition-all focus-within:border-base-content/40 focus-within:bg-base-100/90"
    >
      <!-- 左側放大鏡 SVG 圖示 (清晰高辨識度) -->
      <div class="flex items-center text-base-content/70 shrink-0 mr-2.5 pointer-events-none">
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

      <!-- 核心搜尋輸入框 (高度貼合 h-full，無任何亮綠色 focus 框線，最小 text-sm 14px) -->
      <input
        :value="modelValue"
        type="text"
        inputmode="search"
        :placeholder="UI_STRINGS.SEARCH.placeholder"
        class="w-full h-full bg-transparent border-none p-0 text-sm text-base-content placeholder:text-base-content/40 placeholder:text-sm font-medium focus:outline-none focus:ring-0"
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

    <!-- 右側：攤開式排序按鈕組與檢視模式切換 (統一 h-10 40px 高度與 rounded-lg 方形圓角) -->
    <div class="flex items-center gap-1.5 shrink-0 overflow-x-auto py-0.5 no-scrollbar">
      <button
        v-for="opt in sortOptions"
        :key="opt.key"
        type="button"
        class="h-10 px-3 rounded-lg text-sm transition-colors flex items-center gap-1 shrink-0 font-numeric cursor-pointer"
        :class="sortKey === opt.key ? 'bg-base-200 border border-base-300 font-bold text-base-content' : 'text-base-content/75 hover:text-base-content hover:bg-base-200/50'"
        @click="handleToggleSort(opt.key)"
      >
        <span>{{ opt.label }}</span>
        <span v-if="sortKey === opt.key" class="text-xs font-bold font-numeric text-base-content">
          {{ sortDir === 'desc' ? '▼' : '▲' }}
        </span>
      </button>

      <!-- 垂直分隔線 -->
      <span class="w-px h-6 bg-base-300/80 my-auto shrink-0 mx-0.5"></span>

      <!-- 顯示模式切換按鈕 (Icon Toggle，高度等高 h-10 w-10) -->
      <button
        type="button"
        class="h-10 w-10 rounded-lg text-sm transition-colors flex items-center justify-center shrink-0 cursor-pointer"
        :class="isCompact ? 'bg-base-200 border border-base-300 text-base-content font-bold' : 'text-base-content/75 hover:text-base-content hover:bg-base-200/50'"
        :title="isCompact ? UI_STRINGS.DISPLAY_MODE.toggleToFull : UI_STRINGS.DISPLAY_MODE.toggleToCompact"
        :aria-label="isCompact ? UI_STRINGS.DISPLAY_MODE.toggleToFull : UI_STRINGS.DISPLAY_MODE.toggleToCompact"
        @click="$emit('toggle-compact')"
      >
        <!-- 簡約模式時：圖示為切換回完整模式（大卡片方塊） -->
        <svg
          v-if="isCompact"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M4 11h16 M10 11v9" />
        </svg>
        <!-- 完整模式時：圖示為切換至簡約模式（緊湊三行清單） -->
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
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
  isCompact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'update:sortKey', 'update:sortDir', 'toggle-compact'])

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
