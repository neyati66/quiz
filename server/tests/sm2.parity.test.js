// Proves the server SM-2 is identical to the ORIGINAL frontend js/sm2.js.
// Loads the untouched frontend file in a sandbox, freezes Date.now / Math.random,
// and compares outputs for every (state, quality) combination + selection ordering.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const server = require('../services/sm2');

const FIXED_NOW = 1_700_000_000_000;
function loadOriginal(poolByCat) {
  let seed = 12345;
  const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const ctx = {
    Date: { now: () => FIXED_NOW }, Math: Object.assign(Object.create(Math), { random: rng }),
    questionsForSubject: (s) => poolByCat[s] || [],
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'sm2.js'), 'utf8') + ';this.api={sm2Update,selectQuestionsForSubject,TEST_SIZE,Q_SECONDS,DAY_MS};', ctx);
  return { api: ctx.api, rng, reset: () => { seed = 12345; } };
}

test('constants match the original', () => {
  const { api } = loadOriginal({});
  const c = require('../config/constants');
  assert.strictEqual(c.TEST_SIZE, api.TEST_SIZE); assert.strictEqual(c.Q_SECONDS, api.Q_SECONDS); assert.strictEqual(c.DAY_MS, api.DAY_MS);
});

test('sm2Update identical for all states x qualities 0..5', () => {
  const { api } = loadOriginal({});
  const states = [null];
  for (const ef of [1.3, 1.5, 2.0, 2.5, 2.8]) for (const reps of [0, 1, 2, 3, 8]) for (const interval of [0, 1, 6, 15, 90]) states.push({ ef, reps, interval });
  let n = 0;
  for (const s of states) for (let q = 0; q <= 5; q++) {
    assert.deepStrictEqual(server.sm2Update(s, q, FIXED_NOW), JSON.parse(JSON.stringify(api.sm2Update(s, q))), JSON.stringify({ s, q })); n++; // JSON round-trip: vm sandbox objects have a different realm prototype
  }
  assert.ok(n > 700);
});

test('selection order/priority identical (due -> fresh -> rest, sliced to 6)', () => {
  const bank = require('../seed/questions.seed.json');
  const pool = bank.filter((q) => q.cat === 'HTML');
  const sm2 = {
    h1: { nextReview: FIXED_NOW - 1 }, h2: { nextReview: FIXED_NOW }, h3: { nextReview: FIXED_NOW + 1000 },
    h4: { nextReview: FIXED_NOW - 5000 }, h5: { nextReview: FIXED_NOW + 9e9 },
  };
  const o = loadOriginal({ HTML: pool });
  const expected = Array.from(o.api.selectQuestionsForSubject('HTML', sm2).map((q) => q.id));
  const seed = 12345; let s = seed; const rng = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const got = server.selectQuestions(pool.map((q) => ({ id: q.id })), sm2, FIXED_NOW, rng).questions.map((q) => q.id);
  assert.deepStrictEqual(got, expected);
  assert.strictEqual(got.length, 6);
  // due ones (h1,h2,h4) must come first
  assert.deepStrictEqual(new Set(got.slice(0, 3)), new Set(['h1', 'h2', 'h4']));
});

test('quality rule matches js/quiz.js', () => {
  const orig = (correct, t, chosen) => (correct ? (t <= 10 ? 5 : (t <= 20 ? 4 : 3)) : (chosen === null ? 0 : 1));
  for (const c of [true, false]) for (let t = 0; t <= 30; t++) for (const ch of [null, 0, 2]) assert.strictEqual(server.qualityFor(c, t, ch), orig(c, t, ch));
});

test('seed bank is the untouched Phase 1 bank', () => {
  const bank = require('../seed/questions.seed.json');
  assert.strictEqual(bank.length, 108);
  assert.strictEqual(new Set(bank.map((q) => q.id)).size, 108);
  assert.ok(bank.every((q) => q.options.length === 4 && q.correct >= 0 && q.correct <= 3));
});
