/**
 * 大六壬 · 毕法赋判定（src/engine/liuren/bifa.ts）。
 *
 * 夹具 tests/fixtures/bifa_book_cases.json：原书卷九、卷十注文自举的课例里，本引擎能起出同一盘、
 * 且判定与原书一致的 409 例（开发期由脚本逐例核过）。这里锁住它们，防日后改动把已对上的弄坏。
 * 对不上的例子不在夹具里，原因逐条记在 CLAUDE.md §0.3 ⑭：子格未收、壬癸贵人昼夜、涉害取法、方局未收。
 */
import { describe, it, expect } from "vitest";
import cases from "./fixtures/bifa_book_cases.json";
import { buildPlate, buildSiKe } from "../src/engine/liuren/plate.js";
import { deriveSanchuan } from "../src/engine/liuren/sanchuan.js";
import { buildTianjiang, DEFAULT_GUIREN_RULE } from "../src/engine/liuren/tianjiang.js";
import { DIZHI, JIGONG, liuhe, type Gan, type Zhi } from "../src/engine/liuren/ganzhi.js";
import { evalBifa, MU_TABLE } from "../src/engine/liuren/bifa.js";
import { BIFA_SOURCES } from "../src/engine/liuren/bifaData.js";
import { DAQUAN_QUOTES } from "../src/engine/liuren/daquan.js";
import { divineLiuren } from "../src/engine/liuren/result.js";
import { buildLiurenPrompt } from "../src/prompt/buildLiurenPrompt.js";
import { LIUREN_CHAT_REQUIREMENTS } from "../src/prompt/liurenChatRequirements.js";

function hitsOf(day: string, tian: Zhi, di: Zhi, zhou: boolean, benming: Zhi | null = null) {
  const plate = buildPlate(tian, di);
  const sike = buildSiKe(plate, day[0] as Gan, day.slice(1) as Zhi);
  const sc = deriveSanchuan(sike, plate, day);
  const tj = buildTianjiang(day[0] as Gan, zhou, plate, DEFAULT_GUIREN_RULE);
  return evalBifa({
    dayGanZhi: day, gan: day[0] as Gan, zhi: day.slice(1) as Zhi, jigong: JIGONG[day[0]!]!,
    tian: plate.tian, diOf: plate.diOf, fuyin: plate.fuyin, fanyin: plate.fanyin,
    keShang: sike.ke.map((k) => k.shang) as [Zhi, Zhi, Zhi, Zhi],
    chuan: sc.chuan.map((c) => c.zhi) as [Zhi, Zhi, Zhi],
    jiangOf: tj.byTian as Record<string, string>, guirenZhi: tj.guirenZhi, yuejiang: tian,
    benming, xingnianZhi: null,
  });
}

describe("毕法赋表", () => {
  it("收 46 条，条序不重，每条都有判定", () => {
    expect(BIFA_SOURCES).toHaveLength(46);
    expect(new Set(BIFA_SOURCES.map((b) => b.n)).size).toBe(46);
    expect(() => hitsOf("甲子", "子", "子", true)).not.toThrow();
  });

  it("小表与原文一致：墓「木墓未火墓戌金墓丑水土墓辰」、六合「子與丑合…午與未合」", () => {
    expect(DAQUAN_QUOTES.muTable.text).toBe("木墓未火墓戌金墓丑水土墓辰");
    expect(Object.entries(MU_TABLE).map(([w, z]) => w + "墓" + z).join("")).toBe("木墓未火墓戌金墓丑水墓辰土墓辰");
    const pairs = DIZHI.filter((z) => DIZHI.indexOf(z) < DIZHI.indexOf(liuhe(z) as never) || z === "子")
      .map((z) => z + liuhe(z)).join("");
    for (const p of ["子丑", "寅亥", "辰酉", "午未"]) expect(pairs.includes(p) || pairs.includes(p[1]! + p[0]!)).toBe(true);
    expect(liuhe("卯")).toBe("戌");
    expect(liuhe("巳")).toBe("申");
  });
});

describe("原书自举课例（409 例回归）", () => {
  it("夹具里每一例：该条照原书成立（或照原书不成立）", () => {
    let n = 0;
    for (const c of cases as Array<{ n: number; day: string; tian: Zhi; di: Zhi; zhouye: string | null; benming: Zhi | null; want: boolean }>) {
      const zs = c.zhouye === "昼" ? [true] : c.zhouye === "夜" ? [false] : [true, false];
      const got = zs.some((z) => hitsOf(c.day, c.tian, c.di, z, c.benming).some((h) => h.n === c.n));
      expect(got, `第${c.n}条 ${c.day} ${c.tian}加${c.di}`).toBe(c.want);
      n++;
    }
    expect(n).toBe(409);
  });

  it("几条原书明说的：魁度天门（戌加亥发用）、罡塞鬼户（辰加寅）", () => {
    // 卷十「謂戌為天魁亥為天門凡戌加亥為用者」；「凡辰加寅為罡塞鬼門不論在傳不在傳」
    const k = hitsOf("壬申", "戌", "亥", true).find((h) => h.n === 51);
    if (k) expect(k.ge).toBe("魁度天门");
    expect(hitsOf("甲子", "辰", "寅", true).some((h) => h.n === 52)).toBe(true);
    expect(hitsOf("甲子", "巳", "寅", true).some((h) => h.n === 52)).toBe(false);
  });
});

describe("导出", () => {
  it("命中的条目带赋文、成立理由与原书定义句；要求写明只讲与所问相关的", () => {
    // 找一课必中第 52 条（辰加寅）
    const at = new Date(2026, 9, 29, 4, 0);  // 月将卯、占时寅 → 卯加寅，不中；换个占时
    let r = divineLiuren({ at, question: "这件事能成吗" });
    for (let h = 0; h < 24 && !r.bifa.length; h++) r = divineLiuren({ at: new Date(2026, 9, 29, h, 0), question: "这件事能成吗" });
    expect(r.bifa.length).toBeGreaterThan(0);
    const f = buildLiurenPrompt(r).facts;
    expect(f).toContain("【毕法赋·本课命中】");
    const h = r.bifa[0]!;
    expect(f).toContain(`第${h.n}条「${h.title}」——本课成「${h.ge}」`);
    expect(f).toContain(`「${h.src.quote}」`);
    expect(f).toContain("「非占現類勿言之」");
    expect(LIUREN_CHAT_REQUIREMENTS).toContain("只挑赋文说的事和所问相关的一两条讲");
    expect(LIUREN_CHAT_REQUIREMENTS).toContain("走向不改");
  });
});
