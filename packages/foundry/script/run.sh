#!/usr/bin/env bash
# Usage: script/run.sh <Setup|SeedDemo|DemoRun|DemoRefund> [chainId]   (from packages/foundry)
# Loads role keys from ~/.config/mabrur/ (never from this repo) and contract addresses from deployments/<chainId>.json.
set -euo pipefail
NAME="$1"; CHAIN="${2:-42161}"
set -a; source ~/.config/mabrur/keys.env; [ -f ~/.config/mabrur/explorer.env ] && source ~/.config/mabrur/explorer.env; set +a
addr() { python3 -c "import json,sys;d=json.load(open('deployments/$CHAIN.json'));print([k for k,v in d.items() if v=='$1'][0])"; }
export TIDR_ADDR=$(addr TIDR) REGISTRY_ADDR=$(addr ClaimRegistry) PBM_ADDR=$(addr MabrurPBM)
RPC="${RPC_URL:-https://arb1.arbitrum.io/rpc}"; [ "$CHAIN" = 31337 ] && RPC=http://127.0.0.1:8545
forge script "script/$NAME.s.sol:$NAME" --rpc-url "$RPC" --broadcast --slow
