export function renderWardrobe(clothes, { onDelete }) {
  const listEl = document.getElementById("clothList");
  listEl.innerHTML = "";

  if (!clothes.length) {
    listEl.innerHTML = `<div class="empty-tip">还没有衣服，先添加几件吧～</div>`;
    return;
  }

  clothes.forEach((cloth) => {
    const card = document.createElement("div");
    card.className = "cloth-card";

    const imageHTML = cloth.image ? `<img src="${cloth.image}" alt="${escapeHtml(cloth.name)}">` : "";
    card.innerHTML = `
      ${imageHTML}
      <div class="cloth-name">${escapeHtml(cloth.name)}</div>
      <span class="tag">${escapeHtml(cloth.tag)}</span>
      <button class="delete-btn" type="button">删除</button>
    `;

    const deleteBtn = card.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", () => {
      onDelete(cloth.id);
    });

    listEl.appendChild(card);
  });
}

export function renderOutfit(result) {
  renderOutfitCard("outfitTop", "上衣", result.top);
  renderOutfitCard("outfitPants", "裤子", result.pants);
  renderOutfitCard("outfitShoes", "鞋子", result.shoes);
}

function renderOutfitCard(elementId, label, item) {
  const el = document.getElementById(elementId);

  if (!item) {
    el.innerHTML = `${label}：无`;
    return;
  }

  const imageHTML = item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">` : "";
  el.innerHTML = `
    ${imageHTML}
    <p>${label}：${escapeHtml(item.name)}</p>
  `;
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}