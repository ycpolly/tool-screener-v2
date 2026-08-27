<template>
  <div
    class="stock-card bg-base-200 border border-base-300 rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:border-base-content/20"
  >
    <!-- ============================================================
         手機端佈局 (< 1024px)：由上而下 5 層自然排列，字體寬裕不擠壓
         ============================================================ -->
    <div class="block lg:hidden space-y-3">
      <!-- 第 1 層：代號、名稱、即時現價與漲跌幅 -->
      <div class="flex items-baseline justify-between gap-2">
        <div class="flex items-baseline gap-2 min-w-0">
          <span class="font-numeric font-bold text-lg text-base-content tracking-wide">{{ stock.code }}</span>
          <span class="font-bold text-base text-base-content truncate">{{ stock.name }}</span>
          <span v-if="stock.isDisposed" class="font-bold text-xs text-error tracking-tight">
            [{{ UI_STRINGS.SCREENER.disposed }}]
          </span>
        </div>
        <div class="flex items-baseline gap-1.5 shrink-0 font-numeric">
          <span class="text-xl font-bold" :class="priceColorClass">
            {{ formatNumber(stock.price) }}
          </span>
          <span class="text-sm font-semibold" :class="priceColorClass">
            {{ formatChange(stock.change, stock.changePct) }}
          </span>
        </div>
      </div>

      <!-- 第 2 層：標籤純文字 (弱化中性灰，無彩色 Badge 噪音) -->
      <div v-if="formattedCategories" class="text-xs text-base-content/60 font-medium tracking-wide">
        {{ formattedCategories }}
      </div>

      <!-- ★ 預留槽位 A：天花板關卡價與預期純利 (點擊觸發 RiskModal) -->
      <div
        v-if="ceilingInfo"
        class="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-base-300/40 cursor-pointer hover:bg-base-300/70 transition-colors"
        @click="$emit('openRiskModal', stock)"
      >
        <span class="text-base-content/70">
          {{ ceilingInfo.type }} <span class="font-numeric font-bold text-base-content">{{ formatNumber(ceilingInfo.price) }}</span>
        </span>
        <span class="font-bold" :class="ceilingInfo.netProfitPct >= 0 ? 'text-rise' : 'text-base-content/70'">
          {{ UI_STRINGS.METRICS.expectedProfit }} {{ ceilingInfo.netProfitPct >= 0 ? '+' : '' }}{{ ceilingInfo.netProfitPct }}%
          <span class="text-base-content/40 ml-1">↗</span>
        </span>
      </div>

      <!-- 第 3 層：Sparkline 10日折線圖 + KD 動能指標 -->
      <div class="space-y-1.5 py-1">
        <div class="w-full flex items-center justify-center">
          <Sparkline :data="stock.sparkline" />
        </div>
        <div class="flex items-center justify-between text-xs text-base-content/70 font-numeric px-1">
          <span>{{ UI_STRINGS.METRICS.kd }} <strong class="text-base-content font-bold">{{ stock.kd?.k }} / {{ stock.kd?.d }}</strong></span>
          <span class="font-semibold text-base-content/80">{{ kdStatusText }}</span>
        </div>
      </div>

      <!-- 第 4 層：左右 3 排完美對稱網格 (均線 vs 量能) -->
      <div class="grid grid-cols-2 gap-3 pt-2 border-t border-base-300/60 font-numeric text-xs">
        <!-- 左欄：均線與乖離率 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.ma5 }}</span>
            <span>
              <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma5) }}</strong>
              <span :class="bias5ColorClass">({{ formatBias(bias5) }})</span>
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.ma10 }}</span>
            <span>
              <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma10) }}</strong>
              <span class="text-base-content/70">({{ formatBias(bias10) }})</span>
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.ma20 }}</span>
            <span>
              <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma20) }}</strong>
              <span :class="bias20ColorClass">({{ formatBias(bias20) }})</span>
            </span>
          </div>
        </div>

        <!-- 右欄：當日量能與均量縮放比對 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.volume }}</span>
            <strong class="font-bold text-base-content">{{ stock.volume?.toLocaleString() }}</strong>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.mv5 }}</span>
            <span class="font-bold text-base-content">{{ stock.vMa5?.toLocaleString() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.mv10 }}</span>
            <span class="font-bold text-base-content">{{ stock.vMa10?.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- ★ 預留槽位 B：篩選判讀純文字結果 -->
      <div
        v-if="filterEvaluationText"
        class="text-xs text-base-content/60 leading-relaxed pt-1.5 border-t border-base-300/40"
      >
        {{ filterEvaluationText }}
      </div>

      <!-- 第 5 層：極簡快捷操作列 -->
      <div class="flex items-center justify-between pt-2 border-t border-base-300/60 text-xs text-base-content/70">
        <button
          type="button"
          class="font-medium hover:text-base-content inline-flex items-center gap-1 transition-colors"
          @click="handleCopy"
        >
          <svg v-if="copied" class="w-3.5 h-3.5 text-base-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span>{{ copied ? UI_STRINGS.ACTIONS.copied : UI_STRINGS.ACTIONS.copy }}</span>
        </button>

        <div class="flex items-center gap-2.5">
          <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/institutional-trading`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
            {{ UI_STRINGS.ACTIONS.chips }}
          </a>
          <span class="text-base-content/20">·</span>
          <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/bullbear`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
            {{ UI_STRINGS.ACTIONS.bullbear }}
          </a>
          <span class="text-base-content/20">·</span>
          <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcn/zcn_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
            {{ UI_STRINGS.ACTIONS.margin }}
          </a>
          <span class="text-base-content/20">·</span>
          <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
            {{ UI_STRINGS.ACTIONS.afterMarket }}
          </a>
        </div>
      </div>
    </div>

    <!-- ============================================================
         電腦端佈局 (>= 1024px)：水平 3 欄式寬扁卡片 (左: 走勢KD | 中: 報價操作 | 右: 均線量能)
         ============================================================ -->
    <div class="hidden lg:grid lg:grid-cols-12 lg:gap-5 lg:items-center">
      <!-- 左欄 (4/12)：走勢圖 + KD 指標 (移至最左側，避免斜視) -->
      <div class="lg:col-span-4 space-y-1.5 pr-2">
        <div class="w-full flex items-center justify-center">
          <Sparkline :data="stock.sparkline" />
        </div>
        <div class="flex items-center justify-between text-xs text-base-content/70 font-numeric px-1">
          <span>{{ UI_STRINGS.METRICS.kd }} <strong class="text-base-content font-bold">{{ stock.kd?.k }} / {{ stock.kd?.d }}</strong></span>
          <span class="font-semibold text-base-content/80">{{ kdStatusText }}</span>
        </div>
      </div>

      <!-- 中欄 (4/12)：代號、名稱、報價、標籤與快捷操作 -->
      <div class="lg:col-span-4 space-y-2 px-3 border-l border-r border-base-300/60">
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-2">
            <span class="font-numeric font-bold text-lg text-base-content">{{ stock.code }}</span>
            <span class="font-bold text-base text-base-content">{{ stock.name }}</span>
            <span v-if="stock.isDisposed" class="font-bold text-xs text-error">
              [{{ UI_STRINGS.SCREENER.disposed }}]
            </span>
          </div>
          <div class="flex items-baseline gap-1.5 font-numeric">
            <span class="text-xl font-bold" :class="priceColorClass">{{ formatNumber(stock.price) }}</span>
            <span class="text-sm font-semibold" :class="priceColorClass">{{ formatChange(stock.change, stock.changePct) }}</span>
          </div>
        </div>

        <div v-if="formattedCategories" class="text-xs text-base-content/60 font-medium">
          {{ formattedCategories }}
        </div>

        <!-- ★ 預留槽位 A (電腦端) -->
        <div
          v-if="ceilingInfo"
          class="flex items-center justify-between text-xs py-1 px-2 rounded bg-base-300/40 cursor-pointer hover:bg-base-300/70 transition-colors"
          @click="$emit('openRiskModal', stock)"
        >
          <span class="text-base-content/70">
            {{ ceilingInfo.type }} <span class="font-numeric font-bold text-base-content">{{ formatNumber(ceilingInfo.price) }}</span>
          </span>
          <span class="font-bold" :class="ceilingInfo.netProfitPct >= 0 ? 'text-rise' : 'text-base-content/70'">
            {{ UI_STRINGS.METRICS.expectedProfit }} {{ ceilingInfo.netProfitPct >= 0 ? '+' : '' }}{{ ceilingInfo.netProfitPct }}% ↗
          </span>
        </div>

        <!-- 快捷操作列 -->
        <div class="flex items-center gap-2.5 text-xs text-base-content/70 pt-0.5">
          <button
            type="button"
            class="font-medium hover:text-base-content inline-flex items-center gap-1 transition-colors"
            @click="handleCopy"
          >
            <svg v-if="copied" class="w-3.5 h-3.5 text-base-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ copied ? UI_STRINGS.ACTIONS.copied : UI_STRINGS.ACTIONS.copy }}</span>
          </button>
          <span class="text-base-content/20">|</span>
          <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/institutional-trading`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.chips }}</a>
          <span class="text-base-content/20">·</span>
          <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/bullbear`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.bullbear }}</a>
          <span class="text-base-content/20">·</span>
          <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcn/zcn_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.margin }}</a>
          <span class="text-base-content/20">·</span>
          <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.afterMarket }}</a>
        </div>
      </div>

      <!-- 右欄 (4/12)：均線與量能量化比對 -->
      <div class="lg:col-span-4 grid grid-cols-2 gap-3 font-numeric text-xs pl-2">
        <!-- 均線組 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.ma5 }}</span>
            <span>
              <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma5) }}</strong>
              <span :class="bias5ColorClass">({{ formatBias(bias5) }})</span>
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.ma10 }}</span>
            <span>
              <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma10) }}</strong>
              <span class="text-base-content/70">({{ formatBias(bias10) }})</span>
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.ma20 }}</span>
            <span>
              <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma20) }}</strong>
              <span :class="bias20ColorClass">({{ formatBias(bias20) }})</span>
            </span>
          </div>
        </div>

        <!-- 量能組 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.volume }}</span>
            <strong class="font-bold text-base-content">{{ stock.volume?.toLocaleString() }}</strong>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.mv5 }}</span>
            <span class="font-bold text-base-content">{{ stock.vMa5?.toLocaleString() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60">{{ UI_STRINGS.METRICS.mv10 }}</span>
            <span class="font-bold text-base-content">{{ stock.vMa10?.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- ★ 預留槽位 B (電腦端通欄底列) -->
      <div
        v-if="filterEvaluationText"
        class="lg:col-span-12 text-xs text-base-content/60 pt-2 mt-1 border-t border-base-300/40"
      >
        {{ filterEvaluationText }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'
import Sparkline from './Sparkline.vue'

const props = defineProps({
  stock: {
    type: Object,
    required: true,
  },
  ceilingProfit: {
    type: Object,
    default: null,
  },
  filterEvaluation: {
    type: Object,
    default: null,
  },
})

defineEmits(['select', 'openRiskModal'])

const copied = ref(false)
let copyTimer = null

function handleCopy() {
  const text = `${props.stock.code} ${props.stock.name}`
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 1200)
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '--'
  return Number(num).toFixed(2).replace(/\.00$/, '')
}

function formatChange(change, changePct) {
  if (changePct === null || changePct === undefined || isNaN(changePct)) return '--'
  const sign = changePct > 0 ? '+' : ''
  const chg = change !== undefined && change !== null ? ` (${sign}${formatNumber(change)})` : ''
  return `${sign}${Number(changePct).toFixed(2)}%${chg}`
}

function formatBias(bias) {
  if (bias === null || bias === undefined || isNaN(bias)) return '--'
  const sign = bias > 0 ? '+' : ''
  return `${sign}${Number(bias).toFixed(1)}%`
}

const priceColorClass = computed(() => {
  const pct = props.stock.changePct ?? 0
  if (pct > 0) return 'text-rise'
  if (pct < 0) return 'text-fall'
  return 'text-flat'
})

const bias5 = computed(() => {
  if (!props.stock.price || !props.stock.ma5) return 0
  return Number((((props.stock.price - props.stock.ma5) / props.stock.ma5) * 100).toFixed(1))
})

const bias10 = computed(() => {
  if (!props.stock.price || !props.stock.ma10) return 0
  return Number((((props.stock.price - props.stock.ma10) / props.stock.ma10) * 100).toFixed(1))
})

const bias20 = computed(() => {
  if (!props.stock.price || !props.stock.ma20) return 0
  return Number((((props.stock.price - props.stock.ma20) / props.stock.ma20) * 100).toFixed(1))
})

const bias5ColorClass = computed(() => {
  return bias5.value > 0 ? 'text-rise' : bias5.value < 0 ? 'text-fall' : 'text-base-content/70'
})

const bias20ColorClass = computed(() => {
  return bias20.value > 0 ? 'text-rise' : bias20.value < 0 ? 'text-fall' : 'text-base-content/70'
})

const formattedCategories = computed(() => {
  const cats = props.stock.categories
  if (!Array.isArray(cats) || cats.length === 0) return ''
  const tagMap = UI_STRINGS.CATEGORY_TAGS || {}
  const labels = cats
    .map((c) => tagMap[c] || c)
    .filter(Boolean)
  return Array.from(new Set(labels)).join(' · ')
})

const kdStatusText = computed(() => {
  const kd = props.stock.kd
  if (!kd) return ''
  if (kd.k >= 80) return UI_STRINGS.KD_STATUS.hot
  if (kd.k <= 20) return UI_STRINGS.KD_STATUS.low
  if (kd.prevK && kd.prevD) {
    if (kd.prevK <= kd.prevD && kd.k > kd.d) return UI_STRINGS.KD_STATUS.golden
    if (kd.prevK >= kd.prevD && kd.k < kd.d) return UI_STRINGS.KD_STATUS.death
  }
  return UI_STRINGS.KD_STATUS.mid
})

const ceilingInfo = computed(() => {
  if (props.ceilingProfit) return props.ceilingProfit
  // Fallback: 如果 stock 有 high5d/high10d，可自動算出第一關卡
  if (props.stock.high5d && props.stock.price) {
    const profit = Number((((props.stock.high5d - props.stock.price) / props.stock.price) * 100).toFixed(2))
    return {
      type: `5日高`,
      price: props.stock.high5d,
      netProfitPct: profit,
      passed: profit > 0,
    }
  }
  return null
})

const filterEvaluationText = computed(() => {
  if (props.filterEvaluation?.reasonText) return props.filterEvaluation.reasonText
  return null
})
</script>
