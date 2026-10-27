// ============================================================
// api.js — Phase 2: thin fetch wrapper around the Express API.
// The JWT lives in sessionStorage (cleared when the tab closes — same
// lifetime as the Phase 1 session). Nothing secret is stored here.
// ============================================================
const Api = (() => {
  // Same-origin by default (open the app at http://localhost:5000 served by Express).
  // If you serve the HTML from elsewhere (file://, VS Code Live Server), set
  //   window.QUIZZY_API_BASE = "http://localhost:5000";   before this script, or edit the line below.
  const BASE = (typeof window !== "undefined" && window.QUIZZY_API_BASE) ||
    (location.protocol === "file:" ? "http://localhost:5000" : "");
  const K_TOKEN = "quizzy_token_v2";
  const K_USER = "quizzy_user_v2";

  class ApiError extends Error {
    constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
  }

  function getToken() { return sessionStorage.getItem(K_TOKEN); }
  function getUser() { try { return JSON.parse(sessionStorage.getItem(K_USER)); } catch (e) { return null; } }
  function setSession(token, user) { sessionStorage.setItem(K_TOKEN, token); sessionStorage.setItem(K_USER, JSON.stringify(user)); }
  function setUser(user) { sessionStorage.setItem(K_USER, JSON.stringify(user)); }
  function clearSession() { sessionStorage.removeItem(K_TOKEN); sessionStorage.removeItem(K_USER); }

  async function request(method, path, body, { auth = true } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && getToken()) headers.Authorization = "Bearer " + getToken();
    let res;
    try {
      res = await fetch(BASE + "/api" + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new ApiError(0, "NETWORK", "Can't reach the server. Check your connection and that the backend is running.");
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok || !json || json.success === false) {
      const err = (json && json.error) || {};
      const e = new ApiError(res.status, err.code || "HTTP_" + res.status, err.message || "Request failed (" + res.status + ").", err.details);
      // Expired/invalid token on an authenticated call -> back to login (not for the login call itself)
      if (auth && res.status === 401 && ["TOKEN_EXPIRED", "TOKEN_INVALID", "AUTH_REQUIRED"].includes(e.code)) {
        clearSession();
        sessionStorage.setItem("quizzy_flash", e.code === "TOKEN_EXPIRED" ? "Your session expired. Please log in again." : "Please login to continue.");
        if (!/login\.html$|signup\.html$/.test(location.pathname)) window.location.href = "./login.html";
      }
      throw e;
    }
    return json.data;
  }

  // readable message for UI toasts (includes validation details when present)
  function messageOf(e) {
    if (e && e.details && e.details.length) return e.message.replace(/\.$/, "") + ": " + e.details.join("; ");
    return (e && e.message) || "Something went wrong.";
  }

  return {
    ApiError, getToken, getUser, setUser, setSession, clearSession, messageOf,
    register: (name, email, password) => request("POST", "/auth/register", { name, email, password }, { auth: false }),
    login: (email, password) => request("POST", "/auth/login", { email, password }, { auth: false }),
    me: () => request("GET", "/auth/me"),
    updateName: (name) => request("PATCH", "/auth/me", { name }),
    myData: () => request("GET", "/me/data"),
    getDue: (subject, test) => request("GET", `/questions/due?subject=${encodeURIComponent(subject)}&test=${encodeURIComponent(test)}`),
    answer: (payload) => request("POST", "/questions/answer", payload),
    submitAttempt: (payload) => request("POST", "/attempts", payload),
    leaderboard: () => request("GET", "/leaderboard"),
    publicStats: () => request("GET", "/public/stats", undefined, { auth: false }),
  };
})();
