/**
 * 输入便利层与导出可读性（2026-10-25 用户实测三项反馈的验收）。
 *
 * 一、门类自动判定：确定性关键词规则，认不出落人事占。
 * 二、此刻取数：年支/农历月日/时支取自设备时钟，23 时起算次日（§3#4）须把**日期**一并推进。
 * 三、导出文本：盘面在前、要求在后；默认导出不含「输出严格 JSON」这类面向已退场护栏的要求。
 */
import { describe, it, expect } from "vitest";
import { detectMen, FALLBACK_MEN, MEN_LABEL } from "../src/engine/rules/menDetect.js";
import { nowTimeInputs, currentLunarMonth } from "../src/engine/now.js";
import { allDoors } from "../src/engine/rules/duanshiLookup.js";
import { divine } from "../src/engine/result.js";
import { duanshiFull } from "../src/engine/rules/netassess.js";
import { buildExportPrompt } from "../src/prompt/buildPrompt.js";
import { plainRead } from "../src/ui/plainRead.js";
import { DIZHI } from "../src/engine/lineage.js";

describe("门类自动判定（确定性关键词，零 LLM）", () => {
  it("每个判定门都存在于规则表里，标签与表一致", () => {
    const byId = new Map(allDoors().map((d: any) => [d.men_id, d.men_label]));
    for (const [id, label] of Object.entries(MEN_LABEL)) {
      expect(byId.has(Number(id)), `门 ${id} 不在规则表`).toBe(true);
      expect(byId.get(Number(id))).toBe(label);
    }
  });

  it("典型问句判到对的门", () => {
    const cases: Array<[string, number]> = [
      ["Baulkham Hills 那个报价今晚发过去，能谈下来吗？", 10],
      ["下周去杭州谈一单生意，能不能成？", 10],
      ["这套房要不要买", 4],
      ["我和他还能复合吗", 5],
      ["明天面试能过吗", 9],
      ["体检结果出来了，身体有没有事", 16],
      ["这个官司打得赢吗", 17],
      ["钱包丢了，能找回来吗", 15],
      ["他什么时候回来", 13],
      ["明天出差顺不顺", 12],
      ["周末会不会下雨", 1],
      ["这合同能不能签", 11],
      ["去拜访那位老师，能不能见到", 14],
      ["搬家选这个时候好吗", 4],
      ["怀孕了，生产顺利吗", 6],
      ["迁坟的事", 18],
    ];
    const wrong: string[] = [];
    for (const [q, want] of cases) {
      const got = detectMen(q);
      if (got.menId !== want) {
        wrong.push(`「${q}」→ ${MEN_LABEL[got.menId]}(${got.menId})，期望 ${MEN_LABEL[want]}(${want})`);
      }
      expect(got.matched.length, `「${q}」应有命中词`).toBeGreaterThan(0);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("认不出 / 空问句 → 人事占兜底，并标 fallback", () => {
    for (const q of ["", "   ", "帮我看看", "随便起一卦"]) {
      const d = detectMen(q);
      expect(d.menId).toBe(FALLBACK_MEN);
      expect(d.fallback).toBe(true);
      expect(d.matched).toEqual([]);
    }
    expect(MEN_LABEL[FALLBACK_MEN]).toBe("人事占");
  });

  it("判定纯函数：同一问句永远同一结果", () => {
    const q = "这单生意能不能成";
    const a = detectMen(q);
    for (let i = 0; i < 20; i++) expect(detectMen(q)).toEqual(a);
  });
});

describe("此刻取数（engine/now.ts）", () => {
  it("取数落在合法域内，且可直接喂 time 法", () => {
    const n = nowTimeInputs(new Date(2026, 9, 25, 14, 30));
    expect(DIZHI).toContain(n.year_dizhi as any);
    expect(DIZHI).toContain(n.hour_dizhi as any);
    expect(n.lunar_month).toBeGreaterThanOrEqual(1);
    expect(n.lunar_month).toBeLessThanOrEqual(12);
    expect(n.lunar_day).toBeGreaterThanOrEqual(1);
    expect(n.lunar_day).toBeLessThanOrEqual(30);
    // 2026-10-25 → 丙午年 农历九月十六，未时
    expect(n.year_dizhi).toBe("午");
    expect(n.lunar_month).toBe(9);
    expect(n.lunar_day).toBe(16);
    expect(n.hour_dizhi).toBe("未");
    expect(n.rolled).toBe(false);
    const r = divine("time", {
      year_dizhi: n.year_dizhi, lunar_month: n.lunar_month,
      lunar_day: n.lunar_day, hour_dizhi: n.hour_dizhi,
    });
    expect(r.ben_gua).toBeTruthy();
  });

  it("§3#4：23 时起算次日——时支为子，且**农历日一并推进**", () => {
    const before = nowTimeInputs(new Date(2026, 9, 25, 22, 30));  // 22:30
    const after = nowTimeInputs(new Date(2026, 9, 25, 23, 30));   // 23:30 同一天
    expect(before.rolled).toBe(false);
    expect(after.rolled).toBe(true);
    expect(after.hour_dizhi).toBe("子");
    // 关键：不是只换时支。换日必须把农历日推进一天，否则取数错一天。
    expect(after.lunar_day).toBe(before.lunar_day + 1);
    expect(after.note).toContain("23 时起算次日");
  });

  it("23 时换日跨农历月时，月份也随之推进", () => {
    // 2026-10-20 为农历九月初十前后——取农历月末当晚验证换月
    // 先找到一个「当天是农历某月最后一日」的公历日
    let found = false;
    for (let d = 1; d <= 60; d++) {
      const day = new Date(2026, 9, d, 22, 0);
      const a = nowTimeInputs(day);
      const b = nowTimeInputs(new Date(2026, 9, d, 23, 0));
      if (b.lunar_month !== a.lunar_month) {
        expect(b.lunar_day).toBe(1);
        expect(b.rolled).toBe(true);
        found = true;
        break;
      }
    }
    expect(found, "测试区间内未遇到换月日，断言未执行").toBe(true);
  });

  it("currentLunarMonth 与 nowTimeInputs 同一口径", () => {
    const at = new Date(2026, 9, 25, 23, 45);
    expect(currentLunarMonth(at)).toBe(nowTimeInputs(at).lunar_month);
  });

  it("十二时辰边界逐一对上地支", () => {
    const want: Array<[number, string]> = [
      [23, "子"], [0, "子"], [1, "丑"], [2, "丑"], [3, "寅"], [5, "卯"],
      [7, "辰"], [9, "巳"], [11, "午"], [13, "未"], [15, "申"], [17, "酉"],
      [19, "戌"], [21, "亥"],
    ];
    for (const [h, zhi] of want) {
      expect(nowTimeInputs(new Date(2026, 9, 25, h, 10)).hour_dizhi, `${h} 时`).toBe(zhi);
    }
  });
});

describe("导出文本：盘面在前，默认要求是人话版", () => {
  const r = divine("object_direction", { object_gua: "兑", direction_gua: "坤", hour_dizhi: "子" });
  const f = duanshiFull(10, r, { lunarMonth: 7 });
  const q = "那个报价今晚发过去，能谈下来吗？";
  const out = buildExportPrompt(r, f, { question: q });

  it("盘面排在要求之前（契约可重发，盘面不可）", () => {
    for (const whole of [out.plainFull, out.full]) {
      const iFacts = whole.indexOf("【本卦】");
      const iReq = Math.max(whole.indexOf("解读要求"), whole.indexOf("你是梅花易数解读助手"));
      expect(iFacts).toBeGreaterThan(-1);
      expect(iReq).toBeGreaterThan(-1);
      expect(iFacts, "盘面必须在要求之前").toBeLessThan(iReq);
    }
  });

  it("默认导出仍带齐不可替代的盘面事实", () => {
    for (const s of [
      `【本卦】${r.ben_gua}`, `【动爻】第${r.dong_yao}爻`, `【变卦】${r.bian_gua}`,
      `【体】${r.ti}(${r.ti_wuxing})`, `d=${f.net_d.d}`, "【应期·唯一喂入值",
      `【所问之事(问卦人原话)】${q}`,
    ]) {
      expect(out.plainFull).toContain(s);
    }
    expect(out.plainFull).toContain(out.facts);
  });

  it("默认要求不含面向已退场护栏的 JSON / 自检清单条文", () => {
    for (const bad of ["严格 JSON", "是否生机句", "是否收口建议", "table_status=", "relaxation_log", "输出前逐条自查"]) {
      expect(out.plain.includes(bad), `精简要求含 ${bad}`).toBe(false);
    }
    // 但真正起作用的硬约束一条不少
    for (const must of ["逐字", "可用卦象", "依据", "泛断", "应期", "六段", "不暗示"]) {
      expect(out.plain, `精简要求缺 ${must}`).toContain(must);
    }
  });

  it("精简要求显著短于完整契约，且完整契约逐字可用", () => {
    expect(out.plain.length).toBeLessThan(out.contract.length / 2);
    expect(out.contract).toContain("【断事追加铁律（在上述规则之上）】");
    expect(out.contract).toContain("【输出前逐条自查");
  });
});

describe("盘面直译（固定对照表，非解读）", () => {
  it("每行都带盘面出处，且同一张盘永远同一段字", () => {
    const r = divine("time", { year_dizhi: "辰", lunar_month: 12, lunar_day: 17, hour_dizhi: "申" });
    const f = duanshiFull(2, r, { lunarMonth: 12 });
    const a = plainRead(r, f);
    expect(a.length).toBeGreaterThanOrEqual(4);
    for (const l of a) {
      expect(l.src.length).toBeGreaterThan(0);
      expect(l.text.length).toBeGreaterThan(0);
    }
    expect(plainRead(r, f)).toEqual(a);
    // 体用关系必须被翻成处境话，不能只报术语
    const relLine = a.find((l) => l.src.startsWith("体用关系"));
    expect(relLine).toBeTruthy();
    expect(relLine!.text).not.toContain("体用关系");
  });

  it("五种体用关系都有对应的人话（遍历四法多门不出现空翻译）", () => {
    const inputs = [
      ["time", { year_dizhi: "辰", lunar_month: 12, lunar_day: 17, hour_dizhi: "申" }],
      ["sound", { first_count: 1, second_count: 5, hour_dizhi: "酉" }],
      ["object_direction", { object_gua: "坤", direction_gua: "坎", hour_dizhi: "午" }],
      ["color", { upper_color: "白", lower_color: "黑", hour_dizhi: "子" }],
    ] as const;
    const seen = new Set<string>();
    for (const [m, i] of inputs) {
      const r = divine(m as any, i as any);
      for (const men of [2, 5, 9, 10, 16]) {
        const f = duanshiFull(men, r, { lunarMonth: 7 });
        for (const l of plainRead(r, f)) {
          expect(l.text.trim().length).toBeGreaterThan(0);
          if (l.src.startsWith("体用关系")) seen.add(l.src);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });
});

describe("盘面直译的两处易误读点（2026-10-25 live 发现）", () => {
  it("有旺衰就必须翻出力量对比——「体坤土旺」里『体』后面是卦名+五行，不能只跨一字去取", () => {
    const r = divine("time", { year_dizhi: "午", lunar_month: 9, lunar_day: 16, hour_dizhi: "巳" });
    const f = duanshiFull(10, r, { lunarMonth: 9 });
    expect(f.wangshuai_readable).toBeTruthy();
    expect(f.wangshuai_readable).toMatch(/体[^、，]{0,3}[旺衰平]/);
    const line = plainRead(r, f).find((l) => l.src.startsWith("旺衰"));
    expect(line, `旺衰「${f.wangshuai_readable}」未被翻出`).toBeTruthy();
    expect(line!.text).toMatch(/强|弱|当令|不旺不衰/);
  });

  it("门表模板与最终极性冲突时，必须说明净评压过门表（不能「凶」底下紧跟「有财」）", () => {
    const r = divine("time", { year_dizhi: "午", lunar_month: 9, lunar_day: 16, hour_dizhi: "巳" });
    const f = duanshiFull(10, r, { lunarMonth: 9 });
    const ds = f.domain_semantics as any;
    // 本盘：门表基础极性 吉（体克用·有财），净评 d=-1 压成 凶
    expect(ds.duanyu_template).toBeTruthy();
    expect(f.base_polarity).toBe("吉");
    expect(f.final_verdict).toBe("凶");
    const line = plainRead(r, f).find((l) => l.src.includes("门表"));
    expect(line!.text).toContain(String(ds.duanyu_template));
    expect(line!.text).toContain("净评优先");
    expect(line!.text).toContain(String(f.final_verdict));
    expect(line!.src).toContain("净评");
  });

  it("门表模板与最终极性一致时不画蛇添足", () => {
    const r = divine("object_direction", { object_gua: "乾", direction_gua: "震", hour_dizhi: "辰" });
    const f = duanshiFull(2, r, { lunarMonth: 3 });
    const line = plainRead(r, f).find((l) => l.src.includes("门表"));
    if (line && String(f.final_verdict).includes(String(f.base_polarity))) {
      expect(line.text).not.toContain("净评优先");
    }
  });
});
