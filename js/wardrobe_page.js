// js/wardrobe_page.js
import {
  getClothes,
  getClothById,
  initWardrobeFromApi,
  remoteUpdateClothById,
  remoteUploadImage,
  remoteDeleteClothById,
} from "./wardrobe.js";

/** ✅ 一定要放在最上面 */
const el = (id) => document.getElementById(id);

/** Filters */
const qName = el("qName");
const fType = el("fType");
const fSeason = el("fSeason");
const fVersatile = el("fVersatile");
const groupByType = el("groupByType");

/** List */
const detailList = el("detailList");

/** Editor */
const editor = el("editor");
const editorPreview = el("editorPreview");

const eName = el("eName");
const eType = el("eType");
const eVersatile = el("eVersatile");
const eImage = el("eImage");
const saveBtn = el("saveBtn");
const deleteBtn = el("deleteBtn");
const editorHint = el("editorHint");

/** Step1 new fields */
const eCategory = el("eCategory");
const eLayer = el("eLayer");
const eVLevel = el("eVLevel");

let selectedId = null;

init();

/** ✅ init 也要 async，且 await 拉后端数据 */
async function init() {
  await initWardrobeFromApi();
  render();

  [qName, fType, fSeason, fVersatile, groupByType].forEach((x) => {
    if (!x) return;
    x.addEventListener("input", render);
    x.addEventListener("change", render);
  });

  saveBtn?.addEventListener("click", onSave);
  deleteBtn?.addEventListener("click", onDelete);
}

function filteredClothes() {
  const nameQuery = (qName?.value || "").trim().toLowerCase();
  const type = fType?.value || "";
  const season = fSeason?.value || "";
  const onlyVers = !!fVersatile?.checked;

  return getClothes().filter((c) => {
    if (nameQuery && !String(c.name || "").toLowerCase().includes(nameQuery)) return false;
    if (type && c.type !== type) return false;
    if (season && !(c.seasons || []).includes(season)) return false;
    if (onlyVers && !c.versatile) return false;
    return true;
  });
}

function render() {
  const list = filteredClothes();
  detailList.innerHTML = "";

  if (list.length === 0) {
    detailList.innerHTML = `<div class="empty-tip">没有符合条件的衣服</div>`;
    return;
  }

  if (groupByType?.checked) {
    const groups = groupBy(list, (c) => c.type);
    Object.keys(groups)
      .sort()
      .forEach((type) => {
        const group = document.createElement("div");
        group.className = "group";
        group.innerHTML = `<div class="group-title">${formatType(type)}（${groups[type].length}）</div>`;

        const grid = document.createElement("div");
        grid.className = "detail-grid";
        groups[type].forEach((c) => grid.appendChild(makeCard(c)));

        group.appendChild(grid);
        detailList.appendChild(group);
      });
  } else {
    const grid = document.createElement("div");
    grid.className = "detail-grid";
    list.forEach((c) => grid.appendChild(makeCard(c)));
    detailList.appendChild(grid);
  }
}

function makeCard(cloth) {
  const card = document.createElement("div");
  card.className = "cloth-card";

  const img = cloth.image ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">` : "";
  card.innerHTML = `
    ${img}
    <div class="cloth-name">${escapeHtml(cloth.name)}</div>
    <div class="meta-line">季节：${formatSeasons(cloth.seasons)}</div>
    <div class="meta-line">百搭：${cloth.versatile ? "是" : "否"}</div>
    <div class="meta-line"><span class="tag">${formatType(cloth.type)}</span></div>
  `;

  card.addEventListener("click", () => openEditor(cloth.id));
  return card;
}

function openEditor(id) {
  const cloth = getClothById(id);
  if (!cloth) return;

  selectedId = id;
  editor?.setAttribute("aria-hidden", "false");

  editorPreview.innerHTML = cloth.image
    ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}"><div class="cloth-name">${escapeHtml(cloth.name)}</div>`
    : `<div class="empty-tip">无图片预览</div><div class="cloth-name">${escapeHtml(cloth.name)}</div>`;

  eName.value = cloth.name || "";
  eType.value = cloth.type;
  eVersatile.checked = !!cloth.versatile;
  eImage.value = "";

  setSeasonChecks(cloth.seasons || []);

  // Step1 fields（如果后端还没返回这些字段，也做兼容）
  eCategory.value = cloth.category || inferCategoryFromType(cloth.type);
  eLayer.value = cloth.layer || inferLayerFromType(cloth.type);
  eVLevel.value = String(cloth.versatile_level ?? (cloth.versatile ? 2 : 0));
  setFeatureChecks(cloth.features || []);

  editorHint.textContent = "";
}

async function onSave() {
  if (!selectedId) return;

  const name = (eName.value || "").trim();
  if (!name) {
    editorHint.textContent = "名称不能为空";
    return;
  }

  const type = eType.value;
  const seasons = getEditorSeasons();
  if (seasons.length < 1 || seasons.length > 2) {
    editorHint.textContent = "季节必须选择 1~2 个";
    return;
  }

  const versatile = eVersatile.checked;

  // Step1 new fields
  const category = eCategory.value;
  const layer = eLayer.value;
  const versatile_level = Number(eVLevel.value);
  const features = getEditorFeatures();

  editorHint.textContent = "保存中…";

  try {
    await remoteUpdateClothById(selectedId, {
      name,
      type,
      seasons,
      versatile,
      category,
      layer,
      features,
      versatile_level,
    });

    const file = eImage.files?.[0];
    if (file) {
      await remoteUploadImage(selectedId, file);
    }

    editorHint.textContent = "已保存 ✅";
    render();
    openEditor(selectedId);
  } catch (e) {
    console.error(e);
    editorHint.textContent = `保存失败：${e.message || e}`;
  }
}

async function onDelete() {
  if (!selectedId) return;

  editorHint.textContent = "删除中…";

  try {
    await remoteDeleteClothById(selectedId);
    const deletedId = selectedId;
    selectedId = null;

    editorPreview.innerHTML = `<div class="empty-tip">已删除：${deletedId}</div>`;
    editorHint.textContent = "已删除 ✅";
    render();
  } catch (e) {
    console.error(e);
    editorHint.textContent = `删除失败：${e.message || e}`;
  }
}

function getEditorSeasons() {
  const checked = document.querySelectorAll('input[name="eSeason"]:checked');
  return Array.from(checked).map((x) => x.value);
}

function setSeasonChecks(seasons) {
  document.querySelectorAll('input[name="eSeason"]').forEach((cb) => {
    cb.checked = (seasons || []).includes(cb.value);
  });
}

function getEditorFeatures() {
  const checked = document.querySelectorAll('input[name="eFeature"]:checked');
  return Array.from(checked).map((x) => x.value);
}

function setFeatureChecks(features) {
  document.querySelectorAll('input[name="eFeature"]').forEach((cb) => {
    cb.checked = (features || []).includes(cb.value);
  });
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, x) => {
    const k = keyFn(x);
    (acc[k] ||= []).push(x);
    return acc;
  }, {});
}

function formatType(type) {
  const map = {
    jk_set: "JK套装",
    daily_set: "日常套装",
    skirt: "单裙子",
    top: "单上衣",
    socks: "袜子",
    shoes: "鞋子",
  };
  return map[type] || type;
}

function formatSeasons(seasons = []) {
  const map = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  return (seasons || []).map((s) => map[s] || s).join(" / ");
}

function inferCategoryFromType(type) {
  const map = { jk_set: "dress", daily_set: "dress", top: "top", skirt: "skirt", shoes: "shoes", socks: "socks" };
  return map[type] || "top";
}

function inferLayerFromType(type) {
  const map = { jk_set: "none", daily_set: "none", top: "inner", skirt: "none", shoes: "none", socks: "none" };
  return map[type] || "inner";
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}