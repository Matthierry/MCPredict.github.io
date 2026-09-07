import { expect, test } from "@playwright/test";

function topSection(page: import("@playwright/test").Page, heading: string) {
  return page.locator(".home-section").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
}

test("desktop homepage keeps each Top 3 in one row with a shared analysis drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const matchSection = topSection(page, "Top 3 model edges");
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

  const cardBoxes = await matchCards.evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect()));
  expect(Math.max(...cardBoxes.map((box) => box.y)) - Math.min(...cardBoxes.map((box) => box.y))).toBeLessThan(2);
  expect(Math.max(...cardBoxes.map((box) => box.height))).toBeLessThanOrEqual(180);

  const firstSummaryBox = await matchCards.first().locator(".prediction-card__summary").boundingBox();
  const firstQuickViewBox = await matchCards.first().getByText("Quick view", { exact: true }).boundingBox();
  const firstDetailLink = matchCards.first().getByRole("link", { name: "View full analysis" });
  const firstDetailLinkBox = await firstDetailLink.boundingBox();
  expect(firstSummaryBox).not.toBeNull();
  expect(firstQuickViewBox).not.toBeNull();
  expect(firstDetailLinkBox).not.toBeNull();
  expect(firstQuickViewBox!.y).toBeGreaterThanOrEqual(firstSummaryBox!.y + firstSummaryBox!.height);
  expect(firstDetailLinkBox!.y).toBeGreaterThanOrEqual(firstSummaryBox!.y + firstSummaryBox!.height);
  expect(firstDetailLinkBox!.height).toBeGreaterThanOrEqual(34);
  const detailLinkFontSize = await firstDetailLink.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(detailLinkFontSize).toBeGreaterThanOrEqual(10);

  await expect(matchDrawer).toBeHidden();
  await expect(matchCards.locator(".prediction-card__expand")).toHaveCount(0);

  await matchTriggers.nth(0).click();
  await expect(matchTriggers.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(matchDrawer).toBeVisible();
  await expect(matchDrawer.getByText("1X2 PROBABILITY COMPARISON", { exact: true })).toBeVisible();
  await expect(matchDrawer.locator(".probability-comparison")).toHaveCount(1);
  await expect(matchDrawer.locator(".metric-compare")).toHaveCount(3);

  const drawerBox = await matchDrawer.boundingBox();
  const listBox = await matchList.boundingBox();
  expect(drawerBox).not.toBeNull();
  expect(listBox).not.toBeNull();
  expect(drawerBox!.y).toBeGreaterThanOrEqual(listBox!.y + listBox!.height);
  expect(Math.abs(drawerBox!.width - listBox!.width)).toBeLessThan(2);

  await matchTriggers.nth(1).click();
  await expect(matchTriggers.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(matchTriggers.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(matchDrawer).toContainText("Arsenal");
  await expect(matchDrawer).toContainText("Chelsea");

  await matchTriggers.nth(1).click();
  await expect(matchTriggers.nth(1)).toHaveAttribute("aria-expanded", "false");
  await expect(matchDrawer).toBeHidden();

  const ouSection = topSection(page, "Top 3 goal-market edges");
  const ouList = ouSection.locator(".home-prediction-list");
  const ouCards = ouList.locator(".prediction-card");
  const ouTriggers = ouList.locator(".prediction-card__trigger");
  const ouDrawer = ouSection.locator("#home-ou-analysis-drawer");

  await expect(ouCards).toHaveCount(3);
  const ouCardBoxes = await ouCards.evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect()));
  expect(Math.max(...ouCardBoxes.map((box) => box.height))).toBeLessThanOrEqual(180);

  await ouTriggers.nth(0).click();
  await expect(ouDrawer).toBeVisible();
  await expect(ouDrawer.getByText("O/U 2.5 PROBABILITY COMPARISON", { exact: true })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test("homepage team names only wrap at spaces and single words ellipsize", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const homeTeams = page.locator(".home-prediction-list .prediction-card__team");
  await expect(homeTeams).toHaveCount(12);

  const homeFontSize = await homeTeams.first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize));

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
  const tokenWhiteSpace = await wordTokens.evaluateAll((tokens) => tokens.map((token) => getComputedStyle(token).whiteSpace));
  expect(tokenWhiteSpace.every((value) => value === "nowrap")).toBe(true);

  await page.goto("/match-result");
  const marketTeam = page.locator(".prediction-card__team").first();
  await expect(marketTeam).toBeVisible();
  const marketFontSize = await marketTeam.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(marketFontSize - homeFontSize).toBeGreaterThanOrEqual(5.9);
  expect(marketFontSize - homeFontSize).toBeLessThanOrEqual(6.1);
});
