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
import { CHAT_REQUIREMENTS } from "../src/prompt/chatRequirements.js";
import { PLAIN_REQUIREMENTS } from "../src/prompt/plainRequirements.js";
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
      // 2026-10-29 用户实测：问恋人心意的问句原先认不出，落成人事占
      ["男朋友对我是不是真心的？", 5],
      ["他会不会跟我分手", 5],
      ["女朋友爱不爱我", 5],
      ["这批货压了三个月，下个月清仓能回本吗？", 10],
      // 恋人称谓只说明问的是这个人，不说明问的是感情：问别的事时让位
      ["男朋友买的股票会涨吗", 10],
      ["女朋友下周面试能过吗", 9],
      ["男朋友住院了，身体能不能好", 16],
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

  it("默认要求短于完整契约，且完整契约逐字可用", () => {
    // 第二版应用户「过于精简」的反馈加长了（约 1,600 → 4,800 字），但仍须短于完整契约：
    // 默认导出是给手机用户粘的，不能比严格模式还重。
    expect(out.plain.length).toBeLessThan(out.contract.length);
    expect(out.plainFull.length).toBeLessThan(out.full.length);
    expect(out.contract).toContain("【断事追加铁律（在上述规则之上）】");
    expect(out.contract).toContain("【输出前逐条自查");
  });

  it("签收水印不是屏蔽：要求里必须写明，喂入的化解条目照常使用（第一版实证缺陷）", () => {
    // 第一版上线后，用户的 Claude 看到化解条目旁的「第七表待签收」水印，
    // 误当成 pending 屏蔽而拒引——要求文本必须把两者分开说清。
    expect(out.plain).toContain("不是屏蔽");
    expect(out.plain).toContain("[pending·屏蔽·不得引用]");
    expect(out.plain).toContain("是否得吉，仍在人事。");
  });

  it("示例句不得取自用户实测那张盘（评审发现同盘示例会被原句照搬）", () => {
    // 实测盘：地水师九二动 → 坤为地，互地雷复，求财，问比特币涨势，应期甲乙日/寅卯日
    for (const leak of [
      "比特币", "BTC", "多单", "杠杆", "止损",  // 「价位」只出现在禁令里（不给价位），不算泄题
      "地水师", "地雷复", "王三锡命", "在师中", "牝马", "丈人", "先迷后得主",
      "藏器", "恐有失陷", "动处求财", "静中得财",
    ]) {
      expect(out.plain.includes(leak), `要求文本含实测盘内容「${leak}」`).toBe(false);
    }
  });

  it("换盘复测补上的条文都在（乾为天·婚姻、天火同人·疾病两盘评审结论）", () => {
    for (const must of [
      "问的是别人的事",            // 代占：体落成那个人，指代不来回换
      "不断言病人实际有某病某症",  // 疾病取象不当诊断
      "卦辞说的是整卦",            // 不按动爻把卦辞归某一方
      "「无咎」是免了过错",        // 无咎不当托底
      "不给日子定性",              // 应期只在盘面写明取自克/生体之卦时才说要防/应验
      "不扯五行干支",              // 卦数一路不提五行
      "象义待核",                  // 张力写进转折段、不用盘外卦德
      "不许只截顺着极性的半句",    // 取象不挑半句
    ]) {
      expect(out.plain, `要求缺「${must}」`).toContain(must);
    }
    // 已撤回的门派性条文不得回来：相反字眼「归哪一方」等于规定一律归对方（动爻恒在用卦）
    expect(out.plain).not.toContain("说清这份吉（或凶）归哪一方");
    // 健康类不给成句示例（复测中被逐句照搬）
    for (const x of ["复诊", "医嘱"]) expect(out.plain.includes(x), `要求含健康示例「${x}」`).toBe(false);
  });

  it("示例句不写死任何应期日子（防止被抄进别的盘）", () => {
    for (const d of ["甲乙日", "丙丁日", "戊己日", "庚辛日", "壬癸日", "寅卯日", "巳午日", "申酉日", "亥子日"]) {
      expect(out.plain.includes(d), `要求文本写死了 ${d}`).toBe(false);
    }
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

describe("聊天版解读要求（第三版，默认导出）", () => {
  const r = divine("object_direction", { object_gua: "兑", direction_gua: "坤", hour_dizhi: "子" });
  const f = duanshiFull(10, r, { lunarMonth: 7 });
  const out = buildExportPrompt(r, f, { question: "那个报价今晚发过去，能谈下来吗？" });

  it("默认导出 = 盘面在前 + 聊天版要求；详解版与完整契约仍可取", () => {
    expect(out.chat).toBe(CHAT_REQUIREMENTS);
    expect(out.chatFull.startsWith("──────── 本卦盘面与规则")).toBe(true);
    expect(out.chatFull).toContain(out.facts);
    expect(out.chatFull.indexOf("【本卦】")).toBeLessThan(out.chatFull.indexOf("解读要求"));
    expect(out.plain).toBe(PLAIN_REQUIREMENTS);
    expect(out.full).toContain("【断事追加铁律（在上述规则之上）】");
    // 默认导出不能比详解版、完整契约还重
    expect(out.chatFull.length).toBeLessThan(out.plainFull.length);
    expect(out.chatFull.length).toBeLessThan(out.full.length);
  });

  it("用户定的形状：先结论，再发展、最需要小心、怎么做；九步顺序写死", () => {
    const steps = ["① 结论", "② 为什么是这个结论", "③ 现在", "④ 接下来", "⑤ 结局",
      "⑥ 最需要小心什么", "⑦ 怎么做", "⑧ 时间", "⑨ 总结"];
    let last = -1;
    for (const st of steps) {
      const i = CHAT_REQUIREMENTS.indexOf(st);
      expect(i, `缺步骤「${st}」`).toBeGreaterThan(-1);
      expect(i, `步骤「${st}」顺序不对`).toBeGreaterThan(last);
      last = i;
    }
    expect(CHAT_REQUIREMENTS).toContain("懂卦、也懂现实的人");
  });

  it("去掉的是表面标注，不是挂靠：每个判断仍须盘面推得出", () => {
    expect(CHAT_REQUIREMENTS).toContain("不加（依据：…）这类标注");
    expect(CHAT_REQUIREMENTS).toContain("每一个判断，都必须是盘面推得出来的");
    expect(CHAT_REQUIREMENTS).toContain("指不出来的判断，删掉");
    expect(CHAT_REQUIREMENTS).toContain("不能用来新增判断");
    // 详解版那条「每段用（依据：…）标出」不得带进聊天版
    expect(CHAT_REQUIREMENTS).not.toContain("用（依据：…）标出");
  });

  it("硬约束一条不放", () => {
    for (const must of [
      "最终极性", "档名原词", "不能翻过来", "可用卦象", "逐字照抄",
      "[pending·屏蔽·不得引用]", "不是屏蔽", "【应期】", "不换算成公历",
      "化解·喂入条目", "是否得吉，仍在人事。", "有两种看法：一种…另一种…",
      "不暗示任何科学预测效力", "不诊断", "不给价位", "放谁身上都对",
    ]) {
      expect(CHAT_REQUIREMENTS, `聊天版缺「${must}」`).toContain(must);
    }
    for (const bad of ["严格 JSON", "是否生机句", "输出前逐条自查"]) {
      expect(CHAT_REQUIREMENTS.includes(bad), `聊天版含 ${bad}`).toBe(false);
    }
  });

  it("盘面上写给旧骨架的说法，在要求里有对应（盘面文本锁死不能改）", () => {
    // 盘面【平衡强制】写「断语第⑤段」，【类象白名单】要求挂【取象】标签——都是对旧骨架说的
    expect(out.facts.includes("断语第⑤段") || !f.balance_required).toBe(true);
    expect(CHAT_REQUIREMENTS).toContain("「断语第⑤段」，指下面骨架的第⑥步");
    expect(CHAT_REQUIREMENTS).toContain("不挂标签、不写行号");
    expect(CHAT_REQUIREMENTS).toContain("以最终极性为准");
  });

  it("示例句不取自用户实测盘或试解盘，也不写死应期日子", () => {
    for (const leak of [
      // 用户实测：雷天大壮·问男朋友真心
      "大壮", "夬", "丧羊", "扬于王庭", "孚号", "利贞", "男朋友", "真心爱", "安全感",
      "比特币", "地水师", "藏器",
      // 试解六盘：归妹·求财、睽·疾病、旅·求名、履·官讼、剥·出行
      "归妹", "愆期", "征凶", "睽", "元夫", "小事吉", "琐琐", "履虎尾", "童蒙",
      "这批货", "清仓", "回本", "住院", "面试", "官司", "云南", "春占无财", "有贵人助",
      "春占不利行", "二簋", "宜和", "剥床",
    ]) {
      expect(CHAT_REQUIREMENTS.includes(leak), `聊天版含实测盘内容「${leak}」`).toBe(false);
    }
    for (const d of ["甲乙日", "丙丁日", "戊己日", "庚辛日", "壬癸日", "寅卯日", "巳午日", "申酉日", "亥子日"]) {
      expect(CHAT_REQUIREMENTS.includes(d), `聊天版写死了 ${d}`).toBe(false);
    }
  });

  it("第二轮试解暴露的自相矛盾已改掉，且钉住不回退", () => {
    // 比和译成「平」→ AI 写出「不会变顺」，与盘面标的（吉）相悖
    expect(CHAT_REQUIREMENTS).toContain("比和（吉）");
    expect(CHAT_REQUIREMENTS).toContain("不说成「不会变顺」");
    // 帮压数数只在②，④⑤不复述
    expect(CHAT_REQUIREMENTS).toContain("这层道理全篇只在这里讲全");
    expect(CHAT_REQUIREMENTS).toContain("不在这里把哪段帮、哪段压重列一遍");
    // 卦名不下定义（原③要求「讲卦名此刻的意思」与「不讲盘外卦义」冲突）
    expect(CHAT_REQUIREMENTS).toContain("卦名不下定义");
    expect(CHAT_REQUIREMENTS).not.toContain("用一句人话讲它此刻的意思");
    // 讲原文不降分量、不加条件
    expect(CHAT_REQUIREMENTS).toContain("不降分量");
    // 场景不夹带预言
    expect(CHAT_REQUIREMENTS).toContain("举例只写问卦人自己可能碰到的场面和选择");
    // 应期：软件自定的取法不得说成「传统推法」；卦数相加不扯卦；值为空一句了事
    expect(CHAT_REQUIREMENTS).not.toContain("传统推法");
    expect(CHAT_REQUIREMENTS).toContain("这套象数推法");
    expect(CHAT_REQUIREMENTS).toContain("按起卦时的几个数加出来");
    expect(CHAT_REQUIREMENTS).toContain("这张卦没给出明确的时间，我不硬推一个日子。");
    // 明诫封顶有对应写法
    expect(CHAT_REQUIREMENTS).toContain("【接法二·文本明诫封顶】");
    // 要求自己的措辞不得被复述给问卦人
    expect(CHAT_REQUIREMENTS).toContain("交代自己守规矩的话");
    // 第二轮口吻掉分的教训：本文不再规定具体说法（它们本身变成程式腔）
    expect(CHAT_REQUIREMENTS).not.toContain("原文里那个某字");
    expect(CHAT_REQUIREMENTS).toContain("不逐字拆");
  });

  it("第三轮试解的两处严重失手已有对应条文", () => {
    // 出行盘：取象写着当季「不利行」，AI 说成「不会卡你」——季节说法原只管帮他的那一卦
    expect(CHAT_REQUIREMENTS).toContain("取象原文带季节说法、又和盘面节令相合的");
    expect(CHAT_REQUIREMENTS).toContain("不只截顺的那半句");
    // 疾病盘：从卦辞推出「守住几件事就够」，凶档健康事里等于叫人少做
    expect(CHAT_REQUIREMENTS).toContain("「做这些就够了」「不必再…」这类叫人少做的话");
    // 吉中有险：险本身就是⑥的主角，⑦的大方向要把它算进去
    expect(CHAT_REQUIREMENTS).toContain("吉中有险，最要小心的就是那一处险");
    expect(CHAT_REQUIREMENTS).toContain("不说成「照计划去就行」");
    // 小修：单卦名当主语、自述取舍、张力套话、医嘱重复
    expect(CHAT_REQUIREMENTS).toContain("单卦名（乾兑离震巽坎艮坤）不单独当主语");
    expect(CHAT_REQUIREMENTS).toContain("不交代自己为什么这样说");
    expect(CHAT_REQUIREMENTS).toContain("这里也是同样的道理");
    expect(CHAT_REQUIREMENTS).toContain("不再追加「不能当诊断」");
  });

  it("门派分歧由程序判定并单列，不让 AI 从盘面猜起卦法", () => {
    const tag = "【本盘涉及的门派分歧";
    const sound = divine("sound", { first_count: 1, second_count: 2, hour_dizhi: "丑" });
    const so = buildExportPrompt(sound, duanshiFull(17, sound, { lunarMonth: 9 }));
    expect(so.disputes).toContain("声音占");
    expect(so.chatFull).toContain(so.disputes);
    // 对拍锁着的 facts 不受影响
    expect(so.facts.includes(tag)).toBe(false);

    const qian = divine("object_direction", { object_gua: "乾", direction_gua: "乾", hour_dizhi: "子" });
    expect(buildExportPrompt(qian, duanshiFull(5, qian, { lunarMonth: 7 })).disputes).toContain("乾坤取互");

    const huang = divine("color", { upper_color: "黄", lower_color: "白", hour_dizhi: "子" });
    expect(buildExportPrompt(huang, duanshiFull(5, huang, { lunarMonth: 7 })).disputes).toContain("黄→坤");

    // 指物起卦、非乾坤：明说不涉及
    expect(out.disputes).toContain("本盘不涉及需要并列的门派分歧");
    expect(out.disputes.includes("声音占")).toBe(false);
    // 要求文本指向这一节，而不是让 AI 自己判起卦法
    expect(CHAT_REQUIREMENTS).toContain("门派分歧只看盘面里的【本盘涉及的门派分歧】");
    // 盘面在前：分歧节位于要求之前
    for (const whole of [out.chatFull, out.plainFull, out.full]) {
      const iReq = Math.max(whole.indexOf("════════ 解读要求"), whole.indexOf("你是梅花易数解读助手"));
      expect(whole.indexOf(tag)).toBeGreaterThan(whole.indexOf("【本卦】"));
      expect(whole.indexOf(tag)).toBeLessThan(iReq);
    }
  });
});

