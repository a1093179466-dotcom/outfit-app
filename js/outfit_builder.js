// js/outfit_builder.js

import { getClothes, initWardrobeFromApi } from "./wardrobe.js";
import {
  apiListAllPairRules,
  apiCreatePreset,
  apiListPresets,
  apiDeletePreset,
} from "./api_client.js";

const el = (id) => document.getElementById(id);

/** Controls */
const seasonSelect = el("seasonSelect");
const startSlot = el("startSlot");
const pickStartBtn = el("pickStartBtn");
const statusTip = el("statusTip");

/** Current outfit */
const currentOutfitEl = el("currentOutfit");
const autoCompleteBtn = el("autoCompleteBtn");
const clearOutfitBtn = el("clearOutfitBtn");

/** Presets */
const presetNote = el("presetNote");
const savePresetBtn = el("savePresetBtn");
const loadPresetBtn = el("loadPresetBtn");
const presetList = el("presetList");

/** Candidate containers */
const candOuter = el("candOuter");
const candMain2 = el("candMain2");
const candBottom = el("candBottom");
const candSocks = el("candSocks");
const candShoes = el("candShoes");

/** Auto/Clear buttons */
const autoOuter = el("autoOuter");
const autoMain2 = el("autoMain2");
const autoBottom = el("autoBottom");
const autoSocks = el("autoSocks");
const autoShoes = el("autoShoes");

const clearOuter = el("clearOuter");
const clearMain2 = el("clearMain2");
const clearBottom = el("clearBottom");
const clearSocks = el("clearSocks");
const clearShoes = el("clearShoes");

/** Slots (kind-based) */
const slots = ["outer", "main2", "bottom", "socks", "shoes"];

/**
 * Outfit state:
 * - main1 -> outer (optional)
 * - main2 -> one of: jk_set / daily_set / inner
 * - bottom -> required only if main2 is inner
 */
let outfit = {
  season: "autumn",
  outer: null,  // kind=outer
  main2: null,  // kind in {jk_set,daily_set,inner}
  bottom: null, // kind=bottom (only if main2.kind === "inner")
  socks: null,  // kind=socks
  shoes: null,  // kind=shoes
};

/**
 * Graph:
 * - deny: Map<id, Set<id>>
 * - prefer: Map<id, Set<id>>  (包含旧 allow)
 */
let graph = {
  deny: new Map(),
  prefer: new Map(),
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
  seasonSelect.addEventListener("change", async () => {
    outfit.season = seasonSelect.value;
    renderCurrentOutfit();
    refreshAllCandidates();
    await renderPresetList();
  });

  pickStartBtn.addEventListener("click", () => {
    pickRandomStart();
  });

  autoCompleteBtn.addEventListener("click", () => {
    autoComplete();
  });

  clearOutfitBtn.addEventListener("click", () => {
    outfit = {
      season: seasonSelect.value,
      outer: null,
      main2: null,
      bottom: null,
      socks: null,
      shoes: null,
    };
    renderCurrentOutfit();
    refreshAllCandidates();
  });

  // Auto pick
  autoOuter.addEventListener("click", () => pickRandomForSlot("outer"));
  autoMain2.addEventListener("click", () => pickRandomForSlot("main2"));
  autoBottom.addEventListener("click", () => pickRandomForSlot("bottom"));
  autoSocks.addEventListener("click", () => pickRandomForSlot("socks"));
  autoShoes.addEventListener("click", () => pickRandomForSlot("shoes"));

  // Clear
  clearOuter.addEventListener("click", () => { outfit.outer = null; renderCurrentOutfit(); refreshAllCandidates(); });
  clearMain2.addEventListener("click", () => { outfit.main2 = null; outfit.bottom = null; renderCurrentOutfit(); refreshAllCandidates(); });
  clearBottom.addEventListener("click", () => { outfit.bottom = null; renderCurrentOutfit(); refreshAllCandidates(); });
  clearSocks.addEventListener("click", () => { outfit.socks = null; renderCurrentOutfit(); refreshAllCandidates(); });
  clearShoes.addEventListener("click", () => { outfit.shoes = null; renderCurrentOutfit(); refreshAllCandidates(); });

  // Presets
  savePresetBtn.addEventListener("click", savePreset);
  loadPresetBtn.addEventListener("click", loadRandomPreset);
}

/** ===== Graph build (prefer/deny) ===== */

async function rebuildGraph() {
  const deny = new Map();
  const prefer = new Map();

  try {
    const rules = await apiListAllPairRules();

    for (const r of rules) {
      const a = r.a_id;
      const b = r.b_id;
      const rule = r.rule;

      if (rule === "deny") {
        addEdge(deny, a, b);
        addEdge(deny, b, a);
      } else if (rule === "prefer" || rule === "allow") {
        // 兼容旧 allow：当作 prefer
        addEdge(prefer, a, b);
        addEdge(prefer, b, a);
      }
    }
  } catch (e) {
    console.warn("拉取穿搭图失败，使用空图：", e);
  }

  graph = { deny, prefer };
}

function addEdge(map, from, to) {
  if (!map.has(from)) map.set(from, new Set());
  map.get(from).add(to);
}

/** ===== Core rule helpers ===== */

function filterBySeason(list, season) {
  return list.filter(c => Array.isArray(c.seasons) && c.seasons.includes(season));
}

function isDenied(aId, bId) {
  const s = graph.deny.get(aId);
  return !!(s && s.has(bId));
}

function preferScore(candidateId) {
  // 分数 = 与当前已选所有衣服的 prefer 命中数量
  const selected = getSelectedIds();
  let score = 0;
  for (const sid of selected) {
    const p = graph.prefer.get(sid);
    if (p && p.has(candidateId)) score += 1;
  }
  return score;
}

function violatesAnyDeny(candidateId) {
  const selected = getSelectedIds();
  for (const sid of selected) {
    if (isDenied(sid, candidateId)) return true;
  }
  return false;
}

function getSelectedIds() {
  return slots.map(s => outfit[s]?.id).filter(Boolean);
}

/** ===== Candidate generation (real-time) ===== */

function getCandidatesForSlot(slot) {
  const season = outfit.season;
  let pool = filterBySeason(getClothes(), season);

  // Slot pool by kind
  if (slot === "outer") {
    pool = pool.filter(c => c.kind === "outer");
  } else if (slot === "main2") {
    pool = pool.filter(c => c.kind === "jk_set" || c.kind === "daily_set" || c.kind === "inner");
  } else if (slot === "bottom") {
    pool = pool.filter(c => c.kind === "bottom");
  } else if (slot === "socks") {
    pool = pool.filter(c => c.kind === "socks");
  } else if (slot === "shoes") {
    pool = pool.filter(c => c.kind === "shoes");
  }

  // bottom 条件：仅当 main2 是 inner 才需要；如果 main2 是套装则 bottom 只能为空
  if (slot === "bottom") {
    if (!outfit.main2) {
      // 主件2未选时，仍允许先选下装（你希望“除了鞋袜以外都可起点”）
      // 所以这里不限制
    } else if (outfit.main2.kind !== "inner") {
      // 套装：下装不需要
      return { preferred: [], other: [], disabledBecause: "主件2为套装时不需要下装" };
    }
  }

  // deny filter + remove selected itself
  const selectedIds = getSelectedIds();
  pool = pool.filter(c => !selectedIds.includes(c.id));
  pool = pool.filter(c => !violatesAnyDeny(c.id));

  // scoring
  const scored = pool.map(c => ({ c, score: preferScore(c.id) }));

  // preferred = score>0, sorted desc
  const preferred = scored.filter(x => x.score > 0).sort((a,b) => b.score - a.score).map(x => x.c);

  // other = score==0
  const other = scored.filter(x => x.score === 0).map(x => x.c);

  return { preferred, other, disabledBecause: "" };
}

function refreshAllCandidates() {
  renderSlotCandidates("outer", candOuter);
  renderSlotCandidates("main2", candMain2);
  renderSlotCandidates("bottom", candBottom);
  renderSlotCandidates("socks", candSocks);
  renderSlotCandidates("shoes", candShoes);
}

function renderSlotCandidates(slot, container) {
  container.innerHTML = "";
  const { preferred, other, disabledBecause } = getCandidatesForSlot(slot);

  if (disabledBecause) {
    container.innerHTML = `<div class="empty-tip">${disabledBecause}</div>`;
    return;
  }

  // Preferred section
  const prefTitle = document.createElement("div");
  prefTitle.className = "meta-line";
  prefTitle.innerHTML = `<strong>⭐ 优先搭配</strong>`;
  container.appendChild(prefTitle);

  const prefGrid = document.createElement("div");
  prefGrid.className = "detail-grid";
  container.appendChild(prefGrid);

  if (!preferred.length) {
    prefGrid.innerHTML = `<div class="empty-tip">暂无优先推荐</div>`;
  } else {
    preferred.slice(0, 18).forEach(c => prefGrid.appendChild(makeCard(slot, c)));
  }

  // Other section (collapsible)
  const details = document.createElement("details");
  details.style.marginTop = "10px";

  const summary = document.createElement("summary");
  summary.textContent = `🔎 其他可选（未冲突）${other.length ? `：${other.length}项` : ""}`;
  details.appendChild(summary);

  const otherGrid = document.createElement("div");
  otherGrid.className = "detail-grid";
  otherGrid.style.marginTop = "10px";
  details.appendChild(otherGrid);

  if (!other.length) {
    otherGrid.innerHTML = `<div class="empty-tip">无其他候选</div>`;
  } else {
    other.slice(0, 30).forEach(c => otherGrid.appendChild(makeCard(slot, c)));
  }

  container.appendChild(details);
}

function makeCard(slot, cloth) {
  const card = document.createElement("div");
  card.className = "cloth-card";

  const img = cloth.image ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">` : "";
  card.innerHTML = `
    ${img}
    <div class="cloth-name">${escapeHtml(cloth.name)}</div>
    <div class="meta-line"><span class="tag">${escapeHtml(formatKind(cloth.kind))}</span></div>
  `;

  card.addEventListener("click", () => {
    if (violatesAnyDeny(cloth.id)) {
      alert("该选择与当前已选存在禁忌搭配，已阻止选择。");
      return;
    }
    applyChoice(slot, cloth);
  });

  return card;
}

/** ===== Apply choice (real-time update) ===== */

function applyChoice(slot, cloth) {
  if (slot === "outer") {
    outfit.outer = cloth;
  } else if (slot === "main2") {
    outfit.main2 = cloth;
    // 若主件2为套装，则自动清空下装
    if (cloth.kind === "jk_set" || cloth.kind === "daily_set") {
      outfit.bottom = null;
    }
  } else if (slot === "bottom") {
    outfit.bottom = cloth;
  } else if (slot === "socks") {
    outfit.socks = cloth;
  } else if (slot === "shoes") {
    outfit.shoes = cloth;
  }

  // 规则：若主件2是 inner，则下装可选；若主件2是套装，则下装强制空（已处理）
  renderCurrentOutfit();
  refreshAllCandidates();
}

/** ===== Random pick (prefer-first) ===== */

function pickRandomFrom(preferred, other) {
  if (preferred.length) {
    // prefer-first：从最高分层随机（我们 preferred 已按分数排序，但这里进一步取最高分层）
    // 计算最高分
    const topScore = preferScore(preferred[0].id);
    const topGroup = preferred.filter(c => preferScore(c.id) === topScore);
    return topGroup[Math.floor(Math.random() * topGroup.length)];
  }
  if (other.length) {
    return other[Math.floor(Math.random() * other.length)];
  }
  return null;
}

function pickRandomForSlot(slot) {
  const { preferred, other, disabledBecause } = getCandidatesForSlot(slot);
  if (disabledBecause) {
    alert(disabledBecause);
    return;
  }
  const picked = pickRandomFrom(preferred, other);
  if (!picked) {
    alert(`没有可选的：${slotLabel(slot)}`);
    return;
  }
  applyChoice(slot, picked);
}

function pickRandomStart() {
  const s = startSlot.value; // outer / main2 / bottom
  pickRandomForSlot(s);
}

/** ===== Auto-complete ===== */

function autoComplete() {
  // 起点为空时先随机一个起点（按当前 startSlot）
  if (getSelectedIds().length === 0) {
    pickRandomStart();
  }

  // 主件2优先补全（因为决定是否需要下装）
  if (!outfit.main2) pickRandomForSlot("main2");

  // 若主件2是 inner，则补下装；是套装则不选下装
  if (outfit.main2 && outfit.main2.kind === "inner" && !outfit.bottom) {
    pickRandomForSlot("bottom");
  }

  // 外搭可选：如果你想默认随机出现，可在这里加概率；现在一键补全默认不强制外搭
  // 但你也可以希望“有更完整穿搭”——这里给一个 50% 概率自动补外搭：
  if (!outfit.outer && Math.random() < 0.5) {
    pickRandomForSlot("outer");
  }

  if (!outfit.socks) pickRandomForSlot("socks");
  if (!outfit.shoes) pickRandomForSlot("shoes");

  renderCurrentOutfit();
  refreshAllCandidates();
}

/** ===== Current Outfit Render ===== */

function renderCurrentOutfit() {
  const parts = [];
  const add = (label, item) => { if (item) parts.push(`${label}:${item.name}`); };

  add("外搭", outfit.outer);
  add("主件2", outfit.main2);
  // 下装仅当主件2是内搭时有效展示
  if (outfit.main2 && outfit.main2.kind === "inner") add("下装", outfit.bottom);
  add("袜子", outfit.socks);
  add("鞋子", outfit.shoes);

  const msg = parts.length ? parts.join("  |  ") : "还没有选择。可从外搭/主件2/下装开始。";

  currentOutfitEl.innerHTML = `
    <div class="history-head">
      <strong>季节：${formatSeason(outfit.season)}</strong>
      <span>${parts.length ? "选择中" : "空"}</span>
    </div>
    <div class="history-names">${escapeHtml(msg)}</div>
  `;

  statusTip.textContent =
    "规则：禁忌(deny)会实时剔除；优先搭配(prefer/allow)会提升推荐与随机优先级。";
}

/** ===== Presets (save/load) ===== */

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
        <div class="history-names">${escapeHtml(names.join(" + "))}</div>
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
 * items 数组方式：按 kind 自动落槽位
 * - outer -> outer
 * - jk_set/daily_set/inner -> main2 (优先套装，其次内搭)
 * - bottom -> bottom
 * - socks -> socks
 * - shoes -> shoes
 */
function applyPresetItems(ids) {
  const byId = new Map(getClothes().map((c) => [c.id, c]));
  const picked = (ids || []).map((id) => byId.get(id)).filter(Boolean);

  outfit.outer = picked.find(c => c.kind === "outer") || null;

  // main2 优先套装，否则内搭
  outfit.main2 =
    picked.find(c => c.kind === "jk_set" || c.kind === "daily_set") ||
    picked.find(c => c.kind === "inner") ||
    null;

  outfit.bottom = picked.find(c => c.kind === "bottom") || null;
  outfit.socks = picked.find(c => c.kind === "socks") || null;
  outfit.shoes = picked.find(c => c.kind === "shoes") || null;

  // 套装时清空下装
  if (outfit.main2 && (outfit.main2.kind === "jk_set" || outfit.main2.kind === "daily_set")) {
    outfit.bottom = null;
  }

  renderCurrentOutfit();
  refreshAllCandidates();
}

/** ===== Formatting ===== */

function formatKind(kind) {
  const map = {
    jk_set: "JK套装",
    daily_set: "日常套装",
    outer: "外搭",
    inner: "内搭",
    bottom: "下装",
    socks: "袜子",
    shoes: "鞋子",
  };
  return map[kind] || kind || "未分类";
}

function formatSeason(season) {
  const map = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  return map[season] || season;
}

function slotLabel(slot) {
  const map = {
    outer: "外搭",
    main2: "主件2（套装/内搭）",
    bottom: "下装",
    socks: "袜子",
    shoes: "鞋子",
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