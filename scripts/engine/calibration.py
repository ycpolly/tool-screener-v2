"""
engine/calibration.py
TWSE MIS 盤後校正收盤價

重寫說明（v1 已知問題修正）：
  1. market 判斷改用 'tse'/'otc' 英文 key，不再依賴中文字串 '上市'/'上櫃'
  2. 明確區分 z（成交價）vs y（昨收）：
       z = '-' → 今日未成交（停牌/跌停無成交），不可使用 pz 替代作為收盤
       y = 昨收，用來更新 prevClose，與 z 無關
  3. 每筆校正都 log 出來，便於驗證
  4. 校正成功才更新，否則保留 Yahoo 原始值

API 說明：
  TWSE MIS: https://mis.twse.com.tw/stock/api/getStockInfo.jsp
  ex_ch 格式: tse_2330.tw|otc_6547.tw|...
  每批最多 50 檔

MIS 欄位說明（避免混淆）：
  z  = 最新成交價（盤中/收盤）, '-' 表示今日無成交
  y  = 昨收價
  pz = 最後一筆成交價（不一定是收盤價，盤中也會更新）※不可靠
  a  = 最佳賣價（委賣）
  b  = 最佳買價（委買）
"""

import json
import ssl
import urllib.request
from typing import List, Dict

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

_HEADERS = {
    'User-Agent':  'Mozilla/5.0',
    'Referer':     'https://mis.twse.com.tw/stock/fibest.jsp',
}

_MIS_URL  = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp'
_CHUNK    = 50


def _build_ex_ch(stock: Dict) -> str:
    """
    將個股物件轉換成 MIS API 所需的 ex_ch 格式

    市場判斷依據 v2 Data Contract：
        market == 'tse' → tse_2330.tw
        market == 'otc' → otc_6547.tw
    """
    market = stock.get('market', 'tse')
    # 防禦：如果舊資料還有中文，在這裡統一轉換
    if market in ('上市', '上市'):
        market = 'tse'
    elif market in ('上櫃',):
        market = 'otc'
    code = stock.get('code', '')
    return f'{market}_{code}.tw'


def calibrate_closing_prices(stocks: List[Dict]) -> int:
    """
    用 TWSE MIS API 校正股票收盤價與昨收

    Args:
        stocks: 個股列表（in-place 修改 price 與 prevClose）

    Returns:
        成功校正的筆數
    """
    print('[calibration] 開始 TWSE MIS 收盤價校正...')
    db_map         = {s['code']: s for s in stocks}
    calibrated     = 0
    total_batches  = (len(stocks) + _CHUNK - 1) // _CHUNK

    for batch_i, i in enumerate(range(0, len(stocks), _CHUNK)):
        chunk  = stocks[i: i + _CHUNK]
        ex_chs = [_build_ex_ch(s) for s in chunk]
        url    = f"{_MIS_URL}?ex_ch={'|'.join(ex_chs)}"

        req = urllib.request.Request(url, headers=_HEADERS)
        try:
            with urllib.request.urlopen(req, context=_ctx, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f'  [calibration] batch {batch_i + 1}/{total_batches} 失敗: {e}')
            continue

        for item in data.get('msgArray', []):
            code = item.get('c')
            if not code or code not in db_map:
                continue

            stock = db_map[code]

            # ── 收盤價校正 ───────────────────────────────────
            z_raw = item.get('z', '-')

            if z_raw and z_raw != '-':
                # z 有值 → 今日有成交，這就是正確收盤價
                try:
                    z_price = round(float(z_raw), 2)
                    if z_price > 0:
                        old_price = stock.get('price')
                        if old_price != z_price:
                            print(
                                f'  [calibration] {code} ({stock.get("name", "")}): '
                                f'Yahoo={old_price} → MIS={z_price}'
                            )
                            stock['price'] = z_price
                            # 同步更新 sparkline 最後一筆
                            if stock.get('sparkline') and len(stock['sparkline']) > 0:
                                stock['sparkline'][-1] = z_price
                            # 同步更新 history10d 最後一筆收盤
                            if stock.get('history10d') and len(stock['history10d']) > 0:
                                stock['history10d'][-1]['close'] = z_price
                            calibrated += 1
                except (ValueError, TypeError):
                    pass
            else:
                # z == '-' → 今日未成交（停牌/無成交），保留 Yahoo 原始值
                # 注意：此時絕對不使用 pz 替代，pz 不等於收盤
                pass

            # ── 昨收校正（y 欄位，與 z 無關，獨立校正）────────
            y_raw = item.get('y', '')
            if y_raw and y_raw != '-':
                try:
                    y_price = round(float(y_raw), 2)
                    if y_price > 0:
                        stock['prevClose'] = y_price
                        # 同步更新 change 與 changePct
                        p = stock.get('price', y_price)
                        stock['change']    = round(p - y_price, 2)
                        stock['changePct'] = round((p - y_price) / y_price * 100, 2) if y_price else 0.0
                except (ValueError, TypeError):
                    pass

    print(f'[calibration] 完成，校正 {calibrated} 檔 / 共 {len(stocks)} 檔')
    return calibrated


# ── 單獨測試 ─────────────────────────────────────────────────
if __name__ == '__main__':
    # 用台積電測試
    test_stocks = [
        {'code': '2330', 'name': '台積電', 'market': 'tse',
         'price': 999.0, 'prevClose': 995.0, 'sparkline': [990, 992, 995, 998, 999],
         'history10d': [{'close': 999}]},
        {'code': '6547', 'name': '高端疫苗', 'market': 'otc',
         'price': 50.0, 'prevClose': 48.0, 'sparkline': [48, 49, 50],
         'history10d': [{'close': 50}]},
    ]
    n = calibrate_closing_prices(test_stocks)
    print(f'校正筆數: {n}')
    for s in test_stocks:
        print(f"  {s['code']}: price={s['price']}, prevClose={s['prevClose']}, changePct={s.get('changePct')}")
