// js/api_client.js
const API_BASE = "http://127.0.0.1:8000"; // 需要时改成你的云电脑IP

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function apiListClothes() {
  return fetchJson("/api/clothes");
}