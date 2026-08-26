<template>
  <!--
    App.vue — 最小骨架
    UI 元件由 Gemini 根據 docs/INTERFACE_CONTRACT.md 實作後接入
  -->
  <div :data-theme="isDark ? 'business' : 'nord'" class="min-h-dvh bg-base-100">

    <!-- Navbar 佔位 —— Gemini 接手後替換 -->
    <header class="sticky top-0 z-40 bg-base-100/80 backdrop-blur border-b border-base-300 h-12 flex items-center px-4">
      <span class="font-bold text-sm text-base-content">台股波段選股 v2</span>
      <button class="btn btn-ghost btn-xs ml-auto" @click="isDark = !isDark">
        {{ isDark ? '☀' : '☾' }}
      </button>
    </header>

    <!-- 主體 -->
    <main class="container mx-auto px-4 py-6 max-w-screen-xl">

      <!-- 資料載入中 -->
      <div v-if="poolLoading" class="flex justify-center py-20">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <!-- 載入錯誤 -->
      <div v-else-if="poolError" class="alert alert-error text-sm">
        資料載入失敗：{{ poolError }}
      </div>

      <!-- 骨架內容：等 Gemini 元件接入 -->
      <div v-else class="text-center py-20 text-base-content/40 text-sm space-y-2">
        <p>資料載入完成 — {{ meta?.totalStocks }} 檔個股</p>
        <p class="text-xs">等待 Gemini UI 元件接入...</p>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useStockPool } from './composables/useStockPool.js'

const isDark = ref(false)
const { meta, loading: poolLoading, error: poolError, loadPool } = useStockPool()

onMounted(() => loadPool())
</script>
