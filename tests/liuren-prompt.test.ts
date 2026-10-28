/**
 * 大六壬 · 导出 Prompt 的完整性与边界。
 *
 * 要点：六壬的解读要求**不能**复用梅花那份。梅花引擎会给出净评六档，
 * 所以那份要求写死「极性不得翻转」；六壬引擎**不出吉凶档**，
 * 同一句话搬过来就是逼解读者去遵守一个根本不存在的判决。
 * 这里把这条差别钉成断言。
 */
import { describe, it, expect } from "vitest";
import { divineLiuren } from "../src/engine/liuren/result.js";
import { buildLiurenPrompt } from "../src/prompt/buildLiurenPrompt.js";
import { LIUREN_REQUIREMENTS } from "../src/prompt/liurenRequirements.js";
import { LIUREN_CHAT_REQUIREMENTS } from "../src/prompt/liurenChatRequirements.js";
import { PLAIN_REQUIREMENTS } from "../src/prompt/plainRequirements.js";
import { DIZHI } from "../src/engine/liuren/ganzhi.js";

const AT = new Date(2026, 9, 28, 22, 7);
const build = (q?: string) =>
  buildLiurenPrompt(divineLiuren({ at: AT, zhanshi: "亥", question: q ?? null }));

describe("六壬导出：盘面事实一项不漏", () => {
  const r = divineLiuren({ at: AT, zhanshi: "亥", question: "下周要去谈一个合作，能谈成吗？" });
  const { facts, full } = buildLiurenPrompt(r);

  it("起课四要素：日干支、占时、昼夜、月将（含所据中气）", () => {
    expect(facts).toContain(r.input.dayGanZhi);
    expect(facts).toContain(`占时 ${r.input.zhanshi}`);
    expect(facts).toContain(`${r.input.zhouye}占`);
    expect(facts).toContain(`【月将】${r.yuejiang.zhi}`);
    expect(facts).toContain(r.yuejiang.zhongqi);
    expect(facts).toContain(r.yuejiang.zhongqiTime);
  });

  it("天地盘十二格全带，且各标天将与空亡", () => {
    for (const di of DIZHI) {
      const row = r.rows.find((x) => x.di === di)!;
      expect(facts, `地盘 ${di} 未带`).toContain(`${di} → ${row.tian}（${row.jiang}`);
    }
    for (const row of r.rows.filter((x) => x.kong)) {
      expect(facts).toContain(`${row.di} → ${row.tian}（${row.jiang}·空）`);
    }
    expect(facts).toContain(`【空亡】${r.kongwang.join("、")}`);
    expect(facts).toContain(`【旬首】${r.xunshou}`);
  });

  it("四课带齐，并写明一二课属干、三四课属支", () => {
    expect(facts).toContain("一二课属日干＝你，三四课属日支");
    for (const k of r.sike.ke) expect(facts).toContain(k.shang);
    expect(facts).toContain(`日干 ${r.input.gan} 寄宫 ${r.sike.jigong}`);
    expect(facts).toContain(`日支 ${r.input.zhi}`);
  });

  it("三传带遁干、天将、空亡与对日干的关系，并标明初中末之义", () => {
    expect(facts).toContain("初→中→末，即发端→经过→落脚");
    for (const c of r.chuanDetail) {
      expect(facts).toContain(`${c.pos}传`);
      expect(facts).toContain(c.zhi);
      expect(facts).toContain(`乘${c.jiang}`);
      expect(facts).toContain(c.relToGan);
    }
  });

  it("课体、取传门、逐步推导链全带", () => {
    expect(facts).toContain(`【课体】${r.sanchuan.keti}`);
    expect(facts).toContain(`取传：${r.sanchuan.gate}`);
    for (const step of r.sanchuan.derivation) expect(facts).toContain(step);
  });

  it("把握程度与门派分歧如实带出，且译成中文不外泄英文标识", () => {
    expect(facts).toContain("【本盘所用规则的把握程度】");
    expect(facts).toContain("【门派分歧·并列呈现，不替问卦人裁决】");
    for (const d of r.disputes) expect(facts).toContain(d);
    for (const bad of ["confirmed", "likely", "disputed", "gate:", "confidence"]) {
      expect(facts.includes(bad), `盘面外泄内部标识 ${bad}`).toBe(false);
    }
  });

  it("所问之事带上；不填则不出现该节", () => {
    expect(facts).toContain("【所问之事（问卦人原话）】下周要去谈一个合作，能谈成吗？");
    expect(build().facts).not.toContain("【所问之事");
  });

  it("盘面排在要求之前（契约可重发，盘面不可）", () => {
    const iFacts = full.indexOf("【月将】");
    const iReq = full.indexOf("解读要求");
    expect(iFacts).toBeGreaterThan(-1);
    expect(iReq).toBeGreaterThan(iFacts);
    expect(full).toContain(facts);
    expect(full).toContain(LIUREN_REQUIREMENTS);
  });
});

describe("六壬解读要求：与梅花那份的本质差别", () => {
  it("不得要求遵守一个本引擎不产出的吉凶档", () => {
    // 梅花有净评六档，所以那份写死「极性不得翻转」；六壬引擎不出档，
    // 搬过来就是逼解读者遵守不存在的判决。
    expect(PLAIN_REQUIREMENTS).toContain("最终极性");
    expect(LIUREN_REQUIREMENTS).not.toContain("最终极性");
    expect(LIUREN_REQUIREMENTS).not.toContain("档名写全");
    expect(LIUREN_REQUIREMENTS).toContain("本课没有现成的吉凶档");
    expect(LIUREN_REQUIREMENTS).toContain("盘面推不出来的吉凶，一个字都不要写");
  });

  it("六壬特有的几条诚实义务都在", () => {
    for (const must of [
      "空亡必须说",
      "初传是事情的发端",
      "一课二课属日干",
      "毕法赋",          // 明令不许凭记忆引未喂入的课经条文
      "把握程度",
      "一说…另一说…",
      "不暗示任何科学预测效力",
    ]) {
      expect(LIUREN_REQUIREMENTS, `六壬要求缺「${must}」`).toContain(must);
    }
  });

  it("沿用梅花那边验证过的几条写法纪律", () => {
    for (const must of ["（依据：…）", "泛断", "不要 JSON", "不是 X，而是 Y"]) {
      expect(LIUREN_REQUIREMENTS, `缺「${must}」`).toContain(must);
    }
    // 宣布式过渡语照样禁
    expect(LIUREN_REQUIREMENTS).toContain("也就是说");
    expect(LIUREN_REQUIREMENTS).toContain("画面是");
  });

  it("要求文本不写死任何一课的内容（换盘复用不会串味）", () => {
    for (const leak of ["乙亥", "重审课", "天后", "六合", "白虎", "太冲"]) {
      expect(LIUREN_REQUIREMENTS.includes(leak), `要求文本含实测课内容「${leak}」`).toBe(false);
    }
  });

  it("导出全文不含任何 LLM provider 痕迹", () => {
    const { full } = build("随便问问");
    for (const bad of ["openai", "OPENAI", "api_key", "apiKey", "sk-", "anthropic"]) {
      expect(full.includes(bad), `导出含 ${bad}`).toBe(false);
    }
  });
});

describe("六壬聊天版（默认导出，2026-10-29）", () => {
  const C = LIUREN_CHAT_REQUIREMENTS;

  it("默认导出 = 盘面在前 + 聊天版；详解版仍可取", () => {
    const out = build("下周要去谈一个合作，能谈成吗？");
    expect(out.chat).toBe(C);
    expect(out.chatFull).toContain(out.facts);
    expect(out.chatFull).toContain(C);
    expect(out.chatFull.indexOf("【月将】")).toBeLessThan(out.chatFull.indexOf("解读要求"));
    expect(out.full).toContain(LIUREN_REQUIREMENTS);
  });

  it("六壬不出吉凶档：结论用走向说，且走向只能从三传帮压与空亡来", () => {
    expect(C.includes("最终极性")).toBe(false);
    expect(C).toContain("本课没有现成的吉凶档");
    expect(C).toContain("盘面推不出来的吉凶，一个字都不要写");
    // 盘面「与日干：…」五种值逐一有处境对照（这是逐字翻译，不是新断法）
    for (const rel of ["生日干＝", "克日干＝", "日干克＝", "日干生＝", "比和＝"]) {
      expect(C, `缺对照「${rel}」`).toContain(rel);
    }
    expect(C).toContain("这一课两可");
    // 天将没有喂入类象原文，只许上色，不许单凭它下好坏
    expect(C).toContain("天将只用来给那一段的场面上色");
    expect(C).toContain("不单凭天将下好坏");
  });

  it("八步顺序写死：先结论，再发展、最需要小心、怎么做", () => {
    let last = -1;
    for (const st of ["① 结论", "② 为什么", "③ 起头", "④ 中途", "⑤ 落脚", "⑥ 最需要小心什么", "⑦ 怎么做", "⑧ 总结"]) {
      const i = C.indexOf(st);
      expect(i, `缺「${st}」`).toBeGreaterThan(last);
      last = i;
    }
  });

  it("与梅花聊天版同一套底线：去标注不去挂靠，诚实义务一条不少", () => {
    for (const must of [
      "不加（依据：…）这类标注", "每一个判断，都必须是盘面推得出来的", "指不出来的判断，删掉",
      "不能用来新增判断", "空亡必须说", "毕法赋", "有两种看法：一种…另一种…",
      "把握程度", "本站六壬不推应期", "不诊断", "不给价位", "放谁身上都对",
      "不暗示任何科学预测效力", "交代自己守规矩的话",
    ]) {
      expect(C, `六壬聊天版缺「${must}」`).toContain(must);
    }
    expect(C.includes("用（依据：…）标出")).toBe(false);
  });

  it("第一轮试解暴露的问题已有对应条文", () => {
    // 两份解读对「空亡叠在帮压上」各自发明了相反推法——盘面没给合算规则，本文也不替它定
    expect(C).toContain("不拿空亡把那一处的帮或压说轻、说重");
    // 苗头所在被当成了压力来源
    expect(C).toContain("苗头在哪一边，不等于压力或帮助出自哪一边");
    // 天将被拿来回答成不成、断定眼下事实；「上色」被照抄进正文
    expect(C).toContain("不拿它回答成不成");
    expect(C).toContain("不拿它断定事情眼下已经是什么状态");
    expect(C).toContain("正文不说「给场面上色」");
    // 课名：原文一处说「不下定义」一处说「当场讲清」，前后矛盾
    expect(C).toContain("课名只报一次名字，不解释");
    expect(C.includes("天将名、课名")).toBe(false);
    // 代占时帮压被挪到问课人身上
    expect(C).toContain("帮、压、被耗、落空始终说成落在那个人身上");
    // 第一句先写了「这一课看的是…」，走向退到第二句
    expect(C).toContain("第一句同时说清管的是哪件事和走向");
    // 做法被写成能把落空变实的承诺
    expect(C).toContain("不说做了就能把落空的那一步变实");
    // 分歧影响范围被转述者缩小
    expect(C).toContain("不改写、不缩小");
  });

  it("第二轮试解暴露的问题已有对应条文", () => {
    // 分歧段塞在②里、满是术语，每张课都拖累口吻（昼夜分歧每张课都有）
    expect(C).toContain("放在⑦之后、⑧之前，单独一两段");
    expect(C).toContain("换成白话或略去");
    // 有帮有压时又额外合算成「整体偏顺」
    expect(C).toContain("不再另外合算成「整体偏顺」「整体偏难」");
    // 第一句仍先复述问题
    expect(C).toContain("✗ 第一句写「你问的是你们还能不能和好。」");
    // 手术课编出暗示病情反复的情节
    expect(C).toContain("不写成暗示病情反复、出意外的情节");
    // 借天将编出问句里没有的前情
    expect(C).toContain("不预设问句里没有的前情");
    // 三处都没落空时花三句解释空亡
    expect(C).toContain("一句「这一课三处都没落空」带过");
  });

  it("第三轮：场面从帮压和空亡长出来，天将只带半句", () => {
    // 三轮试解里的严重失手都出在「围着天将写场面」：太常 → 回到平常来往（暗答能和好），
    // 青龙 → 把病人的落空换成家属手续没办妥
    expect(C).toContain("场面从这一处的帮压和空亡长出来");
    expect(C).toContain("不拿天将当场面的主体");
    expect(C).toContain("不因为配的天将平和就写成「回到正常」「顺下来了」");
    expect(C).toContain("不把那个人的被耗、落空换成家属自己的手续、花销没办妥");
    // 定点复测：同路又没落空的段落盘面上无帮压可写，AI 拿天将填出结局
    expect(C).toContain("同路又没落空的那一段");
    expect(C).toContain("不写成结局停在哪里、关系回到什么样子");
  });

  it("昼夜分歧说明写清影响范围：贵人一换位，十二天将整体跟着变", () => {
    const r = divineLiuren({ at: AT, zhanshi: "亥" });
    const note = r.disputes.find((d) => d.startsWith("昼夜之分"))!;
    expect(note).toContain("十二天将整体跟着变");
    expect(note).toContain("天地盘与三传不变");
    // 旧说法低估了范围，试解中被转述成「只影响一个天将」
    expect(note.includes("只影响贵人昼夜")).toBe(false);
  });

  it("示例不取自试解课", () => {
    for (const leak of [
      "乙亥", "戊寅", "丁未", "重审课", "涉害课", "八专课", "返吟课", "元首课",
      "天后", "六合", "白虎", "太常", "勾陈", "青龙", "太阴", "螣蛇", "朱雀", "玄武",
      "合作", "尾款", "手术", "冷淡",
    ]) {
      expect(C.includes(leak), `六壬聊天版含试解课内容「${leak}」`).toBe(false);
    }
  });
});

describe("六壬导出：换盘不崩", () => {
  it("全时辰 × 多日期扫描，导出都成形且带齐三传", () => {
    for (const zs of DIZHI) {
      for (let d = 0; d < 12; d++) {
        const rr = divineLiuren({ at: new Date(2026, 0, 1 + d * 30, 12, 0), zhanshi: zs });
        const { facts } = buildLiurenPrompt(rr);
        expect(facts).toContain("【三传】");
        expect(facts.split("\n").filter((x) => x.includes("传 ")).length).toBeGreaterThanOrEqual(3);
        expect(facts).toContain("【课体】");
      }
    }
  });
});
