const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Pulls the most useful human-readable message out of an API error payload.
 * FastAPI validation errors arrive as {detail, errors: [{loc, msg}]}; most
 * other failures carry a plain {detail}. Returns an empty string if none.
 */
export function extractApiError(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const messages = payload.errors
      .map((error) => error?.msg)
      .filter((msg) => typeof msg === "string" && msg.length > 0);
    if (messages.length > 0) return messages.join(" ");
  }
  if (typeof payload.detail === "string" && payload.detail.length > 0) return payload.detail;
  if (typeof payload.message === "string" && payload.message.length > 0) return payload.message;
  return "";
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(prefix))
      ?.slice(prefix.length) || ""
  );
}

async function refreshAccessToken() {
  try {
    const csrfToken = readCookie("expertai_csrf");
    const response = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (!data?.token) return null;
    localStorage.setItem("token", data.token);
    return data.token;
  } catch {
    return null;
  }
}

/**
 * fetch that attaches the stored access token and transparently retries once
 * through /auth/refresh when the access token has expired (HTTP 401).
 */
export async function authorizedFetch(url, options = {}) {
  const request = (token) => {
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (options.body && !isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(url, { ...options, headers, credentials: "include" });
  };

  let response = await request(getToken());
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await request(refreshed);
    } else {
      localStorage.removeItem("token");
    }
  }
  return response;
}