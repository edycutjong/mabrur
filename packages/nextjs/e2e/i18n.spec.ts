import { expect, test } from "@playwright/test";

/**
 * One ID/EN switch across the static landing (/) and the Next app (/app/*, /judge): the same localStorage key
 * (`mabrur-lang`), the same default (Indonesian) and the same `html.lang-en` class.
 */
const CLAIM_EN = "A pilgrim's prepayment can only be spent on her own trip.";
const CLAIM_ID = "Uang muka jamaah hanya bisa dipakai untuk perjalanannya sendiri.";
const APP_H1_EN = "Your umrah money can only be spent on your umrah.";
const APP_H1_ID = "Dana umrah Anda hanya bisa dipakai untuk umrah Anda.";

const h1 = (page: import("@playwright/test").Page) => page.getByRole("heading", { level: 1 }).first();

test("Indonesian by default on /app and /judge", async ({ page }) => {
  await page.goto("/app");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.locator("html")).not.toHaveClass(/lang-en/);
  await expect(h1(page)).toHaveAccessibleName(APP_H1_ID);
  await expect(page.getByText(APP_H1_EN)).toBeHidden();
  await expect(page.getByRole("button", { name: /Ganti bahasa/ })).toHaveAttribute("aria-pressed", "false");
});

test("EN chosen on the landing carries into /app and /judge, and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Ganti bahasa/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.goto("/app");
  await expect(page.locator("html")).toHaveClass(/lang-en/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(h1(page)).toHaveAccessibleName(APP_H1_EN);
  await expect(page.getByText(APP_H1_ID)).toBeHidden();
  const toggle = page.getByRole("button", { name: /Ganti bahasa/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await page.goto("/judge");
  await expect(h1(page)).toHaveAccessibleName(CLAIM_EN);
  await expect(page.getByText(CLAIM_EN)).toBeVisible();
  await expect(page.getByText(CLAIM_ID)).toBeHidden();

  // back to Indonesian from the app's own toggle …
  await page.getByRole("button", { name: /Ganti bahasa/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByText(CLAIM_ID)).toBeVisible();
  await expect(page.getByText(CLAIM_EN)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("mabrur-lang"))).toBe("id");

  // … which the app and the landing both honour
  await page.goto("/app");
  await expect(h1(page)).toHaveAccessibleName(APP_H1_ID);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.locator("section.hero p.lede.t-id")).toBeVisible();
});

test("the choice persists on reload and is applied before hydration (no flash)", async ({ page }) => {
  await page.goto("/judge");
  await page.getByRole("button", { name: /Ganti bahasa/ }).click();
  await expect(page.getByText(CLAIM_EN)).toBeVisible();

  // Block every Next.js bundle: no React, no hydration. Only the inline <head> boot script can switch the page now,
  // so English showing here proves the class is applied from the first paint, not after hydration.
  await page.route("**/_next/static/**/*.js", route => route.abort());
  for (const [path, heading] of [
    ["/judge", CLAIM_EN],
    ["/app", APP_H1_EN],
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/lang-en/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText(heading)).toBeVisible();
  }
  await page.unroute("**/_next/static/**/*.js");

  await page.goto("/app/vendor");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Sign an invoice");
  await expect(page.getByRole("button", { name: /Ganti bahasa/ })).toHaveAttribute("aria-pressed", "true");
});

test("attributes follow the language too (aria-label, placeholder)", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("navigation", { name: "Peran" })).toBeVisible();
  await page.getByRole("button", { name: /Ganti bahasa/ }).click();
  await expect(page.getByRole("navigation", { name: "Roles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "For judges" }).first()).toBeVisible();
});
