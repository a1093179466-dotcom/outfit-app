import { addCloth, deleteClothById, getClothes } from "./wardrobe.js";
import { generateOutfit } from "./outfit.js";
import { renderWardrobe, renderOutfit } from "./ui.js";

const clothNameInput = document.getElementById("clothName");
const clothImageInput = document.getElementById("clothImage");
const clothTypeSelect = document.getElementById("clothType");
const clothVersatileInput = document.getElementById("clothVersatile");

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
      alert(error.message);
    }
  }
}

function handleGenerateOutfit() {
  const clothes = getClothes();
  const outfit = generateOutfit(clothes);
  renderOutfit(outfit);
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