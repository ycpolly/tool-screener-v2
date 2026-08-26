<template>
  <div class="sparkline-wrapper flex items-center justify-center w-full h-full">
    <svg
      v-if="validPoints.length > 1"
      :viewBox="`0 0 ${viewBoxWidth} ${viewBoxHeight}`"
      class="w-full h-full overflow-visible"
      preserveAspectRatio="none"
    >
      <!-- 背景參考基準線 (中軸/平盤虛線) -->
      <line
        :x1="0"
        :y1="viewBoxHeight / 2"
        :x2="viewBoxWidth"
        :y2="viewBoxHeight / 2"
        stroke="currentColor"
        class="text-base-content/10"
        stroke-width="0.75"
        stroke-dasharray="2 2"
      />

      <!-- 收盤價折線 -->
      <polyline
        :points="polylinePoints"
        fill="none"
        :stroke="strokeColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- 起點小標記 -->
      <circle
        v-if="startPoint"
        :cx="startPoint.x"
        :cy="startPoint.y"
        r="1.75"
        :fill="strokeColor"
        fill-opacity="0.4"
      />

      <!-- 最新收盤價終點圓點標記 -->
      <circle
        v-if="endPoint"
        :cx="endPoint.x"
        :cy="endPoint.y"
        r="2.5"
        :fill="strokeColor"
      />
    </svg>
    <div v-else class="text-xs text-base-content/30 italic">--</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
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

const viewBoxWidth = 160
const viewBoxHeight = computed(() => props.height)
const paddingY = 4
const paddingX = 4

const validPoints = computed(() => {
  if (!Array.isArray(props.data)) return []
  return props.data.filter((v) => typeof v === 'number' && !isNaN(v))
})

const stats = computed(() => {
  const pts = validPoints.value
  if (pts.length === 0) return { min: 0, max: 0, trend: 'flat' }
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const first = pts[0]
  const last = pts[pts.length - 1]
  const trend = last > first ? 'rise' : last < first ? 'fall' : 'flat'
  return { min, max, trend }
})

const strokeColor = computed(() => {
  if (props.color) return props.color
  if (stats.value.trend === 'rise') return 'var(--color-rise)'
  if (stats.value.trend === 'fall') return 'var(--color-fall)'
  return 'var(--color-flat)'
})

const coordinates = computed(() => {
  const pts = validPoints.value
  if (pts.length < 2) return []

  const { min, max } = stats.value
  const range = max - min === 0 ? 1 : max - min
  const innerWidth = viewBoxWidth - paddingX * 2
  const innerHeight = viewBoxHeight.value - paddingY * 2

  return pts.map((val, idx) => {
    const x = paddingX + (idx / (pts.length - 1)) * innerWidth
    const y = viewBoxHeight.value - paddingY - ((val - min) / range) * innerHeight
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }
  })
})

const polylinePoints = computed(() => {
  return coordinates.value.map((p) => `${p.x},${p.y}`).join(' ')
})

const startPoint = computed(() => coordinates.value[0] || null)
const endPoint = computed(() => coordinates.value[coordinates.value.length - 1] || null)
</script>
