/**
 * 梅花 · 外应（src/engine/waiying.ts）。原文逐字核对见 `npm run verify:waiying`
 * （要读原书 TXT，不在仓库里，CI 不跑）。这里锁判定逻辑与导出。
 */
import { describe, it, expect } from "vitest";
import { divine } from "../src/engine/result.js";
import { duanshiFull } from "../src/engine/rules/netassess.js";
import { buildExportPrompt } from "../src/prompt/buildPrompt.js";
import { CHAT_REQUIREMENTS } from "../src/prompt/chatRequirements.js";
import { PLAIN_REQUIREMENTS } from "../src/prompt/plainRequirements.js";
import { neiSide, readWaiying, SHIYING_RULE, WAIYING } from "../src/engine/waiying.js";

describe("外应表", () => {
  it("条目 id 不重复；每条都有原文与行号，落在卷二十应各篇（L1013–L1067）", () => {
    expect(new Set(WAIYING.map((x) => x.id)).size).toBe(WAIYING.length);
    for (const x of WAIYING) {
      expect(x.quote.length).toBeGreaterThan(1);
      expect(x.line).toBeGreaterThanOrEqual(1013);
      expect(x.line).toBeLessThanOrEqual(1067);
    }
  });

  it("不收疑有讹字的「水之气属震、巽」，也不收不论卦象的直断（乌鸦、灵鹊）", () => {
    expect(WAIYING.some((x) => x.quote.includes("水之气"))).toBe(false);
    expect(WAIYING.some((x) => /乌鸦|灵鹊|鹊声|枷锁/.test(x.quote))).toBe(false);
  });

  it("天时之应原书例：明朗为乾，乾兑为体比和而吉、坎为体逢生、震巽为体见克", () => {
    // L1013「乾，兑为体，则比和而吉；坎为体，则逢生而大吉。坤、艮为体，则泄气。震、巽为体，则见克而不吉矣」
    const q = ["tq_qing"];
    expect(readWaiying(q, "金", "吉")!.hits[0]!.rel).toBe("比和");
    expect(readWaiying(q, "水", "吉")!.hits[0]!.rel).toBe("生体");
    expect(readWaiying(q, "土", "吉")!.hits[0]).toMatchObject({ rel: "体生", ji: false });
    expect(readWaiying(q, "木", "吉")!.hits[0]).toMatchObject({ rel: "克体", ji: false });
  });
});

describe("内外合断：只摆原书原话，不改档名（L1007）", () => {
  it("四种组合各引对应的原句", () => {
    expect(readWaiying(["tq_qing"], "金", "大吉")!.rule).toEqual([SHIYING_RULE.quanJi]);
    expect(readWaiying(["tq_ri"], "金", "凶")!.rule).toEqual([SHIYING_RULE.quanXiong]);
    expect(readWaiying(["tq_qing"], "金", "凶中有救")!.rule).toEqual([SHIYING_RULE.neiXiongWaiJi, SHIYING_RULE.xiangLi]);
    expect(readWaiying(["tq_ri"], "金", "吉中有险")!.rule).toEqual([SHIYING_RULE.neiJiWaiXiong, SHIYING_RULE.xiangLi]);
    const mixed = readWaiying(["tq_qing", "tq_ri"], "金", "吉")!;
    expect(mixed.wai).toBe("有吉有不吉");
    expect(mixed.rule).toEqual([SHIYING_RULE.xiangLi]);
  });

  it("档名归边：带「凶」字的三档为不吉，其余为吉；没选外应返回 null", () => {
    expect(["大吉", "吉", "吉中有险", "凶中有救", "凶", "大凶"].map(neiSide))
      .toEqual(["吉", "吉", "吉", "不吉", "不吉", "不吉"]);
    expect(readWaiying([], "金", "吉")).toBeNull();
    expect(readWaiying(["不存在"], "金", "吉")).toBeNull();
  });
});

describe("导出", () => {
  const r = divine("object_direction", { object_gua: "兑", direction_gua: "坤", hour_dizhi: "子" });
  const f = duanshiFull(10, r, { lunarMonth: 7 });
  const plain = buildExportPrompt(r, f, { question: "能谈下来吗？" });
  const withWy = buildExportPrompt(r, f, { question: "能谈下来吗？", waiying: ["tq_yu", "dw_niu"] });

  it("没选外应整节不出现；选了单列在门派分歧之后，facts 一字不变", () => {
    expect(plain.waiying).toBe("");
    expect(withWy.facts).toBe(plain.facts);
    expect(withWy.waiying).toContain("【外应（");
    expect(withWy.waiying).toContain("原书「雨雪为坎之时」（卷二三十 复明天时之应·L1013）");
    expect(withWy.waiying).toContain("原书「坤为牛」");
    expect(withWy.waiying).toContain("外应不改【最终极性】的档名");
    for (const whole of [withWy.chatFull, withWy.plainFull, withWy.full]) {
      expect(whole.indexOf("【外应（")).toBeGreaterThan(whole.indexOf("【本盘涉及的门派分歧"));
      expect(whole.indexOf("【外应（")).toBeLessThan(Math.max(whole.indexOf("════════ 解读要求"), whole.indexOf("你是梅花易数解读助手")));
    }
  });

  it("两版要求都交代外应怎么用", () => {
    expect(CHAT_REQUIREMENTS).toContain("有【外应】的");
    expect(CHAT_REQUIREMENTS).toContain("结论和档名不变");
    expect(PLAIN_REQUIREMENTS).toContain("盘面有【外应】的");
  });
});
