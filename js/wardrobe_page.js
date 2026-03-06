// js/wardrobe_page.js

import {
  getClothes,
  getClothById,
  initWardrobeFromApi,
  remoteUpdateClothById,
  remoteUploadImage,
  remoteDeleteClothById,
} from "./wardrobe.js";

import {
  apiListPairRules,
  apiUpsertPairRule,
  apiDeletePairRule,
} from "./api_client.js";

/** ✅ 一定放最上面，避免 TDZ 错误 */
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

/** Step1 fields */
const eCategory = el("eCategory");
const eLayer = el("eLayer");
const eVLevel = el("eVLevel");

/** Step2 Pair rules UI */
const pairCategory = el("pairCategory");
const pairCandidates = el("pairCandidates");
const pairAllowList = el("pairAllowList");
const pairDenyList = el("pairDenyList");
const addAllowBtn = el("addAllowBtn");
const addDenyBtn = el("addDenyBtn");
const pairTip = el("pairTip");

let selectedId = null;

/** Pair rules state */
let selectedCandidateId = null;
let cachedPairRules = []; // 当前衣服的pair_rules缓存

init();

/** ✅ init async，先拉后端数据 */
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

  pairCategory?.addEventListener("change", renderPairCandidates);
  addAllowBtn?.addEventListener("click", () => onAddRule("allow"));
  addDenyBtn?.addEventListener("click", () => onAddRule("deny"));
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

  card.addEventListener("click", () => {
    openEditor(cloth.id);
  });

  return card;
}

async function openEditor(id) {
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

  // Step1 fields（兼容）
  if (eCategory) eCategory.value = cloth.category || inferCategoryFromType(cloth.type);
  if (eLayer) eLayer.value = cloth.layer || inferLayerFromType(cloth.type);
  if (eVLevel) eVLevel.value = String(cloth.versatile_level ?? (cloth.versatile ? 2 : 0));
  setFeatureChecks(cloth.features || []);

  editorHint.textContent = "";

  // Step2: 加载并渲染搭配规则 + 候选
  selectedCandidateId = null;
  if (pairTip) pairTip.textContent = "步骤：先在候选区点选一件衣服，再点“允许/互斥”";
  await loadAndRenderPairRules(id);
  renderPairCandidates();
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
  const category = eCategory ? eCategory.value : undefined;
  const layer = eLayer ? eLayer.value : undefined;
  const versatile_level = eVLevel ? Number(eVLevel.value) : undefined;
  const features = getEditorFeatures();

  editorHint.textContent = "保存中…";

  try {
    await remoteUpdateClothById(selectedId, {
      name,
      type,
      seasons,
      versatile,
      ...(category ? { category } : {}),
      ...(layer ? { layer } : {}),
      ...(Number.isFinite(versatile_level) ? { versatile_level } : {}),
      features,
    });

    const file = eImage.files?.[0];
    if (file) {
      await remoteUploadImage(selectedId, file);
    }

    editorHint.textContent = "已保存 ✅";
    render();
    await openEditor(selectedId); // 重新打开，刷新预览与规则
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

    // 清空规则UI
    cachedPairRules = [];
    if (pairCandidates) pairCandidates.innerHTML = "";
    if (pairAllowList) pairAllowList.innerHTML = "";
    if (pairDenyList) pairDenyList.innerHTML = "";
  } catch (e) {
    console.error(e);
    editorHint.textContent = `删除失败：${e.message || e}`;
  }
}

/* ===== Seasons ===== */

function getEditorSeasons() {
  const checked = document.querySelectorAll('input[name="eSeason"]:checked');
  return Array.from(checked).map((x) => x.value);
}

function setSeasonChecks(seasons) {
  document.querySelectorAll('input[name="eSeason"]').forEach((cb) => {
    cb.checked = (seasons || []).includes(cb.value);
  });
}

/* ===== Features ===== */

function getEditorFeatures() {
  const checked = document.querySelectorAll('input[name="eFeature"]:checked');
  return Array.from(checked).map((x) => x.value);
}

function setFeatureChecks(features) {
  document.querySelectorAll('input[name="eFeature"]').forEach((cb) => {
    cb.checked = (features || []).includes(cb.value);
  });
}

/* ===== Step2 Pair Rules ===== */

async function loadAndRenderPairRules(clothId) {
  try {
    cachedPairRules = await apiListPairRules(clothId);
  } catch (e) {
    console.error(e);
    cachedPairRules = [];
  }
  renderPairRuleLists(clothId);
}

function renderPairCandidates() {
  if (!selectedId || !pairCandidates) return;

  const category = pairCategory?.value || "";
  const all = getClothes().filter((c) => c.id !== selectedId);

  const filtered = category
    ? all.filter((c) => (c.category || inferCategoryFromType(c.type)) === category)
    : all;

  pairCandidates.innerHTML = "";

  if (filtered.length === 0) {
    pairCandidates.innerHTML = `<div class="empty-tip">没有候选衣服</div>`;
    return;
  }

  filtered.forEach((c) => {
    const card = document.createElement("div");
    card.className = "cloth-card";

    const img = c.image ? `<img src="${c.image}" alt="${escapeHtml(c.name)}">` : "";
    const isSelected = selectedCandidateId === c.id;
    card.style.outline = isSelected ? "3px solid rgba(74,105,189,0.6)" : "none";

    card.innerHTML = `
      ${img}
      <div class="cloth-name">${escapeHtml(c.name)}</div>
      <div class="meta-line"><span class="tag">${escapeHtml(formatCategory(c))}</span></div>
    `;

    card.addEventListener("click", () => {
      selectedCandidateId = c.id;
      if (pairTip) pairTip.textContent = `已选候选：${c.name}（点“允许/互斥”添加）`;
      renderPairCandidates();
    });

    pairCandidates.appendChild(card);
  });
}

function renderPairRuleLists(clothId) {
  const rules = cachedPairRules || [];
  const allow = rules.filter((r) => r.rule === "allow");
  const deny = rules.filter((r) => r.rule === "deny");

  renderRuleListInto(pairAllowList, clothId, allow);
  renderRuleListInto(pairDenyList, clothId, deny);
}

function renderRuleListInto(container, clothId, rules) {
  if (!container) return;
  container.innerHTML = "";

  if (!rules.length) {
    container.innerHTML = `<div class="empty-tip">暂无</div>`;
    return;
  }

  const byId = new Map(getClothes().map((c) => [c.id, c]));

  rules.forEach((r) => {
    const otherId = r.a_id === clothId ? r.b_id : r.a_id;
    const other = byId.get(otherId);

    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-head">
        <strong>${other ? escapeHtml(other.name) : `未知衣服(${otherId.slice(0, 6)})`}</strong>
        <span>${r.rule.toUpperCase()}</span>
      </div>
      ${r.note ? `<div class="history-note">${escapeHtml(r.note)}</div>` : ""}
      <button class="delete-btn" type="button">删除规则</button>
    `;

    item.querySelector("button").addEventListener("click", async () => {
      try {
        await apiDeletePairRule(r.id);
        await loadAndRenderPairRules(clothId);
      } catch (e) {
        console.error(e);
        alert(`删除规则失败：${e.message || e}`);
      }
    });

    container.appendChild(item);
  });
}

async function onAddRule(ruleType) {
  if (!selectedId) return;
  if (!selectedCandidateId) {
    alert("请先在候选区点选一件衣服");
    return;
  }

  try {
    await apiUpsertPairRule(selectedId, {
      other_id: selectedCandidateId,
      rule: ruleType,
      note: null,
    });

    selectedCandidateId = null;
    if (pairTip) pairTip.textContent = "已添加规则 ✅";
    await loadAndRenderPairRules(selectedId);
    renderPairCandidates();
  } catch (e) {
    console.error(e);
    alert(`添加规则失败：${e.message || e}`);
  }
}

/* ===== Helpers ===== */

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
    skirt: "裙子",
    pants: "裤子",
    top: "上衣",
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
  const map = {
    jk_set: "dress",
    daily_set: "dress",
    top: "top",
    skirt: "skirt",
    pants: "pants",
    shoes: "shoes",
    socks: "socks",
  };
  return map[type] || "top";
}

function inferLayerFromType(type) {
  const map = {
    jk_set: "none",
    daily_set: "none",
    top: "inner",
    skirt: "none",
    pants: "none",
    shoes: "none",
    socks: "none",
  };
  return map[type] || "inner";
}

function formatCategory(c) {
  const cat = c.category || inferCategoryFromType(c.type);
  const map = {
    outer: "外搭",
    top: "上衣",
    skirt: "裙子",
    pants: "裤子",
    dress: "连衣裙/套装",
    shoes: "鞋子",
    socks: "袜子",
  };
  return map[cat] || cat;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}