/**
 * 五行生克吉凶（CLAUDE.md §4.3）。移植自 plum/core/wuxing.py。
 * 以体为主，对 用 / 互上 / 互下 / 变 各算一次与体的关系。
 *
 * 生（L8）：金生水，水生木，木生火，火生土，土生金。
 * 克（L8）：金克木，木克土，土克水，水克火，火克金。
 *
 * 引擎只产出机械的「体-相对关系列表 + 净评」（确定性、可精确判分）；
 * 原书侧重的叙事性生克链属解读层，不进 expected.shengke 的精确匹配。
 */

/** a 生 SHENG[a] */
export const SHENG: Readonly<Record<string, string>> = Object.freeze({
  金: "水", 水: "木", 木: "火", 火: "土", 土: "金",
});
/** a 克 KE[a] */
export const KE: Readonly<Record<string, string>> = Object.freeze({
  金: "木", 木: "土", 土: "水", 水: "火", 火: "金",
});

/** 关系 → 吉凶倾向 */
export const TONE: Readonly<Record<string, string>> = Object.freeze({
  生体: "大吉",
  比和: "吉",
  体克: "吉（费力）",
  体生: "泄气，不利",
  克体: "凶",
});

export type Relation = "生体" | "比和" | "体克" | "体生" | "克体";

/** 以体五行为主，判 other 对体的关系，返回 §4.3 五种之一。 */
export function relate(tiWx: string, otherWx: string): Relation {
  if (otherWx === tiWx) return "比和";
  if (SHENG[otherWx] === tiWx) return "生体"; // 他 生 体
  if (SHENG[tiWx] === otherWx) return "体生"; // 体 生 他（泄）
  if (KE[otherWx] === tiWx) return "克体";    // 他 克 体
  if (KE[tiWx] === otherWx) return "体克";    // 体 克 他
  throw new Error(`无法判定 ${tiWx} vs ${otherWx}`); // 五行闭合，不应到达
}

/** role + rel → 原书风格中文短语，如 ('用','克体')→'用克体'、('变','生体')→'变生体'。 */
export function relationZh(role: string, rel: Relation | string): string {
  switch (rel) {
    case "比和": return `体${role}比和`;
    case "生体": return `${role}生体`;
    case "克体": return `${role}克体`;
    case "体克": return `体克${role}`;
    case "体生": return `体生${role}`;
    default: return String(rel);
  }
}

export interface ShengkeItem {
  role: string;
  from: string;
  wuxing: string;
  rel: Relation;
  phrase: string;
  tone: string;
}

export interface ShengkeNet {
  keTiCount: number;
  shengTiCount: number;
  hasRescue: boolean;
  overall: string;
}

export interface ShengkeResult {
  relations: ShengkeItem[];
  net: ShengkeNet;
}

/** tiWx = 体五行；roles = [role, 卦名, 卦五行][] 不含体。 */
export function analyze(
  tiWx: string,
  roles: ReadonlyArray<readonly [string, string, string]>,
): ShengkeResult {
  const relations: ShengkeItem[] = [];
  let keTi = 0;
  let shengTi = 0;
  for (const [role, gua, wx] of roles) {
    const rel = relate(tiWx, wx);
    if (rel === "克体") keTi += 1;
    else if (rel === "生体") shengTi += 1;
    relations.push({
      role,
      from: gua,
      wuxing: wx,
      rel,
      phrase: relationZh(role, rel),
      tone: TONE[rel] as string,
    });
  }
  // 净评：克体之卦多则凶；有生体之卦则有救。
  let overall: string;
  if (keTi === 0) overall = shengTi ? "吉" : "平";
  else if (shengTi) overall = "凶险但有救";
  else overall = "凶";
  return {
    relations,
    net: {
      keTiCount: keTi,
      shengTiCount: shengTi,
      hasRescue: keTi > 0 && shengTi > 0,
      overall,
    },
  };
}
