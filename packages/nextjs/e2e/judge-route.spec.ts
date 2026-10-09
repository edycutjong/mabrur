import { expect, test } from "@playwright/test";

test.describe("/judge", () => {
  test("answers 200 with no session and states the claim", async ({ page, request }) => {
    const res = await request.get("/judge");
    expect(res.status()).toBe(200);

    await page.goto("/judge");
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
});
