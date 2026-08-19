# MC Predict V1

MC Predict V1 is a mobile-first football prediction data product. It presents the current output of the MC Predict model in two distinct modes:

- **Value** — compare the supplied model price with the supplied bookmaker price and rank selections by model edge.
- **Probability** — rank the model's selected outcomes by the probability supplied by the model.

V1 intentionally contains only four public destinations: Home, Match Result, Over/Under 2.5 and FAQs. Historical Results are deferred to V2.

## Production safety

The existing `main` branch remains the live-production implementation until the beta rebuild is explicitly approved. The rebuild branch is `agent/mcpredict-v1-rebuild`. A recoverable copy of the pre-rebuild production state was also created as `backup/pre-v1-rebuild-2026-08-18`.

Do **not** point `mcpredict.com` or `www.mcpredict.com` at this application until beta approval has been given.

## Architecture

```text
Published Google Sheet CSV
        ↓
Cloudflare Worker scheduled ingestion
        ↓
Cloudflare D1 active prediction snapshot
        ↓
Cloudflare Worker /api/v1
        ↓
React + TypeScript frontend
```

The browser never reads a Google Sheet directly. Google Sheets remains the owner's prediction-production interface; D1 is the public application's authoritative read database.

## Stack

- React
- TypeScript
- Vite
- Cloudflare Workers + Static Assets
- Cloudflare D1
- Cloudflare Cron Triggers
- Papa Parse
- Vitest
- GitHub

## Data sources

### Prediction source

```text
https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=2036795967&single=true&output=csv
```

### Lifetime fixtures-processed source

```text
https://docs.google.com/spreadsheets/d/e/2PACX-1vRoeausAAqFFCFoB0NK4vjsgmmzxP_J-WtgvUdusuau-jmJ3d3fqPAAa_ujd7nGYag5rJFOysZZUYiA/pub?gid=56710734&single=true&output=csv
```

The site-stat source uses cell **F1** for the lifetime fixture count.

## Authoritative source mapping

All zero-based indexes are centralised in `worker/source-columns.ts`; raw indexes must not be scattered through the codebase.

| Field | Sheet column | Zero-based index |
|---|---:|---:|
| Market ID | J | 9 |
| Fixture date | O | 14 |
| Kickoff | P | 15 |
| Home | Q | 16 |
| Away | R | 17 |
| Bookmaker Home % | S | 18 |
| Bookmaker Draw % | T | 19 |
| Bookmaker Away % | U | 20 |
| **Bookmaker Over %** | **V** | **21** |
| **Bookmaker Under %** | **W** | **22** |
| Match Edge | AG | 32 |
| O/U Edge | AH | 33 |
| Match bookmaker price | AI | 34 |
| Match model price | AK | 36 |
| O/U bookmaker price | AM | 38 |
| O/U model price | AO | 40 |
| Match prediction | AQ | 42 |
| O/U prediction | AR | 43 |
| Model Home % | AS | 44 |
| Model Draw % | AT | 45 |
| Model Away % | AU | 46 |
| Home xGoals | AV | 47 |
| Away xGoals | AW | 48 |
| Home xShots | AX | 49 |
| Away xShots | AY | 50 |
| Home xSOT | AZ | 51 |
| Away xSOT | BA | 52 |
| Match classification | BD | 55 |
| O/U classification | BG | 58 |
| Country | BH | 59 |
| League | BI | 60 |
| O/U Under model % | BJ | 61 |
| O/U Over model % | BK | 62 |

The V/W distinction is regression-tested so the historical error of using Over for both bookmaker O/U probabilities cannot silently return.

## Market ID

Column J is the authoritative prediction-row identity. It is stored as `TEXT`, trimmed only at the edges, and never converted to an integer. Leading zeroes and future non-numeric ID formats are preserved.

Within each dataset `(dataset_id, market_id)` is unique. Identical duplicates are safely deduplicated. Conflicting duplicate Market IDs invalidate the new import and the previous valid active dataset remains live.

## Internal data conventions

- Probabilities: `0.0–1.0`
- Decimal odds: numeric decimal values, e.g. `1.82`
- Edge: percentage points, e.g. `7.4` means `+7.4%`
- Date: ISO `YYYY-MM-DD` where possible
- Market ID: exact trimmed string
- Optional invalid xMetrics: `null`, never fake zeroes

## Database

Migration: `migrations/0001_initial.sql`

### `prediction_datasets`

Tracks immutable operational snapshots and their activation state, hashes and validation counts.

### `predictions`

Stores shared fixture data once plus Match Result and O/U fields, market validity flags and a diagnostic fixture fingerprint.

### `site_stats`

Stores the lifetime `fixtures_processed` value imported from F1.

### `site_state`

Stores the active prediction dataset ID and last successful/source-check/site-stat sync timestamps.

### `sync_runs`

Stores lightweight ingestion diagnostics. It is not a user-facing admin system.

## Safe dataset activation

Changed data is never rewritten row-by-row over the active dataset. A sync:

1. fetches the complete CSV;
2. validates the response and structure;
3. parses and normalises rows;
4. checks Market IDs and partial market validity;
5. detects duplicates;
6. hashes canonical rows sorted by Market ID;
7. builds a new snapshot only when the hash changes;
8. verifies inserted counts;
9. atomically activates the new dataset;
10. keeps a small set of previous operational snapshots for rollback.

A structurally valid empty source activates an empty dataset. A broken fetch, corrupt structure or conflicting duplicate does **not** replace good data.

## Scheduled updates

Cloudflare Cron candidate schedule:

```text
0 12-18 * * *
```

Cron triggers run in UTC. The scheduled handler converts the timestamp to `Europe/London` and executes ingestion only when the local hour is 13, 14, 15, 16, 17 or 18. This produces six intended checks through both GMT and BST; DST cases are regression-tested.

## API

Public read-only routes:

```text
GET /api/v1/home
GET /api/v1/site-stats
GET /api/v1/predictions/match-result
GET /api/v1/predictions/over-under-25
GET /api/v1/health
```

The APIs expose only the current active dataset. Google Sheet URLs, credentials and D1 administrative functions are not exposed in API responses.

### Manual beta sync

Development/manual ingestion is available at:

```text
POST /api/internal/sync
Authorization: Bearer <SYNC_TOKEN>
```

The endpoint returns `404` when the token is missing/invalid so it does not become a discoverable unauthenticated sync route.

## Frontend behaviour

### Value mode

- default mode;
- sorts descending by source Edge;
- displays all valid predictions, including negative edge;
- uses source classification where present;
- inserts exactly one `NO VALUE` divider before the first `Edge <= 0` result.

### Probability mode

- sorts by the selected model outcome probability;
- Match Result uses AQ with AS/AT/AU;
- O/U uses AR with BK (Over) or BJ (Under);
- foregrounds probability and bookmaker price rather than Edge/classification.

### Filters

Only the V1-required filters exist:

- Date: All + available dates
- Match Result: All / Home / Draw / Away
- O/U: All / Over 2.5 / Under 2.5

All switching, sorting, filtering and fixture expansion is client-side once a market payload has loaded.

### Expanded analysis

Every prediction expands in place and contains:

- model probability bar;
- bookmaker implied-probability bar;
- xGoals;
- xShots;
- xShots on Target;
- an explicit `↑ Close analysis` control at the bottom.

Bookmaker source probabilities remain unchanged. Only the visual bar widths are normalised to 100% because bookmaker margin can make raw implied percentages exceed 100%.

## Accessibility and responsive design

The UI is mobile-first, uses semantic controls, visible keyboard focus, `aria-expanded`, reduced-motion support, text/signs in addition to semantic colour, and a persistent four-item mobile bottom navigation.

Target widths include 320, 360, 375, 390, 430, 768, 1024 and 1280+ pixels. Desktop enhances the mobile information model rather than replacing it with a squeezed table.

## Responsible gambling

The global footer includes:

- 18+
- Gamble responsibly
- Predictions do not guarantee outcomes
- a link to GamCare safer-gambling support

## Local development

Prerequisites: Node.js 22+ and a Cloudflare account for D1/remote deployment.

```bash
npm install
npm run typecheck
npm test
npm run build
```

Local Worker/D1 development can use Wrangler once the D1 binding has a valid database ID.

## One-time beta Cloudflare bootstrap

The repository deliberately contains a placeholder D1 UUID until the real beta database is created.

```bash
npx wrangler login
npx wrangler d1 create mcpredict-beta-db --location=weur
```

Copy the returned `database_id` into `wrangler.jsonc` in place of:

```text
REPLACE_WITH_BETA_D1_DATABASE_ID
```

Then apply the committed migration:

```bash
npm run db:migrate:beta
```

Set the manual-sync secret:

```bash
npx wrangler secret put SYNC_TOKEN
```

Build and deploy:

```bash
npm run build
npm run deploy:beta
```

`wrangler.jsonc` declares `beta.mcpredict.com` as a Worker Custom Domain. Cloudflare can create/manage the corresponding DNS record and certificate when the authenticated account owns the `mcpredict.com` zone. If a conflicting DNS record already exists for `beta.mcpredict.com`, remove or reconcile it before creating the Custom Domain.

After deployment, trigger a genuine source ingestion with a strong token:

```bash
curl -X POST https://beta.mcpredict.com/api/internal/sync \
  -H "Authorization: Bearer <SYNC_TOKEN>"
```

Then verify:

```bash
curl https://beta.mcpredict.com/api/v1/health
curl https://beta.mcpredict.com/api/v1/home
```

## Testing

```bash
npm test
npm run build
```

The committed automated suite covers:

- definitive spreadsheet letters and zero-based indexes;
- the V=Over / W=Under regression;
- Market ID preservation and duplicate handling;
- robust percentage, decimal, Edge, date and spreadsheet-error parsing;
- classification boundaries;
- AQ/AR selected probability behaviour;
- partial market validity;
- bookmaker probability-bar normalisation;
- GMT/BST and clock-change scheduling;
- D1-compatible migration/uniqueness and snapshot-state transitions.

The GitHub Actions workflow runs tests and the production build for the rebuild branch and pull requests.

## Real-data beta QA

Before beta is accepted, perform a genuine ingestion and manually cross-check multiple real Market IDs against the source CSV:

- J/O/P/Q/R/BH/BI shared fixture fields;
- AQ, AS/AT/AU, AK, S/T/U, AI, AG, BD for Match Result;
- AR, BJ/BK, AO, V/W, AM, AH, BG for O/U;
- AV/AW, AX/AY, AZ/BA xMetrics;
- F1 lifetime fixture count;
- homepage Top 3 = highest valid AG and AH values;
- Probability ordering = highest selected AQ/AR probability;
- exactly one NO VALUE divider at the `Edge <= 0` boundary.

Also complete responsive browser QA and Lighthouse checks before declaring beta ready.

## Troubleshooting missing predictions

Check the pipeline in order rather than loosening validation:

1. Did the prediction CSV fetch succeed?
2. How many rows were parsed?
3. How many rows had Market ID?
4. How many shared fixtures were valid?
5. How many Match Result markets were valid?
6. How many O/U markets were valid?
7. Were conflicting duplicate IDs detected?
8. Did canonical hashing succeed?
9. Did the new snapshot fully insert?
10. Was `active_prediction_dataset_id` updated?
11. Does `/api/v1/predictions/...` return the active dataset?
12. Is a frontend filter excluding all rows?

Inspect `sync_runs` and Worker logs for concise diagnostics. Never expose those diagnostics directly to public users.

## Deployment model

### Beta

- Worker: `mcpredict-beta`
- D1: `mcpredict-beta-db`
- Domain: `beta.mcpredict.com`
- Branch: `agent/mcpredict-v1-rebuild`

### Production

Production cutover is intentionally **not** part of the autonomous beta build. After explicit approval, re-run beta tests, create a final backup, configure production Cloudflare resources, merge the approved rebuild, validate root/www/HTTPS/API/data/schedule/mobile and retain rollback.

## V2

Historical Results, P/L, ROI, historical charts and previous prediction tables are deliberately deferred to V2.
