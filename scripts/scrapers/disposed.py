"""
scrapers/disposed.py
從 TWSE 與 TPEx 官方 OpenAPI 抓取最新處置股票清單

來源：
  - TWSE: https://openapi.twse.com.tw/v1/announcement/punish
  - TPEx: https://www.tpex.org.tw/openapi/v1/tpex_disposal_information
"""

import json
import ssl
import urllib.request
from typing import Set

# 停用 SSL 驗證（GitHub Actions 環境相容）
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

_TWSE_URLS = [
    'https://openapi.twse.com.tw/v1/announcement/punish',
    'https://www.twse.com.tw/rwd/zh/announcement/punish?response=json',
]

_TPEX_URLS = [
    'https://www.tpex.org.tw/openapi/v1/tpex_disposal_information',
    'https://www.tpex.org.tw/openapi/v1/tpex_esb_disposal_information',
]


def _is_valid_disposed_code(code: str) -> bool:
    """處置股代碼格式驗證：4位數字"""
    s = str(code).strip()
    return len(s) == 4 and s.isdigit()


def _fetch_twse_disposed() -> Set[str]:
    """抓取證交所上市處置股"""
    result: Set[str] = set()
    for url in _TWSE_URLS:
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, context=_ctx, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            if isinstance(data, list):
                for item in data:
                    code = str(item.get('Code', '') or item.get('code', '')).strip()
                    if _is_valid_disposed_code(code):
                        result.add(code)
                print(f"  [TWSE disposed] {url} → {len(result)} 筆")
                return result  # 第一個成功就回傳

            elif isinstance(data, dict):
                rows = data.get('data', []) or data.get('rawContent', [])
                for r in rows:
                    if len(r) >= 3:
                        code = str(r[2]).strip()
                        if _is_valid_disposed_code(code):
                            result.add(code)
                print(f"  [TWSE disposed] {url} → {len(result)} 筆")
                return result

        except Exception as e:
            print(f"  [TWSE disposed] {url} 失敗: {e}")
            continue

    print("  [TWSE disposed] 所有 URL 均失敗，回傳空集合")
    return result


def _fetch_tpex_disposed() -> Set[str]:
    """抓取櫃買中心上櫃處置股"""
    result: Set[str] = set()
    for url in _TPEX_URLS:
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, context=_ctx, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            if isinstance(data, list):
                for item in data:
                    # TPEx API 欄位名稱可能有多種
                    code = str(
                        item.get('SecuritiesCompanyCode', '')
                        or item.get('Code', '')
                        or item.get('code', '')
                    ).strip()
                    if _is_valid_disposed_code(code):
                        result.add(code)
                print(f"  [TPEx disposed] {url} → {len(result)} 筆")
                return result

        except Exception as e:
            print(f"  [TPEx disposed] {url} 失敗: {e}")
            continue

    print("  [TPEx disposed] 所有 URL 均失敗，回傳空集合")
    return result


def fetch_disposed_codes() -> Set[str]:
    """
    抓取全部處置股代碼（TWSE + TPEx 合併去重）

    Returns:
        Set[str]: 處置股代碼集合，e.g. {'2330', '2454'}
    """
    print("[disposed] 抓取處置股資料...")
    twse = _fetch_twse_disposed()
    tpex = _fetch_tpex_disposed()
    combined = twse | tpex
    print(f"  [disposed] 合計 {len(combined)} 檔: {sorted(combined)}")
    return combined


# ── 單獨測試 ─────────────────────────────────────────────────
if __name__ == '__main__':
    codes = fetch_disposed_codes()
    print(f"\n最終處置股清單 ({len(codes)} 檔):", sorted(codes))
