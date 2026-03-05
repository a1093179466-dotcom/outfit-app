import { loadClothesFromStorage, saveClothesToStorage } from "./store.js";

let clothes = normalizeLoadedClothes(loadClothesFromStorage());

/**
 * 兼容旧版本数据：
 * 老数据可能是 { name, tag, image }
 * 新版本要变成 { name, type, seasons, versatile, image }
 */
function normalizeLoadedClothes(list) {
  if (!Array.isArray(list)) return [];

  return list.map((item) => {
    // 已经是新结构
    if (item && item.type && Array.isArray(item.seasons)) {
      return {
        id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: item.name || "未命名衣服",
        image: item.image || null,
        type: item.type,
        seasons: normalizeSeasons(item.seasons),
        versatile: Boolean(item.versatile),
        createdAt: item.createdAt || Date.now(),
      };
    }

    // 旧结构迁移（tag -> type）
    const inferredType = inferTypeFromOldTag(item?.tag);
    return {
      id: item?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: item?.name || "未命名衣服",
      image: item?.image || null,
      type: inferredType,
      seasons: ["spring"], // 给一个默认值，避免旧数据报错
      versatile: false,
      createdAt: item?.createdAt || Date.now(),
    };
  });
}

function inferTypeFromOldTag(tagRaw = "") {
  const tag = String(tagRaw).trim();

  if (tag === "上衣") return "top";
  if (tag === "裤子") {
    // 你新规则里暂时没有裤子，这里先映射成 skirt，保证旧数据可见可用（后面你可改成 bottoms）
    return "skirt";
  }
  if (tag === "鞋" || tag === "鞋子") return "shoes";
  if (tag === "袜子") return "socks";

  return "top";
}

function normalizeSeasons(seasons = []) {
  const allowed = ["spring", "summer", "autumn", "winter"];
  const unique = [...new Set(seasons)].filter((s) => allowed.includes(s));
  return unique.slice(0, 2); // 最多保留2个
}

export function getClothes() {
  return clothes;
}

export function addCloth({ name, image, type, seasons, versatile }) {
  const cleanName = (name || "").trim();
  const cleanType = String(type || "").trim();
  const cleanSeasons = normalizeSeasons(seasons || []);
  const cleanVersatile = Boolean(versatile);

  if (!cleanName) {
    throw new Error("衣服名称不能为空");
  }

  const allowedTypes = ["jk_set", "daily_set", "skirt", "top", "socks", "shoes"];
  if (!allowedTypes.includes(cleanType)) {
    throw new Error("衣服类型不合法");
  }

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

export function deleteClothById(id) {
  clothes = clothes.filter((item) => item.id !== id);
  saveClothesToStorage(clothes);
}

export function clearAllClothes() {
  clothes = [];
  saveClothesToStorage(clothes);
}