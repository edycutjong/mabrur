# Contract review log

Three internal adversarial review rounds of `MabrurPBM`, `ClaimRegistry` and `TIDR`, run on 9 Okt 2026 between about 11:05 and 11:30 WIB.
This is an internal review, not a third-party audit. No round found a High or Medium issue.
Every Low finding was fixed in `ClaimRegistry`, pinned by a regression test, and redeployed and re-verified on Arbitrum One.

| Round | Findings | Fix | Commit | Regression tests (`packages/foundry/test/MabrurPBM.t.sol`) |
|---|---|---|---|---|
| 1 | **L1** a trusted issuer could overwrite another live issuer's claim. **L2** a removed and re-added issuer resurrected its old claims. | An issuer can no longer overwrite another issuer's live claim. Removing an issuer bumps its epoch, so its earlier claims stay retired even if it is re-added. | [`93701a2`](https://github.com/edycutjong/mabrur/commit/93701a2) | `test_OtherIssuerCannotUnrevokeOrOverwriteClaim`, `test_ReAddedIssuerDoesNotResurrectOldClaims`, `test_SuccessorIssuerCanReplaceRemovedIssuersClaim` |
| 2 | **L-A** narrowing an issuer's topics and then restoring them resurrected claims on the dropped topic. **L-B** another issuer's expired claim blocked re-certification of the same vendor. | Issuer epochs are kept per topic; expired claims are free to be re-certified. | [`6c5357e`](https://github.com/edycutjong/mabrur/commit/6c5357e) | `test_NarrowedThenRestoredTopicDoesNotResurrectClaims`, `test_ExpiredClaimOfOtherIssuerDoesNotBlockRecertification` |
| 3 | No new findings. | — | — | — |

The current test suite (87 tests reported by `forge test`, 100 % line, branch and function coverage) still runs every test above.
Reproduce: `cd packages/foundry && forge test --match-test "Overwrite|Resurrect|ReplaceRemoved|Recertification"`.
