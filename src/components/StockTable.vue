<template>
  <div class="w-full">
    <!-- ── 頂部 Header ────────────────────────────────────── -->
    <div class="flex items-center justify-between gap-2 mb-3 px-1">
      <div class="flex items-center gap-2">
        <span class="text-base-content font-semibold text-sm">
          {{ UI.SCREENER.resultCount(results.length) }}
        </span>
        <span v-if="meta" class="text-base-content/40 text-xs hidden sm:inline">
          {{ UI.SCREENER.lastUpdated(meta.updatedAt?.slice(0, 16).replace('T', ' ')) }}
        </span>
      </div>

      <!-- 排序選擇 -->
      <select
        v-model="sortKey"
        class="select select-sm select-ghost text-xs max-w-[120px]"
      >
        <option value="changePct">漲跌幅</option>
        <option value="volume">成交量</option>
        <option value="bias5">5MA乖離</option>
        <option value="bias20">月線乖離</option>
        <option value="kd">KD值</option>
      </select>
    </div>

    <!-- ── 空狀態 ─────────────────────────────────────────── -->
    <div v-if="!results.length" class="text-center py-16 text-base-content/40 text-sm">
      {{ UI.SCREENER.noResult }}
    </div>

    <!-- ── 手機版：卡片列表 (< lg) ─────────────────────────── -->
    <div class="flex flex-col gap-2 lg:hidden">
      <StockCard
        v-for="stock in sortedResults"
        :key="stock.code"
        :stock="stock"
      />
    </div>

    <!-- ── 桌機版：表格 (>= lg) ──────────────────────────── -->
    <div class="hidden lg:block overflow-x-auto rounded-lg border border-base-300">
      <table class="table table-sm w-full">
        <thead>
          <tr class="text-xs text-base-content/50 border-b border-base-300">
            <th class="w-20">{{ UI.STOCK_TABLE.headers.code }}</th>
            <th>{{ UI.STOCK_TABLE.headers.name }}</th>
            <th class="text-right">{{ UI.STOCK_TABLE.headers.price }}</th>
            <th class="text-right">{{ UI.STOCK_TABLE.headers.changePct }}</th>
            <th class="text-right">{{ UI.STOCK_TABLE.headers.volume }}</th>
            <th class="text-right">{{ UI.STOCK_TABLE.headers.ma5 }}</th>
            <th class="text-right">{{ UI.STOCK_TABLE.headers.ma20 }}</th>
            <th class="text-right">{{ UI.STOCK_TABLE.headers.bias5 }}</th>
            <th class="text-right">{{ UI.STOCK_TABLE.headers.bias20 }}</th>
            <th class="text-center w-16">{{ UI.STOCK_TABLE.headers.kd }}</th>
            <th class="text-center w-[168px]">{{ UI.STOCK_TABLE.headers.sparkline }}</th>
          </tr>
        </thead>
        <tbody>
          <StockRow
            v-for="stock in sortedResults"
            :key="stock.code"
            :stock="stock"
          />
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { UI_STRINGS as UI } from '../constants/ui-strings.js'
import StockCard from './StockCard.vue'
import StockRow  from './StockRow.vue'

const props = defineProps({
  results: { type: Array, default: () => [] },
  meta:    { type: Object, default: null },
})

const sortKey = ref('changePct')

const sortedResults = computed(() => {
  const list = [...props.results]
  return list.sort((a, b) => {
    switch (sortKey.value) {
      case 'changePct': return (b.changePct ?? 0) - (a.changePct ?? 0)
      case 'volume':    return (b.volume ?? 0) - (a.volume ?? 0)
      case 'bias5':     return calcBias(b, 'ma5') - calcBias(a, 'ma5')
      case 'bias20':    return calcBias(b, 'ma20') - calcBias(a, 'ma20')
      case 'kd':        return (b.kd?.k ?? 50) - (a.kd?.k ?? 50)
      default:          return 0
    }
  })
})

function calcBias(stock, maKey) {
  const ma = stock[maKey]
  if (!ma || !stock.price) return 0
  return ((stock.price - ma) / ma) * 100
}
</script>
