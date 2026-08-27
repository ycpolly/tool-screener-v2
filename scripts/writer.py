"""
writer.py
將所有計算完成的資料寫入 stock-pool.json

職責：唯一允許執行檔案 I/O 的模組
規範：不做任何計算，只做格式整理與 JSON 輸出
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Set

# 輸出路徑（相對於 tool-screener-v2 根目錄）
OUTPUT_PATH = Path('public/data/stock-pool.json')

# 半導體族群標籤（固定清單，由使用者維護）
SEMI_CODES: Set[str] = {
    '2330', '2303', '6770', '3711', '2449', '6239',
    '3037', '8046', '3189', '3707', '6488', '5483',
    '2327', '2492', '3026', '2408', '2344', '3260',
    '8299', '2454', '3034', '2379',
}

# 各排行榜 → categories 標籤對應
_RANKING_TO_CATEGORY = {
    'holdings0050':  '0050',
    'holdings0051':  '0051',
    'top100Volume':  'Top100',
    'valueTop':      'ValueTop',
    'sitcaBuy3D':    'SitcaBuy3D',
    'sitcaBuy5D':    'SitcaBuy5D',
    'foreignBuy1D':  'ForeignBuy1D',
    'foreignBuy3D':  'ForeignBuy3D',
    'majorBuy1D':    'MajorBuy1D',
    'majorBuy3D':    'MajorBuy3D',
    'turnoverRate':  'TurnoverRate',
}

# 「傘形」合併 categories（只要子類出現就加上傘形）
_UMBRELLA_CATEGORIES = {
    'SitcaBuy':   {'SitcaBuy3D', 'SitcaBuy5D'},
    'ForeignBuy': {'ForeignBuy1D', 'ForeignBuy3D'},
    'MajorBuy':   {'MajorBuy1D', 'MajorBuy3D'},
}


def _is_valid_stock_code(code: str) -> bool:
    """只收錄 4 位數字、非 00 開頭的一般股票"""
    s = str(code).strip()
    return len(s) == 4 and s.isdigit() and not s.startswith('00')


def _build_categories(
    code: str,
    rankings: Dict,
    etf_holdings: Dict,
    existing_cats: List[str],
) -> List[str]:
    """
    根據排行榜和 ETF 成分股，計算該個股應有的 categories

    Priority：
      1. 從各排行榜 / ETF holdings 動態計算
      2. 半導體族群（固定清單）
      3. 傘形合併（SitcaBuy3D + SitcaBuy5D → SitcaBuy）
    """
    cats: Set[str] = set()

    # ETF 持股
    for etf_key, cat_tag in [('holdings0050', '0050'), ('holdings0051', '0051')]:
        codes_in = {s['code'] for s in etf_holdings.get(etf_key, {}).get('stocks', [])}
        if code in codes_in:
            cats.add(cat_tag)

    # 各排行榜
    for rank_key, cat_tag in _RANKING_TO_CATEGORY.items():
        if rank_key in ('holdings0050', 'holdings0051'):
            continue
        codes_in = {s['code'] for s in rankings.get(rank_key, {}).get('stocks', [])}
        if code in codes_in:
            cats.add(cat_tag)

    # 半導體
    if code in SEMI_CODES:
        cats.add('半導體')

    # 傘形合併
    for umbrella, children in _UMBRELLA_CATEGORIES.items():
        if cats & children:
            cats.add(umbrella)
        else:
            cats.discard(umbrella)

    return sorted(cats)  # 排序確保輸出穩定


def build_stock_pool(
    yahoo_results:  Dict,           # {code: {ohlcv, market, symbol, ...indicators}}
    disposed_codes: Set[str],
    etf_holdings:   Dict,           # {holdings0050: {...}, holdings0051: {...}}
    rankings:       Dict,           # {top100Volume: {...}, ...}
    market_data:    Optional[Dict], # {taiex, otc, regime}
) -> Dict:
    """
    組裝完整的 stock-pool.json 資料結構

    Args:
        yahoo_results:  每檔個股計算好的指標物件
        disposed_codes: 即時處置股代碼集合
        etf_holdings:   0050/0051 成分股
        rankings:       14 種富邦 DJ 排行榜
        market_data:    大盤指數與燈號

    Returns:
        stock-pool.json 完整物件
    """
    # 收集所有應在池中的股票代碼
    all_codes: Set[str] = set()
    for code, data in yahoo_results.items():
        if data and _is_valid_stock_code(code):
            all_codes.add(code)

    # 從排行榜也加入新股（可能是 Yahoo 抓失敗的）
    for rank_key in _RANKING_TO_CATEGORY:
        src = etf_holdings if rank_key.startswith('holdings') else rankings
        for s in src.get(rank_key, {}).get('stocks', []):
            if _is_valid_stock_code(s.get('code', '')):
                all_codes.add(s['code'])

    # ── 建立全市場名稱字典（優先順序：ETF holdings > 富邦排行榜）──
    # 原因：yahoo.py 只抓 OHLCV，不含名稱；必須從爬蟲資料補齊
    name_dict: Dict[str, str] = {}

    # 第一層：富邦各排行榜（最廣，幾乎涵蓋全池）
    for rank_data in rankings.values():
        for s in rank_data.get('stocks', []):
            c = s.get('code', '')
            n = s.get('name', '').strip()
            if c and n and n != c:   # name 有意義才覆蓋
                name_dict[c] = n

    # 第二層：ETF holdings（名稱更正確，覆蓋排行榜）
    for holdings in etf_holdings.values():
        for s in holdings.get('stocks', []):
            c = s.get('code', '')
            n = s.get('name', '').strip()
            if c and n and n != c:
                name_dict[c] = n

    # 建立個股物件
    stocks = []
    for code in sorted(all_codes):
        data = yahoo_results.get(code)
        if not data:
            continue  # Yahoo 抓失敗，不納入（不補假資料）

        # 從名稱字典查找，找不到才 fallback 到代號
        name = name_dict.get(code, code)

        cats = _build_categories(code, rankings, etf_holdings, data.get('categories', []))
        if not cats:
            continue  # 不屬於任何類別，不納入

        stock = {
            'code':      code,
            'name':      name,
            'market':    data.get('market', 'tse'),
            'categories': cats,
            'isDisposed': code in disposed_codes,

            # 行情
            'price':      data.get('price',     0.0),
            'prevClose':  data.get('prevClose',  0.0),
            'open':       data.get('open',       0.0),
            'high':       data.get('high',       0.0),
            'low':        data.get('low',        0.0),
            'change':     data.get('change',     0.0),
            'changePct':  data.get('changePct',  0.0),
            'volume':     data.get('volume',     0),

            # 均線
            'ma5':   data.get('ma5',  0.0),
            'ma10':  data.get('ma10', 0.0),
            'ma20':  data.get('ma20', 0.0),
            'ma60':  data.get('ma60', 0.0),
            'vMa5':  data.get('vMa5',  0),
            'vMa10': data.get('vMa10', 0),
            'maxVol10d':      data.get('maxVol10d',      0),
            'hasVolumeBurst': data.get('hasVolumeBurst', False),

            # 高低價
            'high5d':  data.get('high5d',  0.0),
            'high10d': data.get('high10d', 0.0),
            'high20d': data.get('high20d', 0.0),
            'low5d':   data.get('low5d',   0.0),
            'low10d':  data.get('low10d',  0.0),
            'low20d':  data.get('low20d',  0.0),

            # KD
            'kd': data.get('kd', {'k': 50.0, 'd': 50.0, 'prevK': 50.0, 'prevD': 50.0}),

            # Sparkline & 歷史
            'sparkline':  data.get('sparkline',  []),
            'history10d': data.get('history10d', []),
        }
        stocks.append(stock)

    print(f'[writer] 組裝完成：{len(stocks)} 檔個股')

    return {
        'meta': {
            'updatedAt':   datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00'),
            'totalStocks': len(stocks),
        },
        'stocks':   stocks,
        'rankings': {
            **{k: {'date': v.get('date', ''), 'sourceUrl': v.get('sourceUrl', ''), 'stocks': v.get('stocks', [])}
               for k, v in rankings.items()},
            **{k: {'date': v.get('date', ''), 'sourceUrl': v.get('sourceUrl', ''), 'stocks': v.get('stocks', [])}
               for k, v in etf_holdings.items()},
        },
        'market': market_data,
    }


def write_json(pool: Dict) -> None:
    """
    將 pool 物件寫入 public/data/stock-pool.json

    注意：歷史 history10d 較大，若未來效能有問題可拆成獨立 JSON
    """
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = OUTPUT_PATH.with_suffix('.tmp.json')

    # 先寫暫存檔，再 rename（避免寫到一半被前端讀到）
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(pool, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp_path, OUTPUT_PATH)

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f'[writer] 寫入完成：{OUTPUT_PATH} ({size_kb:.1f} KB)')
