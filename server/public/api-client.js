(function attachApiClient(global) {
  const ACCESS_TOKEN_KEY = "auth_access_token_v1";
  const REFRESH_TOKEN_KEY = "auth_refresh_token_v1";
  const AUTH_USER_KEY = "auth_user_v1";

  function resolveBaseUrl() {
    if (global.API_BASE_URL) return String(global.API_BASE_URL);
    const host = String(global.location && global.location.hostname || "");
    const isLocal = host === "localhost" || host === "127.0.0.1";
    return isLocal ? "http://localhost:4000/api" : "/api";
  }

  const apiBaseUrl = resolveBaseUrl();

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_err) {
      return fallback;
    }
  }

  function getSession() {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || "";
    const user = readJson(AUTH_USER_KEY, null);
    return { accessToken, refreshToken, user };
  }

  function setSession(payload) {
    if (!payload) return;
    if (payload.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
    if (payload.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
    if (payload.user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user));
  }

  function clearSession() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  async function parseResponse(response) {
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const err = new Error(payload.message || `Request failed (${response.status})`);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  async function refreshAccessToken() {
    const session = getSession();
    if (!session.refreshToken) return null;

    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    });
    const payload = await parseResponse(response);
    setSession({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
    return payload.accessToken;
  }

  async function request(path, options) {
    const opts = options || {};
    const method = opts.method || "GET";
    const auth = opts.auth !== false;
    const retry = opts._retry === true;

    const headers = Object.assign({}, opts.headers || {});
    if (opts.body !== undefined) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    if (auth) {
      const token = getSession().accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });

    if (response.status === 401 && auth && !retry && getSession().refreshToken) {
      try {
        const nextAccessToken = await refreshAccessToken();
        if (nextAccessToken) {
          return request(path, Object.assign({}, opts, { _retry: true }));
        }
      } catch (_err) {
        clearSession();
      }
    }

    if (response.status === 401 && auth) {
      clearSession();
    }

    return parseResponse(response);
  }

  function requireAuth(allowedRoles) {
    const session = getSession();
    if (!session.user || !session.accessToken) {
      global.location.href = "index.html";
      return null;
    }
    if (Array.isArray(allowedRoles) && allowedRoles.length) {
      const role = String(session.user.role || "");
      if (!allowedRoles.includes(role)) {
        global.location.href = "index.html";
        return null;
      }
    }
    return session.user;
  }

  global.apiClient = {
    apiBaseUrl,
    request,
    get: (path, options) => request(path, Object.assign({}, options, { method: "GET" })),
    post: (path, body, options) => request(path, Object.assign({}, options, { method: "POST", body })),
    patch: (path, body, options) => request(path, Object.assign({}, options, { method: "PATCH", body })),
    del: (path, options) => request(path, Object.assign({}, options, { method: "DELETE" })),
    getSession,
    setSession,
    clearSession,
    refreshAccessToken,
    requireAuth
  };
})(window);
