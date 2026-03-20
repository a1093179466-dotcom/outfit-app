import { initWardrobeFromApi, getClothes } from "./wardrobe.js";
import { apiListAllPairRules, apiUpsertPairRule, apiDeletePairRule } from "./api_client.js";

const el = (id) => document.getElementById(id);

const qName = el("qName");
const seasonFilter = el("seasonFilter");
const kindFilter = el("kindFilter");
const clothList = el("clothList");

const canvas = el("canvas");
const edgesSvg = el("edgesSvg");
const saveGraphBtn = el("saveGraphBtn");
const clearCanvasBtn = el("clearCanvasBtn");
const graphTip = el("graphTip");

let nodes = new Map(); // clothId -> {id, x,y, el}
let edges = new Map(); // key(a|b) -> {a,b,type, ruleId?}

let selectedNodeId = null;

// 后端已有规则（用于删除/同步）
let backendRuleIdByKey = new Map(); // key -> ruleId
let backendRuleTypeByKey = new Map(); // key -> "prefer"/"deny"/"allow"

init();

async function init() {
  await initWardrobeFromApi();
  await loadBackendRules();

  bindFilters();
  renderLeftList();

  bindCanvasDnD();
  saveGraphBtn.addEventListener("click", saveAllRules);
  clearCanvasBtn.addEventListener("click", () => {
    nodes.clear();
    edges.clear();
    edgesSvg.innerHTML = "";
    canvas.querySelectorAll(".node").forEach(n => n.remove());
    selectedNodeId = null;
  });
}

function bindFilters() {
  [qName, seasonFilter, kindFilter].forEach(x => {
    x.addEventListener("input", renderLeftList);
    x.addEventListener("change", renderLeftList);
  });
}

function renderLeftList() {
  const nameQ = (qName.value || "").trim().toLowerCase();
  const season = seasonFilter.value || "";
  const kind = kindFilter.value || "";

  const list = getClothes().filter(c => {
    if (nameQ && !String(c.name||"").toLowerCase().includes(nameQ)) return false;
    if (season && !(c.seasons||[]).includes(season)) return false;
    if (kind && c.kind !== kind) return false;
    return true;
  });

  clothList.innerHTML = "";
  list.forEach(c => clothList.appendChild(makeLeftCard(c)));
}

function makeLeftCard(cloth) {
  const card = document.createElement("div");
  card.className = "cloth-card";
  card.draggable = true;
  card.dataset.id = cloth.id;

  const img = cloth.image ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">` : "";
  card.innerHTML = `
    ${img}
    <div class="cloth-name">${escapeHtml(cloth.name)}</div>
    <div class="meta-line"><span class="tag">${escapeHtml(formatKind(cloth.kind))}</span></div>
  `;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", cloth.id);
  });

  return card;
}

function bindCanvasDnD() {
  canvas.addEventListener("dragover", (e) => e.preventDefault());
  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addNode(id, x, y);
  });
}

function addNode(clothId, x, y) {
  if (nodes.has(clothId)) return;

  const cloth = getClothes().find(c => c.id === clothId);
  if (!cloth) return;

  const node = document.createElement("div");
  node.className = "node";
  node.style.left = `${Math.max(0, x - 90)}px`;
  node.style.top = `${Math.max(0, y - 60)}px`;
  node.dataset.id = clothId;

  const img = cloth.image ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">` : "";
  node.innerHTML = `
    ${img}
    <div class="node-title">${escapeHtml(cloth.name)}</div>
    <div class="node-meta">${escapeHtml(formatKind(cloth.kind))}</div>
  `;

  canvas.appendChild(node);

  const data = { id: clothId, x: Math.max(0, x - 90), y: Math.max(0, y - 60), el: node };
  nodes.set(clothId, data);

  // click to connect
  node.addEventListener("click", (e) => {
    e.stopPropagation();
    onNodeClick(clothId);
  });

  // drag inside canvas
  enableNodeDrag(data);

  redrawEdges();
}

function enableNodeDrag(nodeData) {
  const node = nodeData.el;
  let dragging = false;
  let offsetX = 0, offsetY = 0;

  node.addEventListener("mousedown", (e) => {
    dragging = true;
    const rect = node.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const cRect = canvas.getBoundingClientRect();
    let nx = e.clientX - cRect.left - offsetX;
    let ny = e.clientY - cRect.top - offsetY;
    nx = Math.max(0, Math.min(nx, cRect.width - 200));
    ny = Math.max(0, Math.min(ny, cRect.height - 200));
    nodeData.x = nx; nodeData.y = ny;
    node.style.left = `${nx}px`;
    node.style.top = `${ny}px`;
    redrawEdges();
  });

  window.addEventListener("mouseup", () => dragging = false);
}

function onNodeClick(id) {
  if (!selectedNodeId) {
    selectedNodeId = id;
    highlightSelected();
    graphTip.textContent = "已选第一个节点，请再点一个节点连线。";
    return;
  }
  if (selectedNodeId === id) {
    selectedNodeId = null;
    highlightSelected();
    graphTip.textContent = "已取消选择。";
    return;
  }

  const a = selectedNodeId;
  const b = id;
  selectedNodeId = null;
  highlightSelected();

  const key = pairKey(a, b);
  if (edges.has(key)) {
    graphTip.textContent = "这两件已经连线了，点击线可修改/删除。";
    return;
  }

  const type = prompt("输入规则类型：prefer 或 deny", "prefer");
  if (!type || !["prefer","deny"].includes(type)) {
    graphTip.textContent = "已取消创建连线。";
    return;
  }

  edges.set(key, { a, b, type, ruleId: backendRuleIdByKey.get(key) || null });
  redrawEdges();
}

function highlightSelected() {
  canvas.querySelectorAll(".node").forEach(n => n.classList.remove("selected"));
  if (selectedNodeId) {
    const node = canvas.querySelector(`.node[data-id="${selectedNodeId}"]`);
    if (node) node.classList.add("selected");
  }
}

function redrawEdges() {
  edgesSvg.setAttribute("width", canvas.clientWidth);
  edgesSvg.setAttribute("height", canvas.clientHeight);
  edgesSvg.innerHTML = "";

  for (const [key, e] of edges.entries()) {
    const na = nodes.get(e.a);
    const nb = nodes.get(e.b);
    if (!na || !nb) continue;

    const x1 = na.x + 90, y1 = na.y + 40;
    const x2 = nb.x + 90, y2 = nb.y + 40;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1); line.setAttribute("y1", y1);
    line.setAttribute("x2", x2); line.setAttribute("y2", y2);
    line.setAttribute("stroke", e.type === "deny" ? "#e74c3c" : "#4a69bd");
    line.setAttribute("stroke-width", "3");
    line.classList.add("edge-hit");
    line.style.pointerEvents = "all";
    edgesSvg.appendChild(line);

    const tx = (x1 + x2) / 2, ty = (y1 + y2) / 2;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", tx);
    text.setAttribute("y", ty);
    text.setAttribute("text-anchor", "middle");
    text.classList.add("edge-label");
    text.textContent = e.type === "deny" ? "❌禁忌" : "⭐优先";
    edgesSvg.appendChild(text);

    line.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const action = prompt("输入操作：toggle（切换类型） / delete（删除连线）", "toggle");
      if (action === "toggle") {
        e.type = e.type === "deny" ? "prefer" : "deny";
        edges.set(key, e);
        redrawEdges();
      } else if (action === "delete") {
        edges.delete(key);
        redrawEdges();
      }
    });
  }
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

async function loadBackendRules() {
  backendRuleIdByKey.clear();
  backendRuleTypeByKey.clear();
  const rules = await apiListAllPairRules();
  rules.forEach(r => {
    const key = pairKey(r.a_id, r.b_id);
    backendRuleIdByKey.set(key, r.id);
    backendRuleTypeByKey.set(key, r.rule);
  });
}

async function saveAllRules() {
  // 1) upsert 所有当前 edges
  for (const [key, e] of edges.entries()) {
    // 后端 upsert 需要 cloth_id + other_id
    await apiUpsertPairRule(e.a, { other_id: e.b, rule: e.type, note: null });
  }

  // 2) 删除：后端存在但画布没有的规则（只删除你当前画布涉及到的节点之间的规则，避免误删全库）
  const nodeIds = new Set(nodes.keys());
  const keysOnCanvas = new Set(edges.keys());

  for (const [key, ruleId] of backendRuleIdByKey.entries()) {
    if (keysOnCanvas.has(key)) continue;
    const [a, b] = key.split("|");
    if (nodeIds.has(a) && nodeIds.has(b)) {
      // 只删“画布内节点之间”的规则
      await apiDeletePairRule(ruleId);
    }
  }

  await loadBackendRules();
  graphTip.textContent = "保存成功 ✅（画布内规则已同步到数据库）";
}

function formatKind(kind) {
  const map = { jk_set:"JK套装", daily_set:"日常套装", outer:"外搭", inner:"内搭", bottom:"下装", socks:"袜子", shoes:"鞋子" };
  return map[kind] || kind || "未分类";
}

function escapeHtml(str="") {
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}