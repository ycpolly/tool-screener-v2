"""
scrapers/fubon.py
從富邦 DJ 抓取各類排行榜資料

來源：https://fubon-ebrokerdj.fbs.com.tw/
共 28 個 URL（14 種排行 × 上市/上櫃各一）

職責：只負責 HTTP 連線與 HTML 解析，不做任何指標計算
"""

import re
import ssl
import urllib.request
from datetime import datetime
from typing import List, Dict, Tuple

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

_BASE = 'https://fubon-ebrokerdj.fbs.com.tw'

# ── 28 個 URL 清單 ───────────────────────────────────────────
FUBON_ENDPOINTS = {
    # 量大排行
    'top100Volume_tse':    f'{_BASE}/z/zg/zg_BE_0_1.djhtm',
    'top100Volume_otc':    f'{_BASE}/z/zg/zg_BE_1_1.djhtm',
    # 值大排行
    'valueTop_tse':        f'{_BASE}/Z/ZG/ZG_CD.djhtm',
    'valueTop_otc':        f'{_BASE}/z/zg/zg_CD_1.djhtm',
    # 週轉率
    'turnoverRate_tse':    f'{_BASE}/Z/ZG/ZG_BD.djhtm',
    'turnoverRate_otc':    f'{_BASE}/z/zg/zg_BD_1_0.djhtm',
    # 投信買超
    'sitcaBuy3D_tse':      f'{_BASE}/z/zg/zg_DD_0_3.djhtm',
    'sitcaBuy3D_otc':      f'{_BASE}/z/zg/zg_DD_1_3.djhtm',
    'sitcaBuy5D_tse':      f'{_BASE}/z/zg/zg_DD_0_5.djhtm',
    'sitcaBuy5D_otc':      f'{_BASE}/z/zg/zg_DD_1_5.djhtm',
    # 外資買超
    'foreignBuy1D_tse':    f'{_BASE}/z/zg/zg_D_0_1.djhtm',
    'foreignBuy1D_otc':    f'{_BASE}/z/zg/zg_D_1_1.djhtm',
    'foreignBuy3D_tse':    f'{_BASE}/z/zg/zg_D_0_3.djhtm',
    'foreignBuy3D_otc':    f'{_BASE}/z/zg/zg_D_1_3.djhtm',
    # 主力買超
    'majorBuy1D_tse':      f'{_BASE}/z/zg/zg_F_0_1.djhtm',
    'majorBuy1D_otc':      f'{_BASE}/z/zg/zg_F_1_1.djhtm',
    'majorBuy3D_tse':      f'{_BASE}/z/zg/zg_F_0_3.djhtm',
    'majorBuy3D_otc':      f'{_BASE}/z/zg/zg_F_1_3.djhtm',
    # 外資賣超
    'foreignSell1D_tse':   f'{_BASE}/z/zg/zg_DA_0_1.djhtm',
    'foreignSell1D_otc':   f'{_BASE}/z/zg/zg_DA_1_1.djhtm',
    'foreignSell3D_tse':   f'{_BASE}/z/zg/zg_DA_0_3.djhtm',
    'foreignSell3D_otc':   f'{_BASE}/z/zg/zg_DA_1_3.djhtm',
    # 主力賣超
    'majorSell1D_tse':     f'{_BASE}/z/zg/zg_FA_0_1.djhtm',
    'majorSell1D_otc':     f'{_BASE}/z/zg/zg_FA_1_1.djhtm',
    'majorSell3D_tse':     f'{_BASE}/z/zg/zg_FA_0_3.djhtm',
    'majorSell3D_otc':     f'{_BASE}/z/zg/zg_FA_1_3.djhtm',
    # 投信賣超
    'sitcaSell3D_tse':     f'{_BASE}/z/zg/zg_DE_0_3.djhtm',
    'sitcaSell3D_otc':     f'{_BASE}/z/zg/zg_DE_1_3.djhtm',
}


def _decode_html(raw_bytes: bytes) -> str:
    """富邦 DJ 頁面編碼容錯解碼（cp950 / big5）"""
    for enc in ['cp950', 'big5-hkscs', 'big5', 'utf-8']:
        try:
            return raw_bytes.decode(enc)
        except Exception:
            continue
    return raw_bytes.decode('big5', errors='ignore')


def _parse_date(html: str) -> str:
    m = re.search(r'(\d{2}/\d{2})', html)
    if not m:
        m = re.search(r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})', html)
    return m.group(1).replace('-', '/') if m else datetime.now().strftime('%m/%d')


def _parse_stock_name(row_html: str) -> Tuple[str, str]:
    """從 TR 中萃取股票代號與名稱"""
    m = re.search(r"Link2Stk\('([^']+)'\)[^>]*>(.*?)</a>", row_html)
    if not m:
        return '', ''
    code = m.group(1).strip()
    raw  = re.sub(r'<[^>]+>', '', m.group(2)).replace('&nbsp;', '').strip()
    name = re.sub(rf'^{re.escape(code)}\s*', '', raw).strip()
    return code, name or code


def _fetch_raw(url: str) -> Tuple[str, str]:
    """發起 HTTP 請求，回傳 (日期字串, HTML 內容)"""
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_ctx, timeout=10) as resp:
            html = _decode_html(resp.read())
        return _parse_date(html), html
    except Exception as e:
        print(f'  [fubon] 連線失敗 {url}: {e}')
        return datetime.now().strftime('%m/%d'), ''


# ── 三種表格解析器 ─────────────────────────────────────────────

def _parse_volume_rank(html: str, market: str) -> List[Dict]:
    """量大排行：取最後一欄數字為成交量（張）"""
    stocks = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        code, name = _parse_stock_name(row)
        if not code:
            continue
        cells = [
            re.sub(r'<[^>]+>', '', c).replace('&nbsp;', '').strip()
            for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        ]
        if len(cells) >= 6:
            vol_str = cells[5].replace(',', '').strip()
            if vol_str.isdigit():
                stocks.append({
                    'code': code, 'name': name,
                    'volume': int(vol_str), 'market': market
                })
    return stocks


def _parse_buy_sell_rank(html: str, market: str) -> List[Dict]:
    """買超/賣超排行：取最後一個數字欄為買/賣超量（張）"""
    stocks = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        code, name = _parse_stock_name(row)
        if not code:
            continue
        cells = [
            re.sub(r'<[^>]+>', '', c).replace('&nbsp;', '').replace(',', '').strip()
            for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        ]
        net_vol = 0
        for c in reversed(cells):
            if c.lstrip('-').isdigit():
                net_vol = int(c)
                break
        stocks.append({'code': code, 'name': name, 'netVol': net_vol, 'market': market})
    return stocks


def _parse_value_rank(html: str, market: str) -> List[Dict]:
    """值大排行：取第 6 欄為成交值（千元）"""
    stocks = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        cols = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if len(cols) < 6:
            continue
        m = re.search(r"Link2Stk\('([^']+)'\)", cols[1])
        if not m:
            continue
        code = m.group(1).strip()
        raw  = re.sub(r'<[^>]+>', '', cols[1]).replace('&nbsp;', '').strip()
        name = re.sub(rf'^{re.escape(code)}\s*', '', raw).strip() or code
        val_str = re.sub(r'<[^>]+>', '', cols[5]).replace('&nbsp;', '').replace(',', '').strip()
        try:
            val = int(val_str)
        except Exception:
            val = 0
        stocks.append({'code': code, 'name': name, 'amount': val, 'market': market})
    return stocks


def _parse_turnover_rank(html: str, market: str) -> List[Dict]:
    """週轉率排行：取第 7 欄為週轉率（%）"""
    stocks = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        cols = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if len(cols) < 7:
            continue
        m = re.search(r"Link2Stk\('([^']+)'\)", cols[1])
        if not m:
            continue
        code = m.group(1).strip()
        raw  = re.sub(r'<[^>]+>', '', cols[1]).replace('&nbsp;', '').strip()
        name = re.sub(rf'^{re.escape(code)}\s*', '', raw).strip() or code
        tr_str = re.sub(r'<[^>]+>', '', cols[6]).replace('&nbsp;', '').replace('%', '').strip()
        try:
            tr = float(tr_str)
        except Exception:
            tr = 0.0
        stocks.append({'code': code, 'name': name, 'turnoverRate': tr, 'market': market})
    return stocks


# ── 公開 API ─────────────────────────────────────────────────

def fetch_all_rankings() -> Dict:
    """
    抓取全部 28 個富邦 DJ 排行榜，回傳合併後的結構

    Returns:
        {
          "top100Volume":  {"date": "08/26", "stocks": [...], "sourceUrl": "..."},
          "valueTop":      {...},
          "turnoverRate":  {...},
          "sitcaBuy3D":    {...},
          "sitcaBuy5D":    {...},
          "foreignBuy1D":  {...},
          "foreignBuy3D":  {...},
          "majorBuy1D":    {...},
          "majorBuy3D":    {...},
          "foreignSell":   {...},
          "majorSell":     {...},
          "sitcaSell":     {...},
        }
    """
    result = {}

    def _fetch_pair(key_tse, key_otc, parser, result_key):
        """抓上市 + 上櫃並合併"""
        url_tse = FUBON_ENDPOINTS[key_tse]
        url_otc = FUBON_ENDPOINTS[key_otc]
        print(f'  [fubon] {result_key}...')
        date_t, html_t = _fetch_raw(url_tse)
        date_o, html_o = _fetch_raw(url_otc)
        stocks_t = parser(html_t, 'tse') if html_t else []
        stocks_o = parser(html_o, 'otc') if html_o else []
        result[result_key] = {
            'date':      date_t or date_o,
            'sourceUrl': url_tse,
            'stocks':    stocks_t + stocks_o,
        }
        print(f'    tse={len(stocks_t)}, otc={len(stocks_o)}')

    print('[fubon] 開始抓取 28 個排行榜...')

    _fetch_pair('top100Volume_tse',  'top100Volume_otc',  _parse_volume_rank,   'top100Volume')
    _fetch_pair('valueTop_tse',      'valueTop_otc',      _parse_value_rank,    'valueTop')
    _fetch_pair('turnoverRate_tse',  'turnoverRate_otc',  _parse_turnover_rank, 'turnoverRate')
    _fetch_pair('sitcaBuy3D_tse',    'sitcaBuy3D_otc',    _parse_buy_sell_rank, 'sitcaBuy3D')
    _fetch_pair('sitcaBuy5D_tse',    'sitcaBuy5D_otc',    _parse_buy_sell_rank, 'sitcaBuy5D')
    _fetch_pair('foreignBuy1D_tse',  'foreignBuy1D_otc',  _parse_buy_sell_rank, 'foreignBuy1D')
    _fetch_pair('foreignBuy3D_tse',  'foreignBuy3D_otc',  _parse_buy_sell_rank, 'foreignBuy3D')
    _fetch_pair('majorBuy1D_tse',    'majorBuy1D_otc',    _parse_buy_sell_rank, 'majorBuy1D')
    _fetch_pair('majorBuy3D_tse',    'majorBuy3D_otc',    _parse_buy_sell_rank, 'majorBuy3D')
    _fetch_pair('foreignSell1D_tse', 'foreignSell1D_otc', _parse_buy_sell_rank, 'foreignSell1D')
    _fetch_pair('foreignSell3D_tse', 'foreignSell3D_otc', _parse_buy_sell_rank, 'foreignSell3D')
    _fetch_pair('majorSell1D_tse',   'majorSell1D_otc',   _parse_buy_sell_rank, 'majorSell1D')
    _fetch_pair('majorSell3D_tse',   'majorSell3D_otc',   _parse_buy_sell_rank, 'majorSell3D')
    _fetch_pair('sitcaSell3D_tse',   'sitcaSell3D_otc',   _parse_buy_sell_rank, 'sitcaSell3D')

    print(f'[fubon] 全部抓取完成，共 {len(result)} 組排行榜')
    return result


# ── 單獨測試 ─────────────────────────────────────────────────
if __name__ == '__main__':
    data = fetch_all_rankings()
    for k, v in data.items():
        print(f"{k}: {len(v['stocks'])} 筆，日期={v['date']}")
