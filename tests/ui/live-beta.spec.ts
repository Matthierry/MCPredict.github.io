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

  const heroBox = await page.locator(".home-hero").boundingBox();
  expect(heroBox).not.toBeNull();
  expect(heroBox!.height).toBeLessThanOrEqual(225);

  const homeCards = page.locator(".home-prediction-list .prediction-card");
  await expect(homeCards).toHaveCount(6);
  const homeFirstCard = homeCards.first();
  const homeFirstTrigger = homeFirstCard.locator(".prediction-card__trigger");
  await expect(homeFirstTrigger.locator(".prediction-card__summary > div")).toHaveCount(4);
  await expect(homeFirstTrigger.getByText("Quick view", { exact: true })).toBeVisible();
  await expect(homeFirstCard.getByRole("link", { name: "View full analysis" })).toBeVisible();
  await homeFirstTrigger.click();
  await expect(homeFirstTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".probability-comparison")).toHaveCount(1);
  await expect(page.locator(".metric-compare")).toHaveCount(3);
  await expectNoHorizontalOverflow(page, 390);
  await homeFirstTrigger.click();
  await expect(homeFirstTrigger).toHaveAttribute("aria-expanded", "false");

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

      const wingStyles = await fixtureZone.evaluate((element) => ({
        overflow: getComputedStyle(element).overflow,
        homeBackground: getComputedStyle(element, "::before").backgroundImage,
        awayBackground: getComputedStyle(element, "::after").backgroundImage
      }));
      expect(wingStyles.overflow).toBe("hidden");
      expect(wingStyles.homeBackground).not.toBe("none");
      expect(wingStyles.awayBackground).not.toBe("none");

      const metaText = (await firstCard.locator(".prediction-card__meta").textContent())?.trim() ?? "";
      expect(metaText).toMatch(/^.+ - (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}(st|nd|rd|th) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)( \d{2}:\d{2})?$/);

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
      await expect(firstTrigger.getByText("Close quick view")).toBeVisible();
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

test("deployed beta desktop homepage uses three-across cards with one shared drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });

  const matchSection = page.locator(".home-section").filter({ has: page.getByRole("heading", { name: "Top 3 model edges", exact: true }) });
  const matchList = matchSection.locator(".home-prediction-list");
  const matchCards = matchList.locator(".prediction-card");
  const matchTriggers = matchList.locator(".prediction-card__trigger");
  const matchDrawer = matchSection.locator("#home-match-analysis-drawer");

  await expect(matchCards).toHaveCount(3);
  const grid = await matchList.evaluate((element) => ({
    display: getComputedStyle(element).display,
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
  }));
  expect(grid.display).toBe("grid");
  expect(grid.columns).toBe(3);

  const allHomeTeams = page.locator(".home-prediction-list .prediction-card__team");
  await expect(allHomeTeams).toHaveCount(12);

  const singleWord = page.locator(".home-prediction-list .prediction-card__team--single-word").first();
  await expect(singleWord).toBeVisible();
  const singleStyles = await singleWord.evaluate((element) => ({
    whiteSpace: getComputedStyle(element).whiteSpace,
    textOverflow: getComputedStyle(element).textOverflow,
    overflowX: getComputedStyle(element).overflowX
  }));
  expect(singleStyles.whiteSpace).toBe("nowrap");
  expect(singleStyles.textOverflow).toBe("ellipsis");
  expect(singleStyles.overflowX).toBe("hidden");

  const multiWord = page.locator(".home-prediction-list .prediction-card__team--multi-word").first();
  await expect(multiWord).toBeVisible();
  const wordTokens = multiWord.locator(".prediction-card__team-word");
  expect(await wordTokens.count()).toBeGreaterThan(1);
  const tokenStyles = await wordTokens.evaluateAll((tokens) => tokens.map((token) => getComputedStyle(token).whiteSpace));
  expect(tokenStyles.every((value) => value === "nowrap")).toBe(true);

  await expect(matchDrawer).toBeHidden();
  await matchTriggers.nth(0).click();
  await expect(matchDrawer).toBeVisible();
  await expect(matchDrawer.getByText("1X2 PROBABILITY COMPARISON", { exact: true })).toBeVisible();
  await expect(matchDrawer.locator(".metric-compare")).toHaveCount(3);

  await matchTriggers.nth(1).click();
  await expect(matchTriggers.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(matchTriggers.nth(1)).toHaveAttribute("aria-expanded", "true");
  await matchTriggers.nth(1).click();
  await expect(matchDrawer).toBeHidden();
  await expectNoHorizontalOverflow(page, 1280);
});

test("deployed beta supports direct route refresh", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/match-result?mode=probability", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Match Result Predictions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PROBABILITY", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("deployed beta fixture analysis links open and survive refresh", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/match-result", { waitUntil: "networkidle" });

  const firstCard = page.locator(".prediction-card").first();
  const cards = await page.locator(".prediction-card").count();
  if (cards === 0) {
    await expect(page.locator(".filter-empty, .availability-note")).toBeVisible();
    return;
  }

  const home = (await firstCard.locator(".prediction-card__team--home").textContent())?.trim();
  const away = (await firstCard.locator(".prediction-card__team--away").textContent())?.trim();
  const link = firstCard.getByRole("link", { name: "View full analysis" });
  await expect(link).toHaveAttribute("href", /^\/match-result\/[^/]+\/.+/);
  await link.click();

  await expect(page.getByRole("heading", { name: `${home} v ${away}` })).toBeVisible();
  await expect(page.getByText("1X2 PROBABILITY COMPARISON", { exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
  await expectNoHorizontalOverflow(page, 390);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: `${home} v ${away}` })).toBeVisible();
});
