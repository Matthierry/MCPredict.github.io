# WC26 Submission Setup

## Fixture CSV
- The WC26 page loads fixtures client-side from this published CSV:
  - https://docs.google.com/spreadsheets/d/e/2PACX-1vQnj0ijqFw0UVhYOounuFrNdreTFovKqTTbYnnVvq_12RRwYxN8atQE3PkQJJSbPaBiM9JQyCSCioiZ/pub?gid=0&single=true&output=csv
- To change fixture source, update `FIXTURES_CSV_URL` in `wc26/scores/index.html`.

## Google Sheet setup
1. Create/open the target Google Sheet.
2. Use tab name: `Predictions` (script auto-creates it if missing).
3. Required headers (auto-created if tab is empty):
   - submitted_at
   - submission_id
   - name
   - email
   - fixture_id
   - sort_order
   - match_date
   - match_day_label
   - kickoff_time
   - group
   - home_team
   - home_team_code
   - away_team
   - away_team_code
   - home_score
   - away_score
   - user_agent
   - source_page

## Apps Script deploy
1. Create a new Apps Script project.
2. Paste `apps-script/wc26-submit.gs` code.
3. Set `SPREADSHEET_ID` to the target spreadsheet ID.
4. Deploy as **Web App**:
   - Execute as: **Me (owner)**
   - Access: **Anyone** or **Anyone with the link**
5. Authorize permissions:
   - Spreadsheet access
   - Email sending (MailApp)
6. Copy deployed Web App URL and paste into `SUBMISSION_ENDPOINT` in `wc26/scores/index.html`.

## Testing submissions
1. Open the deployed Web App URL directly and confirm the `doGet` health-check JSON appears.
2. Open `/wc26/scores` and ensure 72 fixtures load.
3. Fill name, email, consent, and all scores.
4. Submit and verify submitted message + submission ID.
5. Confirm 72 rows appended in `Predictions`.
6. Confirm entrant email contains grouped predictions.

## Implementation notes
- Opening the Web App URL directly should show the `doGet` health check response.
- Real submissions use `POST` from `/wc26/scores`.
- The browser cannot read the Apps Script JSON response when using `no-cors`.
- The confirmation email and `Predictions` tab are the source of truth for successful submissions.


## WC26 URLs
- World Cup menu: `/wc26`
- Prediction form: `/wc26/scores`
- Payment page: `/wc26/payment`
- Rules / FAQs: `/wc26/rules`
- League table: `/wc26/table`
- Hall of fame: `/wc26/halloffame`

## Resubmissions
- Multiple submissions are allowed.
- Each submission writes 72 new rows with its own `submission_id`.
- Later scoring should select latest valid submission before deadline per email address.
