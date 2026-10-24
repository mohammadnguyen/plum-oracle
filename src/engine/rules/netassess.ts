/**
 * 净评修正层（候选公式 A 默认）。移植自 plum/rules/netassess.py。
 * 规则表 = data/net_assessment.json；考据锚 = sources/netassess_kaoju_report.md。
 *
 * d = 生体数 − 克体数（计数：用/互上/互下/变 4 格；体不计；泄/体克/比和不入计数）。
 * 案例直证（卦断遗论）：互变俱生，愈见其吉矣。虽用不生体不吉，不为其害也。——净评优先于门表单关系。
 * 叠加顺序：门表给领域语义+基础极性；净评 d 定最终方向与程度；冲突以 d 为准。
 */
import netRules from "../../data/net_assessment.json";
import leixiangTable from "../../data/wanwu_leixiang.json";
import mapTable from "../../data/men_leixiang_map.json";
import conflictTable from "../../data/text_conflict_table.json";
import type { CastResult } from "../result.js";
import { lookup, relationFromEngine, type DoorLookup } from "./duanshiLookup.js";
import { yingqiRouted, yingqiCandidates, type YingqiResult } from "./yingqi.js";
import { huajieSelect, type HuajieResult, type BalanceRequired } from "./huajieSelect.js";
import { getGuaciInfo, isPending, type GuaciInfo } from "../corpus/guayaoci.js";
import { weigh, seasonOfLunarMonth } from "../wangshuai.js";

export const RULE_ANCHOR = "sources/netassess_kaoju_report.md";

const NET_META: any = (netRules as any).meta;
export const TABLE_STATUS: string = NET_META.status;
export const ADVANCED_TOGGLE = NET_META.candidate_C_advanced_toggle; // "not_implemented"

export function loadNetRules(): any {
  return NET_META;
}

export interface CountDetail {
  role: string;
  gua: string;
  wuxing: string;
  rel: string;
  count: number;
}

/** 逐格计数明细（供推导链与人工核对）。 */
export function countDetail(d: CastResult): CountDetail[] {
  return d.shengke.relations.map((r) => ({
    role: r.role,
    gua: r.from,
    wuxing: r.wuxing,
    rel: r.rel,
    // 比和 / 体克 / 体生(泄) 不入计数
    count: r.rel === "生体" ? 1 : r.rel === "克体" ? -1 : 0,
  }));
}

function bandMeta(band: string): any {
  for (const b of NET_META.bands as any[]) {
    if (String(b.band).startsWith(band) || String(b.band).includes(band)) return b;
  }
  return {};
}

export interface NetAssess {
  d: number;
  sheng_ti: number;
  ke_ti: number;
  band: string;
  all_bihe: boolean;
  detail: CountDetail[];
  source_level?: string;
  source_quote?: string;
  formula: string;
  advanced_toggle: unknown;
  table_status: string;
  rule_anchor: string;
}

/** CastResult → 净评档（候选A）。纯函数。候选C（旺衰/泄气）未实现——advanced_toggle 占位。 */
export function assess(r: CastResult): NetAssess {
  const net = r.shengke.net;
  const sheng = net.shengTiCount;
  const ke = net.keTiCount;
  const d = sheng - ke;
  const allBihe = r.shengke.relations.every((x) => x.rel === "比和");

  let band: string;
  if (d >= 2) band = "大吉";
  else if (d === 1) band = "吉";
  else if (d === -1) band = "凶";
  else if (d <= -2) band = "大凶";
  else if (sheng >= 1 && ke >= 1) band = "凶中有救";
  else if (allBihe) band = "全比和";
  // d=0 且 生0克0 且非全比和 —— 净评无生克信号，以门表为准（用户裁决 2026-07-23，文义外推）
  else band = "无净评信号";

  const bm = bandMeta(band !== "全比和" ? band : "维持门表");
  return {
    d,
    sheng_ti: sheng,
    ke_ti: ke,
    band,
    all_bihe: allBihe,
    detail: countDetail(r),
    source_level: bm.source_level,
    source_quote: bm.source_quote,
    formula: "A",
    advanced_toggle: ADVANCED_TOGGLE,
    table_status: TABLE_STATUS,
    rule_anchor: RULE_ANCHOR,
  };
}

/** 门表 + 净评 → 最终断事 domain。冲突以净评为准（案例直证·少年）。 */
export function combine(
  doorLookup: DoorLookup,
  net: NetAssess,
  questionPolar = true,
): Record<string, any> {
  const dom: Record<string, any> = { ...doorLookup };
  const ptype = dom.polarity_type;
  dom.net = net;
  dom.base_polarity = dom.verdict;
  dom.combine_rule = "净评优先(卦断遗论案例直证)；规则锚 " + RULE_ANCHOR;

  if (ptype === "no_tiyong") {
    dom.net_applicable = false;
    dom.note = (dom.note || "") + "；天时不分体用,净评极性修正不适用(原文明文)";
    return dom;
  }
  if (ptype === "return_semantics") {
    dom.net_applicable = false; // 归期 verdict 不改
    const hint = net.d > 0 ? "归速" : net.d < 0 ? "归迟/不归" : null;
    dom.net_return_hint = { d: net.d, hint, source_level: "文义外推" };
    return dom;
  }
  if (ptype === "xiangfa_only") {
    if (!questionPolar) {
      dom.net_applicable = false;
      dom.note = (dom.note || "") + "；非吉凶之问(借斧型),净评弃权";
      return dom;
    }
    dom.net_applicable = true;
    dom.verdict = net.band;
    dom.verdict_from = "netassess(物占无门表极性,净评为主要参考)";
    return dom;
  }

  // five_relations
  dom.net_applicable = true;
  dom.door_verdict = dom.verdict;
  if (net.band === "全比和") {
    dom.verdict = dom.verdict || "吉";
    dom.xiangyi_review = true; // 强制象义待核（西林寺据理例外钩子）
    dom.verdict_from = "door(全比和维持门表)+xiangyi_review_flag";
  } else if (net.band === "无净评信号") {
    dom.verdict_from = "door(净评无生克信号,以门表为准)";
  } else if (dom.verdict === "mixed_mother_child") {
    dom.verdict_from = "door(生产分论母子,净评仅附注)";
  } else {
    dom.verdict = net.band;
    dom.verdict_from = "netassess(冲突以d为准·案例直证少年)";
  }
  return dom;
}

// ── 类象白名单 ──────────────────────────────────────────────────────────
const LX_BY_GUA = new Map<string, any>(
  (leixiangTable as any).bagua.map((b: any) => [b.gua, b]),
);
const MAP_BY_MEN = new Map<number, any>(
  (mapTable as any).doors.map((d: any) => [d.men_id, d]),
);

/** 从 CastResult 抽盘面事实 —— 供装配与白名单共用（对应 Python board_facts）。 */
export function boardFacts(d: CastResult) {
  const allowed = new Set<string>([
    d.shang_gua,
    d.xia_gua,
    d.ti,
    d.yong,
    d.hu_shang,
    d.hu_xia,
    ...d.shengke.relations.map((r) => r.from),
  ]);
  return {
    ben_gua: d.ben_gua,
    bian_gua: d.bian_gua,
    hu_gua: d.hu_gua,
    ti: d.ti,
    yong: d.yong,
    ti_wuxing: d.ti_wuxing,
    yong_wuxing: d.yong_wuxing,
    dong_yao: d.dong_yao,
    // 本盘出现的八卦（体用互变）——盘外八卦即脱盘
    allowed_gua: allowed,
    relations: d.shengke.relations,
    net: d.shengke.net,
  };
}

export interface LeixiangItem {
  gua: string;
  category: string;
  line: number;
  text: string;
  source_level: string;
}

/**
 * 门映射直证格 × 本盘单卦 → 类象白名单条目。
 * 只喂直证格（PM决策④）；pending 格不喂 —— 防映射发明。
 */
export function leixiangWhitelist(menId: number, r: CastResult): LeixiangItem[] {
  const door = MAP_BY_MEN.get(menId);
  if (!door) return [];
  const guas = [...boardFacts(r).allowed_gua].filter((g) => [...g].length === 1).sort();
  const out: LeixiangItem[] = [];
  for (const cell of door.cells ?? []) {
    for (const g of guas) {
      const b = LX_BY_GUA.get(g);
      if (b && cell.category in b.categories) {
        out.push({
          gua: g,
          category: cell.category,
          line: b.category_lines[cell.category],
          text: b.categories[cell.category],
          source_level: cell.source_level,
        });
      }
    }
  }
  return out;
}

// ── 接法二 Phase-1：文本明诫封顶引擎 ─────────────────────────────────────
export const CAP_BAND = "吉中有险";
/** 档序（高→低）：大吉 > 吉 > 吉中有险 > 平 > 凶中有救 > 凶 > 大凶 */
const BAND_RANK: Readonly<Record<string, number>> = Object.freeze({
  大凶: 0,
  凶: 1,
  凶中有救: 2,
  平: 3,
  吉中有险: 4,
  吉: 5,
  大吉: 6,
});

const CONFLICT_ROWS: any[] = (conflictTable as any).rows ?? [];

export interface TextConflict {
  capped: boolean;
  final_before: string | null;
  final_after: string | null;
  cap_note: string | null;
  triggers: any[];
}

/**
 * 净评之后：本/变卦（卦辞）或动爻（爻辞）命中冲突表 × men_id → final 高于「吉中有险」则封顶。
 * 互卦零触发；pending 单元永不触发；封顶幂等（上限语义，非减档非改 d）。
 */
export function applyTextConflict(
  r: CastResult,
  menId: number,
  finalVerdict: string | null,
): TextConflict {
  const ben = r.ben_gua;
  const bian = r.bian_gua;
  const dong = r.dong_yao;
  const triggers: any[] = [];
  for (const row of CONFLICT_ROWS) {
    if (!row.men_id.includes(menId)) continue;
    const g = row.gua;
    const posKind = row["触发位置"];
    if (posKind === "ben_or_bian") {
      if (g !== ben && g !== bian) continue;
      if (isPending(g, 0)) continue; // pending 卦辞屏蔽 = 永不触发
    } else if (posKind === "dong_yao") {
      if (g !== ben || dong !== row.yao_pos) continue;
      if (isPending(g, row.yao_pos)) continue;
    } else {
      continue;
    }
    triggers.push(row);
  }

  let capped = false;
  let finalAfter = finalVerdict;
  let capNote: string | null = null;
  const rank = (b: string): number => BAND_RANK[b] as number;
  if (
    triggers.length &&
    typeof finalVerdict === "string" &&
    finalVerdict in BAND_RANK &&
    rank(finalVerdict) > rank(CAP_BAND)
  ) {
    capped = true;
    finalAfter = CAP_BAND;
    const t = triggers[0];
    capNote =
      "文本明诫触发：" +
      t.gua +
      "「" +
      t["触发文本"] +
      "」×门" +
      menId +
      "→封顶" +
      CAP_BAND +
      "【接法二·受控修正】";
  } else if (triggers.length) {
    capNote =
      "文本明诫命中但 final=" +
      finalVerdict +
      " 已不高于" +
      CAP_BAND +
      ",不封顶仅注记(" +
      triggers[0].gua +
      "「" +
      triggers[0]["触发文本"] +
      "」)";
  }

  return {
    capped,
    final_before: finalVerdict,
    final_after: finalAfter,
    cap_note: capNote,
    triggers: triggers.map((t) => ({
      gua: t.gua,
      位置: t["位置"],
      触发文本: t["触发文本"],
      men_id: t.men_id,
      触发位置: t["触发位置"],
      溯源: t["溯源"],
      行号: t.scan_key["行号"],
    })),
  };
}

// ── 全流程断事 ───────────────────────────────────────────────────────────
export interface DuanshiFull {
  domain_semantics: Record<string, unknown>;
  base_polarity: string | null;
  net_d: {
    d: number;
    sheng_ti: number;
    ke_ti: number;
    band: string;
    detail: CountDetail[];
  };
  final_verdict: string | null;
  verdict_from: string | null;
  xiangyi_review_flag: boolean;
  net_return_hint: unknown;
  net_applicable: unknown;
  sources: unknown[];
  yingqi_candidates: YingqiResult[];
  domain: Record<string, any>;
  guaci_refs: { ben: GuaciInfo | null; bian: GuaciInfo | null };
  text_conflict: TextConflict;
  wangshuai: Record<string, any> | null;
  wangshuai_readable?: string;
  balance_required: BalanceRequired | null;
  huajie: HuajieResult | null;
  yingqi: YingqiResult;
  leixiang_whitelist: LeixiangItem[];
}

const SHENG_NAMES = ["丰", "大", "盛", "亢", "满"];

/** 结构化断事输出：{domain_semantics, base_polarity, net_d, final_verdict, sources, …}。 */
export function duanshiFull(
  men: number | string,
  r: CastResult,
  opts: {
    questionPolar?: boolean;
    posture?: string | null;
    lunarMonth?: number | null;
  } = {},
): DuanshiFull {
  const questionPolar = opts.questionPolar ?? true;
  const posture = opts.posture ?? null;
  const lunarMonth = opts.lunarMonth ?? null;

  const yongRel = r.shengke.relations.find((x) => x.role === "用")!.rel;
  const door = lookup(men, relationFromEngine("用", yongRel));
  const net = assess(r);
  const dom = combine(door, net, questionPolar);

  const out: DuanshiFull = {
    domain_semantics: {
      men_id: door.men_id,
      men_label: door.men_label,
      relation: door.relation,
      duanyu_template: door.duanyu_template,
      source_quote: door.source_quote,
      source_refs: door.source_refs,
    },
    base_polarity: (door.verdict as string) ?? null,
    net_d: {
      d: net.d,
      sheng_ti: net.sheng_ti,
      ke_ti: net.ke_ti,
      band: net.band,
      detail: net.detail,
    },
    final_verdict: (dom.verdict as string) ?? null,
    verdict_from: (dom.verdict_from as string) ?? null,
    xiangyi_review_flag: Boolean(dom.xiangyi_review),
    net_return_hint: dom.net_return_hint,
    net_applicable: dom.net_applicable,
    sources: [
      { kind: "door", quote: door.source_quote, refs: door.source_refs },
      { kind: "net", quote: net.source_quote, anchor: RULE_ANCHOR },
      { kind: "tables", status: TABLE_STATUS },
    ],
    yingqi_candidates: yingqiCandidates(r, posture),
    domain: dom,
    guaci_refs: { ben: null, bian: null },
    text_conflict: {
      capped: false,
      final_before: null,
      final_after: null,
      cap_note: null,
      triggers: [],
    },
    wangshuai: null,
    balance_required: null,
    huajie: null,
    yingqi: {} as YingqiResult,
    leixiang_whitelist: [],
  };

  // 接法一（2026-07-23 签）：本卦/变卦卦辞入局 —— 参照并列，不动极性；pending 屏蔽维持
  out.guaci_refs = { ben: getGuaciInfo(r.ben_gua), bian: getGuaciInfo(r.bian_gua) };
  dom.guaci_refs = out.guaci_refs;

  // 接法二 Phase-1（2026-07-24 签）：净评之后·文本明诫封顶（受控修正）。封顶非减档非改 d。
  const tc = applyTextConflict(r, door.men_id, out.final_verdict);
  out.text_conflict = tc;
  if (tc.capped) {
    out.final_verdict = tc.final_after;
    dom.verdict = tc.final_after;
    out.verdict_from = (out.verdict_from || "") + "＋" + tc.cap_note;
    dom.verdict_from = out.verdict_from;
  }
  dom.text_conflict = tc;

  // 旺衰接线（§4.4，确定性引擎；time 法用卦内节令，非 time 法用占卦当下节令 lunarMonth）
  // 键名刻意沿用 Python 侧 season / ti_status / yong_status，便于逐字段对拍。
  let ws: Record<string, any> = {
    season: r.wangshuai.season,
    ti_status: r.wangshuai.tiStatus,
    yong_status: r.wangshuai.yongStatus,
  };
  if (!ws.season && lunarMonth) {
    const w = weigh(r.ti_wuxing, r.yong_wuxing, seasonOfLunarMonth(lunarMonth));
    ws = {
      season: w.season,
      ti_status: w.tiStatus,
      yong_status: w.yongStatus,
      source: "占卦当下节令(农历" + lunarMonth + "月)",
    };
  } else if (ws.season) {
    ws = { ...ws, source: "卦内节令(time法)" };
  }
  out.wangshuai = ws.season ? ws : null;
  if (out.wangshuai) {
    const s = ws.season;
    const tiSuffix =
      ws.ti_status === "旺" ? "(当令得势)" : ws.ti_status === "衰" ? "(失令)" : "";
    out.wangshuai_readable =
      s + "令:体" + r.ti + r.ti_wuxing + ws.ti_status + tiSuffix +
      "、用" + r.yong + r.yong_wuxing + ws.yong_status;
    dom.wangshuai = out.wangshuai;
    dom.wangshuai_readable = out.wangshuai_readable;
  }

  // 吉凶平衡强制触发（签收物III，确定性）
  const fv = out.final_verdict;
  let balance: BalanceRequired | null = null;
  if (fv === "吉" || fv === "大吉" || fv === "吉中有险") {
    const reasons: string[] = [];
    if (SHENG_NAMES.some((ch) => (r.ben_gua + r.bian_gua).includes(ch))) {
      reasons.push("卦名含丰/大/盛义");
    }
    if (out.wangshuai && out.wangshuai.ti_status === "旺") reasons.push("体卦旺极当令");
    if (r.dong_yao >= 5) reasons.push("动爻居上位/极位");
    if (reasons.length) {
      balance = {
        type: "盛极将转",
        reasons,
        依据:
          "丰彖传「日中则昃，月盈则食」;《高岛断易·丰》「《丰》至极盛，衰即伏之」;乾上九「亢龙有悔」",
      };
    }
  } else if (fv === "凶" || fv === "大凶" || fv === "凶中有救") {
    balance = {
      type: "凶中生机",
      sheng_ti_gua: r.shengke.relations.filter((x) => x.rel === "生体").map((x) => x.from),
      依据: "疾病占「欲知凶中有救，生体之卦存焉」",
    };
  }
  out.balance_required = balance;
  dom.balance_required = balance;

  // 化解选条（确定性）。触发扩展：凶向四档 ∨ 象义待核flag ∨ 吉向盛极将转
  out.huajie = huajieSelect(r, out.final_verdict, Boolean(dom.xiangyi_review), balance);
  dom.huajie = out.huajie;

  // PM 决策落地：路由后单一应期 + 类象白名单 → 进 domain
  out.yingqi = yingqiRouted(r, out.final_verdict, posture);
  out.leixiang_whitelist = leixiangWhitelist(door.men_id, r);
  dom.yingqi = out.yingqi;
  dom.leixiang_whitelist = out.leixiang_whitelist;
  return out;
}
