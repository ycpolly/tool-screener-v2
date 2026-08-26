"""
engine/market_regime.py
大盤指數資料抓取與多空風控燈號判定

資料來源：
  - 加權指數：Yahoo Finance ^TWII（3個月歷史）+ TWSE MIS 即時校正
  - 櫃買指數：TPEx 官方 OpenAPI + TWSE MIS 即時校正
  - 無需任何 API Key

職責：抓取大盤原始 K 線，計算指標，判定 SAFE/CAUTION/DANGER
"""

import json
import ssl
import time
import urllib.request
from typing import Optional, Dict, List

from scripts.engine.indicators import calc_sma, calc_kd_series

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


def _kd_status_label(k: float, d: float, prev_k: float, prev_d: float) -> str:
    if prev_k < prev_d and k >= d:
        return '黃金交叉'
    if prev_k > prev_d and k <= d:
        return '死亡交叉'
    if k >= 80:
        return '超買過熱'
    if k < 50:
        return '低檔整理'
    return '中檔震盪'


def _status_desc(price: float, ma5: float, ma20: float, chg_pct: float) -> str:
    sign = '+' if chg_pct >= 0 else ''
    chg_str = f'{sign}{chg_pct:.2f}%'
    if price < ma20:
        return f'月線下方弱勢反彈 ({chg_str})' if chg_pct >= 0 else f'破月線空頭下殺 ({chg_str})'
    if price < ma5:
        return f'回測月線震盪 (破5MA) ({chg_str})'
    if price >= ma5 and price >= ma20 and ma5 >= ma20:
        return f'多頭強勢攻擊 ({chg_str})'
    return f'多頭震盪整理 ({chg_str})'


def _calc_index_indicators(bars: List[Dict]) -> Optional[Dict]:
    """從 OHLC bars 計算大盤指標"""
    closes = [b['c'] for b in bars]
    if len(closes) < 5:
        return None

    price      = closes[-1]
    prev_close = closes[-2] if len(closes) >= 2 else price
    chg_price  = round(price - prev_close, 2)
    chg_pct    = round((chg_price / prev_close) * 100, 2) if prev_close else 0.0
    ma5        = calc_sma(closes, 5)
    ma10       = calc_sma(closes, 10)
    ma20       = calc_sma(closes, 20)
    bias20     = round((price - ma20) / ma20 * 100, 2) if ma20 else 0.0

    # KD(9,3) — 大盤只有 close，用 close 作 h/l
    kd_input = [{'high': b.get('h', b['c']), 'low': b.get('l', b['c']), 'close': b['c']} for b in bars]
    kd_series = calc_kd_series(kd_input)
    curr_kd   = kd_series[-1] if kd_series       else {'k': 50.0, 'd': 50.0}
    prev_kd   = kd_series[-2] if len(kd_series) >= 2 else curr_kd

    kd_status = _kd_status_label(curr_kd['k'], curr_kd['d'], prev_kd['k'], prev_kd['d'])

    return {
        'price':       round(price, 2),
        'prevClose':   round(prev_close, 2),
        'changePrice': chg_price,
        'changePct':   chg_pct,
        'ma5':         ma5,
        'ma10':        ma10,
        'ma20':        ma20,
        'bias20':      bias20,
        'statusDesc':  _status_desc(price, ma5, ma20, chg_pct),
        'kd': {
            'k':      curr_kd['k'],
            'd':      curr_kd['d'],
            'prevK':  prev_kd['k'],
            'prevD':  prev_kd['d'],
            'status': kd_status,
        },
        '_closes': closes,  # 供 MIS 校正用，不輸出到最終 JSON
        '_bars':   bars,
    }


def _fetch_taiex_bars() -> List[Dict]:
    """Yahoo Finance ^TWII 4個月歷史 K 線"""
    p2 = int(time.time())
    p1 = p2 - 120 * 86400
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/^TWII?period1={p1}&period2={p2}&interval=1d'
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        res   = data['chart']['result'][0]
        quote = res['indicators']['quote'][0]
        raw_c = quote['close']
        raw_h = quote.get('high', raw_c)
        raw_l = quote.get('low',  raw_c)
        bars = []
        for i in range(len(raw_c)):
            if raw_c[i] is not None:
                c = round(raw_c[i], 2)
                bars.append({
                    'c': c,
                    'h': round(raw_h[i], 2) if raw_h[i] is not None else c,
                    'l': round(raw_l[i], 2) if raw_l[i] is not None else c,
                })
        return bars
    except Exception as e:
        print(f'  [market_regime] TAIEX Yahoo 失敗: {e}')
        return []


def _fetch_otc_bars() -> List[Dict]:
    """TPEx 官方 OpenAPI 櫃買指數歷史"""
    url = 'https://www.tpex.org.tw/openapi/v1/tpex_daily_trading_index'
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        bars = []
        for r in data:
            raw = r.get('TPExIndex') or r.get('price') or r.get('Close')
            if raw:
                try:
                    c = round(float(str(raw).replace(',', '')), 2)
                    bars.append({'c': c, 'h': c, 'l': c})
                except (ValueError, TypeError):
                    continue
        return bars
    except Exception as e:
        print(f'  [market_regime] OTC TPEx 失敗: {e}')
        return []


def _mis_calibrate_indices(taiex: Dict, otc: Dict) -> None:
    """用 TWSE MIS 即時校正大盤最新點數（in-place）"""
    url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_o00.tw|tse_t00.tw'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Referer':    'https://mis.twse.com.tw/stock/fibest.jsp',
    })
    try:
        with urllib.request.urlopen(req, context=_ctx, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        for item in data.get('msgArray', []):
            ch    = item.get('ch', '')
            z_raw = item.get('z', '-')
            y_raw = item.get('y', '')
            if not z_raw or z_raw == '-':
                continue
            try:
                z = round(float(z_raw), 2)
                y = round(float(y_raw), 2) if y_raw and y_raw != '-' else None
            except (ValueError, TypeError):
                continue

            target = otc if 'o00' in ch else taiex
            target['price']       = z
            target['changePrice'] = round(z - (y or z), 2)
            target['changePct']   = round((z - y) / y * 100, 2) if y else 0.0
            if y:
                target['prevClose'] = y
            if target.get('ma20'):
                target['bias20'] = round((z - target['ma20']) / target['ma20'] * 100, 2)

            # 更新狀態描述
            target['statusDesc'] = _status_desc(
                z, target.get('ma5', z), target.get('ma20', z), target['changePct']
            )
            # 更新 KD 狀態文字（數值不變）
            kd = target.get('kd', {})
            kd['status'] = _kd_status_label(
                kd.get('k', 50), kd.get('d', 50), kd.get('prevK', 50), kd.get('prevD', 50)
            )

    except Exception as e:
        print(f'  [market_regime] MIS 校正失敗: {e}')


def _evaluate_regime(taiex: Dict, otc: Dict) -> Dict:
    """判定整體大盤多空燈號"""

    def is_danger(idx: Dict) -> bool:
        price = idx.get('price', 0)
        ma20  = idx.get('ma20', price)
        below_ma20 = price < ma20
        kd    = idx.get('kd', {})
        k, pk = kd.get('k', 50), kd.get('prevK', 50)
        d, pd = kd.get('d', 50), kd.get('prevD', 50)
        kd_falling = (k <= d) and (k < pk)
        crash      = idx.get('changePct', 0) < -1.2 and kd_falling
        return below_ma20 or crash

    def is_caution(idx: Dict) -> bool:
        price = idx.get('price', 0)
        ma5   = idx.get('ma5',  price)
        ma10  = idx.get('ma10', price)
        ma20  = idx.get('ma20', price)
        above_ma20    = price >= ma20
        broke_short   = (price < ma5) or (price < ma10)
        mild_pullback = -1.2 <= idx.get('changePct', 0) <= -0.8
        return (broke_short and above_ma20) or mild_pullback

    if is_danger(taiex) or is_danger(otc):
        return {
            'code':     'DANGER',
            'badge':    '系統性風險',
            'title':    '系統總風控判定：市場處於系統性風險（建議空手觀望）',
            'subtitle': '大盤或櫃買遭遇系統性賣壓，破月線風險高。建議維持空手，勿盲目抄底。',
        }
    if is_caution(taiex) or is_caution(otc):
        return {
            'code':     'CAUTION',
            'badge':    '震盪回檔',
            'title':    '系統總風控判定：市場震盪回檔（建議減量防守）',
            'subtitle': '指數跌破 5MA 但守在月線之上，建議減量至 3-5 成，暫停追高。',
        }
    return {
        'code':     'SAFE',
        'badge':    '多頭順風',
        'title':    '系統總風控判定：市場多頭順風（可執行波段操作）',
        'subtitle': '加權與櫃買結構健康，多頭均線排列，適合執行低接與爆量操作。',
    }


def fetch_market_data() -> Optional[Dict]:
    """
    抓取大盤資料並回傳完整 market 物件

    Returns:
        {
          "taiex":  IndexData,
          "otc":    IndexData,
          "regime": RegimeData,
        }
        若抓取失敗，回傳 None
    """
    print('[market_regime] 抓取大盤資料...')

    taiex_bars = _fetch_taiex_bars()
    otc_bars   = _fetch_otc_bars()

    taiex = _calc_index_indicators(taiex_bars)
    otc   = _calc_index_indicators(otc_bars)

    if not taiex or not otc:
        print('  [market_regime] 大盤資料不足，跳過')
        return None

    taiex['name'] = '加權指數'
    otc['name']   = '櫃買指數'

    # 用 MIS 即時校正最後一筆
    _mis_calibrate_indices(taiex, otc)

    # 移除內部暫存欄位
    taiex.pop('_closes', None)
    taiex.pop('_bars',   None)
    otc.pop('_closes',   None)
    otc.pop('_bars',     None)

    regime = _evaluate_regime(taiex, otc)

    print(f'  [market_regime] TAIEX={taiex["price"]} ({taiex["changePct"]:+.2f}%) | '
          f'OTC={otc["price"]} ({otc["changePct"]:+.2f}%) | {regime["code"]}')

    return {'taiex': taiex, 'otc': otc, 'regime': regime}


# ── 單獨測試 ─────────────────────────────────────────────────
if __name__ == '__main__':
    result = fetch_market_data()
    if result:
        import json as _json
        print(_json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print('抓取失敗')
