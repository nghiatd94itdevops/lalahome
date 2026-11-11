// The built site is served by the :8000 server, which forwards /api to the backend; staying same-origin keeps it
// working behind a tunnel such as ngrok, where "localhost:4000" would point at the visitor's own device.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:4000" : "/api");

// The painted cover lives in the LalaHome site on :8000; in `vite dev` the page runs elsewhere, so point there.
const HOME_ORIGIN = import.meta.env.DEV ? "http://localhost:8000" : "";
export const HOME_URL = `${HOME_ORIGIN}/`;
// The speech service (speech-to-text WebSocket and text-to-speech) is the same :8000 server as the cover.
export const SPEECH_ORIGIN = HOME_ORIGIN || window.location.origin;
// A still of the cover with the LALAHOME sign baked in (the live cover draws the sign as SVG).
export const HOME_ART = `${HOME_ORIGIN}/assets/home/cover-baked.jpg?v=e62a8ccb`;

export function imageUrl(path) {
  if (!path) return "";
  return /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
}

export async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`);
  return response.json();
}

export async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

export const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "");
export const splitList = (text) => String(text || "").split("|").map((item) => item.trim()).filter(Boolean);
export const phoneHref = (phone) => `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
