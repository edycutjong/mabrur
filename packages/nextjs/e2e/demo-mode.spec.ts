import { collectConsoleErrors } from "./helpers";
import { expect, test } from "@playwright/test";

// Every judge-facing route loads in demo mode (no wallet), logs no errors, and carries its social card.
const ROUTES: { path: string; title: RegExp; heading: RegExp }[] = [
  { path: "/app", title: /Pilih peran \| Mabrur/, heading: /hanya bisa dipakai untuk umrah Anda/ },
  { path: "/app/jamaah", title: /Buku Amanah · Jamaah \| Mabrur/, heading: /Buku Amanah/ },
  { path: "/app/agen", title: /Konsol Agen \| Mabrur/, heading: /Konsol Agen/ },
  { path: "/app/vendor", title: /Faktur Vendor \| Mabrur/, heading: /Tanda tangani faktur/ },
  { path: "/judge", title: /For judges \| Mabrur/, heading: /./ },
];

for (const r of ROUTES) {
  test(`${r.path} loads with no console errors and OG meta`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto(r.path);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(r.title);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(r.heading);

    const og = (p: string) => page.locator(`meta[property="${p}"]`).getAttribute("content");
    expect(await og("og:title")).toMatch(/Mabrur/);
    expect(await og("og:description")).toBeTruthy();
    expect(await og("og:image")).toMatch(/\/og-image\.png$/);
    expect(await page.locator('meta[name="twitter:card"]').getAttribute("content")).toBe("summary_large_image");

    // let the chain reads settle (contracts guard → screen), then check nothing errored
    await page.waitForTimeout(2_500);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("main nav lists the three roles and no Debug entry", async ({ page }) => {
  await page.goto("/app");
  const nav = page.getByRole("navigation", { name: "Peran" });
  await expect(nav.getByRole("link")).toHaveText(["Jamaah", "Agen", "Vendor"]);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: /github/i })).toHaveAttribute(
    "href",
    "https://github.com/edycutjong/mabrur",
  );
});
