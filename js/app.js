// js/app.js
import {
  addCloth,
  deleteClothById,
  getClothes,
  initWardrobeFromApi,
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

/**
 * 初始化：
 * 1) 从后端读取衣柜（Step A）
 * 2) 渲染衣柜
 * 3) 绑定事件
 */
async function init() {
  await initWardrobeFromApi();
  refreshWardrobeView();

  addClothBtn.addEventListener("click", handleAddCloth);
  generateBtn.addEventListener("click", handleGenerateOutfit);
}

function refreshWardrobeView() {
  renderWardrobe(getClothes(), {
    onDelete: (id) => {
      // Step A 暂时仍是本地删除（不会影响后端数据）
      deleteClothById(id);
      refreshWardrobeView();
    },
  });
}

/**
 * 添加衣服（Step A 版本：仍写本地内存+localStorage）
 * 后续 Step B 会改成：POST /api/clothes + POST /image
 */
function handleAddCloth() {
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

  if (file) {
    readFileAsDataURL(file)
      .then((imageDataUrl) => {
        addCloth({ name, type, seasons, versatile, image: imageDataUrl });
        clearForm();
        refreshWardrobeView();
      })
      .catch((error) => {
        console.error(error);
        alert("图片读取失败，请重试。");
      });
  } else {
    try {
      addCloth({ name, type, seasons, versatile, image: null });
      clearForm();
      refreshWardrobeView();
    } catch (error) {
      alert(error.message || "添加失败");
    }
  }
}

/**
 * 生成今日穿搭：纯前端逻辑
 * 一定会 console.log，方便你确认是否点击生效
 */
function handleGenerateOutfit() {
  const clothes = getClothes();
  const outfit = generateOutfit(clothes);

  console.log("generateOutfit result:", outfit); // ✅ 你可以在F12控制台看到

  renderOutfit(outfit);

  // 可选：给页面一个“有反应”的提示（如果你的主页有 outfitHint）
  const hint = document.getElementById("outfitHint");
  if (hint) {
    hint.textContent = "已生成（基础规则）：" + new Date().toLocaleTimeString();
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

  document.querySelectorAll('input[name="season"]').forEach((cb) => {
    cb.checked = false;
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}