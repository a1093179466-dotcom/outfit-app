const STORAGE_KEY = "clothes_v1";

export function loadClothesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("读取本地衣柜数据失败：", error);
    return [];
  }
}

export function saveClothesToStorage(clothes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clothes));
  } catch (error) {
    console.error("保存本地衣柜数据失败：", error);
    alert("保存失败：可能是图片太大导致 localStorage 空间不足。");
  }
}