export type PredictionMarket = "match" | "ou";

export interface FixtureRouteItem {
  marketId: string;
  fixture: {
    date: string;
    homeTeam: string;
    awayTeam: string;
  };
}

export function fixtureSlug(item: FixtureRouteItem): string {
  return `${item.fixture.homeTeam}-v-${item.fixture.awayTeam}-${item.fixture.date}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "fixture";
}

export function marketRoutePath(market: PredictionMarket): string {
  return market === "match" ? "match-result" : "over-under-25";
}

export function fixtureAnalysisPath(market: PredictionMarket, item: FixtureRouteItem): string {
  return `/${marketRoutePath(market)}/${encodeURIComponent(item.marketId)}/${fixtureSlug(item)}`;
}

export function fixtureApiPath(market: PredictionMarket, marketId: string): string {
  return `/api/v1/predictions/${marketRoutePath(market)}/${encodeURIComponent(marketId)}`;
}

export function parseFixtureAnalysisPath(pathname: string): { market: PredictionMarket; marketId: string } | null {
  const match = /^\/(match-result|over-under-25)\/([^/]+)(?:\/[^/]+)?$/.exec(pathname);
  if (!match) return null;
  try {
    return {
      market: match[1] === "match-result" ? "match" : "ou",
      marketId: decodeURIComponent(match[2])
    };
  } catch {
    return null;
  }
}
