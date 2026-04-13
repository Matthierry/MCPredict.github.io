const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=1994550040&single=true&output=csv";
const REQUIRED_FIELDS = [
  "home_team", "away_team", "result", "league", "date",
  "my_probability", "bookies_price", "my_price", "value"
];
const DAY_OPTIONS = ["Sat", "Sun", "Fri", "Mon"];
const RESULT_OPTIONS = ["HOME WIN", "AWAY WIN"];
const SHORTLIST_KEY = "mcp_hda_value2_shortlist";

let allPicks = [];
let activeDays = new Set();
let activeResults = new Set();
let shortlist = [];

const dom = {
  featuredSection: document.getElementById("featuredSection"),
  dayFilters: document.getElementById("dayFilters"),
  resultFilters: document.getElementById("resultFilters"),
  tier1List: document.getElementById("tier1List"),
  tier2List: document.getElementById("tier2List"),
  tier3List: document.getElementById("tier3List"),
  tier3Toggle: document.getElementById("tier3Toggle"),
  overflowList: document.getElementById("overflowList"),
  overflowToggle: document.getElementById("overflowToggle"),
  statusMsg: document.getElementById("statusMsg"),
  shortlistBar: document.getElementById("shortlistBar"),
  shortlistCount: document.getElementById("shortlistCount"),
  shortlistOdds: document.getElementById("shortlistOdds"),
  viewShortlistBtn: document.getElementById("viewShortlistBtn"),
  shortlistModal: document.getElementById("shortlistModal"),
  shortlistItems: document.getElementById("shortlistItems"),
  modalOdds: document.getElementById("modalOdds"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  copyPicksBtn: document.getElementById("copyPicksBtn"),
  clearPicksBtn: document.getElementById("clearPicksBtn")
};

function parseNumber(value) {
  const n = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeResult(value) {
  return String(value || "").trim().toUpperCase();
}

function dayFromDate(dateStr) {
  if (!dateStr) return "";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return String(dateStr).trim().slice(0, 3);
  }
  return parsed.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

function moneyTier(value) {
  if (value >= 10) return "💰💰💰";
  if (value >= 7) return "💰💰";
  return "💰";
}

function impliedProbability(bookiesPrice) {
  if (bookiesPrice <= 0) return 0;
  return (1 / bookiesPrice) * 100;
}

function buildFilters() {
  dom.dayFilters.innerHTML = DAY_OPTIONS.map((day) => `
    <button class="pill" data-day="${day}" type="button">${day}</button>
  `).join("");

  dom.resultFilters.innerHTML = RESULT_OPTIONS.map((result) => `
    <button class="pill" data-result="${result}" type="button">${result === "HOME WIN" ? "Home Win" : "Away Win"}</button>
  `).join("");

  dom.dayFilters.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-day]");
    if (!btn) return;
    const day = btn.dataset.day;
    activeDays.has(day) ? activeDays.delete(day) : activeDays.add(day);
    btn.classList.toggle("active");
    render();
  });

  dom.resultFilters.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-result]");
    if (!btn) return;
    const result = btn.dataset.result;
    activeResults.has(result) ? activeResults.delete(result) : activeResults.add(result);
    btn.classList.toggle("active");
    render();
  });
}

function pickId(pick) {
  return `${pick.date}|${pick.home_team}|${pick.away_team}|${pick.result}`;
}

function addToShortlist(pick) {
  const id = pickId(pick);
  if (shortlist.some((item) => item.id === id)) {
    setStatus("Pick already added.");
    return;
  }
  shortlist.push({
    id,
    fixture: `${pick.home_team} vs ${pick.away_team}`,
    result: pick.result,
    bookies_price: pick.bookies_price
  });
  persistShortlist();
  updateShortlistUI();
  setStatus("Added to shortlist.");
}

function setStatus(message) {
  dom.statusMsg.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    dom.statusMsg.textContent = "";
  }, 1500);
}

function persistShortlist() {
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(shortlist));
}

function loadShortlist() {
  try {
    shortlist = JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]");
    if (!Array.isArray(shortlist)) shortlist = [];
  } catch {
    shortlist = [];
  }
}

function shortlistCombinedOdds() {
  return shortlist.reduce((acc, item) => acc * parseNumber(item.bookies_price), 1);
}

function updateShortlistUI() {
  const count = shortlist.length;
  if (count === 0) {
    dom.shortlistBar.classList.add("hidden");
  } else {
    dom.shortlistBar.classList.remove("hidden");
  }

  const odds = shortlistCombinedOdds();
  dom.shortlistCount.textContent = `${count} pick${count === 1 ? "" : "s"}`;
  dom.shortlistOdds.textContent = `Est. Odds: ${odds.toFixed(2)}`;
  dom.modalOdds.textContent = `Combined Odds: ${odds.toFixed(2)}`;

  if (count === 0) {
    dom.shortlistItems.innerHTML = '<p class="subtitle">No picks selected yet.</p>';
    return;
  }

  dom.shortlistItems.innerHTML = shortlist.map((item) => `
    <article class="modal-item">
      <div>
        <p>${item.fixture}</p>
        <p class="subtitle">${item.result}</p>
      </div>
      <p>@${parseNumber(item.bookies_price).toFixed(2)}</p>
    </article>
  `).join("");
}

function copyPicks() {
  if (!shortlist.length) {
    setStatus("No picks to copy.");
    return;
  }

  const lines = shortlist.map((item) => `${item.fixture} - ${item.result === "HOME WIN" ? "Home Win" : "Away Win"} @${parseNumber(item.bookies_price).toFixed(2)}`);
  lines.push(`Total Odds: ${shortlistCombinedOdds().toFixed(2)}`);
  const payload = lines.join("\n");

  navigator.clipboard.writeText(payload)
    .then(() => setStatus("Picks copied."))
    .catch(() => setStatus("Unable to copy on this browser."));
}

function filteredSortedPicks() {
  return allPicks
    .filter((pick) => (activeDays.size === 0 || activeDays.has(pick.day)))
    .filter((pick) => (activeResults.size === 0 || activeResults.has(pick.result)))
    .sort((a, b) => b.value - a.value);
}

function createPickCard(pick) {
  const card = document.createElement("article");
  card.className = "pick-card";
  card.innerHTML = `
    <div class="pick-card-main">
      <p class="pick-fixture">${pick.home_team} vs ${pick.away_team}</p>
      <p class="pick-sub">${pick.result} • ${pick.league || "League n/a"}</p>
    </div>
    <div class="pick-meta">
      <p class="pick-value">${pick.value.toFixed(2)}%</p>
      <p class="pick-money">${moneyTier(pick.value)}</p>
      <button class="add-btn" type="button" aria-label="Add ${pick.home_team} vs ${pick.away_team}">+</button>
    </div>
  `;
  card.querySelector(".add-btn").addEventListener("click", () => addToShortlist(pick));
  return card;
}

function renderFeatured(pick) {
  if (!pick) {
    dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">No picks match your filters.</p></article>';
    return;
  }

  dom.featuredSection.innerHTML = `
    <article class="featured-card">
      <div class="featured-top">
        <div>
          <h2 class="fixture">${pick.home_team} vs ${pick.away_team}</h2>
          <p class="result-tag">${pick.result}</p>
        </div>
        <div>
          <p class="value-big">${pick.value.toFixed(2)}%</p>
          <p class="money">${moneyTier(pick.value)}</p>
        </div>
      </div>
      <div class="featured-grid">
        <div class="stat"><span>Model Price</span><strong>${pick.my_price.toFixed(2)}</strong></div>
        <div class="stat"><span>Bookie Price</span><strong>${pick.bookies_price.toFixed(2)}</strong></div>
        <div class="stat"><span>Model Probability</span><strong>${pick.my_probability.toFixed(2)}%</strong></div>
        <div class="stat"><span>Implied Probability</span><strong>${impliedProbability(pick.bookies_price).toFixed(2)}%</strong></div>
      </div>
      <div style="margin-top: 10px;">
        <button id="featuredAddBtn" type="button" class="btn-primary">+ Shortlist</button>
      </div>
    </article>
  `;

  document.getElementById("featuredAddBtn").addEventListener("click", () => addToShortlist(pick));
}

function fillList(node, picks) {
  node.innerHTML = "";
  if (!picks.length) {
    node.innerHTML = '<p class="subtitle">No picks in this tier.</p>';
    return;
  }
  picks.forEach((pick) => node.appendChild(createPickCard(pick)));
}

function render() {
  const picks = filteredSortedPicks();
  renderFeatured(picks[0]);

  const visibleRemainder = picks.slice(1, 10);
  const overflow = picks.slice(10);

  const tier1 = visibleRemainder.filter((pick) => pick.value >= 10);
  const tier2 = visibleRemainder.filter((pick) => pick.value >= 7 && pick.value < 10);
  const tier3 = visibleRemainder.filter((pick) => pick.value < 7);

  fillList(dom.tier1List, tier1);
  fillList(dom.tier2List, tier2);
  fillList(dom.tier3List, tier3);
  fillList(dom.overflowList, overflow);

  dom.tier3Toggle.textContent = `▼ More Picks (${tier3.length})`;
  dom.overflowToggle.textContent = `▼ Remaining Picks (${overflow.length})`;
}

function mapRows(rows) {
  const headerIndex = rows.findIndex((row) => REQUIRED_FIELDS.every((field) => row.includes(field)));
  if (headerIndex === -1) throw new Error("Header row with required fields was not found.");

  const headers = rows[headerIndex];
  const dataRows = rows.slice(headerIndex + 1);

  return dataRows
    .filter((row) => row.length)
    .map((row) => {
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = row[idx];
      });
      return {
        home_team: String(record.home_team || "").trim(),
        away_team: String(record.away_team || "").trim(),
        result: normalizeResult(record.result),
        league: String(record.league || "").trim(),
        date: String(record.date || "").trim(),
        day: dayFromDate(record.date),
        my_probability: parseNumber(record.my_probability),
        bookies_price: parseNumber(record.bookies_price),
        my_price: parseNumber(record.my_price),
        value: parseNumber(record.value)
      };
    })
    .filter((pick) => pick.home_team && pick.away_team && pick.result && pick.bookies_price > 0);
}

function attachStaticHandlers() {
  dom.tier3Toggle.addEventListener("click", () => {
    const open = dom.tier3List.classList.toggle("hidden");
    dom.tier3Toggle.setAttribute("aria-expanded", String(!open));
  });

  dom.overflowToggle.addEventListener("click", () => {
    const open = dom.overflowList.classList.toggle("hidden");
    dom.overflowToggle.setAttribute("aria-expanded", String(!open));
  });

  dom.viewShortlistBtn.addEventListener("click", () => dom.shortlistModal.showModal());
  dom.closeModalBtn.addEventListener("click", () => dom.shortlistModal.close());
  dom.clearPicksBtn.addEventListener("click", () => {
    shortlist = [];
    persistShortlist();
    updateShortlistUI();
    setStatus("Shortlist cleared.");
  });
  dom.copyPicksBtn.addEventListener("click", copyPicks);
}

function loadData() {
  Papa.parse(CSV_URL, {
    download: true,
    skipEmptyLines: true,
    complete: (results) => {
      try {
        allPicks = mapRows(results.data);
        render();
      } catch (error) {
        dom.featuredSection.innerHTML = `<article class="featured-card"><p class="subtitle">Failed to process feed: ${error.message}</p></article>`;
      }
    },
    error: () => {
      dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">Failed to load live feed.</p></article>';
    }
  });
}

function init() {
  buildFilters();
  attachStaticHandlers();
  loadShortlist();
  updateShortlistUI();
  loadData();
}

init();
