# MC Predict V1 — Beta deployment

Beta builds deploy only from branches under `agent/`. They must not replace the production `main` branch before explicit beta approval.

## Automated beta workflow

`.github/workflows/v1-beta-deploy.yml` performs the beta bootstrap when the repository has these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The workflow:

1. runs the automated test suite;
2. builds the application;
3. locates or creates `mcpredict-beta-db` in Cloudflare D1;
4. applies committed D1 migrations;
5. deploys the `mcpredict-beta` Worker and static assets;
6. configures a generated protected `SYNC_TOKEN`;
7. triggers a genuine Google CSV ingestion;
8. smoke-tests the health and homepage APIs on `beta.mcpredict.com`.
9. runs deployed responsive, interaction and Lighthouse checks, including direct fixture-analysis links.

If either Cloudflare credential is absent, the deployment is safely skipped and production remains unchanged.

## Production safety

Do not merge the rebuild PR or repoint `mcpredict.com` / `www.mcpredict.com` until the beta has passed the specification's real-data, responsive, accessibility and production-readiness checks and the owner has explicitly approved the cutover.
