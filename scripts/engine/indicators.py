"""
engine/indicators.py
純技術指標計算引擎

規範：
  - 本模組不得有任何 I/O（網路請求、檔案讀寫）
  - 所有函式均為純函式：輸入資料 → 輸出計算結果
  - 輸入格式：yahoo.py 的 ohlcv 陣列
  - 輸出格式：與 v2 stock-pool.json Data Contract 完全一致
"""

from typing import List, Dict, Any


# ── 移動平均 ────────────────────────────────────────────────

def calc_sma(values: List[float], period: int) -> float:
    """Simple Moving Average（前 period 筆的平均）"""
    if not values:
        return 0.0
    tail = values[-period:] if len(values) >= period else values
    return round(sum(tail) / len(tail), 2)


# ── KD(9,3) 隨機指標 ─────────────────────────────────────────

def calc_kd_series(ohlcv: List[Dict]) -> List[Dict]:
    """
    計算完整 KD(9,3) 序列

    Args:
        ohlcv: [{"open", "high", "low", "close", "volume"}, ...]

    Returns:
        [{"k": float, "d": float}, ...]  與 ohlcv 等長
    """
    k, d = 50.0, 50.0
    result = []
    for i, day in enumerate(ohlcv):
        window = ohlcv[max(0, i - 8): i + 1]
        h9 = max(w['high']  for w in window)
        l9 = min(w['low']   for w in window)
        c  = day['close']
        rsv = ((c - l9) / (h9 - l9) * 100.0) if h9 > l9 else 50.0
        k = (2.0 / 3.0) * k + (1.0 / 3.0) * rsv
        d = (2.0 / 3.0) * d + (1.0 / 3.0) * k
        result.append({'k': round(k, 1), 'd': round(d, 1)})
    return result


# ── 主計算函式 ───────────────────────────────────────────────

def calc_stock_indicators(ohlcv: List[Dict]) -> Dict[str, Any]:
    """
    從 ohlcv 日K序列計算所有指標，回傳 v2 stock-pool.json 所需欄位

    Args:
        ohlcv: yahoo.fetch_raw_ohlcv() 回傳的 ohlcv 陣列（由早到晚）

    Returns:
        符合 Data Contract 的個股指標物件（不含 code/name/market/categories）
    """
    if not ohlcv or len(ohlcv) < 2:
        return {}

    closes  = [d['close']  for d in ohlcv]
    highs   = [d['high']   for d in ohlcv]
    lows    = [d['low']    for d in ohlcv]
    opens   = [d['open']   for d in ohlcv]
    volumes = [d['volume'] for d in ohlcv]

    # ── 最新一日行情 ──────────────────────────────────────────
    price      = round(closes[-1], 2)
    prev_close = round(closes[-2], 2)
    open_p     = round(opens[-1],  2)
    high_p     = round(highs[-1],  2)
    low_p      = round(lows[-1],   2)
    volume_z   = round(int(volumes[-1]) / 1000)  # 張（股數 / 1000）

    # ── 均線 ──────────────────────────────────────────────────
    ma5  = calc_sma(closes, 5)
    ma10 = calc_sma(closes, 10)
    ma20 = calc_sma(closes, 20)
    ma60 = calc_sma(closes, 60)

    # ── 量均 ──────────────────────────────────────────────────
    vols_z   = [round(v / 1000) for v in volumes]
    vma5     = round(calc_sma(vols_z, 5))
    vma10    = round(calc_sma(vols_z, 10))

    # ── 近 N 日最高最低 ──────────────────────────────────────
    high5d  = round(max(highs[-5:]),  2) if len(highs)  >= 5  else high_p
    high10d = round(max(highs[-10:]), 2) if len(highs)  >= 10 else high_p
    high20d = round(max(highs[-20:]), 2) if len(highs)  >= 20 else high_p

    # 波段防守低點：若今日是近 5 日最低，排除今日，避免與現價重疊
    prior_lows = lows[:-1] if len(lows) >= 2 and lows[-1] <= min(lows[-5:]) else lows
    low5d  = round(min(prior_lows[-5:]),  2) if len(prior_lows) >= 5  else (round(min(lows[-5:]),  2) if len(lows) >= 5  else low_p)
    low10d = round(min(prior_lows[-10:]), 2) if len(prior_lows) >= 10 else (round(min(lows[-10:]), 2) if len(lows) >= 10 else low_p)
    low20d = round(min(lows[-20:]),       2) if len(lows) >= 20 else low_p

    # ── 爆量訊號（近 10 日任一日成交量 >= 5MA量 * 1.5）──────
    max_vol_10d = 0
    has_volume_burst = False
    start_i = max(0, len(ohlcv) - 10)
    for i in range(start_i, len(ohlcv)):
        v = ohlcv[i]['volume']
        if v > max_vol_10d:
            max_vol_10d = v
        sub_vols = [ohlcv[j]['volume'] for j in range(max(0, i - 4), i + 1)]
        vma5_day = sum(sub_vols) / len(sub_vols)
        if vma5_day > 0 and v >= vma5_day * 1.5:
            has_volume_burst = True

    max_vol_10d_z = round(max_vol_10d / 1000) if max_vol_10d > 0 else volume_z

    # ── Sparkline（近 10 日收盤）────────────────────────────
    sparkline = [round(c, 2) for c in closes[-10:]]

    # ── KD(9,3) ──────────────────────────────────────────────
    kd_series = calc_kd_series(ohlcv)
    curr_kd   = kd_series[-1] if kd_series       else {'k': 50.0, 'd': 50.0}
    prev_kd   = kd_series[-2] if len(kd_series) >= 2 else curr_kd

    # KD 用前 8 日（不含今日）的高低作為天花板/地板參考
    prior_8 = ohlcv[-9:-1] if len(ohlcv) >= 9 else ohlcv[:-1]
    h8 = round(max(d['high'] for d in prior_8), 2) if prior_8 else high_p
    l8 = round(min(d['low']  for d in prior_8), 2) if prior_8 else low_p

    kd = {
        'k':     curr_kd['k'],
        'd':     curr_kd['d'],
        'prevK': prev_kd['k'],
        'prevD': prev_kd['d'],
        'h8':    h8,
        'l8':    l8,
    }

    # ── 近 10 日完整日K（含 MA/KD）──────────────────────────
    history10d = []
    if len(ohlcv) >= 10:
        all_closes = closes
        for idx in range(len(ohlcv) - 10, len(ohlcv)):
            d   = ohlcv[idx]
            kdi = kd_series[idx]
            sub = all_closes[:idx + 1]
            history10d.append({
                'date':      d.get('date', ''),
                'open':      round(d['open'],   2),
                'high':      round(d['high'],   2),
                'low':       round(d['low'],    2),
                'close':     round(d['close'],  2),
                'prevClose': round(all_closes[idx - 1], 2) if idx > 0 else round(d['open'], 2),
                'volume':    round(d['volume'] / 1000),
                'ma5':       calc_sma(sub, 5),
                'ma10':      calc_sma(sub, 10),
                'ma20':      calc_sma(sub, 20),
                'ma60':      calc_sma(sub, 60),
                'k':         kdi['k'],
                'd':         kdi['d'],
            })


    return {
        'price':          price,
        'prevClose':      prev_close,
        'open':           open_p,
        'high':           high_p,
        'low':            low_p,
        'change':         round(price - prev_close, 2),
        'changePct':      round((price - prev_close) / prev_close * 100, 2) if prev_close else 0.0,
        'volume':         volume_z,
        'ma5':            ma5,
        'ma10':           ma10,
        'ma20':           ma20,
        'ma60':           ma60,
        'vMa5':           vma5,
        'vMa10':          vma10,
        'maxVol10d':      max_vol_10d_z,
        'hasVolumeBurst': has_volume_burst,
        'high5d':         high5d,
        'high10d':        high10d,
        'high20d':        high20d,
        'low5d':          low5d,
        'low10d':         low10d,
        'low20d':         low20d,
        'sparkline':      sparkline,
        'kd':             kd,
        'history10d':     history10d,
    }


# ── 單獨測試 ─────────────────────────────────────────────────
if __name__ == '__main__':
    # 使用假資料驗算
    import random
    random.seed(42)
    base = 100.0
    fake_ohlcv = []
    for _ in range(65):
        c = round(base + random.uniform(-3, 3), 2)
        fake_ohlcv.append({
            'open':   round(base + random.uniform(-1, 1), 2),
            'high':   round(c + random.uniform(0, 2), 2),
            'low':    round(c - random.uniform(0, 2), 2),
            'close':  c,
            'volume': random.randint(5_000_000, 30_000_000),
        })
        base = c

    r = calc_stock_indicators(fake_ohlcv)
    print('price:',    r['price'])
    print('ma5/20/60:', r['ma5'], r['ma20'], r['ma60'])
    print('KD:', r['kd']['k'], r['kd']['d'])
    print('sparkline:', r['sparkline'])
    print('history10d:', len(r['history10d']), '筆')
