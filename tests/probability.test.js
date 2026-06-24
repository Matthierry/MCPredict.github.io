const assert = require('assert');
const P = require('../wc26/probability/probability.js');

const odds = P.normaliseOdds([2, 4, 4]);
assert(Math.abs(odds[0] - 0.5) < 1e-12);
assert(Math.abs(odds[1] - 0.25) < 1e-12);
assert(Math.abs(odds[2] - 0.25) < 1e-12);
assert(Math.abs(odds.reduce((a,b)=>a+b,0) - 1) < 1e-12);

const grid = P.scoreGrid(1.4, 1.1, 8);
assert(Math.abs(grid.reduce((a,s)=>a+s.p,0) - 1) < 1e-12);
const fitted = P.fitPoisson({ home: 0.45, draw: 0.28, away: 0.27, under: 0.52, over: 0.48 }, { xgMin: 0.5, xgMax: 2, xgStep: 0.5, maxGoals: 8 });
assert(Math.abs(fitted.grid.reduce((a,s)=>a+s.p,0) - 1) < 1e-12);

assert.deepStrictEqual(P.scorePrediction({home:2,away:1,total:3},{home:2,away:1,total:3}), { points: 4, exact: 1, result: 1, underOver: 1 });
assert.deepStrictEqual(P.scorePrediction({home:1,away:0,total:1},{home:2,away:0,total:2}), { points: 2, exact: 0, result: 1, underOver: 1 });

const ranked = P.rankPlayers([
  { name:'B', points: 10, exact: 1, result: 5, underOver: 5 },
  { name:'A', points: 10, exact: 2, result: 4, underOver: 4 },
  { name:'C', points: 9, exact: 9, result: 9, underOver: 9 }
]);
assert.strictEqual(ranked[0].name, 'A');

const tied = [
  { points: 10, exact: 1, result: 1, underOver: 1 },
  { points: 10, exact: 1, result: 1, underOver: 1 },
  { points: 10, exact: 1, result: 1, underOver: 1 },
  { points: 7, exact: 0, result: 0, underOver: 0 }
];
['winner','top2','top3','top4'].forEach(k => P.allocateCutoff(tied, Number(k.replace(/\D/g,'')) || 1, k));
assert(tied.slice(0,3).every(p => Math.abs(p.winner - 1/3) < 1e-12));
assert(tied.slice(0,3).every(p => Math.abs(p.top2 - 2/3) < 1e-12));
assert(tied.slice(0,3).every(p => Math.abs(p.top3 - 1) < 1e-12));
assert.strictEqual(tied[3].top4, 1);

const model = { players:[{id:'1',name:'One',currentPoints:0},{id:'2',name:'Two',currentPoints:0}], fixtures:[] };
const a = P.simulate(model, 10, 123), b = P.simulate(model, 10, 123);
assert.deepStrictEqual(a, b);
assert(Math.abs(a.reduce((s,r)=>s+r.winnerPct,0)-100) < 1e-9);
assert(Math.abs(a.reduce((s,r)=>s+r.top2Pct,0)-200) < 1e-9);
console.log('probability tests passed');

const leagueRows = [
  ['Title'],
  ['Updated'],
  ['', '', '', '', '', ''],
  ['Rank', 'Player', 'Correct Scores', 'Correct Results', 'Correct U/O 2.5', 'Pts'],
  ['1', ' Alice\u00a0 Smith ', '3', '5', '7', '18'],
  ['2', 'BOB JONES', '1', '2', '3', '9'],
  ['', '', '', '', '', '']
];
const leagueWarnings = [];
const league = P.buildLeague(leagueRows, { warnings: leagueWarnings });
assert.strictEqual(league.headerRow, 3);
assert.strictEqual(league.indexes.name, 1);
assert.strictEqual(league.indexes.points, 5);
assert.strictEqual(league.byName.get(P.normName('alice smith')).points, 18);
assert.strictEqual(league.byName.get(P.normName(' alice   smith ')).exact, 3);
assert.strictEqual(league.byName.get(P.normName('bob jones')).underOver, 3);

const rangeFallbackRows = Array.from({ length: 55 }, () => ['', '', '', '', '', '']);
rangeFallbackRows[8] = ['Rank', 'Player', 'Correct Scores', 'Correct Results', 'Correct U/O 2.5', 'Live Total'];
rangeFallbackRows[9] = ['1', ' Charlie O\u2019Neil ', '2', '4', '5', '15'];
rangeFallbackRows[10] = ['2', ' Dana Smith ', '1', '3', '4', '11'];
rangeFallbackRows[50] = ['43', ' Last Player ', '0', '1', '2', '3'];
rangeFallbackRows[51] = ['44', ' Outside Range ', '9', '9', '9', '99'];
const fallbackWarnings = [];
const fallbackLeague = P.buildLeague(rangeFallbackRows, { warnings: fallbackWarnings });
assert.strictEqual(fallbackLeague.headerRow, 8);
assert.strictEqual(fallbackLeague.indexes.points, 5);
assert.strictEqual(fallbackLeague.byName.get(P.normName("charlie o'neil")).points, 15);
assert.strictEqual(fallbackLeague.byName.has(P.normName('Outside Range')), false);
assert(fallbackWarnings.some((w) => /numeric positional fallback column 6/i.test(w)));

assert.throws(() => P.buildLeague([['Name', 'Something'], ['Alice', '1']], { warnings: [] }), /points column not found/i);
console.log('league parser tests passed');

const canonicalRows = Array.from({ length: 18 }, () => []);
canonicalRows[14] = ['A', 'B', 'Sub-Code', 'Sub Name', 'E', 'Manual Name', 'CS', 'MR', 'U/O', 'J', 'Total Score'];
canonicalRows[15] = ['', '', 'ABC123', 'Fallback Name', '', 'Manual Player', '8.0004', '31.00031', '29.000029', '', '78.000931'];
canonicalRows[16] = ['', '', 'DEF456', 'Sub Player', '', '', '1.9', '2.1', '3.999999', '', '10.75'];
const canonicalWarnings = [];
const canonical = P.buildCanonicalPlayers(canonicalRows, { warnings: canonicalWarnings });
assert.strictEqual(canonical.headerRow, 14);
assert.strictEqual(canonical.players.length, 2);
assert.strictEqual(canonical.byId.get('ABC123').displayName, 'Manual Player');
assert.strictEqual(canonical.byId.get('ABC123').currentPoints, 78);
assert.strictEqual(canonical.byId.get('ABC123').currentCorrectScores, 8);
assert.strictEqual(canonical.byId.get('ABC123').currentCorrectResults, 31);
assert.strictEqual(canonical.byId.get('ABC123').currentUnderOvers, 29);
assert.strictEqual(canonical.byId.get('DEF456').displayName, 'Sub Player');
assert.strictEqual(canonical.byId.get('DEF456').currentPoints, 10);
assert(canonicalWarnings.some((w) => /Missing manual name/i.test(w)));
console.log('canonical lookup parser tests passed');
