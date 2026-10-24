/**
 * 断事层等价性对拍（验收标准 #2 的第二半）。
 *
 * 夹具 duanshi_cases.json 由 Python 参考实现生成（tests/fixtures/gen_duanshi_parity.py），
 * 覆盖四种起卦法 × 19 门类 + posture 四档 + 农历十二月旺衰接线 + 三个已知特例，
 * 共 2,626 组。比对 duanshiFull 的全部可判分顶层字段。
 * 差异不为零时逐条列出，不得自行判定哪边正确。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { divine } from "../src/engine/result.js";
import { duanshiFull } from "../src/engine/rules/netassess.js";
import type { CastMethod } from "../src/engine/cast.js";

interface DuanshiCase {
  method: CastMethod;
  inputs: Record<string, any>;
  men: number;
  posture: string | null;
  lunar_month: number | null;
  expected: Record<string, any>;
}

const cases: DuanshiCase[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/duanshi_cases.json", import.meta.url)), "utf-8"),
);

/** 深比对；undefined 与 null 视为等价（Python None → JSON null；TS 可能是 undefined）。 */
function diff(exp: any, got: any, path = ""): string[] {
  const out: string[] = [];
  const nil = (v: any) => v === null || v === undefined;
  if (nil(exp) && nil(got)) return out;
  if (Array.isArray(exp)) {
    if (!Array.isArray(got)) return [`${path}: 期望数组，实得 ${JSON.stringify(got)}`];
    if (exp.length !== got.length) out.push(`${path}: 长度 ${exp.length} vs ${got.length}`);
    for (let i = 0; i < Math.min(exp.length, got.length); i++) {
      out.push(...diff(exp[i], got[i], `${path}[${i}]`));
    }
    return out;
  }
  if (exp !== null && typeof exp === "object") {
    if (got === null || typeof got !== "object") {
      return [`${path}: 期望对象，实得 ${JSON.stringify(got)}`];
    }
    for (const k of Object.keys(exp)) {
      out.push(...diff(exp[k], (got as any)[k], path ? `${path}.${k}` : k));
    }
    return out;
  }
  if (exp !== got) out.push(`${path}: ${JSON.stringify(exp)} vs ${JSON.stringify(got)}`);
  return out;
}

/**
 * 已知渲染差异（PM 2026-10-24 裁定 B）：yingqi.note 是「应期不路由」时的说明文案，
 * 非判分字段。Python 用 repr（单引号 + None），TS 用 JSON（双引号 + null）。
 * 新站为 TS，不把 Python 的 None 带进界面；但**不放过内容差异**——
 * 此处只把两种引号/空值约定归一，归一后文案仍须逐字相同。
 */
function normalizeRepr(s: unknown): unknown {
  if (typeof s !== "string") return s;
  return s.replace(/'([^']*)'/g, '"$1"').replace(/=None/g, "=null");
}

const KEYS = [
  "domain_semantics", "base_polarity", "net_d", "final_verdict", "verdict_from",
  "xiangyi_review_flag", "net_return_hint", "net_applicable",
  "guaci_refs", "text_conflict", "wangshuai", "wangshuai_readable",
  "balance_required", "huajie", "yingqi", "leixiang_whitelist",
] as const;

describe("断事层等价性对拍：duanshiFull TypeScript vs Python", () => {
  it("夹具覆盖四法与全部 19 门类", () => {
    expect(cases.length).toBeGreaterThanOrEqual(2000);
    expect([...new Set(cases.map((c) => c.method))].sort()).toEqual([
      "color", "object_direction", "sound", "time",
    ]);
    expect(new Set(cases.map((c) => c.men)).size).toBe(19);
  });

  it(`全部 ${cases.length} 组断事输出逐字段一致，差异为零`, () => {
    const failures: string[] = [];
    for (const c of cases) {
      const r = divine(c.method, c.inputs);
      const got = duanshiFull(c.men, r, {
        posture: c.posture,
        lunarMonth: c.lunar_month,
      });
      const d: string[] = [];
      for (const k of KEYS) {
        let exp = c.expected[k];
        let act = (got as any)[k];
        if (k === "yingqi") {
          // 仅归一 note 的引号/空值渲染约定，其余字段原样深比
          exp = exp ? { ...exp, note: normalizeRepr(exp.note) } : exp;
          act = act ? { ...act, note: normalizeRepr(act.note) } : act;
        }
        d.push(...diff(exp, act, k));
      }
      if (d.length) {
        failures.push(
          `【${c.method} ${JSON.stringify(c.inputs)} 门${c.men} posture=${c.posture} 月=${c.lunar_month}】\n    ` +
            d.join("\n    "),
        );
      }
    }
    if (failures.length) {
      throw new Error(
        `断事层对拍差异 ${failures.length}/${cases.length} 组（须人工裁定，不得自行判定哪边正确）：\n` +
          failures.slice(0, 15).join("\n"),
      );
    }
    expect(failures.length).toBe(0);
  });
});
