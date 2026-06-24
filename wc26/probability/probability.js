(function (global) {
  'use strict';

  const CONFIG = {
    simulations: 25000,
    maxGoals: 8,
    xgMin: 0.05,
    xgMax: 5.5,
    xgStep: 0.05
  };

  function parseCsv(text) {
    const rows = []; let row = []; let field = ''; let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i]; const n = text[i + 1];
      if (c === '"') { if (inQuotes && n === '"') { field += '"'; i += 1; } else inQuotes = !inQuotes; }
      else if (c === ',' && !inQuotes) { row.push(field); field = ''; }
      else if ((c === '\n' || c === '\r') && !inQuotes) { if (c === '\r' && n === '\n') i += 1; row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  const clean = (v) => String(v == null ? '' : v).trim();
  const normHeader = (v) => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const fixtureKey = (home, away) => `${clean(home).toLowerCase().replace(/[^a-z0-9]+/g, '')}|${clean(away).toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

  function hashString(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) { let a = seed >>> 0; return function () { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function parseScoreline(value) {
    const m = clean(value).match(/^(\d+)\s*[-–—:]\s*(\d+)$/);
    if (!m) return null;
    return { home: Number(m[1]), away: Number(m[2]), total: Number(m[1]) + Number(m[2]) };
  }
  function resultFromScore(score) { return score.home > score.away ? 'HOME' : score.home < score.away ? 'AWAY' : 'DRAW'; }
  function underOverFromScore(score) { return score.total < 2.5 ? 'UNDER' : 'OVER'; }
  function normalizeResult(value) {
    const v = clean(value).toUpperCase();
    if (['HOME', 'H', '1', 'HOME WIN'].includes(v)) return 'HOME';
    if (['AWAY', 'A', '2', 'AWAY WIN'].includes(v)) return 'AWAY';
    if (['DRAW', 'D', 'X'].includes(v)) return 'DRAW';
    return '';
  }
  function normalizeUnderOver(value) {
    const v = clean(value).toUpperCase();
    if (v.includes('UNDER') || v === 'U') return 'UNDER';
    if (v.includes('OVER') || v === 'O') return 'OVER';
    return '';
  }

  function normaliseOdds(odds) {
    const implied = odds.map((o) => 1 / Number(o));
    const sum = implied.reduce((a, b) => a + b, 0);
    if (!sum || implied.some((x) => !Number.isFinite(x))) return null;
    return implied.map((x) => x / sum);
  }

  function poissonPmf(lambda, maxGoals) {
    const out = [Math.exp(-lambda)];
    for (let i = 1; i <= maxGoals; i += 1) out[i] = out[i - 1] * lambda / i;
    return out;
  }
  function scoreGrid(homeXg, awayXg, maxGoals) {
    const hp = poissonPmf(homeXg, maxGoals); const ap = poissonPmf(awayXg, maxGoals); const scores = [];
    let sum = 0;
    for (let h = 0; h <= maxGoals; h += 1) for (let a = 0; a <= maxGoals; a += 1) { const p = hp[h] * ap[a]; scores.push({ home: h, away: a, p }); sum += p; }
    scores.forEach((s) => { s.p /= sum; });
    return scores;
  }
  function gridMarkets(grid) {
    return grid.reduce((m, s) => { const r = resultFromScore(s); m[r.toLowerCase()] += s.p; if (s.home + s.away < 2.5) m.under += s.p; else m.over += s.p; return m; }, { home: 0, draw: 0, away: 0, under: 0, over: 0 });
  }
  function fitPoisson(target, cfg) {
    const c = Object.assign({}, CONFIG, cfg); let best = null;
    for (let hx = c.xgMin; hx <= c.xgMax + 1e-9; hx += c.xgStep) for (let ax = c.xgMin; ax <= c.xgMax + 1e-9; ax += c.xgStep) {
      const grid = scoreGrid(Number(hx.toFixed(2)), Number(ax.toFixed(2)), c.maxGoals); const m = gridMarkets(grid);
      const err = (m.home - target.home) ** 2 + (m.draw - target.draw) ** 2 + (m.away - target.away) ** 2 + (m.under - target.under) ** 2 + (m.over - target.over) ** 2;
      if (!best || err < best.err) best = { homeXg: Number(hx.toFixed(2)), awayXg: Number(ax.toFixed(2)), err, grid };
    }
    return best;
  }

  function scorePrediction(predicted, actual) {
    if (!predicted || !actual) return { points: 0, exact: 0, result: 0, underOver: 0 };
    const exact = predicted.home === actual.home && predicted.away === actual.away ? 1 : 0;
    const result = resultFromScore(predicted) === resultFromScore(actual) ? 1 : 0;
    const underOver = underOverFromScore(predicted) === underOverFromScore(actual) ? 1 : 0;
    return { points: exact * 2 + result + underOver, exact, result, underOver };
  }

  function allocateCutoff(sorted, cutoff, key) {
    for (let i = 0; i < sorted.length;) {
      let j = i + 1;
      while (j < sorted.length && sorted[j].points === sorted[i].points && sorted[j].exact === sorted[i].exact && sorted[j].result === sorted[i].result && sorted[j].underOver === sorted[i].underOver) j += 1;
      const overlap = Math.max(0, Math.min(cutoff, j) - i);
      if (overlap > 0) for (let k = i; k < j; k += 1) sorted[k][key] = (sorted[k][key] || 0) + overlap / (j - i);
      i = j;
    }
  }
  function rankPlayers(players) { return players.slice().sort((a, b) => (b.points - a.points) || (b.exact - a.exact) || (b.result - a.result) || (b.underOver - a.underOver) || a.name.localeCompare(b.name)); }

  function buildNameLookup(rows, warnings) {
    const slice = rows.slice(14, 57); const header = slice[0] || []; const idIdx = header.findIndex((h) => normHeader(h) === 'submissionid'); const nameIdx = header.findIndex((h) => normHeader(h) === 'manualname');
    const map = new Map(); slice.slice(1).forEach((r) => { const id = clean(r[idIdx >= 0 ? idIdx : 0]); const nm = clean(r[nameIdx >= 0 ? nameIdx : 8]); if (id) map.set(id, nm); });
    if (nameIdx < 0) warnings.push('Manual name header not found; using fallback lookup column.');
    return map;
  }

  function buildLeague(rows) {
    const out = new Map(); rows.slice(8, 51).forEach((r) => { const name = clean(r[0]); const pts = Number(clean(r[5])) || 0; if (name && normHeader(name) !== 'name') out.set(name, pts); }); return out;
  }
  function buildResults(rows) {
    return rows.slice(1).filter((r) => clean(r[3]) && clean(r[4])).map((r) => ({ key: fixtureKey(r[3], r[4]), home: clean(r[3]), away: clean(r[4]), completed: clean(r[10]) === '1' }));
  }
  function buildOdds(rows) { const m = new Map(); rows.slice(1).forEach((r) => { if (clean(r[3]) && clean(r[4])) m.set(fixtureKey(r[3], r[4]), r); }); return m; }

  function sampleScore(grid, rnd) { const x = rnd(); let acc = 0; for (const s of grid) { acc += s.p; if (x <= acc) return s; } return grid[grid.length - 1]; }

  function simulate(model, simulations, seed) {
    const rnd = mulberry32(seed); const counts = new Map();
    model.players.forEach((p) => counts.set(p.id, { id: p.id, name: p.name, currentPoints: p.currentPoints, winner: 0, top2: 0, top3: 0, top4: 0 }));
    for (let s = 0; s < simulations; s += 1) {
      const totals = model.players.map((p) => ({ id: p.id, name: p.name, points: p.currentPoints, exact: 0, result: 0, underOver: 0 }));
      model.fixtures.forEach((f) => { const actual = sampleScore(f.grid, rnd); totals.forEach((t) => { const sc = scorePrediction(f.predictions.get(t.id), actual); t.points += sc.points; t.exact += sc.exact; t.result += sc.result; t.underOver += sc.underOver; }); });
      const ranked = rankPlayers(totals); allocateCutoff(ranked, 1, 'winner'); allocateCutoff(ranked, 2, 'top2'); allocateCutoff(ranked, 3, 'top3'); allocateCutoff(ranked, 4, 'top4');
      ranked.forEach((r) => { const c = counts.get(r.id); c.winner += r.winner || 0; c.top2 += r.top2 || 0; c.top3 += r.top3 || 0; c.top4 += r.top4 || 0; });
    }
    return [...counts.values()].map((r) => ({ ...r, winnerPct: r.winner / simulations * 100, top2Pct: r.top2 / simulations * 100, top3Pct: r.top3 / simulations * 100, top4Pct: r.top4 / simulations * 100 }))
      .sort((a, b) => (b.winnerPct - a.winnerPct) || (b.top2Pct - a.top2Pct) || (b.top3Pct - a.top3Pct) || (b.top4Pct - a.top4Pct) || (b.currentPoints - a.currentPoints));
  }

  function api() { return { CONFIG, parseCsv, hashString, mulberry32, parseScoreline, resultFromScore, underOverFromScore, normalizeResult, normalizeUnderOver, normaliseOdds, scoreGrid, gridMarkets, fitPoisson, scorePrediction, allocateCutoff, rankPlayers, buildNameLookup, buildLeague, buildResults, buildOdds, fixtureKey, clean, normHeader, simulate }; }
  const exported = api();
  if (typeof module !== 'undefined') module.exports = exported;
  global.MCPredictProbability = exported;
}(typeof window !== 'undefined' ? window : globalThis));
