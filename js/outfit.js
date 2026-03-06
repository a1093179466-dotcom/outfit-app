function randomItem(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function filterBySeason(clothes, season) {
  if (!season) return clothes;
  return clothes.filter(c => Array.isArray(c.seasons) && c.seasons.includes(season));
}

function chooseStructure(hasDress, hasMix) {
  if (hasDress && hasMix) return Math.random() < 0.5 ? "dress" : "mix";
  if (hasDress) return "dress";
  return "mix";
}

export function generateOutfit(clothes, season = "") {
  const pool = filterBySeason(clothes, season);

  const dresses = pool.filter(c => c.category === "dress");
  const inners = pool.filter(c => c.category === "top" && c.layer === "inner");
  const skirts = pool.filter(c => c.category === "skirt");
  const outers = pool.filter(c => c.category === "outer" && c.layer === "outer");
  const shoesList = pool.filter(c => c.category === "shoes");
  const socksList = pool.filter(c => c.category === "socks");

  const needOuter = ["spring", "autumn", "winter"].includes(season);
  const optionalOuter = season === "summer"; // 50% 概率加外搭

  const shoes = randomItem(shoesList);
  const socks = randomItem(socksList);

  const hasDress = dresses.length > 0;
  const hasMix = inners.length > 0 && skirts.length > 0;

  const mode = chooseStructure(hasDress, hasMix);

  let main1 = null;
  let main2 = null;

  if (mode === "dress") {
    main1 = randomItem(dresses);
    main2 = null;
  } else {
    main1 = randomItem(inners);
    main2 = randomItem(skirts);
  }

  let outer = null;
  if (needOuter) {
    outer = randomItem(outers);
  } else if (optionalOuter) {
    if (Math.random() < 0.5) outer = randomItem(outers);
  }

  // 返回统一结构：main1/main2 + outer + shoes + socks
  return { main1, main2, outer, shoes, socks, season, mode };
}