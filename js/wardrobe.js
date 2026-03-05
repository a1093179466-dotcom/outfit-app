import { loadClothesFromStorage, saveClothesToStorage } from "./store.js";

let clothes = loadClothesFromStorage();

function normalizeTag(tagRaw = "") {
  const tag = tagRaw.trim();

  // 先做兼容，后续你做复杂TAG时这里会升级
  if (tag === "鞋") return "鞋子";
  return tag;
}

export function getClothes() {
  return clothes;
}

export function addCloth({ name, tag, image }) {
  const cleanName = (name || "").trim();
  const cleanTag = normalizeTag(tag);

  if (!cleanName) {
    throw new Error("衣服名称不能为空");
  }
  if (!cleanTag) {
    throw new Error("tag 不能为空");
  }

  const cloth = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: cleanName,
    tag: cleanTag,
    image: image || null,
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