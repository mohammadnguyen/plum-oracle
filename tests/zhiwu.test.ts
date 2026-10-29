/**
 * 指物 · 方位起卦的输入助手（src/engine/zhiwu.ts）。
 * 物 → 卦只查已签收的《八卦万物类象表》；方位 → 卦按卷一二十七《八卦方位图》。
 */
import { describe, it, expect } from "vitest";
import { divine } from "../src/engine/result.js";
import { FANG, headingToFang, matchObject, soleTopGua, WANWU_ITEMS } from "../src/engine/zhiwu.js";

describe("物 → 卦（卷一四十五 八卦万物属类）", () => {
  it("牛哀鸣案：牛属坤，查表即得，且能接着复现原书那一卦（L392）", () => {
    const ms = matchObject("牛");
    expect(ms[0]).toMatchObject({ gua: "坤", cat: "动物", text: "牛", rank: 0 });
    expect(soleTopGua(ms)).toBe("坤");
    // 牛属坤为上卦、坎方为下卦、午时 → 地水师三爻动
    const r = divine("object_direction", { object_gua: soleTopGua(ms)!, direction_gua: headingToFang(0).gua, hour_dizhi: "午" });
    expect([r.ben_gua, r.dong_yao]).toEqual(["地水师", 3]);
  });

  it("每条都带原文与行号，行号落在卷一四十五（L453 起）", () => {
    expect(WANWU_ITEMS.length).toBeGreaterThan(80);
    for (const it of WANWU_ITEMS) {
      expect(it.line).toBeGreaterThan(453);
      expect(it.line).toBeLessThan(700);
    }
  });

  it("一句话里带着物名也能查到：「一匹白马」→ 乾「马」排第一，坤「牝马」一并列出", () => {
    const ms = matchObject("一匹白马");
    expect(ms[0]).toMatchObject({ gua: "乾", text: "马" });
    expect(soleTopGua(ms)).toBe("乾");
    const ms2 = matchObject("马");
    expect(ms2.map((m) => m.gua + m.text)).toEqual(["乾马", "坤牝马"]);
  });

  it("原书两卦都有的（乐器：震、兑），不替用户选", () => {
    const ms = matchObject("乐器");
    expect(new Set(ms.filter((m) => m.rank === 0).map((m) => m.gua))).toEqual(new Set(["震", "兑"]));
    expect(soleTopGua(ms)).toBeNull();
  });

  it("单字条目不乱套：「水杯」不因「水」落进乾的天时", () => {
    expect(matchObject("水杯").some((m) => m.text === "水")).toBe(false);
  });

  it("原书没有的现代物件查不到，就是查不到", () => {
    expect(matchObject("手机")).toEqual([]);
    expect(soleTopGua([])).toBeNull();
    expect(matchObject("  ")).toEqual([]);
  });
});

describe("方位 → 卦（卷一二十七 八卦方位图）", () => {
  it("八方各归其卦：离南坎北震东兑西，四隅巽坤艮乾", () => {
    const got = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => headingToFang(d).dir + headingToFang(d).gua);
    expect(got).toEqual(["正北坎", "东北艮", "正东震", "东南巽", "正南离", "西南坤", "正西兑", "西北乾"]);
    expect(FANG).toHaveLength(8);
  });

  it("每格 ±22.5°，分界上的归顺时针那一格；靠近分界会提醒", () => {
    expect(headingToFang(22.4).gua).toBe("坎");
    expect(headingToFang(22.5).gua).toBe("艮");
    expect(headingToFang(359.9).gua).toBe("坎");
    expect(headingToFang(-10).gua).toBe("坎");
    expect(headingToFang(720 + 180).gua).toBe("离");
    expect(headingToFang(20).nearEdge).toBe(true);
    expect(headingToFang(180).nearEdge).toBe(false);
  });
});
