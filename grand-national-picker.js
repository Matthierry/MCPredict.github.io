(() => {
  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQylUta79Sg4Vio7K0j8zDe_6I3GOVJANv6RVj5u_uODW6fEk-tasXLciOG-20t1a3Qx7U_5PoSyDq7/pub?gid=0&single=true&output=csv';

  const filterDefs = {
    horse: { label: 'Horse Rating', step: 1 },
    timeform: { label: 'Timeform Rating', step: 1 },
    jumping: { label: 'Jumping Rating', step: 0.1 },
    weight: { label: 'Weight Carried', step: 1 },
    odds: { label: 'Odds', step: 1 }
  };

  const relaxOrder = ['odds', 'weight', 'jumping', 'timeform', 'horse'];
  let dataset = [];
  let bounds = {};
  let filters = {};
  let oddsScale = [];

  const el = {
    filterList: document.getElementById('gn-filter-list'),
    tableBody: document.getElementById('gn-table-body'),
    cards: document.getElementById('gn-cards'),
    matchCount: document.getElementById('gn-match-count'),
    loading: document.getElementById('gn-loading'),
    error: document.getElementById('gn-error'),
    tableWrap: document.getElementById('gn-table-wrap')
  };

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(cur);
        if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
        row = [];
        cur = '';
      } else {
        cur += char;
      }
    }

    if (cur.length || row.length) {
      row.push(cur);
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const out = {};
      headers.forEach((h, idx) => {
        out[h] = (r[idx] || '').trim();
      });
      return out;
    });
  }

  function parseNumber(value) {
    const cleaned = String(value || '').trim();
    if (!cleaned) return null;
    const num = Number(cleaned.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(num) ? num : null;
  }

  function parseWeightToPounds(weight) {
    const text = String(weight || '').trim();
    const m = text.match(/^(\d+)\s*[-:]\s*(\d+)$/);
    if (!m) return null;
    const stones = Number(m[1]);
    const pounds = Number(m[2]);
    if (!Number.isFinite(stones) || !Number.isFinite(pounds)) return null;
    return (stones * 14) + pounds;
  }

  function poundsToWeightString(totalPounds) {
    const stones = Math.floor(totalPounds / 14);
    const pounds = totalPounds % 14;
    return `${stones}-${pounds}`;
  }

  function parseFractionalOdds(oddsText) {
    const text = String(oddsText || '').trim();
    const m = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return null;
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  }

  function isNonRunner(row) {
    const combined = `${row['Name'] || ''} ${row['Timeform write up'] || ''} ${row['Fractional Odds'] || ''}`;
    return /\bNR\b|non[-\s]?runner/i.test(combined);
  }

  function normalizeData(rows) {
    return rows
      .filter((r) => !isNonRunner(r))
      .map((r) => {
        const horseRating = parseNumber(r['Overall Rating']);
        const timeformRating = parseNumber(r['Timeform Rating']);
        const jumpIndex = parseNumber(r['Jump Index']);
        const weightPounds = parseWeightToPounds(r['Weight']);
        const oddsValue = parseFractionalOdds(r['Fractional Odds']);

        if (!r['Name'] || horseRating == null || timeformRating == null || jumpIndex == null || weightPounds == null || oddsValue == null) {
          return null;
        }

        return {
          name: r['Name'],
          age: r['Age'] || '—',
          weight: r['Weight'],
          horseRating,
          timeformRating,
          jumpingRating: jumpIndex,
          odds: r['Fractional Odds'],
          oddsValue,
          weightPounds
        };
      })
      .filter(Boolean);
  }

  function setupBounds() {
    const vals = {
      horse: dataset.map((d) => d.horseRating),
      timeform: dataset.map((d) => d.timeformRating),
      jumping: dataset.map((d) => d.jumpingRating),
      weight: dataset.map((d) => d.weightPounds),
      odds: dataset.map((d) => d.oddsValue)
    };

    oddsScale = [...new Set(vals.odds)].sort((a, b) => a - b);

    bounds = {
      horse: { min: Math.min(...vals.horse), max: Math.max(...vals.horse) },
      timeform: { min: Math.min(...vals.timeform), max: Math.max(...vals.timeform) },
      jumping: { min: Math.min(...vals.jumping), max: Math.max(...vals.jumping) },
      weight: { min: Math.min(...vals.weight), max: Math.max(...vals.weight) },
      odds: { minIndex: 0, maxIndex: Math.max(0, oddsScale.length - 1) }
    };

    filters = {
      horse: bounds.horse.min,
      timeform: bounds.timeform.min,
      jumping: Number(bounds.jumping.min.toFixed(1)),
      weight: bounds.weight.max,
      odds: bounds.odds.minIndex
    };
  }

  function formatLabel(key, value) {
    if (key === 'horse') return `${value}+`;
    if (key === 'timeform') return `${value}+`;
    if (key === 'jumping') return `${Number(value).toFixed(1)}+`;
    if (key === 'weight') return `${poundsToWeightString(Number(value))} or less`;
    if (key === 'odds') {
      const oddVal = oddsScale[value];
      const runner = dataset.find((d) => d.oddsValue === oddVal);
      return `${runner ? runner.odds : `${oddVal}/1`}+`;
    }
    return String(value);
  }

  function buildFilterUI() {
    el.filterList.innerHTML = '';

    Object.keys(filterDefs).forEach((key) => {
      const item = document.createElement('div');
      item.className = 'gn-filter-item';

      const head = document.createElement('div');
      head.className = 'gn-filter-head';
      head.innerHTML = `<strong>${filterDefs[key].label}</strong><span id="gn-label-${key}"></span>`;

      const input = document.createElement('input');
      input.className = 'gn-range';
      input.type = 'range';
      input.id = `gn-slider-${key}`;

      if (key === 'horse' || key === 'timeform') {
        input.min = String(Math.floor(bounds[key].min));
        input.max = String(Math.ceil(bounds[key].max));
        input.step = '1';
        input.value = String(filters[key]);
      } else if (key === 'jumping') {
        input.min = String(Math.floor(bounds.jumping.min * 10) / 10);
        input.max = String(Math.ceil(bounds.jumping.max * 10) / 10);
        input.step = '0.1';
        input.value = String(filters.jumping);
      } else if (key === 'weight') {
        input.min = String(Math.floor(bounds.weight.min));
        input.max = String(Math.ceil(bounds.weight.max));
        input.step = '1';
        input.value = String(filters.weight);
      } else if (key === 'odds') {
        input.min = String(bounds.odds.minIndex);
        input.max = String(bounds.odds.maxIndex);
        input.step = '1';
        input.value = String(filters.odds);
      }

      input.addEventListener('input', () => {
        filters[key] = key === 'jumping' ? Number(input.value) : Number(input.value);
        enforceOneResult(key);
        syncSliders();
        render();
      });

      item.append(head, input);
      el.filterList.appendChild(item);
    });

    syncSliders();
  }

  function getMatches(currentFilters) {
    const oddThreshold = oddsScale[currentFilters.odds];
    return dataset
      .filter((d) => d.horseRating >= currentFilters.horse)
      .filter((d) => d.timeformRating >= currentFilters.timeform)
      .filter((d) => d.jumpingRating >= currentFilters.jumping)
      .filter((d) => d.weightPounds <= currentFilters.weight)
      .filter((d) => d.oddsValue >= oddThreshold)
      .sort((a, b) => a.oddsValue - b.oddsValue || b.horseRating - a.horseRating);
  }

  function nextLessRestrictiveValue(key, value) {
    if (key === 'horse' || key === 'timeform') return Math.max(bounds[key].min, value - 1);
    if (key === 'jumping') return Number(Math.max(bounds.jumping.min, (value - 0.1)).toFixed(1));
    if (key === 'weight') return Math.min(bounds.weight.max, value + 1);
    if (key === 'odds') return Math.max(bounds.odds.minIndex, value - 1);
    return value;
  }

  function canRelax(key, value) {
    if (key === 'horse' || key === 'timeform') return value > bounds[key].min;
    if (key === 'jumping') return value > bounds.jumping.min;
    if (key === 'weight') return value < bounds.weight.max;
    if (key === 'odds') return value > bounds.odds.minIndex;
    return false;
  }

  function enforceOneResult(changedKey) {
    if (getMatches(filters).length > 0) return;

    for (const key of relaxOrder) {
      if (key === changedKey) continue;
      while (canRelax(key, filters[key])) {
        const next = nextLessRestrictiveValue(key, filters[key]);
        if (next === filters[key]) break;
        filters[key] = next;
        if (getMatches(filters).length > 0) return;
      }
    }

    while (canRelax(changedKey, filters[changedKey])) {
      const next = nextLessRestrictiveValue(changedKey, filters[changedKey]);
      if (next === filters[changedKey]) break;
      filters[changedKey] = next;
      if (getMatches(filters).length > 0) return;
    }
  }

  function syncSliders() {
    Object.keys(filterDefs).forEach((key) => {
      const slider = document.getElementById(`gn-slider-${key}`);
      const label = document.getElementById(`gn-label-${key}`);
      if (slider) slider.value = String(filters[key]);
      if (label) label.textContent = formatLabel(key, filters[key]);
    });
  }

  function render() {
    const matches = getMatches(filters);
    el.matchCount.textContent = `${matches.length} runner${matches.length === 1 ? '' : 's'} shown`;

    el.tableBody.innerHTML = matches.map((m) => `
      <tr>
        <td>${m.name}</td>
        <td>${m.age}</td>
        <td>${m.weight}</td>
        <td>${m.horseRating}</td>
        <td>${m.timeformRating}</td>
        <td>${m.jumpingRating.toFixed(1)}</td>
        <td>${m.odds}</td>
      </tr>
    `).join('');

    el.cards.innerHTML = matches.map((m) => `
      <article class="gn-card">
        <h4>${m.name}</h4>
        <div class="gn-card-grid">
          <span>Age</span><strong>${m.age}</strong>
          <span>Weight</span><strong>${m.weight}</strong>
          <span>Horse Rating</span><strong>${m.horseRating}</strong>
          <span>Timeform Rating</span><strong>${m.timeformRating}</strong>
          <span>Jumping Rating</span><strong>${m.jumpingRating.toFixed(1)}</strong>
          <span>Odds</span><strong>${m.odds}</strong>
        </div>
      </article>
    `).join('');

    el.tableWrap.hidden = false;
    el.cards.hidden = false;
  }

  async function init() {
    try {
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Unable to fetch CSV (${res.status})`);
      const csvText = await res.text();
      const rows = parseCSV(csvText);
      dataset = normalizeData(rows);
      if (!dataset.length) throw new Error('No valid runners found in CSV.');

      setupBounds();
      buildFilterUI();
      render();
      el.loading.hidden = true;
    } catch (err) {
      el.loading.hidden = true;
      el.error.hidden = false;
      el.error.textContent = `Could not load Grand National data: ${err.message}`;
      el.matchCount.textContent = 'No data';
    }
  }

  init();
})();
