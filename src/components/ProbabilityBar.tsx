interface Segment {
  key: string;
  label: string;
  value: number;
}

export function normalizeSegments(segments: Segment[]): Array<Segment & { width: number }> {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  if (total <= 0) return segments.map((segment) => ({ ...segment, width: 0 }));
  return segments.map((segment) => ({ ...segment, width: Math.max(0, segment.value) / total }));
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function ProbabilityBar({
  title,
  segments,
  rawImplied = false
}: {
  title: string;
  segments: Segment[];
  rawImplied?: boolean;
}) {
  const normalized = normalizeSegments(segments);

  return (
    <section className="probability-panel" aria-label={title}>
      <div className="probability-panel__head">
        <strong>{title}</strong>
        {rawImplied ? <small>Market implied probabilities · bar normalised</small> : null}
      </div>
      <div className={`probability-labels probability-labels--${segments.length}`}>
        {segments.map((segment) => (
          <div key={segment.key}>
            <span>{segment.label}</span>
            <strong>{pct(segment.value)}</strong>
          </div>
        ))}
      </div>
      <div className="probability-bar" aria-hidden="true">
        {normalized.map((segment, index) => (
          <span
            key={segment.key}
            className={`probability-bar__segment probability-bar__segment--${index + 1}`}
            style={{ width: `${segment.width * 100}%` }}
          />
        ))}
      </div>
    </section>
  );
}
