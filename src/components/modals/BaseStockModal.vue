<template>
  <Teleport to="body">
    <dialog
      v-if="isOpen"
      :class="{ 'modal-open': isOpen }"
      class="modal modal-bottom sm:modal-middle select-none z-50"
    >
      <div
        class="modal-box w-full bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl max-h-[90vh] flex flex-col safe-pb-modal"
        :class="boxClass"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-2.5 border-b border-base-300/80 shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <slot name="header-title">
              <h3 class="text-base sm:text-lg font-bold text-base-content flex items-center gap-1.5 truncate">
                <span
                  class="font-numeric cursor-pointer hover:underline touch-manipulation"
                  :title="UI_STRINGS.SEARCH?.searchCodeTooltip"
                  @click="$emit('searchCode', stock?.code)"
                >
                  {{ stock?.code }}
                </span>
                <span class="truncate">{{ stock?.name }}</span>
                <span v-if="titleSuffix" class="text-base-content/80 font-medium text-xs sm:text-sm shrink-0">
                  {{ titleSuffix.startsWith('·') ? titleSuffix : `· ${titleSuffix}` }}
                </span>
              </h3>
            </slot>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <slot name="header-actions" />

            <!-- 關閉按鈕 -->
            <button
              type="button"
              class="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
              :aria-label="closeAriaLabel || UI_STRINGS.QUICK_CALC?.closeBtn || '關閉'"
              @click="$emit('close')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 內容主體 -->
        <slot />
      </div>

      <!-- 背景遮罩 (點擊關閉) -->
      <form method="dialog" class="modal-backdrop" @click="$emit('close')">
        <button>close</button>
      </form>
    </dialog>
  </Teleport>
</template>

<script setup>
import { UI_STRINGS } from '../../constants/ui-strings.js'

defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  stock: {
    type: Object,
    default: null,
  },
  titleSuffix: {
    type: String,
    default: '',
  },
  boxClass: {
    type: String,
    default: 'max-w-lg',
  },
  closeAriaLabel: {
    type: String,
    default: '',
  },
})

defineEmits(['close', 'searchCode'])
</script>
