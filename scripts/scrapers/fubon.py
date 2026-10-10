"""
scrapers/fubon.py
從富邦 DJ 抓取各類排行榜資料

來源：https://fubon-ebrokerdj.fbs.com.tw/
共 38 個 URL（19 種排行 × 上市/上櫃各一）

職責：只負責 HTTP 連線與 HTML 解析，不做任何指標計算
"""

import json
import os
import re
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Union

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

# ── 38 個 URL 清單 ───────────────────────────────────────────
FUBON_ENDPOINTS = {
    # 量大排行
    'top100Volume_tse':    f'{_BASE}/z/zg/zg_BE_0_1.djhtm',
    'top100Volume_otc':    f'{_BASE}/z/zg/zg_BE_1_1.djhtm',
    # 值大排行
    'valueTop_tse':        f'{_BASE}/Z/ZG/ZG_CD.djhtm',
    'valueTop_otc':        f'{_BASE}/z/zg/zg_CD_1.djhtm',
    # 值增幅排行
    'valueGrowth_tse':     f'{_BASE}/z/zg/zg_CB_0_0.djhtm',
    'valueGrowth_otc':     f'{_BASE}/z/zg/zg_CB_1_0.djhtm',
    # 量增幅排行
    'volGrowthPct_tse':    f'{_BASE}/z/zg/zg_BB_0_0.djhtm',
    'volGrowthPct_otc':    f'{_BASE}/z/zg/zg_BB_1_0.djhtm',
    # 量增排行
    'volGrowth_tse':       f'{_BASE}/z/zg/zg_B_0_0.djhtm',
    'volGrowth_otc':       f'{_BASE}/z/zg/zg_B_1_0.djhtm',
    # 漲幅排行
    'priceGain_tse':       f'{_BASE}/z/zg/zg_A_0_1.djhtm',
    'priceGain_otc':       f'{_BASE}/z/zg/zg_A_1_1.djhtm',
    # 自營商買超 1D
    'dealerBuy1D_tse':     f'{_BASE}/z/zg/zg_DB_0_1.djhtm',
    'dealerBuy1D_otc':     f'{_BASE}/z/zg/zg_DB_1_1.djhtm',
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


def _parse_value_growth_rank(html: str, market: str) -> List[Dict]:
    """值增幅排行：取第 6 欄為成交值（千元），第 8 欄為增減幅（%）"""
    stocks = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        cols = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if len(cols) < 8:
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
        growth_str = re.sub(r'<[^>]+>', '', cols[7]).replace('&nbsp;', '').replace(',', '').replace('%', '').strip()
        try:
            growth = float(growth_str)
        except Exception:
            growth = 0.0
        stocks.append({'code': code, 'name': name, 'growthRate': growth, 'amount': val, 'market': market})
    return stocks


def _parse_vol_growth_pct_rank(html: str, market: str) -> List[Dict]:
    """量增幅排行：取第 6 欄為成交量（張），第 8 欄為增減幅（%）"""
    stocks = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        code, name = _parse_stock_name(row)
        if not code:
            continue
        cells = [
            re.sub(r'<[^>]+>', '', c).replace('&nbsp;', '').replace(',', '').strip()
            for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        ]
        if len(cells) < 8:
            continue
        try:
            vol = int(cells[5])
        except Exception:
            vol = 0
        growth_str = cells[7].replace('%', '').strip()
        try:
            growth = float(growth_str)
        except Exception:
            growth = 0.0
        stocks.append({'code': code, 'name': name, 'growthRate': growth, 'volume': vol, 'market': market})
    return stocks


def _parse_vol_growth_rank(html: str, market: str) -> List[Dict]:
    """量增排行：取第 6 欄為成交量（張），第 8 欄為量增額/張數（張）"""
    stocks = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        code, name = _parse_stock_name(row)
        if not code:
            continue
        cells = [
            re.sub(r'<[^>]+>', '', c).replace('&nbsp;', '').replace(',', '').strip()
            for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        ]
        if len(cells) < 8:
            continue
        try:
            vol = int(cells[5])
        except Exception:
            vol = 0
        try:
            g_vol = int(cells[7])
        except Exception:
            g_vol = 0
        stocks.append({'code': code, 'name': name, 'growthVol': g_vol, 'volume': vol, 'market': market})
    return stocks


def _parse_price_gain_rank(html: str, market: str) -> List[Dict]:
    """漲幅排行：取第 5 欄為漲跌幅（%），第 6 欄為成交量（張）"""
    stocks = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL):
        code, name = _parse_stock_name(row)
        if not code:
            continue
        cells = [
            re.sub(r'<[^>]+>', '', c).replace('&nbsp;', '').replace(',', '').strip()
            for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        ]
        if len(cells) < 6:
            continue
        gain_str = cells[4].replace('%', '').replace('+', '').strip()
        try:
            gain = float(gain_str)
        except Exception:
            gain = 0.0
        try:
            vol = int(cells[5])
        except Exception:
            vol = 0
        stocks.append({'code': code, 'name': name, 'gainPct': gain, 'volume': vol, 'market': market})
    return stocks


# ── 公開 API ─────────────────────────────────────────────────

def fetch_all_rankings() -> Dict:
    """
    抓取全部 38 個富邦 DJ 排行榜，回傳合併後的結構

    Returns:
        {
          "top100Volume":  {"date": "08/26", "stocks": [...], "sourceUrl": "..."},
          "valueTop":      {...},
          "valueGrowth":   {...},
          "volGrowthPct":  {...},
          "volGrowth":     {...},
          "priceGain":     {...},
          "turnoverRate":  {...},
          "sitcaBuy3D":    {...},
          "sitcaBuy5D":    {...},
          "foreignBuy1D":  {...},
          "foreignBuy3D":  {...},
          "dealerBuy1D":   {...},
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

    print('[fubon] 開始抓取 38 個排行榜...')

    _fetch_pair('top100Volume_tse',  'top100Volume_otc',  _parse_volume_rank,         'top100Volume')
    _fetch_pair('valueTop_tse',      'valueTop_otc',      _parse_value_rank,          'valueTop')
    _fetch_pair('valueGrowth_tse',   'valueGrowth_otc',   _parse_value_growth_rank,   'valueGrowth')
    _fetch_pair('volGrowthPct_tse',  'volGrowthPct_otc',  _parse_vol_growth_pct_rank, 'volGrowthPct')
    _fetch_pair('volGrowth_tse',     'volGrowth_otc',     _parse_vol_growth_rank,     'volGrowth')
    _fetch_pair('priceGain_tse',     'priceGain_otc',     _parse_price_gain_rank,     'priceGain')
    _fetch_pair('turnoverRate_tse',  'turnoverRate_otc',  _parse_turnover_rank,       'turnoverRate')
    _fetch_pair('sitcaBuy3D_tse',    'sitcaBuy3D_otc',    _parse_buy_sell_rank,       'sitcaBuy3D')
    _fetch_pair('sitcaBuy5D_tse',    'sitcaBuy5D_otc',    _parse_buy_sell_rank,       'sitcaBuy5D')
    _fetch_pair('foreignBuy1D_tse',  'foreignBuy1D_otc',  _parse_buy_sell_rank,       'foreignBuy1D')
    _fetch_pair('foreignBuy3D_tse',  'foreignBuy3D_otc',  _parse_buy_sell_rank,       'foreignBuy3D')
    _fetch_pair('dealerBuy1D_tse',   'dealerBuy1D_otc',   _parse_buy_sell_rank,       'dealerBuy1D')
    _fetch_pair('majorBuy1D_tse',    'majorBuy1D_otc',    _parse_buy_sell_rank,       'majorBuy1D')
    _fetch_pair('majorBuy3D_tse',    'majorBuy3D_otc',    _parse_buy_sell_rank,       'majorBuy3D')
    _fetch_pair('foreignSell1D_tse', 'foreignSell1D_otc', _parse_buy_sell_rank,       'foreignSell1D')
    _fetch_pair('foreignSell3D_tse', 'foreignSell3D_otc', _parse_buy_sell_rank,       'foreignSell3D')
    _fetch_pair('majorSell1D_tse',   'majorSell1D_otc',   _parse_buy_sell_rank,       'majorSell1D')
    _fetch_pair('majorSell3D_tse',   'majorSell3D_otc',   _parse_buy_sell_rank,       'majorSell3D')
    _fetch_pair('sitcaSell3D_tse',   'sitcaSell3D_otc',   _parse_buy_sell_rank,       'sitcaSell3D')

    print(f'[fubon] 全部抓取完成，共 {len(result)} 組排行榜')
    return result


def check_rankings_date_guard(rankings: Dict, verbose: bool = True) -> Tuple[bool, str, str]:
    """
    富邦排行榜日期守門員 (Date Guard)
    檢查核心排行（成交量前100、成交值前100）是否已更新至台灣時間今日。

    Returns:
        (is_fresh: bool, fubon_date_str: str, today_date_str: str)
    """
    from datetime import datetime, timezone, timedelta
    taiwan_tz = timezone(timedelta(hours=8))
    now_tw = datetime.now(taiwan_tz)
    today_md = f'{now_tw.month:02d}/{now_tw.day:02d}'

    sample_dates = []
    for k in ['top100Volume', 'valueTop', 'priceGain']:
        d = rankings.get(k, {}).get('date', '')
        if d:
            parts = d.replace('-', '/').split('/')
            if len(parts) >= 2:
                try:
                    sample_dates.append(f'{int(parts[-2]):02d}/{int(parts[-1]):02d}')
                except ValueError:
                    pass

    fubon_md = sample_dates[0] if sample_dates else ''
    is_today = (fubon_md == today_md)

    if verbose:
        if is_today:
            print(f'  [fubon Date Guard] ✅ 富邦量價排行日期 ({fubon_md}) 與今日 ({today_md}) 一致，數據已為最新收盤狀態！')
        else:
            print(f'  [fubon Date Guard] ⚠️ 富邦量價排行日期 ({fubon_md}) 尚未跳至今日 ({today_md})，可能仍在結算中或為前一交易日快取。')

    return is_today, fubon_md, today_md


# ── 基本面與同業估值（Phase 2 方案 3 & 方案 6）────────────────
CAPITAL_TTL_DAYS = 28        # 實收資本額更新週期：28 天（約 4 週，依使用者規範）
INDUSTRY_PE_TTL_DAYS = 7     # 同業平均本益比更新週期：7 天（每週更新）


def fetch_stock_fundamentals(code: str) -> Optional[Dict]:
    """
    抓取單檔個股基本資料（實收資本額、本益比、同業平均本益比、頁面收盤價）
    來源：https://fubon-ebrokerdj.fbs.com.tw/z/zc/zca/zca_{code}.djhtm
    """
    url = f'{_BASE}/z/zc/zca/zca_{code}.djhtm'
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_ctx, timeout=10) as resp:
            raw_bytes = resp.read()
            html = _decode_html(raw_bytes)
    except Exception:
        return None

    # 1. 股本 (億元，單位直接在標題中註明：股本(億, 台幣))
    m_cap = re.search(r'>股本[^\d<]*</td>\s*<td[^>]*>([^<]+)</td>', html)
    # 2. 本益比
    m_pe = re.search(r'>本益比</td>\s*<td[^>]*>([^<]+)</td>', html)
    # 3. 同業平均本益比
    m_ind = re.search(r'>同業平均本益比</td>\s*<td[^>]*>([^<]+)</td>', html)
    # 4. 頁面標註之收盤價
    m_price = re.search(r'>收盤價</td>\s*<td[^>]*>([^<]+)</td>', html)

    def _to_float(m):
        if not m:
            return None
        v = m.group(1).replace(',', '').strip()
        try:
            val = float(v)
            return round(val, 2) if val > 0 else None
        except (ValueError, TypeError):
            return None

    cap = _to_float(m_cap)
    pe = _to_float(m_pe)
    ind = _to_float(m_ind)
    price = _to_float(m_price)

    # 近 4 季 EPS 合計 (Trailing EPS) = 價格 / 本益比
    trailing_eps = round(price / pe, 4) if (price and pe and pe > 0) else None

    return {
        'code': code,
        'paidInCapital': cap,
        'pe': pe,
        'industryPe': ind,
        'price': price,
        'trailingEps': trailing_eps,
    }


def batch_fetch_fundamentals(
    codes: List[str],
    cache_path: Union[str, Path] = 'cache/fundamentals.json',
    force: bool = False,
    max_workers: int = 10,
    verbose: bool = True
) -> Dict[str, Dict]:
    """
    批次抓取個股基本資料（股本與同業 PE），內建 28 天 / 7 天 TTL 本地快取。

    快取規則：
      - 股本 (paidInCapital)：TTL = 28 天（約 4 週更新一次）
      - 同業本益比 (industryPe)：TTL = 7 天（每週更新一次）
      - 若快取在期限內，直接命中快取，不發送網路請求
      - 若過期或為新入池標的，僅針對需要更新的個股發起多執行緒抓取
    """
    cache_file = Path(cache_path)
    cache: Dict[str, Dict] = {}
    if cache_file.exists():
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache = json.load(f)
        except Exception as e:
            if verbose:
                print(f'[fubon] 讀取快取失敗，重新初始化: {e}')
            cache = {}

    now_date = datetime.now().date()
    today_str = now_date.strftime('%Y-%m-%d')

    # 判定哪些代碼需要向富邦抓取
    to_fetch: List[str] = []
    for code in codes:
        if force:
            to_fetch.append(code)
            continue

        entry = cache.get(code)
        if not entry:
            to_fetch.append(code)
            continue

        cap_updated = entry.get('capitalUpdatedAt')
        ind_updated = entry.get('industryPeUpdatedAt')
        last_updated = entry.get('updatedAt')

        # 若曾抓過但皆為 None（例如 ETF 或查無資料），在 7 天內不再重抓避免浪費頻寬
        if entry.get('paidInCapital') is None and entry.get('industryPe') is None:
            if last_updated:
                try:
                    d = datetime.strptime(last_updated, '%Y-%m-%d').date()
                    if (now_date - d).days < 7:
                        continue
                except ValueError:
                    pass
            to_fetch.append(code)
            continue

        # 股本過期檢查 (28 天)
        cap_expired = True
        if cap_updated:
            try:
                d = datetime.strptime(cap_updated, '%Y-%m-%d').date()
                cap_expired = (now_date - d).days >= CAPITAL_TTL_DAYS
            except ValueError:
                cap_expired = True

        # 同業 PE 過期檢查 (7 天)
        ind_expired = True
        if ind_updated:
            try:
                d = datetime.strptime(ind_updated, '%Y-%m-%d').date()
                ind_expired = (now_date - d).days >= INDUSTRY_PE_TTL_DAYS
            except ValueError:
                ind_expired = True

        if cap_expired or ind_expired or entry.get('paidInCapital') is None:
            to_fetch.append(code)

    if verbose:
        print(f'[fubon] 基本面快取命中：{len(codes) - len(to_fetch)}/{len(codes)} 檔，需向富邦抓取：{len(to_fetch)} 檔 (股本 TTL={CAPITAL_TTL_DAYS}D, 同業PE TTL={INDUSTRY_PE_TTL_DAYS}D)')

    if to_fetch:
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            fetched_results = list(executor.map(fetch_stock_fundamentals, to_fetch))

        updated_count = 0
        for code, res in zip(to_fetch, fetched_results):
            if res:
                entry = cache.get(code, {})
                # 若抓到有效股本，更新股本與 capitalUpdatedAt
                if res['paidInCapital'] is not None:
                    entry['paidInCapital'] = res['paidInCapital']
                    entry['capitalUpdatedAt'] = today_str
                # 若抓到同業 PE，更新同業 PE 與 industryPeUpdatedAt
                if res['industryPe'] is not None:
                    entry['industryPe'] = res['industryPe']
                    entry['industryPeUpdatedAt'] = today_str
                # 更新本益比與 trailingEps
                entry['pe'] = res['pe']
                entry['fubonPrice'] = res['price']
                if res['trailingEps'] is not None:
                    entry['trailingEps'] = res['trailingEps']
                entry['updatedAt'] = today_str
                cache[code] = entry
                updated_count += 1
            else:
                # 查無此股或請求失敗，記錄今日避免短時間內重複重試
                if code not in cache:
                    cache[code] = {
                        'paidInCapital': None,
                        'capitalUpdatedAt': today_str,
                        'industryPe': None,
                        'industryPeUpdatedAt': today_str,
                        'pe': None,
                        'trailingEps': None,
                        'updatedAt': today_str,
                    }

        elapsed = time.time() - t0
        if verbose:
            print(f'[fubon] 基本面抓取完成：成功解析 {updated_count}/{len(to_fetch)} 檔，耗時 {elapsed:.1f}s')

        # 儲存快取檔
        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_cache = cache_file.with_suffix('.tmp.json')
            with open(tmp_cache, 'w', encoding='utf-8') as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
            os.replace(tmp_cache, cache_file)
            if verbose:
                print(f'[fubon] 快取已寫入：{cache_file} (總計 {len(cache)} 檔紀錄)')
        except Exception as e:
            if verbose:
                print(f'[fubon] 寫入快取檔警告: {e}')

    return cache


# ── 所屬產業分類（Phase 5 產業題材與關聯公司）─────────────────
INDUSTRY_TTL_DAYS = 60       # 產業分類更新週期：60 天 (超低頻變動)


def fetch_stock_industry(code: str) -> Optional[List[str]]:
    """
    抓取單檔個股所屬產業類別清單
    來源：https://fubon-ebrokerdj.fbs.com.tw/Z/ZC/ZCS/ZCS_{code}.djhtm
    """
    url = f'{_BASE}/Z/ZC/ZCS/ZCS_{code}.djhtm'
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_ctx, timeout=8) as resp:
            raw_bytes = resp.read()
            html = _decode_html(raw_bytes)
    except Exception:
        return None

    m = re.search(r'所屬產業\s*</td>\s*<td[^>]*>(.*?)</td>', html, re.DOTALL)
    if m:
        clean = re.sub(r'<[^>]+>', ' ', m.group(1)).strip()
        items = [x.strip() for x in re.split(r'[，,]', clean) if x.strip()]
        return items
    return []


def batch_fetch_industry(
    codes: List[str],
    cache_path: str = 'cache/industry.json',
    max_workers: int = 15,
    force: bool = False,
    verbose: bool = True
) -> Dict[str, List[str]]:
    """
    批次抓取股票池所屬產業分類（附帶本地 JSON 快取架構，TTL=60 天）
    """
    cache_file = Path(cache_path)
    cache: Dict[str, Dict] = {}

    if cache_file.exists():
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache = json.load(f)
        except Exception as e:
            if verbose:
                print(f'[fubon] 讀取產業快取失敗，重新初始化: {e}')
            cache = {}

    now_date = datetime.now().date()
    today_str = now_date.strftime('%Y-%m-%d')

    to_fetch: List[str] = []
    for code in codes:
        if force:
            to_fetch.append(code)
            continue

        entry = cache.get(code)
        if not entry:
            to_fetch.append(code)
            continue

        updated = entry.get('updatedAt')
        if not updated:
            to_fetch.append(code)
            continue

        try:
            d = datetime.strptime(updated, '%Y-%m-%d').date()
            if (now_date - d).days >= INDUSTRY_TTL_DAYS:
                to_fetch.append(code)
        except ValueError:
            to_fetch.append(code)

    if verbose:
        print(f'[fubon] 產業分類快取命中：{len(codes) - len(to_fetch)}/{len(codes)} 檔，需向富邦抓取：{len(to_fetch)} 檔 (TTL={INDUSTRY_TTL_DAYS}D)')

    if to_fetch:
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            fetched_results = list(executor.map(fetch_stock_industry, to_fetch))

        updated_count = 0
        for code, res in zip(to_fetch, fetched_results):
            if res is not None:
                cache[code] = {
                    'industry': res,
                    'updatedAt': today_str,
                }
                updated_count += 1
            else:
                if code not in cache:
                    cache[code] = {
                        'industry': [],
                        'updatedAt': today_str,
                    }

        elapsed = time.time() - t0
        if verbose:
            print(f'[fubon] 產業分類抓取完成：成功解析 {updated_count}/{len(to_fetch)} 檔，耗時 {elapsed:.1f}s')

        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_cache = cache_file.with_suffix('.tmp.json')
            with open(tmp_cache, 'w', encoding='utf-8') as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
            os.replace(tmp_cache, cache_file)
            if verbose:
                print(f'[fubon] 產業快取已寫入：{cache_file} (總計 {len(cache)} 檔紀錄)')
        except Exception as e:
            if verbose:
                print(f'[fubon] 寫入產業快取檔警告: {e}')

    return {c: cache.get(c, {}).get('industry', []) for c in codes}


# ── 單獨測試 ─────────────────────────────────────────────────
if __name__ == '__main__':
    data = fetch_all_rankings()
    for k, v in data.items():
        print(f"{k}: {len(v['stocks'])} 筆，日期={v['date']}")
