import { collectConsoleErrors, expectNoHorizontalOverflow } from "./helpers";
import { expect, test } from "@playwright/test";

/**
 * The two static judge-facing surfaces served by next.config rewrites: `/` (public/landing) and `/pitch` (public/pitch).
 */
test.describe("landing page at /", () => {
  test("serves the landing with the claim headline, CTAs and social card", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    expect(page.url()).not.toContain("/app"); // no longer redirects into the app
    await expect(page).toHaveTitle(/Mabrur/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("hanya mau berangkat bersamanya");

    const hero = page.locator("section.hero");
    await expect(hero.getByRole("link", { name: "Buka Buku Amanah" })).toHaveAttribute("href", "/app/jamaah");
    await expect(hero.getByRole("link", { name: /Jalur juri/ })).toHaveAttribute("href", "/judge");
    await expect(hero.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/edycutjong/mabrur",
    );

    const meta = (sel: string) => page.locator(sel).getAttribute("content");
    expect(await meta('meta[property="og:image"]')).toMatch(/\/og-image\.png(\?v=\d+)?$/); // ?v=N busts social-card caches
    expect(await meta('meta[property="og:image:width"]')).toBe("1200");
    expect(await meta('meta[property="og:image:height"]')).toBe("630");
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");

    // every image on the page resolves (real screenshots, served from /landing/assets)
    await page.evaluate(() => document.querySelectorAll("img").forEach(i => (i.loading = "eager")));
    await expect
      .poll(() => page.evaluate(() => Array.from(document.images).filter(i => !i.complete || !i.naturalWidth).length))
      .toBe(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the EN toggle swaps the body copy", async ({ page }) => {
    await page.goto("/");
    const lede = page.locator("section.hero p.lede");
    await expect(lede.first()).toBeVisible();
    await page.getByRole("button", { name: /Ganti bahasa/ }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("section.hero p.lede.t-en")).toBeVisible();
    await expect(page.locator("section.hero p.lede.t-id")).toBeHidden();
  });

  test("the demo tabs switch between real app screens", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Lunas" }).click();
    await expect(page.locator("#p-2")).toBeVisible();
    await expect(page.locator("#p-1")).toBeHidden();
    await expect(page.locator("#frame-url")).toContainText("/app/jamaah");
  });
});

test.describe("pitch deck at /pitch", () => {
  test("serves the deck and navigates with the keyboard", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto("/pitch");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Mabrur · Pitch deck/);
    await expect(page.locator(".slide.on h1")).toContainText("berangkat bersamanya");
    await expect(page.locator("#count")).toHaveText("01 / 09");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#count")).toHaveText("02 / 09");
    await expect(page.locator(".slide.on")).toHaveAttribute("data-title", "Masalah");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the 1920×1080 stage is scaled to fit the viewport", async ({ page }) => {
    await page.goto("/pitch");
    const vp = page.viewportSize()!;
    const box = await page.locator("#stage").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
  });
});

test.describe("surfaces: no horizontal overflow", () => {
  test.skip(({ isMobile }) => isMobile, "the viewport sweep runs once, in the desktop project");
  for (const width of [375, 768, 1440])
    for (const route of ["/", "/pitch"])
      test(`${route} @ ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expectNoHorizontalOverflow(page);
        await page.waitForLoadState("load");
        await page.waitForTimeout(3_500); // the hero stamps have landed
        await expectNoHorizontalOverflow(page);
      });
});
