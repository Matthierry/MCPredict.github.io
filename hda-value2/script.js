const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=1994550040&single=true&output=csv";
const DAY_OPTIONS = ["Sat", "Sun", "Fri", "Mon"];
const RESULT_OPTIONS = ["HOME WIN", "AWAY WIN"];
const SHORTLIST_KEY = "mcp_hda_value2_shortlist";

let allPicks = [];
let activeDays = new Set(DAY_OPTIONS.map((day) => normalizeDay(day)));
let activeResults = new Set(RESULT_OPTIONS.map((result) => normalizeResult(result)));
let shortlist = [];
let loadState = "loading"; // loading | ready | error

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
  if (value === null || value === undefined) return NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;
  const normalized = raw.replace(/,/g, "").replace(/%/g, "").replace(/[^0-9.+-]/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeResult(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeDay(value) {
  return String(value || "").trim().slice(0, 3).toUpperCase();
}

function normaliseKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function getField(row, key, headerMap) {
  const normalised = normaliseKey(key);
  const actualKey = headerMap[normalised];
  return actualKey ? row[actualKey] : undefined;
}

function dayFromDate(dateStr, fallbackDay) {
  if (fallbackDay) {
    const normalizedFallback = normalizeDay(fallbackDay);
    if (normalizedFallback) return normalizedFallback;
  }

  const raw = String(dateStr || "").trim();
  if (!raw) return "";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return normalizeDay(raw);

  return parsed.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase();
}

function moneyTier(value) {
  if (value >= 10) return "💰💰💰";
  if (value >= 7) return "💰💰";
  return "💰";
}

function impliedProbability(bookiesPrice) {
  if (!Number.isFinite(bookiesPrice) || bookiesPrice <= 0) return NaN;
  return (1 / bookiesPrice) * 100;
}

function setLoadingState() {
  dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">Loading picks...</p></article>';
}

function setErrorState() {
  dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">Unable to load picks right now.</p></article>';
  fillList(dom.tier1List, []);
  fillList(dom.tier2List, []);
  fillList(dom.tier3List, []);
  fillList(dom.overflowList, []);
  dom.tier3Toggle.textContent = "▼ More Picks (0)";
  dom.overflowToggle.textContent = "▼ Remaining Picks (0)";
}

function buildFilters() {
  dom.dayFilters.innerHTML = DAY_OPTIONS.map((day) => {
    const normalized = normalizeDay(day);
    return `<button class="pill active" data-day="${normalized}" type="button">${day}</button>`;
  }).join("");

  dom.resultFilters.innerHTML = RESULT_OPTIONS.map((result) => {
    const label = result === "HOME WIN" ? "Home Win" : "Away Win";
    return `<button class="pill active" data-result="${normalizeResult(result)}" type="button">${label}</button>`;
  }).join("");

  dom.dayFilters.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-day]");
    if (!btn) return;
    const day = normalizeDay(btn.dataset.day);
    activeDays.has(day) ? activeDays.delete(day) : activeDays.add(day);
    btn.classList.toggle("active", activeDays.has(day));
    render();
  });

  dom.resultFilters.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-result]");
    if (!btn) return;
    const result = normalizeResult(btn.dataset.result);
    activeResults.has(result) ? activeResults.delete(result) : activeResults.add(result);
    btn.classList.toggle("active", activeResults.has(result));
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
  return shortlist.reduce((acc, item) => {
    const price = parseNumber(item.bookies_price);
    return Number.isFinite(price) && price > 0 ? acc * price : acc;
  }, 1);
}

function updateShortlistUI() {
  const count = shortlist.length;
  dom.shortlistBar.classList.toggle("hidden", count === 0);

  const odds = shortlistCombinedOdds();
  dom.shortlistCount.textContent = `${count} pick${count === 1 ? "" : "s"}`;
  dom.shortlistOdds.textContent = `Est. Odds: ${odds.toFixed(2)}`;
  dom.modalOdds.textContent = `Combined Odds: ${odds.toFixed(2)}`;

  if (!count) {
    dom.shortlistItems.innerHTML = '<p class="subtitle">No picks selected yet.</p>';
    return;
  }

  dom.shortlistItems.innerHTML = shortlist.map((item) => `
    <article class="modal-item">
      <div>
        <p>${item.fixture}</p>
        <p class="subtitle">${item.result}</p>
      </div>
      <p>@${safeNumber(parseNumber(item.bookies_price), 0).toFixed(2)}</p>
    </article>
  `).join("");
}

function copyPicks() {
  if (!shortlist.length) {
    setStatus("No picks to copy.");
    return;
  }

  const lines = shortlist.map((item) => `${item.fixture} - ${item.result === "HOME WIN" ? "Home Win" : "Away Win"} @${safeNumber(parseNumber(item.bookies_price), 0).toFixed(2)}`);
  lines.push(`Total Odds: ${shortlistCombinedOdds().toFixed(2)}`);

  navigator.clipboard.writeText(lines.join("\n"))
    .then(() => setStatus("Picks copied."))
    .catch(() => setStatus("Unable to copy on this browser."));
}

function normaliseRow(row, headerMap) {
  const get = (...keys) => {
    for (const key of keys) {
      const value = getField(row, key, headerMap);
      if (value !== undefined) return value;
    }
    return "";
  };

  const homeTeam = String(get("home team", "home_team", "home") || "").trim();
  const awayTeam = String(get("away team", "away_team", "away") || "").trim();
  const result = normalizeResult(get("result", "pick", "selection"));
  const date = String(get("date") || "").trim();
  const day = dayFromDate(date, get("day"));

  const pick = {
    date,
    day,
    league: String(get("league", "competition") || "").trim(),
    home_team: homeTeam,
    away_team: awayTeam,
    result,
    my_probability: parseNumber(get("my probability", "my_probability", "probability")),
    bookies_price: parseNumber(get("bookies price", "bookies_price", "bookie price", "odds")),
    my_price: parseNumber(get("my price", "my_price")),
    value: parseNumber(get("value", "edge", "value %", "value%"))
  };

  const isEmpty = Object.values(pick).every((field) => String(field || "").trim() === "" || Number.isNaN(field));
  if (isEmpty) return null;

  if (!pick.home_team || !pick.away_team || !pick.result || !Number.isFinite(pick.value)) return null;

  return pick;
}

function loadCsvData() {
  setLoadingState();
  loadState = "loading";

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: "greedy",
    complete: (results) => {
      try {
        const rows = Array.isArray(results.data) ? results.data : [];
        if (!rows.length) {
          console.error("[hda-value2] CSV parse produced no data rows.");
          allPicks = [];
          loadState = "ready";
          render();
          return;
        }

        const headerMap = {};
        Object.keys(rows[0] || {}).forEach((originalKey) => {
          const normalised = normaliseKey(originalKey);
          if (!normalised) return;
          headerMap[normalised] = originalKey;
        });

        console.log("[hda-value2] Header map:", headerMap);

        allPicks = rows
          .filter((row) => Object.values(row || {}).some((value) => String(value || "").trim() !== ""))
          .map((row) => normaliseRow(row, headerMap))
          .filter(Boolean)
          .sort((a, b) => b.value - a.value);

        const rowsWithPositiveValue = allPicks.filter((pick) => safeNumber(pick.value, 0) > 0).length;
        if (!allPicks.length) {
          console.error("[hda-value2] No valid rows were parsed from CSV.");
        }
        if (!rowsWithPositiveValue) {
          console.error("[hda-value2] Parsed rows exist, but none have value > 0.");
        }

        console.log("[hda-value2] Parsed data sample:", allPicks.slice(0, 5));

        loadState = "ready";
        render();
      } catch (error) {
        console.error("[hda-value2] CSV parse error:", error);
        loadState = "error";
        setErrorState();
      }
    },
    error: (error) => {
      console.error("[hda-value2] CSV load error:", error);
      loadState = "error";
      setErrorState();
    }
  });
}

function applyFilters(picks) {
  return picks
    .filter((pick) => activeDays.size === 0 || activeDays.has(normalizeDay(pick.day)))
    .filter((pick) => activeResults.size === 0 || activeResults.has(normalizeResult(pick.result)));
}

function splitIntoTiers(picks) {
  return {
    tier1: picks.filter((pick) => pick.value >= 10),
    tier2: picks.filter((pick) => pick.value >= 7 && pick.value < 10),
    tier3: picks.filter((pick) => pick.value < 7)
  };
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
      <p class="pick-value">${safeNumber(pick.value, 0).toFixed(2)}%</p>
      <p class="pick-money">${moneyTier(safeNumber(pick.value, 0))}</p>
      <button class="add-btn" type="button" aria-label="Add ${pick.home_team} vs ${pick.away_team}">+</button>
    </div>
  `;

  card.querySelector(".add-btn").addEventListener("click", () => addToShortlist(pick));
  return card;
}

function renderFeaturedPick(pick) {
  if (!pick) {
    dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">No picks match your filters. Try clearing a filter.</p></article>';
    return;
  }

  const implied = impliedProbability(pick.bookies_price);
  const impliedText = Number.isFinite(implied) ? `${implied.toFixed(2)}%` : "—";

  dom.featuredSection.innerHTML = `
    <article class="featured-card">
      <div class="featured-top">
        <div>
          <h2 class="fixture">${pick.home_team} vs ${pick.away_team}</h2>
          <p class="result-tag">${pick.result}</p>
        </div>
        <div>
          <p class="value-big">${safeNumber(pick.value, 0).toFixed(2)}%</p>
          <p class="money">${moneyTier(safeNumber(pick.value, 0))}</p>
        </div>
      </div>
      <div class="featured-grid">
        <div class="stat"><span>Model Price</span><strong>${safeNumber(pick.my_price, 0).toFixed(2)}</strong></div>
        <div class="stat"><span>Bookie Price</span><strong>${safeNumber(pick.bookies_price, 0).toFixed(2)}</strong></div>
        <div class="stat"><span>Model Probability</span><strong>${safeNumber(pick.my_probability, 0).toFixed(2)}%</strong></div>
        <div class="stat"><span>Implied Probability</span><strong>${impliedText}</strong></div>
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

function renderTiers(picks) {
  const featuredExcluded = picks.slice(1);
  const topVisible = featuredExcluded.slice(0, 10);
  const overflow = featuredExcluded.slice(10);
  const { tier1, tier2, tier3 } = splitIntoTiers(topVisible);

  fillList(dom.tier1List, tier1);
  fillList(dom.tier2List, tier2);
  fillList(dom.tier3List, tier3);
  fillList(dom.overflowList, overflow);

  dom.tier3Toggle.textContent = `▼ More Picks (${tier3.length})`;
  dom.overflowToggle.textContent = `▼ Remaining Picks (${overflow.length})`;
}

function render() {
  if (loadState === "loading") {
    setLoadingState();
    return;
  }

  if (loadState === "error") {
    setErrorState();
    return;
  }

  const visiblePicks = applyFilters(allPicks);
  console.log("[hda-value2] Filtered rows:", visiblePicks.length);

  if (!allPicks.length) {
    dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">Unable to load picks right now.</p></article>';
    renderTiers([]);
    return;
  }

  if (!visiblePicks.length) {
    renderFeaturedPick(null);
    renderTiers([]);
    return;
  }

  renderFeaturedPick(visiblePicks[0]);
  renderTiers(visiblePicks);
}

function attachStaticHandlers() {
  dom.tier3Toggle.addEventListener("click", () => {
    const isHidden = dom.tier3List.classList.toggle("hidden");
    dom.tier3Toggle.setAttribute("aria-expanded", String(!isHidden));
  });

  dom.overflowToggle.addEventListener("click", () => {
    const isHidden = dom.overflowList.classList.toggle("hidden");
    dom.overflowToggle.setAttribute("aria-expanded", String(!isHidden));
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

function init() {
  buildFilters();
  attachStaticHandlers();
  loadShortlist();
  updateShortlistUI();
  loadCsvData();
}

init();
