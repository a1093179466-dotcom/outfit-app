// js/app.js

import { initWardrobeFromApi, getClothes } from "./wardrobe.js";
import { generateOutfit } from "./outfit.js";
import { renderWardrobe, renderOutfit } from "./ui.js";

const seasonSelect = document.getElementById("seasonSelect");
const generateBtn = document.getElementById("generateBtn");
const hint = document.getElementById("outfitHint");

init();

async function init() {
  await initWardrobeFromApi();
  renderWardrobe(getClothes());

  generateBtn.addEventListener("click", () => {
    const season = seasonSelect.value;
    const outfit = generateOutfit(getClothes(), season);
    renderOutfit(outfit);

    hint.textContent = `已生成（季节：${seasonToZh(season)}，完全随机）`;
  });
}

function seasonToZh(s) {
  const map = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  return map[s] || s;
}