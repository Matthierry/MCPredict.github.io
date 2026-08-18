import type { MatchPrediction, OuPrediction } from "../types";
import { formatEdge, formatOdds } from "../format";

export function TopSelectionCard({ item }: { item: MatchPrediction | OuPrediction }) {
  return (
    <article className="top-selection-card">
      <div className="top-selection-card__meta">
        <span>{[item.fixture.country, item.fixture.league].filter(Boolean).join(" · ") || "Football"}</span>
        <span>{item.fixture.kickoff || ""}</span>
      </div>
      <div className="top-selection-card__fixture">
        <strong>{item.fixture.homeTeam}</strong>
        <span>v</span>
        <strong>{item.fixture.awayTeam}</strong>
      </div>
      <div className="top-selection-card__result">
        <div>
          <small>Model</small>
          <strong>{item.prediction.selection}</strong>
        </div>
        <div>
          <small>Bookmaker</small>
          <strong>{formatOdds(item.prediction.bookmakerPrice)}</strong>
        </div>
        <div>
          <small>Edge</small>
          <strong className={item.prediction.edge > 0 ? "value-positive" : "value-negative"}>
            {formatEdge(item.prediction.edge)}
          </strong>
        </div>
      </div>
    </article>
  );
}
