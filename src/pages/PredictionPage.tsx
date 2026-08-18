import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCachedApi } from "../api";
import { formatDateLabel, formatEdge, formatOdds, formatProbability } from "../format";
import { MetricCompare } from "../components/MetricCompare";
import { ProbabilityBar } from "../components/ProbabilityBar";
import type { MatchPrediction, Mode, OuPrediction, PredictionResponse } from "../types";

type Market = "match" | "ou";
type Prediction = MatchPrediction | OuPrediction;

const MODE_KEY = "mcpredict:v1:prediction-mode";

function initialMode(): Mode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === "probability" ? "probability" : "value";
  } catch {
    return "value";
  }
}

function valueTone(edge: number) {
  if (edge > 0) return "value-positive";
  if (edge < 0) return "value-negative";
  return "value-neutral";
}

function countryLeague(item: Prediction) {
  return [item.fixture.country, item.fixture.league].filter(Boolean).join(" · ") || "Football";
}

function MatchAnalysis({ item }: { item: MatchPrediction }) {
  return (
    <div className="analysis-body">
      <ProbabilityBar title="MODEL · 1X2 PROBABILITY" segments={[
        { key: "home", label: "Home", value: item.probabilities.model.home },
        { key: "draw", label: "Draw", value: item.probabilities.model.draw },
        { key: "away", label: "Away", value: item.probabilities.model.away }
      ]} />
      <ProbabilityBar title="BOOKMAKER · 1X2" rawImplied segments={[
        { key: "home", label: "Home", value: item.probabilities.bookmaker.home },
        { key: "draw", label: "Draw", value: item.probabilities.bookmaker.draw },
        { key: "away", label: "Away", value: item.probabilities.bookmaker.away }
      ]} />
      <Metrics item={item} />
    </div>
  );
}

function OuAnalysis({ item }: { item: OuPrediction }) {
  return (
    <div className="analysis-body">
      <ProbabilityBar title="MODEL · O/U 2.5 PROBABILITY" segments={[
        { key: "over", label: "Over", value: item.probabilities.model.over },
        { key: "under", label: "Under", value: item.probabilities.model.under }
      ]} />
      <ProbabilityBar title="BOOKMAKER · O/U 2.5" rawImplied segments={[
        { key: "over", label: "Over", value: item.probabilities.bookmaker.over },
        { key: "under", label: "Under", value: item.probabilities.bookmaker.under }
      ]} />
      <Metrics item={item} />
    </div>
  );
}

function Metrics({ item }: { item: Prediction }) {
  return (
    <section className="analysis-metrics" aria-label="Expected performance metrics">
      <MetricCompare label="EXPECTED GOALS" homeTeam={item.fixture.homeTeam} awayTeam={item.fixture.awayTeam} homeValue={item.analysis.homeXGoals} awayValue={item.analysis.awayXGoals} digits={2} />
      <MetricCompare label="EXPECTED SHOTS" homeTeam={item.fixture.homeTeam} awayTeam={item.fixture.awayTeam} homeValue={item.analysis.homeXShots} awayValue={item.analysis.awayXShots} digits={1} />
      <MetricCompare label="SHOTS ON TARGET" homeTeam={item.fixture.homeTeam} awayTeam={item.fixture.awayTeam} homeValue={item.analysis.homeXShotsOnTarget} awayValue={item.analysis.awayXShotsOnTarget} digits={1} />
    </section>
  );
}

function PredictionCard({ item, mode, expanded, onToggle, market }: {
  item: Prediction;
  mode: Mode;
  expanded: boolean;
  onToggle: () => void;
  market: Market;
}) {
  const panelId = `analysis-${market}-${item.marketId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <article className={`prediction-card surface${expanded ? " is-expanded" : ""}`}>
      <button
        className="prediction-card__trigger"
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="prediction-card__meta">
          <span>{countryLeague(item)}</span>
          <span>{item.fixture.kickoff || ""}</span>
        </div>
        <div className="prediction-card__fixture">
          <div className="prediction-card__teams">
            <strong>{item.fixture.homeTeam}</strong>
            <strong>{item.fixture.awayTeam}</strong>
          </div>
          <div className="prediction-card__selection">
            <small>MODEL</small>
            <strong>{item.prediction.selection}</strong>
          </div>
        </div>

        {mode === "value" ? (
          <div className="prediction-card__numbers prediction-card__numbers--value">
            <div><small>Model</small><strong>{formatOdds(item.prediction.modelPrice)}</strong></div>
            <div><small>Bookmaker</small><strong>{formatOdds(item.prediction.bookmakerPrice)}</strong></div>
            <div><small>Edge</small><strong className={valueTone(item.prediction.edge)}>{formatEdge(item.prediction.edge)}</strong></div>
          </div>
        ) : (
          <div className="prediction-card__numbers prediction-card__numbers--probability">
            <div><small>Model probability</small><strong className="probability-hero">{formatProbability(item.prediction.probability)}</strong></div>
            <div><small>Bookmaker price</small><strong>{formatOdds(item.prediction.bookmakerPrice)}</strong></div>
          </div>
        )}

        <div className="prediction-card__foot">
          {mode === "value" ? <span className="classification-chip">{item.prediction.classification}</span> : <span>Most-likely outcome view</span>}
          <span className="expand-label">{expanded ? "Analysis open" : "View analysis"} <b aria-hidden="true">⌄</b></span>
        </div>
      </button>

      <div id={panelId} className="prediction-card__expand" aria-hidden={!expanded}>
        {expanded ? (
          <div className="prediction-card__expand-inner">
            {market === "match" ? <MatchAnalysis item={item as MatchPrediction} /> : <OuAnalysis item={item as OuPrediction} />}
            <button className="close-analysis" type="button" onClick={onToggle}>↑ Close analysis</button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function PredictionPage({ market }: { market: Market }) {
  const isMatch = market === "match";
  const endpoint = isMatch ? "/api/v1/predictions/match-result" : "/api/v1/predictions/over-under-25";
  const cacheKey = isMatch ? "mcpredict:v1:match" : "mcpredict:v1:ou";
  const title = isMatch ? "Match Result Predictions" : "Over/Under 2.5 Predictions";
  const description = isMatch
    ? "Compare MC Predict's Home, Draw and Away assessment with bookmaker pricing."
    : "Compare MC Predict's Over 2.5 and Under 2.5 assessment with bookmaker pricing.";

  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const { data, loading, error, retry, refreshing } = useCachedApi<PredictionResponse<Prediction>>(endpoint, cacheKey);
  const [mode, setMode] = useState<Mode>(() => requestedMode === "probability" ? "probability" : requestedMode === "value" ? "value" : initialMode());
  const [date, setDate] = useState("all");
  const [selection, setSelection] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedMode === "value" || requestedMode === "probability") {
      setMode(requestedMode);
    }
  }, [requestedMode]);

  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* session persistence is optional */ }
    setExpandedId(null);
  }, [mode]);

  useEffect(() => {
    setDate("all");
    setSelection("all");
    setExpandedId(null);
  }, [market]);

  const dates = useMemo(() => Array.from(new Set((data?.data ?? []).map((item) => item.fixture.date))).sort(), [data]);

  const filtered = useMemo(() => {
    const rows = (data?.data ?? []).filter((item) => {
      if (date !== "all" && item.fixture.date !== date) return false;
      if (selection !== "all" && item.prediction.selection !== selection) return false;
      return true;
    });
    return rows.sort((a, b) => mode === "value"
      ? b.prediction.edge - a.prediction.edge
      : b.prediction.probability - a.prediction.probability);
  }, [data, date, selection, mode]);

  const noValueIndex = mode === "value" ? filtered.findIndex((item) => item.prediction.edge <= 0) : -1;
  const selectionOptions = isMatch ? ["Home", "Draw", "Away"] : ["Over 2.5", "Under 2.5"];

  return (
    <div className="page">
      <header className="page-heading prediction-heading">
        <div>
          <span className="eyebrow">CURRENT MODEL OUTPUT</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {refreshing ? <span className="quiet-status">Refreshing…</span> : null}
      </header>

      <section className="control-stack" aria-label="Prediction controls">
        <div className="segmented-control" aria-label="Display mode">
          <button type="button" className={mode === "value" ? "is-active" : ""} onClick={() => setMode("value")} aria-pressed={mode === "value"}>VALUE</button>
          <button type="button" className={mode === "probability" ? "is-active" : ""} onClick={() => setMode("probability")} aria-pressed={mode === "probability"}>PROBABILITY</button>
        </div>
        <div className="filter-row">
          <label>
            <span>Date</span>
            <select aria-label="Date" value={date} onChange={(event) => { setDate(event.target.value); setExpandedId(null); }}>
              <option value="all">All dates</option>
              {dates.map((availableDate) => <option key={availableDate} value={availableDate}>{formatDateLabel(availableDate)}</option>)}
            </select>
          </label>
          <label>
            <span>Prediction</span>
            <select aria-label="Prediction" value={selection} onChange={(event) => { setSelection(event.target.value); setExpandedId(null); }}>
              <option value="all">All</option>
              {selectionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </section>

      {loading && !data ? (
        <div className="prediction-list" aria-live="polite">
          {[0, 1, 2].map((id) => <div className="surface prediction-skeleton" key={id}><div className="loading-line"/><div className="loading-line loading-line--short"/></div>)}
        </div>
      ) : null}

      {error && !data ? (
        <section className="surface status-panel">
          <strong>Predictions could not be loaded right now.</strong>
          <button className="button button--secondary" type="button" onClick={retry}>Try again</button>
        </section>
      ) : null}

      {data && filtered.length === 0 ? (
        <section className="surface filter-empty">
          <strong>{selection === "all" ? "No predictions" : `No ${selection} predictions`} are available{date === "all" ? " right now." : " for this date."}</strong>
          <p>Change the filters to see other available model selections.</p>
        </section>
      ) : null}

      {filtered.length > 0 ? (
        <div className="prediction-list">
          {filtered.map((item, index) => (
            <div key={item.marketId}>
              {mode === "value" && index === noValueIndex ? (
                <div className="no-value-divider" role="separator">
                  <span>NO VALUE</span>
                  <p>Predictions below this line have been assessed by the model but do not currently offer positive model edge.</p>
                </div>
              ) : null}
              <PredictionCard
                item={item}
                mode={mode}
                market={market}
                expanded={expandedId === item.marketId}
                onToggle={() => setExpandedId((current) => current === item.marketId ? null : item.marketId)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
