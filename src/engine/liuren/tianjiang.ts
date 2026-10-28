/**
 * 大六壬 · 十二天将。
 *
 * 贵人落在天盘某支上，其余十一将依次环布；顺布还是逆布，由贵人所临的**地盘**位决定。
 *
 * ⚠ **本模块含六壬最有名的一处门派分歧**：贵人起例里庚日归哪一组。
 *   一说「甲戊庚牛羊……六辛逢马虎」——庚与甲戊同组，昼贵在丑、夜贵在未；
 *   另一说「甲戊兼牛羊……庚辛逢马虎」——庚与辛同组，昼贵在午、夜贵在寅。
 *   两说在庚日会排出完全不同的天将盘。本软件默认前者，并**把另一说一并呈现**，
 *   不替用户裁决（CLAUDE.md §0 红线 5、§3#6）。
 *   天将只影响断语取象，不影响天地盘、四课、三传。
 */
import { DIZHI, zhiAt, zhiIndex, type Gan, type Zhi } from "./ganzhi.js";
import type { PlatePair } from "./plate.js";

/** 十二天将，自贵人起的固定次序。 */
export const TIANJIANG = [
  "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙",
  "天空", "白虎", "太常", "玄武", "太阴", "天后",
] as const;
export type Tianjiang = (typeof TIANJIANG)[number];

/**
 * 贵人起例有**两条互相独立的分歧轴**，都得并列呈现，不替用户裁决。
 *
 * 轴一·庚日归哪组：
 *   「甲戊庚牛羊……六辛逢马虎」→ 庚与甲戊同组，昼丑夜未（本软件默认）
 *   「甲戊兼牛羊……庚辛逢马虎」→ 庚与辛同组，昼午夜寅
 *
 * 轴二·壬癸的昼夜次第（2026-10-28 对拍发现）：
 *   口诀「壬癸兔蛇藏」只给了兔(卯)、蛇(巳)两支，没说哪个是昼。
 *   一说昼卯夜巳（本软件默认，与口诀字序一致，同丙丁、辛三组的处理）；
 *   一说昼巳夜卯（dcbazi 排盘站即此说，已实测确认）。
 */
export interface GuirenRule {
  /** 庚日：与甲戊同组（丑未），还是与辛同组（午寅） */
  geng: "同甲戊" | "同辛";
  /** 壬癸：昼卯夜巳，还是昼巳夜卯 */
  rengui: "昼卯夜巳" | "昼巳夜卯";
}

export const DEFAULT_GUIREN_RULE: GuirenRule = Object.freeze({
  geng: "同甲戊", rengui: "昼卯夜巳",
});

/** 不随分歧改变的八个天干。[昼贵, 夜贵] */
const GUIREN_FIXED: Readonly<Record<string, [Zhi, Zhi]>> = Object.freeze({
  甲: ["丑", "未"], 戊: ["丑", "未"],
  乙: ["子", "申"], 己: ["子", "申"],
  丙: ["亥", "酉"], 丁: ["亥", "酉"],
  辛: ["午", "寅"],
});

function guirenPair(gan: Gan, rule: GuirenRule): [Zhi, Zhi] {
  if (gan === "庚") return rule.geng === "同甲戊" ? ["丑", "未"] : ["午", "寅"];
  if (gan === "壬" || gan === "癸") {
    return rule.rengui === "昼卯夜巳" ? ["卯", "巳"] : ["巳", "卯"];
  }
  return GUIREN_FIXED[gan]!;
}

/** 本盘是否踩中某条分歧轴（只有踩中了才需要并列提示）。 */
export function guirenDisputedFor(gan: Gan): "庚" | "壬癸" | null {
  if (gan === "庚") return "庚";
  if (gan === "壬" || gan === "癸") return "壬癸";
  return null;
}

/** 另一说：把本盘踩中的那条轴翻过来。 */
function flipRule(gan: Gan, rule: GuirenRule): GuirenRule {
  if (gan === "庚") return { ...rule, geng: rule.geng === "同甲戊" ? "同辛" : "同甲戊" };
  if (gan === "壬" || gan === "癸") {
    return { ...rule, rengui: rule.rengui === "昼卯夜巳" ? "昼巳夜卯" : "昼卯夜巳" };
  }
  return rule;
}

const ruleLabel = (gan: Gan, r: GuirenRule) =>
  gan === "庚" ? `庚${r.geng}` : (gan === "壬" || gan === "癸") ? `壬癸${r.rengui}` : "通说";

/** 贵人顺行的地盘六位：亥子丑寅卯辰。其余六位逆行。 */
const SHUN_SEATS: readonly string[] = Object.freeze(["亥", "子", "丑", "寅", "卯", "辰"]);

export interface TianjiangResult {
  /** 天盘支 → 所乘天将 */
  byTian: Readonly<Record<string, Tianjiang>>;
  /** 贵人所乘的天盘支 */
  guirenZhi: Zhi;
  /** 贵人所临的地盘位 */
  guirenSeat: Zhi;
  /** 顺布 / 逆布 */
  direction: "顺" | "逆";
  /** 昼占 / 夜占 */
  zhouye: "昼" | "夜";
  rule: GuirenRule;
  derivation: string[];
  /** 另一说是否会排出不同的盘；是则给出并列说明 */
  disputeNote: string | null;
}

function layout(plate: PlatePair, guirenZhi: Zhi): {
  byTian: Record<string, Tianjiang>; seat: Zhi; direction: "顺" | "逆";
} {
  const seat = plate.diOf[guirenZhi]!;
  const direction: "顺" | "逆" = SHUN_SEATS.includes(seat) ? "顺" : "逆";
  const step = direction === "顺" ? 1 : -1;
  const byTian: Record<string, Tianjiang> = {};
  const base = zhiIndex(guirenZhi);
  TIANJIANG.forEach((jiang, i) => {
    byTian[zhiAt(base + step * i)] = jiang;
  });
  return { byTian, seat, direction };
}

/**
 * 排十二天将。
 * @param gan   日干
 * @param zhou  是否昼占
 * @param plate 天地盘
 * @param rule  贵人起例，默认「甲戊庚牛羊」
 */
export function buildTianjiang(
  gan: Gan, zhou: boolean, plate: PlatePair, rule: GuirenRule = DEFAULT_GUIREN_RULE,
): TianjiangResult {
  const guirenZhi = guirenPair(gan, rule)[zhou ? 0 : 1];
  const { byTian, seat, direction } = layout(plate, guirenZhi);

  const derivation = [
    `${zhou ? "昼" : "夜"}占，${gan} 日${zhou ? "昼" : "夜"}贵人在 ${guirenZhi}`,
    `贵人临地盘 ${seat}，${SHUN_SEATS.includes(seat) ? "居亥至辰，顺布" : "居巳至戌，逆布"}十二将`,
  ];

  // 只有本盘确实踩中分歧轴时才并列——没踩中就不要拿分歧去烦问卦人
  let disputeNote: string | null = null;
  const axis = guirenDisputedFor(gan);
  if (axis) {
    const other = flipRule(gan, rule);
    const otherZhi = guirenPair(gan, other)[zhou ? 0 : 1];
    if (otherZhi !== guirenZhi) {
      const alt = layout(plate, otherZhi);
      disputeNote =
        `贵人起例在${axis}日有两说，本盘正好踩中：一说「${ruleLabel(gan, rule)}」，` +
        `${zhou ? "昼" : "夜"}贵在 ${guirenZhi}，临地盘 ${seat}、${direction}布（本盘采此说）；` +
        `另一说「${ruleLabel(gan, other)}」，${zhou ? "昼" : "夜"}贵在 ${otherZhi}，` +
        `临地盘 ${alt.seat}、${alt.direction}布，整盘天将随之不同。` +
        `天将只关取象——天地盘、四课、三传两说完全一致。`;
    }
  }

  return {
    byTian, guirenZhi, guirenSeat: seat, direction,
    zhouye: zhou ? "昼" : "夜", rule, derivation, disputeNote,
  };
}

/** 便于界面按地盘顺序列出：地盘支 → {天盘支, 天将}。 */
export function byDiPlate(
  plate: PlatePair, tj: TianjiangResult,
): Array<{ di: Zhi; tian: Zhi; jiang: Tianjiang }> {
  return DIZHI.map((di) => ({ di, tian: plate.tian[di]!, jiang: tj.byTian[plate.tian[di]!]! }));
}
