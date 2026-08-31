<template>
  <div class="screener-panel bg-base-200 border border-base-300 rounded-2xl p-3.5 md:p-4 space-y-3.5 shadow-sm select-none">
    <!-- ============================================================
         0. 頂部：時光機回測切換列 (近 5 個交易日真實日期)
         ============================================================ -->
    <TimeMachineBar
      :day-offset="dayOffset"
      :updated-at="updatedAt"
      @update:day-offset="$emit('update:dayOffset', $event)"
    />

    <!-- ============================================================
         1. 頂部常駐 6 大模式分段切換器 (全部 + 5 大策略，內建即時檔數)
         ============================================================ -->
    <div class="grid grid-cols-6 gap-1 p-1 bg-base-300/40 rounded-xl">
      <!-- Tab 0: 全部股票 -->
      <button
        type="button"
        class="py-2 px-1 text-center rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 flex-wrap"
        :class="activeMode === 'ALL' ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/80 hover:text-base-content'"
        @click="$emit('update:activeMode', 'ALL')"
      >
        <span class="hidden sm:inline">{{ UI_STRINGS.PANEL.allTab }}</span>
        <span class="sm:hidden">全部</span>
        <span class="text-xs md:text-sm font-numeric font-medium opacity-80">
          ({{ modeCounts?.ALL ?? totalCount ?? 0 }})
        </span>
      </button>

      <!-- Tab 1~5: 5 大策略模式 (依生命週期時間序排序) -->
      <button
        v-for="mode in Object.values(modes)"
        :key="mode.id"
        type="button"
        class="py-2 px-1 text-center rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 flex-wrap"
        :class="activeMode === mode.id ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/80 hover:text-base-content'"
        @click="$emit('update:activeMode', mode.id)"
      >
        <span class="hidden sm:inline">{{ mode.label }}</span>
        <span class="sm:hidden">{{ getShortModeLabel(mode.id) }}</span>
        <span class="text-xs md:text-sm font-numeric font-medium opacity-80">
          ({{ modeCounts?.[mode.id] ?? 0 }})
        </span>
      </button>
    </div>

    <!-- ============================================================
         2. 戰略提示與微調控制條 (提示文字 + 自訂標籤 + 重設 + 展開按鈕)
         ============================================================ -->
    <div class="flex items-center justify-between min-h-[32px] pt-0.5 px-0.5 gap-2 flex-wrap">
      <!-- 左側：戰略提示說明 -->
      <div class="text-sm text-base-content/80 leading-normal flex items-center gap-1.5 flex-1 min-w-[200px]">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0"></span>
        <span v-if="activeMode === 'ALL'">{{ UI_STRINGS.PANEL.allDescription }}</span>
        <span v-else>{{ currentMode?.description }}</span>

        <!-- 已自訂微調 Neutral 標籤 (text-sm) -->
        <span
          v-if="activeMode !== 'ALL' && isCustomized"
          class="text-sm font-medium text-base-content/80 bg-base-300 px-2 py-0.5 rounded leading-none ml-1 shrink-0"
        >
          {{ UI_STRINGS.PANEL.customized }}
        </span>
      </div>

      <!-- 右側動作：重設 + 展開/收合 (僅策略模式顯示微調按鈕) -->
      <div class="flex items-center gap-2 shrink-0">
        <template v-if="activeMode !== 'ALL'">
          <button
            v-if="isCustomized"
            type="button"
            class="btn btn-sm btn-ghost text-sm text-base-content/80 hover:text-base-content font-normal h-8 min-h-0"
            :title="UI_STRINGS.PANEL.resetBtn"
            @click="$emit('reset')"
          >
            {{ UI_STRINGS.PANEL.resetBtn }}
          </button>

          <button
            type="button"
            class="btn btn-sm btn-neutral gap-1.5 text-sm font-medium h-8 min-h-0"
            @click="isCollapsed = !isCollapsed"
          >
            <span>{{ isCollapsed ? UI_STRINGS.PANEL.adjustParams : UI_STRINGS.PANEL.collapseParams }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 transition-transform duration-200"
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
        <div class="text-sm font-bold text-base-content tracking-wide pb-1 border-b border-base-300/40 flex items-center justify-between">
          <span>{{ UI_STRINGS.PANEL.moduleMa }}</span>
        </div>

        <!-- A-1. 均線支撐 (maAboveMode) -->
        <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
          <span class="text-base-content/80">{{ UI_STRINGS.PANEL.maSupport }}</span>

          <!-- 跌深反轉模式：無限制 vs 站上 5MA -->
          <div
            v-if="activeMode === 'BOTTOM_REVERSAL'"
            class="inline-flex p-0.5 bg-base-300/50 rounded-lg text-sm font-numeric font-medium"
          >
            <button
              type="button"
              class="px-2.5 py-1 rounded-md transition-all text-sm"
              :class="params.maAboveMode === 'NONE' ? 'bg-base-100 font-bold text-base-content shadow-xs' : 'text-base-content/80'"
              @click="updateField('maAboveMode', 'NONE')"
            >
              {{ UI_STRINGS.PANEL.maAboveNone }}
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md transition-all text-sm"
              :class="params.maAboveMode === '5MA' || params.maAboveMode === 'MA5' ? 'bg-base-100 font-bold text-base-content shadow-xs' : 'text-base-content/80'"
              @click="updateField('maAboveMode', '5MA')"
            >
              {{ UI_STRINGS.PANEL.maAbove5ma }}
            </button>
          </div>

          <!-- 其他模式：同時站穩 5MA/10MA vs 站穩 5MA 或 10MA -->
          <div
            v-else
            class="inline-flex p-0.5 bg-base-300/50 rounded-lg text-sm font-numeric font-medium"
          >
            <button
              type="button"
              class="px-2.5 py-1 rounded-md transition-all text-sm"
              :class="params.maAboveMode === 'BOTH' ? 'bg-base-100 font-bold text-base-content shadow-xs' : 'text-base-content/80'"
              @click="updateField('maAboveMode', 'BOTH')"
            >
              {{ UI_STRINGS.PANEL.maAboveBoth }}
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md transition-all text-sm"
              :class="params.maAboveMode === 'ANY' ? 'bg-base-100 font-bold text-base-content shadow-xs' : 'text-base-content/80'"
              @click="updateField('maAboveMode', 'ANY')"
            >
              {{ UI_STRINGS.PANEL.maAboveAny }}
            </button>
          </div>
        </div>

        <!-- A-2. 月線斜率向上 (多頭回測與洗盤起漲專屬，底層靈魂條件) -->
        <div
          v-if="activeMode === 'TREND_PULLBACK' || activeMode === 'WASHOUT_IGNITION'"
          class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm"
        >
          <div class="flex items-center gap-2 text-base-content/85">
            <span class="inline-block w-2 h-2 rounded-full bg-success/80 shrink-0"></span>
            <span>{{ UI_STRINGS.PANEL.ma20Rising || '月線斜率向上 (當日 20MA > 前一日 20MA)' }}</span>
          </div>
          <span class="text-xs text-base-content/75 bg-base-300/60 px-2 py-0.5 rounded font-medium shrink-0">
            底層必備
          </span>
        </div>

        <!-- A-3. 當日三線價差 (僅底部蓄勢、動能攻擊、多頭回測模式顯示) -->
        <div
          v-if="activeMode === 'BOTTOM_CONSOLIDATION' || activeMode === 'MOMENTUM_BREAKOUT' || activeMode === 'TREND_PULLBACK'"
          class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm"
        >
          <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
            <input
              type="checkbox"
              class="checkbox checkbox-sm rounded"
              :checked="params.checkConvergence"
              @change="updateField('checkConvergence', $event.target.checked)"
            />
            <span>{{ UI_STRINGS.PANEL.convergence }}</span>
          </label>
          <div class="flex items-center gap-1.5 font-numeric text-sm">
            <span class="text-base-content/80">≤</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.convergenceMax"
              class="input input-bordered input-sm h-7 w-16 bg-base-100 text-center font-bold text-sm"
              @input="updateDebouncedNumericField('convergenceMax', $event.target.value)"
            />
            <span class="text-base-content/80">%</span>
          </div>
        </div>

        <!-- A-4. 前一日三線價差 (僅「動能攻擊」模式專用) -->
        <div
          v-if="activeMode === 'MOMENTUM_BREAKOUT'"
          class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm"
        >
          <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
            <input
              type="checkbox"
              class="checkbox checkbox-sm rounded"
              :checked="params.checkPrevConvergence"
              @change="updateField('checkPrevConvergence', $event.target.checked)"
            />
            <span>{{ UI_STRINGS.PANEL.prevConvergence }}</span>
          </label>
          <div class="flex items-center gap-1.5 font-numeric text-sm">
            <span class="text-base-content/80">≤</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.prevConvergenceMax"
              class="input input-bordered input-sm h-7 w-16 bg-base-100 text-center font-bold text-sm"
              @input="updateDebouncedNumericField('prevConvergenceMax', $event.target.value)"
            />
            <span class="text-base-content/80">%</span>
          </div>
        </div>

        <!-- A-5. 5MA 乖離率區間 (標準等高 38px 行) -->
        <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
          <span class="text-base-content/80">{{ UI_STRINGS.PANEL.bias5Range }}</span>
          <div class="flex items-center gap-1.5 font-numeric text-sm">
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias5Min"
              class="input input-bordered input-sm h-7 w-16 bg-base-100 text-center font-bold text-sm"
              @input="updateDebouncedNumericField('bias5Min', $event.target.value)"
            />
            <span class="text-base-content/50">{{ UI_STRINGS.PANEL.to }}</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias5Max"
              class="input input-bordered input-sm h-7 w-16 bg-base-100 text-center font-bold text-sm"
              @input="updateDebouncedNumericField('bias5Max', $event.target.value)"
            />
            <span class="text-base-content/80">%</span>
          </div>
        </div>

        <!-- A-6. 20MA 月線乖離率區間 (標準等高 38px 行) -->
        <div
          class="flex items-center justify-between min-h-[38px] py-1 text-sm"
          :class="{ 'border-b border-base-300/30': activeMode === 'BOTTOM_CONSOLIDATION' }"
        >
          <span class="text-base-content/80">{{ UI_STRINGS.PANEL.bias20Range }}</span>
          <div class="flex items-center gap-1.5 font-numeric text-sm">
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias20Min"
              class="input input-bordered input-sm h-7 w-16 bg-base-100 text-center font-bold text-sm"
              @input="updateDebouncedNumericField('bias20Min', $event.target.value)"
            />
            <span class="text-base-content/50">{{ UI_STRINGS.PANEL.to }}</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias20Max"
              class="input input-bordered input-sm h-7 w-16 bg-base-100 text-center font-bold text-sm"
              @input="updateDebouncedNumericField('bias20Max', $event.target.value)"
            />
            <span class="text-base-content/80">%</span>
          </div>
        </div>

        <!-- A-7. 站穩季線防身 (收盤價 >= 60MA) (嚴格限定僅底部蓄勢模式專屬) -->
        <div
          v-if="activeMode === 'BOTTOM_CONSOLIDATION'"
          class="flex items-center justify-between min-h-[38px] py-1 text-sm"
        >
          <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
            <input
              type="checkbox"
              class="checkbox checkbox-sm rounded"
              :checked="params.requireAboveMa60"
              @change="updateField('requireAboveMa60', $event.target.checked)"
            />
            <span>{{ UI_STRINGS.PANEL.aboveMa60 }}</span>
          </label>
        </div>
      </div>

      <!-- ============================================================
           模組 B：【量能與流動性】
           ============================================================ -->
      <div class="bg-base-100/60 rounded-xl p-3 md:p-3.5 space-y-1.5 border border-base-300/50">
        <div class="text-sm font-bold text-base-content tracking-wide pb-1 border-b border-base-300/40 flex items-center justify-between">
          <span>{{ UI_STRINGS.PANEL.moduleVol }}</span>
        </div>

        <!-- ==========================================
             Case 1: 跌深反轉 (Mode: BOTTOM_REVERSAL) 專屬順序
             ========================================== -->
        <template v-if="activeMode === 'BOTTOM_REVERSAL'">
          <!-- 1. 當日成交量 >= 1000 張 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkMinVolume !== false"
                @change="updateField('checkMinVolume', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.minVolume }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">≥</span>
              <input
                type="number"
                step="100"
                inputmode="numeric"
                :value="params.minVolume"
                class="input input-bordered input-sm h-7 w-20 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('minVolume', $event.target.value)"
              />
              <span class="text-base-content/80">張</span>
            </div>
          </div>

          <!-- 2. 排除處置股 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkNotDisposed !== false"
                @change="updateField('checkNotDisposed', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.notDisposed }}</span>
            </label>
          </div>

          <!-- 3. 低檔爆量攻擊 (當日量 > 5日量均) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkVolExpansion"
                @change="updateField('checkVolExpansion', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.volExpansionReversal || '低檔爆量攻擊 (當日量 > 5日量均)' }}</span>
            </label>
          </div>

          <!-- 4. 實體反轉紅 K (收盤 > 開盤 且 漲幅 >= 2%) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkRedCandle"
                @change="updateField('checkRedCandle', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.redCandleReversal || '實體反轉紅 K (收盤 > 開盤 且 漲幅 ≥ 2%)' }}</span>
            </label>
          </div>

          <!-- 5. 排除長上影線避雷針 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkAvoidLongUpperShadow"
                @change="updateField('checkAvoidLongUpperShadow', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.avoidUpperShadow }}</span>
            </label>
          </div>

          <!-- 6. KD 低檔超賣區轉折 (K: 10 至 40) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkKd !== false"
                @change="updateField('checkKd', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdFilter }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">K:</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMin"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMin', $event.target.value)"
              />
              <span class="text-base-content/50">{{ UI_STRINGS.PANEL.to }}</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMax"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMax', $event.target.value)"
              />
            </div>
          </div>

          <!-- 7. 要求 K > D 黃金交叉 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.kdRequireCross"
                @change="updateField('kdRequireCross', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdGoldenCross }}</span>
            </label>
          </div>
        </template>

        <!-- ==========================================
             Case 2: 底部蓄勢 (Mode: BOTTOM_CONSOLIDATION) 專屬順序
             ========================================== -->
        <template v-else-if="activeMode === 'BOTTOM_CONSOLIDATION'">
          <!-- 1. 當日成交量 >= 500 張 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkMinVolume !== false"
                @change="updateField('checkMinVolume', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.minVolume }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">≥</span>
              <input
                type="number"
                step="100"
                inputmode="numeric"
                :value="params.minVolume"
                class="input input-bordered input-sm h-7 w-20 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('minVolume', $event.target.value)"
              />
              <span class="text-base-content/80">張</span>
            </div>
          </div>

          <!-- 2. 排除處置股 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkNotDisposed !== false"
                @change="updateField('checkNotDisposed', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.notDisposed }}</span>
            </label>
          </div>

          <!-- 3. 嚴格量縮洗盤 (當日成交量 <= 5日均量) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkVolContraction"
                @change="updateField('checkVolContraction', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.volContraction }}</span>
            </label>
          </div>

          <!-- 4. 狹幅震盪打底 (漲跌幅 -1.5% ~ +1.5%) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkTightConsolidation"
                @change="updateField('checkTightConsolidation', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.tightConsolidation }}</span>
            </label>
          </div>

          <!-- 5. 排除長黑倒貨 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkAvoidLongBlack"
                @change="updateField('checkAvoidLongBlack', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.avoidLongBlack }}</span>
            </label>
          </div>

          <!-- 6. KD 脫離超賣區 (K 介於 20~60) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkKd !== false"
                @change="updateField('checkKd', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdFilter }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">K:</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMin"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMin', $event.target.value)"
              />
              <span class="text-base-content/50">{{ UI_STRINGS.PANEL.to }}</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMax"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMax', $event.target.value)"
              />
            </div>
          </div>

          <!-- 7. 要求 K > D 黃金交叉 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.kdRequireCross"
                @change="updateField('kdRequireCross', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdGoldenCross }}</span>
            </label>
          </div>
        </template>

        <!-- ==========================================
             Case 3: 動能攻擊 (Mode: MOMENTUM_BREAKOUT) 專屬順序
             ========================================== -->
        <template v-else-if="activeMode === 'MOMENTUM_BREAKOUT'">
          <!-- 1. 當日成交量 >= 1000 張 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkMinVolume !== false"
                @change="updateField('checkMinVolume', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.minVolume }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">≥</span>
              <input
                type="number"
                step="100"
                inputmode="numeric"
                :value="params.minVolume"
                class="input input-bordered input-sm h-7 w-20 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('minVolume', $event.target.value)"
              />
              <span class="text-base-content/80">張</span>
            </div>
          </div>

          <!-- 2. 昨日成交量 < 昨日 5 日均量 (MV5) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkPrevVolContraction"
                @change="updateField('checkPrevVolContraction', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.prevVolContraction }}</span>
            </label>
          </div>

          <!-- 3. 排除處置股 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkNotDisposed !== false"
                @change="updateField('checkNotDisposed', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.notDisposed }}</span>
            </label>
          </div>

          <!-- 4. 當日帶量攻擊 (當日成交量大於 5 日均量) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkVolExpansion"
                @change="updateField('checkVolExpansion', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.volExpansion }}</span>
            </label>
          </div>

          <!-- 5. 實體攻擊紅 K (收盤 > 開盤，且當日漲幅 >= 1.5%) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkRedCandle"
                @change="updateField('checkRedCandle', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.redCandle }}</span>
            </label>
          </div>

          <!-- 6. 排除長上影線避雷針 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkAvoidLongUpperShadow"
                @change="updateField('checkAvoidLongUpperShadow', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.avoidUpperShadow }}</span>
            </label>
          </div>

          <!-- 7. KD 動能區過濾 (強勢攻擊區，K: 50 至 100) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkKd !== false"
                @change="updateField('checkKd', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdFilter }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">K:</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMin"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMin', $event.target.value)"
              />
              <span class="text-base-content/50">{{ UI_STRINGS.PANEL.to }}</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMax"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMax', $event.target.value)"
              />
            </div>
          </div>

          <!-- 8. 要求 K > D 黃金交叉 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.kdRequireCross"
                @change="updateField('kdRequireCross', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdGoldenCross }}</span>
            </label>
          </div>
        </template>

        <!-- ==========================================
             Case 4: 多頭回測 (Mode: TREND_PULLBACK) 專屬順序
             ========================================== -->
        <template v-else-if="activeMode === 'TREND_PULLBACK'">
          <!-- 1. 最低成交量門檻 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkMinVolume !== false"
                @change="updateField('checkMinVolume', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.minVolume }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">≥</span>
              <input
                type="number"
                step="100"
                inputmode="numeric"
                :value="params.minVolume"
                class="input input-bordered input-sm h-7 w-20 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('minVolume', $event.target.value)"
              />
              <span class="text-base-content/80">張</span>
            </div>
          </div>

          <!-- 2. 排除處置股 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkNotDisposed !== false"
                @change="updateField('checkNotDisposed', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.notDisposed }}</span>
            </label>
          </div>

          <!-- 3. 量縮回踩 (量 < 5日量均 或 < 昨日量) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkVolPullback"
                @change="updateField('checkVolPullback', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.volPullback }}</span>
            </label>
          </div>

          <!-- 4. 排除長黑倒貨 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkAvoidLongBlack"
                @change="updateField('checkAvoidLongBlack', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.avoidLongBlack }}</span>
            </label>
          </div>

          <!-- 5. KD 動能區過濾 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkKd !== false"
                @change="updateField('checkKd', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdFilter }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">K:</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMin"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMin', $event.target.value)"
              />
              <span class="text-base-content/50">{{ UI_STRINGS.PANEL.to }}</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMax"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMax', $event.target.value)"
              />
            </div>
          </div>
        </template>

        <!-- ==========================================
             Case 5: 洗盤起漲 (Mode: WASHOUT_IGNITION) 專屬順序
             ========================================== -->
        <template v-else-if="activeMode === 'WASHOUT_IGNITION'">

          <!-- 1. 當日成交量 >= 1000 張 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkMinVolume !== false"
                @change="updateField('checkMinVolume', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.minVolume }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">≥</span>
              <input
                type="number"
                step="100"
                inputmode="numeric"
                :value="params.minVolume"
                class="input input-bordered input-sm h-7 w-20 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('minVolume', $event.target.value)"
              />
              <span class="text-base-content/80">張</span>
            </div>
          </div>

          <!-- 2. 排除處置股 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkNotDisposed !== false"
                @change="updateField('checkNotDisposed', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.notDisposed }}</span>
            </label>
          </div>

          <!-- 3. 洗盤後帶量攻擊 (當日量 > 5日量均) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkVolExpansion"
                @change="updateField('checkVolExpansion', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.volExpansionPullback || '洗盤後帶量攻擊 (當日量 > 5日量均)' }}</span>
            </label>
          </div>

          <!-- 4. 實體攻擊紅 K (收盤 > 開盤 且 漲幅 >= 2%) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkRedCandle"
                @change="updateField('checkRedCandle', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.redCandle2Pct || '實體攻擊紅 K (收盤 > 開盤 且 漲幅 ≥ 2%)' }}</span>
            </label>
          </div>

          <!-- 5. 排除長上影線避雷針 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkAvoidLongUpperShadow"
                @change="updateField('checkAvoidLongUpperShadow', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.avoidUpperShadow }}</span>
            </label>
          </div>

          <!-- 6. KD 中檔降溫區轉折 (K: 30 至 65) -->
          <div class="flex items-center justify-between min-h-[38px] py-1 border-b border-base-300/30 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
                :checked="params.checkKd !== false"
                @change="updateField('checkKd', $event.target.checked)"
              />
              <span>{{ UI_STRINGS.PANEL.kdFilter }}</span>
            </label>
            <div class="flex items-center gap-1.5 font-numeric text-sm">
              <span class="text-base-content/80">K:</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMin"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMin', $event.target.value)"
              />
              <span class="text-base-content/50">{{ UI_STRINGS.PANEL.to }}</span>
              <input
                type="number"
                step="5"
                inputmode="numeric"
                :value="params.kdKMax"
                class="input input-bordered input-sm h-7 w-14 bg-base-100 text-center font-bold text-sm"
                @input="updateDebouncedNumericField('kdKMax', $event.target.value)"
              />
            </div>
          </div>

          <!-- 7. 要求 K > D 多頭排列 -->
          <div class="flex items-center justify-between min-h-[38px] py-1 text-sm">
            <label class="flex items-center gap-2 cursor-pointer select-none text-base-content/85">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded"
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
import TimeMachineBar from './TimeMachineBar.vue'

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
  dayOffset: {
    type: Number,
    default: 0,
  },
  updatedAt: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:activeMode', 'update:params', 'reset', 'update:dayOffset'])

// 預設收闔（使用者可自由展開微調）
const isCollapsed = ref(true)

// 當前模式物件
const currentMode = computed(() => {
  return props.modes?.[props.activeMode] || {}
})

// 手機端精簡標籤 (依生命週期順序)
function getShortModeLabel(modeId) {
  switch (modeId) {
    case 'BOTTOM_REVERSAL':
      return '反轉'
    case 'BOTTOM_CONSOLIDATION':
      return '底部'
    case 'MOMENTUM_BREAKOUT':
      return '動能'
    case 'TREND_PULLBACK':
      return '回測'
    case 'WASHOUT_IGNITION':
      return '起漲'
    default:
      return modeId
  }
}


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
