/**
 * 大六壬引擎 · 结构性断言。
 *
 * 这一轮只断言**结构上不可能有别解**的部分：干支基础、寄宫、旬空、天地盘旋转、
 * 四课取法、伏吟返吟的判定、天将环布的完整性、纯函数性。
 *
 * 三传九宗门的**取值**正确性不在这里断言——那要靠与现成排盘站的逐组对拍
 * （见 LIUREN_STATUS.md）。在对拍通过之前，涉害/八专/昴星/别责的具体取值
 * 一律标 likely / disputed，不假装已验证。
 */
import { describe, it, expect } from "vitest";
import {
  DIZHI, JIGONG, JIAZI, TIANGAN, ZHI_WUXING, GAN_WUXING,
  chong, dunGan, ganYang, liuhe, sanhe, xunKong, zhiAt, zhiIndex,
} from "../src/engine/liuren/ganzhi.js";
import { buildPlate, buildSiKe, isZhou } from "../src/engine/liuren/plate.js";
import { ZHONGQI_TO_JIANG, JIANG_NAME, yuejiangAt } from "../src/engine/liuren/yuejiang.js";
import { buildTianjiang, TIANJIANG } from "../src/engine/liuren/tianjiang.js";
import { CONFIDENCE, XING, yima } from "../src/engine/liuren/sanchuan.js";
import { divineLiuren } from "../src/engine/liuren/result.js";

describe("干支基础", () => {
  it("六十甲子首尾与长度", () => {
    expect(JIAZI).toHaveLength(60);
    expect(JIAZI[0]).toBe("甲子");
    expect(JIAZI[59]).toBe("癸亥");
    expect(new Set(JIAZI).size).toBe(60);
  });

  it("日干寄宫：十干齐全，丙戊同寄巳、丁己同寄未", () => {
    for (const g of TIANGAN) expect(JIGONG[g], `${g} 无寄宫`).toBeTruthy();
    expect(JIGONG["丙"]).toBe("巳");
    expect(JIGONG["戊"]).toBe("巳");
    expect(JIGONG["丁"]).toBe("未");
    expect(JIGONG["己"]).toBe("未");
    expect(JIGONG["甲"]).toBe("寅");
    expect(JIGONG["庚"]).toBe("申");
    expect(JIGONG["壬"]).toBe("亥");
    expect(JIGONG["癸"]).toBe("丑");
  });

  it("旬空：六旬各空两支，且空支必不在本旬十日内", () => {
    const seen = new Map<string, string>();
    for (const gz of JIAZI) {
      const { xunshou, kongwang } = xunKong(gz);
      expect(kongwang).toHaveLength(2);
      // 同旬十日，旬首与空亡必须一致
      if (seen.has(xunshou)) expect(seen.get(xunshou)).toBe(kongwang.join(""));
      else seen.set(xunshou, kongwang.join(""));
      // 空支在本旬内遁不出天干
      for (const k of kongwang) expect(dunGan(gz, k), `${gz} 旬空 ${k} 不该遁出干`).toBeNull();
    }
    expect(seen.size).toBe(6);
    expect(xunKong("甲子").kongwang).toEqual(["戌", "亥"]);
    expect(xunKong("癸酉").kongwang).toEqual(["戌", "亥"]);   // 甲子旬末日
    expect(xunKong("甲戌").kongwang).toEqual(["申", "酉"]);
    expect(xunKong("甲寅").kongwang).toEqual(["子", "丑"]);
  });

  it("遁干：本旬十日逐日遁出的干与六十甲子一致", () => {
    for (const gz of JIAZI) {
      const g = gz[0]!, z = gz.slice(1);
      expect(dunGan(gz, z), `${gz} 自身应遁出 ${g}`).toBe(g);
    }
  });

  it("冲、合、三合自洽", () => {
    for (const z of DIZHI) {
      expect(chong(chong(z))).toBe(z);
      expect(liuhe(liuhe(z))).toBe(z);
      const [a, b] = sanhe(z);
      expect(new Set([z, a, b]).size).toBe(3);
      // 三合三支五行相同的局：互为 ±4
      expect(sanhe(a)).toContain(z);
    }
    expect(chong("子")).toBe("午");
    expect(liuhe("子")).toBe("丑");
    expect(liuhe("寅")).toBe("亥");
    expect(sanhe("申").sort()).toEqual(["子", "辰"].sort());
  });

  it("三刑成环，辰午酉亥自刑", () => {
    for (const z of ["辰", "午", "酉", "亥"]) expect(XING[z]).toBe(z);
    expect(XING["寅"]).toBe("巳");
    expect(XING["巳"]).toBe("申");
    expect(XING["申"]).toBe("寅");
    expect(XING["子"]).toBe("卯");
    expect(XING["卯"]).toBe("子");
  });

  it("驿马：三合局同马，且马必在四孟", () => {
    expect(yima("申")).toBe(yima("子"));
    expect(yima("子")).toBe(yima("辰"));
    expect(yima("申")).toBe("寅");
    expect(yima("寅")).toBe("申");
    expect(yima("巳")).toBe("亥");
    expect(yima("亥")).toBe("巳");
    for (const z of DIZHI) expect(["寅", "申", "巳", "亥"]).toContain(yima(z));
  });
});

describe("月将（中气过宫）", () => {
  it("十二中气各对一将，十二支不重不漏", () => {
    const vals = Object.values(ZHONGQI_TO_JIANG);
    expect(vals).toHaveLength(12);
    expect(new Set(vals).size).toBe(12);
    expect(ZHONGQI_TO_JIANG["雨水"]).toBe("亥");
    expect(ZHONGQI_TO_JIANG["霜降"]).toBe("卯");
    expect(ZHONGQI_TO_JIANG["冬至"]).toBe("丑");
    expect(ZHONGQI_TO_JIANG["大寒"]).toBe("子");
  });

  it("将名十二全，且月将随中气逐支后退", () => {
    for (const z of DIZHI) expect(JIANG_NAME[z], `${z} 无将名`).toBeTruthy();
    const order = ["雨水", "春分", "谷雨", "小满", "夏至", "大暑",
      "处暑", "秋分", "霜降", "小雪", "冬至", "大寒"];
    for (let i = 1; i < order.length; i++) {
      const prev = zhiIndex(ZHONGQI_TO_JIANG[order[i - 1]!]!);
      const cur = zhiIndex(ZHONGQI_TO_JIANG[order[i]!]!);
      expect(((prev - cur) % 12 + 12) % 12, `${order[i - 1]}→${order[i]} 未退一支`).toBe(1);
    }
  });

  it("取自历法库的中气：霜降后月将为卯（太冲）", () => {
    const yj = yuejiangAt(new Date(2026, 9, 28, 14, 0));
    expect(yj.zhongqi).toBe("霜降");
    expect(yj.zhi).toBe("卯");
    expect(JIANG_NAME[yj.zhi]).toBe("太冲");
  });

  it("全年每一天都能定出月将", () => {
    for (let d = 0; d < 365; d++) {
      const at = new Date(2026, 0, 1 + d, 12, 0);
      const yj = yuejiangAt(at);
      expect(DIZHI, `${at.toDateString()} 月将越界`).toContain(yj.zhi);
    }
  });
});

describe("天地盘", () => {
  it("月将加占时：月将必落在地盘占时位上", () => {
    for (const yj of DIZHI) {
      for (const zs of DIZHI) {
        const p = buildPlate(yj, zs);
        expect(p.tian[zs], `月将${yj}加${zs}时未落位`).toBe(yj);
      }
    }
  });

  it("天盘是地盘的整体旋转：十二支不重不漏，且 diOf 为 tian 的逆映射", () => {
    for (const yj of DIZHI) {
      for (const zs of DIZHI) {
        const p = buildPlate(yj, zs);
        expect(new Set(Object.values(p.tian)).size).toBe(12);
        for (const di of DIZHI) expect(p.diOf[p.tian[di]!]).toBe(di);
      }
    }
  });

  it("伏吟 = 月将同占时；返吟 = 月将冲占时；二者互斥", () => {
    for (const yj of DIZHI) {
      for (const zs of DIZHI) {
        const p = buildPlate(yj, zs);
        expect(p.fuyin).toBe(yj === zs);
        expect(p.fanyin).toBe(chong(zs) === yj);
        expect(p.fuyin && p.fanyin).toBe(false);
      }
    }
    expect(buildPlate("卯", "卯").fuyin).toBe(true);
    expect(buildPlate("酉", "卯").fanyin).toBe(true);
  });
});

describe("四课", () => {
  it("一课下为日干本身（不是寄宫），阴干才看得出差别", () => {
    // 乙寄辰：若误拿辰(土)判克，乙(木)日的贼克结果会整个不同
    const p = buildPlate("卯", "午");
    const s = buildSiKe(p, "乙", "丑");
    expect(s.ke[0]!.xia).toBe("乙");
    expect(s.ke[0]!.xiaWuxing).toBe("木");
    expect(s.jigong).toBe("辰");
    expect(ZHI_WUXING["辰"]).toBe("土");
    expect(s.ke[0]!.xiaWuxing).not.toBe(ZHI_WUXING[s.jigong]);
  });

  it("二课上神自一课上神取，四课上神自三课上神取", () => {
    for (const yj of DIZHI) {
      for (const zs of ["子", "卯", "午", "酉"]) {
        const p = buildPlate(yj, zs);
        const s = buildSiKe(p, "甲", "子");
        expect(s.ke[0]!.shang).toBe(p.tian[JIGONG["甲"]!]);
        expect(s.ke[1]!.shang).toBe(p.tian[s.ke[0]!.shang]);
        expect(s.ke[2]!.shang).toBe(p.tian["子"]);
        expect(s.ke[3]!.shang).toBe(p.tian[s.ke[2]!.shang]);
      }
    }
  });

  it("上克下与下贼上不可能同时成立", () => {
    for (const yj of DIZHI) {
      for (const zs of DIZHI) {
        const p = buildPlate(yj, zs);
        for (const g of TIANGAN) {
          const s = buildSiKe(p, g, "寅");
          for (const k of s.ke) expect(k.shangKeXia && k.xiaZeiShang).toBe(false);
        }
      }
    }
  });

  it("伏吟时四课必不备（干上神即寄宫、支上神即日支）", () => {
    const p = buildPlate("卯", "卯");
    const s = buildSiKe(p, "甲", "寅");
    expect(p.fuyin).toBe(true);
    expect(s.ganShang).toBe(JIGONG["甲"]);
    expect(s.zhiShang).toBe("寅");
  });

  it("昼夜以卯申为界", () => {
    for (const z of ["卯", "辰", "巳", "午", "未", "申"]) expect(isZhou(z)).toBe(true);
    for (const z of ["酉", "戌", "亥", "子", "丑", "寅"]) expect(isZhou(z)).toBe(false);
  });
});

describe("十二天将", () => {
  it("十二将环布，不重不漏，贵人必在其位", () => {
    for (const g of TIANGAN) {
      for (const zhou of [true, false]) {
        for (const zs of DIZHI) {
          const p = buildPlate("卯", zs);
          const t = buildTianjiang(g, zhou, p);
          expect(Object.keys(t.byTian)).toHaveLength(12);
          expect(new Set(Object.values(t.byTian)).size).toBe(12);
          expect(t.byTian[t.guirenZhi]).toBe("贵人");
          expect(TIANJIANG).toContain(t.byTian[t.guirenZhi]!);
        }
      }
    }
  });

  it("顺逆由贵人所临地盘位决定：亥至辰顺，巳至戌逆", () => {
    for (const zs of DIZHI) {
      const p = buildPlate("卯", zs);
      const t = buildTianjiang("甲", true, p);
      const shun = ["亥", "子", "丑", "寅", "卯", "辰"].includes(t.guirenSeat);
      expect(t.direction).toBe(shun ? "顺" : "逆");
      // 顺布则螣蛇在贵人后一支，逆布则在前一支
      const step = shun ? 1 : -1;
      expect(t.byTian[zhiAt(zhiIndex(t.guirenZhi) + step)]).toBe("螣蛇");
    }
  });

  it("贵人起例两条分歧轴：庚日、壬癸日各自并列，其余七干无分歧", () => {
    const p = buildPlate("卯", "午");
    for (const g of TIANGAN) {
      for (const zhou of [true, false]) {
        const a = buildTianjiang(g, zhou, p, { geng: "同甲戊", rengui: "昼卯夜巳" });
        const b = buildTianjiang(g, zhou, p, { geng: "同辛", rengui: "昼巳夜卯" });
        if (g === "庚" || g === "壬" || g === "癸") {
          expect(a.guirenZhi, `${g} 日两说应不同`).not.toBe(b.guirenZhi);
          expect(a.disputeNote, `${g} 日必须给出并列说明`).toBeTruthy();
          // 分歧只在天将，天地盘与三传不受影响
          expect(Object.keys(a.byTian).sort()).toEqual(Object.keys(b.byTian).sort());
        } else {
          expect(a.guirenZhi).toBe(b.guirenZhi);
          expect(a.disputeNote, `${g} 日不该报分歧`).toBeNull();
        }
      }
    }
    // 壬癸两说：本软件默认昼巳夜卯（2026-10-29 起，依《六壬大全》卷九 4b 明文与毕法赋课例；dcbazi 排盘站同）；另一说昼卯夜巳
    expect(buildTianjiang("壬", true, p, { geng: "同甲戊", rengui: "昼卯夜巳" }).guirenZhi).toBe("卯");
    expect(buildTianjiang("壬", true, p, { geng: "同甲戊", rengui: "昼巳夜卯" }).guirenZhi).toBe("巳");
    // 不受分歧影响的几干：甲昼丑夜未、辛昼午夜寅
    expect(buildTianjiang("甲", true, p).guirenZhi).toBe("丑");
    expect(buildTianjiang("甲", false, p).guirenZhi).toBe("未");
    expect(buildTianjiang("辛", true, p).guirenZhi).toBe("午");
    expect(buildTianjiang("壬", true, p).guirenZhi).toBe("巳");
    expect(buildTianjiang("癸", false, p).guirenZhi).toBe("卯");
  });
});

describe("整盘（divineLiuren）", () => {
  const at = new Date(2026, 9, 28, 14, 30);

  it("纯函数：同一输入永远同一盘", () => {
    const a = divineLiuren({ at, zhanshi: "未" });
    const b = divineLiuren({ at, zhanshi: "未" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("盘面十二行齐全，天将与空亡逐行标到", () => {
    const r = divineLiuren({ at, zhanshi: "未" });
    expect(r.rows).toHaveLength(12);
    expect(new Set(r.rows.map((x) => x.tian)).size).toBe(12);
    expect(r.rows.filter((x) => x.kong)).toHaveLength(2);
    for (const row of r.rows) expect(TIANJIANG).toContain(row.jiang as any);
  });

  it("三传三位齐全，推导链非空，并带把握程度", () => {
    const r = divineLiuren({ at, zhanshi: "未" });
    expect(r.sanchuan.chuan.map((c) => c.pos)).toEqual(["初", "中", "末"]);
    expect(r.sanchuan.derivation.length).toBeGreaterThan(0);
    expect(["confirmed", "likely", "disputed"]).toContain(r.sanchuan.confidence);
    expect(r.sanchuan.keti).toBeTruthy();
    expect(CONFIDENCE[r.sanchuan.gate]).toBeTruthy();
  });

  it("三传旁注：遁干、天将、空亡、与日干的关系全带齐", () => {
    const r = divineLiuren({ at, zhanshi: "未" });
    for (const c of r.chuanDetail) {
      expect(c.wuxing).toBe(ZHI_WUXING[c.zhi]);
      expect(TIANJIANG).toContain(c.jiang as any);
      expect(["比和", "生日干", "日干生", "克日干", "日干克"]).toContain(c.relToGan);
      expect(c.kong).toBe((r.kongwang as readonly string[]).includes(c.zhi));
    }
  });

  it("门派分歧必被如实列出，不替用户裁决", () => {
    const r = divineLiuren({ at, zhanshi: "未" });
    expect(r.disputes.length).toBeGreaterThan(0);
    expect(r.disputes.some((d) => d.includes("昼") || d.includes("夜"))).toBe(true);
  });

  it("23 时换日：日干支按次日取（§3#4 软件约定）", () => {
    const before = divineLiuren({ at: new Date(2026, 9, 28, 22, 30), zhanshi: "亥" });
    const after = divineLiuren({ at: new Date(2026, 9, 28, 23, 30), zhanshi: "子" });
    expect(before.input.rolled).toBe(false);
    expect(after.input.rolled).toBe(true);
    const i = JIAZI.indexOf(before.input.dayGanZhi);
    expect(after.input.dayGanZhi).toBe(JIAZI[(i + 1) % 60]);
  });

  it("全时辰扫描：任意占时都能排出完整盘，不抛错、不缺项", () => {
    let fuyin = 0, fanyin = 0;
    const getis = new Set<string>();
    for (const zs of DIZHI) {
      for (let d = 0; d < 24; d++) {
        const r = divineLiuren({ at: new Date(2026, 0, 1 + d * 15, 12, 0), zhanshi: zs });
        expect(r.sanchuan.chuan).toHaveLength(3);
        expect(r.rows).toHaveLength(12);
        getis.add(r.sanchuan.gate);
        if (r.plate.fuyin) fuyin++;
        if (r.plate.fanyin) fanyin++;
      }
    }
    expect(fuyin).toBeGreaterThan(0);
    expect(fanyin).toBeGreaterThan(0);
    // 扫描应覆盖多种宗门，而不是永远落在同一条分支
    expect(getis.size).toBeGreaterThan(2);
  });
});
