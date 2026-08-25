<template>
  <div data-theme="nord" class="min-h-dvh bg-base-100">
    <!-- Theme toggle button (top-right) -->
    <button
      class="btn btn-ghost btn-sm fixed top-3 right-3 z-50"
      @click="toggleTheme"
      :title="isDark ? '切換亮色模式' : '切換暗色模式'"
    >
      <span v-if="isDark">☀</span>
      <span v-else>☾</span>
    </button>

    <!-- App shell: Router view will go here -->
    <main class="container mx-auto px-3 py-4 max-w-screen-xl">
      <p class="text-base-content text-sm opacity-60 text-center mt-20">
        tool-screener v2 — 骨架建立完成 ✓
      </p>
    </main>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
}

watch(isDark, (dark) => {
  document.documentElement.setAttribute('data-theme', dark ? 'business' : 'nord')
})
</script>
