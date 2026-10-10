<template>
  <div class="market-banner border border-base-300/80 rounded-xl overflow-hidden bg-base-200/40 shadow-xs min-h-[46px] flex flex-col justify-center">
    <tv-ticker-tape
      :key="isDark ? 'dark' : 'light'"
      symbols="INDEX:TAIEX,TPEX:IX0043"
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
  const SCRIPT_URL = 'https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js'
  if (!document.querySelector(`script[src="${SCRIPT_URL}"]`)) {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = SCRIPT_URL
    script.async = true
    document.head.appendChild(script)
  }
})
</script>

<style scoped>
.market-banner :deep(tv-ticker-tape) {
  display: block;
  width: 100%;
}
</style>
