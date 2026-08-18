type ProbabilityOutcome = {
  key: string;
  label: string;
  model: number | null;
  bookmaker: number | null;
};

function clampProbability(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatProbability(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function ProbabilityComparison({
  title,
  outcomes
}: {
  title: string;
  outcomes: ProbabilityOutcome[];
}) {
  return (
    <section className="probability-comparison" aria-label={title}>
      <h3 className="probability-comparison__title">{title}</h3>
      <div className="probability-comparison__legend" aria-label="Probability comparison legend">
        <span><i className="probability-key probability-key--model" aria-hidden="true" />Model</span>
        <span><i className="probability-key probability-key--bookmaker" aria-hidden="true" />Bookmaker (pre-overround)</span>
      </div>

      <div className="probability-comparison__rows">
        {outcomes.map((outcome) => {
          const modelWidth = clampProbability(outcome.model) * 100;
          const bookmakerWidth = clampProbability(outcome.bookmaker) * 100;
          const accessible = `${outcome.label}, model probability ${formatProbability(outcome.model)}, bookmaker implied probability ${formatProbability(outcome.bookmaker)}`;

          return (
            <div className="probability-outcome" key={outcome.key} aria-label={accessible}>
              <div className="probability-outcome__label">{outcome.label}</div>
              <div className="probability-outcome__pair">
                <div className="probability-outcome__line">
                  <div className="probability-track" aria-hidden="true">
                    {outcome.model === null ? null : (
                      <span className="probability-fill probability-fill--model" style={{ width: `${modelWidth}%` }} />
                    )}
                  </div>
                  <strong>{formatProbability(outcome.model)}</strong>
                </div>
                <div className="probability-outcome__line">
                  <div className="probability-track" aria-hidden="true">
                    {outcome.bookmaker === null ? null : (
                      <span className="probability-fill probability-fill--bookmaker" style={{ width: `${bookmakerWidth}%` }} />
                    )}
                  </div>
                  <strong>{formatProbability(outcome.bookmaker)}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
