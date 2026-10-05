/**
 * PalmTrace client-side session handling.
 *
 * - Keeps the server session token and attaches it to every request to /api
 *   (wraps window.fetch once, so existing fetch calls need no changes).
 * - If the server answers 401 (session expired / revoked), the local session is
 *   closed and the login screen is shown.
 * - Offline login: only the last user who signed in online on this device can
 *   sign in again while offline. Their password is never stored; a PBKDF2
 *   verifier is kept instead.
 * Load this file before store.js / api.js / app.js.
 */
const Auth = (() => {
  const TOKEN_KEY = "palmtrace_auth_token";
  const OFFLINE_KEY = "palmtrace_offline_login";

  function safeGet(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
  function safeDel(k) { try { localStorage.removeItem(k); } catch {} }

  function getToken() { return safeGet(TOKEN_KEY); }
  function setToken(t) { if (t) safeSet(TOKEN_KEY, t); else safeDel(TOKEN_KEY); }
  function clearToken() { safeDel(TOKEN_KEY); }

  // ---- Offline credential verifier (PBKDF2-SHA256 via WebCrypto) ----
  function toHex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""); }
  function fromHex(hex) { const a = new Uint8Array(hex.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16); return a; }

  async function deriveVerifier(password, saltBytes) {
    if (!(window.crypto && crypto.subtle)) return null;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 120000 }, key, 256);
    return toHex(bits);
  }

  async function rememberOfflineLogin(user, password) {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const verifier = await deriveVerifier(password, salt);
      if (!verifier) return;
      safeSet(OFFLINE_KEY, JSON.stringify({
        username: String(user.username || user.user || "").toLowerCase(),
        user,
        salt: toHex(salt),
        verifier,
        savedAt: new Date().toISOString()
      }));
    } catch (e) { console.warn("Offline login cache skipped:", e); }
  }

  async function verifyOfflineLogin(username, password) {
    try {
      const rec = JSON.parse(safeGet(OFFLINE_KEY) || "null");
      if (!rec || !rec.verifier || rec.username !== String(username || "").toLowerCase()) return null;
      const v = await deriveVerifier(password, fromHex(rec.salt));
      return v && v === rec.verifier ? { ...rec.user } : null;
    } catch { return null; }
  }

  function forgetOfflineLogin() { safeDel(OFFLINE_KEY); }

  // ---- fetch wrapper ----
  function isApiUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      if (!u.pathname.startsWith("/api/")) return false;
      return u.origin === window.location.origin || u.hostname === "localhost" || u.hostname === "127.0.0.1";
    } catch { return false; }
  }

  let expiredHandled = false;
  function handleExpiredSession() {
    if (expiredHandled) return;
    const hadSession = typeof Store !== "undefined" && Store.get && Store.get().session;
    clearToken();
    if (!hadSession) return;
    expiredHandled = true;
    try { Store.set({ session: null }); } catch {}
    try { if (typeof toast === "function") toast("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى"); } catch {}
    setTimeout(() => window.location.reload(), 900);
  }

  if (typeof window !== "undefined" && typeof window.fetch === "function" && !window.__palmtraceFetchWrapped) {
    const originalFetch = window.fetch.bind(window);
    window.__palmtraceFetchWrapped = true;
    window.fetch = async function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || String(input);
      const api = isApiUrl(url);
      let opts = init;
      const token = api ? getToken() : "";
      if (api && token) {
        const headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
        if (!headers.has("Authorization")) headers.set("Authorization", "Bearer " + token);
        opts = { ...(init || {}), headers };
      }
      const res = await originalFetch(input, opts);
      if (api && res.status === 401 && !/\/api\/auth\/(login|forgot-password|reset-password)/.test(url)) {
        handleExpiredSession();
      }
      return res;
    };
  }

  // Authenticated file download (for endpoints that cannot be opened with window.open)
  async function download(url, fallbackName) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("تعذر تنزيل الملف (" + res.status + ")");
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1]) : (fallbackName || "download");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  return { getToken, setToken, clearToken, rememberOfflineLogin, verifyOfflineLogin, forgetOfflineLogin, download };
})();
