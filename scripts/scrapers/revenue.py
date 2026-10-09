"""
scripts/scrapers/revenue.py
台灣證券交易所 (TWSE) 與證券櫃檯買賣中心 (TPEx) 官方 OpenAPI 月營收彙總資料抓取

資料來源：
  - 上市：TWSE OpenAPI (https://openapi.twse.com.tw/v1/opendata/t187ap05_L)
  - 上櫃：TPEx OpenAPI (https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O)

更新頻率：
  - 每月 10 日前強制公告前一月份營收。
  - 快取於 cache/revenue.json（TTL = 7 天），支援快速回退與離線保護。
"""

import json
import os
import ssl
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

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

TWSE_REVENUE_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L'
TPEX_REVENUE_URL = 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O'

CACHE_PATH = Path('cache/revenue.json')
REVENUE_TTL_DAYS = 7  # 7 天檢查更新一次


def convert_roc_month(roc_str: str) -> Optional[str]:
    """
    將民國年月字串 (例如 "11508") 轉為西元 "YYYY-MM" (例如 "2026-08")
    """
    if not roc_str:
        return None
    s = str(roc_str).strip()
    try:
        if len(s) == 5:
            y = int(s[:3]) + 1911
            m = s[3:]
            return f"{y}-{m.zfill(2)}"
        elif len(s) == 4:
            y = int(s[:2]) + 1911
            m = s[2:]
            return f"{y}-{m.zfill(2)}"
        return s
    except Exception:
        return s


def parse_float(val) -> Optional[float]:
    """安全解析浮點數並四捨五入至小數點後 2 位"""
    if val is None:
        return None
    clean = str(val).replace(',', '').strip()
    if not clean or clean in ('-', '不適用', 'N/A'):
        return None
    try:
        return round(float(clean), 2)
    except (ValueError, TypeError):
        return None


def fetch_openapi_json(url: str, timeout: int = 15) -> list:
    """請求 OpenAPI 端點並回傳 JSON 陣列"""
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout, context=_ctx) as res:
        if res.status != 200:
            raise RuntimeError(f"HTTP {res.status} from {url}")
        content = res.read().decode('utf-8')
        return json.loads(content)


def fetch_all_monthly_revenue(
    cache_file: Path = CACHE_PATH,
    force: bool = False,
    verbose: bool = True
) -> Dict[str, dict]:
    """
    抓取全市場上市與上櫃月營收資料（含快取保護）

    Returns:
        {
          "2330": {
            "revenueYoY": 33.5,
            "revenueMoM": -2.81,
            "revenueLatestMonth": "2026-08",
            "revenue": 801696,
            "updatedAt": "2026-10-09"
          }, ...
        }
    """
    cache: Dict[str, dict] = {}
    if cache_file.exists():
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache = json.load(f)
        except Exception as e:
            if verbose:
                print(f"[revenue] 讀取快取失敗: {e}")
            cache = {}

    today_str = datetime.now().strftime('%Y-%m-%d')
    now_date = datetime.now().date()

    # 檢查快取新鮮度
    meta = cache.get('_meta', {})
    last_updated = meta.get('updatedAt')
    cache_fresh = False
    if not force and last_updated:
        try:
            d = datetime.strptime(last_updated, '%Y-%m-%d').date()
            if (now_date - d).days < REVENUE_TTL_DAYS:
                cache_fresh = True
        except ValueError:
            cache_fresh = False

    if cache_fresh and len(cache) > 1:
        if verbose:
            stocks_count = sum(1 for k in cache if not k.startswith('_'))
            print(f"[revenue] 月營收快取命中：{cache_file} (共 {stocks_count} 檔，更新於 {last_updated}，TTL={REVENUE_TTL_DAYS}D)")
        return cache

    # 若過期或強制重抓，請求 TWSE & TPEx OpenAPI
    if verbose:
        print("[revenue] 正在向 TWSE / TPEx OpenAPI 更新全市場月營收資料...")

    t0 = time.time()
    raw_items = []
    errors = []

    # 1. 上市營收彙總
    try:
        twse_list = fetch_openapi_json(TWSE_REVENUE_URL)
        raw_items.extend(twse_list)
        if verbose:
            print(f"[revenue] TWSE 上市營收已載入：{len(twse_list)} 筆")
    except Exception as e:
        errors.append(f"TWSE: {e}")
        if verbose:
            print(f"[revenue] 警告：無法取得 TWSE 上市月營收 ({e})")

    # 2. 上櫃營收彙總
    try:
        tpex_list = fetch_openapi_json(TPEX_REVENUE_URL)
        raw_items.extend(tpex_list)
        if verbose:
            print(f"[revenue] TPEx 上櫃營收已載入：{len(tpex_list)} 筆")
    except Exception as e:
        errors.append(f"TPEx: {e}")
        if verbose:
            print(f"[revenue] 警告：無法取得 TPEx 上櫃月營收 ({e})")

    # 若兩端皆失敗且有既有快取，降級使用既有快取
    if not raw_items:
        if cache and len(cache) > 1:
            if verbose:
                print(f"[revenue] OpenAPI 請求失敗 ({'; '.join(errors)})，降級使用既有快取")
            return cache
        raise RuntimeError(f"無法取得月營收資料: {'; '.join(errors)}")

    # 解析並更新至 cache
    latest_month = None
    parsed_count = 0
    for item in raw_items:
        code = str(item.get('公司代號', '')).strip()
        if not code or len(code) > 6:
            continue

        roc_month = item.get('資料年月')
        month_str = convert_roc_month(roc_month)
        if month_str and (latest_month is None or month_str > latest_month):
            latest_month = month_str

        yoy = parse_float(item.get('營業收入-去年同月增減(%)'))
        mom = parse_float(item.get('營業收入-上月比較增減(%)'))
        rev_val = parse_float(item.get('營業收入-當月營收'))

        cache[code] = {
            'revenueYoY': yoy,
            'revenueMoM': mom,
            'revenueLatestMonth': month_str,
            'revenue': rev_val,
            'updatedAt': today_str,
        }
        parsed_count += 1

    cache['_meta'] = {
        'updatedAt': today_str,
        'dataMonth': latest_month,
        'totalCount': parsed_count,
    }

    # 寫入快取檔（原子寫入）
    try:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        tmp_file = cache_file.with_suffix('.tmp.json')
        with open(tmp_file, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        os.replace(tmp_file, cache_file)
        if verbose:
            elapsed = time.time() - t0
            print(f"[revenue] 月營收快取已更新：{cache_file} (總計 {parsed_count} 檔，最新資料月份: {latest_month}，耗時 {elapsed:.1f}s)")
    except Exception as e:
        if verbose:
            print(f"[revenue] 寫入快取檔警告: {e}")

    return cache


if __name__ == '__main__':
    data = fetch_all_monthly_revenue(force=True)
    sample_codes = ['2330', '4551', '2317', '2454', '3265']
    print("\n樣本個股月營收檢視：")
    for c in sample_codes:
        print(f"  {c}: {data.get(c)}")
