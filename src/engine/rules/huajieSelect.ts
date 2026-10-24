/**
 * 化解触发+选条（确定性，先于解读）。移植自 plum/rules/huajie_select.py。
 *
 * 触发（2026-07-28 六轮扩展）：
 *   ① final ∈ {吉中有险,凶中有救,凶,大凶}；
 *   ② xiangyi_review_flag=true（全比和·象义待核——西林寺型张力，须给化解落点）；
 *   ③ 吉向档但平衡强制=盛极将转。
 * 选条：①本卦或变卦命中 5 大象（否/剥/蹇/困/明夷）→优先该卦大象；
 *      ②未命中→通用四句按情境择 1-2：克体≥2→善补过+见几而作；
 *        否则→待时而动（+final=吉中有险 时加 时止则止）。
 * 条目逐字取第七表（huajie_classics.json，candidate 水印随行）。
 */
import rows from "../../data/huajie_classics.json";
import type { CastResult } from "../result.js";

export const TRIGGER_BANDS = ["吉中有险", "凶中有救", "凶", "大凶"] as const;
export const DAXIANG_GUAS = ["天地否", "山地剥", "水山蹇", "泽水困", "地火明夷"] as const;

const ROWS: any[] = (rows as any).rows;

export interface BalanceRequired {
  type: string;
  reasons?: string[];
  sheng_ti_gua?: string[];
  依据?: string;
}

export interface HuajieResult {
  triggered: true;
  mode: "daxiang" | "tongyong";
  items: any[];
  盘面挂靠: string;
  table_status: string;
}

export function huajieTrigger(
  finalVerdict: string | null,
  xiangyiFlag = false,
  balance: BalanceRequired | null = null,
): boolean {
  return (
    (finalVerdict !== null && (TRIGGER_BANDS as readonly string[]).includes(finalVerdict)) ||
    Boolean(xiangyiFlag) ||
    balance?.type === "盛极将转"
  );
}

export function huajieSelect(
  d: CastResult,
  finalVerdict: string | null,
  xiangyiFlag = false,
  balance: BalanceRequired | null = null,
): HuajieResult | null {
  if (!huajieTrigger(finalVerdict, xiangyiFlag, balance)) return null;

  const trigNote =
    finalVerdict !== null && (TRIGGER_BANDS as readonly string[]).includes(finalVerdict)
      ? ""
      : xiangyiFlag
        ? "(触发:象义待核flag)"
        : "(触发:吉向盛极将转)";

  // ① 大象优先（本/变命中）
  const hit = [d.ben_gua, d.bian_gua].filter((g) =>
    (DAXIANG_GUAS as readonly string[]).includes(g),
  );
  if (hit.length) {
    const uniq = [...new Set(hit)];
    return {
      triggered: true, mode: "daxiang",
      items: ROWS.filter((r) => hit.includes(r.gua)),
      盘面挂靠: `本卦${d.ben_gua}/变卦${d.bian_gua} 命中大象凶卦 ${uniq.join("/")}${trigNote}`,
      table_status: "candidate_pending_human_signoff",
    };
  }

  // ② 通用四句按情境（确定性）
  const ke = d.shengke.net.keTiCount;
  let names: string[];
  let anchor: string;
  if (ke >= 2) {
    names = ["善补过", "见几而作"];
    anchor = `克体${ke}卦(受克重)→善补过/见几而作`;
  } else {
    names = ["待时而动"];
    if (finalVerdict === "吉中有险") names.push("时止则止");
    anchor =
      `克体${ke}卦,final=${finalVerdict}` +
      (finalVerdict === "吉中有险" ? "(封顶缓诫)→待时而动+时止则止" : "→待时而动");
  }
  return {
    triggered: true, mode: "tongyong",
    items: ROWS.filter((r) => names.includes(r.name)),
    盘面挂靠: anchor + trigNote,
    table_status: "candidate_pending_human_signoff",
  };
}
