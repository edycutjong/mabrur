# Contributing

Thanks for your interest in improving Mabrur!

## Getting started
1. Fork the repo and branch from `main`: `git checkout -b feat/your-feature`
2. `git submodule update --init --recursive` (Foundry libs) and `yarn install`
3. Contracts: `cd packages/foundry && forge test`
4. App: `yarn chain`, `yarn deploy`, then `yarn start` (local anvil), or point the app at Arbitrum One (default).

## Before you open a PR
- `forge fmt --check` and `forge test` pass (unit, fuzz and the invariant suite).
- `yarn next:lint` and `yarn next:check-types` pass.
- Contract changes come with a test named after the behaviour or defect it pins.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`): releases are versioned from them.

## Keys
Never commit a private key. The demo scripts read keys from `~/.config/mabrur/keys.env`; push protection and gitleaks run on every push.
