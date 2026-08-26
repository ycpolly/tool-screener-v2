<template>
  <div :data-theme="isDark ? 'business' : 'nord'" class="min-h-dvh bg-base-100">

    <!-- ── 頂部 Navbar ──────────────────────────────────────── -->
    <header class="sticky top-0 z-40 bg-base-100/90 backdrop-blur border-b border-base-300">
      <div class="container mx-auto px-3 max-w-screen-xl">
        <div class="flex items-center justify-between h-12">

          <!-- Logo / 標題 -->
          <div class="flex items-center gap-2">
            <span class="font-bold text-base-content text-sm tracking-tight">
              {{ UI.APP.title }}
            </span>
            <!-- 大盤燈號 badge（小版本，header 用）-->
            <span
              v-if="market?.regime"
              class="text-[10px] px-1.5 py-0.5 rounded font-medium"
              :class="regimeBadgeClass"
            >
              {{ market.regime.badge }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <!-- 即時更新按鈕 -->
            <button
              class="btn btn-primary btn-xs"
              :disabled="quotesLoading"
              @click="handleFetchQuotes"
            >
              {{ quotesLoading ? UI.SCREENER.updatingBtn : UI.SCREENER.updateBtn }}
            </button>

            <!-- Light/Dark 切換 -->
            <button class="btn btn-ghost btn-xs px-2" @click="isDark = !isDark">
              <span v-if="isDark" class="text-base">☀</span>
              <span v-else class="text-base">☾</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- ── 主體 ─────────────────────────────────────────────── -->
    <main class="container mx-auto px-3 py-4 max-w-screen-xl">

      <!-- 載入中 -->
      <div v-if="poolLoading" class="flex justify-center py-20">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <!-- 載入錯誤 -->
      <div v-else-if="poolError" class="alert alert-error text-sm">
        資料載入失敗：{{ poolError }}
      </div>

      <!-- 主內容 -->
      <template v-else>
        <!-- 最後更新時間（手機版） -->
        <p v-if="meta" class="text-xs text-base-content/40 mb-3 sm:hidden">
          {{ UI.SCREENER.lastUpdated(meta.updatedAt?.slice(0, 16).replace('T', ' ')) }}
        </p>

        <!-- 選股結果表格 -->
        <StockTable
          :results="results"
          :meta="meta"
        />
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { UI_STRINGS as UI } from './constants/ui-strings.js'
import { useStockPool } from './composables/useStockPool.js'
import { useScreener } from './composables/useScreener.js'
import { useRealtimeQuotes } from './composables/useRealtimeQuotes.js'
import StockTable from './components/StockTable.vue'

// ── Theme ──────────────────────────────────────────────────
const isDark = ref(false)

// ── 資料層 ──────────────────────────────────────────────────
const { stocks, market, meta, loading: poolLoading, error: poolError, loadPool } = useStockPool()
const { results } = useScreener(stocks)
const { loading: quotesLoading, fetchQuotes } = useRealtimeQuotes()

// ── 大盤燈號樣式 ────────────────────────────────────────────
const regimeBadgeClass = computed(() => {
  const code = market.value?.regime?.code
  if (code === 'DANGER')  return 'bg-error/20 text-error'
  if (code === 'CAUTION') return 'bg-warning/20 text-warning'
  return 'bg-success/15 text-success'
})

// ── 即時行情更新 ────────────────────────────────────────────
async function handleFetchQuotes() {
  const codes = stocks.value.map(s => s.code)
  await fetchQuotes(codes)
}

// ── 初始化 ─────────────────────────────────────────────────
onMounted(async () => {
  await loadPool()
})
</script>
