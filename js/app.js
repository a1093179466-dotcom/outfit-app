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

// 表单元素
const clothNameInput = document.getElementById("clothName");
const clothImageInput = document.getElementById("clothImage");
const clothTypeSelect = document.getElementById("clothType");
const clothVersatileInput = document.getElementById("clothVersatile");

// 按钮
const addClothBtn = document.getElementById("addClothBtn");
const generateBtn = document.getElementById("generateBtn");

init();

async function init() {
  await initWardrobeFromApi();
  refreshWardrobeView();

  addClothBtn.addEventListener("click", handleAddCloth);
  generateBtn.addEventListener("click", handleGenerateOutfit);
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
  const outfit = generateOutfit(clothes);

  console.log("generateOutfit result:", outfit);
  renderOutfit(outfit);

  const hint = document.getElementById("outfitHint");
  if (hint) hint.textContent = "已生成：" + new Date().toLocaleTimeString();
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