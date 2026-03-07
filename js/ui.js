// js/ui.js

export function renderWardrobe(clothes) {
  const listEl = document.getElementById("clothList");
  listEl.innerHTML = "";

  if (!clothes || clothes.length === 0) {
    listEl.innerHTML = `<div class="empty-tip">还没有衣服，先去衣柜详情添加吧～</div>`;
    return;
  }

  clothes.forEach((cloth) => {
    const card = document.createElement("div");
    card.className = "cloth-card";

    const imageHTML = cloth.image
      ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">`
      : "";

    card.innerHTML = `
      ${imageHTML}
      <div class="cloth-name">${escapeHtml(cloth.name)}</div>
      <div class="meta-line"><span class="tag">${escapeHtml(formatKind(cloth.kind))}</span></div>
      <div class="meta-line">季节：${escapeHtml(formatSeasons(cloth.seasons))}</div>
    `;

    listEl.appendChild(card);
  });
}

export function renderOutfit(result) {
  renderOutfitCard("outfitMain1", "主件1", result?.main1 ?? null);
  renderOutfitCard("outfitMain2", "主件2", result?.main2 ?? null);
  renderOutfitCard("outfitBottom", "下装", result?.bottom ?? null);
  renderOutfitCard("outfitSocks", "袜子", result?.socks ?? null);
  renderOutfitCard("outfitShoes", "鞋子", result?.shoes ?? null);
}

function renderOutfitCard(elementId, label, item) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!item) {
    el.innerHTML = `${label}：无`;
    return;
  }

  const imageHTML = item.image
    ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">`
    : "";

  el.innerHTML = `
    ${imageHTML}
    <div class="cloth-name">${escapeHtml(item.name)}</div>
    <div class="meta-line"><span class="tag">${escapeHtml(formatKind(item.kind))}</span></div>
  `;
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
  };
  return map[kind] || kind || "未分类";
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