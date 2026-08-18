import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { FaqIcon, GoalsIcon, HomeIcon, ResultIcon } from "./icons";

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: HomeIcon, end: true },
  { to: "/match-result", label: "Match Result", Icon: ResultIcon },
  { to: "/over-under-25", label: "O/U 2.5", Icon: GoalsIcon },
  { to: "/faqs", label: "FAQs", Icon: FaqIcon }
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <NavLink to="/" className="brand" aria-label="MC Predict home">
            <span className="brand__mark" aria-hidden="true">MC</span>
            <span className="brand__copy">
              <strong>MC Predict</strong>
              <small>Predicting Football with Data</small>
            </span>
          </NavLink>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `desktop-nav__link${isActive ? " is-active" : ""}`}
              >
                <Icon className="nav-icon" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="page-shell">{children}</main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            <strong>18+ · Gamble responsibly.</strong>
            <p>Predictions are model estimates and do not guarantee outcomes.</p>
          </div>
          <a
            href="https://www.gamcare.org.uk/understanding-your-gambling/safer-gambling/"
            target="_blank"
            rel="noreferrer"
          >
            Safer gambling support
          </a>
        </div>
      </footer>

      <nav className="mobile-nav" aria-label="Mobile primary navigation">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `mobile-nav__link${isActive ? " is-active" : ""}`}
          >
            <Icon className="mobile-nav__icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
