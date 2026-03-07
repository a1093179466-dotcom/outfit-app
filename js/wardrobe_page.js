// js/wardrobe_page.js

import {
  getClothes,
  getClothById,
  initWardrobeFromApi,
  remoteUpdateClothById,
  remoteUploadImage,
  remoteDeleteClothById,
} from "./wardrobe.js";

const el = (id) => document.getElementById(id);

/** Filters */
const qName = el("qName");
const fType = el("fType");        // 如果你还留着 type 过滤，可用；不想要就删掉相关 UI & 逻辑
const fSeason = el("fSeason");
const groupByType = el("groupByType");

/** List */
const detailList = el("detailList");

/** Editor */
const editorPreview = el("editorPreview");
const eName = el("eName");
const eKind = el("eKind");
const eImage = el("eImage");
const saveBtn = el("saveBtn");
const deleteBtn = el("deleteBtn");
const editorHint = el("editorHint");

let selectedId = null;

init();

async function init() {
  await initWardrobeFromApi();
  render();

  [qName, fType, fSeason, groupByType].forEach((x) => {
    if (!x) return;
    x.addEventListener("input", render);
    x.addEventListener("change", render);
  });

  saveBtn?.addEventListener("click", onSave);
  deleteBtn?.addEventListener("click", onDelete);
}

function filteredClothes() {
  const nameQuery = (qName?.value || "").trim().toLowerCase();
  const season = fSeason?.value || "";
  const type = fType?.value || "";

  return getClothes().filter((c) => {
    if (nameQuery && !String(c.name || "").toLowerCase().includes(nameQuery)) return false;
    if (season && !(c.seasons || []).includes(season)) return false;
    if (type && c.type !== type) return false; // 可选：你若不想保留 type 过滤，可以去掉这行
    return true;
  });
}

function render() {
  const list = filteredClothes();
  detailList.innerHTML = "";

  if (!list.length) {
    detailList.innerHTML = `<div class="empty-tip">没有符合条件的衣服</div>`;
    return;
  }

  // 分组：建议改为按 kind 分组（比 type 更符合你现在逻辑）
  if (groupByType?.checked) {
    const groups = groupBy(list, (c) => c.kind || "unknown");
    Object.keys(groups)
      .sort()
      .forEach((k) => {
        const group = document.createElement("div");
        group.className = "group";
        group.innerHTML = `<div class="group-title">${formatKind(k)}（${groups[k].length}）</div>`;

        const grid = document.createElement("div");
        grid.className = "detail-grid";
        groups[k].forEach((c) => grid.appendChild(makeCard(c)));

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
    <div class="meta-line"><span class="tag">${escapeHtml(formatKind(cloth.kind))}</span></div>
  `;

  card.addEventListener("click", () => openEditor(cloth.id));
  return card;
}

function openEditor(id) {
  const cloth = getClothById(id);
  if (!cloth) return;

  selectedId = id;

  editorPreview.innerHTML = cloth.image
    ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}"><div class="cloth-name">${escapeHtml(cloth.name)}</div>`
    : `<div class="empty-tip">无图片预览</div><div class="cloth-name">${escapeHtml(cloth.name)}</div>`;

  eName.value = cloth.name || "";
  eKind.value = cloth.kind || "inner";
  eImage.value = "";
  setSeasonChecks(cloth.seasons || []);
  editorHint.textContent = "";
}

async function onSave() {
  if (!selectedId) return;

  const name = (eName.value || "").trim();
  if (!name) {
    editorHint.textContent = "名称不能为空";
    return;
  }

  const kind = eKind.value;
  const seasons = getEditorSeasons();
  if (seasons.length < 1 || seasons.length > 4) {
    editorHint.textContent = "季节必须选择 1~4 个";
    return;
  }

  editorHint.textContent = "保存中…";

  try {
    await remoteUpdateClothById(selectedId, { name, kind, seasons });

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
    selectedId = null;
    editorPreview.innerHTML = `<div class="empty-tip">已删除</div>`;
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

function groupBy(arr, keyFn) {
  return arr.reduce((acc, x) => {
    const k = keyFn(x);
    (acc[k] ||= []).push(x);
    return acc;
  }, {});
}

function formatSeasons(seasons = []) {
  const map = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  return (seasons || []).map((s) => map[s] || s).join(" / ");
}

function formatKind(kind) {
  const map = {
    jk_set: "JK套装",
    daily_set: "日常套装",
    outer: "外搭",
    inner: "内搭",
    bottom: "下装",
    socks: "袜子",
    shoes: "鞋子",
    unknown: "未分类",
  };
  return map[kind] || kind || "未分类";
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}