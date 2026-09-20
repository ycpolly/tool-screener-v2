/**
 * scripts/backtest.js
 * 
 * 五大選股模式歷史量化回測引擎
 * 
 * 核心功能：
 * 1. 讀取 stock-pool.json 歷史走勢與籌碼紀錄
 * 2. 模擬歷史交易日收盤執行選股（直接引入 src/engine/screener.js 與 screener-modes.js）
 * 3. 追蹤選出標的在 T+1 ~ T+10 天之真實價位表現
 * 4. 統計：
 *    - 觸及 +5% 目標價機會率（最高價曾到達 +5% 的比例）
 *    - 各天期（T+3, T+5, T+10）持有收盤勝率與獲利幅度
 *    - 平均波段最大獲利 (MFE) 與最大回撤 (MAE)
 *    - 停損先觸發率（在觸及 +5% 前先跌破 -3% 或 -5%）
 *    - 標的平均發酵天數
 * 
 * 執行方式：
 *   node scripts/backtest.js
 *   node scripts/backtest.js --detail
 *   node scripts/backtest.js --mode=WASHOUT_IGNITION
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { evaluateStock, sliceStockAt } from '../src/engine/screener.js'
import { SCREENER_MODES } from '../src/constants/screener-modes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 參數解析
const args = process.argv.slice(2)
const showDetail = args.includes('--detail') || args.includes('-d')
const targetModeArg = args.find(a => a.startsWith('--mode='))?.split('=')[1]

// 載入資料庫
const poolPath = path.resolve(__dirname, '../public/data/stock-pool.json')
if (!fs.existsSync(poolPath)) {
  console.error(`錯誤：找不到資料檔案 ${poolPath}`)
  process.exit(1)
}

const poolData = JSON.parse(fs.readFileSync(poolPath, 'utf8'))
const stocks = poolData.stocks || []

if (stocks.length === 0) {
  console.error('錯誤：股票池為空')
  process.exit(1)
}

// 取得基準日期序列（由早到晚）
const sampleStock = stocks.find(s => s.history10d && s.history10d.length >= 10) || stocks[0]
const availableDates = (sampleStock.history10d || []).map(b => b.date)

console.log('='.repeat(78))
console.log('  台股波段策略量化回測引擎 (Forward Backtesting Engine)')
console.log('='.repeat(78))
console.log(`- 股票池總數：${stocks.length} 檔`)
console.log(`- 可用歷史交易日：${availableDates.length} 天 (${availableDates[0]} ~ ${availableDates[availableDates.length - 1]})`)

// 評估模式清單
const modeKeys = targetModeArg 
  ? [targetModeArg] 
  : Object.keys(SCREENER_MODES)

/**
 * 回測核心函式
 */
function runBacktest() {
  // 設定回測區間：
  // 為了追蹤選出後的 T+3, T+5, T+10 表現，選股日 T 最少需要保留後續天數
  // 我們針對可用交易日進行測試
  const totalDays = availableDates.length
  
  // 記錄每個模式的統計資料
  const stats = {}
  for (const modeId of modeKeys) {
    stats[modeId] = {
      modeId,
      label: SCREENER_MODES[modeId]?.label || modeId,
      totalSignals: 0,
      picks: [],
      // 統計指標
      hit5pctWithin5d: 0,   // 5天內最高價曾達到 +5%
      hit5pctWithin10d: 0,  // 10天內最高價曾達到 +5%
      hitStop3Before5: 0,   // 在達到 +5% 前先跌破 -3%
      hitStop5Before5: 0,   // 在達到 +5% 前先跌破 -5%
      t3Wins: 0,            // T+3 收盤 > 進場價
      t5Wins: 0,            // T+5 收盤 > 進場價
      t10Wins: 0,           // T+10 收盤 > 進場價
      t5Above5pct: 0,       // T+5 收盤 >= +5%
      t10Above5pct: 0,      // T+10 收盤 >= +5%
      mfe5Sum: 0,           // 5天內平均最高獲利
      mae5Sum: 0,           // 5天內平均最深跌幅
      daysToPeakSum: 0,     // 達到最高點所需平均天數
    }
  }

  // 走訪每一個歷史交易日作為選股日 (T 日)
  // 最早需要第 4 天（保證均線指標穩定），最晚保留至少 3 天給後續追蹤
  const minTIndex = 4
  const maxTIndex = totalDays - 2 // 至少有後續 1 天以上觀察

  for (let t = minTIndex; t <= maxTIndex; t++) {
    const tDate = availableDates[t]
    const dayOffset = totalDays - 1 - t // sliceStockAt 所需的 dayOffset

    for (const stock of stocks) {
      if (!stock.history10d || stock.history10d.length < totalDays) continue

      // 取得該股票在 T 日的快照
      const sliced = sliceStockAt(stock, dayOffset)
      if (!sliced || !sliced.price || sliced.price <= 0) continue

      // 取得 T 日收盤價作為進場價
      const entryPrice = sliced.price
      const postBars = stock.history10d.slice(t + 1) // T 日之後的 K 線
      if (postBars.length === 0) continue

      for (const modeId of modeKeys) {
        const modeConfig = SCREENER_MODES[modeId]
        if (!modeConfig) continue

        // 執行選股判定
        const evalResult = evaluateStock(sliced, modeConfig.defaultParams, modeId)
        if (!evalResult.isMatch) continue

        // 命中訊號！記錄並追蹤後續表現
        const stat = stats[modeId]
        stat.totalSignals++

        // 追蹤後續行情 (最多 10 天)
        const trackLen = postBars.length
        let maxHigh = -Infinity
        let minLow = Infinity
        let peakDay = 0
        let reached5pct = false
        let reached5pctDay = null
        let dropped3pct = false
        let dropped5pct = false

        for (let d = 0; d < trackLen && d < 10; d++) {
          const bar = postBars[d]
          const highPct = ((bar.high - entryPrice) / entryPrice) * 100
          const lowPct = ((bar.low - entryPrice) / entryPrice) * 100

          if (bar.high > maxHigh) {
            maxHigh = bar.high
            peakDay = d + 1
          }
          if (bar.low < minLow) {
            minLow = bar.low
          }

          // 檢驗是否觸及 -3% 或 -5%
          if (lowPct <= -3.0 && !reached5pct) {
            dropped3pct = true
          }
          if (lowPct <= -5.0 && !reached5pct) {
            dropped5pct = true
          }

          // 檢驗是否觸及 +5%
          if (highPct >= 5.0 && !reached5pct) {
            reached5pct = true
            reached5pctDay = d + 1
          }
        }

        const maxGainPct = ((maxHigh - entryPrice) / entryPrice) * 100
        const maxDrawdownPct = ((minLow - entryPrice) / entryPrice) * 100

        // 累計 MFE 與 MAE (以 5 天內為基準)
        const bars5d = postBars.slice(0, 5)
        const maxHigh5d = Math.max(...bars5d.map(b => b.high))
        const minLow5d = Math.min(...bars5d.map(b => b.low))
        const gain5dPct = ((maxHigh5d - entryPrice) / entryPrice) * 100
        const loss5dPct = ((minLow5d - entryPrice) / entryPrice) * 100

        stat.mfe5Sum += gain5dPct
        stat.mae5Sum += loss5dPct
        stat.daysToPeakSum += peakDay

        if (maxHigh5d >= entryPrice * 1.05) stat.hit5pctWithin5d++
        if (maxHigh >= entryPrice * 1.05) stat.hit5pctWithin10d++
        if (dropped3pct) stat.hitStop3Before5++
        if (dropped5pct) stat.hitStop5Before5++

        // T+3 收盤
        if (postBars.length >= 3) {
          const t3Close = postBars[2].close
          if (t3Close > entryPrice) stat.t3Wins++
        }

        // T+5 收盤
        if (postBars.length >= 5) {
          const t5Close = postBars[4].close
          if (t5Close > entryPrice) stat.t5Wins++
          if (t5Close >= entryPrice * 1.05) stat.t5Above5pct++
        }

        // T+10 收盤
        if (postBars.length >= 10) {
          const t10Close = postBars[9].close
          if (t10Close > entryPrice) stat.t10Wins++
          if (t10Close >= entryPrice * 1.05) stat.t10Above5pct++
        }

        // 記錄該筆詳細明細
        const pickRecord = {
          code: stock.code,
          name: stock.name,
          date: tDate,
          entryPrice,
          peakDay,
          maxGainPct: round1(maxGainPct),
          maxDrawdownPct: round1(maxDrawdownPct),
          reached5pct,
          reached5pctDay,
          postCloseT3: postBars[2] ? postBars[2].close : null,
          postCloseT5: postBars[4] ? postBars[4].close : null,
          t5ReturnPct: postBars[4] ? round1(((postBars[4].close - entryPrice) / entryPrice) * 100) : null,
        }
        stat.picks.push(pickRecord)
      }
    }
  }

  return stats
}

function round1(v) {
  return Math.round(v * 10) / 10
}

function pctStr(count, total) {
  if (!total || total === 0) return '0.0%'
  return `${((count / total) * 100).toFixed(1)}%`
}

// 執行回測
const results = runBacktest()

// 輸出總表
console.log('\n' + '='.repeat(78))
console.log('  五大選股模式量化回測成果矩陣 (T+1 ~ T+10 追蹤)')
console.log('='.repeat(78))

const summaryTable = []
for (const modeId of modeKeys) {
  const s = results[modeId]
  const n = s.totalSignals
  if (n === 0) {
    summaryTable.push({
      '策略模式': `${s.label} (${modeId})`,
      '觸發次數': 0,
      '5日觸及+5%': '—',
      '5日平均最高': '—',
      '5日平均最深': '—',
      '先跌破-3%': '—',
      'T+3收盤勝率': '—',
      'T+5收盤勝率': '—',
      'T+5收盤>=5%': '—',
    })
    continue
  }

  summaryTable.push({
    '策略模式': `${s.label}`,
    '訊號數': n,
    '5日達+5%': `${pctStr(s.hit5pctWithin5d, n)} (${s.hit5pctWithin5d}/${n})`,
    '平均最高MFE': `+${round1(s.mfe5Sum / n)}%`,
    '平均最深MAE': `${round1(s.mae5Sum / n)}%`,
    '先跌破-3%': `${pctStr(s.hitStop3Before5, n)}`,
    'T+3勝率': `${pctStr(s.t3Wins, n)}`,
    'T+5勝率': `${pctStr(s.t5Wins, n)}`,
    'T+5收盤>=5%': `${pctStr(s.t5Above5pct, n)}`,
  })
}

console.table(summaryTable)

// 重點個股驗證與標竿分析 (例如 3443 創意 與 3260 威剛)
console.log('\n' + '='.repeat(78))
console.log('  代表個股實戰回溯檢驗 (Case Studies)')
console.log('='.repeat(78))

const caseStudies = [
  { code: '3443', name: '創意', targetDate: '2026-09-10', targetMode: 'WASHOUT_IGNITION' },
  { code: '3260', name: '威剛', targetDate: '2026-09-09', targetMode: 'BOTTOM_CONSOLIDATION' },
]

for (const cs of caseStudies) {
  const stat = results[cs.targetMode]
  const pick = stat?.picks.find(p => p.code === cs.code && p.date === cs.targetDate)
  if (pick) {
    console.log(`\n【${pick.name} (${pick.code})】 命中模式：${SCREENER_MODES[cs.targetMode]?.label} (${cs.targetDate})`)
    console.log(`  - 選出進場價：${pick.entryPrice}`)
    console.log(`  - 5日內最高漲幅：+${pick.maxGainPct}% (發生於進場後第 ${pick.peakDay} 天)`)
    console.log(`  - 5日內最大拉回：${pick.maxDrawdownPct}%`)
    console.log(`  - T+5 收盤價與報酬率：${pick.postCloseT5 ?? '尚未滿5天'} (${pick.t5ReturnPct != null ? (pick.t5ReturnPct >= 0 ? '+' : '') + pick.t5ReturnPct + '%' : '—'})`)
    console.log(`  - 是否觸及 +5%：${pick.reached5pct ? `是 (於第 ${pick.reached5pctDay} 天達成)` : '否'}`)
  } else {
    console.log(`\n【${cs.name} (${cs.code})】在 ${cs.targetDate} 未命中 ${cs.targetMode}`)
  }
}

// 若有 --detail 參數，印出所有選出明細
if (showDetail) {
  console.log('\n' + '='.repeat(78))
  console.log('  各模式選出標的詳細清單 (--detail)')
  console.log('='.repeat(78))

  for (const modeId of modeKeys) {
    const s = results[modeId]
    console.log(`\n[${s.label}] 共 ${s.picks.length} 筆選出：`)
    if (s.picks.length === 0) {
      console.log('  (無選出紀錄)')
      continue
    }
    const tableData = s.picks.map(p => ({
      '代碼': p.code,
      '名稱': p.name,
      '選出日': p.date,
      '進場價': p.entryPrice,
      '最高漲幅': `+${p.maxGainPct}%`,
      '最深拉回': `${p.maxDrawdownPct}%`,
      '達+5%天數': p.reached5pctDay ? `第 ${p.reached5pctDay} 天` : '未達',
      'T+5報酬': p.t5ReturnPct != null ? `${p.t5ReturnPct >= 0 ? '+' : ''}${p.t5ReturnPct}%` : '未滿',
    }))
    console.table(tableData)
  }
}

console.log('\n' + '='.repeat(78))
console.log('回測執行完畢。可使用 --detail 檢視完整個股歷程，或使用 --mode=MODE_ID 鎖定單一模式。')
console.log('='.repeat(78) + '\n')
