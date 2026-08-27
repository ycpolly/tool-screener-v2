import json
with open('public/data/stock-pool.json', encoding='utf-8') as f:
    v2 = json.load(f)
stocks = v2['stocks']

# 名稱等於代號的（問題股）
code_as_name = [s for s in stocks if s['name'] == s['code']]
print(f'名稱=代號（問題）: {len(code_as_name)} 檔')
if code_as_name:
    for s in code_as_name[:10]:
        print(f'  {s["code"]}: cats={s["categories"][:2]}')

# 抽查 Gemini 提到的幾個問題股
check = ['4991', '3081', '1709', '1815']
print()
for code in check:
    s = next((x for x in stocks if x['code'] == code), None)
    if s:
        print(f'{code}: name="{s["name"]}"')
    else:
        print(f'{code}: 不在池中')

print(f'\n總計 {len(stocks)} 檔')
