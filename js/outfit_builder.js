import { getClothes, initWardrobeFromApi } from "./wardrobe.js";
import { apiListAllPairRules } from "./api_client.js";

const el = (id) => document.getElementById(id);

const seasonSelect = el("seasonSelect");
const startSlot = el("startSlot");
const pickStartBtn = el("pickStartBtn");
const statusTip = el("statusTip");

const currentOutfitEl = el("currentOutfit");
const autoCompleteBtn = el("autoCompleteBtn");
const clearOutfitBtn = el("clearOutfitBtn");

const candOuter = el("candOuter");
const candMain2 = el("candMain2");
const candBottom = el("candBottom");
const candSocks = el("candSocks");
const candShoes = el("candShoes");

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

const slots = ["outer", "main2", "bottom", "socks", "shoes"];

let outfit = {
  season: "autumn",
  outer: null,
  main2: null,
  bottom: null,
  socks: null,
  shoes: null,
};

let graph = {
  deny: new Map(),
  prefer: new Map(), // prefer + allow
};

init();

async function init() {
  outfit.season = seasonSelect.value;
  await initWardrobeFromApi();
  await rebuildGraph();

  bindEvents();
  renderCurrentOutfit();
  refreshAllCandidates();
}

function bindEvents() {
  seasonSelect.addEventListener("change", async () => {
    outfit.season = seasonSelect.value;
    renderCurrentOutfit();
    refreshAllCandidates();
  });

  pickStartBtn.addEventListener("click", () => pickRandomForSlot(startSlot.value));
  autoCompleteBtn.addEventListener("click", autoComplete);
  clearOutfitBtn.addEventListener("click", () => {
    outfit = { season: seasonSelect.value, outer:null, main2:null, bottom:null, socks:null, shoes:null };
    renderCurrentOutfit();
    refreshAllCandidates();
  });

  autoOuter.addEventListener("click", () => pickRandomForSlot("outer"));
  autoMain2.addEventListener("click", () => pickRandomForSlot("main2"));
  autoBottom.addEventListener("click", () => pickRandomForSlot("bottom"));
  autoSocks.addEventListener("click", () => pickRandomForSlot("socks"));
  autoShoes.addEventListener("click", () => pickRandomForSlot("shoes"));

  clearOuter.addEventListener("click", () => { outfit.outer=null; renderCurrentOutfit(); refreshAllCandidates(); });
  clearMain2.addEventListener("click", () => { outfit.main2=null; outfit.bottom=null; renderCurrentOutfit(); refreshAllCandidates(); });
  clearBottom.addEventListener("click", () => { outfit.bottom=null; renderCurrentOutfit(); refreshAllCandidates(); });
  clearSocks.addEventListener("click", () => { outfit.socks=null; renderCurrentOutfit(); refreshAllCandidates(); });
  clearShoes.addEventListener("click", () => { outfit.shoes=null; renderCurrentOutfit(); refreshAllCandidates(); });
}

async function rebuildGraph() {
  const deny = new Map();
  const prefer = new Map();

  try {
    const rules = await apiListAllPairRules();
    for (const r of rules) {
      const a = r.a_id, b = r.b_id;
      if (r.rule === "deny") {
        addEdge(deny, a, b); addEdge(deny, b, a);
      } else if (r.rule === "prefer" || r.rule === "allow") {
        addEdge(prefer, a, b); addEdge(prefer, b, a);
      }
    }
  } catch (e) {
    console.warn("pair graph load failed:", e);
  }

  graph = { deny, prefer };
}

function addEdge(map, from, to) {
  if (!map.has(from)) map.set(from, new Set());
  map.get(from).add(to);
}

function filterBySeason(list, season) {
  return list.filter(c => Array.isArray(c.seasons) && c.seasons.includes(season));
}

function selectedIds() {
  return slots.map(s => outfit[s]?.id).filter(Boolean);
}

function violatesAnyDeny(candidateId) {
  for (const sid of selectedIds()) {
    const s = graph.deny.get(sid);
    if (s && s.has(candidateId)) return true;
  }
  return false;
}

function preferScore(candidateId) {
  let score = 0;
  for (const sid of selectedIds()) {
    const p = graph.prefer.get(sid);
    if (p && p.has(candidateId)) score += 1;
  }
  return score;
}

function getCandidates(slot) {
  let pool = filterBySeason(getClothes(), outfit.season);

  if (slot === "outer") pool = pool.filter(c => c.kind === "outer");
  if (slot === "main2") pool = pool.filter(c => ["jk_set","daily_set","inner"].includes(c.kind));
  if (slot === "bottom") pool = pool.filter(c => c.kind === "bottom");
  if (slot === "socks") pool = pool.filter(c => c.kind === "socks");
  if (slot === "shoes") pool = pool.filter(c => c.kind === "shoes");

  if (slot === "bottom" && outfit.main2 && ["jk_set","daily_set"].includes(outfit.main2.kind)) {
    return { preferred: [], other: [], disabled: "主件2为套装时不需要下装" };
  }

  const sel = selectedIds();
  pool = pool.filter(c => !sel.includes(c.id));
  pool = pool.filter(c => !violatesAnyDeny(c.id));

  const scored = pool.map(c => ({ c, score: preferScore(c.id) }));
  const preferred = scored.filter(x => x.score > 0).sort((a,b) => b.score-a.score).map(x => x.c);
  const other = scored.filter(x => x.score === 0).map(x => x.c);

  return { preferred, other, disabled: "" };
}

function refreshAllCandidates() {
  renderSlot("outer", candOuter);
  renderSlot("main2", candMain2);
  renderSlot("bottom", candBottom);
  renderSlot("socks", candSocks);
  renderSlot("shoes", candShoes);
}

function renderSlot(slot, container) {
  container.innerHTML = "";
  const { preferred, other, disabled } = getCandidates(slot);
  if (disabled) {
    container.innerHTML = `<div class="empty-tip">${disabled}</div>`;
    return;
  }

  const prefTitle = document.createElement("div");
  prefTitle.className = "meta-line";
  prefTitle.innerHTML = `<strong>⭐ 优先搭配</strong>`;
  container.appendChild(prefTitle);

  const prefGrid = document.createElement("div");
  prefGrid.className = "detail-grid";
  container.appendChild(prefGrid);

  if (!preferred.length) prefGrid.innerHTML = `<div class="empty-tip">暂无优先推荐</div>`;
  else preferred.slice(0, 18).forEach(c => prefGrid.appendChild(makeCard(slot, c)));

  const details = document.createElement("details");
  details.style.marginTop = "10px";
  const summary = document.createElement("summary");
  summary.textContent = `🔎 其他可选（未冲突）${other.length ? `：${other.length}项` : ""}`;
  details.appendChild(summary);

  const otherGrid = document.createElement("div");
  otherGrid.className = "detail-grid";
  otherGrid.style.marginTop = "10px";
  details.appendChild(otherGrid);

  if (!other.length) otherGrid.innerHTML = `<div class="empty-tip">无其他候选</div>`;
  else other.slice(0, 30).forEach(c => otherGrid.appendChild(makeCard(slot, c)));

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
  card.addEventListener("click", () => applyChoice(slot, cloth));
  return card;
}

function applyChoice(slot, cloth) {
  if (slot === "outer") outfit.outer = cloth;
  if (slot === "main2") {
    outfit.main2 = cloth;
    if (["jk_set","daily_set"].includes(cloth.kind)) outfit.bottom = null;
  }
  if (slot === "bottom") outfit.bottom = cloth;
  if (slot === "socks") outfit.socks = cloth;
  if (slot === "shoes") outfit.shoes = cloth;

  renderCurrentOutfit();
  refreshAllCandidates();
}

function pickRandomForSlot(slot) {
  const { preferred, other, disabled } = getCandidates(slot);
  if (disabled) return alert(disabled);

  const pool = preferred.length ? preferred : other;
  if (!pool.length) return alert(`没有可选的：${slot}`);

  const pick = pool[Math.floor(Math.random() * pool.length)];
  applyChoice(slot, pick);
}

function autoComplete() {
  if (selectedIds().length === 0) pickRandomForSlot(startSlot.value);
  if (!outfit.main2) pickRandomForSlot("main2");
  if (outfit.main2 && outfit.main2.kind === "inner" && !outfit.bottom) pickRandomForSlot("bottom");
  if (!outfit.outer && Math.random() < 0.5) pickRandomForSlot("outer");
  if (!outfit.socks) pickRandomForSlot("socks");
  if (!outfit.shoes) pickRandomForSlot("shoes");
}

function renderCurrentOutfit() {
  currentOutfitEl.innerHTML = "";

  const parts = [
    ["外搭", outfit.outer],
    ["主件2", outfit.main2],
    ["下装", (outfit.main2 && outfit.main2.kind === "inner") ? outfit.bottom : null],
    ["袜子", outfit.socks],
    ["鞋子", outfit.shoes],
  ];

  parts.forEach(([label, item]) => {
    const div = document.createElement("div");
    div.className = "history-item";

    if (!item) {
      div.innerHTML = `<div class="history-head"><strong>${label}</strong><span>无</span></div>`;
    } else {
      const img = item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" style="width:100%; max-height:180px; object-fit:cover; border-radius:10px; margin-top:8px;">` : "";
      div.innerHTML = `
        <div class="history-head"><strong>${label}：${escapeHtml(item.name)}</strong><span>${escapeHtml(formatKind(item.kind))}</span></div>
        ${img}
      `;
    }
    currentOutfitEl.appendChild(div);
  });

  statusTip.textContent = "候选会实时剔除禁忌；‘帮我选’优先从优先搭配中随机。";
}

function formatKind(kind) {
  const map = { jk_set:"JK套装", daily_set:"日常套装", outer:"外搭", inner:"内搭", bottom:"下装", socks:"袜子", shoes:"鞋子" };
  return map[kind] || kind || "未分类";
}
function escapeHtml(str="") {
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}