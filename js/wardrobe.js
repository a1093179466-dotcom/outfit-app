// js/wardrobe.js
import { loadClothesFromStorage, saveClothesToStorage } from "./store.js";
import { apiListClothes } from "./api_client.js";

let clothes = [];

/**
 * 统一把数据变成前端使用的结构：
 * - 前端 UI 使用 cloth.image 来渲染图片
 * - 后端返回的是 image_url，我们映射到 image
 */
function normalizeFromApi(list) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => ({
    id: x.id,
    name: x.name,
    type: x.type,
    seasons: Array.isArray(x.seasons) ? x.seasons : ["spring"],
    versatile: !!x.versatile,
    image: x.image_url || null, // ✅ 关键：后端 image_url -> 前端 image
    createdAt: x.created_at || Date.now(),
  }));
}

/**
 * Step A：启动时从后端拉取衣柜
 * - 如果后端不可用：自动降级读取本地 store（方便你离线调试）
 */
export async function initWardrobeFromApi() {
  try {
    const data = await apiListClothes();
    clothes = normalizeFromApi(data);
    // 可选：写入本地缓存，方便你后端挂了也能看见最近数据
    saveClothesToStorage(clothes);
  } catch (err) {
    console.warn("后端读取失败，回退到本地存储：", err);
    clothes = loadClothesFromStorage();
  }
}

export function getClothes() {
  return clothes;
}

/* 下面保留你原有的写入接口（Step A 不动），Step B 再改成走 API */

function normalizeSeasons(seasons = []) {
  const allowed = ["spring", "summer", "autumn", "winter"];
  const unique = [...new Set(seasons)].filter((s) => allowed.includes(s));
  return unique.slice(0, 2);
}

export function addCloth({ name, image, type, seasons, versatile }) {
  const cleanName = (name || "").trim();
  const cleanType = String(type || "").trim();
  const cleanSeasons = normalizeSeasons(seasons || []);
  const cleanVersatile = Boolean(versatile);

  if (!cleanName) throw new Error("衣服名称不能为空");

  const allowedTypes = ["jk_set", "daily_set", "skirt", "top", "socks", "shoes"];
  if (!allowedTypes.includes(cleanType)) throw new Error("衣服类型不合法");

  if (cleanSeasons.length < 1 || cleanSeasons.length > 2) {
    throw new Error("季节标签必须选择 1~2 个");
  }

  const cloth = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: cleanName,
    image: image || null,
    type: cleanType,
    seasons: cleanSeasons,
    versatile: cleanVersatile,
    createdAt: Date.now(),
  };

  clothes.push(cloth);
  saveClothesToStorage(clothes);
  return cloth;
}

export function getClothById(id) {
  return clothes.find((c) => c.id === id) || null;
}

export function updateClothById(id, patch) {
  const idx = clothes.findIndex((c) => c.id === id);
  if (idx === -1) return;

  const old = clothes[idx];
  const next = { ...old, ...patch };

  if (patch.seasons) {
    const normalized = normalizeSeasons(patch.seasons);
    if (normalized.length < 1 || normalized.length > 2) {
      throw new Error("季节标签必须选择 1~2 个");
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