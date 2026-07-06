// Relative URLs work in dev (Vite proxy) and in production (nginx proxies /api).
const BASE = "/api";

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${msg}`);
  }
  return res.json();
}

export function getCurrent(deviceId) {
  const q = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  return getJSON(`/current${q}`);
}

export function getHistory(hours = 24, deviceId) {
  const params = new URLSearchParams({ hours: String(hours) });
  if (deviceId) params.set("device_id", deviceId);
  return getJSON(`/history?${params.toString()}`);
}
