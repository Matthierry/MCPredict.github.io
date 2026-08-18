function metric(value: number | null, digits: number) {
  return value === null ? "—" : value.toFixed(digits).replace(/\.0$/, "");
}

export function MetricCompare({
  label,
  homeTeam,
  awayTeam,
  homeValue,
  awayValue,
  digits
}: {
  label: string;
  homeTeam: string;
  awayTeam: string;
  homeValue: number | null;
  awayValue: number | null;
  digits: number;
}) {
  return (
    <div className="metric-compare">
      <span className="metric-compare__label">{label}</span>
      <div className="metric-compare__teams">
        <div>
          <small>{homeTeam}</small>
          <strong>{metric(homeValue, digits)}</strong>
        </div>
        <span className="metric-compare__vs">vs</span>
        <div>
          <small>{awayTeam}</small>
          <strong>{metric(awayValue, digits)}</strong>
        </div>
      </div>
    </div>
  );
}
