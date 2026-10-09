#!/usr/bin/env bash
# N3 — what one pilgrim lifecycle costs, from REAL Arbitrum One receipts (gasUsed × effectiveGasPrice; on Arbitrum
# gasUsed already includes the L1 component). Lifecycles are filtered by bookingId; faucet/claim/setup txs excluded.
#   departed: book + FLIGHT + HOTEL + VISA spends + releaseMargin  (Ahmad, DemoRun)
#   refunded: book + 1 HOTEL spend + refund                         (Siti, DemoRun + DemoRefund)
# ETH/IDR is fetched live from CoinGecko and printed with its timestamp. Usage (from packages/foundry): script/cost.sh
set -euo pipefail
python3 - <<'PY'
import json, urllib.request, datetime
def load(name):
    d = json.load(open(f"broadcast/{name}.s.sol/42161/run-latest.json"))
    return list(zip(d["transactions"], d["receipts"]))
run = json.load(open("script/out/demorun.json")) if __import__("os").path.exists("script/out/demorun.json") else None
ahmad, siti = (int(run["ahmadBookingId"]), int(run["sitiBookingId"])) if run else (None, None)
def touches(tx, bid):
    a = tx.get("arguments") or []
    return bool(a) and str(bid) in " ".join(a)
def cost(rows):
    gas = sum(int(r["gasUsed"], 16) for _, r in rows)
    wei = sum(int(r["gasUsed"], 16) * int(r["effectiveGasPrice"], 16) for _, r in rows)
    return gas, wei
dr = load("DemoRun"); rf = load("DemoRefund")
# book() args carry no bookingId: DemoRun order is Siti book, Siti spend, Ahmad book, 3 spends, releaseMargin (after 2 faucets)
body = [x for x in dr if x[0]["function"] and not x[0]["function"].startswith("faucet")]
siti_rows = body[0:2] + [x for x in rf if x[0]["function"] and x[0]["function"].startswith("refund")]
ahmad_rows = body[2:7]
assert all(touches(t, siti) for t, _ in siti_rows[1:]), "Siti rows do not match her bookingId"
assert all(touches(t, ahmad) for t, _ in ahmad_rows[1:]), "Ahmad rows do not match his bookingId"
try:
    q = json.load(urllib.request.urlopen("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=idr", timeout=15))
    eth_idr = q["ethereum"]["idr"]; src = f"CoinGecko simple/price, fetched {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M UTC}"
except Exception as e:
    eth_idr = None; src = f"unavailable ({e})"
print("| Lifecycle | Txs | Gas used | Fee (ETH) | Fee (Rp) | % of Rp 32.000.000 |")
print("|---|---|---|---|---|---|")
for name, rows in (("Departed pilgrim (book + 3 spends + releaseMargin)", ahmad_rows), ("Refunded pilgrim (book + 1 spend + refund)", siti_rows)):
    gas, wei = cost(rows); eth = wei / 1e18
    rp = f"{eth*eth_idr:,.0f}".replace(",", ".") if eth_idr else "n/a"
    pct = f"{eth*eth_idr/32_000_000*100:.4f} %" if eth_idr else "n/a"
    print(f"| {name} | {len(rows)} | {gas:,} | {eth:.9f} | {rp} | {pct} |")
print(f"\nETH/IDR = {eth_idr:,.0f} ({src})" if eth_idr else f"\nETH/IDR {src}")
PY
