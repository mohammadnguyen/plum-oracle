/**
 * 应期算法（三法，纯函数，零 LLM）。移植自 plum/rules/yingqi.py。
 * 输出均含 {method, value, derivation_chain, source_level}。
 *
 * 原文锚（《梅花易数》TXT，LF 行号）：
 *   · 动静调整 L382：「行则应速…可中分而取其半也。坐则事应于迟，当倍其成卦之数…立则半迟半速，
 *     止以成卦之数定之可也。」
 *   · 先天卦气 L712：「如乾兑属金，克应的日期就定在庚日辛日…或定在戌亥日属乾的位置」
 *   · 干支五行 L69-71：甲乙→木；丙丁→火；戊己→土；庚辛→金；壬癸→水。
 *   · 案例直证 L1330：老人/少年/鸡牛按日计；老人案 L381 途行取半=5日。
 */
import type { CastResult } from "../result.js";

export const TABLE_STATUS = "candidate_pending_human_signoff";
export const DEFAULT_METHOD = "route_by_cast_method";   // PM 签收 2026-06-28（决策①）

export const RESOLVED = [
  { item: "三法何者为默认", decision: "起卦法路由:sound/object_direction/color→houtian_guashu+dongjing;time→xiantian_guaqi", basis: "后天分支【案例直证·L1330 老人/少年/鸡牛按日计】;先天分支【原文直证·L712】+如实注:TXT 内无先天净应期案例", signoff: "PM 2026-06-28" },
  { item: "吉凶是否分取生体/克体卦气", decision: "采纳:final_verdict 吉/大吉→生体卦气;凶/大凶/凶中有救→克体卦气", basis: "求财占「得财之日=生体卦气；破财之日=克体卦气」+疾病占「若详危厄之期，克体之卦定之」", signoff: "PM 2026-06-28" },
  { item: "姿态缺省降级", decision: "如数计,推导链注明【文义外推】", basis: "L382 立则如数为最近中性档", signoff: "PM 2026-06-28" },
] as const;

/** 五行→天干日（L69-71 原文直证）/ 地支日（通例，文义外推；乾→戌亥 L712 有直证）。 */
export const WUXING_TIANGAN: Readonly<Record<string, string>> = Object.freeze({
  木: "甲乙", 火: "丙丁", 土: "戊己", 金: "庚辛", 水: "壬癸",
});
export const WUXING_DIZHI: Readonly<Record<string, string>> = Object.freeze({
  木: "寅卯", 火: "巳午", 土: "辰戌丑未", 金: "申酉", 水: "亥子",
});

export interface YingqiResult {
  method: string;
  value: number | GuaqiDay[] | null;
  unit?: string;
  posture?: string | null;
  target?: string;
  derivation_chain: string;
  source_level: string;
  table_status: string;
  label?: string;
  route?: string;
  route_basis?: string;
  target_basis?: string;
  applicable?: boolean;
  note?: string;
}

export interface GuaqiDay {
  gua: string;
  wuxing: string;
  tiangan_ri: string;
  dizhi_ri: string;
}

/** 成卦数（按起卦法自 trace 机械取）。trace 缺（字占 Phase2 手装等）→ [null, 说明]。 */
function traceTotal(d: CastResult): [number | null, string] {
  const t = (d.trace ?? {}) as Record<string, number | undefined>;
  if (d.method === "time" && t.lower_total !== undefined) {
    return [t.lower_total, `年月日时总数(lower_total)=${t.lower_total}`];
  }
  if (t.shang_num !== undefined && t.xia_num !== undefined && t.hour_num !== undefined) {
    const total = t.shang_num + t.xia_num + t.hour_num;
    return [total, `上卦${t.shang_num}+下卦${t.xia_num}+时${t.hour_num}=${total}`];
  }
  return [null, "成卦数不可得(trace 缺——字占 Phase2 手装盘等)"];
}

/** 先天卦气法。target ∈ {'sheng_ti','ke_ti'}——吉凶分取须显式指定，不设默认。 */
export function xiantianGuaqi(d: CastResult, target: "sheng_ti" | "ke_ti"): YingqiResult {
  if (target !== "sheng_ti" && target !== "ke_ti") {
    throw new Error("吉凶分取为教义决策,须显式指定 target");
  }
  const want = target === "sheng_ti" ? "生体" : "克体";
  const guas = d.shengke.relations.filter((r) => r.rel === want).map((r) => [r.from, r.wuxing] as const);
  const days: GuaqiDay[] = guas.map(([g, w]) => ({
    gua: g, wuxing: w,
    tiangan_ri: WUXING_TIANGAN[w] as string,
    dizhi_ri: WUXING_DIZHI[w] as string,
  }));
  return {
    method: "xiantian_guaqi", target, value: days,
    derivation_chain: `${want}之卦[${guas.map(([g]) => `'${g}'`).join(", ")}]→五行→天干/地支日`,
    source_level: "原文直证(天干日,L69-71+L712)+文义外推(地支日通例,乾戌亥 L712 有直证)",
    table_status: TABLE_STATUS,
  };
}

/** 后天卦数法：应期=成卦数（按日计——案例直证 L1330）。 */
export function houtianGuashu(d: CastResult): YingqiResult {
  const [total, chain] = traceTotal(d);
  if (total === null) {
    return { method: "houtian_guashu", value: null, derivation_chain: chain, source_level: "n/a(成卦数不可得)", table_status: TABLE_STATUS };
  }
  return {
    method: "houtian_guashu", value: total, unit: "日",
    derivation_chain: `${chain} → 应期 ${total} 日`,
    source_level: "原文直证(L382「止以成卦之数定之」)+案例直证(L1330 老人/少年/鸡牛按日计;少年17日/牛鸣21日书验)",
    table_status: TABLE_STATUS,
  };
}

/** 动静调整：行→取半、坐→倍之、立→如数。posture=null→缺省如数（PM 决策③，注明文义外推）。 */
export function dongjingTiaozheng(d: CastResult, posture: string | null): YingqiResult {
  const [total, chain] = traceTotal(d);
  if (total === null) {
    return { method: "dongjing_tiaozheng", value: null, posture, derivation_chain: chain, source_level: "n/a(成卦数不可得)", table_status: TABLE_STATUS };
  }
  if (posture === null || posture === undefined) {
    return {
      method: "dongjing_tiaozheng", value: total, unit: "日", posture: null,
      derivation_chain: `${chain} → 未提供动静,按如数计 ${total} 日【文义外推·PM决策③】`,
      source_level: "原文直证(L382 立则如数)+文义外推(缺省档·PM签收)",
      table_status: TABLE_STATUS,
    };
  }
  const table: Record<string, readonly [string, number]> = {
    行: ["取半", total % 2 === 0 ? total / 2 : total / 2],
    坐: ["倍之", total * 2],
    立: ["如数", total],
  };
  const f = table[posture];
  if (!f) throw new Error(`未知姿态: ${posture}`);
  return {
    method: "dongjing_tiaozheng", value: f[1], unit: "日", posture,
    derivation_chain: `${chain} → ${posture}则${f[0]} → ${f[1]} 日`,
    source_level: "原文直证(L382「行则应速…取半;坐则倍之;立则如数」)+案例直证(老人途行 10→5 日,L381 书验5日)",
    table_status: TABLE_STATUS,
  };
}

/** 三法各算一份（推演链数据结构，构成自文档化 label）。 */
export function yingqiCandidates(d: CastResult, posture: string | null = null): YingqiResult[] {
  const a = xiantianGuaqi(d, "sheng_ti"); a.label = "先天卦气·取生体卦(吉事)";
  const b = xiantianGuaqi(d, "ke_ti"); b.label = "先天卦气·取克体卦(凶事)";
  const c = houtianGuashu(d); c.label = "后天卦数·成卦数按日";
  const e = dongjingTiaozheng(d, posture); e.label = `动静调整·姿态=${posture || "缺省如数"}`;
  return [a, b, c, e];
}

const JI_SET = ["吉", "大吉"];
const XIONG_SET = ["凶", "大凶", "凶中有救"];

/**
 * PM 决策①②③路由后的**单一应期**（喂解读用）。
 * 路由①：sound/object_direction/color→后天卦数+动静；time→先天卦气。
 * 分取②：final_verdict 吉/大吉→生体卦气；凶/大凶/凶中有救→克体卦气。
 * 缺省③：姿态 null→如数+【文义外推】注明。
 */
export function yingqiRouted(
  d: CastResult,
  finalVerdict: string | null,
  posture: string | null = null,
): YingqiResult {
  if (d.method === "time") {
    let target: "sheng_ti" | "ke_ti";
    if (finalVerdict && JI_SET.includes(finalVerdict)) target = "sheng_ti";
    else if (finalVerdict && XIONG_SET.includes(finalVerdict)) target = "ke_ti";
    else {
      return {
        method: "xiantian_guaqi", value: null, route: "xiantian_guaqi", applicable: false,
        note: `final_verdict=${JSON.stringify(finalVerdict)} 不在吉凶分取集(分论/归期/象法等),应期不路由`,
        derivation_chain: "", source_level: "", table_status: TABLE_STATUS,
      };
    }
    const y = xiantianGuaqi(d, target);
    y.route = "xiantian_guaqi";
    y.route_basis = "PM决策①:time→先天卦气【原文直证·L712】(TXT 内无先天净应期案例,如实注)";
    y.target_basis = target === "sheng_ti"
      ? "PM决策②:吉→生体卦气(求财占「得财之日=生体卦气」)"
      : "PM决策②:凶→克体卦气(疾病占「若详危厄之期，克体之卦定之」)";
    return y;
  }
  const y = dongjingTiaozheng(d, posture);
  y.route = "houtian_guashu+dongjing";
  y.route_basis = "PM决策①:非time法→后天卦数+动静【案例直证·L1330 老人/少年/鸡牛按日计】";
  return y;
}
