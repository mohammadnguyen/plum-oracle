/**
 * Layer A 等价性对拍（CLAUDE.md 方法保真的核心验收）。
 *
 * 夹具 parity_cases.json 由 Python 参考实现生成（tests/fixtures/gen_parity.py），
 * 覆盖四种起卦法共 3,530 组输入。TS 实现逐字段比对，差异必须为零。
 * 差异不为零时逐条列出，不得自行判定哪边正确（见执行限制）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { divine } from "../src/engine/result.js";
import type { CastMethod } from "../src/engine/cast.js";

interface ParityCase {
  method: CastMethod;
  inputs: Record<string, any>;
  season: string | null;
  expected: Record<string, any>;
}

const cases: ParityCase[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/parity_cases.json", import.meta.url)), "utf-8"),
);

/** Python dict ←→ TS object：键集与值逐项深比。 */
function diffFields(exp: any, got: any, path = ""): string[] {
  const out: string[] = [];
  if (Array.isArray(exp)) {
    if (!Array.isArray(got)) return [`${path}: 期望数组，实得 ${typeof got}`];
    if (exp.length !== got.length) out.push(`${path}: 长度 ${exp.length} vs ${got.length}`);
    for (let i = 0; i < Math.min(exp.length, got.length); i++) {
      out.push(...diffFields(exp[i], got[i], `${path}[${i}]`));
    }
    return out;
  }
  if (exp !== null && typeof exp === "object") {
    if (got === null || typeof got !== "object") return [`${path}: 期望对象，实得 ${got}`];
    for (const k of Object.keys(exp)) {
      out.push(...diffFields(exp[k], (got as any)[k], path ? `${path}.${k}` : k));
    }
    return out;
  }
  if (exp !== got) out.push(`${path}: ${JSON.stringify(exp)} vs ${JSON.stringify(got)}`);
  return out;
}

describe("Layer A 等价性对拍：TypeScript 实现 vs Python 参考实现", () => {
  it(`夹具已加载且覆盖四种起卦法`, () => {
    expect(cases.length).toBeGreaterThanOrEqual(3000);
    const methods = new Set(cases.map((c) => c.method));
    expect([...methods].sort()).toEqual(["color", "object_direction", "sound", "time"]);
  });

  it(`全部 ${cases.length} 组输入逐字段一致，差异为零`, () => {
    const failures: string[] = [];
    for (const c of cases) {
      const got = divine(c.method, c.inputs, c.season);
      // shengke.net 与 wangshuai 的键在两侧命名不同（Python snake_case / TS camelCase），
      // 先从结构比对中剔除，下面逐字段单独核对。
      const { wangshuai: _ew, ...expRest } = c.expected;
      const { wangshuai: _gw, ...gotRest } = got as any;
      const expCmp = { ...expRest, shengke: { relations: c.expected.shengke.relations } };
      const gotCmp = { ...gotRest, shengke: { relations: got.shengke.relations } };
      const d = diffFields(expCmp, gotCmp);
      const n = c.expected.shengke.net;
      if (n.ke_ti_count !== got.shengke.net.keTiCount) d.push(`shengke.net.ke_ti_count: ${n.ke_ti_count} vs ${got.shengke.net.keTiCount}`);
      if (n.sheng_ti_count !== got.shengke.net.shengTiCount) d.push(`shengke.net.sheng_ti_count: ${n.sheng_ti_count} vs ${got.shengke.net.shengTiCount}`);
      if (n.has_rescue !== got.shengke.net.hasRescue) d.push(`shengke.net.has_rescue: ${n.has_rescue} vs ${got.shengke.net.hasRescue}`);
      if (n.overall !== got.shengke.net.overall) d.push(`shengke.net.overall: ${n.overall} vs ${got.shengke.net.overall}`);
      // wangshuai 同理
      const w = c.expected.wangshuai;
      if (w.season !== got.wangshuai.season) d.push(`wangshuai.season: ${w.season} vs ${got.wangshuai.season}`);
      if (w.ti_status !== got.wangshuai.tiStatus) d.push(`wangshuai.ti_status: ${w.ti_status} vs ${got.wangshuai.tiStatus}`);
      if (w.yong_status !== got.wangshuai.yongStatus) d.push(`wangshuai.yong_status: ${w.yong_status} vs ${got.wangshuai.yongStatus}`);
      if (d.length) {
        failures.push(`【${c.method} ${JSON.stringify(c.inputs)} season=${c.season}】\n    ` + d.join("\n    "));
      }
    }
    if (failures.length) {
      throw new Error(
        `对拍差异 ${failures.length}/${cases.length} 组（须人工裁定，不得自行判定哪边正确）：\n` +
          failures.slice(0, 20).join("\n"),
      );
    }
    expect(failures.length).toBe(0);
  });
});
