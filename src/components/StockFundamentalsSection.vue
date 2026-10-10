<template>
  <div v-bind="$attrs">
    <!-- 基本面估值區塊（股本規模 + 動態 PE 與同業折溢價，頂部細分隔線 + 緊湊間距 + 等寬數字） -->
    <div
      v-if="hasFundamentalsSection"
      class="pt-1.5 pb-1 border-t border-base-300/40 text-sm font-normal text-base-content/80 leading-normal flex items-baseline flex-wrap font-numeric"
    >
      <!-- 主題詞：估值 -->
      <span class="mr-1.5 font-sans text-base-content/70 select-none">{{ UI_STRINGS.FUNDAMENTALS?.sectionLabel || '估值' }}</span>
      <span class="text-base-content/40 mr-1.5 select-none">·</span>

      <!-- 股本規模：股本 11.5億 (輕) / 股本 42.4億 (中) / 股本 2593億 (大) -->
      <span v-if="capitalInfo" class="inline-flex items-baseline">
        <span class="font-sans mr-1">{{ UI_STRINGS.FUNDAMENTALS?.capital || '股本' }}</span>
        <strong class="font-bold text-base-content">{{ capitalInfo.val }}</strong>
        <span class="font-sans mr-1">{{ UI_STRINGS.FUNDAMENTALS?.capitalUnit || '億' }}</span>
        <span class="select-none font-sans" :class="capitalInfo.typeClass">({{ capitalInfo.type }})</span>
      </span>

      <!-- 分隔符號 -->
      <span v-if="capitalInfo && peInfo" class="text-base-content/40 mx-1.5 select-none">·</span>

      <!-- 本益比資訊：PE 19.3 (同業 33.2 · 便宜 42%) / PE (虧損) / PE -- -->
      <span v-if="peInfo" class="inline-flex items-baseline">
        <span class="mr-1 select-none">{{ UI_STRINGS.FUNDAMENTALS?.pe || 'PE' }}</span>
        <strong v-if="peInfo.hasPe" class="font-bold text-base-content mr-1">{{ peInfo.peValue }}</strong>
        <span v-if="peInfo.bracketText" class="select-none" :class="peInfo.bracketClass">
          ({{ peInfo.bracketText }})
        </span>
        <span v-else-if="peInfo.noDataText" class="text-base-content/40 select-none">
          {{ peInfo.noDataText }}
        </span>
      </span>
    </div>

    <!-- 月營收動能區塊（月份 + 年增率 (高成長標籤) + 月增率） -->
    <div
      v-if="revenueInfo"
      class="pt-1 pb-1 border-t border-base-300/40 text-sm font-normal text-base-content/80 leading-normal flex items-baseline flex-wrap font-numeric"
    >
      <!-- 主題詞：營收 -->
      <span class="mr-1.5 font-sans text-base-content/70 select-none">{{ UI_STRINGS.REVENUE?.sectionLabel || '營收' }}</span>
      <span class="text-base-content/40 mr-1.5 select-none">·</span>

      <!-- 資料月份 (如 8月) -->
      <span v-if="revenueInfo.month" class="mr-1.5 font-sans text-base-content/75 select-none">
        {{ revenueInfo.month }}
      </span>

      <!-- 年增率 (YoY) -->
      <span class="inline-flex items-baseline">
        <span class="font-sans mr-1 select-none">{{ revenueInfo.yoyPrefix }}</span>
        <strong class="font-bold" :class="revenueInfo.yoyClass">{{ revenueInfo.yoyText }}</strong>
        <!-- 高成長微型標註 (年增 >= 30%) -->
        <span
          v-if="revenueInfo.isHighGrowth"
          class="ml-1 text-[11px] font-sans font-bold px-1 py-0.2 rounded bg-rise/10 text-rise border border-rise/30 select-none inline-block align-baseline"
        >
          {{ UI_STRINGS.REVENUE?.highGrowthBadge || '高成長' }}
        </span>
      </span>

      <!-- 分隔符號 -->
      <span v-if="revenueInfo.hasMom" class="text-base-content/40 mx-1.5 select-none">·</span>

      <!-- 月增率 (MoM) -->
      <span v-if="revenueInfo.hasMom" class="inline-flex items-baseline">
        <span class="font-sans mr-1 select-none">{{ UI_STRINGS.REVENUE?.momPrefix || '月增' }}</span>
        <strong class="font-bold" :class="revenueInfo.momClass">{{ revenueInfo.momText }}</strong>
      </span>
    </div>

    <!-- 所屬產業與關聯企業區塊 (前 2 ~ 3 個核心產業 + [關聯 ↗] 外開富邦關聯企業) -->
    <div
      v-if="industryInfo"
      class="pt-1 pb-1 border-t border-base-300/40 text-sm font-normal text-base-content/80 leading-normal flex items-baseline flex-wrap"
    >
      <!-- 主題詞：產業 -->
      <span class="mr-1.5 font-sans text-base-content/70 select-none">{{ UI_STRINGS.INDUSTRY?.sectionLabel || '產業' }}</span>
      <span class="text-base-content/40 mr-1.5 select-none">·</span>

      <!-- 產業標籤清單（取前 2 ~ 3 個核心產業） -->
      <template v-for="(item, idx) in industryInfo.displayList" :key="idx">
        <span class="text-base-content font-medium">{{ item }}</span>
        <span v-if="idx < industryInfo.displayList.length - 1" class="text-base-content/40 mx-1 select-none">·</span>
      </template>

      <!-- 超過顯示上限的數量提示 (+N)，hover 提示完整清單 -->
      <span
        v-if="industryInfo.extraCount > 0"
        class="ml-1 text-xs text-base-content/60 font-numeric select-none cursor-help"
        :title="industryInfo.fullListTooltip"
      >
        (+{{ industryInfo.extraCount }})
      </span>

      <!-- 分隔符號 -->
      <span v-if="industryInfo.url" class="text-base-content/40 mx-1.5 select-none">·</span>

      <!-- [關聯 ↗] 外開富邦關聯企業 -->
      <a
        v-if="industryInfo.url"
        :href="industryInfo.url"
        target="_blank"
        rel="noopener nofollow"
        class="inline-flex items-center gap-0.5 text-xs text-base-content/75 hover:text-base-content hover:underline transition-colors py-0.5 select-none"
        :title="UI_STRINGS.INDUSTRY?.relatedCompaniesTooltip"
        @click.stop
      >
        <span>{{ UI_STRINGS.INDUSTRY?.relatedLinkText || '關聯' }}</span>
        <svg class="w-3 h-3 shrink-0 ml-0.5" viewBox="0 0 16 16" fill="none">
          <path d="M4 12L12 4M12 4H6M12 4V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

const props = defineProps({
  stock: {
    type: Object,
    required: true,
  },
})

// 股本規模解析
const capitalInfo = computed(() => {
  const cap = props.stock.paidInCapital
  if (cap == null || typeof cap !== 'number' || isNaN(cap)) return null

  // 100 億以上取整數（如 2593億），100 億以下保留 1 位小數（如 11.5億）
  const formattedVal = cap >= 100 ? String(Math.round(cap)) : cap.toFixed(1)

  let type = ''
  let typeClass = ''
  if (cap <= 30) {
    type = UI_STRINGS.FUNDAMENTALS?.capLight || '輕'
    typeClass = 'font-bold text-base-content'
  } else if (cap <= 100) {
    type = UI_STRINGS.FUNDAMENTALS?.capMid || '中'
    typeClass = 'font-normal text-base-content/65'
  } else {
    type = UI_STRINGS.FUNDAMENTALS?.capLarge || '大'
    typeClass = 'font-normal text-base-content/65'
  }

  return {
    val: formattedVal,
    type,
    typeClass,
  }
})

// 本益比與同業對照解析
const peInfo = computed(() => {
  const stock = props.stock
  const pe = stock.pe
  const indPe = stock.industryPe
  const discount = stock.peDiscount

  // 1. 若有有效本益比數值
  if (pe != null && typeof pe === 'number' && !isNaN(pe)) {
    const peFormatted = pe.toFixed(1)

    // 若有同業 PE 對照
    if (indPe != null && typeof indPe === 'number' && !isNaN(indPe)) {
      const indFormatted = indPe.toFixed(1)
      let comparisonText = ''

      if (discount != null && typeof discount === 'number' && !isNaN(discount)) {
        const absPct = Math.round(Math.abs(discount))
        if (discount < 0) {
          comparisonText = ` · ${UI_STRINGS.FUNDAMENTALS?.cheaperPrefix || '便宜'} ${absPct}%`
        } else if (discount > 0) {
          comparisonText = ` · ${UI_STRINGS.FUNDAMENTALS?.expensivePrefix || '偏貴'} ${absPct}%`
        }
      }

      return {
        hasPe: true,
        peValue: peFormatted,
        bracketText: `${UI_STRINGS.FUNDAMENTALS?.industry || '同業'} ${indFormatted}${comparisonText}`,
        bracketClass: 'text-base-content/80',
      }
    }

    return {
      hasPe: true,
      peValue: peFormatted,
      bracketText: null,
      bracketClass: '',
    }
  }

  // 2. 虧損股判定（有基本面股本或同業資料，但本益比為 null）
  if (stock.paidInCapital != null || stock.industryPe != null) {
    return {
      hasPe: false,
      peValue: null,
      bracketText: UI_STRINGS.FUNDAMENTALS?.loss || '虧損',
      bracketClass: 'text-base-content/65 font-medium',
    }
  }

  // 3. 真正無資料
  return {
    hasPe: false,
    peValue: null,
    bracketText: null,
    noDataText: UI_STRINGS.FUNDAMENTALS?.noData || '--',
  }
})

// 是否具備基本面估值區塊
const hasFundamentalsSection = computed(() => {
  return !!capitalInfo.value || (peInfo.value && (peInfo.value.hasPe || peInfo.value.bracketText != null))
})

// 月營收動能解析
const revenueInfo = computed(() => {
  const stock = props.stock
  const yoy = stock.revenueYoY
  const mom = stock.revenueMoM
  const latestMonth = stock.revenueLatestMonth

  // 若無年增率則隱藏整個營收列
  if (yoy == null || typeof yoy !== 'number' || isNaN(yoy)) {
    return null
  }

  // 1. 月份格式化（例如 '2026-08' -> '8月'）
  let month = ''
  if (latestMonth && typeof latestMonth === 'string') {
    const parts = latestMonth.split('-')
    if (parts.length >= 2) {
      const m = parseInt(parts[1], 10)
      if (!isNaN(m)) {
        month = `${m}${UI_STRINGS.REVENUE?.monthSuffix || '月'}`
      }
    }
  }

  // 2. 年增率 (YoY) 指標名固定為「年增」，搭配帶符號之變動率（如 年增 +33.5% / 年增 -13.1%），與月增完全對稱且杜絕負負得正歧義
  const isYoyPositive = yoy > 0
  const isYoyNegative = yoy < 0
  const yoyPrefix = UI_STRINGS.REVENUE?.growthPrefix || '年增'
  const yoyText = `${isYoyPositive ? '+' : ''}${yoy.toFixed(1)}%`
  const yoyClass = isYoyPositive ? 'text-rise' : (isYoyNegative ? 'text-fall' : 'text-base-content')
  const isHighGrowth = yoy >= 30

  // 3. 月增率 (MoM)
  const hasMom = mom != null && typeof mom !== 'number' ? false : (mom != null && !isNaN(mom))
  let momText = ''
  let momClass = ''
  if (hasMom) {
    const isMomPositive = mom > 0
    const isMomNegative = mom < 0
    momText = `${isMomPositive ? '+' : ''}${mom.toFixed(1)}%`
    momClass = isMomPositive ? 'text-rise' : (isMomNegative ? 'text-fall' : 'text-base-content')
  }

  return {
    month,
    yoyPrefix,
    yoyText,
    yoyClass,
    isHighGrowth,
    hasMom,
    momText,
    momClass,
  }
})

// 所屬產業與關聯企業解析
const industryInfo = computed(() => {
  const stock = props.stock
  const rawList = stock.industry

  if (!Array.isArray(rawList) || rawList.length === 0) {
    return null
  }

  // 避免過長折行：最多顯示前 3 個產業標籤（若單一標籤較長或超過 3 個，其餘收合於 +N）
  const MAX_DISPLAY = 3
  const displayList = rawList.slice(0, MAX_DISPLAY)
  const extraCount = Math.max(0, rawList.length - MAX_DISPLAY)
  const fullListTooltip = rawList.join(' · ')

  return {
    displayList,
    extraCount,
    fullListTooltip,
    url: stock.industryUrl || null,
  }
})
</script>
