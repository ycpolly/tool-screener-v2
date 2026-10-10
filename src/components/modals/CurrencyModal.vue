<template>
  <BaseStockModal
    :is-open="isOpen"
    :title="UI_STRINGS.CURRENCY_MODAL?.code || 'USD/TWD'"
    :title-suffix="UI_STRINGS.CURRENCY_MODAL?.titleSuffix || '即時匯率走勢'"
    :close-aria-label="UI_STRINGS.CURRENCY_MODAL?.closeBtn || '關閉'"
    box-class="max-w-2xl sm:max-w-3xl"
    @close="$emit('close')"
  >
    <template #header-title>
      <h3 class="text-base sm:text-lg font-bold text-base-content flex items-center gap-1.5 truncate">
        <span class="font-numeric font-bold text-base-content">{{ UI_STRINGS.CURRENCY_MODAL?.code || 'USD/TWD' }}</span>
        <span class="text-base-content/80 font-medium text-xs sm:text-sm shrink-0">· {{ UI_STRINGS.CURRENCY_MODAL?.title || '美元兌台幣即時匯率' }}</span>
      </h3>
    </template>

    <template #header-actions>
      <!-- 重新整理走勢圖按鈕 (僅更新走勢圖，不重載整個網站) -->
      <button
        type="button"
        class="btn btn-sm btn-ghost btn-circle text-base-content/70 hover:text-base-content"
        :title="UI_STRINGS.CURRENCY_MODAL?.refreshBtn || '重新整理走勢圖'"
        :aria-label="UI_STRINGS.CURRENCY_MODAL?.refreshBtn || '重新整理走勢圖'"
        @click="refreshWidget"
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
      <!-- 1. 匯率與台股連動觀念提示卡 (常規高對比，避免淺薄荷綠與琥珀色) -->
      <div class="bg-base-200/60 border border-base-300/80 rounded-xl p-2.5 text-xs space-y-1 shrink-0">
        <div class="font-bold text-base-content flex items-center gap-1">
          <span>{{ UI_STRINGS.CURRENCY_MODAL?.impactTitle || '匯率與台股連動觀念' }}</span>
        </div>
        <div class="text-[11px] text-base-content/80 space-y-0.5 leading-relaxed">
          <p>{{ UI_STRINGS.CURRENCY_MODAL?.impactRises }}</p>
          <p>{{ UI_STRINGS.CURRENCY_MODAL?.impactFalls }}</p>
        </div>
      </div>

      <!-- 2. TradingView Symbol Overview 嵌入容器 -->
      <div
        ref="widgetContainer"
        class="border border-base-300/70 rounded-xl overflow-hidden bg-base-200/30 flex-1 w-full min-h-[380px] h-[430px] sm:h-[480px]"
      ></div>
    </div>
  </BaseStockModal>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
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

const widgetContainer = ref(null)
const isRefreshing = ref(false)

function loadWidget() {
  if (!widgetContainer.value) return
  widgetContainer.value.innerHTML = ''

  const wrapper = document.createElement('div')
  wrapper.className = 'tradingview-widget-container h-full w-full flex flex-col'

  const widgetDiv = document.createElement('div')
  widgetDiv.className = 'tradingview-widget-container__widget flex-1 w-full min-h-0'
  wrapper.appendChild(widgetDiv)

  const copyrightDiv = document.createElement('div')
  copyrightDiv.className = 'tradingview-widget-copyright px-2.5 py-1 text-[11px] text-base-content/60 border-t border-base-300/50 flex items-center justify-between shrink-0 font-sans'
  copyrightDiv.innerHTML = `
    <a href="https://tw.tradingview.com/symbols/USDTWD/?exchange=FX_IDC" rel="noopener nofollow" target="_blank" class="hover:underline text-base-content/80 font-medium">USDTWD 匯率走勢</a>
    <span class="trademark text-base-content/50">由 TradingView 提供</span>
  `
  wrapper.appendChild(copyrightDiv)

  const config = {
    lineWidth: 2,
    lineType: 0,
    chartType: 'area',
    fontColor: 'rgb(106, 109, 120)',
    gridLineColor: props.isDark ? 'rgba(242, 242, 242, 0.06)' : 'rgba(42, 42, 42, 0.06)',
    volumeUpColor: 'rgba(34, 171, 148, 0.5)',
    volumeDownColor: 'rgba(247, 82, 95, 0.5)',
    backgroundColor: props.isDark ? '#0F0F0F' : '#FFFFFF',
    widgetFontColor: props.isDark ? '#DBDBDB' : '#1A1A1A',
    upColor: '#22ab94',
    downColor: '#f7525f',
    borderUpColor: '#22ab94',
    borderDownColor: '#f7525f',
    wickUpColor: '#22ab94',
    wickDownColor: '#f7525f',
    colorTheme: props.isDark ? 'dark' : 'light',
    isTransparent: false,
    locale: 'zh_TW',
    chartOnly: false,
    scalePosition: 'right',
    scaleMode: 'Normal',
    fontFamily: '-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif',
    valuesTracking: '1',
    changeMode: 'price-and-percent',
    symbols: [
      ['FX_IDC:USDTWD|3M'],
    ],
    dateRanges: [
      '1d|1',
      '1m|30',
      '3m|60',
      '12m|1D',
      '60m|1W',
      'all|1M',
    ],
    fontSize: '10',
    headerFontSize: 'medium',
    autosize: true,
    width: '100%',
    height: '100%',
    noTimeScale: false,
    hideDateRanges: false,
    hideMarketStatus: false,
    hideSymbolLogo: false,
  }

  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'
  script.async = true
  script.textContent = JSON.stringify(config)
  wrapper.appendChild(script)

  widgetContainer.value.appendChild(wrapper)
}

function refreshWidget() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  loadWidget()
  setTimeout(() => {
    isRefreshing.value = false
  }, 600)
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => {
        loadWidget()
      })
    }
  },
  { immediate: true },
)

watch(
  () => props.isDark,
  () => {
    if (props.isOpen) {
      nextTick(() => {
        loadWidget()
      })
    }
  },
)

onMounted(() => {
  if (props.isOpen) {
    nextTick(() => {
      loadWidget()
    })
  }
})
</script>
