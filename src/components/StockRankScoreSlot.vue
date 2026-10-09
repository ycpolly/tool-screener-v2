<template>
  <div
    v-if="hasRankScore"
    class="text-sm font-normal leading-normal py-1.5 px-3 rounded-lg border transition-colors mt-1 bg-base-300/40 border-base-300/70 text-base-content select-none"
    :class="hasItems ? 'cursor-pointer hover:bg-base-300/60' : ''"
    @click="hasItems && (isDetailsExpanded = !isDetailsExpanded)"
  >
    <!-- 摘要首行 (點擊切換展開/收合) -->
    <div class="flex items-center justify-between gap-1.5 min-w-0 font-numeric">
      <div class="flex items-baseline gap-1.5 min-w-0 truncate text-left">
        <!-- 評分主標 (強調以粗體呈现，不依賴顏色) -->
        <span class="font-bold text-base-content shrink-0">
          {{ UI_STRINGS.RANK_SCORE?.scorePrefix || '評分 ' }}{{ breakdown.score }}{{ UI_STRINGS.RANK_SCORE?.scoreSuffix || '分' }}
        </span>
        <span class="text-base-content/40 shrink-0">：</span>
        <!-- 評分組成摘要 (例如 起跳40 · 營收+10 · RS+9 · 股本+12 · 估值+10 · 籌碼+0) -->
        <span class="text-base-content/80 font-normal truncate" :title="breakdown.summary">
          {{ breakdown.summary }}
        </span>
      </div>

      <!-- 展開/收合指示器 -->
      <span
        v-if="hasItems"
        class="text-xs text-base-content/60 flex items-center gap-0.5 shrink-0 ml-1"
      >
        <span class="font-sans">{{ isDetailsExpanded ? (UI_STRINGS.RANK_SCORE?.collapseDetails || '收合') : (UI_STRINGS.RANK_SCORE?.expandDetails || '展開') }}</span>
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

    <!-- 展開後的純文字指標評分細項清單 (允許選取複製文字) -->
    <div
      v-if="isDetailsExpanded && hasItems"
      class="pt-2 mt-2 border-t border-base-300/40 space-y-1.5 text-sm font-numeric select-text cursor-auto"
      @click.stop
    >
      <div
        v-for="item in breakdown.items"
        :key="item.key"
        class="flex items-start gap-1.5 leading-normal py-0.5"
      >
        <!-- 打勾 / 符號指示：得分 > 0 顯示 ✓，0 分顯示 - -->
        <span
          class="shrink-0 font-bold select-none w-4 text-center"
          :class="item.score > 0 ? 'text-base-content font-bold' : 'text-base-content/40 font-normal'"
        >
          {{ item.score > 0 ? '✓' : '-' }}
        </span>
        <div class="text-base-content/90 flex-1 min-w-0">
          <strong class="text-base-content font-bold mr-1">{{ item.label }}</strong>
          <span class="text-base-content/75 mr-1.5 font-numeric">({{ item.score > 0 ? '+' : '' }}{{ item.score }}/{{ item.max }})</span>
          <span class="text-base-content/80 font-normal">{{ item.desc }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

const props = defineProps({
  stock: {
    type: Object,
    required: true,
  },
})

const isDetailsExpanded = ref(false)

const breakdown = computed(() => {
  return props.stock?.rankBreakdown || null
})

const hasRankScore = computed(() => {
  return typeof props.stock?.rankScore === 'number' && breakdown.value != null
})

const hasItems = computed(() => {
  return Array.isArray(breakdown.value?.items) && breakdown.value.items.length > 0
})
</script>
