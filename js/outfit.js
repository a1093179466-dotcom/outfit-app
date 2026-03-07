// js/outfit.js

function randomItem(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function filterBySeason(clothes, season) {
  if (!season) return clothes;
  return clothes.filter(c => Array.isArray(c.seasons) && c.seasons.includes(season));
}

export function generateOutfit(clothes, season) {
  const pool = filterBySeason(clothes, season);

  const outers = pool.filter(c => c.kind === "outer");
  const inners = pool.filter(c => c.kind === "inner");
  const bottoms = pool.filter(c => c.kind === "bottom");
  const socksList = pool.filter(c => c.kind === "socks");
  const shoesList = pool.filter(c => c.kind === "shoes");
  const jkSets = pool.filter(c => c.kind === "jk_set");
  const dailySets = pool.filter(c => c.kind === "daily_set");

  const sets = [...jkSets, ...dailySets];

  // 主件1：外搭，50% 有/无
  let main1 = null;
  if (outers.length > 0 && Math.random() < 0.5) {
    main1 = randomItem(outers);
  }

  // 主件2：套装 vs 内搭（两边都存在 -> 50/50）
  const canSet = sets.length > 0;
  const canInner = inners.length > 0;

  let main2 = null;
  let bottom = null;

  if (canSet && canInner) {
    const chooseSet = Math.random() < 0.5;
    if (chooseSet) {
      main2 = randomItem(sets);
      bottom = null; // 套装不选下装
    } else {
      main2 = randomItem(inners);
      bottom = randomItem(bottoms);
    }
  } else if (canSet) {
    main2 = randomItem(sets);
    bottom = null;
  } else if (canInner) {
    main2 = randomItem(inners);
    bottom = randomItem(bottoms);
  } else {
    main2 = null;
    bottom = randomItem(bottoms); // 没内搭也没套装时，至少给个下装（可为空）
  }

  const socks = randomItem(socksList);
  const shoes = randomItem(shoesList);

  return { season, main1, main2, bottom, socks, shoes };
}