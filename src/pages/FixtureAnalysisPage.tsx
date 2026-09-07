import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCachedApi } from "../api";
import {
  PredictionAnalysis,
  predictionFixtureMetaLabel,
  type PredictionCardItem,
  type PredictionMarket
} from "../components/PredictionCard";
import { fixtureAnalysisPath, fixtureApiPath, fixtureSlug } from "../../shared/fixture-routes";
import { formatEdge, formatOdds, formatProbability } from "../format";
import type { PredictionDetailResponse } from "../types";

function valueTone(edge: number) {
  if (edge > 0) return "value-positive";
  if (edge < 0) return "value-negative";
  return "value-neutral";
}

function marketDetails(market: PredictionMarket) {
  return market === "match"
    ? { label: "MATCH RESULT ANALYSIS", listPath: "/match-result", listLabel: "Match Result predictions" }
    : { label: "O/U 2.5 ANALYSIS", listPath: "/over-under-25", listLabel: "O/U 2.5 predictions" };
}

export function FixtureAnalysisPage({ market }: { market: PredictionMarket }) {
  const { marketId = "", slug } = useParams();
  const navigate = useNavigate();
  const details = marketDetails(market);
  const endpoint = fixtureApiPath(market, marketId);
  const cacheKey = `mcpredict:v1:fixture:${market}:${marketId}`;
  const { data, loading, error, retry, refreshing } = useCachedApi<PredictionDetailResponse<PredictionCardItem>>(
    endpoint,
    cacheKey
  );
  const item = data?.data ?? null;

  useEffect(() => {
    if (!item || slug === fixtureSlug(item)) return;
    navigate(fixtureAnalysisPath(market, item), { replace: true });
  }, [item, market, navigate, slug]);

  useEffect(() => {
    if (!item) return;
    const previousTitle = document.title;
    const title = `${item.fixture.homeTeam} v ${item.fixture.awayTeam} | MC Predict`;
    const metaDescription = `${details.label}: independent model probabilities, expected goals and bookmaker comparison for ${item.fixture.homeTeam} v ${item.fixture.awayTeam}.`;
    const canonicalUrl = new URL(fixtureAnalysisPath(market, item), window.location.origin).href;
    const robots = window.location.hostname === "beta.mcpredict.com" ? "noindex,nofollow" : "index,follow";
    const metadata = [
      { selector: 'meta[name="robots"]', attribute: "content", value: robots },
      { selector: 'meta[name="description"]', attribute: "content", value: metaDescription },
      { selector: 'meta[property="og:title"]', attribute: "content", value: title },
      { selector: 'meta[property="og:description"]', attribute: "content", value: metaDescription },
      { selector: 'meta[property="og:url"]', attribute: "content", value: canonicalUrl },
      { selector: 'meta[name="twitter:title"]', attribute: "content", value: title },
      { selector: 'meta[name="twitter:description"]', attribute: "content", value: metaDescription },
      { selector: 'link[rel="canonical"]', attribute: "href", value: canonicalUrl }
    ].map(({ selector, attribute, value }) => {
      const element = document.querySelector(selector);
      const previous = element?.getAttribute(attribute) ?? null;
      element?.setAttribute(attribute, value);
      return { element, attribute, previous };
    });

    document.title = title;
    return () => {
      document.title = previousTitle;
      for (const { element, attribute, previous } of metadata) {
        if (!element) continue;
        if (previous === null) element.removeAttribute(attribute);
        else element.setAttribute(attribute, previous);
      }
    };
  }, [details.label, item, market]);

  return (
    <div className="page page--fixture-analysis">
      <Link className="fixture-analysis__back" to={details.listPath}>← All {details.listLabel}</Link>

      {loading && !item ? (
        <section className="surface fixture-analysis__loading" aria-live="polite">
          <div className="loading-line" />
          <div className="loading-line loading-line--short" />
        </section>
      ) : null}

      {error && !item ? (
        <section className="surface status-panel">
          <strong>This fixture analysis is not currently available.</strong>
          <p>The link may refer to a fixture that is no longer in the current model output.</p>
          <div className="fixture-analysis__error-actions">
            <button className="button button--secondary" type="button" onClick={retry}>Try again</button>
            <Link className="button button--secondary fixture-analysis__button-link" to={details.listPath}>View current predictions</Link>
          </div>
        </section>
      ) : null}

      {item ? (
        <>
          <header className="surface surface--accent fixture-analysis__hero">
            <div className="fixture-analysis__heading-row">
              <div>
                <span className="eyebrow">{details.label}</span>
                <h1>{item.fixture.homeTeam} <span>v</span> {item.fixture.awayTeam}</h1>
                <p>{predictionFixtureMetaLabel(item)}</p>
              </div>
              {refreshing ? <span className="quiet-status">Refreshing…</span> : null}
            </div>

            <div className="fixture-analysis__summary" aria-label="Prediction summary">
              <div>
                <small>Prediction</small>
                <strong className="fixture-analysis__selection">{item.prediction.selection}</strong>
              </div>
              <div>
                <small>Probability</small>
                <strong>{formatProbability(item.prediction.probability)}</strong>
              </div>
              <div>
                <small>Model price</small>
                <strong>{formatOdds(item.prediction.modelPrice)}</strong>
              </div>
              <div>
                <small>Bookmaker</small>
                <strong>{formatOdds(item.prediction.bookmakerPrice)}</strong>
              </div>
              <div>
                <small>Model edge</small>
                <strong className={valueTone(item.prediction.edge)}>{formatEdge(item.prediction.edge)}</strong>
              </div>
            </div>
          </header>

          <section className="surface fixture-analysis__panel" aria-label="Full fixture analysis">
            <header>
              <span className="eyebrow">MODEL OUTPUT</span>
              <h2>Probability and performance analysis</h2>
              <p>The model is calculated independently. Bookmaker figures are shown afterwards for comparison.</p>
            </header>
            <PredictionAnalysis item={item} market={market} />
          </section>

          <p className="fixture-analysis__disclaimer">
            Model estimates are informational and do not guarantee outcomes. 18+ · Gamble responsibly.
          </p>
        </>
      ) : null}
    </div>
  );
}
