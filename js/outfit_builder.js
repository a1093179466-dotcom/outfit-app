// js/outfit_builder.js

import { getClothes, initWardrobeFromApi } from "./wardrobe.js";
import {
  apiListAllPairRules,
  apiCreatePreset,
  apiListPresets,
  apiDeletePreset,
} from "./api_client.js";

const el = (id) => document.getElementById(id);
const autoCompleteBtn = el("autoCompleteBtn");
/** Controls */
const seasonSelect = el("seasonSelect");
const startSlot = el("startSlot");
const pickStartBtn = el("pickStartBtn");
const statusTip = el("statusTip");

/** Current outfit */
const currentOutfitEl = el("currentOutfit");
const presetNote = el("presetNote");
const savePresetBtn = el("savePresetBtn");
const loadPresetBtn = el("loadPresetBtn");
const clearOutfitBtn = el("clearOutfitBtn");

/** Preset list */
const presetList = el("presetList");

/** Candidate containers */
const candEls = {
  outer: el("candOuter"),
  top: el("candTop"),
  bottom: el("candBottom"),
  dress: el("candDress"),
  shoes: el("candShoes"),
  socks: el("candSocks"),
};

const autoBtns = {
  outer: el("autoOuter"),
  top: el("autoTop"),
  bottom: el("autoBottom"),
  dress: el("autoDress"),
  shoes: el("autoShoes"),
  socks: el("autoSocks"),
};

const clearBtns = {
  outer: el("clearOuter"),
  top: el("clearTop"),
  bottom: el("clearBottom"),
  dress: el("clearDress"),
  shoes: el("clearShoes"),
  socks: el("clearSocks"),
};

const slots = ["outer", "top", "bottom", "dress", "shoes", "socks"];

/**
 * 当前穿搭（槽位 -> cloth）
 * dress 与 top/bottom 互斥：
 * - 选 dress 会清空 top/bottom
 * - 选 top/bottom 会清空 dress
 */
let outfit = {
  season: "autumn",
  outer: null,
  top: null,
  bottom: null, // skirt or pants
  dress: null,
  shoes: null,
  socks: null,
};

/** 当前锚点：默认“最后一次选择的衣服” */
let anchorId = null;

/**
 * 搭配图（allow/deny）
 * allow/deny: Map<clothId, Set<clothId>>
 */
let graph = {
  allow: new Map(),
  deny: new Map(),
};

init();

async function init() {
  outfit.season = seasonSelect.value;

  await initWardrobeFromApi();
  await rebuildGraph();

  bindEvents();
  renderCurrentOutfit();
  refreshAllCandidates();
  await renderPresetList();
}

function bindEvents() {
  autoCompleteBtn.addEventListener("click", autoComplete);
  seasonSelect.addEventListener("change", async () => {
    outfit.season = seasonSelect.value;
    renderCurrentOutfit();
    refreshAllCandidates();
    await renderPresetList();
  });

  pickStartBtn.addEventListener("click", () => {
    pickRandomForSlot(startSlot.value);
  });

  clearOutfitBtn.addEventListener("click", () => {
    outfit = {
      season: seasonSelect.value,
      outer: null,
      top: null,
      bottom: null,
      dress: null,
      shoes: null,
      socks: null,
    };
    anchorId = null;
    renderCurrentOutfit();
    refreshAllCandidates();
  });

  savePresetBtn.addEventListener("click", savePreset);
  loadPresetBtn.addEventListener("click", loadRandomPreset);

  slots.forEach((s) => {
    autoBtns[s].addEventListener("click", () => pickRandomForSlot(s));
    clearBtns[s].addEventListener("click", () => {
      outfit[s] = null;

      // 如果清掉的是锚点衣服，则锚点回退到“最后一个还存在的已选衣服”
      if (anchorId && !getSelectedIds().includes(anchorId)) {
        anchorId = getSelectedIds().slice(-1)[0] || null;
      }

      renderCurrentOutfit();
      refreshAllCandidates();
    });
  });
}

/** 一次拉全图，构建 allow/deny */
async function rebuildGraph() {
  const allow = new Map();
  const deny = new Map();

  try {
    const rules = await apiListAllPairRules();

    for (const r of rules) {
      const a = r.a_id;
      const b = r.b_id;

      if (r.rule === "allow") {
        addEdge(allow, a, b);
        addEdge(allow, b, a);
      } else if (r.rule === "deny") {
        addEdge(deny, a, b);
        addEdge(deny, b, a);
      }
    }
  } catch (e) {
    console.warn("拉取全量搭配图失败，使用空图：", e);
  }

  graph = { allow, deny };
}

function addEdge(map, from, to) {
  if (!map.has(from)) map.set(from, new Set());
  map.get(from).add(to);
}

/** ===== Current Outfit Render (可点击设置锚点) ===== */

function renderCurrentOutfit() {
  const selected = [
    { slot: "outer", label: "外搭", item: outfit.outer },
    { slot: "top", label: "上衣", item: outfit.top },
    { slot: "bottom", label: "下装", item: outfit.bottom },
    { slot: "dress", label: "连衣裙", item: outfit.dress },
    { slot: "shoes", label: "鞋子", item: outfit.shoes },
    { slot: "socks", label: "袜子", item: outfit.socks },
  ].filter((x) => x.item);

  const anchorName = anchorId ? (getClothNameById(anchorId) || anchorId.slice(0, 6)) : "未设置";

  currentOutfitEl.innerHTML = `
    <div class="history-head">
      <strong>季节：${formatSeason(outfit.season)}</strong>
      <span>锚点：${escapeHtml(anchorName)}</span>
    </div>
    <div class="history-names">
      ${
        selected.length
          ? selected
              .map((x) => {
                const isAnchor = x.item.id === anchorId;
                return `<button type="button" data-id="${x.item.id}" class="link-btn" style="margin:4px; ${isAnchor ? "border-color:#4a69bd;" : ""}">
                  ${escapeHtml(x.label)}：${escapeHtml(x.item.name)}${isAnchor ? " ★" : ""}
                </button>`;
              })
              .join("")
          : "从任意部位开始选择吧～（选择后会自动成为锚点）"
      }
    </div>
  `;

  // 绑定点击：点击已选衣服 -> 设置锚点
  currentOutfitEl.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      anchorId = btn.getAttribute("data-id");
      statusTip.textContent = `已将锚点设为：${getClothNameById(anchorId) || anchorId}`;
      renderCurrentOutfit();
      refreshAllCandidates();
    });
  });

  statusTip.textContent =
    "规则：候选优先显示“锚点 allow 命中（推荐）”；没有 allow 时显示“探索区（未禁止）”。";
}

function getClothNameById(id) {
  const c = getClothes().find((x) => x.id === id);
  return c ? c.name : null;
}

/** ===== Candidates ===== */

function refreshAllCandidates() {
  slots.forEach((s) => renderCandidatesForSlot(s));
}

function renderCandidatesForSlot(slot) {
  const container = candEls[slot];
  container.innerHTML = "";

  const { recommended, explore } = getCandidates(slot);

  // 推荐区
  const recTitle = document.createElement("div");
  recTitle.className = "meta-line";
  recTitle.innerHTML = `<strong>✅ 推荐（匹配锚点）</strong>`;
  container.appendChild(recTitle);

  const recGrid = document.createElement("div");
  recGrid.className = "detail-grid";
  container.appendChild(recGrid);

  if (recommended.length === 0) {
    recGrid.innerHTML = `<div class="empty-tip">无推荐</div>`;
  } else {
    recommended.slice(0, 16).forEach((c) => recGrid.appendChild(makeCandidateCard(slot, c)));
  }

  // 探索区折叠
  const details = document.createElement("details");
  details.style.marginTop = "10px";

  const summary = document.createElement("summary");
  summary.textContent = `🔎 探索（未明确允许，但未冲突）${explore.length ? `：${explore.length}项` : ""}`;
  details.appendChild(summary);

  const expGrid = document.createElement("div");
  expGrid.className = "detail-grid";
  expGrid.style.marginTop = "10px";
  details.appendChild(expGrid);

  if (explore.length === 0) {
    expGrid.innerHTML = `<div class="empty-tip">无探索候选</div>`;
  } else {
    explore.slice(0, 24).forEach((c) => expGrid.appendChild(makeCandidateCard(slot, c)));
  }

  container.appendChild(details);
}

function makeCandidateCard(slot, cloth) {
  const card = document.createElement("div");
  card.className = "cloth-card";

  const img = cloth.image ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">` : "";
  card.innerHTML = `
    ${img}
    <div class="cloth-name">${escapeHtml(cloth.name)}</div>
    <div class="meta-line"><span class="tag">${escapeHtml(formatCategory(cloth))}</span></div>
  `;

  card.addEventListener("click", () => applyChoice(slot, cloth));
  return card;
}

function applyChoice(slot, cloth) {
  // dress 与 top/bottom 互斥：更符合常识的自动处理
  if (slot === "dress") {
    outfit.dress = cloth;
    outfit.top = null;
    outfit.bottom = null;
  } else if (slot === "top" || slot === "bottom") {
    outfit[slot] = cloth;
    if (outfit.dress) outfit.dress = null;
  } else {
    outfit[slot] = cloth;
  }

  // ✅ 默认锚点：最后一次选择的衣服
  anchorId = cloth.id;

  renderCurrentOutfit();
  refreshAllCandidates();
}

function pickRandomForSlot(slot) {
  const { recommended, explore } = getCandidates(slot);

  const pool = recommended.length ? recommended : explore;
  if (!pool.length) {
    alert(`没有可选的 ${slotLabel(slot)}`);
    return;
  }
  const c = pool[Math.floor(Math.random() * pool.length)];
  applyChoice(slot, c);
}

function getSelectedIds() {
  return slots.map((s) => outfit[s]?.id).filter(Boolean);
}

/**
 * 候选计算逻辑（锚点驱动）：
 * 1) 季节过滤
 * 2) 槽位类别过滤
 * 3) deny 过滤（与当前已选任意一件存在 deny 就排除）
 * 4) 推荐 = 仅锚点 allow 命中（如果锚点有 allow）；探索 = 其余可用
 *    - 若锚点不存在或锚点没有 allow：推荐为空，探索为全部可用
 */
function getCandidates(slot) {
  const clothes = getClothes();
  const season = outfit.season;

  // 1) 季节过滤
  let pool = clothes.filter((c) => Array.isArray(c.seasons) && c.seasons.includes(season));

  // 2) 槽位过滤
  pool = pool.filter((c) => matchesSlot(slot, c));

  // 3) deny 过滤
  const selected = getSelectedIds();
  pool = pool.filter((c) => {
    if (selected.includes(c.id)) return false;

    for (const sid of selected) {
      const denySet = graph.deny.get(sid);
      if (denySet && denySet.has(c.id)) return false;
    }
    return true;
  });

  // 4) 推荐/探索划分
  const anchor = anchorId;
  const allowSet = anchor ? graph.allow.get(anchor) : null;

  if (!anchor || !allowSet || allowSet.size === 0) {
    return { recommended: [], explore: pool };
  }

  const recommended = [];
  const explore = [];
  for (const c of pool) {
    if (allowSet.has(c.id)) recommended.push(c);
    else explore.push(c);
  }

  return { recommended, explore };
}

function matchesSlot(slot, cloth) {
  const cat = cloth.category || inferCategoryFromType(cloth.type);

  if (slot === "outer") return cat === "outer";
  if (slot === "top") return cat === "top";
  if (slot === "bottom") return cat === "skirt" || cat === "pants";
  if (slot === "dress") return cat === "dress";
  if (slot === "shoes") return cat === "shoes";
  if (slot === "socks") return cat === "socks";

  return false;
}

/** ===== Presets (Outfit Presets) ===== */

async function savePreset() {
  const ids = getSelectedIds();
  if (!ids.length) {
    alert("当前没有可保存的方案，请先选择衣服");
    return;
  }

  savePresetBtn.disabled = true;
  savePresetBtn.textContent = "保存中…";
  try {
    await apiCreatePreset({
      season: outfit.season,
      items: ids,
      note: (presetNote.value || "").trim() || null,
    });

    presetNote.value = "";
    alert("已保存为方案 ✅");
    await renderPresetList();
  } catch (e) {
    console.error(e);
    alert(`保存方案失败：${e.message || e}`);
  } finally {
    savePresetBtn.disabled = false;
    savePresetBtn.textContent = "保存为搭配方案";
  }
}

async function loadRandomPreset() {
  try {
    const presets = await apiListPresets(outfit.season);
    if (!presets.length) {
      alert("当前季节还没有方案，先保存几个吧～");
      return;
    }
    const p = presets[Math.floor(Math.random() * presets.length)];
    applyPresetItems(p.items || []);
  } catch (e) {
    console.error(e);
    alert(`加载方案失败：${e.message || e}`);
  }
}

async function renderPresetList() {
  if (!presetList) return;

  try {
    const presets = await apiListPresets(outfit.season);

    if (!presets.length) {
      presetList.innerHTML = `<div class="empty-tip">暂无方案</div>`;
      return;
    }

    const byId = new Map(getClothes().map((c) => [c.id, c]));
    presetList.innerHTML = "";

    presets.slice(0, 30).forEach((p) => {
      const names = (p.items || []).map((id) => byId.get(id)?.name || `(已删除:${id.slice(0, 6)})`);
      const created = p.created_at ? new Date(p.created_at * 1000).toLocaleString() : "";

      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
        <div class="history-head">
          <strong>${formatSeason(p.season)}</strong>
          <span>${created}</span>
        </div>
        <div class="history-names">${names.join(" + ")}</div>
        ${p.note ? `<div class="history-note">${escapeHtml(p.note)}</div>` : ""}
        <div class="history-actions">
          <button class="primary-btn" type="button">加载</button>
          <button class="delete-btn" type="button">删除</button>
        </div>
      `;

      div.querySelectorAll("button")[0].addEventListener("click", () => {
        applyPresetItems(p.items || []);
      });

      div.querySelectorAll("button")[1].addEventListener("click", async () => {
        if (!confirm("确定删除这个方案吗？")) return;
        try {
          await apiDeletePreset(p.id);
          await renderPresetList();
        } catch (e) {
          console.error(e);
          alert(`删除方案失败：${e.message || e}`);
        }
      });

      presetList.appendChild(div);
    });
  } catch (e) {
    console.error(e);
    presetList.innerHTML = `<div class="empty-tip">加载方案失败</div>`;
  }
}

/**
 * items 数组方式：加载时按 category 自动落槽位
 * - 如果有 dress：占用 dress，并清空 top/bottom
 * - bottom：skirt/pants 二选一（取第一个命中的）
 * - 锚点：默认设为“dress 或 top 或 bottom”（优先主件）
 */
function applyPresetItems(ids) {
  const byId = new Map(getClothes().map((c) => [c.id, c]));
  const picked = (ids || []).map((id) => byId.get(id)).filter(Boolean);

  const dress = picked.find((c) => (c.category || inferCategoryFromType(c.type)) === "dress") || null;
  const outer = picked.find((c) => (c.category || inferCategoryFromType(c.type)) === "outer") || null;
  const top = picked.find((c) => (c.category || inferCategoryFromType(c.type)) === "top") || null;
  const bottom =
    picked.find((c) => {
      const cat = c.category || inferCategoryFromType(c.type);
      return cat === "skirt" || cat === "pants";
    }) || null;
  const shoes = picked.find((c) => (c.category || inferCategoryFromType(c.type)) === "shoes") || null;
  const socks = picked.find((c) => (c.category || inferCategoryFromType(c.type)) === "socks") || null;

  if (dress) {
    outfit.dress = dress;
    outfit.top = null;
    outfit.bottom = null;
  } else {
    outfit.dress = null;
    outfit.top = top;
    outfit.bottom = bottom;
  }

  outfit.outer = outer;
  outfit.shoes = shoes;
  outfit.socks = socks;

  // 锚点优先：dress > top > bottom > shoes > socks > outer
  anchorId =
    (outfit.dress && outfit.dress.id) ||
    (outfit.top && outfit.top.id) ||
    (outfit.bottom && outfit.bottom.id) ||
    (outfit.shoes && outfit.shoes.id) ||
    (outfit.socks && outfit.socks.id) ||
    (outfit.outer && outfit.outer.id) ||
    null;

  renderCurrentOutfit();
  refreshAllCandidates();
}

/** ===== Utils ===== */

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

function formatSeason(season) {
  const map = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  return map[season] || season;
}

function slotLabel(slot) {
  const map = {
    outer: "外搭",
    top: "上衣",
    bottom: "下装",
    dress: "连衣裙/套装",
    shoes: "鞋子",
    socks: "袜子",
  };
  return map[slot] || slot;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


function needOuterBySeason(season) {
  return season === "spring" || season === "autumn" || season === "winter";
}

function optionalOuterBySeason(season) {
  return season === "summer";
}

function isEmptySlot(slot) {
  return !outfit[slot];
}

function autoComplete() {
  // 没有任何起点，就按 startSlot 先随机一个起点
  if (getSelectedIds().length === 0) {
    pickRandomForSlot(startSlot.value);
  }

  // 如果选了 dress，就不要补 top/bottom
  const hasDress = !!outfit.dress;

  // 季节外搭规则
  const season = outfit.season;
  const mustOuter = needOuterBySeason(season);
  const mayOuter = optionalOuterBySeason(season);

  // 1) 先决定并补结构性槽位：dress vs top+bottom
  // 如果没有 dress 也没有 top/bottom，则优先补一个结构
  if (!hasDress && (!outfit.top || !outfit.bottom)) {
    // 这里不强行 50/50：更贴近“由你当前已选决定”
    // 如果已经选了 bottom，就补 top；如果已选 top，就补 bottom；都没选就默认补 bottom 再补 top
    if (outfit.bottom && !outfit.top) {
      pickRandomForSlot("top");
    } else if (outfit.top && !outfit.bottom) {
      pickRandomForSlot("bottom");
    } else if (!outfit.top && !outfit.bottom && !outfit.dress) {
      // 没起点或起点不是结构部位（比如鞋袜）
      pickRandomForSlot("bottom");
      pickRandomForSlot("top");
    }
  }

  // 2) 补 shoes / socks（通常都需要）
  if (isEmptySlot("shoes")) pickRandomForSlot("shoes");
  if (isEmptySlot("socks")) pickRandomForSlot("socks");

  // 3) 补 outer：春秋冬必选；夏季可选 50%
  if (mustOuter) {
    if (isEmptySlot("outer")) pickRandomForSlot("outer");
  } else if (mayOuter) {
    if (isEmptySlot("outer") && Math.random() < 0.5) pickRandomForSlot("outer");
  }

  // 4) 如果当前是 dress 模式，确保 top/bottom 已清空（applyChoice 已经做了，这里再兜底）
  if (outfit.dress) {
    outfit.top = null;
    outfit.bottom = null;
  }

  renderCurrentOutfit();
  refreshAllCandidates();
}