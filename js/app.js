// js/app.js

import {
  getClothes,
  initWardrobeFromApi,
  remoteCreateCloth,
  remoteUploadImage,
  remoteDeleteClothById,
} from "./wardrobe.js";
import { generateOutfit } from "./outfit.js";
import { renderWardrobe, renderOutfit } from "./ui.js";
import { initHistoryUI } from "./history.js";

let currentOutfitIds = [];

// 表单元素
const clothNameInput = document.getElementById("clothName");
const clothImageInput = document.getElementById("clothImage");
const clothTypeSelect = document.getElementById("clothType");
const clothVersatileInput = document.getElementById("clothVersatile");
const seasonSelect = document.getElementById("seasonSelect");
// 按钮
const addClothBtn = document.getElementById("addClothBtn");
const generateBtn = document.getElementById("generateBtn");

init();

async function init() {
  await initWardrobeFromApi();
  refreshWardrobeView();

  addClothBtn.addEventListener("click", handleAddCloth);
  generateBtn.addEventListener("click", handleGenerateOutfit);
  await initHistoryUI({
  getClothesMap: () => {
    const m = {};
    getClothes().forEach(c => (m[c.id] = c));
    return m;
  },
  getCurrentOutfitIds: () => currentOutfitIds,
  onRestore: (ids) => {
    restoreOutfitFromHistory(ids);
  },
});
}

function refreshWardrobeView() {
  renderWardrobe(getClothes(), {
    onDelete: async (id) => {
      // ✅ B2：主页删除也写入 DB（推荐）
      try {
        await remoteDeleteClothById(id);
        refreshWardrobeView();
      } catch (e) {
        console.error(e);
        alert(`删除失败：${e.message || e}`);
      }
    },
  });
}

// ✅ B2：新增衣服写 DB（POST），图片走 /image
async function handleAddCloth() {
  const name = clothNameInput.value.trim();
  const type = clothTypeSelect.value;
  const versatile = clothVersatileInput.checked;
  const seasons = getSelectedSeasons();
  const file = clothImageInput.files?.[0];

  if (!name) {
    alert("衣服名称不能为空");
    return;
  }
  if (seasons.length < 1 || seasons.length > 2) {
    alert("季节标签必须选择 1~2 个");
    return;
  }

  addClothBtn.disabled = true;
  addClothBtn.textContent = "添加中…";

  try {
    // 1) 先创建衣服记录（拿到 id）
    const created = await remoteCreateCloth({ name, type, seasons, versatile });

    // 2) 如果选择了图片，再上传图片（返回更新后的 cloth）
    if (file) {
      await remoteUploadImage(created.id, file);
    }

    clearForm();
    refreshWardrobeView();
  } catch (e) {
    console.error(e);
    alert(`添加失败：${e.message || e}`);
  } finally {
    addClothBtn.disabled = false;
    addClothBtn.textContent = "添加衣服";
  }
}

function handleGenerateOutfit() {
  const clothes = getClothes();
  const season = seasonSelect ? seasonSelect.value : "";
  const outfit = generateOutfit(clothes, season);

  console.log("generateOutfit result:", outfit, "season:", season);
  renderOutfit(outfit);

  // 更新 currentOutfitIds（你已有逻辑就保持）
  const ids = [];
  if (outfit.main1?.id) ids.push(outfit.main1.id);
  if (outfit.main2?.id) ids.push(outfit.main2.id);
  if (outfit.shoes?.id) ids.push(outfit.shoes.id);
  if (outfit.socks?.id) ids.push(outfit.socks.id);
  currentOutfitIds = ids;

  const hint = document.getElementById("outfitHint");
  if (hint) {
    hint.textContent = season
      ? `按季节生成：${season}（${new Date().toLocaleTimeString()}）`
      : `已生成（不过滤）：${new Date().toLocaleTimeString()}`;
  }
}

function getSelectedSeasons() {
  const checked = document.querySelectorAll('input[name="season"]:checked');
  return Array.from(checked).map((el) => el.value);
}

function clearForm() {
  clothNameInput.value = "";
  clothImageInput.value = "";
  clothTypeSelect.value = "jk_set";
  clothVersatileInput.checked = false;
  document.querySelectorAll('input[name="season"]').forEach((cb) => (cb.checked = false));
}

function restoreOutfitFromHistory(ids) {
  const clothes = getClothes();
  const byId = new Map(clothes.map(c => [c.id, c]));

  const picked = (ids || []).map(id => byId.get(id)).filter(Boolean);

  // 按 type 归类
  const sets = picked.filter(c => c.type === "jk_set" || c.type === "daily_set");
  const tops = picked.filter(c => c.type === "top");
  const skirts = picked.filter(c => c.type === "skirt");
  const shoes = picked.find(c => c.type === "shoes") || null;
  const socks = picked.find(c => c.type === "socks") || null;

  // 组装成 outfit.js 同款结构
  const restored = {
    main1: sets[0] || tops[0] || null,
    main2: sets.length > 0 ? null : (skirts[0] || null),
    shoes,
    socks,
  };

  // 更新当前穿搭ID（只保存存在的）
  const newIds = [];
  if (restored.main1?.id) newIds.push(restored.main1.id);
  if (restored.main2?.id) newIds.push(restored.main2.id);
  if (restored.shoes?.id) newIds.push(restored.shoes.id);
  if (restored.socks?.id) newIds.push(restored.socks.id);
  currentOutfitIds = newIds;

  renderOutfit(restored);

  const hint = document.getElementById("outfitHint");
  if (hint) hint.textContent = "已从历史恢复：" + new Date().toLocaleTimeString();
}