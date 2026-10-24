/**
 * 黄金案例复现（CLAUDE.md §7 / 验收标准 #1）——方法保真的验收线。
 *
 * 原书五案例（观梅 L339、牡丹 L346、借斧 L353、牛哀鸣 L392、验色 L438）在 TypeScript 实现中
 * 逐字段复现，与 §4.6 schema 中 expected 的每一项完全一致。不通过即不算完成。
 * 案例 JSON 直接取自 plum/eval/golden/，未作任何改动（期望值不得为迁就实现而调整）。
 */
import { describe, it, expect } from "vitest";
import { divine } from "../src/engine/result.js";
import type { CastMethod } from "../src/engine/cast.js";

import guanmei from "../src/data/golden/guanmei_001.json";
import mudan from "../src/data/golden/mudan_002.json";
import jiefu from "../src/data/golden/jiefu_003.json";
import niuming from "../src/data/golden/niuming_004.json";
import yanse from "../src/data/golden/yanse_005.json";

const CASES: any[] = [guanmei, mudan, jiefu, niuming, yanse];

describe("§7 黄金案例：原书五案例逐字段复现", () => {
  it("五案例齐备且各自标明源文行号（§11 可溯源铁律）", () => {
    expect(CASES).toHaveLength(5);
    for (const c of CASES) {
      expect(c.source?.file).toBeTruthy();
      expect(c.source?.lines).toMatch(/^\d+-\d+$/);
      expect(c.layer).toBe("A");
    }
  });

  for (const c of CASES) {
    it(`${c.id}（${c.method}，源 L${c.source.lines}）排盘与体用生克逐字段一致`, () => {
      const r = divine(c.method as CastMethod, c.input);
      const e = c.expected;

      // 排盘
      expect(r.shang_gua).toBe(e.shang_gua);
      expect(r.xia_gua).toBe(e.xia_gua);
      expect(r.ben_gua).toBe(e.ben_gua);
      expect(r.dong_yao).toBe(e.dong_yao);
      expect(r.bian_gua).toBe(e.bian_gua);
      expect(r.hu_shang).toBe(e.hu_shang);
      expect(r.hu_xia).toBe(e.hu_xia);

      // 体用
      expect(r.ti).toBe(e.ti);
      expect(r.yong).toBe(e.yong);
      expect(r.ti_wuxing).toBe(e.ti_wuxing);
      expect(r.yong_wuxing).toBe(e.yong_wuxing);

      // 生克：引擎机械关系列表（role / from / wuxing / rel / tone 全等）。
      // 键名为 expected.shengke（§4.6 schema），必须存在——不得因缺键而静默跳过。
      expect(Array.isArray(e.shengke), `${c.id} 缺 expected.shengke`).toBe(true);
      const got = r.shengke.relations.map((x) => ({
        role: x.role, from: x.from, wuxing: x.wuxing, rel: x.rel, tone: x.tone,
      }));
      expect(got).toEqual(e.shengke);

      // 净评（克体/生体计数与有救与否）
      if (e.net) {
        expect(r.shengke.net.keTiCount).toBe(e.net.ke_ti_count);
        expect(r.shengke.net.shengTiCount).toBe(e.net.sheng_ti_count);
        expect(r.shengke.net.hasRescue).toBe(e.net.has_rescue);
        expect(r.shengke.net.overall).toBe(e.net.overall);
      }
    });
  }
});
