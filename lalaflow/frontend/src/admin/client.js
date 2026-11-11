import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../api.js";

const TOKEN_KEY = "lalaflow.token";
const USER_KEY = "lalaflow.user";

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Cannot read ${key} from localStorage: ${error.message}`);
    return null;
  }
}

export const session = {
  token: () => readStorage(TOKEN_KEY),
  user() {
    const raw = readStorage(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, status, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// JSON request with the stored bearer token. `form` sends multipart (product images).
export async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = session.token();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) onUnauthorized();
  if (!response.ok) throw new ApiError(data.error || `${method} ${path} thất bại (${response.status})`, response.status, data.code);
  return data;
}

export async function requestBlob(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${session.token()}` } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || `GET ${path} thất bại (${response.status})`, response.status);
  }
  return response.blob();
}

// Loads one endpoint for a screen; pass null to skip (e.g. when the user lacks the permission).
export function useApi(path) {
  const [state, setState] = useState({ data: null, status: path ? "loading" : "idle", error: "" });
  const reload = useCallback(async () => {
    if (!path) return;
    setState((current) => ({ ...current, status: current.data ? "refreshing" : "loading" }));
    try {
      const data = await request(path);
      setState({ data, status: "ready", error: "" });
    } catch (error) {
      setState({ data: null, status: "error", error: error.message });
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...state, reload };
}

export function canAccess(user, permission) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const granted = user.permissions || [];
  if (granted.includes("*")) return true;
  const wanted = Array.isArray(permission) ? permission : [permission];
  return wanted.some((key) => granted.includes(key));
}

export const isAdmin = (user) => user?.role === "admin";
