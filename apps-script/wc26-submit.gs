const SPREADSHEET_ID = "PASTE_TARGET_SPREADSHEET_ID_HERE";
const PREDICTIONS_SHEET_NAME = "Predictions";
const DEADLINE_LONDON_ISO = "2026-06-10T23:59:00+01:00";
const REQUIRED_FIXTURE_COUNT = 72;

function doGet(e) {
  return jsonOutput_({
    ok: true,
    service: "MC Predict WC26 submission endpoint",
    message: "Endpoint is live. Use POST to submit predictions."
  });
}

function doPost(e) {
  try {
    const rawBody = (e && e.postData && typeof e.postData.contents === "string") ? e.postData.contents : "{}";
    const payload = JSON.parse(rawBody || "{}");
    const validationError = validatePayload_(payload);
    if (validationError) return jsonOutput_({ ok: false, error: validationError });

    const submissionId = isValidSubmissionId_(payload.submission_id) ? payload.submission_id : generateSubmissionId_();
    const submittedAt = new Date().toISOString();
    const sheet = getOrCreatePredictionsSheet_();

    const rows = payload.predictions.map((p) => [
      submittedAt,
      submissionId,
      payload.name.trim(),
      payload.email.trim().toLowerCase(),
      Number(payload.group_stage_goals_tiebreaker),
      String(p.fixture_id),
      Number(p.sort_order),
      p.match_date,
      p.match_day_label,
      p.kickoff_time || "",
      p.group,
      p.home_team,
      p.home_team_code || "",
      p.away_team,
      p.away_team_code || "",
      Number(p.home_score),
      Number(p.away_score),
      payload.user_agent || "",
      payload.source_page || ""
    ]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    sendConfirmationEmail_(payload.name, payload.email, submissionId, Number(payload.group_stage_goals_tiebreaker), payload.predictions);
    return jsonOutput_({ ok: true, submission_id: submissionId, message: "Predictions submitted successfully." });
  } catch (error) {
    return jsonOutput_({ ok: false, error: "Unexpected server error. Please try again." });
  }
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== "object") return "Missing submission payload.";
  if ((payload.website || "").trim() !== "") return "Submission blocked by spam protection.";
  if (!payload.name || !payload.name.trim()) return "Name is required.";
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return "Valid email is required.";
  if (!Number.isInteger(Number(payload.group_stage_goals_tiebreaker)) || Number(payload.group_stage_goals_tiebreaker) <= 0) return "Tie-breaker prediction is required.";
  if (payload.consent_given !== true) return "Consent checkbox must be confirmed.";
  if (Date.now() > new Date(DEADLINE_LONDON_ISO).getTime()) return "Entries are now closed.";
  if (!Array.isArray(payload.predictions)) return "Predictions array is required.";
  if (payload.predictions.length !== REQUIRED_FIXTURE_COUNT) return "Exactly 72 predictions are required.";

  for (var i = 0; i < payload.predictions.length; i++) {
    var p = payload.predictions[i];
    if (!p.fixture_id || p.sort_order === undefined || !p.match_date || !p.match_day_label || !p.group || !p.home_team || !p.away_team) {
      return "One or more predictions are missing required fixture fields.";
    }
    if (!Number.isInteger(Number(p.home_score)) || !Number.isInteger(Number(p.away_score))) return "Scores must be integers.";
    if (Number(p.home_score) < 0 || Number(p.home_score) > 9 || Number(p.away_score) < 0 || Number(p.away_score) > 9) {
      return "Scores must be between 0 and 9.";
    }
  }
  return "";
}

function getOrCreatePredictionsSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(PREDICTIONS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(PREDICTIONS_SHEET_NAME);

  const baseHeaders = ["submitted_at","submission_id","name","email","group_stage_goals_tiebreaker","fixture_id","sort_order","match_date","match_day_label","kickoff_time","group","home_team","home_team_code","away_team","away_team_code","home_score","away_score","user_agent","source_page"];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(baseHeaders);
  } else {
    const headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), baseHeaders.length));
    const headers = headerRange.getValues()[0];
    const tieBreakerHeaderIndex = headers.indexOf("group_stage_goals_tiebreaker");
    if (tieBreakerHeaderIndex === -1) {
      const fixtureHeaderIndex = headers.indexOf("fixture_id");
      if (fixtureHeaderIndex > -1) {
        sheet.insertColumnBefore(fixtureHeaderIndex + 1);
        sheet.getRange(1, fixtureHeaderIndex + 1).setValue("group_stage_goals_tiebreaker");
      } else {
        sheet.insertColumnAfter(sheet.getLastColumn());
        sheet.getRange(1, sheet.getLastColumn()).setValue("group_stage_goals_tiebreaker");
      }
    }
  }
  return sheet;
}

function sendConfirmationEmail_(name, email, submissionId, tieBreaker, predictions) {
  const byDay = {};
  predictions.forEach(function(p) {
    if (!byDay[p.match_day_label]) byDay[p.match_day_label] = [];
    byDay[p.match_day_label].push(p);
  });

  let body = `Hi ${name},\n\nThanks for submitting your World Cup 2026 predictions.\n\nYour submission ID is: ${submissionId}\n\nTie-breaker prediction:\nTotal group-stage goals: ${tieBreaker}\n\nIf you submit again before Wednesday 10th June 2026 at 11:59pm UK time, your latest valid submission will be used.\n\nYour predictions:\n`;
  Object.keys(byDay).forEach(function(day) {
    body += `\n${day}\n`;
    byDay[day].forEach(function(p) {
      body += `${p.group}\n${p.home_team} ${p.home_score}-${p.away_score} ${p.away_team}\n`;
    });
  });
  body += "\nGood luck,\nMC Predict";

  MailApp.sendEmail(email, "Your MC Predict World Cup 2026 predictions", body);
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function isValidSubmissionId_(v) {
  return typeof v === "string" && /^SUB-[A-Z0-9]{6,12}$/.test(v);
}

function generateSubmissionId_() {
  return "SUB-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}
