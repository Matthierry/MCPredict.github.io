const FAQS = [
  {
    question: "How does the model work?",
    answer:
      "MC Predict analyses football data to calculate probabilities independently of bookmaker prices. The underlying model is intentionally treated as a black box on the public website; the site presents its supplied probabilities, prices and expected performance metrics without recreating or altering the model logic."
  },
  {
    question: "What is value?",
    answer:
      "Value describes the gap between MC Predict's model assessment and the bookmaker price supplied to the site. A positive model edge means the bookmaker price is more generous than the model price implies. It is a pricing comparison, not a guarantee that the selection will win."
  },
  {
    question: "What does Probability mode mean?",
    answer:
      "Probability mode ignores the value ranking and instead orders each market by the probability assigned to the model's selected outcome. It is designed to answer a different question: which outcomes does MC Predict believe are most likely?"
  },
  {
    question: "Where are Profit & Loss and historical results?",
    answer:
      "V1 is deliberately focused on current predictions. Historical results, profit and loss analysis, ROI and historical charts are not part of this release and will be considered separately for a future version."
  },
  {
    question: "Where do the prices shown on the site come from?",
    answer:
      "The model price and bookmaker price are supplied by the MC Predict prediction source. The public website does not calculate, adjust or infer another price. Prices are displayed as decimal odds so the comparison remains clear and consistent."
  },
  {
    question: "Why can bookmaker probabilities add up to more than 100%?",
    answer:
      "Bookmaker implied probabilities can include the bookmaker margin, so the raw values may total more than 100%. In expanded analysis the visual bar is normalised to fit 100% of the available width, while the displayed percentage labels remain the source market values."
  }
] as const;

export function FaqPage() {
  return (
    <div className="page page--narrow">
      <header className="page-heading">
        <span className="eyebrow">HELP & CONTEXT</span>
        <h1>Frequently Asked Questions</h1>
        <p>How to interpret the current MC Predict model output and market comparisons.</p>
      </header>

      <div className="faq-list">
        {FAQS.map((faq, index) => (
          <details className="surface faq-item" key={faq.question} open={index === 0}>
            <summary>{faq.question}<span aria-hidden="true">+</span></summary>
            <div className="faq-item__content"><p>{faq.answer}</p></div>
          </details>
        ))}
      </div>
    </div>
  );
}
