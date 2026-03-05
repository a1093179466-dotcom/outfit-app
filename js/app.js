import { addCloth, deleteClothById, getClothes } from "./wardrobe.js";
import { generateOutfit } from "./outfit.js";
import { renderWardrobe, renderOutfit } from "./ui.js";

const clothNameInput = document.getElementById("clothName");
const clothTagInput = document.getElementById("clothTag");
const clothImageInput = document.getElementById("clothImage");
const addClothBtn = document.getElementById("addClothBtn");
const generateBtn = document.getElementById("generateBtn");

init();

function init() {
  refreshWardrobeView();

  addClothBtn.addEventListener("click", handleAddCloth);
  generateBtn.addEventListener("click", handleGenerateOutfit);
}

function refreshWardrobeView() {
  renderWardrobe(getClothes(), {
    onDelete: (id) => {
      deleteClothById(id);
      refreshWardrobeView();
    },
  });
}

function handleAddCloth() {
  const name = clothNameInput.value.trim();
  const tag = clothTagInput.value.trim();
  const file = clothImageInput.files?.[0];

  if (!name) {
    alert("衣服名称不能为空");
    return;
  }

  if (!tag) {
    alert("tag 不能为空（先用：上衣 / 裤子 / 鞋子）");
    return;
  }

  // 有图片就先读取，再添加；无图片直接添加
  if (file) {
    readFileAsDataURL(file)
      .then((imageDataUrl) => {
        addCloth({ name, tag, image: imageDataUrl });
        clearForm();
        refreshWardrobeView();
      })
      .catch((error) => {
        console.error(error);
        alert("图片读取失败，请重试。");
      });
  } else {
    try {
      addCloth({ name, tag, image: null });
      clearForm();
      refreshWardrobeView();
    } catch (error) {
      alert(error.message);
    }
  }
}

function handleGenerateOutfit() {
  const clothes = getClothes();
  const outfit = generateOutfit(clothes);
  renderOutfit(outfit);
}

function clearForm() {
  clothNameInput.value = "";
  clothTagInput.value = "";
  clothImageInput.value = "";
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}