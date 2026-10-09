#!/usr/bin/env bash
# Mines the four adversarial attempts as FAILED transactions on Arbitrum One (explicit --gas-limit skips estimation),
# all from the agency key against the Ahmad-backup booking (ticketBy == departBy, never refundable early).
# Needs script/out/backup.json (Setup) and script/out/invoices.json (SeedDemo). Then prints the regulator view.
# Usage (from packages/foundry): script/proof.sh [chainId]
set -uo pipefail
CHAIN="${1:-42161}"
set -a; source ~/.config/mabrur/keys.env; set +a
RPC="${RPC_URL:-https://arb1.arbitrum.io/rpc}"
PBM=$(python3 -c "import json;d=json.load(open('deployments/$CHAIN.json'));print([k for k,v in d.items() if v=='MabrurPBM'][0])")
j() { python3 -c "import json,sys;d=json.load(open('$1'));print(eval('d'+sys.argv[1]))" "$2"; }
tuple() { # file, json path → "(bookingId,line,amount,ref,expiry)" and signature
  echo "($(j "$1" "$2['bookingId']"),$(j "$1" "$2['line']"),$(j "$1" "$2['amount']"),$(j "$1" "$2['ref']"),$(j "$1" "$2['expiry']"))"
}
BACKUP=$(j script/out/backup.json "['backupId']")
SIG="spend(uint256,(uint256,uint8,uint256,bytes32,uint64),bytes)"
mine() { # label, expected error, cast args…
  local label="$1" expected="$2"; shift 2
  local out hash status
  out=$(cast send "$PBM" "$@" --gas-limit 1000000 --private-key "$AGENCY_PK" --rpc-url "$RPC" --json 2>&1)
  hash=$(echo "$out" | python3 -c 'import json,sys;print(json.load(sys.stdin)["transactionHash"])' 2>/dev/null || echo "NOT-MINED: $out")
  status=$(echo "$out" | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])' 2>/dev/null || echo "?")
  echo "| $label | $expected | $hash | status $status |"
}
echo "| Attempt | Expected revert | Tx hash | Result |"
echo "|---|---|---|---|"
mine "Siti's hotel invoice on Ahmad-backup" "EarmarkMismatch" "$SIG" "$BACKUP" \
  "$(tuple script/out/invoices.json "['earmarkMismatch']")" "$(j script/out/invoices.json "['earmarkMismatch']['signature']")"
mine "Director-signed hotel invoice" "VendorClaimMissing" "$SIG" "$BACKUP" \
  "$(tuple script/out/backup.json "['directorInvoice']")" "$(j script/out/backup.json "['directorInvoice']['signature']")"
mine "Replay of paid INV-HTL-0002" "InvoiceReplayed" "$SIG" "$BACKUP" \
  "$(tuple script/out/backup.json "['paidInvoice']")" "$(j script/out/backup.json "['paidInvoice']['signature']")"
DEP=$(cast wallet sign --no-hash "$(cast call "$PBM" "hashDeparture(uint256)(bytes32)" "$BACKUP" --rpc-url "$RPC")" --private-key "$AGENCY_PK")
mine "Agency signs its own departure" "NotDeparted" "releaseMargin(uint256,bytes)" "$BACKUP" "$DEP"
echo
echo "regulatorView(agency) = $(cast call "$PBM" "regulatorView(address)(uint256,uint256,uint256)" "$AGENCY_ADDR" --rpc-url "$RPC" | tr '\n' ' ')"
echo "conservation()        = $(cast call "$PBM" "conservation()(uint256,uint256,uint256)" --rpc-url "$RPC" | tr '\n' ' ')"
