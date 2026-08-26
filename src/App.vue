<template>
  <div :data-theme="isDark ? 'business' : 'nord'" class="min-h-dvh bg-base-100 text-base-content antialiased flex flex-col">
    <!-- 頂部 Navbar -->
    <header class="sticky top-0 z-40 bg-base-100/90 backdrop-blur border-b border-base-300 h-13 flex items-center px-4 md:px-6">
      <div class="flex items-baseline gap-2.5">
        <h1 class="font-bold text-base md:text-lg tracking-tight text-base-content">
          {{ UI_STRINGS.APP.title }}
        </h1>
        <span class="text-xs text-base-content/50 hidden sm:inline-block font-medium">
          {{ UI_STRINGS.APP.tagline }}
        </span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <ThemeToggle :is-dark="isDark" @toggle="toggleTheme" />
      </div>
    </header>

    <!-- 主體內容容器 (Mobile-first, max-w-screen-xl) -->
    <main class="container mx-auto px-3 sm:px-4 py-4 md:py-6 max-w-screen-xl space-y-4 flex-1">
      <!-- 錯誤狀態 -->
      <div v-if="poolError" class="alert alert-error text-xs md:text-sm">
        <span>資料載入失敗：{{ poolError }}</span>
        <button class="btn btn-xs btn-outline" @click="loadPool">重試</button>
      </div>

      <!-- 核心工作區 -->
      <template v-else>
        <!-- 1. 大盤多空風控橫幅 -->
        <MarketBanner
          :taiex="market?.taiex"
          :otc="market?.otc"
          :regime="market?.regime"
          :loading="poolLoading"
        />

        <!-- 2. 選股條件控制面板 -->
        <ScreenerPanel
          :modes="modes"
          :active-mode="activeMode"
          :params="params"
          @update:active-mode="setMode"
          @update:params="params = $event"
          @reset="handleResetParams"
        />

        <!-- 3. 選股結果列表 (卡片 / 自適應佈局) -->
        <StockTable
          :stocks="results"
          :loading="poolLoading"
          :meta="meta"
          @select="handleSelectStock"
          @open-risk-modal="handleOpenRiskModal"
        />
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { UI_STRINGS } from './constants/ui-strings.js'
import { useStockPool } from './composables/useStockPool.js'
import { useScreener } from './composables/useScreener.js'

import ThemeToggle from './components/ThemeToggle.vue'
import MarketBanner from './components/MarketBanner.vue'
import ScreenerPanel from './components/ScreenerPanel.vue'
import StockTable from './components/StockTable.vue'

const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('tool_theme', isDark.value ? 'business' : 'nord')
  document.documentElement.setAttribute('data-theme', isDark.value ? 'business' : 'nord')
}

// 載入資料池與篩選狀態
const { stocks, market, meta, loading: poolLoading, error: poolError, loadPool } = useStockPool()
const { activeMode, params, results, modes, setMode } = useScreener(stocks)

function handleResetParams() {
  setMode(activeMode.value)
}

function handleSelectStock(stock) {
  console.log('[Stock Selected]', stock.code, stock.name)
}

function handleOpenRiskModal(stock) {
  console.log('[Open Risk Modal]', stock.code, stock.name)
}

onMounted(() => {
  const savedTheme = localStorage.getItem('tool_theme')
  if (savedTheme) {
    isDark.value = savedTheme === 'business'
  } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    isDark.value = true
  }
  document.documentElement.setAttribute('data-theme', isDark.value ? 'business' : 'nord')

  loadPool()
})
</script>
