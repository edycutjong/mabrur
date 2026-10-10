# For judges — Mabrur in 30 seconds

**A pilgrim's prepayment can only be spent on her own trip.** Mabrur earmarks each pilgrim's rupiah per line (flight,
hotel, visa, agency fee) inside a non-transferable token on Arbitrum One. The agency can pay only a claim-verified
vendor's signed invoice, the payee is always that signer, the fee unlocks only after departure, and anyone can refund
the rest once the ticket-by date passes with no ticket bought.

Web version: **https://mabrur.edycu.dev/judge**

## The 30-second path (no wallet, no install)
1. Pak Ahmad's completed booking: [/app/jamaah?id=9307…4554](https://mabrur.edycu.dev/app/jamaah?id=93071288952676167289577516806255635492368093588595261547394544652192346034554) — flight, hotel and visa paid to their signers; fee released after his departure signature.
2. Ibu Siti's refunded booking: [/app/jamaah?id=3830…1737](https://mabrur.edycu.dev/app/jamaah?id=38303033312745746094663211795656914215448779063347601464497604008460359611737) — no ticket by her ticket-by date, so a third party refunded Rp 23.000.000.
3. The four rejected attempts below, each a mined, failed transaction on Arbiscan.
4. The [agency console with the sample invoices loaded](https://mabrur.edycu.dev/app/agen?contoh=1) (live regulator panel): Pak Ahmad's booking is selected; press **Simulasi saja** on any invoice to see a DITOLAK (rejected) seal with its error name, no wallet needed. Or sign your own invoice on the [vendor page](https://mabrur.edycu.dev/app/vendor) and paste it in.

## Receipts
| Rejected attempt | What the agency tried | Mined tx |
|---|---|---|
| `EarmarkMismatch` | Siti's hotel invoice used on another pilgrim's booking | [0x9ed30e38…](https://arbiscan.io/tx/0x9ed30e3802f988fb2219a08c9d184ab779da13d2afbc7f9314d0ab3fa0bbc316) |
| `VendorClaimMissing` | Invoice signed by the agency director | [0x887d6b86…](https://arbiscan.io/tx/0x887d6b86d4361666b883edb9624efbd9bef0cdc6e4b0244149433d964beffa61) |
| `InvoiceReplayed` | An already-paid invoice submitted again | [0x952f30ad…](https://arbiscan.io/tx/0x952f30adf9d7cc08982d8128c5e0de85a241d92a2d0e099799df6c7a75b9619a) |
| `NotDeparted` | Agency signs its own "departure" to take its fee | [0xe4855ebd…](https://arbiscan.io/tx/0xe4855ebd72f05a8756a814cc8fbfb963b18f70bdd16856130cff391e1df5291b) |

- **87 tests** (100 % line, branch and function coverage), including 7 invariants × 256 runs × depth 100.
- Cost from real receipts: departed lifecycle 907,185 gas ≈ Rp 809; refunded lifecycle 582,938 gas ≈ Rp 520 (ETH/IDR 44,563,294, CoinGecko, 9 Oct 2026).
- Full ledger: [DEMO.md](DEMO.md).

## Reproduce
```bash
git clone --recursive https://github.com/edycutjong/mabrur.git
cd mabrur/packages/foundry && forge test
cast run <any tx above> --rpc-url https://arb1.arbitrum.io/rpc --quick
```
Every demo script broadcasts to Arbitrum One; there is no mock, offline or dry-run mode.

## Honest limits
- tIDR is a test token with no value: no licensed rupiah token is usable on Arbitrum One. The wrapper takes any plain ERC-20.
- The claim issuer is a demo key standing in for Kemenag / IATA. A captured issuer could certify a fake vendor; the damage is bounded and tested (`test_CaptureIssuer_Bound`).
- Mabrur cannot guarantee a seat: it guarantees a paid ticket, or every unspent rupiah back.
