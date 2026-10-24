/**
 * 卦爻辞语料（CLAUDE.md §4.5）。移植自 plum/corpus/guayaoci.py。
 *
 * 权威源 = sources/zhouyi_clean.json（阮刻《周易正义》系统人工核定覆盖 OCR 抽取），
 * 已随前端打包（src/data/zhouyi_clean.json）。绝不取自扫描 PDF，绝不靠 LLM 记忆（§1/§11）。
 * 若 meta.verified ≠ true，则保持锁定、回退 stub。
 *
 * 冒烟校验（§4.5）：牛哀鸣案(L393)引「师卦六三：师或舆尸，凶」——权威源地水师六三须逐字一致。
 */
import clean from "../../data/zhouyi_clean.json";
import { nameOf } from "../gua64.js";

export const AUTHORITATIVE_SOURCE = "sources/zhouyi_clean.json";

interface YaociEntry { pos: number; text?: string | null; yname?: string | null; flag?: unknown }
interface HexEntry {
  upper: string; lower: string; name: string; seq: number;
  guaci?: string | null; guaci_flag?: unknown; yaoci: YaociEntry[];
}

interface IndexEntry {
  guaci: string | null;
  name: string;
  seq: number;
  yao: Record<number, string | null>;
  yname: Record<number, string | null>;
}

const INDEX = new Map<string, IndexEntry>();
const PENDING = new Set<string>();   // key = `${全名}#${pos}`，pos 0 = 卦辞
let corpusSource = "stub_from_case";
let corpusVerified = false;

const STUB_YAOCI: Record<string, { yao_name: string; text: string; source: string }> = {
  "地水师#3": { yao_name: "六三", text: "师或舆尸，凶。", source: "stub_from_case" },
};

function load(): void {
  const doc = clean as unknown as { meta?: { verified?: boolean }; hexagrams: HexEntry[] };
  if (!doc?.meta?.verified) return;   // 未签收 verified → 保持锁定
  for (const h of doc.hexagrams) {
    const full = nameOf(h.upper, h.lower);
    const entry: IndexEntry = {
      guaci: h.guaci ?? null, name: h.name, seq: h.seq, yao: {}, yname: {},
    };
    if (h.guaci_flag) PENDING.add(`${full}#0`);           // 卦辞 pending（如革卦辞）
    for (const y of h.yaoci) {
      entry.yao[y.pos] = y.text ?? null;
      entry.yname[y.pos] = y.yname ?? null;               // 传统爻题（初九/六二…）
      if (y.flag) PENDING.add(`${full}#${y.pos}`);        // 爻辞 pending（如革六二/小过九三）
    }
    INDEX.set(full, entry);
  }
  corpusSource = "zhouyi_clean.json";
  corpusVerified = true;
}

load();

/** 引辞判分维度是否解锁 = 权威源已 verified 加载。 */
export function citedYaociUnlocked(): boolean {
  return corpusVerified;
}

export function corpusInfo(): { source: string; verified: boolean; hexagrams: number } {
  return { source: corpusSource, verified: corpusVerified, hexagrams: INDEX.size };
}

/** 该卦爻位是否 pending（带 flag，下游须屏蔽）。pos 0 = 卦辞。 */
export function isPending(guaName: string, pos: number): boolean {
  return PENDING.has(`${guaName}#${pos}`);
}

export interface YaociInfo {
  gua_name: string;
  yao: number;
  text: string | null;
  pending: boolean;
  yname?: string | null;
  note?: string;
  source: string;
}

/** 取某卦（全名）某爻（1..6）爻辞。**pending 单元屏蔽正文，返回 pending 标识**。 */
export function getYaoci(guaName: string, yao: number): YaociInfo | null {
  if (!corpusVerified) {
    const stub = STUB_YAOCI[`${guaName}#${yao}`];
    return stub
      ? { gua_name: guaName, yao, text: stub.text, pending: false, yname: stub.yao_name, source: stub.source }
      : null;
  }
  if (isPending(guaName, yao)) {
    return {
      gua_name: guaName, yao, text: null, pending: true,
      note: "pending 单元·正文屏蔽·待人工清 flag", source: corpusSource,
    };
  }
  const e = INDEX.get(guaName);
  const t = e ? e.yao[yao] ?? null : null;
  if (!t) return null;
  return { gua_name: guaName, yao, text: t, pending: false, yname: e!.yname[yao] ?? null, source: corpusSource };
}

export interface GuaciInfo {
  gua_name: string;
  text: string | null;
  pending: boolean;
  seq: number | null;
  note?: string;
  source?: string;
}

/** 卦辞信息（接法一喂入用）。pending（革卦辞）→ text=null + pending=true（屏蔽）。 */
export function getGuaciInfo(guaName: string): GuaciInfo | null {
  if (!corpusVerified) return null;
  if (isPending(guaName, 0)) {
    return { gua_name: guaName, text: null, pending: true, seq: null, note: "pending 单元·正文屏蔽·待人工核定" };
  }
  const e = INDEX.get(guaName);
  if (!e || !e.guaci) return null;
  return { gua_name: guaName, text: (e.guaci || "").trim(), pending: false, seq: e.seq, source: corpusSource };
}

/** 取卦辞。pending（如革卦辞）返回 null（屏蔽）——用 isPending 区分 pending 与缺失。 */
export function getGuaci(guaName: string): string | null {
  if (!corpusVerified || isPending(guaName, 0)) return null;
  const e = INDEX.get(guaName);
  return e ? e.guaci : null;
}

/** §4.5 冒烟校验：地水师六三逐字。 */
export function smokeCheckShiLiusan(): boolean {
  const e = getYaoci("地水师", 3);
  return e !== null && (e.text || "").replace(/。+$/, "") === "师或舆尸，凶";
}
