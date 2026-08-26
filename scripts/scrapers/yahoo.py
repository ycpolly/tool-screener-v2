"""
scrapers/yahoo.py
從 Yahoo Finance API 抓取個股 3 個月歷史 K 線原始資料

職責：只負責 HTTP 下載，解析成乾淨的 OHLCV 陣列
指標計算（MA/KD/Sparkline）一律由 engine/indicators.py 負責
"""

import json
import ssl
import urllib.request
from typing import Optional, List, Dict

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    )
}

# 台股後綴：上市用 .TW，上櫃用 .TWO
_SUFFIXES = ['.TW', '.TWO']


def fetch_raw_ohlcv(code: str) -> Optional[Dict]:
    """
    從 Yahoo Finance 抓取個股 3 個月日 K 原始資料

    Args:
        code: 股票代號（純數字，e.g. "2330"）

    Returns:
        {
          "symbol":  "2330.TW",    # 實際命中的 Yahoo symbol
          "market":  "tse",        # "tse" 或 "otc"（依 symbol 後綴判斷）
          "ohlcv": [               # 由早到晚排序
            {
              "open": 960.0, "high": 975.0, "low": 958.0,
              "close": 972.0, "volume": 24000000
            },
            ...
          ]
        }
        若抓取失敗，回傳 None
    """
    for suffix in _SUFFIXES:
        symbol = f'{code}{suffix}'
        url = (
            f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}'
            f'?range=3mo&interval=1d'
        )
        req = urllib.request.Request(url, headers=_HEADERS)
        try:
            with urllib.request.urlopen(req, context=_ctx, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            result = data['chart']['result'][0]
            quote  = result['indicators']['quote'][0]

            raw_c = quote.get('close',  [])
            raw_o = quote.get('open',   [])
            raw_h = quote.get('high',   [])
            raw_l = quote.get('low',    [])
            raw_v = quote.get('volume', [])

            # 過濾 None 值，保留所有欄位都有效的交易日
            ohlcv = []
            for i in range(len(raw_c)):
                c = raw_c[i]
                v = raw_v[i] if i < len(raw_v) else None
                if c is None or v is None:
                    continue
                ohlcv.append({
                    'open':   raw_o[i] if i < len(raw_o) and raw_o[i] is not None else c,
                    'high':   raw_h[i] if i < len(raw_h) and raw_h[i] is not None else c,
                    'low':    raw_l[i] if i < len(raw_l) and raw_l[i] is not None else c,
                    'close':  c,
                    'volume': int(v),
                })

            if len(ohlcv) < 10:
                # 資料不足，嘗試另一個後綴
                continue

            market = 'otc' if suffix == '.TWO' else 'tse'
            return {
                'symbol': symbol,
                'market': market,
                'ohlcv':  ohlcv,
            }

        except Exception:
            # 靜默失敗，嘗試下一個後綴
            continue

    return None


def fetch_raw_ohlcv_batch(
    codes: List[str],
    max_workers: int = 8
) -> Dict[str, Optional[Dict]]:
    """
    批次抓取多檔個股，使用多執行緒加速

    Args:
        codes:       股票代號清單
        max_workers: 最大並行執行緒數（預設 8，避免 Yahoo 限流）

    Returns:
        {code: fetch_raw_ohlcv() 結果, ...}
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    results: Dict[str, Optional[Dict]] = {}
    total = len(codes)
    done  = 0

    print(f'[yahoo] 開始批次抓取 {total} 檔個股 (max_workers={max_workers})...')

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {executor.submit(fetch_raw_ohlcv, code): code for code in codes}
        for future in as_completed(future_map):
            code = future_map[future]
            try:
                results[code] = future.result()
            except Exception as e:
                print(f'  [yahoo] {code} 例外: {e}')
                results[code] = None
            done += 1
            if done % 50 == 0 or done == total:
                ok = sum(1 for v in results.values() if v is not None)
                print(f'  [yahoo] 進度: {done}/{total} (成功 {ok})')

    ok = sum(1 for v in results.values() if v is not None)
    print(f'[yahoo] 完成：{ok}/{total} 成功')
    return results


# ── 單獨測試 ─────────────────────────────────────────────────
if __name__ == '__main__':
    result = fetch_raw_ohlcv('2330')
    if result:
        print(f"symbol={result['symbol']}, market={result['market']}")
        print(f"K 線筆數={len(result['ohlcv'])}")
        print('最後 3 筆:', result['ohlcv'][-3:])
    else:
        print('抓取失敗')
