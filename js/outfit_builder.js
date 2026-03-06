import { getClothes, initWardrobeFromApi } from "./wardrobe.js";
import { apiListPairRules } from "./api_client.js";
import { apiCreateOutfit } from "./api_client.js"; // 复用历史保存（你已有）

const el = (id) => document.getElementById(id);

const seasonSelect = el("seasonSelect");
const startSlot = el("startSlot");
const pickStartBtn = el("pickStartBtn");
const statusTip = el("statusTip");
const currentOutfitEl = el("currentOutfit");

const saveHistoryBtn = el("saveHistoryBtn");
const clearOutfitBtn = el("clearOutfitBtn");

const slots = ["outer", "top", "bottom", "dress", "shoes", "socks"];

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

// 当前穿搭（槽位 -> cloth对象）
let outfit = {
  season: "autumn",
  outer: null,
  top: null,
  bottom: null, // skirt or pants
  dress: null,
  shoes: null,
  socks: null,
};

let graph = {
  allow: new Map(), // id -> Set(ids)
  deny: new Map(),
};

init();

async function init() {
  outfit.season = seasonSelect.value;
  await initWardrobeFromApi();

  // 事件
  seasonSelect.addEventListener("change", () => {
    outfit.season = seasonSelect.value;
    // 换季后可能当前选择不再满足季节，先不强制清空，只是刷新候选
    refreshAllCandidates();
    renderCurrentOutfit();
  });

  pickStartBtn.addEventListener("click", () => {
    pickRandomForSlot(startSlot.value);
  });

  clearOutfitBtn.addEventListener("click", () => {
    outfit = { season: seasonSelect.value, outer:null, top:null, bottom:null, dress:null, shoes:null, socks:null };
    renderCurrentOutfit();
    refreshAllCandidates();
  });

  saveHistoryBtn.addEventListener("click", saveToHistory);

  // 各槽位按钮
  slots.forEach((s) => {
    autoBtns[s].addEventListener("click", () => pickRandomForSlot(s));
    clearBtns[s].addEventListener("click", () => {
      outfit[s] = null;
      // dress 与 top/bottom 的互斥：清一边不强制清另一边（你可以自由组合），但候选会自动处理
      renderCurrentOutfit();
      refreshAllCandidates();
    });
  });

  // 初次加载：先不选任何衣服，也能看候选
  renderCurrentOutfit();
  await rebuildGraph(); // 从后端拉规则
  refreshAllCandidates();
}

async function rebuildGraph() {
  // 把全图拉下来：简化实现（每件衣服取一次规则）
  const clothes = getClothes();
  const allow = new Map();
  const deny = new Map();

  for (const c of clothes) {
    try {
      const rules = await apiListPairRules(c.id);
      for (const r of rules) {
        const a = r.a_id;
        const b = r.b_id;
        const other = (c.id === a) ? b : a;

        if (r.rule === "allow") {
          addEdge(allow, c.id, other);
          addEdge(allow, other, c.id);
        } else if (r.rule === "deny") {
          addEdge(deny, c.id, other);
          addEdge(deny, other, c.id);
        }
      }
    } catch (e) {
      // 某件衣服没规则或失败就跳过
    }
  }

  graph = { allow, deny };
}

function addEdge(map, from, to) {
  if (!map.has(from)) map.set(from, new Set());
  map.get(from).add(to);
}

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
    <div class="history-names">${parts.length ? parts.join("  |  ") : "从任意部位开始选择吧～"}</div>
  `;

  statusTip.textContent = "提示：你可以从任意部位开始，系统会根据你的搭配图推荐其他候选";
}

function refreshAllCandidates() {
  slots.forEach((s) => {
    renderCandidatesForSlot(s);
  });
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
      <div class="meta-line"><span class="tag">${formatCategory(c)}</span></div>
    `;

    card.addEventListener("click", () => {
      applyChoice(slot, c);
    });

    container.appendChild(card);
  });
}

function applyChoice(slot, cloth) {
  // dress 与 top/bottom 的互斥处理（简化）：
  // 选 dress 时自动清空 top & bottom（更符合常识）
  if (slot === "dress") {
    outfit.dress = cloth;
    outfit.top = null;
    outfit.bottom = null;
  } else if (slot === "top" || slot === "bottom") {
    outfit[slot] = cloth;
    // 选 top/bottom 时，若之前选了 dress，自动清空 dress
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
    alert(`没有可选的 ${slot}`);
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

function getCandidates(slot) {
  const clothes = getClothes();
  const season = outfit.season;

  // 先按季节过滤
  let pool = clothes.filter(c => Array.isArray(c.seasons) && c.seasons.includes(season));

  // 按槽位过滤（用 category 为主）
  pool = pool.filter(c => matchesSlot(slot, c));

  // 基于已选集合，过滤 deny
  const selected = getSelectedIds();
  pool = pool.filter(c => {
    // 不推荐已经选中的同一件
    if (selected.includes(c.id)) return false;

    for (const sid of selected) {
      const denySet = graph.deny.get(sid);
      if (denySet && denySet.has(c.id)) return false;
    }
    return true;
  });

  // allow 优先：如果已选集合里任何一件有 allow 指向候选，则优先显示
  // 如果没有任何 allow，允许探索区：显示全部（已过滤 deny）
  const allowHits = [];
  const rest = [];

  for (const c of pool) {
    if (isAllowedByAnySelected(c.id)) allowHits.push(c);
    else rest.push(c);
  }

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
  if (slot === "top") return cat === "top"; // 内搭/外搭细分后再加 layer=inner
  if (slot === "bottom") return cat === "skirt" || cat === "pants";
  if (slot === "dress") return cat === "dress";
  if (slot === "shoes") return cat === "shoes";
  if (slot === "socks") return cat === "socks";
  return false;
}

function inferCategoryFromType(type) {
  const map = { jk_set:"dress", daily_set:"dress", top:"top", skirt:"skirt", pants:"pants", shoes:"shoes", socks:"socks" };
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
  const map = { spring:"春", summer:"夏", autumn:"秋", winter:"冬" };
  return map[season] || season;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function saveToHistory() {
  const ids = getSelectedIds();
  if (!ids.length) {
    alert("当前没有可保存的穿搭，请先选择衣服");
    return;
  }

  // 用今天日期保存
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;

  saveHistoryBtn.disabled = true;
  saveHistoryBtn.textContent = "保存中…";
  try {
    await apiCreateOutfit({ date, items: ids, note: null, rating: null });
    alert("已保存到历史 ✅");
  } catch (e) {
    console.error(e);
    alert(`保存失败：${e.message || e}`);
  } finally {
    saveHistoryBtn.disabled = false;
    saveHistoryBtn.textContent = "保存到历史";
  }
}