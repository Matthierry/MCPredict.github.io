import type { ComponentType } from "react";
import { ExpectedGoalsIcon, ExpectedShotsIcon, ShotsOnTargetIcon } from "./icons";

function metric(value: number | null, digits: number) {
  return value === null ? "—" : value.toFixed(digits).replace(/\.0$/, "");
}

type MetricKind = "goals" | "shots" | "target";
type IconProps = { className?: string };

const METRIC_ICONS: Record<MetricKind, ComponentType<IconProps>> = {
  goals: ExpectedGoalsIcon,
  shots: ExpectedShotsIcon,
  target: ShotsOnTargetIcon
};

export function MetricCompare({
  kind,
  label,
  homeTeam,
  awayTeam,
  homeValue,
  awayValue,
  digits
}: {
  kind: MetricKind;
  label: string;
  homeTeam: string;
  awayTeam: string;
  homeValue: number | null;
  awayValue: number | null;
  digits: number;
}) {
  const Icon = METRIC_ICONS[kind];

  return (
    <div className="metric-compare">
      <div className="metric-compare__icon" aria-hidden="true"><Icon /></div>
      <div className="metric-compare__content">
        <span className="metric-compare__label">{label}</span>
        <div className="metric-compare__teams">
          <div className="metric-compare__team metric-compare__team--home">
            <small>{homeTeam}</small>
            <strong>{metric(homeValue, digits)}</strong>
          </div>
          <span className="metric-compare__vs">vs</span>
          <div className="metric-compare__team metric-compare__team--away">
            <strong>{metric(awayValue, digits)}</strong>
            <small>{awayTeam}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
