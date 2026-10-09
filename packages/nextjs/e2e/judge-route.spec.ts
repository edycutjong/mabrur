import { expectNoHorizontalOverflow } from "./helpers";
import { expect, test } from "@playwright/test";

test.describe("/judge", () => {
  test("answers 200 with no session and states the claim", async ({ page, request }) => {
    const res = await request.get("/judge");
    expect(res.status()).toBe(200);

    await page.goto("/judge");
    // Indonesian by default; the English claim is the EN variant of the same heading
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Uang muka jamaah hanya bisa dipakai untuk perjalanannya sendiri\./,
    );
    await page.getByRole("button", { name: /Ganti bahasa/ }).click();
    await expect(page.getByText("A pilgrim's prepayment can only be spent on her own trip.").first()).toBeVisible();
    await expect(page).toHaveTitle(/For judges \| Mabrur/);
  });

  test("is reachable from the site chrome", async ({ page }) => {
    await page.goto("/app");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: /Untuk juri/ })
      .click();
    await expect(page).toHaveURL(/\/judge$/);
  });

  test("step 4 says sign → paste → simulate, with a space after the italics, in both languages", async ({ page }) => {
    await page.goto("/judge");
    const step = page.getByRole("listitem").filter({ hasText: "Simulasi saja" });
    const id = step.locator(".t-id");
    await expect(id).toBeVisible();
    await expect(id).toContainText(/tanda tangani satu di halaman vendor, tempel JSON-nya di konsol agen/);
    await expect(id).toContainText("lalu tekan Simulasi saja di sana");
    await page.getByRole("button", { name: /Ganti bahasa/ }).click();
    const en = step.locator(".t-en");
    await expect(en).toBeVisible();
    await expect(en).toContainText(/sign one on the vendor page, paste its JSON into the agency console/);
    await expect(en).toContainText("press Simulate only there");
  });

  test("receipts are readable at 375px: no sideways scroll, every tx link on screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/judge");
    const receipts = page.getByTestId("receipts");
    await receipts.scrollIntoViewIfNeeded();
    const links = receipts.getByRole("link", { name: /di Arbiscan|on Arbiscan/ });
    await expect(links).toHaveCount(4);
    for (const link of await links.all()) {
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box, "tx link has a box").not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
      await expect(link).toHaveAttribute("href", /^https:\/\/arbiscan\.io\/tx\/0x[0-9a-f]{64}$/);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("table headers use the v2 label style, not the faded theme default", async ({ page }) => {
    await page.goto("/judge");
    const th = await page
      .getByTestId("receipts")
      .locator("th")
      .first()
      .evaluate(el => {
        const cs = getComputedStyle(el);
        return { color: cs.color, background: cs.backgroundColor, opacity: cs.opacity };
      });
    // --muted (5.6:1 on --surface), on the --surface well, fully opaque
    expect(th).toEqual({ color: "rgb(93, 100, 109)", background: "rgb(245, 246, 248)", opacity: "1" });
  });

  test("the Reproduce block is keyboard-focusable and labelled", async ({ page }) => {
    await page.goto("/judge");
    const pre = page.getByRole("region", { name: /Perintah reproduksi|Reproduce commands/ });
    await expect(pre).toHaveAttribute("tabindex", "0");
    await pre.focus();
    await expect(pre).toBeFocused();
  });
});

test.describe("404", () => {
  test("an unknown route gets the Mabrur not-found page with links to /app and /judge", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page).toHaveTitle(/Halaman tidak ditemukan · Page not found \| Mabrur/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Halaman ini tidak ada.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("This page does not exist.");
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /Buka aplikasi/ })).toHaveAttribute("href", "/app");
    await expect(main.getByRole("link", { name: /Untuk juri/ })).toHaveAttribute("href", "/judge");
    await main.getByRole("link", { name: /Untuk juri/ }).click();
    await expect(page).toHaveURL(/\/judge$/);
  });
});
