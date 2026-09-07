import { handleApi } from "./api";
import {
  fixtureAnalysisPath,
  fixtureApiPath,
  parseFixtureAnalysisPath,
  type FixtureRouteItem
} from "../shared/fixture-routes";
import { runIngestion } from "./ingest";
import { londonHour, shouldRunScheduledIngestion } from "./schedule";
import type { Env } from "./types";

export default {
  async fetch(request, env): Promise<Response> {
    const apiResponse = await handleApi(request, env);
    if (apiResponse) return apiResponse;

    const route = parseFixtureAnalysisPath(new URL(request.url).pathname);
    const assetResponse = await env.ASSETS.fetch(request);
    if (!route || request.method !== "GET" || !assetResponse.headers.get("content-type")?.includes("text/html")) {
      return assetResponse;
    }

    const detailUrl = new URL(fixtureApiPath(route.market, route.marketId), request.url);
    const detailResponse = await handleApi(new Request(detailUrl, { headers: { Accept: "application/json" } }), env);
    if (!detailResponse?.ok) return assetResponse;

    const payload = await detailResponse.json<{ data: FixtureRouteItem }>();
    const item = payload.data;
    const marketLabel = route.market === "match" ? "Match Result" : "Over/Under 2.5";
    const title = `${item.fixture.homeTeam} v ${item.fixture.awayTeam} | MC Predict`;
    const description = `${marketLabel} analysis: independent model probabilities, expected goals and bookmaker comparison for ${item.fixture.homeTeam} v ${item.fixture.awayTeam}.`;
    const canonicalUrl = new URL(fixtureAnalysisPath(route.market, item), request.url).href;
    const robots = env.ENVIRONMENT === "beta" ? "noindex,nofollow" : "index,follow";

    return new HTMLRewriter()
      .on("title", { element: (element) => { element.setInnerContent(title); } })
      .on('meta[name="robots"]', { element: (element) => { element.setAttribute("content", robots); } })
      .on('meta[name="description"]', { element: (element) => { element.setAttribute("content", description); } })
      .on('meta[property="og:type"]', { element: (element) => { element.setAttribute("content", "article"); } })
      .on('meta[property="og:title"]', { element: (element) => { element.setAttribute("content", title); } })
      .on('meta[property="og:description"]', { element: (element) => { element.setAttribute("content", description); } })
      .on('meta[property="og:url"]', { element: (element) => { element.setAttribute("content", canonicalUrl); } })
      .on('meta[name="twitter:title"]', { element: (element) => { element.setAttribute("content", title); } })
      .on('meta[name="twitter:description"]', { element: (element) => { element.setAttribute("content", description); } })
      .on('link[rel="canonical"]', { element: (element) => { element.setAttribute("href", canonicalUrl); } })
      .transform(assetResponse);
  },

  async scheduled(controller, env): Promise<void> {
    const ukHour = londonHour(controller.scheduledTime);

    console.log("MC Predict scheduled trigger", {
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      ukHour,
      cron: controller.cron
    });

    if (!shouldRunScheduledIngestion(controller.scheduledTime)) {
      console.log("MC Predict scheduled trigger ignored outside intended UK hours", { ukHour });
      return;
    }

    await runIngestion(env, "scheduled", ukHour);
  }
} satisfies ExportedHandler<Env>;
