/**
 * 六十四卦名表（CLAUDE.md §4.2）。移植自 plum/core/gua64.py。
 *
 * (上卦, 下卦) → 卦名。卦象 bits 由上下卦程序生成、不手录（见 linesOf / fromLines）。
 * 卦名为通行定名（标准 8×8 重卦表）。
 */
import { BAGUA, byLines, type Bit } from "./bagua.js";

export const TRIGRAM_ORDER = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"] as const;

// 行 = 上卦(外)，列 = 下卦(内)，按 TRIGRAM_ORDER 排列。值 = [全名, 单名]。
const GRID: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = Object.freeze({
  乾: [["乾为天", "乾"], ["天泽履", "履"], ["天火同人", "同人"], ["天雷无妄", "无妄"],
       ["天风姤", "姤"], ["天水讼", "讼"], ["天山遁", "遁"], ["天地否", "否"]],
  兑: [["泽天夬", "夬"], ["兑为泽", "兑"], ["泽火革", "革"], ["泽雷随", "随"],
       ["泽风大过", "大过"], ["泽水困", "困"], ["泽山咸", "咸"], ["泽地萃", "萃"]],
  离: [["火天大有", "大有"], ["火泽睽", "睽"], ["离为火", "离"], ["火雷噬嗑", "噬嗑"],
       ["火风鼎", "鼎"], ["火水未济", "未济"], ["火山旅", "旅"], ["火地晋", "晋"]],
  震: [["雷天大壮", "大壮"], ["雷泽归妹", "归妹"], ["雷火丰", "丰"], ["震为雷", "震"],
       ["雷风恒", "恒"], ["雷水解", "解"], ["雷山小过", "小过"], ["雷地豫", "豫"]],
  巽: [["风天小畜", "小畜"], ["风泽中孚", "中孚"], ["风火家人", "家人"], ["风雷益", "益"],
       ["巽为风", "巽"], ["风水涣", "涣"], ["风山渐", "渐"], ["风地观", "观"]],
  坎: [["水天需", "需"], ["水泽节", "节"], ["水火既济", "既济"], ["水雷屯", "屯"],
       ["水风井", "井"], ["坎为水", "坎"], ["水山蹇", "蹇"], ["水地比", "比"]],
  艮: [["山天大畜", "大畜"], ["山泽损", "损"], ["山火贲", "贲"], ["山雷颐", "颐"],
       ["山风蛊", "蛊"], ["山水蒙", "蒙"], ["艮为山", "艮"], ["山地剥", "剥"]],
  坤: [["地天泰", "泰"], ["地泽临", "临"], ["地火明夷", "明夷"], ["地雷复", "复"],
       ["地风升", "升"], ["地水师", "师"], ["地山谦", "谦"], ["坤为地", "坤"]],
});

function cell(upper: string, lower: string): readonly [string, string] {
  const row = GRID[upper];
  if (!row) throw new Error(`无此上卦：${upper}`);
  const j = TRIGRAM_ORDER.indexOf(lower as (typeof TRIGRAM_ORDER)[number]);
  if (j < 0) throw new Error(`无此下卦：${lower}`);
  const c = row[j];
  if (!c) throw new Error(`无此重卦：${upper}/${lower}`);
  return c;
}

/** (上卦名, 下卦名) → 六十四卦全名，如 ('兑','离') → '泽火革'。 */
export function nameOf(upper: string, lower: string): string {
  return cell(upper, lower)[0];
}

export function shortNameOf(upper: string, lower: string): string {
  return cell(upper, lower)[1];
}

/** (上卦名, 下卦名) → 六爻 bits，bottom→top（爻1..6）。下卦占爻1-3，上卦占爻4-6。 */
export function linesOf(upper: string, lower: string): Bit[] {
  const lo = BAGUA[lower];
  const up = BAGUA[upper];
  if (!lo || !up) throw new Error(`无此卦名：${upper}/${lower}`);
  return [...lo.lines, ...up.lines];
}

/** 六爻 bits（bottom→top）→ [全名, 上卦名, 下卦名]。 */
export function fromLines(bits: readonly Bit[]): [string, string, string] {
  const lower = byLines(bits.slice(0, 3)).name;
  const upper = byLines(bits.slice(3, 6)).name;
  return [nameOf(upper, lower), upper, lower];
}

/** 全部 64 卦 (上, 下) → [全名, 单名]，供对账与检索。 */
export const GUA64: ReadonlyArray<{ upper: string; lower: string; name: string; short: string }> =
  Object.freeze(
    TRIGRAM_ORDER.flatMap((upper) =>
      TRIGRAM_ORDER.map((lower) => {
        const [name, short] = cell(upper, lower);
        return { upper, lower, name, short };
      }),
    ),
  );
