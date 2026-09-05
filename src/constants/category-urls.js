/**
 * category-urls.js — 個股標籤官方排行榜 URL 智慧對照表
 *
 * 職責：
 * - 提供 17 大選股來源標籤對應之富邦 DJ / 證交所官方排行榜網址
 * - 支援個股市場別（上市 tse / 上櫃 otc）智慧分流（上市 _0_ / 上櫃 _1_）
 * - 供 StockCard.vue 標籤點擊開新分頁查閱
 */

import { UI_STRINGS } from './ui-strings.js'

const BASE_FUBON = 'https://fubon-ebrokerdj.fbs.com.tw'

/**
 * 各標籤於上市 (tse) 與上櫃 (otc) 的端點對照表
 */
export const CATEGORY_URL_MAP = {
  // ── 熱門排行 ────────────────────────
  'Top100': {
    label: '量大',
    tse: `${BASE_FUBON}/z/zg/zg_BE_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_BE_1_1.djhtm`,
  },
  'VolumeTop': {
    label: '量大',
    tse: `${BASE_FUBON}/z/zg/zg_BE_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_BE_1_1.djhtm`,
  },
  'ValueTop': {
    label: '值大',
    tse: `${BASE_FUBON}/Z/ZG/ZG_CD.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_CD_1.djhtm`,
  },
  'TurnoverRate': {
    label: '週轉',
    tse: `${BASE_FUBON}/Z/ZG/ZG_BD.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_BD_1_0.djhtm`,
  },

  // ── 法人與主力買超 ────────────────────────
  'ForeignBuy': {
    label: '外資買',
    tse: `${BASE_FUBON}/z/zg/zg_D_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_D_1_1.djhtm`,
  },
  'ForeignBuy1D': {
    label: '外資1D',
    tse: `${BASE_FUBON}/z/zg/zg_D_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_D_1_1.djhtm`,
  },
  'ForeignBuy3D': {
    label: '外資3D',
    tse: `${BASE_FUBON}/z/zg/zg_D_0_3.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_D_1_3.djhtm`,
  },
  'SitcaBuy': {
    label: '投信買',
    tse: `${BASE_FUBON}/z/zg/zg_DD_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_DD_1_1.djhtm`,
  },
  'SitcaBuy3D': {
    label: '投信3D',
    tse: `${BASE_FUBON}/z/zg/zg_DD_0_3.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_DD_1_3.djhtm`,
  },
  'SitcaBuy5D': {
    label: '投信5D',
    tse: `${BASE_FUBON}/z/zg/zg_DD_0_5.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_DD_1_5.djhtm`,
  },
  'MajorBuy': {
    label: '主力買',
    tse: `${BASE_FUBON}/z/zg/zg_F_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_F_1_1.djhtm`,
  },
  'MajorBuy1D': {
    label: '主力1D',
    tse: `${BASE_FUBON}/z/zg/zg_F_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_F_1_1.djhtm`,
  },
  'MajorBuy3D': {
    label: '主力3D',
    tse: `${BASE_FUBON}/z/zg/zg_F_0_3.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_F_1_3.djhtm`,
  },

  // ── 法人與主力賣超 (避雷檢核) ────────────────────────
  'ForeignSell': {
    label: '外資賣',
    tse: `${BASE_FUBON}/z/zg/zg_DA_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_DA_1_1.djhtm`,
  },
  'ForeignSell1D': {
    label: '外資賣1D',
    tse: `${BASE_FUBON}/z/zg/zg_DA_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_DA_1_1.djhtm`,
  },
  'ForeignSell3D': {
    label: '外資賣3D',
    tse: `${BASE_FUBON}/z/zg/zg_DA_0_3.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_DA_1_3.djhtm`,
  },
  'MajorSell': {
    label: '主力賣',
    tse: `${BASE_FUBON}/z/zg/zg_FA_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_FA_1_1.djhtm`,
  },
  'MajorSell1D': {
    label: '主力賣1D',
    tse: `${BASE_FUBON}/z/zg/zg_FA_0_1.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_FA_1_1.djhtm`,
  },
  'MajorSell3D': {
    label: '主力賣3D',
    tse: `${BASE_FUBON}/z/zg/zg_FA_0_3.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_FA_1_3.djhtm`,
  },
  'SitcaSell': {
    label: '投信賣',
    tse: `${BASE_FUBON}/z/zg/zg_DE_0_3.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_DE_1_3.djhtm`,
  },
  'SitcaSell3D': {
    label: '投信賣3D',
    tse: `${BASE_FUBON}/z/zg/zg_DE_0_3.djhtm`,
    otc: `${BASE_FUBON}/z/zg/zg_DE_1_3.djhtm`,
  },

  // ── 指數成分股與產業 ────────────────────────
  '0050': {
    label: '0050',
    tse: 'https://www.twse.com.tw/zh/indices/taiex/ftse-tw-series.html',
    otc: 'https://www.twse.com.tw/zh/indices/taiex/ftse-tw-series.html',
  },
  '0051': {
    label: '0051',
    tse: 'https://www.twse.com.tw/zh/indices/taiex/ftse-tw-series.html',
    otc: 'https://www.twse.com.tw/zh/indices/taiex/ftse-tw-series.html',
  },
  '半導體': {
    label: '半導體',
    tse: 'https://www.twse.com.tw/zh/indices/taiex/industry.html',
    otc: 'https://www.twse.com.tw/zh/indices/taiex/industry.html',
  },
}

/**
 * 依個股市場別取得特定標籤之官方排行榜 URL
 * @param {string} categoryKey - 例如 'ForeignBuy1D', 'Top100', 'ValueTop'
 * @param {string|Object} marketOrStock - 市場別字串 ('otc' | 'tse') 或包含 market 屬性之個股物件
 * @returns {string|null}
 */
export function getCategoryUrl(categoryKey, marketOrStock = 'tse') {
  if (!categoryKey) return null
  const config = CATEGORY_URL_MAP[categoryKey]
  if (!config) return null

  let marketStr = 'tse'
  if (typeof marketOrStock === 'string') {
    marketStr = marketOrStock.toLowerCase()
  } else if (marketOrStock && typeof marketOrStock === 'object') {
    marketStr = (marketOrStock.market || '').toLowerCase()
  }

  const isOtc = marketStr === 'otc' || marketStr === '上櫃' || marketStr === 'c'
  return isOtc ? config.otc : config.tse
}

/**
 * 格式化單一個股之所有可點擊標籤項目清單
 * @param {Object} stock - 個股物件 (含 categories 與 market)
 * @returns {Array<{ key: string, label: string, url: string|null }>}
 */
export function getStockCategoryItems(stock) {
  if (!stock || !Array.isArray(stock.categories)) return []

  const tagMap = UI_STRINGS.CATEGORY_TAGS || {}
  const seenLabels = new Set()
  const items = []

  for (const cat of stock.categories) {
    // 排除賣超標籤（賣超已於右側 sellWarningText 警示列獨立呈現）
    if (cat.includes('Sell')) continue

    const label = tagMap[cat] || cat
    if (!label || seenLabels.has(label)) continue

    seenLabels.add(label)
    items.push({
      key: cat,
      label,
      url: getCategoryUrl(cat, stock.market),
    })
  }

  return items
}
