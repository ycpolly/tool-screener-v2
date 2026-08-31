<template>
  <button
    type="button"
    class="btn btn-ghost btn-sm h-8 w-8 min-h-0 p-0 rounded-lg text-base-content/70 hover:text-base-content transition-colors cursor-pointer"
    :aria-label="isDark ? '切換為亮色模式' : '切換為暗色模式'"
    :title="isDark ? '切換為亮色模式' : '切換為暗色模式'"
    @click="$emit('toggle')"
  >
    <!-- 太陽圖示 (暗色模式時顯示，點擊切為亮色) -->
    <svg
      v-if="isDark"
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="4" stroke-width="2" />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
      />
    </svg>

    <!-- 月亮圖示 (亮色模式時顯示，點擊切為暗色) -->
    <svg
      v-else
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  </button>
</template>

<script setup>
defineProps({
  isDark: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['toggle'])
</script>
