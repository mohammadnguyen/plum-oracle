/**
 * 门类查表引擎（CLAUDE.md §4.3 / 卷二各类占断）。移植自 plum/rules/duanshi_lookup.py。
 * (men, 体用关系) → 该门 verdict + 断语模板 + 原文依据。纯函数、确定性、零 LLM。
 *
 * 类型化输出（type 字段）：
 *   · five_relations   —— 常规门：verdict ∈ {吉, 凶, mixed_mother_child(生产分论母子)}
 *   · return_semantics —— 行人门：verdict ∈ {即归, 归期不日, 归迟, 未归, 不归}（归期语义，非吉凶）
 *   · no_tiyong        —— 天时门：不分体用，五关系查询返回类型化提示，不给错误吉凶
 *   · xiangfa_only     —— 物占/杂占（app 扩展门）
 * 例外条款「据理而断」：exception_channel=not_implemented（高风险覆盖通道，须单独一轮经 PM 审后实现）。
 * 规则表 status 由表自身携带，本引擎只消费不改状态。
 */
import rules from "../../data/duanshi_polarity.json";

export const REL_KEYS = ["用生体", "比和", "体克用", "体生用", "用克体"] as const;
export type RelKey = (typeof REL_KEYS)[number];

const CANON: Readonly<Record<string, RelKey>> = Object.freeze({
  用生体: "用生体", 比和: "比和", 体克用: "体克用", 体生用: "体生用", 用克体: "用克体",
  体用比和: "比和",
});

/** 排盘引擎 (role=用, rel) → 门表五关系键。 */
const FROM_ENGINE: Readonly<Record<string, RelKey>> = Object.freeze({
  生体: "用生体", 克体: "用克体", 体克: "体克用", 体生: "体生用", 比和: "比和",
});

export const RETURN_ENUM = ["即归", "归期不日", "归迟", "未归", "不归"] as const;

const DOC = rules as any;

export function loadRules(): any {
  return DOC;
}

const BY_ID = new Map<number, any>();
const BY_NAME = new Map<string, any>();
for (const d of DOC.doors) {
  BY_ID.set(d.men_id, d);
  BY_NAME.set(d.men_name, d);
  BY_NAME.set(d.men_label, d);
}

export function getDoor(men: number | string): any {
  const door = typeof men === "number" ? BY_ID.get(men) : BY_NAME.get(String(men));
  if (!door) throw new Error(`未知门类: ${JSON.stringify(men)}（1–18 或 名称如 '求财'/'求财占'）`);
  return door;
}

export function allDoors(): any[] {
  return DOC.doors;
}

/** 排盘引擎生克条目 → 门表关系键。仅『用』对体的关系入门表；互/变超出本层范围。 */
export function relationFromEngine(role: string, rel: string): RelKey {
  if (role !== "用") {
    throw new Error(`门类极性表只定义体-用关系；role=${JSON.stringify(role)} 超出本层(互/变生克由总纲净评处理)`);
  }
  const k = FROM_ENGINE[rel];
  if (!k) throw new Error(`未知引擎关系: ${JSON.stringify(rel)}`);
  return k;
}

export interface DoorLookup {
  men_id: number;
  men_name: string;
  men_label: string;
  polarity_type: string;
  table_status: string;
  type: string;
  relation: string;
  verdict?: string;
  duanyu_template?: string;
  pm_annotation?: unknown;
  source_quote?: string;
  source_refs?: unknown;
  special_rules?: unknown;
  yiwen_note?: unknown;
  pending_items?: unknown;
  note?: string;
  xiangfa_branch?: unknown;
  [k: string]: unknown;
}

/** (门, 关系) → 类型化结果。天时/行人/物占不会返回错误吉凶。 */
export function lookup(men: number | string, relation: string): DoorLookup {
  const door = getDoor(men);
  const base = {
    men_id: door.men_id,
    men_name: door.men_name,
    men_label: door.men_label,
    polarity_type: door.polarity_type,
    table_status: DOC.meta.status,   // candidate 水印：签收前输出携带
  };

  if (door.polarity_type === "xiangfa_only") {
    return {
      ...base, type: "xiangfa_only", relation,
      note: "物占/杂占为 app 扩展门(依『占者以类而推之』),不走体用极性；断事依象法与爻辞(分支未实现)",
      xiangfa_branch: door.xiangfa_branch,
      source_quote: door.source_quote, source_refs: door.source_refs,
    };
  }

  if (door.polarity_type === "no_tiyong") {
    return {
      ...base, type: "no_tiyong", relation,
      note: "天时占不分体用，不适用五关系极性；走独立象法分支(placeholder，本轮未实现)",
      xiangfa_branch: door.xiangfa_branch,
      source_quote: door.source_quote, source_refs: door.source_refs,
    };
  }

  const rel = CANON[String(relation).trim()];
  if (!rel) {
    throw new Error(`未知体用关系: ${JSON.stringify(relation)}（应为 ${REL_KEYS.join("/")} 或 '体用比和'）`);
  }
  const r = door.relations[rel];
  const out: DoorLookup = {
    ...base, type: door.polarity_type, relation: rel,
    verdict: r.verdict, duanyu_template: r.duanyu_template,
    pm_annotation: r.pm_annotation ?? null,
    source_quote: r.source_quote, source_refs: r.source_refs,
    special_rules: door.special_rules, yiwen_note: door.yiwen_note,
    pending_items: door.pending_items,
  };
  if (door.polarity_type === "return_semantics") {
    out.note = "行人占断归期语义(即归/归期不日/归迟/未归/不归)，非吉凶极性——下游不得当吉凶消费";
  }
  if (r.verdict === "mixed_mother_child") {
    out.note = "生产占分论母子安危(体克用不利于子/用克体不利于母)，非简单吉凶——下游须分论呈现";
  }
  return out;
}
