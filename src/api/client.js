/*
 * The one axios instance used for every call to the Django API.
 * Login / JWT flow:
 * 1. Login returns an access token (short life) and a refresh token (long life).
 * 2. Both are saved with tokenStore, and the request interceptor adds
 *    'Authorization: Bearer <access>' to every request.
 * 3. When the API answers 401 (access token expired), the response interceptor
 *    asks /auth/refresh/ for a new access token and repeats the failed request.
 * 4. If the refresh fails too, the tokens are removed and an 'auth:logout'
 *    event tells AuthContext to sign the user out.
 */
import axios from "axios";

// Address of the Django API. Set VITE_API_BASE_URL in a .env file for production.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
// The localStorage name under which the two tokens are saved as JSON.
const STORAGE_KEY = "attendance.tokens";

// Tokens live in localStorage so a refresh keeps you signed in. (See README "Security notes".)
// Small helper around localStorage. Every call is wrapped in try/catch because
// localStorage can be blocked (for example in private mode).
export const tokenStore = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  },
  set(tokens) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch {
      /* storage unavailable: the user simply has to sign in again next time */
    }
  },
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

// Pages call api.get('/students/') and so on; the base address is added for them.
const api = axios.create({ baseURL: API_BASE });

// Runs before every request: attach the access token if we have one.
api.interceptors.request.use((config) => {
  const tokens = tokenStore.get();
  if (tokens?.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

// On 401, try one token refresh (shared by all requests that fail at the same time), then retry.
// `refreshing` is the refresh request running right now (or null). If five calls fail with
// 401 at the same moment, they all wait for this one refresh instead of sending five.
let refreshing = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    // Login, refresh and logout calls must never trigger a refresh themselves (that would loop).
    const isAuthCall = original?.url?.includes("/auth/");
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      // Mark this request so it is retried only once.
      original._retried = true;
      const tokens = tokenStore.get();
      if (tokens?.refresh) {
        try {
          refreshing =
            refreshing ||
            axios
              .post(`${API_BASE}/auth/refresh/`, { refresh: tokens.refresh })
              .finally(() => {
                refreshing = null;
              });
          const { data } = await refreshing;
          // The server may rotate the refresh token. Keep the old one if no new one came.
          tokenStore.set({ access: data.access, refresh: data.refresh || tokens.refresh });
          original.headers.Authorization = `Bearer ${data.access}`;
          // Send the original request again, now with the new access token.
          return api(original);
        } catch {
          /* refresh failed: fall through to sign-out */
        }
      }
      // No refresh token, or the refresh failed: the session is over.
      // AuthContext listens for this event and shows the login page.
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:logout"));
    }
    // Every other error goes back to the caller (usually shown with parseError).
    return Promise.reject(error);
  }
);

export default api;
