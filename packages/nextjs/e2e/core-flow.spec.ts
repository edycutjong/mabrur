import { AHMAD_ID } from "./helpers";
import { expect, test } from "@playwright/test";

/**
 * The core refusal, end to end on Arbitrum One (read-only): a fresh burner signs a hotel invoice on the vendor page;
 * the agency console pastes it and dry-runs spend() — the contract refuses because the signer holds no licensed-vendor
 * claim. Nothing is sent: "Simulasi saja" is a simulateContract call.
 */
test("vendor → agency round trip: an unlicensed signer is refused with VendorClaimMissing", async ({ page }) => {
  await page.goto("/app/vendor");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tanda tangani faktur");

  // hydrated once the burner's claim badges render (they are client-only reads)
  await expect(page.getByText(/tanpa klaim HOTEL|HOTEL ✓/)).toBeVisible();

  // a brand-new burner key: guaranteed to hold no vendor claim
  await page.getByText("Ganti / impor kunci burner").click();
  await page.getByRole("button", { name: "Buat burner baru" }).click();
  // replacing a key is destructive: the page asks first (and offers to copy the old key)
  await expect(page.getByRole("button", { name: "Salin kunci lama" })).toBeVisible();
  await page.getByRole("button", { name: "Ya, buat burner baru" }).click();
  const idInput = page.getByLabel("Id booking");
  await idInput.fill(AHMAD_ID);
  await expect(idInput).toHaveValue(AHMAD_ID);

  const pre = page.locator("pre").filter({ hasText: '"signature"' });
  await expect(async () => {
    await page.getByRole("button", { name: "Tanda tangani faktur" }).click();
    await expect(pre).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  const json = (await pre.textContent()) ?? "";
  expect(json).toContain('"chainId": 42161');

  await page.goto("/app/agen");
  await page.getByLabel("Tempel faktur").fill(json);
  await page.getByRole("button", { name: "Baca faktur" }).click();

  // the pasted invoice's booking is added and selected; wait for its four lines to load from chain
  await expect(page.getByText("booking ini", { exact: true })).toBeVisible();
  const simulate = page.getByRole("button", { name: "Simulasi saja" }).first();
  await expect(simulate).toBeEnabled();
  await simulate.click();

  // the result lands next to the button that triggered it …
  const inline = page.getByTestId("inline-result").first();
  await expect(inline).toContainText("VendorClaimMissing");
  await expect(inline).toContainText("Ditolak");
  // … and in the attempt ledger
  await expect(page.getByText(/simulated, nothing sent|tidak ada transaksi dikirim/).first()).toBeVisible();
});

/**
 * The no-wallet route a judge takes from /judge: the sample invoices load on arrival, Pak Ahmad's booking is selected,
 * and a dry run of Ibu Siti's hotel invoice lands DITOLAK · EarmarkMismatch. Read-only (simulateContract).
 */
test("judge route: sample invoices → DITOLAK EarmarkMismatch without a wallet", async ({ page }) => {
  await page.goto("/judge");
  await page.getByRole("link", { name: "Lihat cap DITOLAK sendiri, tanpa dompet" }).click();
  await expect(page).toHaveURL(/\/app\/agen\?contoh=1$/);
  const row = page.locator(".mb-row").filter({ hasText: "INV-HTL-DR-S" }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText("booking lain", { exact: true })).toBeVisible();
  await expect(async () => {
    await row.getByRole("button", { name: "Simulasi saja" }).click();
    await expect(row.locator(".mb-stamp-ditolak")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
  await expect(row.locator(".mb-stamp-ditolak")).toContainText("EarmarkMismatch");
});

test("Ibu Siti's refunded booking leads with the DIKEMBALIKAN seal and the amount, above the fold", async ({
  page,
}) => {
  await page.goto("/app/jamaah?id=38303033312745746094663211795656914215448779063347601464497604008460359611737");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ibu Siti");
  const hero = page.getByTestId("refund-hero");
  await expect(hero.locator(".mb-stamp-dikembalikan")).toBeVisible();
  await expect(hero).toContainText("Rp 23.000.000");
  const box = await hero.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 400);
});
