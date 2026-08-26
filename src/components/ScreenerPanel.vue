<template>
  <div class="screener-panel bg-base-200 border border-base-300 rounded-xl p-4 space-y-4">
    <!-- 頂部：標題與手機端折疊切換 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="font-bold text-sm text-base-content">{{ UI_STRINGS.PANEL.title }}</span>
        <span class="text-xs text-base-content/50">
          ({{ currentMode?.label || activeMode }})
        </span>
      </div>

      <button
        type="button"
        class="btn btn-ghost btn-xs text-base-content/60 md:hidden"
        @click="isCollapsed = !isCollapsed"
      >
        <span>{{ isCollapsed ? '展開條件' : '收合' }}</span>
        <span class="text-[10px]">{{ isCollapsed ? '▼' : '▲' }}</span>
      </button>
    </div>

    <div :class="{ 'hidden md:block': isCollapsed }" class="space-y-4">
      <!-- 模式切換 Tabs -->
      <div class="flex gap-2 p-1 bg-base-300/40 rounded-lg">
        <button
          v-for="mode in Object.values(modes)"
          :key="mode.id"
          type="button"
          class="flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all"
          :class="activeMode === mode.id ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60 hover:text-base-content'"
          @click="$emit('update:activeMode', mode.id)"
        >
          {{ mode.label }}
        </button>
      </div>

      <!-- 模式說明 -->
      <div v-if="currentMode?.description" class="text-xs text-base-content/60 leading-relaxed px-1">
        {{ currentMode.description }}
      </div>

      <!-- 參數調整網格 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-1">
        <!-- 5MA 乖離率範圍 -->
        <div class="space-y-1">
          <label class="font-semibold text-base-content/80">{{ UI_STRINGS.PANEL.bias5Range }}</label>
          <div class="flex items-center gap-1.5 font-numeric">
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias5Min"
              class="input input-bordered input-xs w-full bg-base-100 text-center font-bold"
              @input="updateField('bias5Min', $event.target.value)"
            />
            <span class="text-base-content/40">{{ UI_STRINGS.PANEL.to }}</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias5Max"
              class="input input-bordered input-xs w-full bg-base-100 text-center font-bold"
              @input="updateField('bias5Max', $event.target.value)"
            />
          </div>
        </div>

        <!-- 月線乖離率範圍 -->
        <div class="space-y-1">
          <label class="font-semibold text-base-content/80">{{ UI_STRINGS.PANEL.bias20Range }}</label>
          <div class="flex items-center gap-1.5 font-numeric">
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias20Min"
              class="input input-bordered input-xs w-full bg-base-100 text-center font-bold"
              @input="updateField('bias20Min', $event.target.value)"
            />
            <span class="text-base-content/40">{{ UI_STRINGS.PANEL.to }}</span>
            <input
              type="number"
              step="0.5"
              inputmode="decimal"
              :value="params.bias20Max"
              class="input input-bordered input-xs w-full bg-base-100 text-center font-bold"
              @input="updateField('bias20Max', $event.target.value)"
            />
          </div>
        </div>

        <!-- 最低成交量 -->
        <div class="space-y-1">
          <label class="font-semibold text-base-content/80">{{ UI_STRINGS.PANEL.minVolume }}</label>
          <div class="font-numeric">
            <input
              type="number"
              step="100"
              inputmode="numeric"
              :value="params.minVolume"
              class="input input-bordered input-xs w-full bg-base-100 font-bold"
              @input="updateField('minVolume', $event.target.value)"
            />
          </div>
        </div>
      </div>

      <!-- 開關勾選項 (量縮整理 / 實體紅K) -->
      <div class="flex flex-wrap items-center gap-4 text-xs pt-1">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            :checked="params.requireVolContraction"
            class="checkbox checkbox-xs"
            @change="updateField('requireVolContraction', $event.target.checked)"
          />
          <span class="font-medium text-base-content/80">{{ UI_STRINGS.PANEL.requireVolContraction }}</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            :checked="params.requireRedCandle"
            class="checkbox checkbox-xs"
            @change="updateField('requireRedCandle', $event.target.checked)"
          />
          <span class="font-medium text-base-content/80">{{ UI_STRINGS.PANEL.requireRedCandle }}</span>
        </label>
      </div>

      <!-- 底部操作列：重設預設值 -->
      <div class="flex justify-end pt-2 border-t border-base-300/40">
        <button
          type="button"
          class="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content"
          @click="$emit('reset')"
        >
          {{ UI_STRINGS.PANEL.resetBtn }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UI_STRINGS } from '../constants/ui-strings.js'

const props = defineProps({
  modes: {
    type: Object,
    default: () => ({}),
  },
  activeMode: {
    type: String,
    required: true,
  },
  params: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:activeMode', 'update:params', 'reset'])

const isCollapsed = ref(false)

const currentMode = computed(() => {
  return props.modes[props.activeMode] || null
})

function updateField(field, value) {
  const updated = { ...props.params }
  if (typeof props.params[field] === 'number') {
    updated[field] = parseFloat(value) || 0
  } else if (typeof props.params[field] === 'boolean') {
    updated[field] = Boolean(value)
  } else {
    updated[field] = value
  }
  emit('update:params', updated)
}
</script>
