/**
 * 指物 · 方位起卦的两个输入助手（2026-10-29）。
 *
 * 原书端法后天起卦：「以物为上卦，方位为下卦」（L312）；「用《八卦万物属类》所得之卦作为上卦，
 * 用此《八卦方位图》作为下卦」（L337）。这里只做这两步查表，都是确定性的：
 *
 *   · 物 → 卦：在已签收的《八卦万物类象表》（卷一四十五，`wanwu_leixiang.json`）里按字面查。
 *     只查动物、静物、人物、天时四类；查不到就是查不到，不猜、不按「像什么」推。
 *     一个物在原书里落在几卦（如「马」在乾、「牝马」在坤；「乐器」震兑都有），就全列出来，
 *     只有排第一的唯一时才替用户预选，其余一律让用户自己挑。
 *   · 方位 → 卦：《八卦方位图》（卷一二十七，L331–335）：巽东南、离正南、坤西南、震正东、
 *     兑正西、艮东北、坎正北、乾西北。指南针读数按 45° 一格切成八方。
 *
 * 类象表的 consume_policy 是「不进 prompt/不给 LLM」；这里只在界面上帮用户选上卦，
 * 不进导出文本，也不给任何 AI，与该约束不冲突。
 */
import leixiangTable from "../data/wanwu_leixiang.json";
import { BAGUA } from "./bagua.js";

/** 八卦名。 */
export type TrigramName = "乾" | "兑" | "离" | "震" | "巽" | "坎" | "艮" | "坤";

/** 指物时查的类目。地理、身体等不收：地理里多是方位（与下卦重复），身体另有取诸身法。 */
export const ZHIWU_CATEGORIES = ["动物", "静物", "人物", "天时"] as const;
type Cat = (typeof ZHIWU_CATEGORIES)[number];

export interface WanwuItem {
  gua: TrigramName;
  cat: Cat;
  /** 原文条目，照录（含括注） */
  text: string;
  /** 用来比对的字：去掉括注 */
  core: string;
  /** 该类目在 TXT 里的行号 */
  line: number;
}

interface Entry {
  gua: string;
  categories: Record<string, string | undefined>;
  category_lines: Record<string, number>;
}

export const WANWU_ITEMS: readonly WanwuItem[] = Object.freeze(
  ((leixiangTable as unknown as { bagua: Entry[] }).bagua).flatMap((e) =>
    ZHIWU_CATEGORIES.flatMap((cat) =>
      String(e.categories[cat] ?? "")
        .split("，")
        .map((s) => s.replace(/。$/, "").trim())
        .filter(Boolean)
        .map((text) => ({
          gua: e.gua as TrigramName,
          cat,
          text,
          core: text.replace(/（[^）]*）/g, ""),
          line: e.category_lines[cat]!,
        })),
    ),
  ),
);

export interface ZhiwuMatch extends WanwuItem {
  /** 0 = 字面相同；1 = 你写的话里含这一条；2 = 这一条里含你写的字 */
  rank: 0 | 1 | 2;
}

/**
 * 按字面查物属何卦。排序：字面相同 → 你写的里含这一条（长的在前）→ 这一条里含你写的。
 * 单字条目（马、牛、火、天…）只在字面相同、或属动物类时才算「含」——否则「水杯」会因「水」落进乾的天时。
 */
export function matchObject(input: string): ZhiwuMatch[] {
  const q = input.replace(/[\s，,。.、！!？?]/g, "");
  if (!q) return [];
  const out: ZhiwuMatch[] = [];
  for (const it of WANWU_ITEMS) {
    const c = it.core;
    if (!c) continue;
    if (c === q) out.push({ ...it, rank: 0 });
    else if (q.includes(c) && (c.length >= 2 || it.cat === "动物")) out.push({ ...it, rank: 1 });
    else if (q.length >= 1 && c.includes(q) && c.length > q.length) out.push({ ...it, rank: 2 });
  }
  return out.sort((a, b) => a.rank - b.rank || b.core.length - a.core.length);
}

/** 排第一的那一卦唯一时才预选；并列（如「乐器」震兑都有）返回 null，让用户自己挑。 */
export function soleTopGua(ms: readonly ZhiwuMatch[]): TrigramName | null {
  if (!ms.length) return null;
  const top = ms.filter((m) => m.rank === ms[0]!.rank && m.core.length === ms[0]!.core.length);
  const guas = new Set(top.map((m) => m.gua));
  return guas.size === 1 ? top[0]!.gua : null;
}

/** 《八卦方位图》八方，自正北起顺时针。 */
export const FANG: ReadonlyArray<{ dir: string; gua: TrigramName; center: number }> = Object.freeze([
  { dir: "正北", gua: "坎", center: 0 },
  { dir: "东北", gua: "艮", center: 45 },
  { dir: "正东", gua: "震", center: 90 },
  { dir: "东南", gua: "巽", center: 135 },
  { dir: "正南", gua: "离", center: 180 },
  { dir: "西南", gua: "坤", center: 225 },
  { dir: "正西", gua: "兑", center: 270 },
  { dir: "西北", gua: "乾", center: 315 },
]);
export const FANG_SOURCE = "卷一二十七 八卦方位图（L331–335）";

/** 离分界线这么近（度）就提醒用户：再偏一点就换一卦了。 */
export const EDGE_WARN_DEG = 6;

/**
 * 指南针读数（0–360，北=0，顺时针）→ 方位与卦。每格 45°，中心 ± 22.5°；正好落在分界上的归顺时针那一格。
 */
export function headingToFang(deg: number): { dir: string; gua: TrigramName; deg: number; nearEdge: boolean } {
  const d = ((deg % 360) + 360) % 360;
  const i = Math.floor(((d + 22.5) % 360) / 45);
  const f = FANG[i]!;
  const off = Math.abs(((d - f.center + 540) % 360) - 180);
  return { dir: f.dir, gua: f.gua, deg: d, nearEdge: 22.5 - off < EDGE_WARN_DEG };
}

// 与八卦表的方位字段互相校验：方位图写的「正北」即八卦表的「北」。
for (const f of FANG) {
  if (f.dir.replace(/^正/, "") !== BAGUA[f.gua]?.direction) {
    throw new Error(`方位图与八卦表不一致：${f.gua} ${f.dir} vs ${BAGUA[f.gua]?.direction}`);
  }
}
