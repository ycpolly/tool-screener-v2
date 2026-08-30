<template>
  <div class="sparkline-wrapper flex items-center justify-center w-full select-none">
    <!-- 完整 10 日 3 層式向量走勢圖 (K棒均線 + 成交量 + KD) -->
    <svg
      v-if="hasValidData"
      :viewBox="`0 0 ${width} ${totalHeight}`"
      class="w-full max-w-[220px] h-auto overflow-visible pointer-events-none"
      aria-label="10日微型走勢圖 (K棒/均線/成交量/KD)"
    >
      <!-- ============================================================
           上層 (Y: 6 ~ 58)：10 根 K 棒 + 5MA / 10MA / 20MA 三均線折線
           ============================================================ -->
      <!-- 20MA (月線) 折線 (暖鵝黃 var(--color-ma20)) -->
      <polyline
        v-if="chartData.hasMa20 && ma20Points"
        :points="ma20Points"
        fill="none"
        stroke="var(--color-ma20)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.95"
      />

      <!-- 10MA 折線 (科技藍 var(--color-ma10)) -->
      <polyline
        :points="ma10Points"
        fill="none"
        stroke="var(--color-ma10)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.9"
      />

      <!-- 5MA 折線 (活力橘 var(--color-ma5)) -->
      <polyline
        :points="ma5Points"
        fill="none"
        stroke="var(--color-ma5)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.9"
      />

      <!-- 5MA / 10MA / 20MA 末端圓點 -->
      <circle
        v-if="chartData.hasMa20 && chartData.ma20EndY !== null"
        :cx="xCoords[9]"
        :cy="chartData.ma20EndY"
        r="1.5"
        fill="var(--color-ma20)"
      />
      <circle
        v-if="chartData.ma10EndY !== null"
        :cx="xCoords[9]"
        :cy="chartData.ma10EndY"
        r="1.5"
        fill="var(--color-ma10)"
      />
      <circle
        v-if="chartData.ma5EndY !== null"
        :cx="xCoords[9]"
        :cy="chartData.ma5EndY"
        r="1.5"
        fill="var(--color-ma5)"
      />

      <!-- 10 根 K 棒 (影線與實體) -->
      <g v-for="(candle, idx) in chartData.candles" :key="`candle-${idx}`">
        <!-- 上下影線 -->
        <line
          :x1="candle.cx"
          :y1="candle.yHigh"
          :x2="candle.cx"
          :y2="candle.yLow"
          :stroke="candle.color"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <!-- 實體 Rect -->
        <rect
          :x="candle.bodyLeft"
          :y="candle.bodyTop"
          :width="bodyWidth"
          :height="candle.bodyHeight"
          :fill="candle.color"
          rx="1"
        />
      </g>

      <!-- 上層右側 5MA / 10MA / 20MA 標籤 (含智慧 3 線防重疊演算法) -->
      <text
        v-for="lbl in chartData.maLabels"
        :key="lbl.key"
        x="160"
        :y="lbl.y"
        :fill="lbl.color"
        font-size="7.5"
        font-weight="bold"
        dominant-baseline="central"
      >
        {{ lbl.text }}
      </text>

      <!-- 分隔線 1 (K棒 與 成交量) -->
      <line
        x1="8"
        y1="62"
        x2="184"
        y2="62"
        stroke="currentColor"
        class="text-base-content/15"
        stroke-width="0.75"
      />

      <!-- ============================================================
           中層 (Y: 66 ~ 96)：10 根成交量柱 + MV5 基準虛線
           ============================================================ -->
      <!-- MV5 基準虛線 -->
      <line
        x1="12"
        :y1="chartData.yMV5"
        x2="154"
        :y2="chartData.yMV5"
        stroke="currentColor"
        class="text-base-content/30"
        stroke-width="0.8"
        stroke-dasharray="2 2"
      />
      <!-- MV5 標籤 (簡寫為 5) -->
      <text
        x="160"
        :y="chartData.yMV5"
        fill="currentColor"
        class="text-base-content/60"
        font-size="7.5"
        font-weight="bold"
        dominant-baseline="central"
      >
        5
      </text>

      <!-- 10 根成交量柱 -->
      <g v-for="(vol, idx) in chartData.volumeBars" :key="`vol-${idx}`">
        <rect
          :x="vol.bodyLeft"
          :y="vol.barY"
          :width="bodyWidth"
          :height="vol.barH"
          :fill="vol.color"
          opacity="0.88"
          rx="1"
        />
        <!-- 爆量箭頭 (>= 2倍 MV5) -->
        <text
          v-if="vol.isBurst"
          :x="vol.cx"
          :y="vol.arrowY"
          fill="var(--color-rise)"
          font-size="6.5"
          font-weight="bold"
          text-anchor="middle"
        >
          ▼
        </text>
      </g>

      <!-- 分隔線 2 (成交量 與 KD) -->
      <line
        x1="8"
        y1="100"
        x2="184"
        y2="100"
        stroke="currentColor"
        class="text-base-content/15"
        stroke-width="0.75"
      />

      <!-- ============================================================
           下層 (Y: 104 ~ 134)：近 10 日 KD(9,3) 折線 + Y=50 基準線
           ============================================================ -->
      <!-- Y=50 基準虛線 -->
      <line
        x1="18"
        :y1="chartData.y50"
        x2="154"
        :y2="chartData.y50"
        stroke="currentColor"
        class="text-base-content/25"
        stroke-width="0.8"
        stroke-dasharray="2 2"
      />
      <!-- 50 數值標籤 -->
      <text
        x="6"
        :y="chartData.y50"
        fill="currentColor"
        class="text-base-content/40"
        font-size="6.5"
        dominant-baseline="central"
      >
        50
      </text>

      <!-- K 折線 (活力橘 var(--color-ma5)) -->
      <polyline
        :points="kPoints"
        fill="none"
        stroke="var(--color-ma5)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- D 折線 (科技藍 var(--color-ma10)) -->
      <polyline
        :points="dPoints"
        fill="none"
        stroke="var(--color-ma10)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- K / D 末端圓點 -->
      <circle
        v-if="chartData.kEndY !== null"
        :cx="xCoords[9]"
        :cy="chartData.kEndY"
        r="1.5"
        fill="var(--color-ma5)"
      />
      <circle
        v-if="chartData.dEndY !== null"
        :cx="xCoords[9]"
        :cy="chartData.dEndY"
        r="1.5"
        fill="var(--color-ma10)"
      />

      <!-- 下層右側 K / D 標籤 (含防重疊偏移) -->
      <text
        x="160"
        :y="chartData.labelYK"
        fill="var(--color-ma5)"
        font-size="7.5"
        font-weight="bold"
        dominant-baseline="central"
      >
        K
      </text>
      <text
        x="160"
        :y="chartData.labelYD"
        fill="var(--color-ma10)"
        font-size="7.5"
        font-weight="bold"
        dominant-baseline="central"
      >
        D
      </text>
    </svg>

    <!-- 資料缺失時乾淨呈現空白/提示，不補假資料 -->
    <div
      v-else
      class="flex items-center justify-center w-full h-24 text-sm text-base-content/70 italic bg-base-300/20 rounded border border-dashed border-base-300/50"
    >
      -- 暫無 10 日走勢數據 --
    </div>
  </div>
</template>

<script setup>
import { computed, watchEffect } from 'vue'

const props = defineProps({
  history: {
    type: Array,
    default: () => [],
  },
  stock: {
    type: Object,
    default: () => ({}),
  },
  stockCode: {
    type: String,
    default: '',
  },
})

// 畫布幾何尺寸規格 (ViewBox: 192 x 140)
const width = 192
const totalHeight = 140
const bodyWidth = 9.5
const xCoords = [21.5, 36, 50.5, 65, 79.5, 94, 108.5, 123, 137.5, 152]

// 資料有效性檢驗
const hasValidData = computed(() => {
  const list = props.history || props.stock?.history10d
  return Array.isArray(list) && list.length >= 10
})

// 若資料有缺漏，在 console 印出警告告知開發者與使用者
watchEffect(() => {
  const list = props.history || props.stock?.history10d
  const code = props.stockCode || props.stock?.code || '未知代號'
  if (!Array.isArray(list) || list.length < 10) {
    console.warn(
      `[Sparkline 警示] 個股 ${code} 缺少完整 10 日技術歷史資料（當前筆數: ${list?.length || 0}）。`
    )
  }
})

// 標準化近 10 日資料（包含 MA20 的完整支援）
const normalizedK10d = computed(() => {
  const rawList = props.history || props.stock?.history10d
  if (!Array.isArray(rawList) || rawList.length < 10) return []
  const slice = rawList.slice(-10)
  const curMa20 = props.stock?.ma20

  return slice.map((d, idx, arr) => {
    if (typeof d.ma20 === 'number') return d
    // 若靜態 JSON 尚未重新爬取 ma20，以 stock.ma20 結合當日收盤進行平滑反推
    if (typeof curMa20 === 'number') {
      const todayClose = arr[arr.length - 1].close || curMa20
      const dayClose = d.close || todayClose
      const offset = (arr.length - 1 - idx) * ((todayClose - dayClose) / 20)
      return { ...d, ma20: Number((curMa20 - offset).toFixed(2)) }
    }
    return d
  })
})

// 核心運算：三層圖表之所有座標與幾何位置
const chartData = computed(() => {
  const k10d = normalizedK10d.value
  if (k10d.length < 10) {
    return {
      candles: [],
      volumeBars: [],
      hasMa20: false,
      ma5EndY: null,
      ma10EndY: null,
      ma20EndY: null,
      maLabels: [],
      yMV5: 0,
      y50: 0,
      kEndY: null,
      dEndY: null,
      labelYK: 0,
      labelYD: 0,
    }
  }

  const hasMa20 = k10d.some((d) => typeof d.ma20 === 'number')

  // -------------------------------------------------------------------------
  // 上層 (Y: 6 ~ 58)：K 棒 + 均線折線 (5MA / 10MA / 20MA)
  // -------------------------------------------------------------------------
  const kHeightTop = 6
  const kHeightBottom = 58

  const allVals = []
  k10d.forEach((d) => {
    if (typeof d.open === 'number') allVals.push(d.open)
    if (typeof d.high === 'number') allVals.push(d.high)
    if (typeof d.low === 'number') allVals.push(d.low)
    if (typeof d.close === 'number') allVals.push(d.close)
    if (typeof d.ma5 === 'number') allVals.push(d.ma5)
    if (typeof d.ma10 === 'number') allVals.push(d.ma10)
    if (typeof d.ma20 === 'number') allVals.push(d.ma20)
  })

  const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.002 : 1
  const minVal = allVals.length > 0 ? Math.min(...allVals) * 0.998 : 0
  const range = maxVal - minVal || 1

  const getY = (val) => {
    if (val === null || val === undefined || isNaN(val)) return kHeightBottom
    return Number((kHeightBottom - ((val - minVal) / range) * (kHeightBottom - kHeightTop)).toFixed(1))
  }

  // 建立 10 根 K 棒座標
  const candles = k10d.map((day, idx) => {
    const cx = xCoords[idx]
    const yHigh = getY(day.high)
    const yLow = getY(day.low)
    const yOpen = getY(day.open)
    const yClose = getY(day.close)

    const isUp = day.close > day.open
    const isDown = day.close < day.open
    const color = isUp ? 'var(--color-rise)' : isDown ? 'var(--color-fall)' : 'var(--color-flat)'

    const bodyTop = Math.min(yOpen, yClose)
    const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1.6)
    const bodyLeft = Number((cx - bodyWidth / 2).toFixed(1))

    return {
      cx,
      yHigh,
      yLow,
      bodyTop,
      bodyHeight,
      bodyLeft,
      color,
    }
  })

  // 均線末端 Y 座標
  const lastDay = k10d[9]
  const ma5EndY = lastDay?.ma5 ? getY(lastDay.ma5) : null
  const ma10EndY = lastDay?.ma10 ? getY(lastDay.ma10) : null
  const ma20EndY = lastDay?.ma20 ? getY(lastDay.ma20) : null

  // 智慧 3 線防重疊標籤演算法 (5 / 10 / 20 均線)
  const labelList = [
    { key: 'ma5', text: '5', color: 'var(--color-ma5)', y: ma5EndY ?? 20 },
    { key: 'ma10', text: '10', color: 'var(--color-ma10)', y: ma10EndY ?? 32 },
  ]
  if (hasMa20 && ma20EndY !== null) {
    labelList.push({ key: 'ma20', text: '20', color: 'var(--color-ma20)', y: ma20EndY })
  }

  labelList.sort((a, b) => a.y - b.y)
  const minGap = 8.5
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < labelList.length - 1; i++) {
      const diff = labelList[i + 1].y - labelList[i].y
      if (diff < minGap) {
        const overlap = minGap - diff
        labelList[i].y = Math.max(kHeightTop + 2, labelList[i].y - overlap / 2)
        labelList[i + 1].y = Math.min(kHeightBottom - 2, labelList[i + 1].y + overlap / 2)
      }
    }
  }

  const maLabels = labelList.map((item) => ({
    ...item,
    y: Number(item.y.toFixed(1)),
  }))

  // -------------------------------------------------------------------------
  // 中層 (Y: 66 ~ 96)：成交量柱 + MV5 基準線
  // -------------------------------------------------------------------------
  const volSubchartYBase = 96
  const maxVolBarHeight = 24
  const vols = k10d.map((d) => (typeof d.volume === 'number' && d.volume >= 0 ? d.volume : 0))
  const vMa5 = props.stock?.vMa5 || (vols.reduce((a, b) => a + b, 0) / (vols.length || 1))
  const maxVolScale = Math.max(...vols, vMa5, 1)

  const yMV5 = Number((volSubchartYBase - (vMa5 / maxVolScale) * maxVolBarHeight).toFixed(1))

  const volumeBars = k10d.map((day, idx) => {
    const cx = xCoords[idx]
    const v = vols[idx]
    const barH = Number(Math.max(2.0, (v / maxVolScale) * maxVolBarHeight).toFixed(1))
    const barY = Number((volSubchartYBase - barH).toFixed(1))
    const bodyLeft = Number((cx - bodyWidth / 2).toFixed(1))

    // 對照前一日收盤價 (漲紅/跌綠/平灰)
    const prevC = day.prevClose !== undefined ? day.prevClose : (idx > 0 && k10d[idx - 1] ? k10d[idx - 1].close : day.open)
    const isVolUp = day.close > prevC
    const isVolDown = day.close < prevC
    const color = isVolUp ? 'var(--color-rise)' : isVolDown ? 'var(--color-fall)' : 'var(--color-flat)'

    const isBurst = vMa5 > 0 && v >= vMa5 * 2.0
    const arrowY = Number(Math.max(65, barY - 1).toFixed(1))

    return {
      cx,
      bodyLeft,
      barY,
      barH,
      color,
      isBurst,
      arrowY,
    }
  })

  // -------------------------------------------------------------------------
  // 下層 (Y: 104 ~ 134)：KD 折線 + Y=50 基準線
  // -------------------------------------------------------------------------
  const kdYTop = 104
  const kdYBottom = 134
  const getKdY = (val) => {
    if (val === null || val === undefined || isNaN(val)) return (kdYTop + kdYBottom) / 2
    const clamped = Math.min(100, Math.max(0, val))
    return Number((kdYBottom - (clamped / 100) * (kdYBottom - kdYTop)).toFixed(1))
  }

  const y50 = getKdY(50)

  const todayK = typeof lastDay?.k === 'number' ? lastDay.k : null
  const todayD = typeof lastDay?.d === 'number' ? lastDay.d : null

  const kEndY = todayK !== null ? getKdY(todayK) : null
  const dEndY = todayD !== null ? getKdY(todayD) : null

  let labelYK = kEndY ?? 115
  let labelYD = dEndY ?? 123
  if (Math.abs(labelYK - labelYD) < 7) {
    if (labelYK <= labelYD) {
      labelYK -= 3.5
      labelYD += 3.5
    } else {
      labelYK += 3.5
      labelYD -= 3.5
    }
  }

  return {
    candles,
    volumeBars,
    hasMa20,
    ma5EndY,
    ma10EndY,
    ma20EndY,
    maLabels,
    yMV5,
    y50,
    kEndY,
    dEndY,
    labelYK: Number(labelYK.toFixed(1)),
    labelYD: Number(labelYD.toFixed(1)),
  }
})

// 折線 Points 計算
const ma5Points = computed(() => {
  const k10d = normalizedK10d.value
  if (k10d.length < 10) return ''

  const allVals = []
  k10d.forEach((d) => {
    if (typeof d.open === 'number') allVals.push(d.open)
    if (typeof d.high === 'number') allVals.push(d.high)
    if (typeof d.low === 'number') allVals.push(d.low)
    if (typeof d.close === 'number') allVals.push(d.close)
    if (typeof d.ma5 === 'number') allVals.push(d.ma5)
    if (typeof d.ma10 === 'number') allVals.push(d.ma10)
    if (typeof d.ma20 === 'number') allVals.push(d.ma20)
  })
  const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.002 : 1
  const minVal = allVals.length > 0 ? Math.min(...allVals) * 0.998 : 0
  const range = maxVal - minVal || 1
  const getY = (val) => (58 - ((val - minVal) / range) * 52).toFixed(1)

  return k10d.map((d, i) => `${xCoords[i]},${getY(d.ma5 || d.close)}`).join(' ')
})

const ma10Points = computed(() => {
  const k10d = normalizedK10d.value
  if (k10d.length < 10) return ''

  const allVals = []
  k10d.forEach((d) => {
    if (typeof d.open === 'number') allVals.push(d.open)
    if (typeof d.high === 'number') allVals.push(d.high)
    if (typeof d.low === 'number') allVals.push(d.low)
    if (typeof d.close === 'number') allVals.push(d.close)
    if (typeof d.ma5 === 'number') allVals.push(d.ma5)
    if (typeof d.ma10 === 'number') allVals.push(d.ma10)
    if (typeof d.ma20 === 'number') allVals.push(d.ma20)
  })
  const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.002 : 1
  const minVal = allVals.length > 0 ? Math.min(...allVals) * 0.998 : 0
  const range = maxVal - minVal || 1
  const getY = (val) => (58 - ((val - minVal) / range) * 52).toFixed(1)

  return k10d.map((d, i) => `${xCoords[i]},${getY(d.ma10 || d.close)}`).join(' ')
})

const ma20Points = computed(() => {
  const k10d = normalizedK10d.value
  if (k10d.length < 10) return ''

  const hasAnyMa20 = k10d.some((d) => typeof d.ma20 === 'number')
  if (!hasAnyMa20) return ''

  const allVals = []
  k10d.forEach((d) => {
    if (typeof d.open === 'number') allVals.push(d.open)
    if (typeof d.high === 'number') allVals.push(d.high)
    if (typeof d.low === 'number') allVals.push(d.low)
    if (typeof d.close === 'number') allVals.push(d.close)
    if (typeof d.ma5 === 'number') allVals.push(d.ma5)
    if (typeof d.ma10 === 'number') allVals.push(d.ma10)
    if (typeof d.ma20 === 'number') allVals.push(d.ma20)
  })
  const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.002 : 1
  const minVal = allVals.length > 0 ? Math.min(...allVals) * 0.998 : 0
  const range = maxVal - minVal || 1
  const getY = (val) => (58 - ((val - minVal) / range) * 52).toFixed(1)

  return k10d.map((d, i) => `${xCoords[i]},${getY(d.ma20 || d.close)}`).join(' ')
})

const kPoints = computed(() => {
  const k10d = normalizedK10d.value
  if (k10d.length < 10) return ''
  const getKdY = (val) => (134 - (Math.min(100, Math.max(0, val || 50)) / 100) * 30).toFixed(1)
  return k10d.map((d, i) => `${xCoords[i]},${getKdY(d.k)}`).join(' ')
})

const dPoints = computed(() => {
  const k10d = normalizedK10d.value
  if (k10d.length < 10) return ''
  const getKdY = (val) => (134 - (Math.min(100, Math.max(0, val || 50)) / 100) * 30).toFixed(1)
  return k10d.map((d, i) => `${xCoords[i]},${getKdY(d.d)}`).join(' ')
})
</script>
