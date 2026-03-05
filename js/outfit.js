function randomItem(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateOutfit(clothes) {
  // 当前版本仍然是简单规则：上衣 + 裤子 + 鞋子
  // 后续会升级为：上衣+裙子+鞋子+袜子 / 套装+鞋子+袜子
  const tops = clothes.filter((c) => c.tag === "上衣");
  const pants = clothes.filter((c) => c.tag === "裤子");
  const shoes = clothes.filter((c) => c.tag === "鞋子" || c.tag === "鞋");

  return {
    top: randomItem(tops),
    pants: randomItem(pants),
    shoes: randomItem(shoes),
  };
}