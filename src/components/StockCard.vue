<template>
  <div
    class="stock-card bg-base-200 border border-base-300 rounded-xl p-6 transition-all duration-200 hover:shadow-md hover:border-base-content/20 [content-visibility:auto] [contain-intrinsic-size:160px]"
  >
    <!-- ============================================================
         手機端佈局 (< 1024px)：由上而下 5 層自然排列
         ============================================================ -->
    <div class="block lg:hidden space-y-3">
      <!-- 第 1 層：主焦點 (代號、名稱、即時現價同為 text-lg，漲跌幅為 text-sm) -->
      <div class="flex items-baseline justify-between gap-2">
        <div class="flex items-baseline gap-2 min-w-0">
          <span class="font-numeric font-bold text-lg text-base-content tracking-wide">{{ stock.code }}</span>
          <span class="font-bold text-lg text-base-content truncate">{{ stock.name }}</span>
          <span v-if="stock.isDisposed" class="font-bold text-sm text-error tracking-tight">
            [{{ UI_STRINGS.SCREENER.disposed }}]
          </span>
        </div>
        <div class="flex items-baseline gap-1.5 shrink-0 font-numeric">
          <span class="text-lg font-bold" :class="priceColorClass">
            {{ formatNumber(stock.price) }}
          </span>
          <span class="text-sm font-semibold" :class="changeColorClass">
            {{ formatChange(stock.change, stock.changePct) }}
          </span>
        </div>
      </div>

      <!-- 第 2 層：標籤純文字 (統一 text-sm font-normal, text-base-content/80) -->
      <div v-if="categoryLabels.length > 0 || sellWarningText" class="text-sm font-normal text-base-content/80 leading-normal">
        <span v-if="categoryLabels.length > 0">{{ categoryLabels.join(' · ') }}</span>
        <span v-if="categoryLabels.length > 0 && sellWarningText" class="text-base-content/40"> · </span>
        <span v-if="sellWarningText" class="inline-flex items-center text-base-content/80">
          <svg class="inline-block w-3.5 h-3.5 shrink-0 align-[-0.12em] mr-1" viewBox="0 0 16 16" fill="none">
            <path d="M7.134 1.5a1 1 0 011.732 0l6.062 10.5A1 1 0 0114.062 13.5H1.938a1 1 0 01-.866-1.5L7.134 1.5z" fill="#F59E0B" />
            <path d="M8 5.5v3.5" stroke="#18181B" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="8" cy="11.25" r="0.8" fill="#18181B" />
          </svg>
          <span>{{ sellWarningText }}</span>
        </span>
      </div>

      <!-- 籌碼透視區塊（籌碼集中度 + 短沖避雷，頂部細分隔線 + 緊湊間距 + 基本文字色 + 百分比加粗） -->
      <div
        v-if="hasChipsSection"
        class="pt-2 pb-1.5 border-t border-base-300/40 space-y-1 text-sm font-normal text-base-content/80 leading-normal"
      >
        <!-- 籌碼集中度 (百分比加粗，正值紅字，帶明確空白) -->
        <div v-if="chipsConcentrationItems.length > 0" class="font-numeric flex items-baseline flex-wrap">
          <span class="mr-2">{{ UI_STRINGS.CHIPS.concentrationLabel }}</span>
          <template v-for="(item, idx) in chipsConcentrationItems" :key="item.label">
            <span class="inline-flex items-baseline gap-1">
              <span>{{ item.label }}</span>
              <strong class="font-bold" :class="item.isPositive ? 'text-rise' : 'text-base-content'">{{ item.val }}</strong>
            </span>
            <span v-if="idx < chipsConcentrationItems.length - 1" class="text-base-content/40 mx-1.5">·</span>
          </template>
        </div>

        <!-- 短沖避雷 (基本文字色，百分比加粗，已依指令移除左側驚嘆號圖示) -->
        <div v-if="dayTradersInfo" class="font-numeric flex items-center">
          <span>
            <span>{{ UI_STRINGS.CHIPS.dayTradersPrefix || '短沖佔 ' }}</span>
            <strong class="font-bold text-base-content">{{ dayTradersInfo.pct }}</strong>
            <span v-if="dayTradersInfo.branchesText"> ({{ dayTradersInfo.branchesText }})</span>
          </span>
        </div>
      </div>


      <!-- ★ 預留槽位 A：天花板關卡價與預期純利 (暫時註解隱藏) -->
      <!--
      <div
        v-if="ceilingInfo"
        class="flex items-center justify-between text-sm font-normal leading-normal py-1.5 px-2.5 rounded-lg bg-base-300/40 cursor-pointer hover:bg-base-300/70 transition-colors"
        @click="$emit('openRiskModal', stock)"
      >
        <span class="text-base-content/80">
          {{ ceilingInfo.type }} <strong class="font-numeric font-bold text-base-content">{{ formatNumber(ceilingInfo.price) }}</strong>
        </span>
        <span class="font-bold" :class="ceilingInfo.netProfitPct >= 0 ? 'text-rise' : 'text-base-content/80'">
          {{ UI_STRINGS.METRICS.expectedProfit }} {{ ceilingInfo.netProfitPct >= 0 ? '+' : '' }}{{ ceilingInfo.netProfitPct }}% ↗
        </span>
      </div>
      -->

      <!-- 第 3 層：Sparkline 技術走勢圖 (純淨走勢) -->
      <div class="py-1 flex items-center justify-center">
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
      <div
        v-if="filterEvaluationText"
        class="text-sm font-normal leading-normal py-1.5 px-2.5 rounded-lg border transition-colors"
        :class="[
          isUnmatched ? 'bg-base-300/30 border-base-300/60 text-base-content/75' : 'bg-base-300/50 border-base-300/80 text-base-content',
          hasEvaluationDetails ? 'cursor-pointer hover:bg-base-300/70' : ''
        ]"
        @click="hasEvaluationDetails && (isDetailsExpanded = !isDetailsExpanded)"
      >
        <div class="flex items-center justify-between gap-1.5 select-none">
          <span class="font-medium flex-1">{{ filterEvaluationText }}</span>
          <span
            v-if="hasEvaluationDetails"
            class="text-xs text-base-content/60 flex items-center gap-0.5 shrink-0"
          >
            <span>{{ isDetailsExpanded ? (isUnmatched ? (UI_STRINGS.SCREENER.collapseDiagnosis || '收合診斷') : (UI_STRINGS.SCREENER.collapseDetails || '收合細節')) : (isUnmatched ? (UI_STRINGS.SCREENER.expandDiagnosis || '展開診斷') : (UI_STRINGS.SCREENER.expandDetails || '展開細節')) }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': isDetailsExpanded }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>

        <!-- 展開後的純文字指標通關診斷清單 (允許選取複製文字) -->
        <div
          v-if="isDetailsExpanded && hasEvaluationDetails"
          class="pt-2 mt-2 border-t border-base-300/40 space-y-1 text-xs font-numeric select-text cursor-auto"
          @click.stop
        >
          <div
            v-for="(item, idx) in evaluationDetails"
            :key="idx"
            class="flex items-start gap-1.5 leading-relaxed"
          >
            <span
              class="shrink-0 font-bold"
              :class="item.pass ? 'text-success' : 'text-error'"
            >
              {{ item.pass ? '✓' : '✗' }}
            </span>
            <span class="text-base-content/90">
              <strong class="text-base-content font-semibold">{{ item.label }}：</strong>{{ item.desc }}
            </span>
          </div>
        </div>
      </div>

      <!-- 第 5 層：極簡快捷操作列 (統一 text-sm font-normal) -->
      <div class="flex items-center justify-between pt-2 border-t border-base-300/60 text-sm font-normal text-base-content/80 leading-normal">
        <button
          type="button"
          class="hover:text-base-content inline-flex items-center gap-1 transition-colors"
          @click="handleCopy"
        >
          <svg v-if="copied" class="w-3.5 h-3.5 text-base-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span :class="{ 'font-bold text-base-content': copied }">{{ copied ? UI_STRINGS.ACTIONS.copied : UI_STRINGS.ACTIONS.copy }}</span>
        </button>

        <div class="flex items-center gap-2.5">
          <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/institutional-trading`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
            {{ UI_STRINGS.ACTIONS.chips }}
          </a>
          <span class="text-base-content/40">·</span>
          <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/bullbear`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
            {{ UI_STRINGS.ACTIONS.bullbear }}
          </a>
          <span class="text-base-content/40">·</span>
          <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcn/zcn_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
            {{ UI_STRINGS.ACTIONS.margin }}
          </a>
          <span class="text-base-content/40">·</span>
          <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">
            {{ UI_STRINGS.ACTIONS.afterMarket }}
          </a>
        </div>
      </div>
    </div>

    <!-- ============================================================
         電腦端佈局 (>= 1024px)：水平 3 欄式寬扁卡片 (左 3/12: 走勢KD | 中 5/12: 報價操作與籌碼 | 右 4/12: 均線量能)
         ============================================================ -->
    <div class="hidden lg:grid lg:grid-cols-12 lg:gap-5 lg:items-end">
      <!-- 左欄 (3/12)：走勢圖 (純淨走勢，靠左微收) -->
      <div class="lg:col-span-3 pr-2 flex items-center justify-center">
        <Sparkline
          :history="stock.history10d"
          :stock="stock"
          :stock-code="stock.code"
        />
      </div>

      <!-- 中欄 (5/12)：代號、名稱、報價、標籤與快捷操作 (加大水平空間，餘裕飽滿) -->
      <div class="lg:col-span-5 space-y-2 px-3 border-l border-r border-base-300/60">
        <!-- 核心報價 (代號、名稱、即時現價同為 text-lg，漲跌幅為 text-sm) -->
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="font-numeric font-bold text-lg text-base-content">{{ stock.code }}</span>
            <span class="font-bold text-lg text-base-content truncate">{{ stock.name }}</span>
            <span v-if="stock.isDisposed" class="font-bold text-sm text-error">
              [{{ UI_STRINGS.SCREENER.disposed }}]
            </span>
          </div>
          <div class="flex items-baseline gap-1.5 shrink-0 font-numeric">
            <span class="text-lg font-bold" :class="priceColorClass">{{ formatNumber(stock.price) }}</span>
            <span class="text-sm font-semibold" :class="changeColorClass">{{ formatChange(stock.change, stock.changePct) }}</span>
          </div>
        </div>

        <!-- 標籤 (統一 text-sm font-normal) -->
        <div v-if="categoryLabels.length > 0 || sellWarningText" class="text-sm font-normal text-base-content/80 leading-normal">
          <span v-if="categoryLabels.length > 0">{{ categoryLabels.join(' · ') }}</span>
          <span v-if="categoryLabels.length > 0 && sellWarningText" class="text-base-content/40"> · </span>
          <span v-if="sellWarningText" class="inline-flex items-center text-base-content/80">
            <svg class="inline-block w-3.5 h-3.5 shrink-0 align-[-0.12em] mr-1" viewBox="0 0 16 16" fill="none">
              <path d="M7.134 1.5a1 1 0 011.732 0l6.062 10.5A1 1 0 0114.062 13.5H1.938a1 1 0 01-.866-1.5L7.134 1.5z" fill="#F59E0B" />
              <path d="M8 5.5v3.5" stroke="#18181B" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="8" cy="11.25" r="0.8" fill="#18181B" />
            </svg>
            <span>{{ sellWarningText }}</span>
          </span>
        </div>

        <!-- 籌碼透視區塊（籌碼集中度 + 短沖避雷，上下細分隔線 + 緊湊間距 + 基本文字色 + 百分比加粗） -->
        <div
          v-if="hasChipsSection"
          class="pt-2 pb-2 border-t border-b border-base-300/40 space-y-1 text-sm font-normal text-base-content/80 leading-normal"
        >
          <!-- 籌碼集中度 (百分比加粗，正值紅字，帶明確空白) -->
          <div v-if="chipsConcentrationItems.length > 0" class="font-numeric flex items-baseline flex-wrap">
            <span class="mr-2">{{ UI_STRINGS.CHIPS.concentrationLabel }}</span>
            <template v-for="(item, idx) in chipsConcentrationItems" :key="item.label">
              <span class="inline-flex items-baseline gap-1">
                <span>{{ item.label }}</span>
                <strong class="font-bold" :class="item.isPositive ? 'text-rise' : 'text-base-content'">{{ item.val }}</strong>
              </span>
              <span v-if="idx < chipsConcentrationItems.length - 1" class="text-base-content/40 mx-1.5">·</span>
            </template>
          </div>

          <!-- 短沖避雷 (基本文字色，百分比加粗，已依指令移除左側驚嘆號圖示) -->
          <div v-if="dayTradersInfo" class="font-numeric flex items-center">
            <span>
              <span>{{ UI_STRINGS.CHIPS.dayTradersPrefix || '短沖佔 ' }}</span>
              <strong class="font-bold text-base-content">{{ dayTradersInfo.pct }}</strong>
              <span v-if="dayTradersInfo.branchesText"> ({{ dayTradersInfo.branchesText }})</span>
            </span>
          </div>
        </div>


        <!-- ★ 預留槽位 A (電腦端，暫時註解隱藏) -->
        <!--
        <div
          v-if="ceilingInfo"
          class="flex items-center justify-between text-sm font-normal leading-normal py-1 px-2 rounded bg-base-300/40 cursor-pointer hover:bg-base-300/70 transition-colors"
          @click="$emit('openRiskModal', stock)"
        >
          <span class="text-base-content/80">
            {{ ceilingInfo.type }} <strong class="font-numeric font-bold text-base-content">{{ formatNumber(ceilingInfo.price) }}</strong>
          </span>
          <span class="font-bold" :class="ceilingInfo.netProfitPct >= 0 ? 'text-rise' : 'text-base-content/80'">
            {{ UI_STRINGS.METRICS.expectedProfit }} {{ ceilingInfo.netProfitPct >= 0 ? '+' : '' }}{{ ceilingInfo.netProfitPct }}% ↗
          </span>
        </div>
        -->

        <!-- 快捷操作列 (統一 text-sm font-normal) -->
        <div class="flex items-center gap-2.5 text-sm font-normal text-base-content/80 leading-normal pt-0.5">
          <button
            type="button"
            class="hover:text-base-content inline-flex items-center gap-1 transition-colors"
            @click="handleCopy"
          >
            <svg v-if="copied" class="w-3.5 h-3.5 text-base-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span :class="{ 'font-bold text-base-content': copied }">{{ copied ? UI_STRINGS.ACTIONS.copied : UI_STRINGS.ACTIONS.copy }}</span>
          </button>
          <span class="text-base-content/40">|</span>
          <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/institutional-trading`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.chips }}</a>
          <span class="text-base-content/40">·</span>
          <a :href="`https://tw.finance.yahoo.com/quote/${stock.code}.TW/bullbear`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.bullbear }}</a>
          <span class="text-base-content/40">·</span>
          <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcn/zcn_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.margin }}</a>
          <span class="text-base-content/40">·</span>
          <a :href="`https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stock.code}.djhtm`" target="_blank" rel="noopener" class="hover:text-base-content hover:underline">{{ UI_STRINGS.ACTIONS.afterMarket }}</a>
        </div>
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
      <div
        v-if="filterEvaluationText"
        class="lg:col-span-12 text-sm font-normal leading-normal py-1.5 px-3 rounded-lg border transition-colors mt-1"
        :class="[
          isUnmatched ? 'bg-base-300/30 border-base-300/60 text-base-content/75' : 'bg-base-300/50 border-base-300/80 text-base-content',
          hasEvaluationDetails ? 'cursor-pointer hover:bg-base-300/70' : ''
        ]"
        @click="hasEvaluationDetails && (isDetailsExpanded = !isDetailsExpanded)"
      >
        <div class="flex items-center justify-between gap-2 select-none">
          <span class="font-medium">{{ filterEvaluationText }}</span>
          <span
            v-if="hasEvaluationDetails"
            class="text-xs text-base-content/60 flex items-center gap-0.5 shrink-0"
          >
            <span>{{ isDetailsExpanded ? (isUnmatched ? (UI_STRINGS.SCREENER.collapseDiagnosis || '收合診斷') : (UI_STRINGS.SCREENER.collapseDetails || '收合細節')) : (isUnmatched ? (UI_STRINGS.SCREENER.expandDiagnosis || '展開診斷') : (UI_STRINGS.SCREENER.expandDetails || '展開細節')) }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': isDetailsExpanded }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>

        <!-- 展開後的純文字指標通關診斷清單 (允許選取複製文字) -->
        <div
          v-if="isDetailsExpanded && hasEvaluationDetails"
          class="pt-2 mt-2 border-t border-base-300/40 space-y-1 text-xs sm:text-sm font-numeric select-text cursor-auto"
          @click.stop
        >
          <div
            v-for="(item, idx) in evaluationDetails"
            :key="idx"
            class="flex items-start gap-1.5 leading-relaxed"
          >
            <span
              class="shrink-0 font-bold"
              :class="item.pass ? 'text-success' : 'text-error'"
            >
              {{ item.pass ? '✓' : '✗' }}
            </span>
            <span class="text-base-content/90">
              <strong class="text-base-content font-semibold">{{ item.label }}：</strong>{{ item.desc }}
            </span>
          </div>
        </div>
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
  if (props.stock.isLimitUp || pct >= 9.5) {
    return 'bg-rise text-white px-1.5 py-0.5 rounded font-bold shadow-xs'
  }
  if (props.stock.isLimitDown || pct <= -9.5) {
    return 'bg-fall text-white px-1.5 py-0.5 rounded font-bold shadow-xs'
  }
  if (pct > 0) return 'text-rise'
  if (pct < 0) return 'text-fall'
  return 'text-flat'
})

const changeColorClass = computed(() => {
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
  return bias5.value > 0 ? 'text-rise' : bias5.value < 0 ? 'text-fall' : 'text-base-content/75'
})

const bias20ColorClass = computed(() => {
  return bias20.value > 0 ? 'text-rise' : bias20.value < 0 ? 'text-fall' : 'text-base-content/75'
})

const categoryLabels = computed(() => {
  const cats = props.stock.categories
  const tagMap = UI_STRINGS.CATEGORY_TAGS || {}
  const labels = Array.isArray(cats)
    ? cats
        .filter((c) => !c.includes('Sell')) // 排除賣超標籤（已在右側 ⚠️ sellWarningText 警示列統一獨立展示）
        .map((c) => tagMap[c] || c)
        .filter(Boolean)
    : []
  return Array.from(new Set(labels))
})

const sellWarningText = computed(() => {
  if (!props.stock.sellWarning) return ''
  return props.stock.sellWarning.replace(/^⚠️\s*/, '')
})

const chipsConcentrationItems = computed(() => {
  const chips = props.stock.chips
  if (!chips) return []
  const { concentration1d: d1, concentration3d: d3, concentration5d: d5 } = chips
  if (d1 == null && d3 == null && d5 == null) return []
  const items = []
  if (d1 != null) items.push({ label: '1D', val: `${d1 >= 0 ? '+' : ''}${Number(d1).toFixed(1)}%`, isPositive: d1 > 0 })
  if (d3 != null) items.push({ label: '3D', val: `${d3 >= 0 ? '+' : ''}${Number(d3).toFixed(1)}%`, isPositive: d3 > 0 })
  if (d5 != null) items.push({ label: '5D', val: `${d5 >= 0 ? '+' : ''}${Number(d5).toFixed(1)}%`, isPositive: d5 > 0 })
  return items
})

const dayTradersInfo = computed(() => {
  const chips = props.stock.chips
  if (!chips) return null
  const branches = chips.dayTradersBranches ?? []
  if (branches.length === 0) return null
  const pct = typeof chips.dayTradersPct === 'number' ? chips.dayTradersPct.toFixed(1) : (chips.dayTradersPct ?? '0.0')
  return {
    pct: `${pct}%`,
    branchesText: branches.join(' · '),
  }
})

const hasChipsSection = computed(() => {
  return chipsConcentrationItems.value.length > 0 || !!dayTradersInfo.value
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
  // Fallback: 如果 stock 有 high5d，自動算出第一關卡
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

const isDetailsExpanded = ref(false)

const evaluationDetails = computed(() => {
  return props.stock?.filterEvaluation?.details || props.filterEvaluation?.details || []
})

const hasEvaluationDetails = computed(() => {
  return evaluationDetails.value.length > 0
})

const filterEvaluationText = computed(() => {
  // Case 1: 在「全部股票 (ALL)」模式下
  if (props.activeMode === 'ALL') {
    const matchedModes = props.stock?.matchedModes || []
    if (matchedModes.length > 0) {
      return UI_STRINGS.SCREENER.matchedStrategy(matchedModes.join(' · '))
    }
    return UI_STRINGS.SCREENER.noMatchedStrategy
  }

  // Case 2: 在特定模式下，若為「未符合/淘汰個股」
  if (props.isUnmatched) {
    const details = evaluationDetails.value || []
    const failedItems = details.filter((item) => !item.pass)

    if (failedItems.length > 0) {
      const shortMap = UI_STRINGS.SCREENER.shortFailLabels || {}
      const labels = failedItems.map((item) => {
        if (item.label === '均線支撐') {
          if (item.desc && (item.desc.includes('10MA') || item.desc.includes('雙均線'))) {
            return '未站穩均線'
          }
          return shortMap['均線支撐'] || '未站穩 5MA'
        }
        const rawKey = item.label || ''
        const noSpaceKey = rawKey.replace(/\s+/g, '')
        const spacedKey = rawKey
          .replace(/([A-Za-z0-9]+)([\u4e00-\u9fa5]+)/g, '$1 $2')
          .replace(/([\u4e00-\u9fa5]+)([A-Za-z0-9]+)/g, '$1 $2')
        return shortMap[rawKey] || shortMap[noSpaceKey] || shortMap[spacedKey] || rawKey
      })
      const reasonsText = labels.join(' · ')
      return UI_STRINGS.SCREENER.unmatchedSummary
        ? UI_STRINGS.SCREENER.unmatchedSummary(failedItems.length, reasonsText)
        : `${failedItems.length} 項未達標：${reasonsText}`
    }

    const reason = props.stock?.filterEvaluation?.reasonText || props.filterEvaluation?.reasonText
    if (!reason) return null
    return `${UI_STRINGS.SCREENER.unmatchedReasonPrefix}${reason}`
  }

  // Case 3: 在特定模式下，若為「符合個股」 (使用 emoji 💡)
  const modeLabels = {
    BOTTOM_REVERSAL: '跌深反轉',
    BOTTOM_CONSOLIDATION: '底部蓄勢',
    MOMENTUM_BREAKOUT: '動能攻擊',
    TREND_PULLBACK: '多頭回測',
    WASHOUT_IGNITION: '洗盤起漲',
  }
  const currentModeName = modeLabels[props.activeMode] || ''
  if (currentModeName) {
    return UI_STRINGS.SCREENER.matchedCondition(currentModeName)
  }

  return props.stock?.filterEvaluation?.reasonText || null
})
</script>
