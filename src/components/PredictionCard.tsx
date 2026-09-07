import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { fixtureAnalysisPath, type PredictionMarket } from "../../shared/fixture-routes";
import { formatEdge, formatFixtureMetaDate, formatOdds, formatProbability } from "../format";
import type { MatchPrediction, Mode, OuPrediction } from "../types";
import { ChevronIcon } from "./icons";
import { MetricCompare } from "./MetricCompare";
import { ProbabilityComparison } from "./ProbabilityComparison";

export type { PredictionMarket } from "../../shared/fixture-routes";
export type PredictionCardItem = MatchPrediction | OuPrediction;

type Prediction = PredictionCardItem;

function valueTone(edge: number) {
  if (edge > 0) return "value-positive";
  if (edge < 0) return "value-negative";
  return "value-neutral";
}

function fixtureCompetition(item: Prediction) {
  return item.fixture.league || item.fixture.country || "Football";
}

export function predictionFixtureMetaLabel(item: Prediction) {
  const competition = fixtureCompetition(item);
  const fixtureDate = formatFixtureMetaDate(item.fixture.date);
  const kickoff = item.fixture.kickoff?.trim();
  return `${competition} - ${fixtureDate}${kickoff ? ` ${kickoff}` : ""}`;
}

function teamColourStyle(item: Prediction): CSSProperties {
  return {
    "--home-primary": item.fixture.homeColours?.primary ?? "transparent",
    "--home-secondary": item.fixture.homeColours?.secondary ?? item.fixture.homeColours?.primary ?? "transparent",
    "--away-primary": item.fixture.awayColours?.primary ?? "transparent",
    "--away-secondary": item.fixture.awayColours?.secondary ?? item.fixture.awayColours?.primary ?? "transparent"
  } as CSSProperties;
}

function TeamName({ name, side }: { name: string; side: "home" | "away" }) {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const isSingleWord = words.length <= 1;
  const classes = [
    "prediction-card__team",
    `prediction-card__team--${side}`,
    isSingleWord ? "prediction-card__team--single-word" : "prediction-card__team--multi-word"
  ].join(" ");

  return (
    <strong className={classes} title={trimmed}>
      {isSingleWord
        ? trimmed
        : words.map((word, index) => (
          <span key={`${word}-${index}`}>
            <span className="prediction-card__team-word">{word}</span>
            {index < words.length - 1 ? " " : null}
          </span>
        ))}
    </strong>
  );
}

function Metrics({ item }: { item: Prediction }) {
  return (
    <section className="analysis-metrics" aria-label="Forecasted performance metrics">
      <MetricCompare kind="goals" label="FORECASTED GOALS" homeTeam={item.fixture.homeTeam} awayTeam={item.fixture.awayTeam} homeValue={item.analysis.homeXGoals} awayValue={item.analysis.awayXGoals} digits={2} />
      <MetricCompare kind="shots" label="FORECASTED SHOTS" homeTeam={item.fixture.homeTeam} awayTeam={item.fixture.awayTeam} homeValue={item.analysis.homeXShots} awayValue={item.analysis.awayXShots} digits={1} />
      <MetricCompare kind="target" label="FORECASTED SHOTS ON TARGET" homeTeam={item.fixture.homeTeam} awayTeam={item.fixture.awayTeam} homeValue={item.analysis.homeXShotsOnTarget} awayValue={item.analysis.awayXShotsOnTarget} digits={1} />
    </section>
  );
}

function MatchAnalysis({ item }: { item: MatchPrediction }) {
  return (
    <div className="analysis-body">
      <ProbabilityComparison
        title="1X2 PROBABILITY COMPARISON"
        outcomes={[
          { key: "home", label: "Home", model: item.probabilities.model.home, bookmaker: item.probabilities.bookmaker.home },
          { key: "draw", label: "Draw", model: item.probabilities.model.draw, bookmaker: item.probabilities.bookmaker.draw },
          { key: "away", label: "Away", model: item.probabilities.model.away, bookmaker: item.probabilities.bookmaker.away }
        ]}
      />
      <Metrics item={item} />
    </div>
  );
}

function OuAnalysis({ item }: { item: OuPrediction }) {
  return (
    <div className="analysis-body">
      <ProbabilityComparison
        title="O/U 2.5 PROBABILITY COMPARISON"
        outcomes={[
          { key: "over", label: "Over", model: item.probabilities.model.over, bookmaker: item.probabilities.bookmaker.over },
          { key: "under", label: "Under", model: item.probabilities.model.under, bookmaker: item.probabilities.bookmaker.under }
        ]}
      />
      <Metrics item={item} />
    </div>
  );
}

export function PredictionAnalysis({ item, market }: { item: Prediction; market: PredictionMarket }) {
  return market === "match"
    ? <MatchAnalysis item={item as MatchPrediction} />
    : <OuAnalysis item={item as OuPrediction} />;
}

export function PredictionCard({ item, expanded, onToggle, market, mode, renderAnalysis = true, analysisControlsId }: {
  item: Prediction;
  expanded: boolean;
  onToggle: () => void;
  market: PredictionMarket;
  mode: Mode;
  renderAnalysis?: boolean;
  analysisControlsId?: string;
}) {
  const defaultPanelId = `analysis-${market}-${item.marketId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const panelId = analysisControlsId ?? defaultPanelId;
  const isProbabilityMode = mode === "probability";

  return (
    <article
      className={`prediction-card surface${expanded ? " is-expanded" : ""}`}
      style={teamColourStyle(item)}
    >
      <button
        className="prediction-card__trigger"
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="prediction-card__fixture-zone">
          <div className="prediction-card__meta">
            <span>{predictionFixtureMetaLabel(item)}</span>
          </div>

          <div className="prediction-card__fixture">
            <TeamName name={item.fixture.homeTeam} side="home" />
            <span className="prediction-card__versus">v</span>
            <TeamName name={item.fixture.awayTeam} side="away" />
          </div>
        </div>

        <div className="prediction-card__summary">
          <div>
            <small>Prediction</small>
            <strong className="prediction-card__prediction">{item.prediction.selection}</strong>
          </div>
          <div>
            <small>Model</small>
            <strong>{formatOdds(item.prediction.modelPrice)}</strong>
          </div>
          <div>
            <small>Bookmaker</small>
            <strong>{formatOdds(item.prediction.bookmakerPrice)}</strong>
          </div>
          <div>
            <small>{isProbabilityMode ? "Probability" : "Edge"}</small>
            <strong className={isProbabilityMode ? "prediction-card__probability" : valueTone(item.prediction.edge)}>
              {isProbabilityMode ? formatProbability(item.prediction.probability) : formatEdge(item.prediction.edge)}
            </strong>
          </div>
        </div>

        <span className="analysis-toggle">
          {expanded ? "Close quick view" : "Quick view"}
          <ChevronIcon className={`analysis-toggle__icon${expanded ? " is-open" : ""}`} />
        </span>
      </button>

      <Link className="prediction-card__detail-link" to={fixtureAnalysisPath(market, item)}>
        View full analysis <span aria-hidden="true">→</span>
      </Link>

      {renderAnalysis ? (
        <div id={panelId} className="prediction-card__expand" aria-hidden={!expanded}>
          {expanded ? (
            <div className="prediction-card__expand-inner">
              <PredictionAnalysis item={item} market={market} />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
