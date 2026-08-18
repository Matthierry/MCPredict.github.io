import { expect, test } from "@playwright/test";

const TARGET_WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280];
const ROUTES = ["/", "/match-result", "/over-under-25", "/faqs"];

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, width: number) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  expect(dimensions.viewportWidth).toBe(width);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(width);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(width);
}

test("deployed beta routes render without horizontal overflow at required widths", async ({ page }) => {
  for (const width of TARGET_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ROUTES) {
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.ok(), `${route} returned ${response?.status()}`).toBe(true);
      await expect(page.locator("body")).toBeVisible();
      await expectNoHorizontalOverflow(page, width);

      if (width < 768) {
        await expect(page.locator(".mobile-nav")).toBeVisible();
        await expect(page.locator(".desktop-nav")).toBeHidden();
      } else {
        await expect(page.locator(".mobile-nav")).toBeHidden();
        await expect(page.locator(".desktop-nav")).toBeVisible();
      }
    }
  }
});

test("deployed beta homepage and market routes are interactive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Predicting Football with Data" })).toBeVisible();
  await expect(page.locator(".hero-stat__value")).not.toHaveText("—");

  for (const route of ["/match-result", "/over-under-25"]) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "VALUE", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "PROBABILITY", exact: true })).toBeVisible();
    await expect(page.getByLabel("Date", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Prediction", { exact: true })).toBeVisible();

    const cards = page.locator(".prediction-card");
    const count = await cards.count();
    if (count > 0) {
      const firstTrigger = page.locator(".prediction-card__trigger").first();
      await firstTrigger.click();
      await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("button", { name: "↑ Close analysis" })).toBeVisible();
      await expect(page.locator(".probability-panel")).toHaveCount(2);
      await expectNoHorizontalOverflow(page, 390);
      await page.getByRole("button", { name: "↑ Close analysis" }).click();
      await expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
    } else {
      await expect(page.locator(".filter-empty, .availability-note")).toBeVisible();
    }

    await page.getByRole("button", { name: "PROBABILITY", exact: true }).click();
    await expect(page.getByRole("button", { name: "PROBABILITY", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".no-value-divider")).toHaveCount(0);
  }
});

test("deployed beta supports direct route refresh", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/match-result?mode=probability", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PROBABILITY", exact: true })).toHaveAttribute("aria-pressed", "true");
});
