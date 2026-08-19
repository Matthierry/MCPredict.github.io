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
      const firstCard = cards.first();
      const firstTrigger = page.locator(".prediction-card__trigger").first();
      const fixtureZone = firstCard.locator(".prediction-card__fixture-zone");
      const summary = firstCard.locator(".prediction-card__summary");
      await expect(firstTrigger.locator(".prediction-card__summary > div")).toHaveCount(4);

      const colourVars = await firstCard.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          homePrimary: style.getPropertyValue("--home-primary").trim(),
          homeSecondary: style.getPropertyValue("--home-secondary").trim(),
          awayPrimary: style.getPropertyValue("--away-primary").trim(),
          awaySecondary: style.getPropertyValue("--away-secondary").trim()
        };
      });
      for (const value of Object.values(colourVars)) {
        expect(value).toMatch(/^#[0-9A-F]{6}$/i);
      }

      // The colour wings live only inside this clipped fixture zone. This protects
      // Prediction / Model / Bookmaker / Edge from colour bleed on compact cards.
      const wingStyles = await fixtureZone.evaluate((element) => ({
        overflow: getComputedStyle(element).overflow,
        homeBackground: getComputedStyle(element, "::before").backgroundImage,
        awayBackground: getComputedStyle(element, "::after").backgroundImage
      }));
      expect(wingStyles.overflow).toBe("hidden");
      expect(wingStyles.homeBackground).not.toBe("none");
      expect(wingStyles.awayBackground).not.toBe("none");

      // Metadata must be a single centred League - Date Time line, for example:
      // League 2 - Sat 15th Aug 15:00.
      const metaText = (await firstCard.locator(".prediction-card__meta").textContent())?.trim() ?? "";
      expect(metaText).toMatch(/^.+ - (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}(st|nd|rd|th) [A-Z][a-z]{2}( \d{2}:\d{2})?$/);

      const cardBox = await firstCard.boundingBox();
      const zoneBox = await fixtureZone.boundingBox();
      const summaryBox = await summary.boundingBox();
      const metaBox = await firstCard.locator(".prediction-card__meta").boundingBox();
      const homeBox = await firstCard.locator(".prediction-card__team--home").boundingBox();
      const awayBox = await firstCard.locator(".prediction-card__team--away").boundingBox();
      if (cardBox && zoneBox && summaryBox && metaBox && homeBox && awayBox) {
        const cardCentre = cardBox.x + cardBox.width / 2;
        const metaCentre = metaBox.x + metaBox.width / 2;
        expect(Math.abs(cardCentre - metaCentre)).toBeLessThan(3);
        expect(Math.abs(zoneBox.y - cardBox.y)).toBeLessThan(2);
        expect(zoneBox.y + zoneBox.height).toBeLessThanOrEqual(summaryBox.y + 0.5);
        expect(homeBox.x - cardBox.x).toBeGreaterThan(24);
        expect((cardBox.x + cardBox.width) - (awayBox.x + awayBox.width)).toBeGreaterThan(24);
      }

      await firstTrigger.click();
      await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
      await expect(firstTrigger.getByText("Analysis open")).toBeVisible();
      await expect(page.locator(".probability-comparison")).toHaveCount(1);
      await expect(page.getByText("Bookmaker (pre-overround)", { exact: true })).toBeVisible();
      await expect(page.locator(".metric-compare")).toHaveCount(3);
      await expectNoHorizontalOverflow(page, 390);
      await firstTrigger.click();
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
