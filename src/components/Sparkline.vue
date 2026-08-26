<template>
  <!-- 迷你折線圖：用 SVG 畫最近 N 日收盤價趨勢 -->
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="overflow-visible"
  >
    <polyline
      v-if="points.length > 1"
      :points="points.map(p => `${p.x},${p.y}`).join(' ')"
      fill="none"
      :stroke="lineColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <!-- 最後一點標記 -->
    <circle
      v-if="points.length"
      :cx="points[points.length - 1].x"
      :cy="points[points.length - 1].y"
      r="2"
      :fill="lineColor"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data:   { type: Array,  default: () => [] },
  width:  { type: Number, default: 160 },
  height: { type: Number, default: 36 },
})

const PAD = 3  // 上下留白 px

const points = computed(() => {
  const d = (props.data ?? []).filter(v => v != null && !isNaN(v))
  if (d.length < 2) return []

  const min = Math.min(...d)
  const max = Math.max(...d)
  const range = max - min || 1

  return d.map((v, i) => ({
    x: (i / (d.length - 1)) * props.width,
    y: PAD + ((1 - (v - min) / range) * (props.height - PAD * 2)),
  }))
})

// 根據最後一點相對前一點漲跌決定顏色
const lineColor = computed(() => {
  const d = props.data ?? []
  if (d.length < 2) return 'oklch(0.55 0 0)'
  const last = d[d.length - 1]
  const prev = d[d.length - 2]
  if (last > prev) return 'var(--color-rise)'
  if (last < prev) return 'var(--color-fall)'
  return 'oklch(0.55 0 0)'
})
</script>
