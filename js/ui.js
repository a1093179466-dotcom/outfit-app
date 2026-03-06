// js/ui.js

export function renderWardrobe(clothes, { onDelete }) {
  const listEl = document.getElementById("clothList");
  listEl.innerHTML = "";

  if (!clothes || clothes.length === 0) {
    listEl.innerHTML = `<div class="empty-tip">还没有衣服，先添加几件吧～</div>`;
    return;
  }

  clothes.forEach((cloth) => {
    const card = document.createElement("div");
    card.className = "cloth-card";

    const imageHTML = cloth.image
      ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">`
      : "";

    const typeLabel = formatType(cloth.type);
    const seasonLabel = formatSeasons(cloth.seasons);
    const versatileLabel = cloth.versatile ? "是" : "否";

    card.innerHTML = `
      ${imageHTML}
      <div class="cloth-name">${escapeHtml(cloth.name)}</div>
      <div class="meta-line"><span class="tag">${escapeHtml(typeLabel)}</span></div>
      <div class="meta-line">季节：${escapeHtml(seasonLabel)}</div>
      <div class="meta-line">百搭：${versatileLabel}</div>
      <button class="delete-btn" type="button">删除</button>
    `;

    const deleteBtn = card.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", () => onDelete(cloth.id));

    listEl.appendChild(card);
  });
}

/**
 * 渲染穿搭结果（兼容新旧两套 DOM id）
 * - 新版页面：outfitMain1/outfitMain2/outfitShoes/outfitSocks
 * - 旧版页面：outfitTop/outfitPants/outfitShoes
 */
export function renderOutfit(result) {
  const hasNew =
    document.getElementById("outfitMain1") ||
    document.getElementById("outfitMain2") ||
    document.getElementById("outfitSocks");

  if (hasNew) {
    // 你的 outfit.js 返回 {main1, main2, shoes, socks}
    renderOutfitCard("outfitMain1", "主件1", result?.main1 ?? null);
    renderOutfitCard("outfitMain2", "主件2", result?.main2 ?? null);
    renderOutfitCard("outfitShoes", "鞋子", result?.shoes ?? null);
    renderOutfitCard("outfitSocks", "袜子", result?.socks ?? null);
    return;
  }

  // 旧版映射（如果你主页还没改成主件1/2的布局）
  renderOutfitCard("outfitTop", "上衣", result?.main1 ?? result?.top ?? null);
  renderOutfitCard("outfitPants", "裤子", result?.main2 ?? result?.pants ?? null);
  renderOutfitCard("outfitShoes", "鞋子", result?.shoes ?? null);
}

function renderOutfitCard(elementId, label, item) {
  const el = document.getElementById(elementId);

  if (!el) {
    console.warn("Outfit element not found:", elementId);
    return;
  }

  if (!item) {
    el.innerHTML = `${label}：无`;
    return;
  }

  const imageHTML = item.image
    ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">`
    : "";

  const typeLabel = item.type ? formatType(item.type) : "";

  el.innerHTML = `
    ${imageHTML}
    <p>${label}：${escapeHtml(item.name)}</p>
    ${typeLabel ? `<p>类型：${escapeHtml(typeLabel)}</p>` : ""}
  `;
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
  return map[type] || String(type || "");
}

function formatSeasons(seasons = []) {
  const map = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  return (seasons || []).map((s) => map[s] || s).join(" / ");
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}