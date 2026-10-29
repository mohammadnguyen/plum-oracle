/**
 * 大六壬 · 与独立实现对拍。
 *
 * 六壬在本仓库里没有源本（不像梅花有 `《梅花易数》.txt` 可标行号）。方法保真靠的是
 * **与现成排盘实现逐字段比对**：夹具取自 dcbazi.com 的排盘站（独立实现，自带
 * yice-liuren.js），只采它自报的「日干支 / 占时 / 月将」，不采它的日期换算，
 * 所以这一轮比的纯粹是六壬算法本身，与历法处理无关。
 *
 * 比对四层：天地盘旋转、遁干与旬空、十二天将环布、三传发用。
 * 其中三传是最容易错、也最看不出错的一层——本次对拍即抓出一处真 bug：
 * 涉害「见机/察微」的孟仲季，看的是该神**所乘的地盘位**，不是神本身。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dunGan, xunKong, JIAZI, type Gan, type Zhi } from "../src/engine/liuren/ganzhi.js";
import { buildPlate, buildSiKe, isZhou } from "../src/engine/liuren/plate.js";
import { deriveSanchuan } from "../src/engine/liuren/sanchuan.js";
import { buildTianjiang } from "../src/engine/liuren/tianjiang.js";

interface Case {
  day: string; shi: Zhi; yj: Zhi; gui: Zhi;
  chuan: [string, string, string];
  /** 第二轮只记三传（专攻分支覆盖），没抓天地盘 */
  ring?: Record<string, [string, string, string]>;
  /** 该组走到的宗门分支，供覆盖率断言 */
  branch?: string;
  /** true = 另经第二家独立实现确认 */
  both?: boolean;
}
const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/liuren_crosscheck.json", import.meta.url)), "utf-8"),
) as { cases: Case[] };
const CASES = fixture.cases;
/** 带天地盘的组（第一轮），逐格比对用 */
const RING_CASES = CASES.filter((c) => c.ring);

/** 夹具里的日干支必须是真干支，否则夹具本身就抄错了。 */
function parseDay(day: string): { gan: Gan; zhi: Zhi } {
  expect(JIAZI, `夹具日干支 ${day} 不在六十甲子内`).toContain(day);
  return { gan: day[0]! as Gan, zhi: day.slice(1) as Zhi };
}

/** 由对方给出的贵人支反推它用的是昼贵还是夜贵，从而把天将布局单独拿出来比。 */
function zhouFromGuiren(gan: Gan, gui: Zhi, plate: ReturnType<typeof buildPlate>): boolean | null {
  for (const zhou of [true, false]) {
    if (buildTianjiang(gan, zhou, plate).guirenZhi === gui) return zhou;
  }
  return null;
}

describe(`大六壬对拍（${CASES.length} 组，其中 ${RING_CASES.length} 组带全盘）`, () => {
  it("夹具自洽：日干支合法、十二地盘齐全、三传三位", () => {
    for (const c of CASES) {
      parseDay(c.day);
      if (c.ring) expect(Object.keys(c.ring), `${c.day}${c.shi} 地盘不足十二位`).toHaveLength(12);
      expect(c.chuan).toHaveLength(3);
    }
  });

  it("天地盘逐格一致（月将加占时）", () => {
    const bad: string[] = [];
    for (const c of RING_CASES) {
      const p = buildPlate(c.yj, c.shi);
      for (const [di, [tian]] of Object.entries(c.ring!)) {
        if (p.tian[di] !== tian) bad.push(`${c.day}${c.shi}时 月将${c.yj}：地盘${di} 对方=${tian} 我方=${p.tian[di]}`);
      }
    }
    expect(bad, bad.slice(0, 8).join("\n")).toEqual([]);
  });

  it("遁干与旬空逐字一致（〇 = 旬空无遁干）", () => {
    const bad: string[] = [];
    for (const c of RING_CASES) {
      const p = buildPlate(c.yj, c.shi);
      for (const [di, [tian, dun]] of Object.entries(c.ring!)) {
        expect(p.tian[di]).toBe(tian);
        const mine = dunGan(c.day, tian) ?? "〇";
        if (mine !== dun) bad.push(`${c.day}：天盘${tian} 对方遁=${dun} 我方=${mine}`);
      }
      // 空亡两支必须正好是对方标〇的那两支所乘之位
      const kongTian = Object.values(c.ring!).filter(([, d]) => d === "〇").map(([t]) => t).sort();
      expect(kongTian, `${c.day} 旬空支不符`).toEqual([...xunKong(c.day).kongwang].sort());
    }
    expect(bad, bad.slice(0, 8).join("\n")).toEqual([]);
  });

  it("十二天将逐格一致（贵人起例「甲戊庚牛羊」+ 临亥至辰顺布）", () => {
    const bad: string[] = [];
    for (const c of RING_CASES) {
      const { gan } = parseDay(c.day);
      const p = buildPlate(c.yj, c.shi);
      const zhou = zhouFromGuiren(gan, c.gui, p);
      expect(zhou, `${c.day}：贵人 ${c.gui} 在我方昼夜两表里都找不到——贵人起例对不上`).not.toBeNull();
      const t = buildTianjiang(gan, zhou!, p);
      for (const [di, [tian, , jiang]] of Object.entries(c.ring!)) {
        if (t.byTian[tian] !== jiang) {
          bad.push(`${c.day}${c.shi}时：${tian}（居${di}）对方=${jiang} 我方=${t.byTian[tian]}`);
        }
      }
    }
    expect(bad, bad.slice(0, 8).join("\n")).toEqual([]);
  });

  it("三传逐传一致（含发用、次第、遁干）", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const { gan, zhi } = parseDay(c.day);
      const p = buildPlate(c.yj, c.shi);
      const s = buildSiKe(p, gan, zhi);
      const r = deriveSanchuan(s, p, c.day);
      const mine = r.chuan.map((x) => `${x.dun ?? "〇"}${x.zhi}`);
      if (mine.join("|") !== c.chuan.join("|")) {
        bad.push(
          `${c.day} ${c.shi}时 月将${c.yj}：对方=${c.chuan.join("、")} 我方=${mine.join("、")}` +
          `（${r.keti}）\n    推导：${r.derivation.join(" / ")}`,
        );
      }
    }
    expect(bad, `三传不一致 ${bad.length}/${CASES.length} 组：\n` + bad.slice(0, 6).join("\n")).toEqual([]);
  });

  it("宗门覆盖：九门全部被对拍走到，不许有分支从没被验证过", () => {
    const gates = new Set<string>();
    const keti = new Set<string>();
    for (const c of CASES) {
      const { gan, zhi } = parseDay(c.day);
      const p = buildPlate(c.yj, c.shi);
      const r = deriveSanchuan(buildSiKe(p, gan, zhi), p, c.day);
      gates.add(r.gate);
      keti.add(r.keti);
    }
    // 九宗门一个都不能缺——缺了就说明那条分支至今没有任何外部实现核过
    for (const g of ["贼克", "比用", "涉害", "遥克", "昴星", "别责", "八专", "伏吟", "返吟"]) {
      expect(gates.has(g), `宗门「${g}」未被对拍覆盖`).toBe(true);
    }
    // 几个易错的细分课体也要确实走到
    for (const k of ["涉害课·见机", "涉害课·察微", "昴星课·虎视转蓬", "昴星课·冬蛇掩目",
      "别责课（芜淫）", "八专课", "返吟课·无依（井栏射）"]) {
      expect([...keti].some((x) => x === k), `课体「${k}」未被对拍覆盖`).toBe(true);
    }
  });

  it("经第二家独立实现复核的组，逐传一致（两家一致才算站得住）", () => {
    const both = CASES.filter((c) => c.both);
    expect(both.length, "应有经两家复核的样本").toBeGreaterThanOrEqual(3);
    for (const c of both) {
      const { gan, zhi } = parseDay(c.day);
      const p = buildPlate(c.yj, c.shi);
      const r = deriveSanchuan(buildSiKe(p, gan, zhi), p, c.day);
      expect(
        r.chuan.map((x) => `${x.dun ?? "〇"}${x.zhi}`),
        `${c.day}${c.shi}时（${c.branch}）两家一致，我方须同`,
      ).toEqual(c.chuan);
    }
  });

  it("昼夜取法（卯申为界）与对方一致——分歧只出在壬癸贵人表那一条", () => {
    // 第一步：按本软件默认表比，若有差异必须**全部**落在壬癸日。
    // （否则说明分歧的根不在贵人表，而在昼夜规则本身，那是另一回事。）
    const underDefault: string[] = [];
    for (const c of CASES) {
      const { gan } = parseDay(c.day);
      const p = buildPlate(c.yj, c.shi);
      const theirs = zhouFromGuiren(gan, c.gui, p);
      if (theirs === null) underDefault.push(`${c.day}${c.shi}时(贵人表查无)`);
      else if (theirs !== isZhou(c.shi)) underDefault.push(`${c.day}${c.shi}时`);
    }
    expect(
      underDefault.every((x) => x.startsWith("壬") || x.startsWith("癸")),
      `差异应只在壬癸日，实际：${underDefault.join("、")}`,
    ).toBe(true);

    // 第二步：改用对方的壬癸口径（昼巳夜卯）再比，昼夜判定应当全部吻合。
    // 全吻合即证明：分歧在贵人表，不在「卯申为界」这条昼夜规则。
    const theirRule = { geng: "同甲戊", rengui: "昼巳夜卯" } as const;
    const mismatch: string[] = [];
    for (const c of CASES) {
      const { gan } = parseDay(c.day);
      const p = buildPlate(c.yj, c.shi);
      let theirs: boolean | null = null;
      for (const zhou of [true, false]) {
        if (buildTianjiang(gan, zhou, p, theirRule).guirenZhi === c.gui) theirs = zhou;
      }
      if (theirs !== isZhou(c.shi)) {
        mismatch.push(
          `${c.day} ${c.shi}时：对方=${theirs === null ? "查无" : theirs ? "昼" : "夜"}，我方=${isZhou(c.shi) ? "昼" : "夜"}`,
        );
      }
    }
    expect(mismatch, mismatch.join("; ")).toEqual([]);
  });
});
