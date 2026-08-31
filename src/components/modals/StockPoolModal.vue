<template>
  <dialog :class="{ 'modal-open': isOpen }" class="modal modal-bottom sm:modal-middle select-none z-50">
    <div
      class="modal-box max-w-4xl w-full bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col"
    >
      <!-- Modal Header -->
      <div class="flex items-start justify-between pb-3 border-b border-base-300/80 shrink-0">
        <div>
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-base-content/80"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 class="font-bold text-base sm:text-lg text-base-content">
              {{ UI_STRINGS.STOCK_POOL_MODAL.title }}
            </h3>
          </div>
          <p class="text-xs text-base-content/70 mt-0.5">
            {{ UI_STRINGS.STOCK_POOL_MODAL.totalStocks(stocks?.length || 0) }}
            <span v-if="updatedAtText"> · {{ updatedAtText }}</span>
          </p>
        </div>

        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle text-base-content/70 hover:text-base-content cursor-pointer"
          :aria-label="UI_STRINGS.STOCK_POOL_MODAL.closeBtn"
          @click="$emit('close')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 1. 一級大類分組切換 (Group Tabs) -->
      <div class="flex items-center gap-1.5 p-1 bg-base-200/80 rounded-xl overflow-x-auto shrink-0 scrollbar-none">
        <button
          v-for="grp in groupOptions"
          :key="grp.id"
          type="button"
          class="py-1.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer"
          :class="selectedGroup === grp.id
            ? 'bg-base-100 text-base-content font-bold shadow-xs'
            : 'text-base-content/70 hover:text-base-content'"
          @click="selectedGroup = grp.id"
        >
          {{ grp.label }}
        </button>
      </div>

      <!-- 2. 二級來源分頁籤 (Source Tabs) -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
        <button
          v-for="src in filteredSources"
          :key="src.id"
          type="button"
          class="btn btn-sm h-8 min-h-0 px-2.5 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1.5 cursor-pointer shadow-none transition-colors border"
          :class="selectedSourceId === src.id
            ? 'bg-neutral text-neutral-content border-neutral font-bold'
            : 'bg-base-200/60 hover:bg-base-300/80 text-base-content/80 border-base-300/60'"
          @click="selectedSourceId = src.id"
        >
          <span>{{ src.name }}</span>
          <span
            class="px-1.5 py-0.2 rounded-md text-[11px] font-numeric"
            :class="selectedSourceId === src.id ? 'bg-neutral-content/20 text-neutral-content' : 'bg-base-300 text-base-content/80'"
          >
            {{ getSourceCount(src) }}
          </span>
        </button>
      </div>

      <!-- 3. 選中來源詳情面板 (Content Panel) -->
      <div v-if="currentSource" class="flex-1 overflow-y-auto space-y-3 pr-1">
        <!-- 來源資訊與原始連結卡片 (方便肉眼對照爬蟲端點) -->
        <div class="p-3 bg-base-200/50 border border-base-300/70 rounded-xl space-y-2">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-baseline gap-2">
              <span class="font-bold text-sm sm:text-base text-base-content">{{ currentSource.name }}</span>
              <span class="text-xs text-base-content/70 font-numeric">
                (共 {{ currentSourceRawStocks.length }} 筆)
              </span>
            </div>

            <!-- 原始 URL 連結按鈕組 (開新分頁看富邦/MoneyDJ/證交所原始網頁) -->
            <div class="flex items-center gap-2 flex-wrap text-xs">
              <span class="text-base-content/60">{{ UI_STRINGS.STOCK_POOL_MODAL.sourceUrlLabel }}：</span>
              <a
                v-for="link in currentSource.urls"
                :key="link.url"
                :href="link.url"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 px-2.5 py-1 bg-base-100 hover:bg-base-300/60 border border-base-300 rounded-lg text-base-content/80 hover:text-base-content transition-colors font-medium"
                :title="link.url"
              >
                <span>{{ link.label }}</span>
                <span class="text-base-content/50 font-mono text-[10px]">({{ link.endpoint }})</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <!-- 搜尋過濾與複製代號列 -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="relative flex-1 max-w-xs">
            <input
              v-model="innerSearchQuery"
              type="text"
              class="input input-sm w-full bg-base-200 border-base-300 rounded-lg text-xs pr-7 focus:outline-hidden"
              :placeholder="UI_STRINGS.STOCK_POOL_MODAL.searchInPoolPlaceholder"
            />
            <button
              v-if="innerSearchQuery"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
              @click="innerSearchQuery = ''"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            class="btn btn-sm btn-ghost gap-1 text-xs text-base-content/75 hover:text-base-content h-8 min-h-0 px-2.5 rounded-lg transition-colors cursor-pointer shadow-none"
            @click="handleCopyAllCodes"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{{ isCopied ? '已複製代號' : UI_STRINGS.STOCK_POOL_MODAL.copyCodesBtn }}</span>
          </button>
        </div>

        <!-- 4. V1 風格直式對帳表格 (順序由上而下，方便肉眼對照) -->
        <div class="overflow-x-auto border border-base-300/80 rounded-xl bg-base-100">
          <table class="table table-sm w-full font-numeric text-left">
            <!-- Table Header -->
            <thead class="bg-base-200/70 text-base-content/70 text-xs border-b border-base-300/80">
              <tr>
                <th class="w-14 py-2.5 px-3 text-left font-semibold">編號</th>
                <th class="w-28 py-2.5 px-3 text-left font-semibold">股票代號</th>
                <th class="py-2.5 px-3 text-left font-semibold">股票名稱</th>
                <th class="w-20 py-2.5 px-3 text-left font-semibold">市場</th>
                <th class="py-2.5 px-3 text-right font-semibold">
                  {{ currentSource.metricHeader || '數值' }}
                </th>
              </tr>
            </thead>

            <!-- Table Body -->
            <tbody class="divide-y divide-base-200/80 text-sm font-normal">
              <tr
                v-for="(row, idx) in displayedTableRows"
                :key="row.code + '_' + idx"
                class="hover:bg-base-200/70 transition-colors cursor-pointer"
                :title="`點擊在主畫面搜尋 ${row.name} (${row.code})`"
                @click="handleStockClick(row)"
              >
                <!-- 編號 (#1, #2, #3...) -->
                <td class="py-2 px-3 text-base-content/40 font-medium text-xs">
                  #{{ row.rawIndex ?? (idx + 1) }}
                </td>

                <!-- 股票代號 -->
                <td class="py-2 px-3 font-bold text-base-content">
                  {{ row.code }}
                </td>

                <!-- 股票名稱 -->
                <td class="py-2 px-3 font-medium text-base-content/90 truncate max-w-[180px]">
                  {{ row.name }}
                </td>

                <!-- 市場 (上市 / 上櫃 藍底徽章) -->
                <td class="py-2 px-3">
                  <span
                    class="px-2 py-0.5 rounded text-xs font-medium"
                    :class="row.market === 'otc' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-info/10 text-info border border-info/20'"
                  >
                    {{ row.market === 'otc' ? '上櫃' : '上市' }}
                  </span>
                </td>

                <!-- 數值 / 買超張數 / 成交量 / 週轉率 / 權重 -->
                <td class="py-2 px-3 text-right">
                  <span :class="row.metricColorClass" class="font-semibold">
                    {{ row.metricValue }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="displayedTableRows.length === 0" class="py-12 text-center text-xs text-base-content/50">
            {{ UI_STRINGS.STOCK_POOL_MODAL.noStockInSource }}
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-action pt-2 border-t border-base-300/80 shrink-0">
        <button
          type="button"
          class="btn btn-sm btn-neutral h-8 min-h-0 px-4 rounded-lg cursor-pointer shadow-none"
          @click="$emit('close')"
        >
          {{ UI_STRINGS.STOCK_POOL_MODAL.closeBtn }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="$emit('close')">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { UI_STRINGS } from '../../constants/ui-strings.js'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  stocks: {
    type: Array,
    default: () => [],
  },
  rankings: {
    type: Object,
    default: () => ({}),
  },
  updatedAt: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'select-stock'])

const selectedGroup = ref('ALL')
const selectedSourceId = ref('VolumeTop')
const innerSearchQuery = ref('')
const isCopied = ref(false)

const BASE_FUBON = 'https://fubon-ebrokerdj.fbs.com.tw'

// 17 大資料來源定義表 (對齊富邦 DJ / MoneyDJ / 證交所)
const SOURCES_CONFIG = [
  // ── 熱門排行 ────────────────────────
  {
    id: 'VolumeTop',
    name: '量大排行',
    group: 'RANK',
    rankingKey: 'top100Volume',
    metricHeader: '成交量',
    categoryTag: 'Top100',
    formatMetric: (item, stockObj) => {
      const vol = item.volume ?? item.amount ?? stockObj?.volume ?? 0
      return `${Number(vol).toLocaleString()} 張`
    },
    metricColor: () => 'text-base-content',
    urls: [
      { label: '上市', endpoint: 'zg_BE_0_1', url: `${BASE_FUBON}/z/zg/zg_BE_0_1.djhtm` },
      { label: '上櫃', endpoint: 'zg_BE_1_1', url: `${BASE_FUBON}/z/zg/zg_BE_1_1.djhtm` },
    ],
  },
  {
    id: 'ValueTop',
    name: '值大排行',
    group: 'RANK',
    rankingKey: 'valueTop',
    metricHeader: '成交金額',
    categoryTag: 'ValueTop',
    formatMetric: (item) => {
      const amt = item.amount ?? 0
      if (amt >= 10000) {
        return `${(amt / 10000).toFixed(1)} 億`
      }
      return `${Number(amt).toLocaleString()} 萬`
    },
    metricColor: () => 'text-base-content',
    urls: [
      { label: '上市', endpoint: 'ZG_CD', url: `${BASE_FUBON}/Z/ZG/ZG_CD.djhtm` },
      { label: '上櫃', endpoint: 'zg_CD_1', url: `${BASE_FUBON}/z/zg/zg_CD_1.djhtm` },
    ],
  },
  {
    id: 'TurnoverRate',
    name: '週轉率',
    group: 'RANK',
    rankingKey: 'turnoverRate',
    metricHeader: '週轉率',
    categoryTag: 'TurnoverRate',
    formatMetric: (item) => {
      const tr = item.turnoverRate ?? 0
      return `${Number(tr).toFixed(2)}%`
    },
    metricColor: () => 'text-base-content',
    urls: [
      { label: '上市', endpoint: 'ZG_BD', url: `${BASE_FUBON}/Z/ZG/ZG_BD.djhtm` },
      { label: '上櫃', endpoint: 'zg_BD_1_0', url: `${BASE_FUBON}/z/zg/zg_BD_1_0.djhtm` },
    ],
  },

  // ── 法人與主力買超 ────────────────────────
  {
    id: 'ForeignBuy1D',
    name: '外資買超 1D',
    group: 'BUY',
    rankingKey: 'foreignBuy1D',
    metricHeader: '買超張數',
    categoryTag: 'ForeignBuy1D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const sign = val > 0 ? '+' : ''
      return `${sign}${Number(val).toLocaleString()} 張`
    },
    metricColor: () => 'text-emerald-700 dark:text-emerald-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_D_0_1', url: `${BASE_FUBON}/z/zg/zg_D_0_1.djhtm` },
      { label: '上櫃', endpoint: 'zg_D_1_1', url: `${BASE_FUBON}/z/zg/zg_D_1_1.djhtm` },
    ],
  },
  {
    id: 'ForeignBuy3D',
    name: '外資買超 3D',
    group: 'BUY',
    rankingKey: 'foreignBuy3D',
    metricHeader: '買超張數',
    categoryTag: 'ForeignBuy3D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const sign = val > 0 ? '+' : ''
      return `${sign}${Number(val).toLocaleString()} 張`
    },
    metricColor: () => 'text-emerald-700 dark:text-emerald-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_D_0_3', url: `${BASE_FUBON}/z/zg/zg_D_0_3.djhtm` },
      { label: '上櫃', endpoint: 'zg_D_1_3', url: `${BASE_FUBON}/z/zg/zg_D_1_3.djhtm` },
    ],
  },
  {
    id: 'SitcaBuy3D',
    name: '投信買超 3D',
    group: 'BUY',
    rankingKey: 'sitcaBuy3D',
    metricHeader: '買超張數',
    categoryTag: 'SitcaBuy3D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const sign = val > 0 ? '+' : ''
      return `${sign}${Number(val).toLocaleString()} 張`
    },
    metricColor: () => 'text-emerald-700 dark:text-emerald-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_DD_0_3', url: `${BASE_FUBON}/z/zg/zg_DD_0_3.djhtm` },
      { label: '上櫃', endpoint: 'zg_DD_1_3', url: `${BASE_FUBON}/z/zg/zg_DD_1_3.djhtm` },
    ],
  },
  {
    id: 'SitcaBuy5D',
    name: '投信買超 5D',
    group: 'BUY',
    rankingKey: 'sitcaBuy5D',
    metricHeader: '買超張數',
    categoryTag: 'SitcaBuy5D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const sign = val > 0 ? '+' : ''
      return `${sign}${Number(val).toLocaleString()} 張`
    },
    metricColor: () => 'text-emerald-700 dark:text-emerald-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_DD_0_5', url: `${BASE_FUBON}/z/zg/zg_DD_0_5.djhtm` },
      { label: '上櫃', endpoint: 'zg_DD_1_5', url: `${BASE_FUBON}/z/zg/zg_DD_1_5.djhtm` },
    ],
  },
  {
    id: 'MajorBuy1D',
    name: '主力買超 1D',
    group: 'BUY',
    rankingKey: 'majorBuy1D',
    metricHeader: '買超張數',
    categoryTag: 'MajorBuy1D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const sign = val > 0 ? '+' : ''
      return `${sign}${Number(val).toLocaleString()} 張`
    },
    metricColor: () => 'text-emerald-700 dark:text-emerald-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_F_0_1', url: `${BASE_FUBON}/z/zg/zg_F_0_1.djhtm` },
      { label: '上櫃', endpoint: 'zg_F_1_1', url: `${BASE_FUBON}/z/zg/zg_F_1_1.djhtm` },
    ],
  },
  {
    id: 'MajorBuy3D',
    name: '主力買超 3D',
    group: 'BUY',
    rankingKey: 'majorBuy3D',
    metricHeader: '買超張數',
    categoryTag: 'MajorBuy3D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const sign = val > 0 ? '+' : ''
      return `${sign}${Number(val).toLocaleString()} 張`
    },
    metricColor: () => 'text-emerald-700 dark:text-emerald-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_F_0_3', url: `${BASE_FUBON}/z/zg/zg_F_0_3.djhtm` },
      { label: '上櫃', endpoint: 'zg_F_1_3', url: `${BASE_FUBON}/z/zg/zg_F_1_3.djhtm` },
    ],
  },

  // ── 避雷賣超池 ────────────────────────
  {
    id: 'ForeignSell1D',
    name: '外資賣超 1D',
    group: 'SELL',
    rankingKey: 'foreignSell1D',
    metricHeader: '賣超張數',
    categoryTag: 'ForeignSell1D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const num = Math.abs(val)
      return `-${Number(num).toLocaleString()} 張`
    },
    metricColor: () => 'text-rose-600 dark:text-rose-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_DA_0_1', url: `${BASE_FUBON}/z/zg/zg_DA_0_1.djhtm` },
      { label: '上櫃', endpoint: 'zg_DA_1_1', url: `${BASE_FUBON}/z/zg/zg_DA_1_1.djhtm` },
    ],
  },
  {
    id: 'ForeignSell3D',
    name: '外資賣超 3D',
    group: 'SELL',
    rankingKey: 'foreignSell3D',
    metricHeader: '賣超張數',
    categoryTag: 'ForeignSell3D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const num = Math.abs(val)
      return `-${Number(num).toLocaleString()} 張`
    },
    metricColor: () => 'text-rose-600 dark:text-rose-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_DA_0_3', url: `${BASE_FUBON}/z/zg/zg_DA_0_3.djhtm` },
      { label: '上櫃', endpoint: 'zg_DA_1_3', url: `${BASE_FUBON}/z/zg/zg_DA_1_3.djhtm` },
    ],
  },
  {
    id: 'SitcaSell3D',
    name: '投信賣超 3D',
    group: 'SELL',
    rankingKey: 'sitcaSell3D',
    metricHeader: '賣超張數',
    categoryTag: 'SitcaSell3D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const num = Math.abs(val)
      return `-${Number(num).toLocaleString()} 張`
    },
    metricColor: () => 'text-rose-600 dark:text-rose-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_DE_0_3', url: `${BASE_FUBON}/z/zg/zg_DE_0_3.djhtm` },
      { label: '上櫃', endpoint: 'zg_DE_1_3', url: `${BASE_FUBON}/z/zg/zg_DE_1_3.djhtm` },
    ],
  },
  {
    id: 'MajorSell1D',
    name: '主力賣超 1D',
    group: 'SELL',
    rankingKey: 'majorSell1D',
    metricHeader: '賣超張數',
    categoryTag: 'MajorSell1D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const num = Math.abs(val)
      return `-${Number(num).toLocaleString()} 張`
    },
    metricColor: () => 'text-rose-600 dark:text-rose-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_FA_0_1', url: `${BASE_FUBON}/z/zg/zg_FA_0_1.djhtm` },
      { label: '上櫃', endpoint: 'zg_FA_1_1', url: `${BASE_FUBON}/z/zg/zg_FA_1_1.djhtm` },
    ],
  },
  {
    id: 'MajorSell3D',
    name: '主力賣超 3D',
    group: 'SELL',
    rankingKey: 'majorSell3D',
    metricHeader: '賣超張數',
    categoryTag: 'MajorSell3D',
    formatMetric: (item) => {
      const val = item.netVol ?? item.amount ?? item.volume ?? 0
      const num = Math.abs(val)
      return `-${Number(num).toLocaleString()} 張`
    },
    metricColor: () => 'text-rose-600 dark:text-rose-400 font-semibold',
    urls: [
      { label: '上市', endpoint: 'zg_FA_0_3', url: `${BASE_FUBON}/z/zg/zg_FA_0_3.djhtm` },
      { label: '上櫃', endpoint: 'zg_FA_1_3', url: `${BASE_FUBON}/z/zg/zg_FA_1_3.djhtm` },
    ],
  },

  // ── 成分股與處置 ────────────────────────
  {
    id: '0050',
    name: '0050 成分股',
    group: 'INDEX',
    rankingKey: 'holdings0050',
    metricHeader: '持股權重',
    categoryTag: '0050',
    formatMetric: (item, stockObj) => {
      if (item.weight) return item.weight
      if (stockObj?.price) return `${Number(stockObj.price).toFixed(2)} 元`
      return '--'
    },
    metricColor: () => 'text-base-content font-medium',
    urls: [
      { label: 'MoneyDJ 0050', endpoint: 'Basic0004', url: 'https://www.moneydj.com/ETF/X/Basic/Basic0004.xdjhtm?etfid=0050.TW' },
    ],
  },
  {
    id: '0051',
    name: '0051 成分股',
    group: 'INDEX',
    rankingKey: 'holdings0051',
    metricHeader: '持股權重',
    categoryTag: '0051',
    formatMetric: (item, stockObj) => {
      if (item.weight) return item.weight
      if (stockObj?.price) return `${Number(stockObj.price).toFixed(2)} 元`
      return '--'
    },
    metricColor: () => 'text-base-content font-medium',
    urls: [
      { label: 'MoneyDJ 0051', endpoint: 'Basic0004', url: 'https://www.moneydj.com/ETF/X/Basic/Basic0004.xdjhtm?etfid=0051.TW' },
    ],
  },
  {
    id: 'disposed',
    name: '處置股票',
    group: 'INDEX',
    rankingKey: 'disposed',
    metricHeader: '狀態',
    formatMetric: () => '關禁閉中',
    metricColor: () => 'text-error font-semibold',
    urls: [
      { label: '證交所處置公告', endpoint: 'TWSE', url: 'https://www.twse.com.tw/zh/announcement/punish.html' },
      { label: '櫃買中心處置公告', endpoint: 'TPEx', url: 'https://www.tpex.org.tw/web/bulletin/disposal/disposal.php' },
    ],
  },
]

const groupOptions = computed(() => [
  { id: 'ALL', label: UI_STRINGS.STOCK_POOL_MODAL.groups.ALL || '全部來源' },
  { id: 'RANK', label: UI_STRINGS.STOCK_POOL_MODAL.groups.RANK || '熱門排行' },
  { id: 'BUY', label: UI_STRINGS.STOCK_POOL_MODAL.groups.BUY || '法人買超' },
  { id: 'SELL', label: UI_STRINGS.STOCK_POOL_MODAL.groups.SELL || '避雷賣超' },
  { id: 'INDEX', label: UI_STRINGS.STOCK_POOL_MODAL.groups.INDEX || '成分股/處置' },
])

const filteredSources = computed(() => {
  if (selectedGroup.value === 'ALL') return SOURCES_CONFIG
  return SOURCES_CONFIG.filter((s) => s.group === selectedGroup.value)
})

// 當切換大分類時，自動將選中來源切換至該群組的第一個項目
watch(selectedGroup, (newGrp) => {
  if (newGrp !== 'ALL') {
    const first = SOURCES_CONFIG.find((s) => s.group === newGrp)
    if (first) selectedSourceId.value = first.id
  }
})

const currentSource = computed(() => {
  return SOURCES_CONFIG.find((s) => s.id === selectedSourceId.value) || SOURCES_CONFIG[0]
})

// 建立代號 → stock 物件快取索引，方便快速查名稱與市場
const stockMap = computed(() => {
  const map = new Map()
  for (const s of (props.stocks || [])) {
    map.set(s.code, s)
  }
  return map
})

function getSourceRawList(src) {
  if (src.id === 'disposed') {
    return (props.stocks || []).filter((s) => s.isDisposed).map((s, idx) => ({
      code: s.code,
      name: s.name,
      market: s.market,
      rawIndex: idx + 1,
    }))
  }

  // 從 rankings 中取出爬蟲原始抓取的順序清單
  const rankData = props.rankings?.[src.rankingKey]
  if (rankData && Array.isArray(rankData.stocks) && rankData.stocks.length > 0) {
    return rankData.stocks.map((item, idx) => {
      const existing = stockMap.value.get(item.code)
      return {
        code: item.code,
        name: item.name || existing?.name || item.code,
        market: item.market || existing?.market || 'tse',
        amount: item.amount,
        volume: item.volume,
        netVol: item.netVol,
        turnoverRate: item.turnoverRate,
        weight: item.weight,
        rawIndex: idx + 1,
      }
    })
  }

  // Fallback: 若 rankings 尚未注入，從 stocks.categories 匹配
  if (src.categoryTag) {
    return (props.stocks || [])
      .filter((s) => (s.categories || []).includes(src.categoryTag))
      .map((s, idx) => ({
        code: s.code,
        name: s.name,
        market: s.market,
        rawIndex: idx + 1,
      }))
  }

  return []
}

function getSourceCount(src) {
  return getSourceRawList(src).length
}

const currentSourceRawStocks = computed(() => {
  if (!currentSource.value) return []
  return getSourceRawList(currentSource.value)
})

const displayedTableRows = computed(() => {
  const list = currentSourceRawStocks.value
  const src = currentSource.value
  const q = innerSearchQuery.value.trim().toLowerCase()

  const filtered = q
    ? list.filter((r) => r.code.includes(q) || (r.name && r.name.toLowerCase().includes(q)))
    : list

  return filtered.map((r) => {
    const stockObj = stockMap.value.get(r.code)
    return {
      ...r,
      metricValue: src.formatMetric ? src.formatMetric(r, stockObj) : '--',
      metricColorClass: src.metricColor ? src.metricColor(r) : 'text-base-content',
    }
  })
})

const updatedAtText = computed(() => {
  if (!props.updatedAt) return ''
  try {
    const d = new Date(props.updatedAt)
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `資料更新：${mm}/${dd} ${hh}:${min}`
    }
  } catch {}
  return `資料更新：${props.updatedAt}`
})

function handleStockClick(row) {
  emit('select-stock', row)
  emit('close')
}

function handleCopyAllCodes() {
  const codes = currentSourceRawStocks.value.map((s) => s.code).join(' ')
  if (!codes) return
  navigator.clipboard.writeText(codes).then(() => {
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 1800)
  })
}
</script>
