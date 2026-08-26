<template>
  <!-- 手機版個股卡片 -->
  <div
    class="bg-base-200 rounded-xl p-3 active:scale-[0.99] transition-transform cursor-pointer"
    @click="$emit('select', stock)"
  >
    <!-- 第一行：代號 + 名稱 + 漲跌幅 -->
    <div class="flex items-start justify-between gap-2 mb-2">
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="font-mono font-bold text-base-content text-sm">{{ stock.code }}</span>
          <span class="text-base-content/70 text-sm truncate">{{ stock.name }}</span>
          <span v-if="stock.isDisposed" class="badge-disposed">處置</span>
        </div>
        <!-- 類別標籤 -->
        <div class="flex gap-1 flex-wrap mt-0.5">
          <span
            v-for="cat in displayCats"
            :key="cat"
            class="text-[10px] px-1 rounded bg-base-300 text-base-content/50"
          >
            {{ UI.CATEGORY_TAGS[cat] ?? cat }}
          </span>
        </div>
      </div>

      <!-- 右側：現價 + 漲跌幅 -->
      <div class="flex flex-col items-end shrink-0">
        <span class="font-numeric font-bold text-base-content text-base leading-tight">
          {{ fmt(stock.price) }}
        </span>
        <span class="font-numeric font-semibold text-sm" :class="changeClass">
          {{ changePct }}
        </span>
      </div>
    </div>

    <!-- 第二行：均線與量能數據 -->
    <div class="grid grid-cols-4 gap-x-2 gap-y-0.5 text-xs mb-2">
      <DataCell label="5MA"   :value="fmt(stock.ma5)" />
      <DataCell label="月線"  :value="fmt(stock.ma20)" />
      <DataCell label="5MA乖" :value="fmtBias(bias5)"  :colorClass="biasClass(bias5)" />
      <DataCell label="月乖"  :value="fmtBias(bias20)" :colorClass="biasClass(bias20)" />
      <DataCell label="量(張)" :value="fmtVol(stock.volume)" />
      <DataCell label="均量5" :value="fmtVol(stock.vMa5)" />
      <DataCell label="KD"    :value="kdLabel" />
      <DataCell label="K值"   :value="stock.kd?.k?.toFixed(0) ?? '-'" />
    </div>

    <!-- 第三行：Sparkline -->
    <div class="flex justify-end">
      <Sparkline :data="stock.sparkline" :width="160" :height="36" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS as UI } from '../constants/ui-strings.js'
import Sparkline from './Sparkline.vue'

// 小型資料格輔助元件（只在這裡用）
const DataCell = {
  props: { label: String, value: String, colorClass: { type: String, default: 'text-base-content/70' } },
  template: `<div class="flex flex-col"><span class="text-base-content/40 text-[9px] leading-none mb-0.5">{{ label }}</span><span class="font-numeric" :class="colorClass">{{ value }}</span></div>`,
}

const props = defineProps({
  stock: { type: Object, required: true },
})
defineEmits(['select'])

const bias5 = computed(() => {
  const { price, ma5 } = props.stock
  return ma5 ? ((price - ma5) / ma5) * 100 : 0
})
const bias20 = computed(() => {
  const { price, ma20 } = props.stock
  return ma20 ? ((price - ma20) / ma20) * 100 : 0
})

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

const changePct = computed(() => {
  const p = props.stock.changePct ?? 0
  return (p >= 0 ? '+' : '') + p.toFixed(2) + '%'
})

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

const displayCats = computed(() => (props.stock.categories ?? []).slice(0, 3))

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
