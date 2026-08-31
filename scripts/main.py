"""
main.py
主流程編排

架構：collect → enrich → write
  collect: 從各資料源抓取原始資料
  enrich:  計算技術指標、校正價格、判定燈號
  write:   輸出 JSON

規範：
  - 本模組只做 orchestration（呼叫順序與組裝）
  - 不含任何業務邏輯（計算/爬蟲）
  - GitHub Actions 呼叫入口
"""

import sys
import time
from datetime import datetime

from scripts.scrapers.disposed     import fetch_disposed_codes
from scripts.scrapers.moneydj      import fetch_etf_holdings
from scripts.scrapers.fubon        import fetch_all_rankings
from scripts.scrapers.yahoo        import fetch_raw_ohlcv_batch
from scripts.scrapers.chips        import fetch_all_chips_batch
from scripts.engine.indicators     import calc_stock_indicators
from scripts.engine.calibration    import calibrate_closing_prices
from scripts.engine.market_regime  import fetch_market_data
from scripts.writer                import build_stock_pool, write_json



def collect(verbose: bool = True) -> dict:
    """
    階段一：抓取所有原始資料

    Returns:
        {
          "disposed_codes":  set,
          "etf_holdings":   {holdings0050: {...}, holdings0051: {...}},
          "rankings":       {top100Volume: {...}, ...},
          "market_raw":     market_data dict or None,
        }
    """
    if verbose:
        print('=' * 60)
        print(f'[main] COLLECT 開始 @ {datetime.now().strftime("%H:%M:%S")}')
        print('=' * 60)

    t0 = time.time()

    # 處置股（每次必抓，嚴禁沿用舊值）
    disposed_codes = fetch_disposed_codes()

    # ETF 成分股
    date_0050, stocks_0050 = fetch_etf_holdings('0050')
    date_0051, stocks_0051 = fetch_etf_holdings('0051')
    etf_holdings = {
        'holdings0050': {
            'date':      date_0050,
            'sourceUrl': 'https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid=0050.TW',
            'stocks':    stocks_0050,
        },
        'holdings0051': {
            'date':      date_0051,
            'sourceUrl': 'https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid=0051.TW',
            'stocks':    stocks_0051,
        },
    }

    # 富邦 DJ 28 個排行榜
    rankings = fetch_all_rankings()

    # 大盤資料
    market_data = fetch_market_data()

    if verbose:
        elapsed = time.time() - t0
        print(f'[main] COLLECT 完成（{elapsed:.1f}s）')

    return {
        'disposed_codes': disposed_codes,
        'etf_holdings':   etf_holdings,
        'rankings':       rankings,
        'market_data':    market_data,
    }


def enrich(raw: dict, with_chips: bool = False, verbose: bool = True) -> dict:
    """
    階段二：Yahoo 抓 K 線 + 計算指標 + 校正收盤 + (選填) 籌碼集中度與短沖分析

    Args:
        raw: collect() 的回傳值
        with_chips: 是否抓取 1D/3D/5D 籌碼集中度與短沖分點（晚上 19:00 第二批執行）

    Returns:
        {
          "yahoo_results":  {code: indicator_dict, ...},
          "disposed_codes": set,
          "etf_holdings":   {...},
          "rankings":       {...},
          "market_data":    {...},
          "chips_data":     {...} or None,
        }
    """
    if verbose:
        print('=' * 60)
        print(f'[main] ENRICH 開始 @ {datetime.now().strftime("%H:%M:%S")}')
        print('=' * 60)

    t0 = time.time()

    # 收集需要抓 Yahoo 的所有股票代碼
    all_codes: set = set()
    for h in raw['etf_holdings'].values():
        for s in h.get('stocks', []):
            all_codes.add(s['code'])
    for r in raw['rankings'].values():
        for s in r.get('stocks', []):
            all_codes.add(s['code'])

    # 過濾無效代碼
    from scripts.writer import _is_valid_stock_code
    all_codes = {c for c in all_codes if _is_valid_stock_code(c)}

    if verbose:
        print(f'[main] 需抓 Yahoo 個股：{len(all_codes)} 檔')

    # Yahoo 批次抓取 OHLCV
    raw_ohlcv_map = fetch_raw_ohlcv_batch(list(all_codes), max_workers=10)

    # 計算每檔技術指標
    yahoo_results = {}
    for code, raw_data in raw_ohlcv_map.items():
        if not raw_data:
            yahoo_results[code] = None
            continue
        indicators = calc_stock_indicators(raw_data['ohlcv'])
        if not indicators:
            yahoo_results[code] = None
            continue
        yahoo_results[code] = {
            **indicators,
            'symbol': raw_data['symbol'],
            'market': raw_data['market'],
        }

    # TWSE MIS 盤後收盤價校正
    stocks_for_cal = [
        {
            'code':       code,
            'name':       '',
            'market':     data.get('market', 'tse'),
            'price':      data.get('price', 0.0),
            'prevClose':  data.get('prevClose', 0.0),
            'sparkline':  data.get('sparkline', []),
            'history10d': data.get('history10d', []),
        }
        for code, data in yahoo_results.items()
        if data
    ]
    calibrate_closing_prices(stocks_for_cal)

    # 把校正結果同步回 yahoo_results
    for s in stocks_for_cal:
        code = s['code']
        if code in yahoo_results and yahoo_results[code]:
            yahoo_results[code]['price']      = s['price']
            yahoo_results[code]['prevClose']  = s['prevClose']
            yahoo_results[code]['change']     = s.get('change',    yahoo_results[code].get('change', 0))
            yahoo_results[code]['changePct']  = s.get('changePct', yahoo_results[code].get('changePct', 0))
            yahoo_results[code]['sparkline']  = s['sparkline']
            yahoo_results[code]['history10d'] = s['history10d']

    # 籌碼集中度與短沖避雷分析 (若指定 with_chips)
    chips_data = None
    if with_chips:
        stocks_for_chips = [
            {'code': code, 'history10d': data.get('history10d', [])}
            for code, data in yahoo_results.items()
            if data
        ]
        chips_data = fetch_all_chips_batch(stocks_for_chips, max_workers=10, verbose=verbose)

    if verbose:
        ok = sum(1 for v in yahoo_results.values() if v)
        elapsed = time.time() - t0
        print(f'[main] ENRICH 完成（{elapsed:.1f}s）— 指標計算成功 {ok}/{len(yahoo_results)} 檔')

    return {
        'yahoo_results':  yahoo_results,
        'disposed_codes': raw['disposed_codes'],
        'etf_holdings':   raw['etf_holdings'],
        'rankings':       raw['rankings'],
        'market_data':    raw['market_data'],
        'chips_data':     chips_data,
    }


def write(enriched: dict, verbose: bool = True) -> None:
    """
    階段三：組裝並寫入 JSON
    """
    if verbose:
        print('=' * 60)
        print(f'[main] WRITE 開始 @ {datetime.now().strftime("%H:%M:%S")}')
        print('=' * 60)

    pool = build_stock_pool(
        yahoo_results  = enriched['yahoo_results'],
        disposed_codes = enriched['disposed_codes'],
        etf_holdings   = enriched['etf_holdings'],
        rankings       = enriched['rankings'],
        market_data    = enriched['market_data'],
        chips_data     = enriched.get('chips_data'),
    )
    write_json(pool)

    if verbose:
        print('[main] WRITE 完成')


def main():
    with_chips = '--with-chips' in sys.argv
    start = time.time()
    print(f'\n{"=" * 60}')
    print(f'tool-screener-v2 資料更新 {"(含 1D/3D/5D 籌碼集中度與短沖避雷)" if with_chips else "(第一批選股名單更新)"}')
    print(f'開始時間：{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'{"=" * 60}\n')

    raw      = collect()
    enriched = enrich(raw, with_chips=with_chips)
    write(enriched)

    elapsed = time.time() - start
    print(f'\n[main] 全部完成，總耗時 {elapsed:.1f}s')


if __name__ == '__main__':
    main()

