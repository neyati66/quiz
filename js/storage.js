// ============================================================
// storage.js — Phase 2. The browser is NO LONGER the database.
// Accounts, SM-2 state, attempt history, XP/streaks/achievements all live in
// MongoDB behind the Express API. This module keeps the Phase 1 method names
// so the pages keep working:
//   - session  = the JWT + a tiny non-sensitive profile cache (sessionStorage)
//   - user data = fetched from GET /api/me/data and held in memory for the page
// Nothing authoritative is written to localStorage any more.
// ============================================================

const Storage = (() => {
  let _cache = null;

  function defaultUserData() {
    return {
      sm2: {}, history: [],
      streak: { current: 0, best: 0, lastActivityDate: null },
      achievements: [], xp: 0, subscribed: false,
    };
  }

  // session
  function getSession() { return Api.getToken() && Api.getUser() ? { email: Api.getUser().email } : null; }
  function clearSession() { Api.clearSession(); _cache = null; }

  // per-user data (async: from the server). Pages call `await Storage.loadUserData()` once.
  async function loadUserData() {
    try {
      const d = await Api.myData();
      Api.setUser(d.user);
      _cache = { sm2: d.sm2, history: d.history, streak: d.streak, achievements: d.achievements, xp: d.xp, subscribed: d.subscribed };
    } catch (e) {
      if (typeof Notify !== "undefined" && e.code !== "TOKEN_EXPIRED" && e.code !== "TOKEN_INVALID" && e.code !== "AUTH_REQUIRED") {
        Notify.showError(Api.messageOf(e));
      }
      _cache = Object.assign(defaultUserData(), { _failed: true });
    }
    return _cache;
  }
  function getUserData() { return _cache || defaultUserData(); }
  function invalidate() { _cache = null; }

  return { getSession, clearSession, loadUserData, getUserData, invalidate, defaultUserData };
})();
