import { useState } from "react";

const FAQS = [
  {
    question: "How does the model work?",
    answer:
      "MC Predict analyses football data to calculate probabilities independently of bookmaker prices. The public website deliberately keeps the underlying model as a black box: it presents the supplied probabilities, prices and expected-performance metrics without exposing or recreating proprietary model logic."
  },
  {
    question: "What is value?",
    answer:
      "Value describes the gap between MC Predict's model assessment and the bookmaker price supplied to the site. A positive model edge means the bookmaker price is more generous than the model price implies. It is a pricing comparison, not a guarantee that the selection will win."
  },
  {
    question: "What does “higher chance” / Probability mode mean?",
    answer:
      "Probability mode is the current version of the higher-chance view. It ignores value ranking and instead orders each market by the probability assigned to the model's selected outcome. It is designed to answer a different question: which outcomes does MC Predict believe are most likely?"
  },
  {
    question: "Where are Profit & Loss and historical results?",
    answer:
      "V1 is deliberately focused on current predictions. Historical results, profit and loss analysis, ROI and historical charts are not part of this release and are deferred to a future version rather than being mixed into the current-prediction product."
  },
  {
    question: "How are the prices shown on the site handled?",
    answer:
      "The current V1 receives the model price and bookmaker price from the MC Predict prediction source and displays them as decimal odds. The browser does not recalculate, adjust or infer another price, so the website remains a presentation layer rather than a second pricing model."
  },
  {
    question: "Why can bookmaker probabilities add up to more than 100%?",
    answer:
      "Bookmaker implied probabilities can include the bookmaker margin, so the raw values may total more than 100%. In expanded analysis the visual bar is normalised to fit 100% of the available width, while the displayed percentage labels remain the source market values."
  }
] as const;

export function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="page page--narrow">
      <header className="page-heading">
        <span className="eyebrow">HELP & CONTEXT</span>
        <h1>Frequently Asked Questions</h1>
        <p>How to interpret the current MC Predict model output and market comparisons.</p>
      </header>

      <div className="faq-list">
        {FAQS.map((faq, index) => {
          const open = openIndex === index;
          const triggerId = `faq-trigger-${index}`;
          const panelId = `faq-panel-${index}`;

          return (
            <div className={`surface faq-item${open ? " is-open" : ""}`} key={faq.question}>
              <button
                id={triggerId}
                className="faq-item__trigger"
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex((current) => current === index ? null : index)}
              >
                <span className="faq-item__question">{faq.question}</span>
                <span className="faq-item__icon" aria-hidden="true">+</span>
              </button>
              <div
                id={panelId}
                className="faq-item__content"
                role="region"
                aria-labelledby={triggerId}
                hidden={!open}
              >
                <p>{faq.answer}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
