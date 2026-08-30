<template>
  <div class="screener-panel bg-base-200 border border-base-300 rounded-2xl p-3.5 md:p-4 space-y-3 shadow-sm select-none">
    <!-- ============================================================
         1. 頂部常駐 4 大模式分段切換器 (全部 + 3 大策略，內建即時檔數)
         ============================================================ -->
    <div class="grid grid-cols-4 gap-1 md:gap-1.5 p-1 bg-base-300/40 rounded-xl">
      <!-- Tab 0: 全部股票 -->
      <button
        type="button"
        class="py-2 px-1 text-center rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1 flex-wrap"
        :class="activeMode === 'ALL' ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60 hover:text-base-content'"
        @click="$emit('update:activeMode', 'ALL')"
      >
        <span>{{ UI_STRINGS.PANEL.allTab }}</span>
        <span class="text-[10px] md:text-xs font-numeric font-medium opacity-70">
          ({{ modeCounts?.ALL ?? totalCount ?? 0 }})
        </span>
      </button>

      <!-- Tab 1~3: 3 大策略模式 -->
      <button
        v-for="mode in Object.values(modes)"
        :key="mode.id"
        type="button"
        class="py-2 px-1 text-center rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1 flex-wrap"
        :class="activeMode === mode.id ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60 hover:text-base-content'"
        @click="$emit('update:activeMode', mode.id)"
      >
        <span class="hidden sm:inline">{{ mode.label }}</span>
        <span class="sm:hidden">{{ getShortModeLabel(mode.id) }}</span>
        <span class="text-[10px] md:text-xs font-numeric font-medium opacity-70">
          ({{ modeCounts?.[mode.id] ?? 0 }})
        </span>
      </button>
    </div>

    <!-- ============================================================
         2. 戰略提示與微調控制條 (提示文字 + 自訂標籤 + 重設 + 展開按鈕)
         ============================================================ -->
    <div class="flex items-center justify-between min-h-[30px] pt-0.5 px-0.5 gap-2 flex-wrap">
      <!-- 左側：戰略提示說明 -->
      <div class="text-xs text-base-content/75 leading-normal flex items-center gap-1.5 flex-1 min-w-[200px]">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0"></span>
        <span v-if="activeMode === 'ALL'">{{ UI_STRINGS.PANEL.allDescription }}</span>
        <span v-else>{{ currentMode?.description }}</span>

        <!-- 已自訂微調 Neutral 標籤 -->
        <span
          v-if="activeMode !== 'ALL' && isCustomized"
          class="text-[10px] md:text-[11px] font-medium text-base-content/80 bg-base-300 px-1.5 py-0.5 rounded leading-none ml-1 shrink-0"
        >
          {{ UI_STRINGS.PANEL.customized }}
        </span>
      </div>

      <!-- 右側動作：重設 + 展開/收合 (僅策略模式顯示微調按鈕) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <template v-if="activeMode !== 'ALL'">
          <button
            v-if="isCustomized"
            type="button"
            class="btn btn-xs btn-ghost text-base-content/70 hover:text-base-content font-normal"
            :title="UI_STRINGS.PANEL.resetBtn"
            @click="$emit('reset')"
          >
            {{ UI_STRINGS.PANEL.resetBtn }}
          </button>

          <button
            type="button"
            class="btn btn-xs btn-neutral gap-1 font-medium"
            @click="isCollapsed = !isCollapsed"
          >
            <span>{{ isCollapsed ? UI_STRINGS.PANEL.adjustParams : UI_STRINGS.PANEL.collapseParams }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': !isCollapsed }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </template>
      </div>
    </div>

    <!-- ============================================================
         3. 展開區塊：兩大業務模組核心網格 (手機單欄垂直排 / 電腦雙欄左右排)
         ============================================================ -->
    <div
      v-if="activeMode !== 'ALL'"
      v-show="!isCollapsed"
      class="grid grid-cols-1 lg:grid-cols-2 gap-3.5 lg:gap-4 pt-2 border-t border-base-300/60"
    >
      <!-- ============================================================
           模組 A：【均線與位階過濾】
           ============================================================ -->
      <div class="bg-base-100/60 rounded-xl p-3 md:p-3.5 space-y-1.5 border border-base-300/50">
        <div class="text-xs font-bold text-base-content tracking-wide pb-1 border-b border-base-300/40 flex items-center justify-between">
          <span>{{ UI_STRINGS.PANEL.moduleMa }}</span>
        </div>

        <!-- A-1. 均線支撐 (BOTH 雙站穩 / ANY 單站穩) -->
        <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
          <span class="text-base-content/75">{{ UI_STRINGS.PANEL.maSupport }}</span>
          <div class="inline-flex p-0.5 bg-base-300/50 rounded-lg text-xs font-numeric font-medium">
            <button
              type="button"
              class="px-2 py-1 rounded-md transition-all"
              :class="params.maAboveMode === 'BOTH' ? 'bg-base-100 font-bold text-base-content shadow-xs' : 'text-base-content/60'"
              @click="updateField('maAboveMode', 'BOTH')"
            >
              {{ UI_STRINGS.PANEL.maAboveBoth }}
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded-md transition-all"
              :class="params.maAboveMode === 'ANY' ? 'bg-base-100 font-bold text-base-content shadow-xs' : 'text-base-content/60'"
              @click="updateField('maAboveMode', 'ANY')"
            >
              {{ UI_STRINGS.PANEL.maAboveAny }}
            </button>
          </div>
        </div>

        <!-- A-2. 當日三線價差 (糾結度) -->
        <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
          <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
            <input
              type="checkbox"
              class="checkbox checkbox-xs rounded"
              :checked="params.checkConvergence"
              @change="updateField('checkConvergence', $event.target.checked)"
            />
            <span>{{ UI_STRINGS.PANEL.convergence }}</span>
          </label>
          <div class="flex items-center gap-1.5 font-numeric">
            <span class="text-base-content/60 text-xs">≤</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.convergenceMax"
              class="input input-bordered input-xs w-14 bg-base-100 text-center font-bold text-xs"
              @input="updateDebouncedNumericField('convergenceMax', $event.target.value)"
            />
            <span class="text-base-content/60 text-xs">%</span>
          </div>
        </div>

        <!-- A-3. 前一日三線價差 (僅「動能攻擊」模式專用，其餘模式不顯示) -->
        <div
          v-if="activeMode === 'MOMENTUM_BREAKOUT'"
          class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs"
        >
          <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
            <input
              type="checkbox"
              class="checkbox checkbox-xs rounded"
              :checked="params.checkPrevConvergence"
              @change="updateField('checkPrevConvergence', $event.target.checked)"
            />
            <span>{{ UI_STRINGS.PANEL.prevConvergence }}</span>
          </label>
          <div class="flex items-center gap-1.5 font-numeric">
            <span class="text-base-content/60 text-xs">≤</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.prevConvergenceMax"
              class="input input-bordered input-xs w-14 bg-base-100 text-center font-bold text-xs"
              @input="updateDebouncedNumericField('prevConvergenceMax', $event.target.value)"
            />
            <span class="text-base-content/60 text-xs">%</span>
          </div>
        </div>

        <!-- A-4. 5MA 乖離率區間 (標準等高 36px 行) -->
        <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
          <span class="text-base-content/75">{{ UI_STRINGS.PANEL.bias5Range }}</span>
          <div class="flex items-center gap-1.5 font-numeric">
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias5Min"
              class="input input-bordered input-xs w-14 bg-base-100 text-center font-bold text-xs"
              @input="updateDebouncedNumericField('bias5Min', $event.target.value)"
            />
            <span class="text-base-content/40 text-xs">{{ UI_STRINGS.PANEL.to }}</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias5Max"
              class="input input-bordered input-xs w-14 bg-base-100 text-center font-bold text-xs"
              @input="updateDebouncedNumericField('bias5Max', $event.target.value)"
            />
            <span class="text-base-content/60 text-xs">%</span>
          </div>
        </div>

        <!-- A-5. 20MA 月線乖離率區間 (標準等高 36px 行) -->
        <div class="flex items-center justify-between min-h-[36px] py-1 text-xs">
          <span class="text-base-content/75">{{ UI_STRINGS.PANEL.bias20Range }}</span>
          <div class="flex items-center gap-1.5 font-numeric">
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias20Min"
              class="input input-bordered input-xs w-14 bg-base-100 text-center font-bold text-xs"
              @input="updateDebouncedNumericField('bias20Min', $event.target.value)"
            />
            <span class="text-base-content/40 text-xs">{{ UI_STRINGS.PANEL.to }}</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias20Max"
              class="input input-bordered input-xs w-14 bg-base-100 text-center font-bold text-xs"
              @input="updateDebouncedNumericField('bias20Max', $event.target.value)"
            />
            <span class="text-base-content/60 text-xs">%</span>
          </div>
        </div>
      </div>

      <!-- ============================================================
           模組 B：【量能與流動性】
           ============================================================ -->
      <div class="bg-base-100/60 rounded-xl p-3 md:p-3.5 space-y-1.5 border border-base-300/50">
        <div class="text-xs font-bold text-base-content tracking-wide pb-1 border-b border-base-300/40 flex items-center justify-between">
          <span>{{ UI_STRINGS.PANEL.moduleVol }}</span>
        </div>

        <!-- ==========================================
             Case 1: 動能攻擊 (Mode 3) 專屬順序
             ========================================== -->
        <template v-if="activeMode === 'MOMENTUM_BREAKOUT'">
          <!-- 1. 當日成交量 >= 1000 張 -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkMinVolume !== false"
                @change="updateField('checkMinVolume', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.minVolume }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric">
              <span class="text-base-content/60 text-xs">≥</span>
              <input
                type="number"
                step="100"
                inputmode="numeric"
                :value="params.minVolume"
                class="input input-bordered input-xs w-18 bg-base-100 text-center font-bold text-xs"
                @input="updateDebouncedNumericField('minVolume', $event.target.value)"
              />
              <span class="text-base-content/60 text-xs">張</span>
            </div>
          </div>

          <!-- 2. 昨日成交量 < 昨日 5 日均量 (MV5) -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkPrevVolContraction"
                @change="updateField('checkPrevVolContraction', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.prevVolContraction }}</span>
            </label>
          </div>

          <!-- 3. 排除處置股 -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkNotDisposed !== false"
                @change="updateField('checkNotDisposed', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.notDisposed }}</span>
            </label>
          </div>

          <!-- 4. 當日帶量攻擊 (當日成交量大於 5 日均量) -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkVolExpansion"
                @change="updateField('checkVolExpansion', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.volExpansion }}</span>
            </label>
          </div>

          <!-- 5. 實體攻擊紅 K (收盤 > 開盤，且當日漲幅 >= 1.5%) -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkRedCandle"
                @change="updateField('checkRedCandle', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.redCandle }}</span>
            </label>
          </div>

          <!-- 6. 排除長上影線避雷針 (上影線長度不能超過實體紅 K 的一半) -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkAvoidLongUpperShadow"
                @change="updateField('checkAvoidLongUpperShadow', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.avoidUpperShadow }}</span>
            </label>
          </div>

          <!-- 7. KD 強勢攻擊區 (K 值 > 50 且 K > D 黃金交叉) -->
          <div class="flex items-center justify-between min-h-[36px] py-1 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkKd !== false && params.kdRequireCross"
                @change="updateField('checkKd', $event.target.checked); updateField('kdRequireCross', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdMomentumAttack }}</span>
            </label>
          </div>
        </template>

        <!-- ==========================================
             Case 2: 底部蓄勢 (Mode 1) 與 多頭回測 (Mode 2)
             ========================================== -->
        <template v-else>
          <!-- 1. 最低成交量門檻 -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkMinVolume !== false"
                @change="updateField('checkMinVolume', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.minVolume }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric">
              <span class="text-base-content/60 text-xs">≥</span>
              <input
                type="number"
                step="100"
                inputmode="numeric"
                :value="params.minVolume"
                class="input input-bordered input-xs w-18 bg-base-100 text-center font-bold text-xs"
                @input="updateDebouncedNumericField('minVolume', $event.target.value)"
              />
              <span class="text-base-content/60 text-xs">張</span>
            </div>
          </div>

          <!-- 2. 排除處置股 -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkNotDisposed !== false"
                @change="updateField('checkNotDisposed', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.notDisposed }}</span>
            </label>
          </div>

          <!-- 3. 量能洗盤型態 (Mode 1 量縮洗盤 / Mode 2 量縮回踩) -->
          <div
            v-if="activeMode === 'BOTTOM_CONSOLIDATION'"
            class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs"
          >
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkVolContraction"
                @change="updateField('checkVolContraction', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.volContraction }}</span>
            </label>
          </div>
          <div
            v-else-if="activeMode === 'TREND_PULLBACK'"
            class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs"
          >
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkVolPullback"
                @change="updateField('checkVolPullback', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.volPullback }}</span>
            </label>
          </div>

          <!-- 4. 排除長黑倒貨 -->
          <div class="flex items-center justify-between min-h-[36px] py-1 border-b border-base-300/30 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkAvoidLongBlack"
                @change="updateField('checkAvoidLongBlack', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.avoidLongBlack }}</span>
            </label>
          </div>

          <!-- 5. KD 動能區過濾 -->
          <div
            class="flex items-center justify-between min-h-[36px] py-1 text-xs"
            :class="{ 'border-b border-base-300/30': activeMode === 'BOTTOM_CONSOLIDATION' }"
          >
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.checkKd !== false"
                @change="updateField('checkKd', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdFilter }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric">
              <span class="text-base-content/60 text-xs">K:</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMin"
                class="input input-bordered input-xs w-12 bg-base-100 text-center font-bold text-xs"
                @input="updateDebouncedNumericField('kdKMin', $event.target.value)"
              />
              <span class="text-base-content/40 text-xs">{{ UI_STRINGS.PANEL.to }}</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMax"
                class="input input-bordered input-xs w-12 bg-base-100 text-center font-bold text-xs"
                @input="updateDebouncedNumericField('kdKMax', $event.target.value)"
              />
            </div>
          </div>

          <!-- 6. 要求 K > D 黃金交叉 (僅「底部蓄勢」顯示，「多頭回測」不看此條故隱藏) -->
          <div
            v-if="activeMode === 'BOTTOM_CONSOLIDATION'"
            class="flex items-center justify-between min-h-[36px] py-1 text-xs"
          >
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded"
                :checked="params.kdRequireCross"
                @change="updateField('kdRequireCross', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdGoldenCross }}</span>
            </label>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings'

const props = defineProps({
  modes: {
    type: Object,
    required: true,
  },
  activeMode: {
    type: String,
    required: true,
  },
  params: {
    type: Object,
    required: true,
  },
  modeCounts: {
    type: Object,
    default: () => ({}),
  },
  resultsCount: {
    type: Number,
    default: undefined,
  },
  totalCount: {
    type: Number,
    default: undefined,
  },
})

const emit = defineEmits(['update:activeMode', 'update:params', 'reset'])

// 預設收闔（使用者可自由展開微調）
const isCollapsed = ref(true)

// 當前模式物件
const currentMode = computed(() => {
  return props.modes?.[props.activeMode] || {}
})

// 手機端精簡標籤
function getShortModeLabel(modeId) {
  switch (modeId) {
    case 'BOTTOM_CONSOLIDATION':
      return '底部'
    case 'TREND_PULLBACK':
      return '回測'
    case 'MOMENTUM_BREAKOUT':
      return '動能'
    default:
      return modeId
  }
}

// 模式 2 (多頭回測) Console 底層條件提示
watch(
  () => props.activeMode,
  (newMode) => {
    if (newMode === 'TREND_PULLBACK') {
      console.log('[選股引擎] 模式 2 (多頭回測)：已啟用底層必要條件「月線斜率向上 (MA20 Rising)」過濾。')
    }
  },
  { immediate: true }
)

// 判斷當前參數是否已被自訂微調（與模式預設值對比）
const isCustomized = computed(() => {
  if (props.activeMode === 'ALL') return false
  const defaults = currentMode.value?.defaultParams
  if (!defaults || !props.params) return false
  for (const key of Object.keys(defaults)) {
    if (props.params[key] !== defaults[key]) {
      return true
    }
  }
  return false
})

// 180ms 輕量防抖處理數字輸入，避免快速打字時頻繁重算卡頓
let debounceTimer = null
function updateDebouncedNumericField(key, rawVal) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const num = Number(rawVal)
    const val = rawVal === '' || isNaN(num) ? rawVal : num
    emit('update:params', {
      ...props.params,
      [key]: val,
    })
  }, 180)
}

// 布林值 / 字串等開關切換立即反應 (0ms 延遲)
function updateField(key, val) {
  emit('update:params', {
    ...props.params,
    [key]: val,
  })
}
</script>
