"""
scrapers/moneydj.py
從 MoneyDJ 抓取 0050 / 0051 成分股清單與權重

來源：https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid=0050.TW
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


def fetch_etf_holdings(etf_id: str) -> Tuple[str, List[Dict]]:
    """
    抓取指定 ETF 的成分股清單

    Args:
        etf_id: ETF 代號，e.g. "0050" 或 "0051"

    Returns:
        (data_date, holdings)
        data_date: "2026/08/25" 格式
        holdings:  [{"code": "2330", "name": "台積電", "weight": "32.5%"}, ...]
    """
    url = f'https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid={etf_id}.TW'
    print(f'[moneydj] 抓取 {etf_id} 成分股... {url}')

    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, context=_ctx, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f'  [moneydj] {etf_id} 連線失敗: {e}')
        return datetime.now().strftime('%Y/%m/%d'), []

    # 解析資料日期
    date_m = re.search(r'ctl00_ctl00_MainContent_MainContent_sdate3[^>]*>([^<]+)', html)
    if not date_m:
        date_m = re.search(r'資料日期：\s*(\d{4}/\d{1,2}/\d{1,2})', html)
    data_date = (
        date_m.group(1).replace('資料日期：', '').strip()
        if date_m
        else datetime.now().strftime('%Y/%m/%d')
    )

    # 定位成分股表格
    table_m = re.search(
        r'<table[^>]*id="[^"]*stable3"[^>]*>(.*?)</table>',
        html, re.DOTALL
    )
    table_html = table_m.group(1) if table_m else html

    # 解析各列
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL)
    holdings = []
    for row in rows:
        raw_cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        cells = [re.sub(r'<[^>]+>', '', c).strip() for c in raw_cells]
        if len(cells) < 2:
            continue
        # 格式：台積電(2330.TW)
        m = re.search(r'([^(]+)\((\d{4})\.TW\)', cells[0])
        if not m:
            continue
        name   = m.group(1).strip()
        code   = m.group(2).strip()
        weight = cells[1].replace('%', '').strip()
        holdings.append({
            'code':   code,
            'name':   name,
            'weight': f'{weight}%' if weight else '',
        })

    print(f'  [moneydj] {etf_id}: {len(holdings)} 檔，日期={data_date}')
    return data_date, holdings


# ── 單獨測試 ─────────────────────────────────────────────────
if __name__ == '__main__':
    for etf in ['0050', '0051']:
        date, holdings = fetch_etf_holdings(etf)
        print(f'{etf} ({date}): {len(holdings)} 檔')
        for h in holdings[:3]:
            print(' ', h)
