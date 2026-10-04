<template>
  <div
    class="market-banner border rounded-xl p-3.5 transition-all duration-200"
    :class="regimeThemeClass"
  >
    <!-- 載入中骨架 -->
    <div v-if="loading" class="animate-pulse flex flex-col md:flex-row justify-between gap-3">
      <div class="h-6 bg-base-300 rounded w-1/3"></div>
      <div class="flex gap-4">
        <div class="h-6 bg-base-300 rounded w-24"></div>
        <div class="h-6 bg-base-300 rounded w-24"></div>
      </div>
    </div>

    <div v-else class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <!-- 左側：風控燈號判定與說明 -->
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm uppercase px-2 py-0.5 rounded border" :class="regimeBadgeClass">
            {{ regime?.badge || UI_STRINGS.MARKET_BANNER.defaultBadge }}
          </span>
          <span class="font-bold text-sm md:text-base text-base-content">
            {{ regime?.title || UI_STRINGS.MARKET_BANNER.defaultTitle }}
          </span>
        </div>
        <p v-if="regime?.subtitle" class="text-sm text-base-content/80 leading-normal">
          {{ regime.subtitle }}
        </p>
      </div>

      <!-- 右側：加權指數 (TAIEX) 與 櫃買指數 (OTC) 迷你數據卡 -->
      <div class="flex items-center gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-base-300/40 font-numeric text-sm">
        <!-- 加權指數 -->
        <div v-if="taiex" class="flex flex-col items-start md:items-end">
          <div class="text-base-content/80 font-sans text-sm">{{ taiex.name || UI_STRINGS.MARKET_BANNER.taiexName }}</div>
          <div class="flex items-baseline gap-1.5">
            <span class="font-bold text-sm text-base-content">{{ formatIndexPrice(taiex.price) }}</span>
            <span class="font-semibold text-sm" :class="taiex.changePct >= 0 ? 'text-rise' : 'text-fall'">
              {{ taiex.changePct >= 0 ? '+' : '' }}{{ taiex.changePct }}%
            </span>
          </div>
          <div class="text-xs text-base-content/70 flex items-center gap-1.5 flex-wrap">
            <span v-if="taiex.chg5d != null">
              {{ UI_STRINGS.MARKET_BANNER.benchmark5d }} <span :class="taiex.chg5d >= 0 ? 'text-rise' : 'text-fall'" class="font-medium">{{ taiex.chg5d >= 0 ? '+' : '' }}{{ taiex.chg5d }}%</span>
            </span>
            <span v-if="taiex.chg5d != null && taiex.bias20 != null" class="text-base-content/30">·</span>
            <span v-if="taiex.bias20 != null">
              {{ UI_STRINGS.MARKET_BANNER.bias20 }} <span :class="taiex.bias20 >= 0 ? 'text-rise' : 'text-fall'">{{ taiex.bias20 >= 0 ? '+' : '' }}{{ taiex.bias20 }}%</span>
            </span>
          </div>
        </div>

        <!-- 櫃買指數 -->
        <div v-if="otc" class="flex flex-col items-start md:items-end pl-3 border-l border-base-300/40">
          <div class="text-base-content/80 font-sans text-sm">{{ otc.name || UI_STRINGS.MARKET_BANNER.otcName }}</div>
          <div class="flex items-baseline gap-1.5">
            <span class="font-bold text-sm text-base-content">{{ formatIndexPrice(otc.price) }}</span>
            <span class="font-semibold text-sm" :class="otc.changePct >= 0 ? 'text-rise' : 'text-fall'">
              {{ otc.changePct >= 0 ? '+' : '' }}{{ otc.changePct }}%
            </span>
          </div>
          <div class="text-xs text-base-content/70 flex items-center gap-1.5 flex-wrap">
            <span v-if="otc.chg5d != null">
              {{ UI_STRINGS.MARKET_BANNER.benchmark5d }} <span :class="otc.chg5d >= 0 ? 'text-rise' : 'text-fall'" class="font-medium">{{ otc.chg5d >= 0 ? '+' : '' }}{{ otc.chg5d }}%</span>
            </span>
            <span v-if="otc.chg5d != null && otc.bias20 != null" class="text-base-content/30">·</span>
            <span v-if="otc.bias20 != null">
              {{ UI_STRINGS.MARKET_BANNER.bias20 }} <span :class="otc.bias20 >= 0 ? 'text-rise' : 'text-fall'">{{ otc.bias20 >= 0 ? '+' : '' }}{{ otc.bias20 }}%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

const props = defineProps({
  taiex: {
    type: Object,
    default: null,
  },
  otc: {
    type: Object,
    default: null,
  },
  regime: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const regimeThemeClass = computed(() => {
  const code = props.regime?.code
  if (code === 'SAFE') return 'bg-success/5 border-success/30'
  if (code === 'CAUTION') return 'bg-warning/5 border-warning/30'
  if (code === 'DANGER') return 'bg-error/5 border-error/30'
  return 'bg-base-200 border-base-300'
})

const regimeBadgeClass = computed(() => {
  const code = props.regime?.code
  if (code === 'SAFE') return 'text-success border-success/40 bg-success/10'
  if (code === 'CAUTION') return 'text-warning border-warning/40 bg-warning/10'
  if (code === 'DANGER') return 'text-error border-error/40 bg-error/10'
  return 'text-base-content/70 border-base-300 bg-base-300/30'
})

function formatIndexPrice(price) {
  if (price === undefined || price === null || isNaN(price)) return '--'
  return Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>
