"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { extractApiError } from "../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const AuthContext = createContext(null);
// Shared across renders so parallel 401 retries collapse into one refresh call.
let refreshInFlight = null;

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) || "";
}

function readStoredUser() {
  try {
    const value = localStorage.getItem("user");
    return value ? JSON.parse(value) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const error = new Error(extractApiError(payload) || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    // Refresh credentials are stored in a server-managed HttpOnly cookie.
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  }, []);

  const logout = useCallback(async () => {
    try {
      const csrfToken = readCookie("expertai_csrf");
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
      });
    } catch {
      // Clearing local state still protects the client if the network is down.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const persistSession = useCallback((data) => {
    const accessToken = data?.token;
    if (!accessToken) throw new Error("The sign-in response did not include an access token.");

    const userData = { ...data };
    delete userData.token;
    delete userData.refresh_token;
    setToken(accessToken);
    setUser(userData);
    localStorage.setItem("token", accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    // Clear tokens created by older clients. Refresh now uses a HttpOnly cookie.
    localStorage.removeItem("refresh_token");
    return userData;
  }, []);

  // Single-flight: parallel 401s after an expired access token must share one
  // refresh call. Otherwise the losing calls re-use the same refresh cookie and
  // the server (correctly) treats it as a stolen token, revoking the session.
  const refreshAccessToken = useCallback(async () => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: (() => {
            const csrfToken = readCookie("expertai_csrf");
            return csrfToken ? { "X-CSRF-Token": csrfToken } : undefined;
          })(),
        });
        const data = await readResponse(response);
        if (!data?.token) throw new Error("Refresh response did not include an access token.");
        setToken(data.token);
        localStorage.setItem("token", data.token);
        return data.token;
      } catch (error) {
        // Only a definitive 401 (revoked/expired session) signs the user out.
        // Network failures and server hiccups (e.g. cold starts) keep the
        // session so the next request can retry.
        if (error?.status === 401) clearSession();
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }, [clearSession]);

  const apiCall = useCallback(async (endpoint, options = {}) => {
    const request = async (accessToken) => {
      const headers = new Headers(options.headers || {});
      const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
      if (options.body && !isFormData && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      return fetch(`${API}${endpoint}`, { ...options, headers, credentials: "include" });
    };

    // Public auth endpoints return 401 for bad credentials — never treat that as
    // an expired access token or the error detail is lost in a refresh loop.
    const isPublicAuth = typeof endpoint === "string" && (
      endpoint.startsWith("/auth/signin")
      || endpoint.startsWith("/auth/signup")
      || endpoint.startsWith("/auth/forgot-password")
      || endpoint.startsWith("/auth/reset-password")
    );

    let response = await request(isPublicAuth ? null : token);
    if (!isPublicAuth && response.status === 401) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) response = await request(refreshedToken);
    }
    return readResponse(response);
  }, [refreshAccessToken, token]);

  const signup = useCallback(async (email, password, name, role = "individual", extra = {}) => {
    const data = await apiCall("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name, role, ...extra }),
    });
    persistSession(data);
    return data;
  }, [apiCall, persistSession]);

  const signin = useCallback(async (email, password) => {
    const data = await apiCall("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    persistSession(data);
    return data;
  }, [apiCall, persistSession]);

  const forgotPassword = useCallback(async (email) => {
    return apiCall("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }, [apiCall]);

  const resetPassword = useCallback(async (tokenValue, newPassword) => {
    return apiCall("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: tokenValue, new_password: newPassword }),
    });
  }, [apiCall]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiCall("/auth/me");
      if (!data?.id) return null;
      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));
      return data;
    } catch {
      return null;
    }
  }, [apiCall]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = readStoredUser();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rehydrate the session from localStorage once on mount
    if (storedToken) setToken(storedToken);
    if (storedUser) setUser(storedUser);
    // Remove legacy script-readable refresh tokens as part of the cookie migration.
    localStorage.removeItem("refresh_token");
    // Reconcile the cached profile with the server once on load so a stale
    // localStorage snapshot (e.g. a plan purchased after sign-in) is corrected.
    if (storedToken) {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data === "object" && data.id) {
            setUser(data);
            localStorage.setItem("user", JSON.stringify(data));
          }
        })
        .catch(() => {});
    }
    setLoading(false);
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    signup,
    signin,
    forgotPassword,
    resetPassword,
    logout,
    apiCall,
    refreshUser,
  }), [apiCall, forgotPassword, loading, logout, refreshUser, resetPassword, signin, signup, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
