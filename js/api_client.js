// js/api_client.js
const API_BASE = "http://127.0.0.1:8000";

async function requestJson(path, { method = "GET", body = null, headers = {} } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function apiListClothes() {
  return requestJson("/api/clothes");
}

export async function apiUpdateCloth(clothId, patch) {
  return requestJson(`/api/clothes/${clothId}`, { method: "PUT", body: patch });
}

export async function apiDeleteCloth(clothId) {
  const res = await fetch(`${API_BASE}/api/clothes/${clothId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API DELETE /api/clothes/${clothId} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function apiUploadClothImage(clothId, file) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/clothes/${clothId}/image`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API POST /api/clothes/${clothId}/image failed: ${res.status} ${text}`);
  }
  return res.json(); // ClothOut
}

export async function apiCreateCloth(payload) {
  // payload: {name, type, seasons, versatile}
  return requestJson("/api/clothes", { method: "POST", body: payload });
}

export async function apiCreateOutfit(payload) {
  return requestJson("/api/outfits", { method: "POST", body: payload });
}

export async function apiListOutfits(limit = 30) {
  return requestJson(`/api/outfits?limit=${limit}`);
}

export async function apiDeleteOutfit(id) {
  const res = await fetch(`${API_BASE}/api/outfits/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API DELETE /api/outfits/${id} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Pair rules APIs
export async function apiListPairRules(clothId) {
  return requestJson(`/api/pair-rules?cloth_id=${encodeURIComponent(clothId)}`, { method: "GET" });
}

export async function apiUpsertPairRule(clothId, payload) {
  // payload: { other_id, rule: "allow"|"deny", note? }
  return requestJson(`/api/pair-rules/${encodeURIComponent(clothId)}`, {
    method: "POST",
    body: payload,
  });
}

export async function apiDeletePairRule(ruleId) {
  const res = await fetch(`${API_BASE}/api/pair-rules/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API DELETE /api/pair-rules/${ruleId} failed: ${res.status} ${text}`);
  }
  return res.json();
}