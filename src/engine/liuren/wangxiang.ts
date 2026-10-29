/**
 * 大六壬 · 旺相休囚死（按月建定季）。
 *
 * 表直接从《六壬大全》卷五的五句原文解析出来（见 daquan.ts），不另手抄一份：
 *   「春木旺夏火旺秋金旺冬水旺四季土旺」「春火相夏土相秋水相冬木相季月金相」
 *   「春土死夏金死秋木死冬火死」「春金囚夏水囚秋火囚冬土囚季木囚」「春水休夏木休秋土休冬金休季火休」
 * 季月的「死」卷五没写，按卷七总则「我克者為死」补：季月土旺，土克水，水死。
 * 同一条总则也用来反核春夏秋冬四季的明文（「克我者為囚」同理），不一致即抛错。
 *
 * 月建按节令交接时刻（立春起寅月……），取 lunar-javascript 的 getMonthZhiExact。
 * 季月（辰未戌丑）整月算土旺，依卷五「四季土旺」「季月金相」；卷八另云「土守中宫分旺四季
 * 毎季前各旺十八日」，即只在立春、立夏、立秋、立冬前十八日土旺——本盘落在季月前段时并列此说。
 */
import { Solar } from "lunar-javascript";
import { ZHI_WUXING, type Wuxing, type Zhi } from "./ganzhi.js";
import { DAQUAN_QUOTES as Q } from "./daquan.js";

export type QiState = "旺" | "相" | "休" | "囚" | "死";
export type Season = "春" | "夏" | "秋" | "冬" | "季";

const WUXING: readonly Wuxing[] = ["木", "火", "土", "金", "水"];
const KE: Readonly<Record<Wuxing, Wuxing>> = { 金: "木", 木: "土", 土: "水", 水: "火", 火: "金" };

export const SEASON_OF_YUEJIAN: Readonly<Record<Zhi, Season>> = Object.freeze({
  寅: "春", 卯: "春", 巳: "夏", 午: "夏", 申: "秋", 酉: "秋", 亥: "冬", 子: "冬",
  辰: "季", 未: "季", 戌: "季", 丑: "季",
});

/** 季月前段若按「四立前十八日」一说，仍属上一季。 */
const PREV_SEASON: Readonly<Record<string, Season>> = { 辰: "春", 未: "夏", 戌: "秋", 丑: "冬" };

/** 从卷五五句原文解析出 季 × 五行 → 旺相休囚死。 */
function parseTable(): Record<Season, Record<Wuxing, QiState>> {
  const t = { 春: {}, 夏: {}, 秋: {}, 冬: {}, 季: {} } as Record<Season, Partial<Record<Wuxing, QiState>>>;
  for (const x of [Q.wang, Q.xiang, Q.si, Q.qiu, Q.xiu]) {
    for (const m of x.text.matchAll(/(四季|季月|季|春|夏|秋|冬)(木|火|土|金|水)(旺|相|死|囚|休)/g)) {
      const s = (m[1]!.startsWith("季") || m[1] === "四季" ? "季" : m[1]) as Season;
      const w = m[2] as Wuxing;
      if (t[s][w]) throw new Error(`旺相休囚表冲突：${s}${w}`);
      t[s][w] = m[3] as QiState;
    }
  }
  // 卷七总则：时令（当旺之行）所克者为死，克时令者为囚
  for (const s of Object.keys(t) as Season[]) {
    const ling = WUXING.find((w) => t[s][w] === "旺");
    if (!ling) throw new Error(`旺相休囚表缺旺：${s}`);
    const dead = KE[ling];
    if (!t[s][dead]) t[s][dead] = "死";
    else if (t[s][dead] !== "死") throw new Error(`卷五明文与卷七「我克者為死」不合：${s}${dead}`);
    const jailer = WUXING.find((w) => KE[w] === ling)!;
    if (t[s][jailer] !== "囚") throw new Error(`卷五明文与卷七「克我者為囚」不合：${s}${jailer}`);
    for (const w of WUXING) if (!t[s][w]) throw new Error(`旺相休囚表缺项：${s}${w}`);
  }
  return t as Record<Season, Record<Wuxing, QiState>>;
}

export const WANGXIANG: Readonly<Record<Season, Readonly<Record<Wuxing, QiState>>>> = Object.freeze(parseTable());

export interface WangxiangInfo {
  /** 月建（按节） */
  yuejian: Zhi;
  season: Season;
  states: Readonly<Record<Wuxing, QiState>>;
  /** 季月前段：按「四立前十八日土旺」一说，季节与五行状态另有一套 */
  alt: null | {
    season: Season;
    states: Readonly<Record<Wuxing, QiState>>;
    /** 下一个四立的名字与距今天数 */
    li: string;
    days: number;
  };
}

export function wangxiangAt(at: Date): WangxiangInfo {
  const lunar = Solar.fromYmdHms(
    at.getFullYear(), at.getMonth() + 1, at.getDate(), at.getHours(), at.getMinutes(), at.getSeconds(),
  ).getLunar();
  const yuejian = lunar.getMonthZhiExact() as Zhi;
  const season = SEASON_OF_YUEJIAN[yuejian];
  let alt: WangxiangInfo["alt"] = null;
  if (season === "季") {
    // 季月由清明、小暑、寒露、小寒起，下一个「节」就是四立
    const jie = lunar.getNextJie();
    const s = jie.getSolar();
    const t = new Date(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond());
    const days = (t.getTime() - at.getTime()) / 86_400_000;
    if (days > 18) {
      const ps = PREV_SEASON[yuejian]!;
      alt = { season: ps, states: WANGXIANG[ps], li: jie.getName(), days: Math.floor(days) };
    }
  }
  return { yuejian, season, states: WANGXIANG[season], alt };
}

/** 某支在本季的状态（以其五行论）。 */
export function qiOfZhi(info: WangxiangInfo, z: Zhi): QiState {
  return info.states[ZHI_WUXING[z]!]!;
}

/** 「木旺 火相 …」按旺相休囚死排好的人读串。 */
export function statesLine(states: Readonly<Record<Wuxing, QiState>>): string {
  const ORDER: QiState[] = ["旺", "相", "休", "囚", "死"];
  return [...WUXING].sort((a, b) => ORDER.indexOf(states[a]) - ORDER.indexOf(states[b]))
    .map((w) => `${w}${states[w]}`).join(" ");
}

export const SEASON_NAME: Readonly<Record<Season, string>> = { 春: "春", 夏: "夏", 秋: "秋", 冬: "冬", 季: "季月（土旺）" };
