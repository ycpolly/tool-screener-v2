<template>
  <!-- 桌機表格的單列個股 -->
  <tr
    class="border-b border-base-200 hover:bg-base-200/60 transition-colors cursor-pointer text-sm"
    @click="$emit('select', stock)"
  >
    <!-- 代號 + 處置標籤 -->
    <td class="font-mono font-semibold text-base-content">
      <div class="flex items-center gap-1.5">
        {{ stock.code }}
        <span v-if="stock.isDisposed" class="badge-disposed">處置</span>
      </div>
    </td>

    <!-- 名稱 + 類別標籤 -->
    <td>
      <div class="flex flex-col gap-0.5">
        <span class="text-base-content text-sm">{{ stock.name }}</span>
        <div class="flex gap-1 flex-wrap">
          <span
            v-for="cat in displayCats"
            :key="cat"
            class="text-[10px] px-1 py-0 rounded bg-base-300 text-base-content/60"
          >
            {{ UI.CATEGORY_TAGS[cat] ?? cat }}
          </span>
        </div>
      </div>
    </td>

    <!-- 現價 -->
    <td class="text-right font-numeric font-semibold text-base-content">
      {{ fmt(stock.price) }}
    </td>

    <!-- 漲跌幅 -->
    <td class="text-right font-numeric font-semibold" :class="changeClass">
      {{ changePct }}
    </td>

    <!-- 成交量 -->
    <td class="text-right font-numeric text-base-content/70 text-xs">
      {{ fmtVol(stock.volume) }}
    </td>

    <!-- 5MA -->
    <td class="text-right font-numeric text-base-content/70 text-xs">
      {{ fmt(stock.ma5) }}
    </td>

    <!-- 月線 -->
    <td class="text-right font-numeric text-base-content/70 text-xs">
      {{ fmt(stock.ma20) }}
    </td>

    <!-- 5MA 乖離 -->
    <td class="text-right font-numeric text-xs" :class="biasClass(bias5)">
      {{ fmtBias(bias5) }}
    </td>

    <!-- 月線乖離 -->
    <td class="text-right font-numeric text-xs" :class="biasClass(bias20)">
      {{ fmtBias(bias20) }}
    </td>

    <!-- KD -->
    <td class="text-center text-xs text-base-content/60">
      <span :title="`K:${stock.kd?.k} D:${stock.kd?.d}`">
        {{ kdLabel }}
      </span>
    </td>

    <!-- Sparkline -->
    <td class="py-1 px-2">
      <Sparkline :data="stock.sparkline" :width="160" :height="36" />
    </td>
  </tr>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS as UI } from '../constants/ui-strings.js'
import Sparkline from './Sparkline.vue'

const props = defineProps({
  stock: { type: Object, required: true },
})
defineEmits(['select'])

// 計算欄位
const bias5 = computed(() => {
  const { price, ma5 } = props.stock
  return ma5 ? ((price - ma5) / ma5) * 100 : 0
})
const bias20 = computed(() => {
  const { price, ma20 } = props.stock
  return ma20 ? ((price - ma20) / ma20) * 100 : 0
})

// 漲跌顏色
const changeClass = computed(() => {
  const p = props.stock.changePct ?? 0
  if (p > 0) return 'text-rise'
  if (p < 0) return 'text-fall'
  return 'text-flat'
})

function biasClass(val) {
  if (val > 0.5) return 'text-rise'
  if (val < -0.5) return 'text-fall'
  return 'text-base-content/60'
}

// 漲跌幅顯示
const changePct = computed(() => {
  const p = props.stock.changePct ?? 0
  return (p >= 0 ? '+' : '') + p.toFixed(2) + '%'
})

// KD 狀態標籤（縮短版）
const kdLabel = computed(() => {
  const k = props.stock.kd?.k ?? 50
  const d = props.stock.kd?.d ?? 50
  const pk = props.stock.kd?.prevK ?? k
  const pd = props.stock.kd?.prevD ?? d
  if (pk < pd && k >= d) return '金叉'
  if (pk > pd && k <= d) return '死叉'
  if (k >= 80) return '過熱'
  if (k < 30) return '低檔'
  if (k < 50) return '中低'
  return '中高'
})

// 顯示前幾個 categories
const displayCats = computed(() =>
  (props.stock.categories ?? []).slice(0, 3)
)

// 顯示篩選出的類別 (最多 3 個)
function fmt(val) {
  if (val == null) return '-'
  return Number(val).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtVol(val) {
  if (!val) return '-'
  if (val >= 10000) return (val / 10000).toFixed(1) + 'w'
  return val.toLocaleString()
}
function fmtBias(val) {
  return (val >= 0 ? '+' : '') + val.toFixed(1) + '%'
}
</script>
