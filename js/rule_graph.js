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
const loadAllBtn = el("loadAllBtn");
const graphTip = el("graphTip");

/** Edge menu */
const edgeMenu = el("edgeMenu");
const edgeMenuTitle = el("edgeMenuTitle");
const menuPrefer = el("menuPrefer");
const menuDeny = el("menuDeny");
const menuDelete = el("menuDelete");
const menuCancel = el("menuCancel");

let nodes = new Map(); // clothId -> {id, x,y, el}
let edges = new Map(); // key -> {a,b,type} type: prefer/deny
let deletedEdgeKeys = new Set(); // ✅ 记录“用户明确删除过”的边 key，用于保存时删库
let selectedNodeId = null;

/** backend rules for syncing */
let backendRuleIdByKey = new Map();    // key -> ruleId
let backendRuleTypeByKey = new Map();  // key -> prefer/deny/allow

/** menu state */
let menuState = {
  mode: "new",     // "new" | "edit"
  pendingA: null,  // for new
  pendingB: null,
  editKey: null,
  x: 0,
  y: 0,
};

init();

async function init() {
  await initWardrobeFromApi();
  await loadBackendRules();

  bindFilters();
  renderLeftList();

  bindCanvasDnD();
  bindMenu();

  canvas.addEventListener("click", () => {
    selectedNodeId = null;
    highlightSelected();
    hideMenu();
  });

  clearCanvasBtn.addEventListener("click", () => {
    nodes.clear();
    edges.clear();
    edgesSvg.innerHTML = "";
    canvas.querySelectorAll(".node").forEach(n => n.remove());
    selectedNodeId = null;
    highlightSelected();
    hideMenu();
    graphTip.textContent = "已清空画布（数据库未删除）。";
  });

  saveGraphBtn.addEventListener("click", saveAllRules);
  loadAllBtn.addEventListener("click", loadAllRulesToCanvas);
}

/** ---------- Filters ---------- */
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

/** ---------- Canvas DnD ---------- */
function bindCanvasDnD() {
  canvas.addEventListener("dragover", (e) => e.preventDefault());
  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addNode(id, x, y, true);
  });
}

/** add node and optionally auto-draw edges among existing nodes based on backend rules */
function addNode(clothId, x, y, autoAttachEdges) {
  if (nodes.has(clothId)) return;

  const cloth = getClothes().find(c => c.id === clothId);
  if (!cloth) return;

  const node = document.createElement("div");
  node.className = "node";
  const nx = clamp(x - 95, 0, canvas.clientWidth - 210);
  const ny = clamp(y - 70, 0, canvas.clientHeight - 210);
  node.style.left = `${nx}px`;
  node.style.top = `${ny}px`;
  node.dataset.id = clothId;

  const img = cloth.image ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">` : "";
  node.innerHTML = `
    <div class="node-del" title="删除">×</div>
    ${img}
    <div class="node-title">${escapeHtml(cloth.name)}</div>
    <div class="node-meta">${escapeHtml(formatKind(cloth.kind))}</div>
  `;

  canvas.appendChild(node);

  const data = { id: clothId, x: nx, y: ny, el: node };
  nodes.set(clothId, data);

  // click to connect
  node.addEventListener("click", (e) => {
    e.stopPropagation();
    hideMenu();

    // 点击删除角标
    if (e.target && e.target.classList.contains("node-del")) {
      deleteNode(clothId);
      return;
    }

    onNodeClick(clothId, e.clientX, e.clientY);
  });

  enableNodeDrag(data);

  if (autoAttachEdges) {
    attachExistingRulesForNode(clothId);
  }

  redrawEdges();
}

/** delete node and connected edges (canvas only) */
function deleteNode(clothId) {
  const nd = nodes.get(clothId);
  if (!nd) return;

  // ✅ 关键：把被删除的连线记为 tombstone，保存时会删库
  for (const key of Array.from(edges.keys())) {
    const e = edges.get(key);
    if (!e) continue;
    if (e.a === clothId || e.b === clothId) {
      deletedEdgeKeys.add(key);   // ⭐新增
      edges.delete(key);
    }
  }

  nd.el.remove();
  nodes.delete(clothId);

  if (selectedNodeId === clothId) selectedNodeId = null;
  highlightSelected();
  redrawEdges();
  graphTip.textContent = "已删除画布节点及其连线（保存后会同步删除数据库规则）。";
}

/** auto attach existing backend rules between this node and existing canvas nodes */
function attachExistingRulesForNode(clothId) {
  for (const otherId of nodes.keys()) {
    if (otherId === clothId) continue;
    const key = pairKey(clothId, otherId);
    const rType = backendRuleTypeByKey.get(key);
    if (!rType) continue;
    const type = normalizeRuleType(rType);
    edges.set(key, { a: clothId, b: otherId, type });
  }
}

/** ---------- Node Drag ---------- */
function enableNodeDrag(nodeData) {
  const node = nodeData.el;
  let dragging = false;
  let offsetX = 0, offsetY = 0;

  node.addEventListener("mousedown", (e) => {
    // 点到删除按钮不触发拖拽
    if (e.target && e.target.classList.contains("node-del")) return;

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
    nx = clamp(nx, 0, cRect.width - 210);
    ny = clamp(ny, 0, cRect.height - 210);
    nodeData.x = nx; nodeData.y = ny;
    node.style.left = `${nx}px`;
    node.style.top = `${ny}px`;
    redrawEdges();
  });

  window.addEventListener("mouseup", () => dragging = false);
}

/** ---------- Connect Nodes ---------- */
function onNodeClick(id, clientX, clientY) {
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
    // 已有边：打开编辑菜单
    openEdgeMenuForEdit(key, clientX, clientY);
    return;
  }

  // 新边：打开创建菜单
  openEdgeMenuForNew(a, b, clientX, clientY);
}

/** ---------- Edges Render ---------- */
function redrawEdges() {
  edgesSvg.setAttribute("width", canvas.clientWidth);
  edgesSvg.setAttribute("height", canvas.clientHeight);
  edgesSvg.innerHTML = "";

  for (const [key, e] of edges.entries()) {
    const na = nodes.get(e.a);
    const nb = nodes.get(e.b);
    if (!na || !nb) continue;

    const x1 = na.x + 95, y1 = na.y + 55;
    const x2 = nb.x + 95, y2 = nb.y + 55;

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

    // 点击线：打开编辑菜单（鼠标位置）
    line.addEventListener("click", (evt) => {
      evt.stopPropagation();
      openEdgeMenuForEdit(key, evt.clientX, evt.clientY);
    });
  }
}

/** ---------- Edge Menu (no prompt) ---------- */
function bindMenu() {
  menuPrefer.addEventListener("click", async () => {
    if (menuState.mode === "new") {
      edges.set(pairKey(menuState.pendingA, menuState.pendingB), {
        a: menuState.pendingA,
        b: menuState.pendingB,
        type: "prefer",
      });
    } else {
      const e = edges.get(menuState.editKey);
      if (e) e.type = "prefer";
    }
    hideMenu();
    redrawEdges();
  });

  menuDeny.addEventListener("click", async () => {
    if (menuState.mode === "new") {
      edges.set(pairKey(menuState.pendingA, menuState.pendingB), {
        a: menuState.pendingA,
        b: menuState.pendingB,
        type: "deny",
      });
    } else {
      const e = edges.get(menuState.editKey);
      if (e) e.type = "deny";
    }
    hideMenu();
    redrawEdges();
  });

menuDelete.addEventListener("click", async () => {
  if (menuState.mode === "edit" && menuState.editKey) {
    deletedEdgeKeys.add(menuState.editKey);  // ✅ 新增
    edges.delete(menuState.editKey);
  }
  hideMenu();
  redrawEdges();
});

  menuCancel.addEventListener("click", () => hideMenu());

  // 点击页面其他区域关闭
  window.addEventListener("click", () => hideMenu());
}

function openEdgeMenuForNew(a, b, clientX, clientY) {
  menuState = { mode: "new", pendingA: a, pendingB: b, editKey: null, x: clientX, y: clientY };
  edgeMenuTitle.textContent = "新建连线：选择类型";
  menuDelete.style.display = "none";
  showMenu(clientX, clientY);
}

function openEdgeMenuForEdit(key, clientX, clientY) {
  menuState = { mode: "edit", pendingA: null, pendingB: null, editKey: key, x: clientX, y: clientY };
  const e = edges.get(key);
  edgeMenuTitle.textContent = `编辑连线（当前：${e?.type === "deny" ? "禁忌" : "优先"}）`;
  menuDelete.style.display = "inline-block";
  showMenu(clientX, clientY);
}

function showMenu(x, y) {
  // 防止出屏
  const w = 180, h = 120;
  const nx = clamp(x + 8, 8, window.innerWidth - w - 8);
  const ny = clamp(y + 8, 8, window.innerHeight - h - 8);
  edgeMenu.style.left = `${nx}px`;
  edgeMenu.style.top = `${ny}px`;
  edgeMenu.style.display = "block";
}

function hideMenu() {
  edgeMenu.style.display = "none";
}

/** ---------- Backend Sync ---------- */
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

async function loadAllRulesToCanvas() {
  await loadBackendRules();

  // 清空画布（仅画布）
  nodes.clear();
  edges.clear();
  edgesSvg.innerHTML = "";
  canvas.querySelectorAll(".node").forEach(n => n.remove());
  selectedNodeId = null;
  highlightSelected();
  hideMenu();

  // 从后端规则提取涉及的衣服 id
  const ids = new Set();
  for (const key of backendRuleIdByKey.keys()) {
    const [a, b] = key.split("|");
    ids.add(a); ids.add(b);
  }

  // 简单网格布局自动放置
  const idList = Array.from(ids);
  const cols = Math.max(3, Math.floor(canvas.clientWidth / 220));
  const startX = 30, startY = 30;
  const dx = 210, dy = 220;

  idList.forEach((id, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * dx;
    const y = startY + row * dy;
    addNode(id, x, y, false);
  });

  // 添加所有规则边
  for (const [key, typeRaw] of backendRuleTypeByKey.entries()) {
    const [a, b] = key.split("|");
    if (!nodes.has(a) || !nodes.has(b)) continue;
    edges.set(key, { a, b, type: normalizeRuleType(typeRaw) });
  }

  redrawEdges();
  graphTip.textContent = `已加载 ${idList.length} 个节点、${edges.size} 条规则到画布。`;
}

function normalizeRuleType(raw) {
  if (raw === "deny") return "deny";
  // allow / prefer -> prefer
  return "prefer";
}

async function saveAllRules() {
  try {
    graphTip.textContent = "保存中…";

    // ✅ 关键：保存前强制刷新后端规则映射
    await loadBackendRules();

    // 1) upsert 画布所有边
    let upsertOk = 0;
    for (const [key, e] of edges.entries()) {
      await apiUpsertPairRule(e.a, { other_id: e.b, rule: e.type, note: null });
      upsertOk += 1;
    }

    // 2) delete：后端存在但画布没有的规则（仅限画布内节点之间）
    const nodeIds = new Set(nodes.keys());
    const keysOnCanvas = new Set(edges.keys());

    let deleteOk = 0;
    let deleteTry = 0;

// ✅ 2.1 先处理 tombstone（明确删除）
    for (const key of Array.from(deletedEdgeKeys)) {
      const ruleId = backendRuleIdByKey.get(key);
      if (!ruleId) continue; // 可能原本就不在 DB
      deleteTry += 1;
      await apiDeletePairRule(ruleId);
      deleteOk += 1;
      deletedEdgeKeys.delete(key); // 删成功就移出（避免重复删）
    }

    // ✅ 2.2 再处理“画布内节点之间”的差异删除（原策略保留）
    for (const [key, ruleId] of backendRuleIdByKey.entries()) {
      if (keysOnCanvas.has(key)) continue;
      const [a, b] = key.split("|");
      if (nodeIds.has(a) && nodeIds.has(b)) {
        deleteTry += 1;
        await apiDeletePairRule(ruleId);
        deleteOk += 1;
      }
    }

    // 3) 再拉一次（拿到最新 ruleId）
    await loadBackendRules();

    graphTip.textContent = `保存成功 ✅ upsert=${upsertOk}，delete=${deleteOk}/${deleteTry}`;
  } catch (e) {
    console.error(e);
    graphTip.textContent = `保存失败 ❌ ${e.message || e}`;
    alert(`保存失败：${e.message || e}\n请打开 F12 → Network 查看请求返回码`);
  }
}

/** ---------- Utils ---------- */
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function highlightSelected() {
  canvas.querySelectorAll(".node").forEach(n => n.classList.remove("selected"));
  if (selectedNodeId) {
    const node = canvas.querySelector(`.node[data-id="${selectedNodeId}"]`);
    if (node) node.classList.add("selected");
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatKind(kind) {
  const map = { jk_set:"JK套装", daily_set:"日常套装", outer:"外搭", inner:"内搭", bottom:"下装", socks:"袜子", shoes:"鞋子" };
  return map[kind] || kind || "未分类";
}

function escapeHtml(str="") {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}