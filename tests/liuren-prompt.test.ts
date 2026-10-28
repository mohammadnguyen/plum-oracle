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
