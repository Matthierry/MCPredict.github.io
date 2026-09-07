import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../dist/", import.meta.url);
const port = Number(process.env.PORT ?? 4173);

function prediction({
  marketId,
  homeTeam,
  awayTeam,
  selection,
  probability,
  modelPrice,
  bookmakerPrice,
  edge,
  classification,
  date = "2026-08-22",
  kickoff = "15:00",
  league = "Premier League",
  market = "match"
}) {
  const fixture = { date, kickoff, country: "England", league, homeTeam, awayTeam };
  const analysis = {
    homeXGoals: 1.91,
    awayXGoals: 0.86,
    homeXShots: 15.4,
    awayXShots: 8.8,
    homeXShotsOnTarget: 5.7,
    awayXShotsOnTarget: 2.9
  };

  if (market === "ou") {
    return {
      marketId,
      fixture,
      prediction: { selection, probability, modelPrice, bookmakerPrice, edge, classification },
      probabilities: {
        model: selection === "Under 2.5" ? { over: 0.37, under: probability } : { over: probability, under: 1 - probability },
        bookmaker: { over: 0.64, under: 0.43 }
      },
      analysis
    };
  }

  const model = selection === "Draw"
    ? { home: 0.26, draw: probability, away: 1 - 0.26 - probability }
    : selection === "Away"
      ? { home: 0.24, draw: 0.21, away: probability }
      : { home: probability, draw: 0.22, away: 1 - probability - 0.22 };

  return {
    marketId,
    fixture,
    prediction: { selection, probability, modelPrice, bookmakerPrice, edge, classification },
    probabilities: {
      model,
      bookmaker: { home: 0.58, draw: 0.25, away: 0.21 }
    },
    analysis
  };
}

const match = [
  prediction({
    marketId: "M1",
    homeTeam: "Wolverhampton Wanderers Extremely Long Name",
    awayTeam: "Brighton and Hove Albion Long Name",
    selection: "Home",
    probability: 0.64,
    modelPrice: 1.56,
    bookmakerPrice: 1.92,
    edge: 12.4,
    classification: "High Value",
    league: "Premier League — Very Long Responsive Test Competition"
  }),
  prediction({
    marketId: "M2",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    selection: "Draw",
    probability: 0.55,
    modelPrice: 1.82,
    bookmakerPrice: 12.5,
    edge: 7.1,
    classification: "Good Value",
    kickoff: "17:30"
  }),
  prediction({
    marketId: "M3",
    homeTeam: "Liverpool",
    awayTeam: "Everton",
    selection: "Away",
    probability: 0.61,
    modelPrice: 1.64,
    bookmakerPrice: 2.05,
    edge: 0,
    classification: "No Value",
    date: "2026-08-23"
  }),
  prediction({
    marketId: "M4",
    homeTeam: "Manchester City",
    awayTeam: "Manchester United",
    selection: "Home",
    probability: 0.72,
    modelPrice: 1.39,
    bookmakerPrice: 1.36,
    edge: -4.2,
    classification: "No Value",
    date: "2026-08-23",
    kickoff: "16:30"
  })
];

const ou = [
  prediction({ market: "ou", marketId: "O1", homeTeam: "Arsenal", awayTeam: "Leeds", selection: "Over 2.5", probability: 0.68, modelPrice: 1.47, bookmakerPrice: 1.82, edge: 11.2, classification: "High Value" }),
  prediction({ market: "ou", marketId: "O2", homeTeam: "Fulham", awayTeam: "Burnley", selection: "Under 2.5", probability: 0.63, modelPrice: 1.59, bookmakerPrice: 1.74, edge: 4.6, classification: "Some Value" }),
  prediction({ market: "ou", marketId: "O3", homeTeam: "Liverpool", awayTeam: "Everton", selection: "Over 2.5", probability: 0.59, modelPrice: 1.69, bookmakerPrice: 1.69, edge: 0, classification: "No Value", date: "2026-08-23" }),
  prediction({ market: "ou", marketId: "O4", homeTeam: "Tottenham Hotspur", awayTeam: "Newcastle United", selection: "Under 2.5", probability: 0.66, modelPrice: 1.52, bookmakerPrice: 1.45, edge: -5.4, classification: "Bad Value", date: "2026-08-23" })
];

const apiPayloads = new Map([
  ["/api/v1/home", {
    fixturesProcessed: 18426,
    topMatchResult: match.slice(0, 3),
    topOverUnder25: ou.slice(0, 3),
    activeDatasetTimestamp: "2026-08-18T12:01:00Z",
    hasPredictions: true
  }],
  ["/api/v1/site-stats", { fixturesProcessed: 18426, updatedAt: "2026-08-18T12:02:00Z" }],
  ["/api/v1/predictions/match-result", { data: match, meta: { datasetId: "mock-active", updatedAt: "2026-08-18T12:01:00Z", count: match.length } }],
  ["/api/v1/predictions/over-under-25", { data: ou, meta: { datasetId: "mock-active", updatedAt: "2026-08-18T12:01:00Z", count: ou.length } }],
  ["/api/v1/health", { status: "ok", database: "ok", activeDataset: true }]
]);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

async function sendFile(response, pathname) {
  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = new URL(`.${safePath}`, root);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = new URL("index.html", filePath);
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath.pathname)] ?? "application/octet-stream" });
    response.end(body);
    return;
  } catch {
    const body = await readFile(new URL("index.html", root));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(body);
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

  if (apiPayloads.has(url.pathname)) {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(apiPayloads.get(url.pathname)));
    return;
  }

  const detailMatch = /^\/api\/v1\/predictions\/(match-result|over-under-25)\/(.+)$/.exec(url.pathname);
  if (detailMatch) {
    const source = detailMatch[1] === "match-result" ? match : ou;
    let marketId = "";
    try {
      marketId = decodeURIComponent(detailMatch[2]);
    } catch {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Invalid fixture identifier" }));
      return;
    }
    const item = source.find((predictionItem) => predictionItem.marketId === marketId);
    if (item) {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(JSON.stringify({
        data: item,
        meta: { datasetId: "mock-active", updatedAt: "2026-08-18T12:01:00Z" }
      }));
      return;
    }
  }

  if (url.pathname.startsWith("/api/")) {
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  await sendFile(response, url.pathname === "/" ? "/index.html" : url.pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MC Predict QA server listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
