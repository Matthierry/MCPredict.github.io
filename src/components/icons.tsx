import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return <Svg className={className}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/></Svg>;
}

export function ResultIcon({ className }: IconProps) {
  return <Svg className={className}><path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-7"/><path d="M3 19h18"/></Svg>;
}

export function GoalsIcon({ className }: IconProps) {
  return <Svg className={className}><circle cx="12" cy="12" r="8"/><path d="m12 8 2.7 2-1 3.2H10.3l-1-3.2L12 8Z"/><path d="m5.3 9 4 1"/><path d="m18.7 9-4 1"/><path d="m7.2 17 3.1-3.8"/><path d="m16.8 17-3.1-3.8"/></Svg>;
}

export function FaqIcon({ className }: IconProps) {
  return <Svg className={className}><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 1.8-2.5 2-2.5 4"/><path d="M12 17h.01"/></Svg>;
}

export function ChevronIcon({ className }: IconProps) {
  return <Svg className={className}><path d="m8 10 4 4 4-4"/></Svg>;
}

export function ArrowIcon({ className }: IconProps) {
  return <Svg className={className}><path d="M5 12h14"/><path d="m15 8 4 4-4 4"/></Svg>;
}

export function ExpectedGoalsIcon({ className }: IconProps) {
  return <Svg className={className}><path d="M5 19v-6"/><path d="M10 19V8"/><path d="M15 19V4"/><path d="M20 19v-9"/><path d="M3 19h19"/></Svg>;
}

export function ExpectedShotsIcon({ className }: IconProps) {
  return <Svg className={className}><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.9 4.9 2.1 2.1"/><path d="m17 17 2.1 2.1"/><path d="m19.1 4.9-2.1 2.1"/><path d="M7 17l-2.1 2.1"/></Svg>;
}

export function ShotsOnTargetIcon({ className }: IconProps) {
  return <Svg className={className}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></Svg>;
}
