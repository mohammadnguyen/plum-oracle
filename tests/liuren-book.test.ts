/**
 * 大六壬 · 《六壬大全》原书课例。
 *
 * 2026-10-29 用户决定涉害、八专全面对齐《六壬大全》（见 CLAUDE.md §0.3 ⑧）。
 * 本文件把卷五里写明了答案的课例逐条锁死：哪一课、各克神几重、初传是谁、三传是什么。
 * 引文页码按四库全书文渊阁本（kanripo KR3g0031，卷五 = KR3g0031_005.txt 的 <pb:…> 页标）。
 *
 * 原书没有写明答案的部分（比如「比用格」在多数课上会怎么取）不在这里断言——
 * 本软件不采比用格，只在盘面并列；这里只核它在原书举过的几课上并列出来的正是原书的答案。
 */
import { describe, it, expect } from "vitest";
import { JIAZI, DIZHI, type Gan, type Zhi } from "../src/engine/liuren/ganzhi.js";
import { buildPlate, buildSiKe } from "../src/engine/liuren/plate.js";
import {
  deriveSanchuan, isBazhuan, shehaiDepth,
  BAZHUAN_ALT_YAOKE, SHEHAI_ALT_BIYONG, SHEHAI_ALT_MENGZHONG,
} from "../src/engine/liuren/sanchuan.js";

/** 天盘某支加地盘某支（即月将加占时）。 */
function ke(day: string, tian: string, di: string) {
  const plate = buildPlate(tian, di);
  const sike = buildSiKe(plate, day[0] as Gan, day.slice(1) as Zhi);
  const sc = deriveSanchuan(sike, plate, day);
  return { plate, sike, sc, chuan: sc.chuan.map((c) => c.zhi).join("") };
}

/** 某克神的涉害深浅：重数与途经记重的字。 */
function depthOf(day: string, tian: string, di: string, shang: string) {
  const { plate, sike } = ke(day, tian, di);
  const k = sike.ke.find((x) => x.shang === shang && (x.xiaZeiShang || x.shangKeXia));
  expect(k, `${day} ${tian}加${di}：${shang} 不是克神`).toBeTruthy();
  const d = shehaiDepth(k!, plate);
  return `${d.n}:${d.hits.join("")}`;
}

describe("涉害·计深浅（卷五订讹 20b、观月经 22a）", () => {
  it("丁卯日丑时亥将：亥加丑历辰戊未己戌五重，丑加卯只历乙一重，取亥", () => {
    // 20b「丁卯日丑加卯亥加丑兩下尅上俱與隂日比丑加卯木前行歴辰中乙木一重……亥加丑土前行歴辰戊未巳戌土五重」
    // 原书「巳戌」之「巳」即寄于未的己土（巳/己形近），按位次是 辰、戊(寄巳)、未、己(寄未)、戌。
    expect(depthOf("丁卯", "亥", "丑", "亥")).toBe("5:辰戊未己戌");
    expect(depthOf("丁卯", "亥", "丑", "丑")).toBe("1:乙");
    const r = ke("丁卯", "亥", "丑");
    expect(r.chuan).toBe("亥酉未");            // 16b 课图：亥 酉 未
    expect(r.sc.keti).toBe("涉害课");
  });

  it("庚子日申加戌：午加庚历酉辛二重，戌加子历癸一重，取午", () => {
    // 20b「午加庚金前行歴酉辛金二重……戌加子水前行歴癸水一重……二重者較一重為深取午發用」
    expect(depthOf("庚子", "申", "戌", "午")).toBe("2:酉辛");
    expect(depthOf("庚子", "申", "戌", "戌")).toBe("1:癸");
    expect(ke("庚子", "申", "戌").chuan).toBe("午辰寅");   // 17b 四月庚子日戌時申將课图
  });

  it("甲辰日亥将卯时：子加辰四重，戌加寅二重，取子（观月经「用戌者非也」）", () => {
    // 22a「河魁加寅……前頭一重卯木二重乙木」「神后加辰……巳上戊土未土未上巳土前又戌土共四重」
    expect(depthOf("甲辰", "亥", "卯", "戌")).toBe("2:卯乙");
    expect(depthOf("甲辰", "亥", "卯", "子")).toBe("4:戊未己戌");
    expect(ke("甲辰", "亥", "卯").chuan).toBe("子申辰");   // 19b「三傳子申辰」
  });

  it("起讫两端都不数：所乘之位与本家上寄的干一概不计", () => {
    // 19a 甲午日「辰加寅卯木一重」：所乘的寅（连同寄寅的甲）不数，本家辰上寄的乙也不数
    expect(depthOf("甲午", "午", "辰", "辰")).toBe("1:卯");
    expect(depthOf("甲午", "午", "辰", "申")).toBe("1:丁");
  });

  it("乙卯日寅时子将：取亥，三传亥酉未（20a）", () => {
    expect(ke("乙卯", "子", "寅").chuan).toBe("亥酉未");
  });
});

describe("涉害·深浅相等（卷五订讹 21a–21b）", () => {
  it("庚戌日辰时申将：辰寅各一重，辰临子（仲）、寅临戌（季），取辰为察微", () => {
    // 18a「以辰加子四仲位用曰察㣲格」
    expect(depthOf("庚戌", "申", "辰", "辰")).toBe("1:癸");
    expect(depthOf("庚戌", "申", "辰", "寅")).toBe("1:丑");
    const r = ke("庚戌", "申", "辰");
    expect(r.chuan).toBe("辰申子");
    expect(r.sc.keti).toBe("涉害课·察微");
  });

  it("甲午日辰时午将：辰申各一重，取辰，三传辰午申", () => {
    // 19a 原书此例名「缀瑕」（复等）；按同卷订讹「渉害俱深則取四孟上神」，辰临寅（孟）即可定，
    // 本软件课体名照订讹作「见机」。初传与三传两种叫法一致。
    const r = ke("甲午", "午", "辰");
    expect(r.chuan).toBe("辰午申");
    expect(r.sc.keti).toBe("涉害课·见机");
  });
});

describe("涉害·并列两说（不采，只列）", () => {
  it("取出不同三传时盘面写明，并把本盘把握程度降为 disputed", () => {
    // 丁卯日丑时亥将：不计深浅、只看孟仲季，丑临卯（仲）会取丑
    const r = ke("丁卯", "亥", "丑");
    expect(r.sc.altNotes.some((n) => n.startsWith(SHEHAI_ALT_MENGZHONG) && n.includes("丑→亥→酉"))).toBe(true);
    expect(r.sc.confidence).toBe("disputed");
  });

  it("与本法取得一样的并列说法不列", () => {
    // 庚戌日辰时申将：孟仲季直取也是辰，比用格不触发（辰土生庚金）
    const r = ke("庚戌", "申", "辰");
    expect(r.sc.altNotes).toEqual([]);
    expect(r.sc.confidence).toBe("likely");
  });

  it("比用格：在原书举过的几课上，并列出来的正是原书答案（19b）", () => {
    // 19b「如甲戌日論孟用辰加寅辰土畏甲木克則取子加戌子生甲木比者為用也」
    // 「戊子日午卯子壬戌日申丑午庚子日戌申午……皆用比不用渉害」
    const cases: Array<[string, string, string, string, string]> = [
      ["甲戌", "子", "戌", "辰午申", "子"],
      ["戊子", "卯", "午", "寅亥申", "午→卯→子"],
      ["壬戌", "丑", "申", "辰酉寅", "申→丑→午"],
      ["庚子", "申", "戌", "午辰寅", "戌→申→午"],
    ];
    for (const [day, t, d, ours, theirs] of cases) {
      const r = ke(day, t, d);
      expect(r.chuan, `${day} ${t}加${d}`).toBe(ours);
      const note = r.sc.altNotes.find((n) => n.startsWith(SHEHAI_ALT_BIYONG));
      expect(note, `${day} 应并列比用格`).toBeTruthy();
      expect(note).toContain(theirs.length === 1 ? `当取 ${theirs} 发用` : theirs);
    }
  });

  it("庚子日一例：比用格与同卷订讹相反，盘面两边都写出来", () => {
    // 订讹 20b 取午；比用格 19b 列「庚子日戌申午」。本软件取午，比用格并列
    const r = ke("庚子", "申", "戌");
    expect(r.chuan[0]).toBe("午");
    expect(r.sc.altNotes.join("")).toContain("戌→申→午");
  });
});

describe("八专（卷五 38a–42a）", () => {
  it("八专日只有五日：甲寅、丁未、己未、庚申、癸丑", () => {
    // 38a「八專日有五」；41b 观月经注「五日者癸丑甲寅丁未己未庚申是也」
    const days = JIAZI.filter((gz) => {
      const p = buildPlate("子", "子");
      return isBazhuan(buildSiKe(p, gz[0] as Gan, gz.slice(1) as Zhi));
    });
    expect([...days].sort()).toEqual(["丁未", "己未", "庚申", "甲寅", "癸丑"].sort());
  });

  it("癸丑日十二局都有克，从不走到八专取法（38a「除癸丑日俱有克」）", () => {
    for (const j of DIZHI) expect(ke("癸丑", j, "子").sc.gate).not.toBe("八专");
  });

  it("四课无克即取八专，有遥克也不取遥克——原书四例", () => {
    const cases: Array<[string, string, string, string, string]> = [
      ["甲寅", "丑", "辰", "丑亥亥", "39a 甲寅日辰時丑將"],
      ["己未", "酉", "未", "酉酉酉", "40a 己未日未時酉將"],
      ["庚申", "亥", "申", "丑亥亥", "41b 观月经 庚申亥將申時"],
      ["己未", "亥", "酉", "酉酉酉", "42a 观月经 己未日亥將酉時"],
    ];
    for (const [day, t, d, want, src] of cases) {
      const r = ke(day, t, d);
      expect(r.chuan, src).toBe(want);
      expect(r.sc.gate, src).toBe("八专");
      // 四例都另有遥克可取：订讹「八專無克又無遥克」一说据此会走遥克，盘面并列
      expect(r.sc.altNotes.some((n) => n.startsWith(BAZHUAN_ALT_YAOKE)), src).toBe(true);
      expect(r.sc.confidence, src).toBe("disputed");
    }
  });

  it("丁未日丑时辰将：无克也无遥克，亥戌戌，不报遥克分歧（39b）", () => {
    const r = ke("丁未", "辰", "丑");
    expect(r.chuan).toBe("亥戌戌");
    expect(r.sc.altNotes).toEqual([]);
  });

  it("独足只给三传同归一神的那几课", () => {
    expect(ke("己未", "酉", "未").sc.keti).toBe("八专课·独足");
    expect(ke("甲寅", "丑", "辰").sc.keti).toBe("八专课");
  });
});
