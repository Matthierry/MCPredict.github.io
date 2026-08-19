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
    await expect(firstTrigger.getByText("Analysis open")).toBeVisible();
    await expect(page.locator(".probability-comparison")).toHaveCount(1);
    await expect(page.locator(".metric-compare")).toHaveCount(3);
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

test("prediction controls are compact and scroll with the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/match-result");
  await expect(page.locator(".prediction-card")).toHaveCount(4);

  const controlGeometry = await page.locator(".control-stack").evaluate((element) => {
    const modeButton = element.querySelector(".segmented-control button");
    const select = element.querySelector(".filter-row select");
    return {
      position: getComputedStyle(element).position,
      modeHeight: modeButton?.getBoundingClientRect().height ?? 999,
      selectHeight: select?.getBoundingClientRect().height ?? 999
    };
  });

  expect(controlGeometry.position).toBe("static");
  expect(controlGeometry.modeHeight).toBeLessThanOrEqual(34);
  expect(controlGeometry.selectHeight).toBeLessThanOrEqual(36);

  const before = await page.locator(".control-stack").boundingBox();
  expect(before).not.toBeNull();
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const after = await page.locator(".control-stack").boundingBox();
  expect(after).not.toBeNull();
  expect(after!.y).toBeLessThan(before!.y);
});

test("Match Result Value and Probability modes have distinct ordering and controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/match-result");
  await expect(page.locator(".prediction-card")).toHaveCount(4);

  await expect(page.getByRole("button", { name: "VALUE", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".prediction-card").first().locator(".prediction-card__summary > div").last()).toContainText("Edge");
  await expect(page.locator(".no-value-divider")).toHaveCount(1);
  let cards = await page.locator(".prediction-card").allTextContents();
  expect(cards[0]).toContain("Wolverhampton Wanderers");
  expect(cards[1]).toContain("Arsenal");
  expect(cards[2]).toContain("Liverpool");
  expect(cards[3]).toContain("Manchester City");

  await page.getByLabel("Prediction", { exact: true }).selectOption("Draw");
  await expect(page.locator(".prediction-card")).toHaveCount(1);
  await expect(page.locator(".prediction-card").first()).toContainText("Arsenal");
  await expect(page.locator(".no-value-divider")).toHaveCount(0);

  await page.getByLabel("Prediction", { exact: true }).selectOption("all");
  await page.getByRole("button", { name: "PROBABILITY", exact: true }).click();
  await expect(page.getByRole("button", { name: "PROBABILITY", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".no-value-divider")).toHaveCount(0);
  const probabilityCell = page.locator(".prediction-card").first().locator(".prediction-card__summary > div").last();
  await expect(probabilityCell).toContainText("Probability");
  await expect(probabilityCell).toContainText("%");
  cards = await page.locator(".prediction-card").allTextContents();
  expect(cards[0]).toContain("Manchester City");
  expect(cards[1]).toContain("Wolverhampton Wanderers");
  expect(cards[2]).toContain("Liverpool");
  expect(cards[3]).toContain("Arsenal");

  const triggers = page.locator(".prediction-card__trigger");
  await expect(triggers.nth(0).locator(".prediction-card__summary > div")).toHaveCount(4);
  await triggers.nth(0).click();
  await expect(triggers.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".probability-comparison")).toHaveCount(1);
  await expect(page.getByText("1X2 PROBABILITY COMPARISON", { exact: true })).toBeVisible();
  await expect(page.getByText("Bookmaker (pre-overround)", { exact: true })).toBeVisible();
  await expect(page.locator(".probability-outcome")).toHaveCount(3);
  await expect(page.locator(".metric-compare")).toHaveCount(3);
  await expect(page.getByText("FORECASTED GOALS", { exact: true })).toBeVisible();
  await expect(page.getByText("FORECASTED SHOTS", { exact: true })).toBeVisible();
  await expect(page.getByText("FORECASTED SHOTS ON TARGET", { exact: true })).toBeVisible();

  await triggers.nth(1).click();
  await expect(triggers.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(triggers.nth(1)).toHaveAttribute("aria-expanded", "true");

  await page.getByLabel("Date", { exact: true }).selectOption("2026-08-23");
  await expect(page.locator(".prediction-card")).toHaveCount(2);
});

test("desktop forecast metrics keep equal team-to-value spacing", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/match-result");
  const firstTrigger = page.locator(".prediction-card__trigger").first();
  await firstTrigger.click();
  await expect(page.locator(".metric-compare")).toHaveCount(3);

  const gaps = await page.locator(".metric-compare").first().evaluate((row) => {
    const homeName = row.querySelector(".metric-compare__team--home small")!.getBoundingClientRect();
    const homeValue = row.querySelector(".metric-compare__team--home strong")!.getBoundingClientRect();
    const awayValue = row.querySelector(".metric-compare__team--away strong")!.getBoundingClientRect();
    const awayName = row.querySelector(".metric-compare__team--away small")!.getBoundingClientRect();
    return {
      home: homeValue.left - homeName.right,
      away: awayName.left - awayValue.right
    };
  });

  expect(gaps.home).toBeGreaterThanOrEqual(10);
  expect(gaps.away).toBeGreaterThanOrEqual(10);
  expect(Math.abs(gaps.home - gaps.away)).toBeLessThanOrEqual(1);
});

test("O/U mode supports probability ordering, Under filtering and analysis", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/over-under-25?mode=probability");
  await expect(page.getByRole("heading", { name: "Over/Under 2.5 Predictions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PROBABILITY", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Prediction", { exact: true }).selectOption("Under 2.5");
  await expect(page.locator(".prediction-card")).toHaveCount(2);
  const cards = await page.locator(".prediction-card").allTextContents();
  expect(cards[0]).toContain("Tottenham Hotspur");
  expect(cards[1]).toContain("Fulham");

  const firstTrigger = page.locator(".prediction-card__trigger").first();
  await firstTrigger.click();
  await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("O/U 2.5 PROBABILITY COMPARISON", { exact: true })).toBeVisible();
  await expect(page.getByText("Bookmaker (pre-overround)", { exact: true })).toBeVisible();
  await expect(page.locator(".probability-outcome")).toHaveCount(2);
  await expect(page.locator(".metric-compare")).toHaveCount(3);
  await expect(page.getByText("FORECASTED GOALS", { exact: true })).toBeVisible();
  await expect(page.getByText("FORECASTED SHOTS", { exact: true })).toBeVisible();
  await expect(page.getByText("FORECASTED SHOTS ON TARGET", { exact: true })).toBeVisible();
  await firstTrigger.click();
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
  await secondContext.close();
});

test("direct SPA navigation and refresh work for public routes", async ({ page }) => {
  await page.goto("/match-result?mode=probability");
  await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PROBABILITY", exact: true })).toHaveAttribute("aria-pressed", "true");
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
