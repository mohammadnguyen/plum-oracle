/**
 * 大六壬 · 类神与年命（src/engine/liuren/leishen.ts、nianming.ts）。
 * 原文逐字核对见 `npm run verify:liuren`。
 */
import { describe, it, expect } from "vitest";
import { divineLiuren } from "../src/engine/liuren/result.js";
import { buildLiurenPrompt } from "../src/prompt/buildLiurenPrompt.js";
import { detectLeishen, LEISHEN, readLeishen, type LsBoard } from "../src/engine/liuren/leishen.js";
import { birthLunarYear, xingnian, xusui } from "../src/engine/liuren/nianming.js";
import type { Liuqin } from "../src/engine/liuren/liuqin.js";
import type { Zhi } from "../src/engine/liuren/ganzhi.js";
import { LIUREN_CHAT_REQUIREMENTS } from "../src/prompt/liurenChatRequirements.js";
import { LIUREN_REQUIREMENTS } from "../src/prompt/liurenRequirements.js";

describe("行年（卷六 23a）", () => {
  it("原书两例：男四十九在甲寅，女三十四在己亥", () => {
    expect(xingnian(49, "男")).toBe("甲寅");
    expect(xingnian(34, "女")).toBe("己亥");
    expect(xingnian(1, "男")).toBe("丙寅");
    expect(xingnian(1, "女")).toBe("壬申");
    expect(xingnian(61, "男")).toBe("丙寅");
  });

  it("生肖定出生农历年：生肖与公历年支不同即生在春节前", () => {
    expect(birthLunarYear(1990, "午")).toBe(1990);
    expect(birthLunarYear(1990, "巳")).toBe(1989);
    expect(() => birthLunarYear(1990, "子")).toThrow();
  });

  it("虚岁按春节换岁", () => {
    expect(xusui(new Date(2026, 9, 29, 12), 1990, "午")).toBe(37);
    expect(xusui(new Date(2026, 9, 29, 12), 1990, "巳")).toBe(38);
    // 2026 年春节在 2 月 17 日：之前仍是乙巳年
    expect(xusui(new Date(2026, 1, 10, 12), 1990, "午")).toBe(36);
  });
});

describe("类神归类（只作默认，界面可改）", () => {
  it("按问句给默认类别", () => {
    expect(detectLeishen("客户欠的那笔货款，这个月能收回来吗？")?.id).toBe("qiucai");
    expect(detectLeishen("下周的考试能过吗")?.id).toBe("qiuming");
    expect(detectLeishen("男朋友对我是不是真心的？")?.id).toBe("hun");
    expect(detectLeishen("我妈这次住院能好起来吗")?.id).toBe("mu");
    expect(detectLeishen("明天出差路上顺不顺")?.id).toBe("lu");
    expect(detectLeishen("最近怎么样")).toBeNull();
  });

  it("疾病、官讼、父亲不在表里（原书口诀未列，或要用本站未算的神煞）", () => {
    const labels = LEISHEN.map((c) => c.label).join("");
    expect(/疾病|官讼|父亲/.test(labels)).toBe(false);
  });
});

describe("类神取用之法（卷八 60a–60b）", () => {
  // 造一张最小的盘：天盘子加地盘子（伏吟），天将随手排，方便控制谁在课传
  const zhis: Zhi[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const id = Object.fromEntries(zhis.map((z) => [z, z])) as Record<string, Zhi>;
  const board = (jiangOf: Record<string, string>, chuan: Zhi[], qin: Partial<Record<Zhi, Liuqin>> = {}): LsBoard => ({
    tian: id, diOf: id, jiangOf, keShang: [], chuan, liuqinOf: (z) => qin[z] ?? "兄弟",
  });
  const cai = LEISHEN.find((c) => c.id === "qiucai")!;  // 青龙 + 财爻

  it("只有一神入课传：取入的那一个", () => {
    const r = readLeishen(cai, board({ 辰: "青龙" }, ["子", "午", "戌"], { 子: "妻财" }));
    expect(r.chosen.map((h) => h.name)).toEqual(["财爻"]);
    expect(r.why).toContain("以入傳課為取用");
  });

  it("都入或都不入：不用兼神，只取将神（青龙）", () => {
    const none = readLeishen(cai, board({ 辰: "青龙" }, ["子", "午", "戌"]));
    expect(none.chosen.map((h) => h.name)).toEqual(["青龙"]);
    expect(none.chosen[0]!.inKeChuan).toBe(false);
    const both = readLeishen(cai, board({ 子: "青龙" }, ["子", "午", "戌"], { 午: "妻财" }));
    expect(both.chosen.map((h) => h.name)).toEqual(["青龙"]);
    expect(both.why).toContain("皆入皆不入不用兼神責將神");
  });
});

describe("导出", () => {
  const at = new Date(2026, 9, 29, 16, 0);
  const q = "客户欠的那笔货款，这个月能收回来吗？";

  it("按问句自动取类神；指定 null 则整节不出现", () => {
    const a = buildLiurenPrompt(divineLiuren({ at, question: q }));
    expect(a.facts).toContain("【类神·有出处】所问归为「求财」（程序按问句自动归类，问课人可改）");
    expect(a.facts).toContain("口诀「求財青龍財爻通」");
    expect(a.facts).toContain("【取用】");
    const b = buildLiurenPrompt(divineLiuren({ at, question: q, leishen: null }));
    expect(b.facts.includes("【类神")).toBe(false);
  });

  it("填了年命才有【年命】节，带行年依据与原书例", () => {
    const r = divineLiuren({ at, question: q, nianming: { birthYear: 1990, benming: "午", gender: "男" } });
    const f = buildLiurenPrompt(r).facts;
    expect(f).toContain("【年命】问课人填写：男，虚岁 37");
    expect(f).toContain("· 本命 午：地盘 午 上神");
    expect(f).toContain("· 行年 壬寅：地盘 寅 上神");
    expect(f).toContain("「男行年一嵗起丙寅」");
    expect(f).toContain("「日上三傳本命行年六處最𦂳」");
    expect(buildLiurenPrompt(divineLiuren({ at, question: q })).facts.includes("【年命】")).toBe(false);
  });

  it("两版要求交代类神、年命的用法与禁词", () => {
    expect(LIUREN_CHAT_REQUIREMENTS).toContain("只看标【取用】的那一个");
    expect(LIUREN_CHAT_REQUIREMENTS).toContain("「德合」本站没算，不说");
    expect(LIUREN_CHAT_REQUIREMENTS).toContain("类神、本命、行年、局外");
    expect(LIUREN_REQUIREMENTS).toContain("7c. 类神只看标【取用】的那一个");
    expect(LIUREN_REQUIREMENTS).toContain("7d. 年命");
  });
});
