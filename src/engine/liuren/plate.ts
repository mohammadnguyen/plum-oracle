/**
 * 大六壬 · 天地盘与四课。
 *
 * 地盘十二支固定不动；天盘由「月将加占时」旋转而成——把月将放到地盘的占时位上，
 * 其余顺布。四课自天盘取：一二课属日干，三四课属日支。
 *
 * 一处要紧的细节（写错了全盘的贼克判断都会歪）：
 *   **第一课的「下」是日干本身，不是寄宫地支。** 寄宫只用来在地盘上定位，
 *   取到干上神之后，判生克时用的是日干的五行。阳干与寄宫同五行（甲木寄寅木），
 *   看不出差别；阴干就不同了——乙木寄辰土、辛金寄戌土、癸水寄丑土，
 *   若拿寄宫去判克，这几个日子的三传会整个错掉。
 */
import {
  DIZHI, GAN_WUXING, JIGONG, ZHI_WUXING, zhiAt, zhiIndex,
  type Gan, type Wuxing, type Zhi,
} from "./ganzhi.js";

/** 天地盘：地盘支 → 其上所乘的天盘支。 */
export type Plate = Readonly<Record<string, Zhi>>;

export interface PlatePair {
  /** 地盘位 → 天盘神（「某支上神」查这张） */
  tian: Plate;
  /** 天盘支 → 其所临的地盘位（「某神下临」查这张） */
  diOf: Plate;
  /** 是否伏吟：月将与占时同支，天地盘重叠 */
  fuyin: boolean;
  /** 是否返吟：月将与占时相冲，天地盘对冲 */
  fanyin: boolean;
}

/**
 * 月将加占时 → 天地盘。
 * @param yuejiang 月将地支
 * @param zhanshi  占时地支
 */
export function buildPlate(yuejiang: string, zhanshi: string): PlatePair {
  const offset = zhiIndex(yuejiang) - zhiIndex(zhanshi);
  const tian: Record<string, Zhi> = {};
  const diOf: Record<string, Zhi> = {};
  for (const di of DIZHI) {
    const up = zhiAt(zhiIndex(di) + offset);
    tian[di] = up;
    diOf[up] = di;
  }
  const d = ((offset % 12) + 12) % 12;
  return { tian, diOf, fuyin: d === 0, fanyin: d === 6 };
}

/** 一课。`xia` 第一课为日干（天干），其余为地支。 */
export interface Ke {
  /** 课序 1–4（一、二课属干，三、四课属支） */
  index: 1 | 2 | 3 | 4;
  /** 上神（天盘） */
  shang: Zhi;
  /** 下神：第一课为日干本身，二三四课为地支 */
  xia: string;
  /** 下神的五行（第一课取日干五行，不取寄宫五行） */
  xiaWuxing: Wuxing;
  shangWuxing: Wuxing;
  /** 上克下 */
  shangKeXia: boolean;
  /** 下贼上 */
  xiaZeiShang: boolean;
  label: string;
}

export interface SiKe {
  ke: [Ke, Ke, Ke, Ke];
  /** 日干 */
  gan: Gan;
  /** 日支 */
  zhi: Zhi;
  /** 日干寄宫 */
  jigong: Zhi;
  /** 干上神 */
  ganShang: Zhi;
  /** 支上神 */
  zhiShang: Zhi;
  /**
   * 四课是否不备（去重后不足四课）。
   * 成因：干支同位，或上神重复，使实际只剩三课——别责课的前提之一。
   */
  bubei: boolean;
  /** 去重后的课数 */
  distinct: number;
  /**
   * 去重后的课，取克用这一份（2026-10-29）。上下两神全同的重复课只算一次（书中「四課不全」「三課不備」
   * 的通例；庚子日辰加子二、三课同为辰/子，原书作元首而非涉害）。与第一课同位的课不并，理由见 buildSiKe。
   * 见 CLAUDE.md §0.3 ⑮。
   */
  keEff: Ke[];
  /** 卷十第九十三条一说：与第一课同位的第二、四课也并入第一课（只用于并列，不用于本法取传） */
  keMerged: Ke[];
}

import { ke as wuxingKe } from "./ganzhi.js";

function makeKe(index: 1 | 2 | 3 | 4, shang: Zhi, xia: string, xiaWuxing: Wuxing): Ke {
  const shangWuxing = ZHI_WUXING[shang]!;
  return {
    index, shang, xia, xiaWuxing, shangWuxing,
    shangKeXia: wuxingKe(shangWuxing, xiaWuxing),
    xiaZeiShang: wuxingKe(xiaWuxing, shangWuxing),
    label: `${shang}/${xia}`,
  };
}

/**
 * 起四课。
 * 一课：日干寄宫的上神，下为日干。
 * 二课：一课上神的上神。
 * 三课：日支的上神。
 * 四课：三课上神的上神。
 */
export function buildSiKe(plate: PlatePair, gan: Gan, zhi: Zhi): SiKe {
  const jigong = JIGONG[gan]!;
  const k1Shang = plate.tian[jigong]!;
  const k2Shang = plate.tian[k1Shang]!;
  const k3Shang = plate.tian[zhi]!;
  const k4Shang = plate.tian[k3Shang]!;

  const ke: [Ke, Ke, Ke, Ke] = [
    makeKe(1, k1Shang, gan, GAN_WUXING[gan]!),
    makeKe(2, k2Shang, k1Shang, ZHI_WUXING[k1Shang]!),
    makeKe(3, k3Shang, zhi, ZHI_WUXING[zhi]!),
    makeKe(4, k4Shang, k3Shang, ZHI_WUXING[k3Shang]!),
  ];

  // 四课不备：按「上下两神」的组合去重（第一课以寄宫代干参与比对，
  // 因为重复与否看的是盘上位置，不是五行）。
  const sigs = [`${k1Shang}|${jigong}`, `${k2Shang}|${k1Shang}`, `${k3Shang}|${zhi}`, `${k4Shang}|${k3Shang}`];
  const sig = new Set(sigs);
  // 只并「与第一课以外的课同位」的重复课（上下两神全同，如庚子日辰加子二三课同为辰/子）。
  // 与第一课同位的课不并：第一课下神是日干，与以地支论的课本就不同——
  //   · 第三课：八专日干支同位，卷五「八專日有五除癸丑日俱有克」只有干、支分论才成立；
  //   · 第二、四课：卷十毕法赋第九十三条主张并入第一课、以日干论（「辛酉日干上亥……豈可便以亥加戌為初傳乎」），
  //     但它批评的正是「時師」通行的取法，卷一「六别責法……共九課」的数目也只在不并时成立。
  //     本软件取通行法，第九十三条一说在 sanchuan.ts 并列（altNotes），见 CLAUDE.md §0.3 ⑮。
  const keEff = ke.filter((_, i) => !sigs.some((s, j) => j > 0 && j < i && s === sigs[i]));
  // 第九十三条一说用：与第一课同位的课一并并入第一课
  const keMerged = ke.filter((_, i) => !sigs.some((s, j) => j < i && s === sigs[i] && !(i === 2 && j === 0)));
  return {
    ke, gan, zhi, jigong,
    ganShang: k1Shang, zhiShang: k3Shang,
    bubei: sig.size < 4, distinct: sig.size, keEff, keMerged,
  };
}

/**
 * 昼占 / 夜占。
 * 本软件采**卯至申为昼、酉至寅为夜**。
 * ⚠ 门派分歧：另有一说以实际日出日入为界（随节令与纬度浮动）。
 * 此项只影响天将的贵人起例（昼贵/夜贵），不影响天地盘与三传。
 */
export const ZHOU_YE_RULE = "卯申为昼、酉寅为夜";
export const ZHOU_YE_IS_DISPUTED = true;
export function isZhou(zhanshi: string): boolean {
  const i = zhiIndex(zhanshi);
  return i >= zhiIndex("卯") && i <= zhiIndex("申");
}
