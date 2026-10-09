import { AHMAD_ID, expectNoHorizontalOverflow } from "./helpers";
import { expect, test } from "@playwright/test";

const ROUTES = ["/app", `/app/jamaah?id=${AHMAD_ID}`, "/app/agen", "/app/vendor", "/judge"];
const WIDTHS = [375, 768, 1440];

// Layout is viewport-driven, so one browser project is enough.
test.describe("no horizontal overflow", () => {
  test.skip(({ isMobile }) => isMobile, "the viewport sweep runs once, in the desktop project");

  for (const width of WIDTHS)
    for (const route of ROUTES)
      test(`${route.split("?")[0]}${route.includes("?") ? "?id" : ""} @ ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        if (route.includes("jamaah")) {
          // the passbook (the widest thing on the site) must be rendered before measuring
          await expect(page.getByText("No. kuitansi · booking id")).toBeVisible();
          await expect(page.getByText(/Buku Amanah Pak Ahmad/)).toBeVisible();
        }
        await page.waitForTimeout(1_000);
        await expectNoHorizontalOverflow(page);
      });
});
