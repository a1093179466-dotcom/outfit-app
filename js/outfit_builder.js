// js/outfit_builder.js

import { getClothes, initWardrobeFromApi } from "./wardrobe.js";
import { apiListPairRules, apiCreatePreset, apiListPresets, apiDeletePreset } from "./api_client.js";

const el = (id) => document.getElementById(id);

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
 * - dress 与 top/bottom 互斥：选 dress 会清空 top/bottom；选 top/bottom 会清空 dress
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
  await rebuildGraph(); // 从后端拉 pair_rules 生成图

  bindEvents();
  renderCurrentOutfit();
  refreshAllCandidates();
  await renderPresetList();
}

function bindEvents() {
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
    renderCurrentOutfit();
    refreshAllCandidates();
  });

  savePresetBtn.addEventListener("click", savePreset);
  loadPresetBtn.addEventListener("click", loadRandomPreset);

  slots.forEach((s) => {
    autoBtns[s].addEventListener("click", () => pickRandomForSlot(s));
    clearBtns[s].addEventListener("click", () => {
      outfit[s] = null;
      renderCurrentOutfit();
      refreshAllCandidates();
    });
  });
}

/**
 * 简化实现：对每件衣服各拉一次 pair_rules，再合成全图
 * 衣柜很大时会慢，后续可以做后端一次性返回全图的接口优化。
 */
async function rebuildGraph() {
  const clothes = getClothes();
  const allow = new Map();
  const deny = new Map();

  for (const c of clothes) {
    try {
      const rules = await apiListPairRules(c.id);

      for (const r of rules) {
        // 规则记录的是 a_id/b_id（无向），对每条规则我们给双方都加边
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
      // 某件衣服没有规则/请求失败就跳过
    }
  }

  graph = { allow, deny };
}

function addEdge(map, from, to) {
  if (!map.has(from)) map.set(from, new Set());
  map.get(from).add(to);
}

/** ===== Render current outfit ===== */

function renderCurrentOutfit() {
  const parts = [];
  const pushPart = (label, item) => {
    if (!item) return;
    parts.push(`${label}:${item.name}`);
  };

  pushPart("外搭", outfit.outer);
  pushPart("上衣", outfit.top);
  pushPart("下装", outfit.bottom);
  pushPart("连衣裙", outfit.dress);
  pushPart("鞋子", outfit.shoes);
  pushPart("袜子", outfit.socks);

  currentOutfitEl.innerHTML = `
    <div class="history-head">
      <strong>季节：${formatSeason(outfit.season)}</strong>
      <span>${parts.length ? "已选" : "未选择"}</span>
    </div>
    <div class="history-names">${
      parts.length ? parts.join("  |  ") : "从任意部位开始选择吧～"
    }</div>
  `;

  statusTip.textContent =
    "提示：你可以从任意部位开始，系统会根据你的搭配图（allow/deny）推荐其它候选；“帮我选”是等概率随机。";
}

/** ===== Candidate rendering ===== */

function refreshAllCandidates() {
  slots.forEach((s) => renderCandidatesForSlot(s));
}

function renderCandidatesForSlot(slot) {
  const container = candEls[slot];
  container.innerHTML = "";

  const candidates = getCandidates(slot);

  if (!candidates.length) {
    container.innerHTML = `<div class="empty-tip">无候选</div>`;
    return;
  }

  candidates.slice(0, 24).forEach((c) => {
    const card = document.createElement("div");
    card.className = "cloth-card";

    const img = c.image ? `<img src="${c.image}" alt="${escapeHtml(c.name)}">` : "";
    card.innerHTML = `
      ${img}
      <div class="cloth-name">${escapeHtml(c.name)}</div>
      <div class="meta-line"><span class="tag">${escapeHtml(formatCategory(c))}</span></div>
    `;

    card.addEventListener("click", () => applyChoice(slot, c));
    container.appendChild(card);
  });
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

  renderCurrentOutfit();
  refreshAllCandidates();
}

function pickRandomForSlot(slot) {
  const candidates = getCandidates(slot);
  if (!candidates.length) {
    alert(`没有可选的 ${slotLabel(slot)}`);
    return;
  }
  const c = candidates[Math.floor(Math.random() * candidates.length)];
  applyChoice(slot, c);
}

function getSelectedIds() {
  return slots
    .map((s) => outfit[s]?.id)
    .filter(Boolean);
}

/**
 * 候选计算逻辑（树形推荐核心）：
 * 1) 季节过滤
 * 2) 槽位类别过滤
 * 3) deny 过滤（与当前已选任意一件存在 deny 就排除）
 * 4) allow 优先（如果存在 allow 命中，则只展示 allow 命中集合；否则展示剩余集合）
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

  // 4) allow 优先（如果当前已选里有人允许它，则归为 allowHits）
  const allowHits = [];
  const rest = [];

  for (const c of pool) {
    if (isAllowedByAnySelected(c.id)) allowHits.push(c);
    else rest.push(c);
  }

  // 如果命中 allow，则优先展示 allow 列表（更像“树”）；没有 allow 则展示 rest（探索区）
  return allowHits.length ? allowHits : rest;
}

function isAllowedByAnySelected(candidateId) {
  const selected = getSelectedIds();
  for (const sid of selected) {
    const allowSet = graph.allow.get(sid);
    if (allowSet && allowSet.has(candidateId)) return true;
  }
  return false;
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

      // 加载
      div.querySelectorAll("button")[0].addEventListener("click", () => {
        applyPresetItems(p.items || []);
      });

      // 删除
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