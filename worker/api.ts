import { getActiveDataset, getFixtureCount } from "./db";
import type { ActiveDataset, Env } from "./types";

interface DbPrediction {
  market_id: string;
  fixture_date: string;
  kickoff_time: string | null;
  country: string | null;
  league: string | null;
  home_team: string;
  away_team: string;

  match_prediction: "Home" | "Draw" | "Away" | null;
  match_model_home_probability: number | null;
  match_model_draw_probability: number | null;
  match_model_away_probability: number | null;
  match_model_price: number | null;
  match_bookmaker_home_probability: number | null;
  match_bookmaker_draw_probability: number | null;
  match_bookmaker_away_probability: number | null;
  match_bookmaker_price: number | null;
  match_edge: number | null;
  match_value_classification: string | null;

  ou_prediction: "Over 2.5" | "Under 2.5" | null;
  ou_model_over_probability: number | null;
  ou_model_under_probability: number | null;
  ou_model_price: number | null;
  ou_bookmaker_over_probability: number | null;
  ou_bookmaker_under_probability: number | null;
  ou_bookmaker_price: number | null;
  ou_edge: number | null;
  ou_value_classification: string | null;

  home_xgoals: number | null;
  away_xgoals: number | null;
  home_xshots: number | null;
  away_xshots: number | null;
  home_xshots_on_target: number | null;
  away_xshots_on_target: number | null;
}

const SELECT_COLUMNS = `
  market_id, fixture_date, kickoff_time, country, league, home_team, away_team,
  match_prediction, match_model_home_probability, match_model_draw_probability,
  match_model_away_probability, match_model_price,
  match_bookmaker_home_probability, match_bookmaker_draw_probability,
  match_bookmaker_away_probability, match_bookmaker_price,
  match_edge, match_value_classification,
  ou_prediction, ou_model_over_probability, ou_model_under_probability, ou_model_price,
  ou_bookmaker_over_probability, ou_bookmaker_under_probability, ou_bookmaker_price,
  ou_edge, ou_value_classification,
  home_xgoals, away_xgoals, home_xshots, away_xshots,
  home_xshots_on_target, away_xshots_on_target
`;

function selectedMatchProbability(row: DbPrediction): number | null {
  if (row.match_prediction === "Home") return row.match_model_home_probability;
  if (row.match_prediction === "Draw") return row.match_model_draw_probability;
  if (row.match_prediction === "Away") return row.match_model_away_probability;
  return null;
}

function selectedOuProbability(row: DbPrediction): number | null {
  if (row.ou_prediction === "Over 2.5") return row.ou_model_over_probability;
  if (row.ou_prediction === "Under 2.5") return row.ou_model_under_probability;
  return null;
}

function analysis(row: DbPrediction) {
  return {
    homeXGoals: row.home_xgoals,
    awayXGoals: row.away_xgoals,
    homeXShots: row.home_xshots,
    awayXShots: row.away_xshots,
    homeXShotsOnTarget: row.home_xshots_on_target,
    awayXShotsOnTarget: row.away_xshots_on_target
  };
}

function fixture(row: DbPrediction) {
  return {
    date: row.fixture_date,
    kickoff: row.kickoff_time,
    country: row.country,
    league: row.league,
    homeTeam: row.home_team,
    awayTeam: row.away_team
  };
}

function toMatchApi(row: DbPrediction) {
  return {
    marketId: row.market_id,
    fixture: fixture(row),
    prediction: {
      selection: row.match_prediction,
      probability: selectedMatchProbability(row),
      modelPrice: row.match_model_price,
      bookmakerPrice: row.match_bookmaker_price,
      edge: row.match_edge,
      classification: row.match_value_classification
    },
    probabilities: {
      model: {
        home: row.match_model_home_probability,
        draw: row.match_model_draw_probability,
        away: row.match_model_away_probability
      },
      bookmaker: {
        home: row.match_bookmaker_home_probability,
        draw: row.match_bookmaker_draw_probability,
        away: row.match_bookmaker_away_probability
      }
    },
    analysis: analysis(row)
  };
}

function toOuApi(row: DbPrediction) {
  return {
    marketId: row.market_id,
    fixture: fixture(row),
    prediction: {
      selection: row.ou_prediction,
      probability: selectedOuProbability(row),
      modelPrice: row.ou_model_price,
      bookmakerPrice: row.ou_bookmaker_price,
      edge: row.ou_edge,
      classification: row.ou_value_classification
    },
    probabilities: {
      model: {
        over: row.ou_model_over_probability,
        under: row.ou_model_under_probability
      },
      bookmaker: {
        over: row.ou_bookmaker_over_probability,
        under: row.ou_bookmaker_under_probability
      }
    },
    analysis: analysis(row)
  };
}

function responseHeaders(cache = true, etag?: string): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  headers.set(
    "Cache-Control",
    cache ? "public, max-age=30, s-maxage=60, stale-while-revalidate=30" : "no-store"
  );
  if (etag) headers.set("ETag", etag);
  return headers;
}

function json(data: unknown, options?: { status?: number; cache?: boolean; etag?: string }): Response {
  return new Response(JSON.stringify(data), {
    status: options?.status ?? 200,
    headers: responseHeaders(options?.cache ?? true, options?.etag)
  });
}

function notModified(etag: string): Response {
  return new Response(null, { status: 304, headers: responseHeaders(true, etag) });
}

function matchesEtag(request: Request, etag: string): boolean {
  return request.headers.get("if-none-match") === etag;
}

async function activeRows(
  env: Env,
  active: ActiveDataset,
  market: "match" | "ou",
  limit?: number
): Promise<DbPrediction[]> {
  const validity = market === "match" ? "match_valid = 1" : "ou_valid = 1";
  const order =
    market === "match"
      ? "match_edge DESC, fixture_date ASC, kickoff_time ASC"
      : "ou_edge DESC, fixture_date ASC, kickoff_time ASC";
  const limitSql = typeof limit === "number" ? ` LIMIT ${Math.max(0, Math.floor(limit))}` : "";
  const result = await env.DB.prepare(
    `SELECT ${SELECT_COLUMNS}
       FROM predictions
      WHERE dataset_id = ? AND ${validity}
      ORDER BY ${order}${limitSql}`
  )
    .bind(active.id)
    .all<DbPrediction>();
  return result.results ?? [];
}

export async function handleApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  if (request.method === "POST" && url.pathname === "/api/internal/sync") {
    const auth = request.headers.get("authorization");
    if (!env.SYNC_TOKEN || auth !== `Bearer ${env.SYNC_TOKEN}`) {
      return json({ error: "Not found" }, { status: 404, cache: false });
    }
    const { runIngestion } = await import("./ingest");
    const result = await runIngestion(env, "manual", null);
    return json(result, { cache: false });
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, { status: 405, cache: false });
  }

  if (url.pathname === "/api/v1/health") {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      const active = await getActiveDataset(env.DB);
      return json(
        { status: "ok", database: "ok", activeDataset: Boolean(active) },
        { cache: false }
      );
    } catch {
      return json(
        { status: "degraded", database: "error", activeDataset: false },
        { status: 503, cache: false }
      );
    }
  }

  if (url.pathname === "/api/v1/site-stats") {
    const stats = await getFixtureCount(env.DB);
    const etag = `"site-stats-${stats.updatedAt ?? "none"}"`;
    if (matchesEtag(request, etag)) return notModified(etag);
    return json(
      { fixturesProcessed: stats.value, updatedAt: stats.updatedAt },
      { etag }
    );
  }

  const active = await getActiveDataset(env.DB);

  if (url.pathname === "/api/v1/home") {
    const stats = await getFixtureCount(env.DB);
    const etag = `"home-${active?.source_hash ?? "none"}-${stats.updatedAt ?? "none"}"`;
    if (matchesEtag(request, etag)) return notModified(etag);

    if (!active) {
      return json(
        {
          fixturesProcessed: stats.value,
          topMatchResult: [],
          topOverUnder25: [],
          activeDatasetTimestamp: null,
          hasPredictions: false
        },
        { etag }
      );
    }

    const [matchRows, ouRows] = await Promise.all([
      activeRows(env, active, "match", 3),
      activeRows(env, active, "ou", 3)
    ]);

    return json(
      {
        fixturesProcessed: stats.value,
        topMatchResult: matchRows.map(toMatchApi),
        topOverUnder25: ouRows.map(toOuApi),
        activeDatasetTimestamp: active.activated_at,
        hasPredictions: active.valid_match_result_count > 0 || active.valid_ou_count > 0
      },
      { etag }
    );
  }

  if (url.pathname === "/api/v1/predictions/match-result") {
    const etag = `"match-${active?.source_hash ?? "none"}"`;
    if (matchesEtag(request, etag)) return notModified(etag);
    if (!active) {
      return json({ data: [], meta: { datasetId: null, updatedAt: null, count: 0 } }, { etag });
    }
    const rows = await activeRows(env, active, "match");
    return json(
      {
        data: rows.map(toMatchApi),
        meta: { datasetId: active.id, updatedAt: active.activated_at, count: rows.length }
      },
      { etag }
    );
  }

  if (url.pathname === "/api/v1/predictions/over-under-25") {
    const etag = `"ou-${active?.source_hash ?? "none"}"`;
    if (matchesEtag(request, etag)) return notModified(etag);
    if (!active) {
      return json({ data: [], meta: { datasetId: null, updatedAt: null, count: 0 } }, { etag });
    }
    const rows = await activeRows(env, active, "ou");
    return json(
      {
        data: rows.map(toOuApi),
        meta: { datasetId: active.id, updatedAt: active.activated_at, count: rows.length }
      },
      { etag }
    );
  }

  return json({ error: "Not found" }, { status: 404, cache: false });
}
