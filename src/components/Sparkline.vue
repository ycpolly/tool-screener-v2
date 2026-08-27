<template>
  <div class="sparkline-wrapper flex items-center justify-center w-full py-1">
    <img
      src="/images/sparkline-placeholder.png"
      alt="10日K棒技術圖"
      class="w-full max-w-[260px] h-auto object-contain rounded select-none pointer-events-none"
    />
  </div>
</template>

<script setup>
defineProps({
  data: {
    type: Array,
    default: () => [],
  },
  height: {
    type: Number,
    default: 44,
  },
  color: {
    type: String,
    default: '',
  },
})
</script>
