<template>
  <div
    class="stock-card bg-base-200 border border-base-300 rounded-xl transition-all duration-200 hover:shadow-md hover:border-base-content/20 [content-visibility:auto]"
    :class="isCompact ? 'p-3 sm:p-3.5' : 'p-6'"
    :style="{ containIntrinsicSize: isCompact ? '76px' : '160px' }"
  >
    <!-- ============================================================
         簡約模式佈局 (Compact Mode)：僅保留首行核心報價與槽位 B 篩選理由
         ============================================================ -->
    <div v-if="isCompact" class="space-y-2">
      <!-- 時光機覆盤：後續交易日驗證膠囊條 (簡約模式：置頂於個股名稱與報價上方) -->
      <ForwardValidationBar
        v-if="stock.forwardValidation"
        :validation="stock.forwardValidation"
        class="mb-4"
      />

      <!-- 首行：核心報價 (代號、名稱、即時現價、漲跌幅) -->
      <div class="flex items-baseline justify-between gap-2">
        <div class="flex items-baseline gap-2 min-w-0">
          <span
            class="font-numeric font-bold text-lg text-base-content tracking-wide cursor-pointer hover:underline select-none touch-manipulation"
            :title="UI_STRINGS.SEARCH?.searchCodeTooltip"
            @click.stop="$emit('searchCode', stock.code)"
          >
            {{ stock.code }}
          </span>
          <span class="font-bold text-lg text-base-content truncate">{{ stock.name }}</span>
          <span v-if="stock.isDisposed" class="font-bold text-sm text-rise tracking-tight">
            [{{ UI_STRINGS.SCREENER.disposed }}]
          </span>
          <span
            v-if="relStrengthFormatted"
            class="shrink-0 text-xs px-1.5 py-0.5 rounded font-numeric font-semibold select-none"
            :class="rsBadgeClass"
            :title="rsBadgeTitle"
          >
            {{ UI_STRINGS.REL_STRENGTH?.prefix || 'RS' }} {{ relStrengthFormatted }}
          </span>
        </div>
        <div
          class="flex items-baseline gap-1.5 shrink-0 font-numeric cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity select-none touch-manipulation"
          :title="UI_STRINGS.QUICK_CALC.openTooltip"
          @click.stop="$emit('openPriceCalc', stock)"
        >
          <span class="text-lg font-bold" :class="priceColorClass">
            {{ formatNumber(stock.price) }}
          </span>
          <span class="text-sm font-semibold" :class="changeColorClass">
            {{ formatChange(stock.change, stock.changePct) }}
          </span>
        </div>
      </div>

      <!-- 槽位 B：篩選判讀純文字結果 (支援點擊向下展開指標診斷清單) -->
      <StockEvaluationSlot
        :stock="stock"
        :active-mode="activeMode"
        :is-unmatched="isUnmatched"
        :filter-evaluation="filterEvaluation"
      />
    </div>

    <!-- ============================================================
         完整模式佈局 (Full Mode)
         ============================================================ -->
    <template v-else>
      <!-- 手機端佈局 (< 1024px)：由上而下 5 層自然排列 -->
      <div class="block lg:hidden space-y-3">
        <!-- 時光機覆盤：後續交易日驗證膠囊條 (手機端：置頂於主焦點代號與名稱上方) -->
        <ForwardValidationBar
          v-if="stock.forwardValidation"
          :validation="stock.forwardValidation"
          class="mb-4"
        />

        <!-- 第 1 層：主焦點 (代號、名稱、即時現價同為 text-lg，漲跌幅為 text-sm) -->
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-2 min-w-0">
            <span
              class="font-numeric font-bold text-lg text-base-content tracking-wide cursor-pointer hover:underline select-none touch-manipulation"
              :title="UI_STRINGS.SEARCH?.searchCodeTooltip"
              @click.stop="$emit('searchCode', stock.code)"
            >
              {{ stock.code }}
            </span>
            <span class="font-bold text-lg text-base-content truncate">{{ stock.name }}</span>
            <span v-if="stock.isDisposed" class="font-bold text-sm text-rise tracking-tight">
              [{{ UI_STRINGS.SCREENER.disposed }}]
            </span>
            <span
              v-if="relStrengthFormatted"
              class="shrink-0 text-xs px-1.5 py-0.5 rounded font-numeric font-semibold select-none"
              :class="rsBadgeClass"
              :title="rsBadgeTitle"
            >
              {{ UI_STRINGS.REL_STRENGTH?.prefix || 'RS' }} {{ relStrengthFormatted }}
            </span>
          </div>
          <div
            class="flex items-baseline gap-1.5 shrink-0 font-numeric cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity select-none touch-manipulation"
            :title="UI_STRINGS.QUICK_CALC.openTooltip"
            @click.stop="$emit('openPriceCalc', stock)"
          >
            <span class="text-lg font-bold" :class="priceColorClass">
              {{ formatNumber(stock.price) }}
            </span>
            <span class="text-sm font-semibold" :class="changeColorClass">
              {{ formatChange(stock.change, stock.changePct) }}
            </span>
          </div>
        </div>

      <!-- 第 2 層：標籤 (統一 text-sm font-normal, text-base-content/80，支援官方排行榜外開超連結) -->
      <div v-if="categoryItems.length > 0 || sellWarningText" class="text-sm font-normal text-base-content/80 leading-normal">
        <template v-if="categoryItems.length > 0">
          <template v-for="(item, idx) in categoryItems" :key="item.key">
            <a
              v-if="item.url"
              :href="item.url"
              target="_blank"
              rel="noopener"
              class="hover:underline hover:text-base-content transition-colors"
              @click.stop
            >
              {{ item.label }}
            </a>
            <span v-else>{{ item.label }}</span>
            <span v-if="idx < categoryItems.length - 1" class="text-base-content/40 mx-1">·</span>
          </template>
        </template>
        <span v-if="categoryItems.length > 0 && sellWarningText" class="text-base-content/40 mx-1">·</span>
        <span v-if="sellWarningText" class="inline-flex items-center text-base-content/80">
          <svg class="inline-block w-3.5 h-3.5 shrink-0 align-[-0.12em] mr-1" viewBox="0 0 16 16" fill="none">
            <path d="M7.134 1.5a1 1 0 011.732 0l6.062 10.5A1 1 0 0114.062 13.5H1.938a1 1 0 01-.866-1.5L7.134 1.5z" fill="#F59E0B" />
            <path d="M8 5.5v3.5" stroke="#18181B" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="8" cy="11.25" r="0.8" fill="#18181B" />
          </svg>
          <span>{{ sellWarningText }}</span>
        </span>
      </div>

      <!-- 籌碼透視區塊（籌碼集中度 + 短沖避雷） -->
      <StockChipsSection :stock="stock" />

      <!-- 槽位 A：天花板關卡價與預期純利 (支援就地向下展開天梯清單) -->
      <StockCeilingLadder :stock="stock" :ceiling-profit="ceilingProfit" />

      <!-- 第 3 層：Sparkline 技術走勢圖 (純淨走勢，點擊查看近日表現) -->
      <div
        class="py-1 flex items-center justify-center cursor-pointer select-none"
        :title="UI_STRINGS.LIFECYCLE.openTooltip"
        @click.stop="$emit('openLifecycle', stock)"
      >
        <Sparkline
          :history="stock.history10d"
          :stock="stock"
          :stock-code="stock.code"
        />
      </div>

      <!-- 第 4 層：量化指標網格 (均線 vs 量能 + KD 動能指標) -->
      <div class="space-y-1.5 pt-2 border-t border-base-300/60 font-numeric text-sm font-normal leading-normal">
        <div class="grid grid-cols-2 gap-6">
          <!-- 左欄：均線與乖離率 (乖離率加粗 700) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.ma5 }}</span>
              <span>
                <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma5) }}</strong>
                <span :class="bias5ColorClass" class="font-bold">({{ formatBias(bias5) }})</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.ma10 }}</span>
              <span>
                <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma10) }}</strong>
                <span class="font-bold text-base-content/80">({{ formatBias(bias10) }})</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.ma20 }}</span>
              <span>
                <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma20) }}</strong>
                <span :class="bias20ColorClass" class="font-bold">({{ formatBias(bias20) }})</span>
              </span>
            </div>
          </div>

          <!-- 右欄：當日量能與均量縮放比對 -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.volume }}</span>
              <strong class="font-bold text-base-content">{{ stock.volume?.toLocaleString() }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.mv5 }}</span>
              <strong class="font-bold text-base-content">{{ stock.vMa5?.toLocaleString() }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.mv10 }}</span>
              <strong class="font-bold text-base-content">{{ stock.vMa10?.toLocaleString() }}</strong>
            </div>
          </div>
        </div>

        <!-- KD 動能指標 (位於 MA & MV 下方) -->
        <div class="flex items-center justify-between pt-1 border-t border-base-300/40 text-sm font-normal text-base-content/80 font-numeric">
          <span class="text-base-content/80">{{ UI_STRINGS.METRICS.kd }}</span>
          <span>
            <strong class="text-base-content font-bold mr-1.5">{{ stock.kd?.k }} / {{ stock.kd?.d }}</strong>
            <span v-if="kdStatusText" class="font-medium text-base-content/80">({{ kdStatusText }})</span>
          </span>
        </div>
      </div>

      <!-- ★ 預留槽位 B：篩選判讀純文字結果 (支援點擊向下展開指標診斷清單) -->
      <StockEvaluationSlot
        :stock="stock"
        :active-mode="activeMode"
        :is-unmatched="isUnmatched"
        :filter-evaluation="filterEvaluation"
      />

      <!-- 第 5 層：極簡快捷操作列 (統一 text-sm font-normal) -->
      <StockCardActions :stock="stock" layout="mobile" />
    </div>

    <!-- ============================================================
         電腦端佈局 (>= 1024px)：水平 3 欄式寬扁卡片 (左 3/12: 走勢KD | 中 5/12: 報價操作與籌碼 | 右 4/12: 均線量能)
         ============================================================ -->
    <div class="hidden lg:grid lg:grid-cols-12 lg:gap-5 lg:items-end">
      <!-- 左欄 (3/12)：走勢圖 (純淨走勢，靠左微收，點擊查看近日表現) -->
      <div
        class="lg:col-span-3 pr-2 flex items-center justify-center cursor-pointer select-none"
        :title="UI_STRINGS.LIFECYCLE.openTooltip"
        @click.stop="$emit('openLifecycle', stock)"
      >
        <Sparkline
          :history="stock.history10d"
          :stock="stock"
          :stock-code="stock.code"
        />
      </div>

      <!-- 中欄 (5/12)：代號、名稱、報價、標籤與快捷操作 (加大水平空間，餘裕飽滿) -->
      <div class="lg:col-span-5 space-y-2 px-3 border-l border-r border-base-300/60">
        <!-- 時光機覆盤：後續交易日驗證膠囊條 (電腦端：置頂於核心報價代號與名稱上方) -->
        <ForwardValidationBar
          v-if="stock.forwardValidation"
          :validation="stock.forwardValidation"
          class="mb-4"
        />

        <!-- 核心報價 (代號、名稱、即時現價同為 text-lg，漲跌幅為 text-sm) -->
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-2 min-w-0">
            <span
              class="font-numeric font-bold text-lg text-base-content cursor-pointer hover:underline select-none touch-manipulation"
              :title="UI_STRINGS.SEARCH?.searchCodeTooltip"
              @click.stop="$emit('searchCode', stock.code)"
            >
              {{ stock.code }}
            </span>
            <span class="font-bold text-lg text-base-content truncate">{{ stock.name }}</span>
            <span v-if="stock.isDisposed" class="font-bold text-sm text-rise">
              [{{ UI_STRINGS.SCREENER.disposed }}]
            </span>
            <span
              v-if="relStrengthFormatted"
              class="shrink-0 text-xs px-1.5 py-0.5 rounded font-numeric font-semibold select-none"
              :class="rsBadgeClass"
              :title="rsBadgeTitle"
            >
              {{ UI_STRINGS.REL_STRENGTH?.prefix || 'RS' }} {{ relStrengthFormatted }}
            </span>
          </div>
          <div
            class="flex items-baseline gap-1.5 shrink-0 font-numeric cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity select-none touch-manipulation"
            :title="UI_STRINGS.QUICK_CALC.openTooltip"
            @click.stop="$emit('openPriceCalc', stock)"
          >
            <span class="text-lg font-bold" :class="priceColorClass">{{ formatNumber(stock.price) }}</span>
            <span class="text-sm font-semibold" :class="changeColorClass">{{ formatChange(stock.change, stock.changePct) }}</span>
          </div>
        </div>

        <!-- 標籤 (統一 text-sm font-normal，支援官方排行榜外開超連結) -->
        <div v-if="categoryItems.length > 0 || sellWarningText" class="text-sm font-normal text-base-content/80 leading-normal">
          <template v-if="categoryItems.length > 0">
            <template v-for="(item, idx) in categoryItems" :key="item.key">
              <a
                v-if="item.url"
                :href="item.url"
                target="_blank"
                rel="noopener"
                class="hover:underline hover:text-base-content transition-colors"
                @click.stop
              >
                {{ item.label }}
              </a>
              <span v-else>{{ item.label }}</span>
              <span v-if="idx < categoryItems.length - 1" class="text-base-content/40 mx-1">·</span>
            </template>
          </template>
          <span v-if="categoryItems.length > 0 && sellWarningText" class="text-base-content/40 mx-1">·</span>
          <span v-if="sellWarningText" class="inline-flex items-center text-base-content/80">
            <svg class="inline-block w-3.5 h-3.5 shrink-0 align-[-0.12em] mr-1" viewBox="0 0 16 16" fill="none">
              <path d="M7.134 1.5a1 1 0 011.732 0l6.062 10.5A1 1 0 0114.062 13.5H1.938a1 1 0 01-.866-1.5L7.134 1.5z" fill="#F59E0B" />
              <path d="M8 5.5v3.5" stroke="#18181B" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="8" cy="11.25" r="0.8" fill="#18181B" />
            </svg>
            <span>{{ sellWarningText }}</span>
          </span>
        </div>

        <!-- 籌碼透視區塊（籌碼集中度 + 短沖避雷） -->
        <StockChipsSection :stock="stock" />

        <!-- 槽位 A (電腦端，支援就地向下展開天梯清單) -->
        <StockCeilingLadder :stock="stock" :ceiling-profit="ceilingProfit" size="compact" />

        <!-- 快捷操作列 (統一 text-sm font-normal) -->
        <StockCardActions :stock="stock" layout="desktop" />
      </div>

      <!-- 右欄 (4/12)：量化指標網格 (均線 vs 量能 + KD 動能指標) -->
      <div class="lg:col-span-4 space-y-1.5 font-numeric text-sm font-normal leading-normal pl-2">
        <div class="grid grid-cols-2 gap-6">
          <!-- 均線組 (乖離率加粗 700) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.ma5 }}</span>
              <span>
                <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma5) }}</strong>
                <span :class="bias5ColorClass" class="font-bold">({{ formatBias(bias5) }})</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.ma10 }}</span>
              <span>
                <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma10) }}</strong>
                <span class="font-bold text-base-content/80">({{ formatBias(bias10) }})</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.ma20 }}</span>
              <span>
                <strong class="font-bold text-base-content mr-1">{{ formatNumber(stock.ma20) }}</strong>
                <span :class="bias20ColorClass" class="font-bold">({{ formatBias(bias20) }})</span>
              </span>
            </div>
          </div>

          <!-- 量能組 -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.volume }}</span>
              <strong class="font-bold text-base-content">{{ stock.volume?.toLocaleString() }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.mv5 }}</span>
              <strong class="font-bold text-base-content">{{ stock.vMa5?.toLocaleString() }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/80">{{ UI_STRINGS.METRICS.mv10 }}</span>
              <strong class="font-bold text-base-content">{{ stock.vMa10?.toLocaleString() }}</strong>
            </div>
          </div>
        </div>

        <!-- KD 動能指標 (位於 MA & MV 下方) -->
        <div class="flex items-center justify-between pt-1 border-t border-base-300/40 text-sm font-normal text-base-content/80 font-numeric">
          <span class="text-base-content/80">{{ UI_STRINGS.METRICS.kd }}</span>
          <span>
            <strong class="text-base-content font-bold mr-1.5">{{ stock.kd?.k }} / {{ stock.kd?.d }}</strong>
            <span v-if="kdStatusText" class="font-medium text-base-content/80">({{ kdStatusText }})</span>
          </span>
        </div>
      </div>

      <!-- ★ 預留槽位 B (電腦端通欄底列，支援點擊展開指標診斷清單) -->
      <StockEvaluationSlot
        :stock="stock"
        :active-mode="activeMode"
        :is-unmatched="isUnmatched"
        :filter-evaluation="filterEvaluation"
        class="lg:col-span-12"
      />
    </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'
import { getStockCategoryItems } from '../constants/category-urls.js'
import Sparkline from './Sparkline.vue'
import ForwardValidationBar from './ForwardValidationBar.vue'
import StockEvaluationSlot from './StockEvaluationSlot.vue'
import StockCeilingLadder from './StockCeilingLadder.vue'
import StockChipsSection from './StockChipsSection.vue'
import StockCardActions from './StockCardActions.vue'

const props = defineProps({
  stock: {
    type: Object,
    required: true,
  },
  activeMode: {
    type: String,
    default: '',
  },
  isUnmatched: {
    type: Boolean,
    default: false,
  },
  ceilingProfit: {
    type: Object,
    default: null,
  },
  filterEvaluation: {
    type: Object,
    default: null,
  },
  isCompact: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['select', 'openRiskModal', 'openPriceCalc', 'openLifecycle', 'searchCode'])

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '--'
  return Number(num).toFixed(2)
}

function formatChange(change, changePct) {
  if (changePct === null || changePct === undefined || isNaN(changePct)) return '--'
  const absPct = Math.abs(Number(changePct)).toFixed(2)
  let chgVal = change
  if ((chgVal === undefined || chgVal === null || isNaN(chgVal)) && props.stock?.price) {
    chgVal = Number((props.stock.price * (changePct / 100) / (1 + changePct / 100)).toFixed(2))
  }
  const absChg = chgVal !== undefined && chgVal !== null && !isNaN(chgVal)
    ? Number(Math.abs(Number(chgVal))).toFixed(2)
    : '0.00'

  if (changePct > 0) {
    return `▴${absChg} (${absPct}%)`
  }
  if (changePct < 0) {
    return `▾${absChg} (${absPct}%)`
  }
  // 平盤不上色，也不用三角
  return `${absChg} (${absPct}%)`
}

function formatBias(bias) {
  if (bias === null || bias === undefined || isNaN(bias)) return '--'
  const sign = bias > 0 ? '+' : ''
  return `${sign}${Number(bias).toFixed(1)}%`
}

const priceColorClass = computed(() => {
  const pct = props.stock.changePct ?? 0
  if (props.stock.isLimitUp || pct >= 9.5) {
    return 'bg-rise text-white px-1.5 py-0.5 rounded font-bold shadow-xs'
  }
  if (props.stock.isLimitDown || pct <= -9.5) {
    return 'bg-fall text-white px-1.5 py-0.5 rounded font-bold shadow-xs'
  }
  if (pct > 0) return 'text-rise'
  if (pct < 0) return 'text-fall'
  return 'text-base-content'
})

const changeColorClass = computed(() => {
  const pct = props.stock.changePct ?? 0
  if (pct > 0) return 'text-rise'
  if (pct < 0) return 'text-fall'
  return 'text-base-content/80'
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
  return bias5.value > 0 ? 'text-rise' : bias5.value < 0 ? 'text-fall' : 'text-base-content/75'
})

const bias20ColorClass = computed(() => {
  return bias20.value > 0 ? 'text-rise' : bias20.value < 0 ? 'text-fall' : 'text-base-content/75'
})

const categoryItems = computed(() => getStockCategoryItems(props.stock))

const sellWarningText = computed(() => {
  if (!props.stock.sellWarning) return ''
  return props.stock.sellWarning.replace(/^⚠️\s*/, '')
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

const relStrengthFormatted = computed(() => {
  const rs = props.stock.relStrength5d
  if (rs === null || rs === undefined || isNaN(rs)) return null
  const sign = rs >= 0 ? '+' : ''
  return `${sign}${Number(rs).toFixed(1)}%`
})

const rsBadgeClass = computed(() => {
  const rs = props.stock.relStrength5d
  if (rs === null || rs === undefined || isNaN(rs)) return ''
  if (rs > 0) {
    return 'bg-rise/10 text-rise border border-rise/25'
  }
  if (rs < 0) {
    return 'bg-base-300/40 text-base-content/60 border border-base-300/60'
  }
  return 'bg-base-300/40 text-base-content/70 border border-base-300/60'
})

const rsBadgeTitle = computed(() => {
  const rs = props.stock.relStrength5d
  if (rs === null || rs === undefined || isNaN(rs)) return ''
  const benchmarkName = props.stock.market === 'otc'
    ? (UI_STRINGS.REL_STRENGTH?.benchmarkOtc || '櫃買 5D')
    : (UI_STRINGS.REL_STRENGTH?.benchmarkTaiex || '加權 5D')
  const statusDesc = rs >= 0
    ? (UI_STRINGS.REL_STRENGTH?.stronger || '強於大盤')
    : (UI_STRINGS.REL_STRENGTH?.weaker || '弱於大盤')
  return `${UI_STRINGS.REL_STRENGTH?.label || '相對強弱'}：${statusDesc} (${benchmarkName})`
})
</script>
