// Values copied from the Phase 1 frontend (js/sm2.js, js/quiz.js) — unchanged.
module.exports = {
  TEST_SIZE: 6,        // js/sm2.js
  Q_SECONDS: 30,       // js/sm2.js
  DAY_MS: 24 * 60 * 60 * 1000, // js/sm2.js
  SUBJECTS: require('../seed/subjects.json'), // js/questions.js SUBJECTS keys
  MAX_TEST_NUMBER: 3,
  PREMIUM_FROM_TEST: 3, // quiz.js: testNumber >= 3 requires data.subscribed
  SESSION_TTL_SECONDS: 2 * 60 * 60,
};
