import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCachedApi } from "../api";
import {
  PredictionAnalysis,
  PredictionCard,
  predictionFixtureMetaLabel,
  type PredictionCardItem,
  type PredictionMarket
} from "../components/PredictionCard";
import type { HomeResponse } from "../types";

const DESKTOP_HOME_QUERY = "(min-width: 900px)";

function FixtureCount({ value }: { value: number | null }) {
  return <strong className="hero-stat__value">{value === null ? "—" : value.toLocaleString("en-GB")}</strong>;
}

function cardKey(market: PredictionMarket, marketId: string) {
  return `${market}:${marketId}`;
}

function useDesktopHomeLayout() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(DESKTOP_HOME_QUERY).matches
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_HOME_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function PredictionCardSkeleton() {
  return (
    <article className="prediction-card surface home-prediction-card--loading" aria-hidden="true">
      <div className="prediction-card__trigger home-prediction-card__placeholder">
        <div className="prediction-card__fixture-zone">
          <div className="prediction-card__meta">
            <span>League - Sat 15th Aug 15:00</span>
          </div>
          <div className="prediction-card__fixture">
            <strong className="prediction-card__team prediction-card__team--home">Loading</strong>
            <span className="prediction-card__versus">v</span>
            <strong className="prediction-card__team prediction-card__team--away">Loading</strong>
          </div>
        </div>
        <div className="prediction-card__summary">
          <div><small>Prediction</small><strong>Home</strong></div>
          <div><small>Model</small><strong>1.00</strong></div>
          <div><small>Bookmaker</small><strong>1.00</strong></div>
          <div><small>Edge</small><strong>+0.0%</strong></div>
        </div>
        <span className="analysis-toggle">Quick view</span>
      </div>
      <span className="prediction-card__detail-link">View full analysis →</span>
    </article>
  );
}

function TopSectionSkeleton({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <section className="home-section" aria-hidden="true">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="text-link">View all</span>
      </div>
      <div className="prediction-list home-prediction-list">
        {[0, 1, 2].map((index) => <PredictionCardSkeleton key={index} />)}
      </div>
    </section>
  );
}

function TopPredictionSection({
  eyebrow,
  title,
  href,
  items,
  market,
  expandedId,
  isDesktop,
  onToggle
}: {
  eyebrow: string;
  title: string;
  href: string;
  items: PredictionCardItem[];
  market: PredictionMarket;
  expandedId: string | null;
  isDesktop: boolean;
  onToggle: (market: PredictionMarket, marketId: string) => void;
}) {
  const drawerId = `home-${market}-analysis-drawer`;
  const activeItem = items.find((item) => expandedId === cardKey(market, item.marketId)) ?? null;

  return (
    <section className="home-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <Link to={href} className="text-link">View all</Link>
      </div>

      <div className="prediction-list home-prediction-list">
        {items.map((item) => {
          const id = cardKey(market, item.marketId);
          return (
            <PredictionCard
              key={id}
              item={item}
              market={market}
              mode="value"
              expanded={expandedId === id}
              onToggle={() => onToggle(market, item.marketId)}
              renderAnalysis={!isDesktop}
              analysisControlsId={isDesktop ? drawerId : undefined}
            />
          );
        })}
      </div>

      {isDesktop ? (
        <div
          id={drawerId}
          className="home-analysis-drawer surface"
          role="region"
          aria-label={activeItem ? `${activeItem.fixture.homeTeam} v ${activeItem.fixture.awayTeam} analysis` : `${title} analysis`}
          hidden={!activeItem}
        >
          {activeItem ? (
            <>
              <header className="home-analysis-drawer__heading">
                <span>{predictionFixtureMetaLabel(activeItem)}</span>
                <strong>{activeItem.fixture.homeTeam} <em>v</em> {activeItem.fixture.awayTeam}</strong>
              </header>
              <PredictionAnalysis item={activeItem} market={market} />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function HomePage() {
  const { data, loading, error, retry, refreshing } = useCachedApi<HomeResponse>(
    "/api/v1/home",
    "mcpredict:v1:home"
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isDesktop = useDesktopHomeLayout();

  const toggleCard = (market: PredictionMarket, marketId: string) => {
    const nextId = cardKey(market, marketId);
    setExpandedId((current) => current === nextId ? null : nextId);
  };

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
        <>
          <TopSectionSkeleton eyebrow="VALUE · MATCH RESULT" title="Top 3 model edges" />
          <TopSectionSkeleton eyebrow="VALUE · O/U 2.5" title="Top 3 goal-market edges" />
        </>
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
            <TopPredictionSection
              eyebrow="VALUE · MATCH RESULT"
              title="Top 3 model edges"
              href="/match-result?mode=value"
              items={data.topMatchResult}
              market="match"
              expandedId={expandedId}
              isDesktop={isDesktop}
              onToggle={toggleCard}
            />
          ) : null}

          {data.topOverUnder25.length > 0 ? (
            <TopPredictionSection
              eyebrow="VALUE · O/U 2.5"
              title="Top 3 goal-market edges"
              href="/over-under-25?mode=value"
              items={data.topOverUnder25}
              market="ou"
              expandedId={expandedId}
              isDesktop={isDesktop}
              onToggle={toggleCard}
            />
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
          <article className="surface route-card">
            <span className="route-card__tag">VALUE</span>
            <h3>Where does the model disagree with the market?</h3>
            <p>Rank selections by model edge and compare the supplied model price with the bookmaker price.</p>
            <div className="route-card__actions" aria-label="Explore Value mode">
              <Link to="/match-result?mode=value">Match Result →</Link>
              <Link to="/over-under-25?mode=value">O/U 2.5 →</Link>
            </div>
          </article>
          <article className="surface route-card">
            <span className="route-card__tag route-card__tag--neutral">PROBABILITY</span>
            <h3>What does MC Predict think is most likely?</h3>
            <p>Rank the model's selected outcomes by probability without using value or model edge as the ordering.</p>
            <div className="route-card__actions" aria-label="Explore Probability mode">
              <Link to="/match-result?mode=probability">Match Result →</Link>
              <Link to="/over-under-25?mode=probability">O/U 2.5 →</Link>
            </div>
          </article>
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
