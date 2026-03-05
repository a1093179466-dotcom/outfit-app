function randomItem(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 第一阶段基础规则（不考虑季节、百搭、限制搭配）：
 * - 套装方案： [套装 + 鞋子 + 袜子]
 * - 散搭方案： [单上衣 + 单裙子 + 鞋子 + 袜子]
 *
 * 概率要求：
 * - 如果两种方案都“可行”（衣柜里都有对应类型），则 50% 套装 / 50% 散搭
 * - 如果只有一种方案可行，则使用那一种
 * - 如果主件缺失，则对应位置返回 null
 */
export function generateOutfit(clothes) {
  const jkSets = clothes.filter((c) => c.type === "jk_set");
  const dailySets = clothes.filter((c) => c.type === "daily_set");
  const tops = clothes.filter((c) => c.type === "top");
  const skirts = clothes.filter((c) => c.type === "skirt");
  const shoesList = clothes.filter((c) => c.type === "shoes");
  const socksList = clothes.filter((c) => c.type === "socks");

  const allSets = [...jkSets, ...dailySets];

  const canUseSet = allSets.length > 0;
  const canUseMix = tops.length > 0 && skirts.length > 0;

  // 鞋袜可以缺省（显示“无”）
  const shoes = randomItem(shoesList);
  const socks = randomItem(socksList);

  // 两种都可行 -> 50/50
  if (canUseSet && canUseMix) {
    const useSet = Math.random() < 0.5;
    if (useSet) {
      return {
        main1: randomItem(allSets),
        main2: null,
        shoes,
        socks,
      };
    }
    return {
      main1: randomItem(tops),
      main2: randomItem(skirts),
      shoes,
      socks,
    };
  }

  // 只有套装可行
  if (canUseSet) {
    return {
      main1: randomItem(allSets),
      main2: null,
      shoes,
      socks,
    };
  }

  // 只有散搭可行（注意：如果只缺上衣或只缺裙子，也尽量给出已有的）
  if (tops.length > 0 || skirts.length > 0) {
    return {
      main1: randomItem(tops),
      main2: randomItem(skirts),
      shoes,
      socks,
    };
  }

  // 主件都没有
  return {
    main1: null,
    main2: null,
    shoes,
    socks,
  };
}