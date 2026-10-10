<template>
  <BaseStockModal
    :is-open="isOpen"
    :title="UI_STRINGS.CURRENCY_MODAL?.code || 'USD/TWD'"
    :title-suffix="UI_STRINGS.CURRENCY_MODAL?.titleSuffix || '即時匯率'"
    :close-aria-label="UI_STRINGS.CURRENCY_MODAL?.closeBtn || '關閉'"
    box-class="max-w-xl"
    @close="$emit('close')"
  >
    <template #header-title>
      <h3 class="text-base sm:text-lg font-bold text-base-content flex items-center gap-1.5 truncate">
        <span class="font-numeric font-bold text-primary">{{ UI_STRINGS.CURRENCY_MODAL?.code || 'USD/TWD' }}</span>
        <span class="truncate">{{ UI_STRINGS.CURRENCY_MODAL?.title || '美元兌台幣即時匯率' }}</span>
      </h3>
    </template>

    <template #header-actions>
      <!-- 重新整理 iframe 按鈕 (僅更新 iframe，無須重新載入網站) -->
      <button
        type="button"
        class="btn btn-sm btn-ghost btn-circle text-base-content/70 hover:text-base-content"
        :title="UI_STRINGS.CURRENCY_MODAL?.refreshBtn || '重新整理匯率'"
        :aria-label="UI_STRINGS.CURRENCY_MODAL?.refreshBtn || '重新整理匯率'"
        @click="refreshIframe"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 transition-transform duration-500"
          :class="{ 'animate-spin': isRefreshing }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </template>

    <!-- 內容主體 -->
    <div class="flex-1 flex flex-col space-y-3 min-h-0">
      <!-- 1. 匯率與台股連動觀念提示卡 -->
      <div class="bg-base-200/50 border border-base-300/70 rounded-xl p-2.5 text-xs space-y-1 shrink-0">
        <div class="font-bold text-base-content flex items-center gap-1">
          <span>{{ UI_STRINGS.CURRENCY_MODAL?.impactTitle || '匯率與台股連動觀念' }}</span>
        </div>
        <div class="text-[11px] text-base-content/70 space-y-0.5 leading-relaxed">
          <p>{{ UI_STRINGS.CURRENCY_MODAL?.impactRises }}</p>
          <p>{{ UI_STRINGS.CURRENCY_MODAL?.impactFalls }}</p>
        </div>
      </div>

      <!-- 2. Investing.com 即時貨幣交叉匯率嵌入容器 -->
      <div class="border border-base-300/70 rounded-xl overflow-hidden bg-base-200/30 flex-1 flex flex-col min-h-[300px] h-[340px]">
        <iframe
          :key="iframeKey"
          :src="widgetSrc"
          class="w-full flex-1 border-0"
          frameborder="0"
          allowtransparency="true"
          marginwidth="0"
          marginheight="0"
        ></iframe>

        <!-- 來源出處與版權資訊 -->
        <div class="px-3 py-1.5 bg-base-200/80 text-[11px] text-base-content/60 border-t border-base-300/50 flex items-center justify-between shrink-0 font-sans">
          <span>
            Powered by
            <a
              href="https://www.investing.com?utm_source=WMT&utm_medium=referral&utm_campaign=LIVE_CURRENCY_X_RATES&utm_content=Footer%20Link"
              target="_blank"
              rel="nofollow noopener"
              class="font-medium hover:underline text-primary"
            >
              Investing.com
            </a>
          </span>

          <a
            :href="UI_STRINGS.CURRENCY_MODAL?.sourceUrl || 'https://www.investing.com/webmaster-tools/live-currency-cross-rates'"
            target="_blank"
            rel="nofollow noopener"
            class="text-[10px] text-base-content/50 hover:underline hover:text-base-content"
          >
            {{ UI_STRINGS.CURRENCY_MODAL?.sourceName || '來源：Investing.com' }}
          </a>
        </div>
      </div>
    </div>
  </BaseStockModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UI_STRINGS } from '../../constants/ui-strings.js'
import BaseStockModal from './BaseStockModal.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  isDark: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['close'])

const iframeKey = ref(0)
const isRefreshing = ref(false)

const widgetSrc = computed(() => {
  const theme = props.isDark ? 'darkTheme' : 'lightTheme'
  return `https://www.widgets.investing.com/live-currency-cross-rates?theme=${theme}&pairs=2206`
})

function refreshIframe() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  iframeKey.value++
  setTimeout(() => {
    isRefreshing.value = false
  }, 600)
}
</script>
