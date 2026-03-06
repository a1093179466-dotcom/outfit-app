function randomItem(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function filterBySeason(clothes, season) {
  if (!season) return clothes;
  return clothes.filter(c => Array.isArray(c.seasons) && c.seasons.includes(season));
}

/**
 * season: "spring" | "summer" | "autumn" | "winter" | ""(不过滤)
 */
export function generateOutfit(clothes, season = "") {
  const pool = filterBySeason(clothes, season);

  const jkSets = pool.filter((c) => c.type === "jk_set");
  const dailySets = pool.filter((c) => c.type === "daily_set");
  const tops = pool.filter((c) => c.type === "top");
  const skirts = pool.filter((c) => c.type === "skirt");
  const shoesList = pool.filter((c) => c.type === "shoes");
  const socksList = pool.filter((c) => c.type === "socks");

  const allSets = [...jkSets, ...dailySets];

  const canUseSet = allSets.length > 0;
  const canUseMix = tops.length > 0 && skirts.length > 0;

  const shoes = randomItem(shoesList);
  const socks = randomItem(socksList);

  if (canUseSet && canUseMix) {
    const useSet = Math.random() < 0.5;
    if (useSet) {
      return { main1: randomItem(allSets), main2: null, shoes, socks };
    }
    return { main1: randomItem(tops), main2: randomItem(skirts), shoes, socks };
  }

  if (canUseSet) {
    return { main1: randomItem(allSets), main2: null, shoes, socks };
  }

  if (tops.length > 0 || skirts.length > 0) {
    return { main1: randomItem(tops), main2: randomItem(skirts), shoes, socks };
  }

  return { main1: null, main2: null, shoes, socks };
}