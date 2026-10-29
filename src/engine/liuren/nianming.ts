/**
 * 大六壬 · 年命（本命与行年）。2026-10-29。
 *
 * 《六壬大全》卷三 9b 注：「日上三傳本命行年六處最緊」。
 * 行年依卷六 23a 观月经注：「男行年一嵗起丙寅」「女行年一嵗起壬申」，原书自带两例
 * 「四十九在甲寅」（男）、「三十四在己亥」（女），tests 里逐例复现。注文写的是「逆總順零」
 * 「順總零逆」的速算口诀，与男顺行、女逆行六十甲子等价（两例可证）。
 *
 * 本命取出生年的地支（生肖），由用户选定；虚岁按农历新年（春节）换岁——**软件约定，非原书所定**
 * （另有以立春或生日换岁之说）。出生年与生肖一并填写，正月里出生、春节前后的生肖由用户自己定。
 *
 * 课上看的是「上神」：地盘本命位、行年位上所加的天盘神，及其天将、与日干的关系。
 * 年命是哪一个人的，由用户定（问别人的事，就填那个人的）。
 */
import { Solar } from "lunar-javascript";
import { DIZHI, JIAZI, zhiIndex, type Zhi } from "./ganzhi.js";

export interface NianmingInput {
  /** 出生的公历年 */
  birthYear: number;
  /** 生肖对应的地支（本命） */
  benming: Zhi;
  gender: "男" | "女";
}

/** 某农历年的年支：1984 甲子年 → 子。 */
export function yearZhi(lunarYear: number): Zhi {
  return DIZHI[(((lunarYear - 4) % 12) + 12) % 12]!;
}

/** 公历出生年 + 生肖 → 出生的农历年（生肖与公历年支不同，即生在春节前，取上一年）。 */
export function birthLunarYear(birthYear: number, benming: Zhi): number {
  if (yearZhi(birthYear) === benming) return birthYear;
  if (yearZhi(birthYear - 1) === benming) return birthYear - 1;
  throw new Error(`${birthYear} 年出生的人，生肖只可能是 ${yearZhi(birthYear)} 或 ${yearZhi(birthYear - 1)}`);
}

/** 虚岁（按春节换岁）。 */
export function xusui(at: Date, birthYear: number, benming: Zhi): number {
  const cur = Solar.fromYmdHms(at.getFullYear(), at.getMonth() + 1, at.getDate(), at.getHours(), at.getMinutes(), 0)
    .getLunar().getYear();
  const n = cur - birthLunarYear(birthYear, benming) + 1;
  if (n < 1 || n > 150) throw new Error(`虚岁 ${n} 不在合理范围`);
  return n;
}

/** 行年干支：男一岁丙寅顺行，女一岁壬申逆行。 */
export function xingnian(age: number, gender: "男" | "女"): string {
  const start = JIAZI.indexOf(gender === "男" ? "丙寅" : "壬申");
  const step = gender === "男" ? age - 1 : -(age - 1);
  return JIAZI[(((start + step) % 60) + 60) % 60]!;
}

export interface NianmingSpot {
  /** 「本命」或「行年」 */
  role: "本命" | "行年";
  /** 本命为生肖支；行年为干支 */
  label: string;
  /** 所在地盘位 */
  zhi: Zhi;
  /** 上神（天盘） */
  shang: Zhi;
}

export function nianmingSpots(
  input: NianmingInput, at: Date, tianOn: Readonly<Record<string, Zhi>>,
): { age: number; spots: NianmingSpot[] } {
  const age = xusui(at, input.birthYear, input.benming);
  const xn = xingnian(age, input.gender);
  const xz = xn.slice(1) as Zhi;
  zhiIndex(xz); // 校验
  return {
    age,
    spots: [
      { role: "本命", label: input.benming, zhi: input.benming, shang: tianOn[input.benming]! },
      { role: "行年", label: xn, zhi: xz, shang: tianOn[xz]! },
    ],
  };
}
