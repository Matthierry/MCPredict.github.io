import { Link } from "react-router-dom";
import { useCachedApi } from "../api";
import { TopSelectionCard } from "../components/TopSelectionCard";
import type { HomeResponse } from "../types";

function FixtureCount({ value }: { value: number | null }) {
  return <strong className="hero-stat__value">{value === null ? "—" : value.toLocaleString("en-GB")}</strong>;
}

export function HomePage() {
  const { data, loading, error, retry, refreshing } = useCachedApi<HomeResponse>(
    "/api/v1/home",
    "mcpredict:v1:home"
  );

  return (
    <div className="page page--home">
      <section className="home-hero surface surface--accent">
        <div className="eyebrow">MC PREDICT</div>
        <h1>Predicting Football with Data</h1>
        <p className="home-hero__lead">
          Independent model probabilities, compared clearly with bookmaker pricing.
        </p>
        <div className="hero-stat" aria-live="polite">
          <FixtureCount value={data?.fixturesProcessed ?? null} />
          <span>Fixtures analysed by the MC Predict model</span>
        </div>
        {refreshing ? <span className="quiet-status">Refreshing model data…</span> : null}
      </section>

      {loading && !data ? (
        <section className="surface status-panel" aria-live="polite">
          <div className="loading-line" />
          <div className="loading-line loading-line--short" />
        </section>
      ) : null}

      {error && !data ? (
        <section className="surface status-panel">
          <strong>Predictions could not be loaded right now.</strong>
          <button className="button button--secondary" type="button" onClick={retry}>Try again</button>
        </section>
      ) : null}

      {data?.hasPredictions ? (
        <>
          {data.topMatchResult.length > 0 ? (
            <section className="home-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">VALUE · MATCH RESULT</span>
                  <h2>Top 3 model edges</h2>
                </div>
                <Link to="/match-result" className="text-link">View all</Link>
              </div>
              <div className="top-selection-grid">
                {data.topMatchResult.map((item) => <TopSelectionCard key={item.marketId} item={item} />)}
              </div>
            </section>
          ) : null}

          {data.topOverUnder25.length > 0 ? (
            <section className="home-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">VALUE · O/U 2.5</span>
                  <h2>Top 3 goal-market edges</h2>
                </div>
                <Link to="/over-under-25" className="text-link">View all</Link>
              </div>
              <div className="top-selection-grid">
                {data.topOverUnder25.map((item) => <TopSelectionCard key={item.marketId} item={item} />)}
              </div>
            </section>
          ) : null}
        </>
      ) : data ? (
        <p className="availability-note">No new predictions are currently available. New model data will appear here when published.</p>
      ) : null}

      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TWO WAYS TO READ THE MODEL</span>
            <h2>Value or probability</h2>
          </div>
        </div>
        <div className="mode-route-grid">
          <Link to="/match-result" className="surface route-card">
            <span className="route-card__tag">VALUE</span>
            <h3>Where does the model disagree with the market?</h3>
            <p>Compare model price with bookmaker price and rank every selection by model edge.</p>
            <strong>Explore Match Result →</strong>
          </Link>
          <Link to="/over-under-25" className="surface route-card">
            <span className="route-card__tag route-card__tag--neutral">PROBABILITY</span>
            <h3>What does MC Predict think is most likely?</h3>
            <p>Switch to Probability mode to rank outcomes by the model's estimated chance.</p>
            <strong>Explore O/U 2.5 →</strong>
          </Link>
        </div>
      </section>

      <section className="surface explainer">
        <span className="eyebrow">HOW MC PREDICT WORKS</span>
        <h2>Model first. Market comparison second.</h2>
        <p>
          MC Predict analyses football data to calculate probabilities independently of bookmaker prices.
          Those probabilities can then be compared with market prices to identify potential pricing discrepancies.
        </p>
        <Link className="text-link" to="/faqs">Read the FAQs →</Link>
      </section>
    </div>
  );
}
