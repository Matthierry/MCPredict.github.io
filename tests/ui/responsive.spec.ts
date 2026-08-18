import { expect, test } from "@playwright/test";

const TARGET_WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280];

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

test("has no horizontal overflow at required responsive widths", async ({ page }) => {
  for (const width of TARGET_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/match-result");
    await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
    await expect(page.locator(".prediction-card")).toHaveCount(4);
    await expectNoHorizontalOverflow(page, width);

    const firstTrigger = page.locator(".prediction-card__trigger").first();
    await firstTrigger.click();
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "↑ Close analysis" })).toBeVisible();
    await expectNoHorizontalOverflow(page, width);

    if (width < 768) {
      await expect(page.locator(".mobile-nav")).toBeVisible();
      await expect(page.locator(".desktop-nav")).toBeHidden();
    } else {
      await expect(page.locator(".mobile-nav")).toBeHidden();
      await expect(page.locator(".desktop-nav")).toBeVisible();
    }
  }
});

test("Match Result Value and Probability modes have distinct ordering and controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/match-result");
  await expect(page.locator(".prediction-card")).toHaveCount(4);

  await expect(page.getByRole("button", { name: "VALUE" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".no-value-divider")).toHaveCount(1);
  let cards = await page.locator(".prediction-card").allTextContents();
  expect(cards[0]).toContain("Wolverhampton Wanderers");
  expect(cards[1]).toContain("Arsenal");
  expect(cards[2]).toContain("Liverpool");
  expect(cards[3]).toContain("Manchester City");

  await page.getByLabel("Prediction").selectOption("Draw");
  await expect(page.locator(".prediction-card")).toHaveCount(1);
  await expect(page.locator(".prediction-card").first()).toContainText("Arsenal");
  await expect(page.locator(".no-value-divider")).toHaveCount(0);

  await page.getByLabel("Prediction").selectOption("all");
  await page.getByRole("button", { name: "PROBABILITY" }).click();
  await expect(page.getByRole("button", { name: "PROBABILITY" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".no-value-divider")).toHaveCount(0);
  cards = await page.locator(".prediction-card").allTextContents();
  expect(cards[0]).toContain("Manchester City");
  expect(cards[1]).toContain("Wolverhampton Wanderers");
  expect(cards[2]).toContain("Liverpool");
  expect(cards[3]).toContain("Arsenal");

  const triggers = page.locator(".prediction-card__trigger");
  await triggers.nth(0).click();
  await expect(triggers.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".probability-panel")).toHaveCount(2);
  await triggers.nth(1).click();
  await expect(triggers.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(triggers.nth(1)).toHaveAttribute("aria-expanded", "true");

  await page.getByLabel("Date").selectOption("2026-08-23");
  await expect(page.locator(".prediction-card")).toHaveCount(2);
});

test("O/U mode supports probability ordering, Under filtering and analysis", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/over-under-25?mode=probability");
  await expect(page.getByRole("heading", { name: "Over/Under 2.5 Predictions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PROBABILITY" })).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Prediction").selectOption("Under 2.5");
  await expect(page.locator(".prediction-card")).toHaveCount(2);
  const cards = await page.locator(".prediction-card").allTextContents();
  expect(cards[0]).toContain("Tottenham Hotspur");
  expect(cards[1]).toContain("Fulham");

  const firstTrigger = page.locator(".prediction-card__trigger").first();
  await firstTrigger.click();
  await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".probability-panel")).toHaveCount(2);
  await expect(page.getByText("BOOKMAKER · O/U 2.5")).toBeVisible();
  await page.getByRole("button", { name: "↑ Close analysis" }).click();
  await expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
});

test("homepage exposes both markets from both product modes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Predicting Football with Data" })).toBeVisible();
  await expect(page.getByText("18,426")).toBeVisible();
  await expect(page.getByRole("link", { name: "Match Result →" })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "O/U 2.5 →" })).toHaveCount(2);
});

test("FAQ accordion is keyboard-accessible and single-open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/faqs");
  const triggers = page.locator(".faq-item__trigger");
  await expect(triggers).toHaveCount(6);
  await expect(triggers.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(triggers.nth(1)).toHaveAttribute("aria-expanded", "false");

  await triggers.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(triggers.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(triggers.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#faq-panel-1")).toBeVisible();
});

test("direct SPA navigation and refresh work for public routes", async ({ page }) => {
  await page.goto("/match-result?mode=probability");
  await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PROBABILITY" })).toHaveAttribute("aria-pressed", "true");
});

test("filter-empty and API-failure states are distinct and calm", async ({ page, browser }) => {
  await page.route("**/api/v1/predictions/match-result", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { datasetId: "mock", updatedAt: "2026-08-18T12:00:00Z", count: 0 } })
    });
  });
  await page.goto("/match-result");
  await expect(page.getByText(/No predictions are available right now/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await secondPage.route("**/api/v1/predictions/match-result", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "internal detail" }) });
  });
  await secondPage.goto("http://127.0.0.1:4173/match-result");
  await expect(secondPage.getByText("Predictions could not be loaded right now.")).toBeVisible();
  await expect(secondPage.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(secondPage.getByText("internal detail")).toHaveCount(0);
  await secondContext.close();
});
