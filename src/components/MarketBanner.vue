<template>
  <div class="market-banner border border-base-300/80 rounded-xl overflow-hidden bg-base-200/40 shadow-xs min-h-[38px] flex flex-col justify-center">
    <tv-ticker-tape
      :key="isDark ? 'dark' : 'light'"
      symbols="INDEX:TAIEX,TPEX:IX0043,FX_IDC:USDTWD"
      item-size="compact"
      :theme="isDark ? 'dark' : 'light'"
      class="w-full"
    ></tv-ticker-tape>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

defineProps({
  isDark: {
    type: Boolean,
    default: false,
  },
})

onMounted(() => {
  const loadScript = () => {
    const SCRIPT_URL = 'https://widgets.tradingview-widget.com/w/zh_TW/tv-ticker-tape.js'
    if (!document.querySelector(`script[src="${SCRIPT_URL}"]`)) {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = SCRIPT_URL
      script.async = true
      document.head.appendChild(script)
    }
  }

  // 避免首頁開啟時外部腳本與第三方連線搶佔主執行緒與資料庫載入資源
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(loadScript, { timeout: 1500 })
  } else {
    setTimeout(loadScript, 200)
  }
})
</script>

<style scoped>
.market-banner :deep(tv-ticker-tape) {
  display: block;
  width: 100%;
  --tv-widget-positive-color: #22ab94;
  --tv-widget-negative-color: #f7525f;
}
</style>
