/**
 * 大六壬 · 干支基础层。
 *
 * 本文件只放**各家一致、无争议**的基础数据与算法：天干地支、五行、阴阳、
 * 日干寄宫、旬空、三合六合冲、孟仲季。凡有门派分歧者一律不放在这里，
 * 放到各自模块并显式标注（见 `sanchuan.ts`、`tianjiang.ts`）。
 *
 * 与梅花引擎同一条纪律：**纯函数、确定性、零 LLM、零网络。**
 * 排错了就是 bug，不是风格问题——用户的 AI 拿到错盘只会把错盘解得头头是道。
 */

export const TIANGAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const DIZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export type Gan = (typeof TIANGAN)[number];
export type Zhi = (typeof DIZHI)[number];
export type Wuxing = "木" | "火" | "土" | "金" | "水";

export const ganIndex = (g: string): number => {
  const i = (TIANGAN as readonly string[]).indexOf(g);
  if (i < 0) throw new Error(`未知天干: ${JSON.stringify(g)}`);
  return i;
};
export const zhiIndex = (z: string): number => {
  const i = (DIZHI as readonly string[]).indexOf(z);
  if (i < 0) throw new Error(`未知地支: ${JSON.stringify(z)}`);
  return i;
};
/** 地支加减，自动归入 0–11。 */
export const zhiAt = (i: number): Zhi => DIZHI[((i % 12) + 12) % 12]!;

// ── 五行 ────────────────────────────────────────────────────────────────
export const GAN_WUXING: Readonly<Record<string, Wuxing>> = Object.freeze({
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
});

export const ZHI_WUXING: Readonly<Record<string, Wuxing>> = Object.freeze({
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
});

/** a 生 SHENG[a]（与梅花引擎同表，口径一致）。 */
export const SHENG: Readonly<Record<Wuxing, Wuxing>> = Object.freeze({
  金: "水", 水: "木", 木: "火", 火: "土", 土: "金",
});
/** a 克 KE[a] */
export const KE: Readonly<Record<Wuxing, Wuxing>> = Object.freeze({
  金: "木", 木: "土", 土: "水", 水: "火", 火: "金",
});

export const sheng = (a: Wuxing, b: Wuxing): boolean => SHENG[a] === b;
export const ke = (a: Wuxing, b: Wuxing): boolean => KE[a] === b;

/** 地支 a 是否克地支 b。 */
export const zhiKe = (a: string, b: string): boolean => ke(ZHI_WUXING[a]!, ZHI_WUXING[b]!);
/** 地支 a 是否生地支 b。 */
export const zhiSheng = (a: string, b: string): boolean => sheng(ZHI_WUXING[a]!, ZHI_WUXING[b]!);

// ── 阴阳 ────────────────────────────────────────────────────────────────
/** 天干阴阳：甲丙戊庚壬为阳，乙丁己辛癸为阴（序数偶为阳）。 */
export const ganYang = (g: string): boolean => ganIndex(g) % 2 === 0;
/** 地支阴阳：子寅辰午申戌为阳，丑卯巳未酉亥为阴。 */
export const zhiYang = (z: string): boolean => zhiIndex(z) % 2 === 0;

// ── 日干寄宫 ────────────────────────────────────────────────────────────
/**
 * 日干寄宫：甲寄寅、乙寄辰、丙戊寄巳、丁己寄未、庚寄申、辛寄戌、壬寄亥、癸寄丑。
 * 四课的第一课就从这里起——寄错则全盘皆错。各家一致，无分歧。
 */
export const JIGONG: Readonly<Record<string, Zhi>> = Object.freeze({
  甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳",
  己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑",
});

// ── 孟仲季 ──────────────────────────────────────────────────────────────
/** 四孟（生地）：寅申巳亥。 */
export const SI_MENG: readonly Zhi[] = Object.freeze(["寅", "申", "巳", "亥"] as Zhi[]);
/** 四仲（旺地）：子午卯酉。 */
export const SI_ZHONG: readonly Zhi[] = Object.freeze(["子", "午", "卯", "酉"] as Zhi[]);
/** 四季（墓地）：辰戌丑未。 */
export const SI_JI: readonly Zhi[] = Object.freeze(["辰", "戌", "丑", "未"] as Zhi[]);

export type MengZhongJi = "孟" | "仲" | "季";
export function mengZhongJi(z: string): MengZhongJi {
  if ((SI_MENG as readonly string[]).includes(z)) return "孟";
  if ((SI_ZHONG as readonly string[]).includes(z)) return "仲";
  return "季";
}

// ── 冲合 ────────────────────────────────────────────────────────────────
/** 六冲：相隔六位。 */
export const chong = (z: string): Zhi => zhiAt(zhiIndex(z) + 6);
/** 六合：子丑、寅亥、卯戌、辰酉、巳申、午未。 */
export const liuhe = (z: string): Zhi => zhiAt(1 - zhiIndex(z));
/** 三合局的另两支（如 申 → 子、辰）。 */
export function sanhe(z: string): [Zhi, Zhi] {
  const i = zhiIndex(z);
  return [zhiAt(i + 4), zhiAt(i + 8)];
}

// ── 六十甲子与旬空 ──────────────────────────────────────────────────────
/** 六十甲子，index 0 = 甲子。 */
export const JIAZI: readonly string[] = Object.freeze(
  Array.from({ length: 60 }, (_, i) => TIANGAN[i % 10]! + DIZHI[i % 12]!),
);

export function jiaziIndex(gz: string): number {
  const i = JIAZI.indexOf(gz);
  if (i < 0) throw new Error(`未知干支: ${JSON.stringify(gz)}`);
  return i;
}

export interface XunInfo {
  /** 旬首干支，如「甲戌」 */
  xunshou: string;
  /** 旬空（空亡）二支 */
  kongwang: [Zhi, Zhi];
}

/**
 * 旬空（空亡）。
 * 一旬十日配十二支，余下两支即空。甲子旬空戌亥、甲戌旬空申酉，依此类推。
 */
export function xunKong(dayGanZhi: string): XunInfo {
  const g = ganIndex(dayGanZhi[0]!);
  const z = zhiIndex(dayGanZhi.slice(1));
  const shouZhi = ((z - g) % 12 + 12) % 12;   // 本旬第一日（甲某）的地支
  return {
    xunshou: "甲" + zhiAt(shouZhi),
    kongwang: [zhiAt(shouZhi - 2), zhiAt(shouZhi - 1)],
  };
}

/**
 * 遁干：本旬内某地支所配的天干；该支若逢旬空则无干可遁，返回 null。
 * 用于三传旁注（如「寅上遁得丙」）。
 */
export function dunGan(dayGanZhi: string, z: string): Gan | null {
  const { xunshou } = xunKong(dayGanZhi);
  const shouZhi = zhiIndex(xunshou.slice(1));
  const step = ((zhiIndex(z) - shouZhi) % 12 + 12) % 12;
  if (step > 9) return null;                  // 超出本旬十日 = 空亡
  return TIANGAN[step]!;
}
