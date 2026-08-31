"""
scrapers/chips.py
從富邦 / MoneyDJ 券商分點進出明細頁面抓取 1D, 3D, 5D 籌碼集中度與短沖主力分點名單

來源：https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco.djhtm
職責：負責分點數據 HTML 抓取、前 15 大分點解析、籌碼集中度計算與短沖分點自動辨識
"""

import re
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

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

_BASE_URL = 'https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco.djhtm'

# ── 市場公認短沖 / 隔日沖主力券商分點關鍵字名冊 ────────────────────
DAY_TRADER_KEYWORDS = [
    '凱基-台北',
    '凱基-松山',
    '凱基-信義',
    '富邦-建國',
    '富邦-營業部',
    '富邦-員林',
    '元大-土城永寧',
    '群益-大安',
    '國票-安和',
    '美商高盛',
    '新加坡商瑞銀',
    '台灣摩根士丹利',
    '美林',
    '富邦證券',
]

_ROW_PATTERN = re.compile(
    r'<TR[^>]*>\s*'
    r'<TD[^>]*class="t4t1"[^>]*><a[^>]*>([^<]+)</a></TD>\s*'
    r'<TD[^>]*class="t3n1">([\d,]+)</TD>\s*'
    r'<TD[^>]*class="t3n1">([\d,]+)</TD>\s*'
    r'<TD[^>]*class="t3n1">([\d,]+)</TD>\s*'
    r'<TD[^>]*class="t3n1">([\d\.]+)%</TD>\s*'
    r'<TD[^>]*class="t4t1"[^>]*><a[^>]*>([^<]+)</a></TD>\s*'
    r'<TD[^>]*class="t3n1">([\d,]+)</TD>\s*'
    r'<TD[^>]*class="t3n1">([\d,]+)</TD>\s*'
    r'<TD[^>]*class="t3n1">([\d,]+)</TD>\s*'
    r'<TD[^>]*class="t3n1">([\d\.]+)%</TD>',
    re.IGNORECASE | re.DOTALL
)


def _fetch_html(url: str, timeout: int = 6) -> Optional[str]:
    """向指定 URL 發送 GET 請求並解碼 HTML (CP950)"""
    try:
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, context=_ctx, timeout=timeout) as resp:
            if resp.status == 200:
                return resp.read().decode('cp950', errors='ignore')
    except Exception:
        pass
    return None


def _parse_branches_and_concentration(html: str) -> Tuple[Optional[float], List[Dict]]:
    """
    從分點明細 HTML 解析：
    - 籌碼集中度 % (前 15 大買超佔比合計 - 前 15 大賣超佔比合計)
    - 買超前 15 大分點名單 [{ name, buyLots, sellLots, netLots, ratioPct }]
    """
    if not html:
        return None, []

    matches = _ROW_PATTERN.findall(html)
    if not matches:
        return None, []

    buy_branches = []
    total_buy_ratio = 0.0
    total_sell_ratio = 0.0

    for m in matches:
        buyer_name = m[0].strip()
        buyer_buy = int(m[1].replace(',', ''))
        buyer_sell = int(m[2].replace(',', ''))
        buyer_net = int(m[3].replace(',', ''))
        buyer_ratio = float(m[4])

        seller_ratio = float(m[9])

        total_buy_ratio += buyer_ratio
        total_sell_ratio += seller_ratio

        buy_branches.append({
            'name': buyer_name,
            'buyLots': buyer_buy,
            'sellLots': buyer_sell,
            'netLots': buyer_net,
            'ratioPct': buyer_ratio,
        })

    concentration_pct = round(total_buy_ratio - total_sell_ratio, 2)
    return concentration_pct, buy_branches


def _is_day_trader_branch(name: str) -> bool:
    """檢查分點名稱是否符合短沖/隔日沖主力名冊"""
    for kw in DAY_TRADER_KEYWORDS:
        if kw in name:
            return True
    return False


def fetch_single_stock_chips(code: str, history_dates: List[str] = None) -> Optional[Dict]:
    """
    抓取單一個股之 1D, 3D, 5D 籌碼集中度與短沖主力買超佔比
    
    Args:
        code: 股票代碼 (例: "1605")
        history_dates: 該個股近 10 日之真實開盤日期清單
        
    Returns:
        {
            "concentration1d": float,
            "concentration3d": float,
            "concentration5d": float,
            "dayTradersPct": float,
            "dayTradersBranches": [str]
        }
    """
    # 1. 抓取近 1 日 (b=1)
    url_1d = f"{_BASE_URL}?a={code}&b=1"
    html_1d = _fetch_html(url_1d)
    conc1d, branches1 = _parse_branches_and_concentration(html_1d)

    # 2. 抓取近 5 日 (b=2)
    url_5d = f"{_BASE_URL}?a={code}&b=2"
    html_5d = _fetch_html(url_5d)
    conc5d, _ = _parse_branches_and_concentration(html_5d)

    # 3. 抓取近 3 日 (依歷史開盤日起訖日自訂區間，100% 避開假日)
    conc3d = None
    if history_dates and len(history_dates) >= 3:
        d_start = history_dates[-3].replace('/', '-')
        d_end = history_dates[-1].replace('/', '-')
        url_3d = f"{_BASE_URL}?a={code}&e={d_start}&f={d_end}"
        html_3d = _fetch_html(url_3d)
        conc3d, _ = _parse_branches_and_concentration(html_3d)

    # 4. 短沖/隔日沖分點買超佔比分析 (聚焦在今日 1D 買超前 15 名中之短沖分點)
    day_traders_pct = 0.0
    day_traders_branches = []

    for b in branches1:
        if _is_day_trader_branch(b['name']):
            day_traders_pct += b['ratioPct']
            clean_name = b['name'].replace('證券', '')
            if clean_name not in day_traders_branches:
                day_traders_branches.append(clean_name)

    day_traders_pct = round(day_traders_pct, 2)

    return {
        'concentration1d': conc1d,
        'concentration3d': conc3d,
        'concentration5d': conc5d,
        'dayTradersPct': day_traders_pct,
        'dayTradersBranches': day_traders_branches[:4],  # 最多列出前 4 家短沖分點
    }


def fetch_all_chips_batch(stocks: List[Dict], max_workers: int = 10, verbose: bool = True) -> Dict[str, Dict]:
    """
    批次平行抓取全市場股票之籌碼集中度與短沖避雷數據
    
    Args:
        stocks: 股票物件清單 (每個 stock 需包含 code 與 history10d)
        max_workers: 平行執行緒數量
        verbose: 是否印出進度
        
    Returns:
        { [code]: chips_dict }
    """
    if verbose:
        print('=' * 60)
        print(f'[chips] 開始批次抓取 {len(stocks)} 檔個股之 1D/3D/5D 籌碼集中度與短沖分點')
        print('=' * 60)

    t0 = time.time()
    results = {}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_code = {
            executor.submit(
                fetch_single_stock_chips,
                stock['code'],
                [b['date'] for b in stock.get('history10d', []) if 'date' in b]
            ): stock['code']
            for stock in stocks
        }

        for future in as_completed(future_to_code):
            code = future_to_code[future]
            try:
                data = future.result()
                if data:
                    results[code] = data
            except Exception as ex:
                if verbose:
                    print(f'[chips] {code} 抓取異常: {ex}')

    if verbose:
        elapsed = time.time() - t0
        print(f'[chips] 批次抓取完成（{elapsed:.1f}s）— 成功取得 {len(results)}/{len(stocks)} 檔個股籌碼')

    return results
