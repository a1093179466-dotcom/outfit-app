import { apiCreateOutfit, apiListOutfits, apiDeleteOutfit } from "./api_client.js";

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function initHistoryUI({ getClothesMap, getCurrentOutfitIds, onRestore }){
  const dateEl = document.getElementById("histDate");
  const ratingEl = document.getElementById("histRating");
  const noteEl = document.getElementById("histNote");
  const saveBtn = document.getElementById("saveHistoryBtn");

  if (dateEl) dateEl.value = todayStr();

  saveBtn.addEventListener("click", async () => {
    const ids = getCurrentOutfitIds();
    if (!ids.length) {
      alert("当前没有可保存的穿搭（请先生成穿搭）");
      return;
    }

    const payload = {
      date: dateEl.value || todayStr(),
      items: ids,
      note: (noteEl.value || "").trim() || null,
      rating: ratingEl.value ? Number(ratingEl.value) : null,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "保存中…";
    try {
      await apiCreateOutfit(payload);
      noteEl.value = "";
      ratingEl.value = "";
      await renderHistory({ getClothesMap, onRestore });
    } catch (e) {
      console.error(e);
      alert(`保存历史失败：${e.message || e}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "保存到历史";
    }
  });

  await renderHistory({ getClothesMap, onRestore });
}

export async function renderHistory({ getClothesMap, onRestore }) {
  const listEl = document.getElementById("historyList");
  if (!listEl) return;

  const map = getClothesMap(); // id -> cloth
  const items = await apiListOutfits(30);

  if (!items.length) {
    listEl.innerHTML = `<div class="empty-tip">暂无历史记录</div>`;
    return;
  }

  listEl.innerHTML = "";
  items.forEach((h) => {
    const div = document.createElement("div");
    div.className = "history-item";

    const names = (h.items || []).map((id) => map[id]?.name || `(已删除:${id.slice(0, 6)})`);
    const rating = h.rating ? `评分：${h.rating}` : "未评分";
    const note = h.note ? h.note : "";

    div.innerHTML = `
      <div class="history-head">
        <strong>${h.date}</strong>
        <span>${rating}</span>
      </div>
      <div class="history-names">${names.join(" + ")}</div>
      ${note ? `<div class="history-note">${escapeHtml(note)}</div>` : ""}
      <div class="history-actions">
        <button class="primary-btn restore-btn" type="button">恢复</button>
        <button class="delete-btn delete-history-btn" type="button">删除</button>
      </div>
    `;

    // ✅ 恢复穿搭
    div.querySelector(".restore-btn").addEventListener("click", () => {
      if (typeof onRestore === "function") onRestore(h.items || []);
    });

    // ✅ 删除历史
    div.querySelector(".delete-history-btn").addEventListener("click", async () => {
      try {
        await apiDeleteOutfit(h.id);
        await renderHistory({ getClothesMap, onRestore });
      } catch (e) {
        console.error(e);
        alert(`删除历史失败：${e.message || e}`);
      }
    });

    listEl.appendChild(div);
  });
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}