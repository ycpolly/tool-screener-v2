"""
convert_v1_to_v2.py
把 v1 的 stock-pool.js 轉換成 v2 的 stock-pool.json 格式
執行方式：python scripts/convert_v1_to_v2.py
"""

import re
import json
from datetime import datetime
from pathlib import Path

V1_POOL_PATH = Path("../tool-screener/js/data/stock-pool.js")
V2_JSON_PATH = Path("../tool-screener-v2/public/data/stock-pool.json")


def extract_js_const(content: str, var_name: str):
    """從 JS 檔案中提取 const 變數的值（JSON 格式）"""
    pattern = rf'const\s+{var_name}\s*=\s*(\[.*?\]|\{{.*?\}});'
    m = re.search(pattern, content, re.DOTALL)
    if not m:
        print(f"  [警告] 找不到 {var_name}")
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        print(f"  [錯誤] {var_name} JSON 解析失敗: {e}")
        return None


def normalize_market(stock: dict) -> str:
    """
    v1 用中文 '上市'/'上櫃'，v2 統一改為英文 'tse'/'otc'
    也處理缺欄位的情況（從 symbol 判斷）
    """
    market = stock.get("market", "")
    if market in ("上市", "tse"):
        return "tse"
    if market in ("上櫃", "otc"):
        return "otc"
    # 從 Yahoo symbol 判斷（.TW = 上市，.TWO = 上櫃）
    symbol = stock.get("symbol", "")
    if symbol.endswith(".TWO"):
        return "otc"
    return "tse"  # 預設上市


def transform_stock(s: dict) -> dict:
    """把 v1 個股物件轉成 v2 格式"""
    price = s.get("price", 0)
    prev_close = s.get("prevClose", price)
    change = round(price - prev_close, 2)
    change_pct = round((change / prev_close * 100), 2) if prev_close else 0

    return {
        "code":     str(s.get("code", "")).strip(),
        "name":     s.get("name", ""),
        "market":   normalize_market(s),
        "categories": s.get("categories", []),
        "isDisposed": s.get("isDisposed", False),

        # 價格
        "price":     price,
        "prevClose": prev_close,
        "open":      s.get("open", price),
        "high":      s.get("high", price),
        "low":       s.get("low", price),
        "change":    change,
        "changePct": change_pct,
        "volume":    s.get("volume", 0),

        # 均線
        "ma5":  s.get("ma5",  price),
        "ma10": s.get("ma10", price),
        "ma20": s.get("ma20", price),
        "ma60": s.get("ma60", price),

        # 量均
        "vMa5":       s.get("vMa5",  0),
        "vMa10":      s.get("vMa10", 0),
        "maxVol10d":  s.get("maxVol10d", 0),
        "hasVolumeBurst": s.get("hasVolumeBurst", False),

        # 近期高低價
        "high5d":  s.get("high5d",  price),
        "high10d": s.get("high10d", price),
        "high20d": s.get("high20d", price),
        "low5d":   s.get("low5d",  price),
        "low10d":  s.get("low10d", price),
        "low20d":  s.get("low20d", price),

        # KD
        "kd": s.get("kd", {"k": 50.0, "d": 50.0, "prevK": 50.0, "prevD": 50.0}),

        # Sparkline & 歷史
        "sparkline":  s.get("sparkline", []),
        "history10d": s.get("k10d", s.get("history10d", [])),
    }


def transform_ranking(raw) -> dict:
    """把 v1 的 ranking const 物件轉成 v2 格式"""
    if not raw:
        return {"date": "", "stocks": []}
    return {
        "date":      raw.get("date", ""),
        "sourceUrl": raw.get("sourceUrl", ""),
        "stocks":    raw.get("stocks", []),
    }


def transform_market_index(idx: dict) -> dict:
    """轉換大盤指數資料"""
    if not idx:
        return None
    return {
        "name":        idx.get("name", ""),
        "price":       idx.get("price", 0),
        "prevClose":   idx.get("prevClose", 0),
        "changePrice": idx.get("changePrice", 0),
        "changePct":   idx.get("changePct", 0),
        "ma5":         idx.get("ma5", 0),
        "ma10":        idx.get("ma10", 0),
        "ma20":        idx.get("ma20", 0),
        "bias20":      idx.get("bias20", 0),
        "statusDesc":  idx.get("statusDesc", ""),
        "kd":          idx.get("kd", {}),
    }


def main():
    print(f"讀取 v1 資料：{V1_POOL_PATH}")
    if not V1_POOL_PATH.exists():
        print(f"  [錯誤] 找不到 v1 stock-pool.js：{V1_POOL_PATH.resolve()}")
        return

    content = V1_POOL_PATH.read_text(encoding="utf-8")
    print(f"  檔案大小：{len(content):,} bytes")

    # ── 1. 個股資料庫 ──────────────────────────────────────────
    print("\n解析 STOCK_DATABASE...")
    db_raw = extract_js_const(content, "STOCK_DATABASE")
    if not db_raw:
        print("  [失敗] 無法取得 STOCK_DATABASE，中止")
        return

    stocks = []
    skipped = 0
    for s in db_raw:
        code = str(s.get("code", "")).strip()
        # 排除 ETF 與權證（與 v1 邏輯一致）
        if not code or code.startswith("00") or len(code) > 4:
            skipped += 1
            continue
        stocks.append(transform_stock(s))

    print(f"  轉換完成：{len(stocks)} 檔個股（跳過 {skipped} 筆 ETF/權證）")

    # ── 2. 排行榜 ───────────────────────────────────────────────
    print("\n解析排行榜資料...")
    ranking_map = {
        "holdings0050":  "HOLDINGS_0050",
        "holdings0051":  "HOLDINGS_0051",
        "top100Volume":  "TOP100_VOLUME",
        "valueTop":      "VALUE_TOP",
        "sitcaBuy3D":    "SITCA_BUY_3D",
        "foreignBuy1D":  "FOREIGN_BUY_1D",
        "majorBuy1D":    "MAJOR_BUY_1D",
        "turnoverRate":  "TURNOVER_RATE",
        "foreignSell":   "FOREIGN_SELL_TOP",
        "majorSell":     "MAJOR_SELL_TOP",
        "sitcaSell":     "SITCA_SELL_TOP",
    }
    rankings = {}
    for v2_key, v1_key in ranking_map.items():
        raw = extract_js_const(content, v1_key)
        rankings[v2_key] = transform_ranking(raw)
        count = len(rankings[v2_key]["stocks"])
        print(f"  {v2_key}: {count} 筆")

    # ── 3. 大盤資料 ─────────────────────────────────────────────
    print("\n解析大盤指數...")
    market_raw = extract_js_const(content, "MARKET_DATA")
    market = None
    if market_raw:
        market = {
            "taiex":  transform_market_index(market_raw.get("taiex")),
            "otc":    transform_market_index(market_raw.get("otc")),
            "regime": market_raw.get("regime", {"code": "SAFE"}),
        }
        print(f"  TAIEX: {market['taiex']['price'] if market['taiex'] else 'N/A'}")
        print(f"  OTC:   {market['otc']['price'] if market['otc'] else 'N/A'}")
    else:
        print("  [警告] 找不到 MARKET_DATA，market 欄位留空")

    # ── 4. 組裝輸出 ─────────────────────────────────────────────
    output = {
        "meta": {
            "updatedAt":   datetime.now().strftime("%Y-%m-%dT%H:%M:%S+08:00"),
            "totalStocks": len(stocks),
            "source":      "converted from v1 stock-pool.js",
        },
        "stocks":   stocks,
        "rankings": rankings,
        "market":   market,
    }

    # ── 5. 寫入 ─────────────────────────────────────────────────
    V2_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    V2_JSON_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    size_kb = V2_JSON_PATH.stat().st_size / 1024
    print(f"\n[OK] 輸出完成：{V2_JSON_PATH.resolve()}")
    print(f"  大小：{size_kb:.1f} KB，個股：{len(stocks)} 檔")


if __name__ == "__main__":
    main()
