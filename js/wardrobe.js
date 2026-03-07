// js/wardrobe.js

import { loadClothesFromStorage, saveClothesToStorage } from "./store.js";
import {
  apiListClothes,
  apiCreateCloth,
  apiUpdateCloth,
  apiDeleteCloth,
  apiUploadClothImage,
} from "./api_client.js";

let clothes = [];

/** ===== Helpers ===== */

function inferKindFromType(type) {
  if (type === "jk_set" || type === "daily_set") return type;
  if (type === "top") return "inner";
  if (type === "skirt" || type === "pants") return "bottom";
  if (type === "socks") return "socks";
  if (type === "shoes") return "shoes";
  return "inner";
}

function normalizeSeasons(seasons = []) {
  const allowed = ["spring", "summer", "autumn", "winter"];
  const unique = [...new Set(seasons)].filter((s) => allowed.includes(s));
  // ✅ 新规则：允许 1~4 个
  return unique.slice(0, 4);
}

function normalizeFromApi(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeOneFromApi);
}

function normalizeOneFromApi(x) {
  return {
    id: x.id,
    name: x.name,
    // 兼容旧字段：有就带着
    type: x.type || null,
    // ✅ 新字段：kind 是你的主分类
    kind: x.kind || inferKindFromType(x.type),
    seasons: Array.isArray(x.seasons) ? x.seasons : ["spring"],
    image: x.image_url || null,
    createdAt: x.created_at || Date.now(),
  };
}

/** ===== Init / Read ===== */

/**
 * Step A：启动时从后端拉取衣柜
 * - 如果后端不可用：回退到本地 store（方便离线/调试）
 */
export async function initWardrobeFromApi() {
  try {
    const data = await apiListClothes();
    clothes = normalizeFromApi(data);
    // 缓存到本地，后端挂了也能显示最近数据
    saveClothesToStorage(clothes);
  } catch (err) {
    console.warn("后端读取失败，回退到本地存储：", err);
    clothes = loadClothesFromStorage();
  }
}

export function getClothes() {
  return clothes;
}

export function getClothById(id) {
  return clothes.find((c) => c.id === id) || null;
}

/** ===== Local CRUD (fallback / offline) ===== */

export function addCloth({ name, image, type, kind, seasons }) {
  const cleanName = (name || "").trim();
  if (!cleanName) throw new Error("衣服名称不能为空");

  const cleanSeasons = normalizeSeasons(seasons || []);
  if (cleanSeasons.length < 1 || cleanSeasons.length > 4) {
    throw new Error("季节标签必须选择 1~4 个");
  }

  const cleanKind = String(kind || "").trim() || inferKindFromType(type);

  const cloth = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: cleanName,
    type: type || null,
    kind: cleanKind,
    seasons: cleanSeasons,
    image: image || null,
    createdAt: Date.now(),
  };

  clothes.push(cloth);
  saveClothesToStorage(clothes);
  return cloth;
}

export function updateClothById(id, patch) {
  const idx = clothes.findIndex((c) => c.id === id);
  if (idx === -1) return;

  const old = clothes[idx];
  const next = { ...old, ...patch };

  if (patch.seasons) {
    const normalized = normalizeSeasons(patch.seasons);
    if (normalized.length < 1 || normalized.length > 4) {
      throw new Error("季节标签必须选择 1~4 个");
    }
    next.seasons = normalized;
  }

  clothes[idx] = next;
  saveClothesToStorage(clothes);
}

export function deleteClothById(id) {
  clothes = clothes.filter((item) => item.id !== id);
  saveClothesToStorage(clothes);
}

export function clearAllClothes() {
  clothes = [];
  saveClothesToStorage(clothes);
}

/** ===== Remote CRUD (DB) ===== */

/**
 * 创建衣服（写 DB）
 * payload: { name, kind, seasons }
 * 兼容：如果你后端还要求 type，可以在 api_client 里一起传
 */
export async function remoteCreateCloth(payload) {
  const created = await apiCreateCloth(payload);
  const normalized = normalizeOneFromApi(created);

  clothes.unshift(normalized);
  saveClothesToStorage(clothes);

  return normalized;
}

export async function remoteUpdateClothById(id, patch) {
  const updated = await apiUpdateCloth(id, patch);
  const normalized = normalizeOneFromApi(updated);

  const idx = clothes.findIndex((c) => c.id === id);
  if (idx !== -1) clothes[idx] = { ...clothes[idx], ...normalized };
  else clothes.unshift(normalized);

  saveClothesToStorage(clothes);
  return clothes[idx] || normalized;
}

export async function remoteUploadImage(id, file) {
  const updated = await apiUploadClothImage(id, file);
  const normalized = normalizeOneFromApi(updated);

  const idx = clothes.findIndex((c) => c.id === id);
  if (idx !== -1) clothes[idx] = { ...clothes[idx], ...normalized };
  else clothes.unshift(normalized);

  saveClothesToStorage(clothes);
  return clothes[idx] || normalized;
}

export async function remoteDeleteClothById(id) {
  await apiDeleteCloth(id);
  clothes = clothes.filter((c) => c.id !== id);
  saveClothesToStorage(clothes);
}