<template>
  <!-- 電腦端快捷操作列 (緊湊單列，| 分隔) -->
  <div
    v-if="layout === 'desktop'"
    class="flex items-center gap-2.5 text-sm font-normal text-base-content/80 leading-normal pt-0.5"
  >
    <button
      type="button"
      class="hover:text-base-content inline-flex items-center gap-1 transition-colors"
      @click="handleCopy"
    >
      <svg v-if="copied" class="w-3.5 h-3.5 text-base-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
      </svg>
      <span :class="{ 'font-bold text-base-content': copied }">{{ copied ? UI_STRINGS.ACTIONS.copied : UI_STRINGS.ACTIONS.copy }}</span>
    </button>
    <span class="text-base-content/40">|</span>
    <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/institutional-trading`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.chips }}</a>
    <span class="text-base-content/40">·</span>
    <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/bullbear`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.bullbear }}</a>
    <span class="text-base-content/40">·</span>
    <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcn/zcn_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.margin }}</a>
    <span class="text-base-content/40">·</span>
    <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.afterMarket }}</a>
  </div>

  <!-- 手機端快捷操作列 (分兩邊 justify-between，頂部分隔線) -->
  <div
    v-else
    class="flex items-center justify-between pt-2 border-t border-base-300/60 text-sm font-normal text-base-content/80 leading-normal"
  >
    <button
      type="button"
      class="hover:text-base-content inline-flex items-center gap-1 transition-colors"
      @click="handleCopy"
    >
      <svg v-if="copied" class="w-3.5 h-3.5 text-base-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
      </svg>
      <span :class="{ 'font-bold text-base-content': copied }">{{ copied ? UI_STRINGS.ACTIONS.copied : UI_STRINGS.ACTIONS.copy }}</span>
    </button>

    <div class="flex items-center gap-2.5">
      <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/institutional-trading`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
        {{ UI_STRINGS.ACTIONS.chips }}
      </a>
      <span class="text-base-content/40">·</span>
      <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/bullbear`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
        {{ UI_STRINGS.ACTIONS.bullbear }}
      </a>
      <span class="text-base-content/40">·</span>
      <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcn/zcn_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
        {{ UI_STRINGS.ACTIONS.margin }}
      </a>
      <span class="text-base-content/40">·</span>
      <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
        {{ UI_STRINGS.ACTIONS.afterMarket }}
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

const props = defineProps({
  stock: {
    type: Object,
    required: true,
  },
  layout: {
    type: String,
    default: 'mobile',
  },
})

const copied = ref(false)
let copyTimer = null

function handleCopy() {
  const text = `${props.stock.code} ${props.stock.name}`
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 1200)
}
</script>
