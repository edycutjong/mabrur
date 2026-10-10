#!/usr/bin/env python3
"""Prints the DEMO.md transaction ledger from the committed Arbitrum One broadcast receipts (no hand-typed hashes).
Usage (from packages/foundry): python3 script/ledger.py > ../../DEMO-ledger.md"""
import json

SCAN = "https://arbiscan.io/tx/"
LINE = {0: "FLIGHT", 1: "HOTEL", 2: "VISA"}


def rows(script):
    d = json.load(open(f"broadcast/{script}.s.sol/42161/run-latest.json"))
    return list(zip(d["transactions"], d["receipts"]))


def describe(script, tx, names):
    fn = (tx.get("function") or tx.get("transactionType") or "").split("(")[0]
    args = tx.get("arguments") or []
    if tx.get("transactionType") == "CREATE":
        return f"deploy {tx['contractName']}", "contract created"
    if fn == "faucet":
        return "tIDR faucet (test token, no value)", "Rp 32.000.000 minted"
    if fn == "book":
        who = names.pop(0) if names else "pilgrim"
        return f"{who} books Rp 32.000.000 (permit + book)", "earmark created: FLIGHT 14M · HOTEL 9M · VISA 4M · MARGIN 5M"
    if fn == "spend":
        inv = args[1].strip("()").split(",")
        line = LINE.get(int(inv[1].strip()), inv[1])
        amt = int(inv[2].strip())
        return f"agency pays {line} invoice", f"Rp {amt:,}".replace(",", ".") + " to the claim-verified signer"
    if fn == "releaseMargin":
        return "margin release on the pilgrim's Departure signature", "MARGIN Rp 5.000.000 to the agency"
    if fn == "refund":
        return "anyone triggers refund after ticket-by (no ticket bought)", "every unspent rupiah back to the pilgrim"
    if fn == "addTrustedIssuer":
        return "regulator trusts the issuer (stand-in for Kemenhaj / IATA)", "issuer trusted for 4 topics"
    if fn == "issueClaim":
        topic = {"1": "PPIU_AGENCY", "2": "AIRLINE", "3": "HOTEL", "4": "VISA_PROVIDER"}.get(args[1], args[1])
        return f"issuer certifies {args[0][:10]}… as {topic}", "claim issued"
    return fn, ""


print("| # | Script | Step | Expected | Tx | Status |")
print("|---|---|---|---|---|---|")
n = 0
for script, names in (("Deploy", []), ("Setup", ["Ahmad-backup"]), ("DemoRun", ["Ibu Siti", "Pak Ahmad"]), ("DemoRefund", [])):
    for tx, rc in rows(script):
        n += 1
        step, expected = describe(script, tx, names)
        ok = "✓ success" if rc["status"] == "0x1" else "✗ " + rc["status"]
        h = tx["hash"]
        print(f"| {n} | {script} | {step} | {expected} | [{h[:10]}…]({SCAN}{h}) | {ok} |")
