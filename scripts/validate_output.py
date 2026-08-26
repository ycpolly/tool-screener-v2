import json

# 讀 v2 輸出
with open('public/data/stock-pool.json', encoding='utf-8') as f:
    v2 = json.load(f)

v2_map = {s['code']: s for s in v2['stocks']}

# 關鍵股票比對
check = ['2330', '2308', '2454', '3711', '2382']
for code in check:
    s = v2_map.get(code)
    if s:
        cats = ', '.join(s['categories'][:3])
        print(f"{code} {s['name']}: price={s['price']}, prevClose={s['prevClose']}, "
              f"changePct={s['changePct']}%, ma5={s['ma5']}, ma20={s['ma20']}, "
              f"market={s['market']}, isDisposed={s['isDisposed']}")
        print(f"  kd: k={s['kd']['k']}, d={s['kd']['d']}, sparkline={s['sparkline'][-3:]}")
        print(f"  cats: [{cats}]")
    else:
        print(f"{code}: NOT FOUND")

print()
print(f"總計: {len(v2['stocks'])} 檔")
print(f"更新時間: {v2['meta']['updatedAt']}")
market = v2.get('market') or {}
taiex = market.get('taiex') or {}
regime = market.get('regime') or {}
print(f"大盤: {taiex.get('price')} ({taiex.get('changePct')}%) | {regime.get('code')} - {regime.get('badge')}")

# 驗證沒有 market='上市' 或 market='上櫃' 的舊格式
old_market = [s for s in v2['stocks'] if s.get('market') not in ('tse', 'otc')]
print(f"舊格式 market 欄位: {len(old_market)} 筆 (應為 0)")

# 驗證 sparkline 長度
no_sparkline = [s['code'] for s in v2['stocks'] if len(s.get('sparkline', [])) < 5]
print(f"sparkline 不足 5 筆: {no_sparkline[:10]}")

# 驗證 history10d
no_history = [s['code'] for s in v2['stocks'] if len(s.get('history10d', [])) < 10]
print(f"history10d 不足 10 筆: {no_history[:10]}")
