/**
 * 大六壬 · 旺相休囚与六亲（src/engine/liuren/wangxiang.ts、liuqin.ts）。
 * 表由《六壬大全》原文解析而来；原文逐字核对见 `npm run verify:liuren`（要联网，CI 不跑）。
 */
import { describe, it, expect } from "vitest";
import { divineLiuren } from "../src/engine/liuren/result.js";
import { buildLiurenPrompt } from "../src/prompt/buildLiurenPrompt.js";
import { WANGXIANG, wangxiangAt, statesLine } from "../src/engine/liuren/wangxiang.js";
import { liuqinOf, LIUQIN_BASIS } from "../src/engine/liuren/liuqin.js";
import { DAQUAN_QUOTES } from "../src/engine/liuren/daquan.js";
import { LIUREN_CHAT_REQUIREMENTS } from "../src/prompt/liurenChatRequirements.js";
import { LIUREN_REQUIREMENTS } from "../src/prompt/liurenRequirements.js";

describe("旺相休囚死（卷五 6a–6b 原文解析）", () => {
  it("五季全表：季月之死由卷七「我克者為死」补出（水死）", () => {
    expect(statesLine(WANGXIANG.春)).toBe("木旺 火相 水休 金囚 土死");
    expect(statesLine(WANGXIANG.夏)).toBe("火旺 土相 木休 水囚 金死");
    expect(statesLine(WANGXIANG.秋)).toBe("金旺 水相 土休 火囚 木死");
    expect(statesLine(WANGXIANG.冬)).toBe("水旺 木相 金休 土囚 火死");
    expect(statesLine(WANGXIANG.季)).toBe("土旺 金相 火休 木囚 水死");
  });

  it("月建按节：惊蛰前仍是寅月（春）；辰月是季月", () => {
    expect(wangxiangAt(new Date(2026, 2, 1, 12)).yuejian).toBe("寅");
    expect(wangxiangAt(new Date(2026, 2, 1, 12)).season).toBe("春");
    expect(wangxiangAt(new Date(2026, 3, 20, 12)).season).toBe("季");
  });

  it("季月前段并列卷八「四立前十八日土旺」一说；进入十八日内就不再并列", () => {
    const early = wangxiangAt(new Date(2026, 3, 8, 10));   // 距立夏（5/5）27 日
    expect(early.season).toBe("季");
    expect(early.alt).toMatchObject({ season: "春", li: "立夏", days: 27 });
    expect(wangxiangAt(new Date(2026, 3, 20, 12)).alt).toBeNull();  // 距立夏 15 日
    expect(wangxiangAt(new Date(2026, 5, 1, 12)).alt).toBeNull();   // 巳月，非季月

    const r = divineLiuren({ at: new Date(2026, 3, 8, 10) });
    expect(r.disputes.join("")).toContain("土守中宫分旺四季毎季前各旺十八日");
    expect(r.disputes.join("")).toContain("按此说仍属春季：木旺 火相 水休 金囚 土死");
  });
});

describe("六亲（以日干为我）", () => {
  it("五种关系换成原书名目", () => {
    expect(["生日干", "比和", "日干生", "日干克", "克日干"].map(liuqinOf))
      .toEqual(["父母", "兄弟", "子孙", "妻财", "官鬼"]);
    expect(() => liuqinOf("—")).toThrow();
  });

  it("所指只收原书写出的三类，子孙、官鬼不补", () => {
    expect(LIUQIN_BASIS.父母.zhi?.text).toBe("父母長上及文書");
    expect(LIUQIN_BASIS.兄弟.zhi?.text).toBe("已身兄弟及同類爭財事");
    expect(LIUQIN_BASIS.妻财.zhi?.text).toBe("妻奴及婚姻財産事");
    expect(LIUQIN_BASIS.子孙.zhi).toBeNull();
    expect(LIUQIN_BASIS.官鬼.zhi).toBeNull();
  });
});

describe("导出：三传带六亲与旺衰，依据逐字带出", () => {
  const r = divineLiuren({ at: new Date(2026, 3, 8, 10), question: "下周的合作能谈成吗？" });
  const out = buildLiurenPrompt(r);

  it("每一传都标六亲与旺衰；【旺相休囚】【六亲·有出处】两节都在", () => {
    for (const c of r.chuanDetail) {
      expect(out.facts).toContain(`与日干：${c.relToGan}（六亲：${c.liuqin}）　旺衰：${c.qi}`);
    }
    expect(out.facts).toContain("【旺相休囚】月建 辰，季月（土旺）：土旺 金相 火休 木囚 水死。日干 壬（水）：死。");
    expect(out.facts).toContain("【六亲·有出处】");
    for (const k of ["wang", "xiang", "si", "qiu", "xiu", "siRule", "youqi", "wuqi", "fangCi"] as const) {
      expect(out.facts).toContain(`「${DAQUAN_QUOTES[k].text}」`);
    }
  });

  it("只列三传里出现的六亲", () => {
    const shown = ["父母", "兄弟", "子孙", "妻财", "官鬼"].filter((x) => out.facts.includes(`  · ${x}（`));
    expect(new Set(shown)).toEqual(new Set(r.chuanDetail.map((c) => c.liuqin)));
  });

  it("解读要求：旺衰只论力量、不当断语；六亲只照所指原句；术语不进正文", () => {
    const C = LIUREN_CHAT_REQUIREMENTS;
    expect(C).toContain("「死」「囚」「休」只是力量强弱的名目，不说成死亡、官司、生病");
    expect(C).toContain("只照那一节写出的「所指」原句说");
    expect(C).toContain("六亲、官鬼、妻财、子孙、旺相、休囚、月建");
    expect(C).toContain("【天将类象·有出处】【六亲·有出处】【旺相休囚】【类神·有出处】【年命】给出的原句");
    expect(LIUREN_REQUIREMENTS).toContain("「死」「囚」「休」不讲成死亡、官司、疾病");
    expect(LIUREN_REQUIREMENTS).toContain("没写所指的不补");
  });
});
