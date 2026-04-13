const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=1994550040&single=true&output=csv";
const SHORTLIST_KEY = "mcp_hda_value2_shortlist";

const DAY_OPTIONS = ["Sat", "Sun", "Fri", "Mon"];
const RESULT_OPTIONS = ["Home Win", "Away Win"];

const FIELD_ALIASES = {
  date: ["date"],
  day: ["day"],
  league: ["league"],
  home_team: ["home team", "hometeam", "home_team"],
  away_team: ["away team", "awayteam", "away_team"],
  result: ["result"],
  my_probability: ["my probability", "myprobability", "probability", "my_prob"],
  bookies_price: ["bookies price", "bookie price", "bookiesprice", "bookieprice", "odds"],
  my_price: ["my price", "myprice", "model price", "modelprice"],
  value: ["value", "edge", "value %", "value%"]
};

const state = {
  allRows: [],
  selectedDays: new Set(),
  selectedResults: new Set(),
  shortlist: [],
  loadState: "loading"
};

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

function normaliseKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/[_\s]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildKeyMap(row) {
  const map = {};
  Object.keys(row || {}).forEach((originalKey) => {
    map[normaliseKey(originalKey)] = originalKey;
  });
  return map;
}

function getField(row, keyMap, aliases) {
  for (const alias of aliases) {
    const actualKey = keyMap[normaliseKey(alias)];
    if (actualKey && row[actualKey] != null && String(row[actualKey]).trim() !== "") {
      return row[actualKey];
    }
  }
  return "";
}

function parseNumber(value) {
  const cleaned = String(value || "")
    .replace(/%/g, "")
    .replace(/,/g, "")
    .trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function normDayLabel(day) {
  return String(day || "").trim().slice(0, 3).toLowerCase();
}

function normResultLabel(result) {
  return String(result || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function prettyResult(result) {
  const value = normResultLabel(result);
  if (value === "home win") return "Home Win";
  if (value === "away win") return "Away Win";
  return String(result || "").trim() || "Unknown";
}

function formatOdds(value) {
  return parseNumber(value).toFixed(2);
}

function pickId(pick) {
  return [pick.date, pick.home_team, pick.away_team, pick.result].join("|");
}

function showStatus(message) {
  if (!dom.statusMsg) return;
  dom.statusMsg.textContent = message;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => {
    dom.statusMsg.textContent = "";
  }, 1600);
}

function impliedProbability(bookiesPrice) {
  const price = parseNumber(bookiesPrice);
  if (price <= 0) return "—";
  return `${((1 / price) * 100).toFixed(2)}%`;
}

function moneyTierIcons(value) {
  const num = parseNumber(value);
  if (num >= 10) return "💰💰💰";
  if (num >= 7) return "💰💰";
  return "💰";
}

function setLoadingState() {
  if (dom.featuredSection) {
    dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">Loading picks...</p></article>';
  }
}

function setFeedFailureState() {
  if (dom.featuredSection) {
    dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">Unable to load picks right now.</p></article>';
  }
  fillList(dom.tier1List, []);
  fillList(dom.tier2List, []);
  fillList(dom.tier3List, []);
  fillList(dom.overflowList, []);
  if (dom.tier3Toggle) dom.tier3Toggle.textContent = "▼ More Picks (0)";
  if (dom.overflowToggle) dom.overflowToggle.textContent = "▼ Remaining Picks (0)";
}

function normaliseRow(row, index) {
  const keyMap = buildKeyMap(row);

  const date = String(getField(row, keyMap, FIELD_ALIASES.date)).trim();
  const dayRaw = String(getField(row, keyMap, FIELD_ALIASES.day)).trim();
  const day = dayRaw ? dayRaw : date;

  const cleanRow = {
    id: `${index}-${pickId({
      date,
      home_team: String(getField(row, keyMap, FIELD_ALIASES.home_team)).trim(),
      away_team: String(getField(row, keyMap, FIELD_ALIASES.away_team)).trim(),
      result: String(getField(row, keyMap, FIELD_ALIASES.result)).trim()
    })}`,
    date,
    day: String(day).trim(),
    league: String(getField(row, keyMap, FIELD_ALIASES.league)).trim(),
    home_team: String(getField(row, keyMap, FIELD_ALIASES.home_team)).trim(),
    away_team: String(getField(row, keyMap, FIELD_ALIASES.away_team)).trim(),
    result: String(getField(row, keyMap, FIELD_ALIASES.result)).trim(),
    my_probability: parseNumber(getField(row, keyMap, FIELD_ALIASES.my_probability)),
    bookies_price: parseNumber(getField(row, keyMap, FIELD_ALIASES.bookies_price)),
    my_price: parseNumber(getField(row, keyMap, FIELD_ALIASES.my_price)),
    value: parseNumber(getField(row, keyMap, FIELD_ALIASES.value))
  };

  const missingRequired = !cleanRow.home_team
    || !cleanRow.away_team
    || !cleanRow.result
    || cleanRow.bookies_price <= 0
    || String(getField(row, keyMap, FIELD_ALIASES.value)).trim() === "";

  return missingRequired ? null : cleanRow;
}

function loadCsvData() {
  state.loadState = "loading";
  setLoadingState();

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      try {
        const parsedRows = Array.isArray(results?.data) ? results.data : [];
        console.log("[hda-value2] Raw first row:", parsedRows[0] || null);
        console.log("[hda-value2] Raw keys:", Object.keys(parsedRows[0] || {}));

        const normalisedRows = parsedRows
          .map((row, index) => normaliseRow(row, index))
          .filter(Boolean)
          .sort((a, b) => b.value - a.value);

        console.log("[hda-value2] First 5 normalised rows:", normalisedRows.slice(0, 5));
        console.log("[hda-value2] Valid row count:", normalisedRows.length);

        state.allRows = normalisedRows;
        state.loadState = "ready";
        render();
      } catch (error) {
        console.error("[hda-value2] Failed to process feed:", error);
        state.loadState = "error";
        setFeedFailureState();
      }
    },
    error: (error) => {
      console.error("[hda-value2] Feed request failed:", error);
      state.loadState = "error";
      setFeedFailureState();
    }
  });
}

function passesFilters(row) {
  const dayMatch = state.selectedDays.size === 0 || state.selectedDays.has(normDayLabel(row.day));
  const resultMatch = state.selectedResults.size === 0 || state.selectedResults.has(normResultLabel(row.result));
  return dayMatch && resultMatch;
}

function getVisibleRows() {
  const filtered = state.allRows.filter(passesFilters);
  console.log("[hda-value2] Filtered row count:", filtered.length);
  return filtered;
}

function createFilterButton(label, type) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pill";
  btn.textContent = label;

  if (type === "day") btn.dataset.day = normDayLabel(label);
  if (type === "result") btn.dataset.result = normResultLabel(label);

  return btn;
}

function syncFilterButtonClasses() {
  if (dom.dayFilters) {
    dom.dayFilters.querySelectorAll("button[data-day]").forEach((btn) => {
      btn.classList.toggle("active", state.selectedDays.has(btn.dataset.day));
    });
  }
  if (dom.resultFilters) {
    dom.resultFilters.querySelectorAll("button[data-result]").forEach((btn) => {
      btn.classList.toggle("active", state.selectedResults.has(btn.dataset.result));
    });
  }
}

function initFilters() {
  if (dom.dayFilters) {
    dom.dayFilters.innerHTML = "";
    DAY_OPTIONS.forEach((day) => dom.dayFilters.appendChild(createFilterButton(day, "day")));
    dom.dayFilters.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-day]");
      if (!btn) return;
      const key = btn.dataset.day;
      if (state.selectedDays.has(key)) state.selectedDays.delete(key);
      else state.selectedDays.add(key);
      syncFilterButtonClasses();
      render();
    });
  }

  if (dom.resultFilters) {
    dom.resultFilters.innerHTML = "";
    RESULT_OPTIONS.forEach((result) => dom.resultFilters.appendChild(createFilterButton(result, "result")));
    dom.resultFilters.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-result]");
      if (!btn) return;
      const key = btn.dataset.result;
      if (state.selectedResults.has(key)) state.selectedResults.delete(key);
      else state.selectedResults.add(key);
      syncFilterButtonClasses();
      render();
    });
  }

  syncFilterButtonClasses();
}

function toTier(row) {
  if (row.value >= 10) return 1;
  if (row.value >= 7) return 2;
  return 3;
}

function splitRowsForRendering(rows) {
  const featured = rows[0] || null;
  const rest = rows.slice(1);

  const visible = rest.slice(0, 10);
  const overflow = rest.slice(10);

  const tier1 = [];
  const tier2 = [];
  const tier3 = [];

  visible.forEach((row) => {
    const tier = toTier(row);
    if (tier === 1) tier1.push(row);
    else if (tier === 2) tier2.push(row);
    else tier3.push(row);
  });

  return { featured, tier1, tier2, tier3, overflow };
}

function createPickCard(row) {
  const card = document.createElement("article");
  card.className = "pick-card";

  card.innerHTML = `
    <div class="pick-card-main">
      <p class="pick-fixture">${row.home_team} vs ${row.away_team}</p>
      <p class="pick-sub">${prettyResult(row.result)}${row.league ? ` • ${row.league}` : ""}</p>
    </div>
    <div class="pick-meta">
      <p class="pick-value">${row.value.toFixed(2)}%</p>
      <p class="pick-money">${moneyTierIcons(row.value)}</p>
      <button class="add-btn" type="button" aria-label="Add ${row.home_team} vs ${row.away_team}">+</button>
    </div>
  `;

  const addBtn = card.querySelector(".add-btn");
  if (addBtn) addBtn.addEventListener("click", () => addToShortlist(row));

  return card;
}

function fillList(container, picks) {
  if (!container) return;
  container.innerHTML = "";
  if (!picks.length) {
    container.innerHTML = '<p class="subtitle">No picks in this tier.</p>';
    return;
  }
  picks.forEach((pick) => container.appendChild(createPickCard(pick)));
}

function renderFeatured(row) {
  if (!dom.featuredSection) return;

  if (!row) {
    dom.featuredSection.innerHTML = '<article class="featured-card"><p class="subtitle">No picks match your filters. Try clearing a filter.</p></article>';
    return;
  }

  dom.featuredSection.innerHTML = `
    <article class="featured-card">
      <div class="featured-top">
        <div>
          <h2 class="fixture">${row.home_team} vs ${row.away_team}</h2>
          <p class="result-tag">${prettyResult(row.result)}</p>
        </div>
        <div>
          <p class="value-big">${row.value.toFixed(2)}%</p>
          <p class="money">${moneyTierIcons(row.value)}</p>
        </div>
      </div>
      <div class="featured-grid">
        <div class="stat"><span>Model Price</span><strong>${row.my_price.toFixed(2)}</strong></div>
        <div class="stat"><span>Bookie Price</span><strong>${row.bookies_price.toFixed(2)}</strong></div>
        <div class="stat"><span>Value %</span><strong>${row.value.toFixed(2)}%</strong></div>
        <div class="stat"><span>Model Probability</span><strong>${row.my_probability.toFixed(2)}%</strong></div>
        <div class="stat"><span>Implied Probability</span><strong>${impliedProbability(row.bookies_price)}</strong></div>
      </div>
      <div style="margin-top: 10px;">
        <button id="featuredAddBtn" type="button" class="btn-primary">+ Shortlist</button>
      </div>
    </article>
  `;

  const addBtn = document.getElementById("featuredAddBtn");
  if (addBtn) addBtn.addEventListener("click", () => addToShortlist(row));
}

function renderTierToggles(tier3Count, overflowCount) {
  if (dom.tier3Toggle) dom.tier3Toggle.textContent = `▼ More Picks (${tier3Count})`;
  if (dom.overflowToggle) dom.overflowToggle.textContent = `▼ Remaining Picks (${overflowCount})`;
}

function calculateCombinedOdds() {
  return state.shortlist.reduce((acc, item) => {
    const price = parseNumber(item.bookies_price);
    return price > 0 ? acc * price : acc;
  }, 1);
}

function saveShortlist() {
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(state.shortlist));
}

function loadShortlist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]");
    state.shortlist = Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    state.shortlist = [];
  }
}

function removeFromShortlist(id) {
  state.shortlist = state.shortlist.filter((item) => item.id !== id);
  saveShortlist();
  renderShortlist();
}

function renderShortlist() {
  const count = state.shortlist.length;
  const odds = calculateCombinedOdds().toFixed(2);

  if (dom.shortlistBar) dom.shortlistBar.classList.toggle("hidden", count === 0);
  if (dom.shortlistCount) dom.shortlistCount.textContent = `${count} pick${count === 1 ? "" : "s"}`;
  if (dom.shortlistOdds) dom.shortlistOdds.textContent = `Est. Odds: ${odds}`;
  if (dom.modalOdds) dom.modalOdds.textContent = `Combined Odds: ${odds}`;

  if (!dom.shortlistItems) return;

  if (!count) {
    dom.shortlistItems.innerHTML = '<p class="subtitle">No picks selected yet.</p>';
    return;
  }

  dom.shortlistItems.innerHTML = "";
  state.shortlist.forEach((item) => {
    const row = document.createElement("article");
    row.className = "modal-item";
    row.innerHTML = `
      <div>
        <p>${item.fixture}</p>
        <p class="subtitle">${prettyResult(item.result)} @${formatOdds(item.bookies_price)}</p>
      </div>
      <button type="button" class="icon-btn" aria-label="Remove pick">✕</button>
    `;

    const removeBtn = row.querySelector("button");
    if (removeBtn) removeBtn.addEventListener("click", () => removeFromShortlist(item.id));

    dom.shortlistItems.appendChild(row);
  });
}

function addToShortlist(row) {
  const id = row.id || pickId(row);
  if (state.shortlist.some((item) => item.id === id)) {
    showStatus("Pick already in shortlist.");
    return;
  }

  state.shortlist.push({
    id,
    fixture: `${row.home_team} vs ${row.away_team}`,
    result: row.result,
    bookies_price: row.bookies_price
  });

  saveShortlist();
  renderShortlist();
  showStatus("Added to shortlist.");
}

function clearShortlist() {
  state.shortlist = [];
  saveShortlist();
  renderShortlist();
  showStatus("Shortlist cleared.");
}

function copyShortlist() {
  if (!state.shortlist.length) {
    showStatus("No picks to copy.");
    return;
  }

  const lines = state.shortlist.map((item) => `${item.fixture} - ${prettyResult(item.result)} @${formatOdds(item.bookies_price)}`);
  lines.push(`Total Odds: ${calculateCombinedOdds().toFixed(2)}`);

  navigator.clipboard.writeText(lines.join("\n"))
    .then(() => showStatus("Picks copied."))
    .catch(() => showStatus("Unable to copy picks."));
}

function attachStaticHandlers() {
  if (dom.tier3Toggle && dom.tier3List) {
    dom.tier3Toggle.addEventListener("click", () => {
      const hidden = dom.tier3List.classList.toggle("hidden");
      dom.tier3Toggle.setAttribute("aria-expanded", String(!hidden));
    });
  }

  if (dom.overflowToggle && dom.overflowList) {
    dom.overflowToggle.addEventListener("click", () => {
      const hidden = dom.overflowList.classList.toggle("hidden");
      dom.overflowToggle.setAttribute("aria-expanded", String(!hidden));
    });
  }

  if (dom.viewShortlistBtn && dom.shortlistModal) {
    dom.viewShortlistBtn.addEventListener("click", () => dom.shortlistModal.showModal());
  }
  if (dom.closeModalBtn && dom.shortlistModal) {
    dom.closeModalBtn.addEventListener("click", () => dom.shortlistModal.close());
  }
  if (dom.clearPicksBtn) dom.clearPicksBtn.addEventListener("click", clearShortlist);
  if (dom.copyPicksBtn) dom.copyPicksBtn.addEventListener("click", copyShortlist);
}

function render() {
  if (state.loadState === "loading") {
    setLoadingState();
    return;
  }

  if (state.loadState === "error") {
    setFeedFailureState();
    return;
  }

  const visibleRows = getVisibleRows();

  if (!visibleRows.length) {
    renderFeatured(null);
    fillList(dom.tier1List, []);
    fillList(dom.tier2List, []);
    fillList(dom.tier3List, []);
    fillList(dom.overflowList, []);
    renderTierToggles(0, 0);
    return;
  }

  const { featured, tier1, tier2, tier3, overflow } = splitRowsForRendering(visibleRows);

  renderFeatured(featured);
  fillList(dom.tier1List, tier1);
  fillList(dom.tier2List, tier2);
  fillList(dom.tier3List, tier3);
  fillList(dom.overflowList, overflow);
  renderTierToggles(tier3.length, overflow.length);
}

function init() {
  initFilters();
  attachStaticHandlers();
  loadShortlist();
  renderShortlist();
  loadCsvData();
}

init();
