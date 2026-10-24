/**
 * 卦气旺衰（CLAUDE.md §4.4）。移植自 plum/core/wangshuai.py。按占卦节令给体/用强弱加权。
 *
 * 旺（L30/L31）：春→木(震巽)、夏→火(离)、秋→金(乾兑)、冬→水(坎)、辰戌丑未月→土(坤艮)。
 * 衰（L43/L44）：春→土、夏→金、秋→木、冬→火、辰戌丑未月→水（被旺者所克者衰）。
 *
 * 节令判定默认按农历月→月建地支：正月寅…十二月丑（建寅）。
 * 辰戌丑未（农历 3/6/9/12 月）为四季末「土月」，土旺水衰；其余按四时。
 */

/** 农历月 → 季（春夏秋冬 或 土=四季末土月）。 */
const MONTH_SEASON: Readonly<Record<number, string>> = Object.freeze({
  1: "春", 2: "春", 3: "土",
  4: "夏", 5: "夏", 6: "土",
  7: "秋", 8: "秋", 9: "土",
  10: "冬", 11: "冬", 12: "土",
});

/** 季 → [旺五行, 衰五行]。 */
const SEASON_WANG_SHUAI: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  春: ["木", "土"],
  夏: ["火", "金"],
  秋: ["金", "木"],
  冬: ["水", "火"],
  土: ["土", "水"],
});

export function seasonOfLunarMonth(month: number): string {
  const s = MONTH_SEASON[month];
  if (!s) throw new Error(`无此农历月：${month}`);
  return s;
}

/** 五行在某季的卦气：'旺' / '衰' / '平'。 */
export function statusBySeason(wuxing: string, season: string): string {
  const pair = SEASON_WANG_SHUAI[season];
  if (!pair) throw new Error(`无此季：${season}`);
  const [wang, shuai] = pair;
  if (wuxing === wang) return "旺";
  if (wuxing === shuai) return "衰";
  return "平";
}

export function statusByLunarMonth(wuxing: string, month: number): string {
  return statusBySeason(wuxing, seasonOfLunarMonth(month));
}

export interface WangShuai {
  season: string | null;
  tiStatus: string;
  yongStatus: string;
}

/** 给体/用按节令标注卦气强弱。season=null 时返回 '未知'（无节令信息）。 */
export function weigh(tiWx: string, yongWx: string, season: string | null): WangShuai {
  if (season === null) return { season: null, tiStatus: "未知", yongStatus: "未知" };
  return {
    season,
    tiStatus: statusBySeason(tiWx, season),
    yongStatus: statusBySeason(yongWx, season),
  };
}
