/**
 * 八卦表（CLAUDE.md §4.1）。移植自 plum/core/bagua.py，数值逐项等价。
 *
 * 数据全部可溯源到《梅花易数》.txt（§11 铁律）：
 *   · 先天数 xiantianNum —— L1「乾一，兑二，离三，震四，巽五，坎六，艮七，坤八」
 *   · 五行   wuxing      —— L16「乾兑金，坤艮土，震巽木，坎水，离火」
 *   · 三爻   lines       —— 八卦取象歌，bottom→top，1=阳 0=阴
 * 后天数 houtianNum 为通行洛书定数，非 TXT 行锚，仅供方位类占用，不作任何 A 层黄金答案。
 */

export type Bit = 0 | 1;
export type Lines3 = readonly [Bit, Bit, Bit];

export interface Bagua {
  readonly name: string;
  readonly symbol: string;
  readonly lines: Lines3;
  readonly xiantianNum: number;
  readonly houtianNum: number;
  readonly wuxing: string;
  readonly direction: string;
  readonly xiang: readonly string[];
}

// 三爻校验：八卦取象歌
//   乾☰三连 111 / 兑☱上缺 110 / 离☲中虚 101 / 震☳仰盂 100
//   巽☴下断 011 / 坎☵中满 010 / 艮☶覆碗 001 / 坤☷六断 000
export const BAGUA: Readonly<Record<string, Bagua>> = Object.freeze({
  乾: { name: "乾", symbol: "☰", lines: [1, 1, 1], xiantianNum: 1, houtianNum: 6, wuxing: "金", direction: "西北", xiang: ["天", "父", "首", "马", "君", "金玉"] },
  兑: { name: "兑", symbol: "☱", lines: [1, 1, 0], xiantianNum: 2, houtianNum: 7, wuxing: "金", direction: "西", xiang: ["泽", "少女", "口", "羊", "巫"] },
  离: { name: "离", symbol: "☲", lines: [1, 0, 1], xiantianNum: 3, houtianNum: 9, wuxing: "火", direction: "南", xiang: ["火", "中女", "目", "雉", "日", "明"] },
  震: { name: "震", symbol: "☳", lines: [1, 0, 0], xiantianNum: 4, houtianNum: 3, wuxing: "木", direction: "东", xiang: ["雷", "长男", "足", "龙", "动"] },
  巽: { name: "巽", symbol: "☴", lines: [0, 1, 1], xiantianNum: 5, houtianNum: 4, wuxing: "木", direction: "东南", xiang: ["风", "长女", "股", "鸡", "木"] },
  坎: { name: "坎", symbol: "☵", lines: [0, 1, 0], xiantianNum: 6, houtianNum: 1, wuxing: "水", direction: "北", xiang: ["水", "中男", "耳", "豕", "险", "盗"] },
  艮: { name: "艮", symbol: "☶", lines: [0, 0, 1], xiantianNum: 7, houtianNum: 8, wuxing: "土", direction: "东北", xiang: ["山", "少男", "手", "狗", "止"] },
  坤: { name: "坤", symbol: "☷", lines: [0, 0, 0], xiantianNum: 8, houtianNum: 2, wuxing: "土", direction: "西南", xiang: ["地", "母", "腹", "牛", "众", "布"] },
});

const ALL = Object.values(BAGUA);

/** 先天数 → 卦名（起卦核心映射，来源 L1）。 */
export const XIANTIAN_TO_NAME: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(ALL.map((b) => [b.xiantianNum, b.name])),
);
/** 卦名 → 先天数。 */
export const NAME_TO_XIANTIAN: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(ALL.map((b) => [b.name, b.xiantianNum])),
);
/** 三爻 → 卦名（互/变卦回查用）。 */
const LINES_KEY_TO_NAME: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(ALL.map((b) => [b.lines.join(""), b.name])),
);

function must<T>(v: T | undefined, msg: string): T {
  if (v === undefined) throw new Error(msg);
  return v;
}

/** 先天数（已按 mod8 归一，余0取8）→ 八卦对象。 */
export function byXiantian(num: number): Bagua {
  const name = must(XIANTIAN_TO_NAME[num], `无此先天数：${num}`);
  return must(BAGUA[name], `无此卦名：${name}`);
}

/** 三爻 → 八卦对象。 */
export function byLines(lines: readonly Bit[]): Bagua {
  const key = lines.join("");
  const name = must(LINES_KEY_TO_NAME[key], `无此三爻组合：${key}`);
  return must(BAGUA[name], `无此卦名：${name}`);
}

export function wuxingOf(name: string): string {
  return must(BAGUA[name], `无此卦名：${name}`).wuxing;
}
