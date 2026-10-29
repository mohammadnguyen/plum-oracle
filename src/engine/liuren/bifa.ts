/**
 * 大六壬 · 毕法赋（《六壬大全》卷九、卷十）——本课命中了哪几条。2026-10-29，照天将表办理（机器逐字核对，不经人工签收）。
 *
 * 一百条里只收「主格的触发条件，原书注文写得清楚、引擎算得出」的 46 条（见 bifaData.ts）。各条的条件由原书注文
 * 归纳，原书自举的课例跑在 tests/liuren-bifa.test.ts 里；跑不出的照实记录，不为凑数改条件。
 * 不收：要用禄、十二长生的沐浴死绝、六害、天将五行、太岁与各种月神煞（生气、死气、丧吊、病符）才能判的条；
 *       「受虎克神」「制鬼良医」两条（按五行配脏腑、定治法，等于替人诊断）；第 93–100 条讲占法、不是盘面结构；
 *       原书注文没把条件说清的十条。
 * 各条的子格（「某某格」附论）多半另需上述表或神煞，这一版一律只判主格。
 *
 * 另用到三张小表，均有原文（daquan.ts 的 DAQUAN_QUOTES，`verify:liuren` 核对）：
 *   墓「木墓未火墓戌金墓丑水土墓辰」（卷八 55a）；六合「子與丑合寅與亥合……午與未合」（卷一 26b）；
 *   自刑「辰亥午酉為自刑」（卷一 37b）；三合局，卷八「訂訛」四句（潤下申子辰、炎上寅午戌、曲直亥卯未、從革巳酉丑）。
 *   六合与引擎 ganzhi.ts 的 liuhe 一致（测试锁定）。
 * 「三传皆鬼」「六爻现卦」原书按局论：三传成三合局，就以局的五行定它对日干是什么（如巳丑酉成金局）。
 *
 * 毕法赋句句带吉凶断语（「陞遷吉」「㐫禍動」）。本模块只判「格局成立与否」，不产出吉凶；
 * 解读要求里另写：只引与所问相关的条（原书第九十八条「非占現類勿言之」），不改三传的走向。
 */
import {
  chong, dunGan, GAN_WUXING, ganYang, liuhe, sheng, ke, xunKong, ZHI_WUXING, zhiAt, zhiIndex, zhiYang,
  type Gan, type Wuxing, type Zhi,
} from "./ganzhi.js";
import { BIFA_SOURCES, type BifaSource } from "./bifaData.js";

export interface BifaCtx {
  dayGanZhi: string;
  gan: Gan;
  zhi: Zhi;
  jigong: Zhi;
  /** 地盘位 → 天盘神 */
  tian: Readonly<Record<string, Zhi>>;
  /** 天盘支 → 所临地盘位 */
  diOf: Readonly<Record<string, Zhi>>;
  fuyin: boolean;
  fanyin: boolean;
  /** 四课上神：干上、第二课、支上、第四课 */
  keShang: readonly [Zhi, Zhi, Zhi, Zhi];
  chuan: readonly [Zhi, Zhi, Zhi];
  /** 天盘支 → 所乘天将 */
  jiangOf: Readonly<Record<string, string>>;
  /** 本课所用贵人所乘的天盘支 */
  guirenZhi: Zhi;
  /** 月将（太阳） */
  yuejiang: Zhi;
  /** 年命（选填）：本命支、行年支 */
  benming?: Zhi | null;
  xingnianZhi?: Zhi | null;
}

export interface BifaHit {
  n: number;
  title: string;
  /** 本课成的是哪一格（原书名目） */
  ge: string;
  /** 为什么成立：盘面上的哪几项 */
  why: string;
  src: BifaSource;
}

const MU: Readonly<Record<Wuxing, Zhi>> = { 木: "未", 火: "戌", 金: "丑", 水: "辰", 土: "辰" };
const ZIXING: ReadonlySet<string> = new Set(["辰", "午", "酉", "亥"]);
/** 三合局及其五行（卷八「訂訛」） */
const SANHE_JU: ReadonlyArray<[Zhi[], Wuxing]> = [
  [["申", "子", "辰"], "水"], [["寅", "午", "戌"], "火"], [["亥", "卯", "未"], "木"], [["巳", "酉", "丑"], "金"],
];
const SANHE_PEI: ReadonlyArray<[Zhi[], Zhi]> = [
  [["寅", "午", "戌"], "未"], [["亥", "卯", "未"], "戌"], [["申", "子", "辰"], "丑"], [["巳", "酉", "丑"], "辰"],
];

type Rule = (c: Helpers) => null | { ge: string; why: string };

interface Helpers extends BifaCtx {
  gw: Wuxing;
  zw: Wuxing;
  ganShang: Zhi;
  zhiShang: Zhi;
  ke4: Zhi;
  chu: Zhi;
  zhong: Zhi;
  mo: Zhi;
  kong: readonly Zhi[];
  xunShou: Zhi;
  xunWei: Zhi;
  dingShen: Zhi;
  wx: (z: string) => Wuxing;
  qin: (z: string) => "父母" | "兄弟" | "子孙" | "妻财" | "官鬼";
  isKong: (z: string) => boolean;
  /** 天盘支在旬空，或所临地盘位在旬空 */
  kongOrLuo: (z: string) => boolean;
  jiang: (z: string) => string;
  step: (z: string, d: number) => Zhi;
  /** 三传成三合局时局的五行，否则 null */
  ju: Wuxing | null;
  /** 某五行对日干的六亲 */
  qinWx: (w: Wuxing) => "父母" | "兄弟" | "子孙" | "妻财" | "官鬼";
}

function helpers(c: BifaCtx): Helpers {
  const gw = GAN_WUXING[c.gan]!;
  const wx = (z: string) => ZHI_WUXING[z]!;
  const { xunshou, kongwang } = xunKong(c.dayGanZhi);
  const xs = xunshou[1] as Zhi;
  const qinWx = (w: Wuxing) => {
    if (w === gw) return "兄弟" as const;
    if (sheng(w, gw)) return "父母" as const;
    if (sheng(gw, w)) return "子孙" as const;
    if (ke(gw, w)) return "妻财" as const;
    return "官鬼" as const;
  };
  const qin = (z: string) => qinWx(wx(z));
  const set = new Set<string>(c.chuan);
  const ju = SANHE_JU.find(([g]) => set.size === 3 && g.every((z) => set.has(z)))?.[1] ?? null;
  const isKong = (z: string) => (kongwang as readonly string[]).includes(z);
  return {
    ...c, gw, zw: wx(c.zhi),
    ganShang: c.keShang[0], zhiShang: c.keShang[2], ke4: c.keShang[3],
    chu: c.chuan[0], zhong: c.chuan[1], mo: c.chuan[2],
    kong: kongwang, xunShou: xs, xunWei: zhiAt(zhiIndex(xs) + 9), dingShen: zhiAt(zhiIndex(xs) + 3),
    wx, qin, qinWx, ju, isKong,
    kongOrLuo: (z) => isKong(z) || isKong(c.diOf[z]!),
    jiang: (z) => c.jiangOf[z] ?? "",
    step: (z, d) => zhiAt(zhiIndex(z) + d),
  };
}

const ok = (ge: string, why: string) => ({ ge, why });

const RULES: Readonly<Record<number, Rule>> = {
  1: (h) => {
    if (h.diOf[h.chu] === h.step(h.jigong, 1) && h.diOf[h.mo] === h.step(h.jigong, -1))
      return ok("引从天干格", `初传 ${h.chu} 临寄宫 ${h.jigong} 前一位、末传 ${h.mo} 临其后一位`);
    if (h.diOf[h.chu] === h.step(h.zhi, 1) && h.diOf[h.mo] === h.step(h.zhi, -1))
      return ok("引从地支格", `初传 ${h.chu} 临日支 ${h.zhi} 前一位、末传 ${h.mo} 临其后一位`);
    return null;
  },
  2: (h) => {
    if (h.ganShang === h.xunWei && h.zhiShang === h.xunShou)
      return ok("周而复始格", `干上旬尾 ${h.xunWei}、支上旬首 ${h.xunShou}`);
    if (h.ganShang === h.xunShou && h.zhiShang === h.xunWei)
      return ok("周而复始格（又一式）", `干上旬首 ${h.xunShou}、支上旬尾 ${h.xunWei}`);
    return null;
  },
  5: (h) => {
    if (!ganYang(h.gan)) return null;
    const s = new Set<string>([...h.keShang, h.zhi, ...h.chuan]);
    if (![...s].every(zhiYang)) return null;
    if (s.size === 6) return ok("六阳格", "日干为阳，四课上神、日支、三传全是阳支，六阳俱全");
    if (s.size === 5) return ok("五阳格", "日干为阳，四课上神、日支、三传全是阳支，缺一阳");
    return null;
  },
  6: (h) => {
    if (ganYang(h.gan)) return null;
    const s = new Set<string>([...h.keShang, h.zhi, ...h.chuan]);
    if (![...s].every((z) => !zhiYang(z))) return null;
    if (s.size === 6) return ok("六阴格", "日干为阴，四课上神、日支、三传全是阴支，六阴俱全");
    if (s.size === 5) return ok("五阴格", "日干为阴，四课上神、日支、三传全是阴支，缺一阴");
    return null;
  },
  11: (h) => {
    const allGui = h.ju ? h.qinWx(h.ju) === "官鬼" : h.chuan.every((z) => h.qin(z) === "官鬼");
    return allGui && h.qin(h.ganShang) === "子孙"
      ? ok("众鬼虽彰", `三传 ${h.chuan.join("")} ${h.ju ? `成${h.ju}局，` : ""}皆为官鬼，干上 ${h.ganShang} 为子孙制鬼`) : null;
  },
  12: (h) => h.qin(h.ganShang) === "官鬼" && ke(h.zw, h.wx(h.ganShang))
    ? ok("狐假虎威", `干上 ${h.ganShang} 为官鬼，日支 ${h.zhi} 克之`) : null,
  16: (h) => h.isKong(h.ganShang) && h.jiang(h.ganShang) === "天空"
    ? ok("空上乘空", `干上 ${h.ganShang} 旬空，又乘天空`) : null,
  17: (h) => h.zhong === h.step(h.chu, 1) && h.mo === h.step(h.zhong, 1) && h.kong.every((k) => h.chuan.includes(k))
    ? ok("进茹空亡", `三传 ${h.chuan.join("")} 顺连茹，旬空 ${h.kong.join("")} 都在三传`) : null,
  18: (h) => h.zhong === h.step(h.chu, -1) && h.mo === h.step(h.zhong, -1) && h.kong.every((k) => h.chuan.includes(k))
    ? ok("踏脚空亡", `三传 ${h.chuan.join("")} 退连茹，旬空 ${h.kong.join("")} 都在三传`) : null,
  21: (h) => h.jigong !== h.zhi && liuhe(h.jigong) === h.zhiShang && liuhe(h.zhi) === h.ganShang
    ? ok("交车合", `寄宫 ${h.jigong} 与支上 ${h.zhiShang} 六合，日支 ${h.zhi} 与干上 ${h.ganShang} 六合`) : null,
  22: (h) => liuhe(h.jigong) === h.zhi && liuhe(h.ganShang) === h.zhiShang
    ? ok("上下皆合", `地盘寄宫 ${h.jigong} 与日支 ${h.zhi} 六合，干上 ${h.ganShang} 与支上 ${h.zhiShang} 六合`) : null,
  23: (h) => h.chu === h.zhiShang && h.mo === h.ganShang
    ? ok("彼求我事", `初传起于支上 ${h.zhiShang}，末传归于干上 ${h.ganShang}`) : null,
  24: (h) => h.chu === h.ganShang && h.mo === h.zhiShang
    ? ok("我求彼事", `初传起于干上 ${h.ganShang}，末传归于支上 ${h.zhiShang}`) : null,
  25: (h) => (h.gan === "庚" || h.gan === "辛") ? dingIn(h, "金日逢丁") : null,
  26: (h) => (h.gan === "壬" || h.gan === "癸") ? dingIn(h, "水日逢丁") : null,
  31: (h) => {
    const s = (a: string, b: Wuxing) => sheng(h.wx(a), b);
    if (s(h.chu, h.wx(h.zhong)) && s(h.zhong, h.wx(h.mo)) && s(h.mo, h.gw))
      return ok("三传递生（一等）", `初生中、中生末、末传 ${h.mo} 生日干`);
    if (s(h.mo, h.wx(h.zhong)) && s(h.zhong, h.wx(h.chu)) && s(h.chu, h.gw))
      return ok("三传递生（二等）", `末生中、中生初、初传 ${h.chu} 生日干`);
    return null;
  },
  32: (h) => {
    const k = (a: string, b: Wuxing) => ke(h.wx(a), b);
    if (k(h.chu, h.wx(h.zhong)) && k(h.zhong, h.wx(h.mo)) && k(h.mo, h.gw))
      return ok("三传互克（一等）", `初克中、中克末、末传 ${h.mo} 克日干`);
    if (k(h.mo, h.wx(h.zhong)) && k(h.zhong, h.wx(h.chu)) && k(h.chu, h.gw))
      return ok("三传互克（二等）", `末克中、中克初、初传 ${h.chu} 克日干`);
    return null;
  },
  35: (h) => {
    if (sheng(h.gw, h.wx(h.ganShang)) && sheng(h.zw, h.wx(h.zhiShang)))
      return ok("人宅受脱", `干上 ${h.ganShang} 脱日干，支上 ${h.zhiShang} 脱日支`);
    if (sheng(h.zw, h.wx(h.ganShang)) && sheng(h.gw, h.wx(h.zhiShang)))
      return ok("人宅受脱（交互）", `干上 ${h.ganShang} 脱日支，支上 ${h.zhiShang} 脱日干`);
    return null;
  },
  37: (h) => {
    if (!sheng(h.wx(h.mo), h.wx(h.chu))) return null;
    if (sheng(h.wx(h.chu), h.gw)) return ok("末助初·生干", `末传 ${h.mo} 生初传 ${h.chu}，初传生日干`);
    if (ke(h.wx(h.chu), h.gw)) return ok("末助初·克干", `末传 ${h.mo} 生初传 ${h.chu}，初传克日干`);
    if (ke(h.gw, h.wx(h.chu))) return ok("末助初·作财", `末传 ${h.mo} 生初传 ${h.chu}，初传为日财`);
    return null;
  },
  38: (h) => h.tian[h.xunShou] === h.xunWei
    ? ok("闭口（旬尾加旬首）", `旬尾 ${h.xunWei} 加旬首 ${h.xunShou}${h.chu === h.xunWei ? "，并且发用" : ""}`) : null,
  39: (h) => {
    const xw = Object.keys(h.jiangOf).find((z) => h.jiangOf[z] === "玄武");
    return xw === h.yuejiang ? ok("太阳照武", `玄武乘月将 ${h.yuejiang}（原书另要占时在昼）`) : null;
  },
  40: (h) => {
    const s = new Set([h.jiang(h.ganShang), h.jiang(h.zhiShang)]);
    return s.has("天后") && s.has("六合") ? ok("后合占婚", "干上、支上分乘天后、六合") : null;
  },
  47: (h) => {
    const d = h.diOf[h.guirenZhi];
    if (d !== "辰" && d !== "戌") return null;
    if (h.jigong === d) return ok("贵人临身", `贵人临地盘 ${d}，正是日干寄宫`);
    if (h.zhi === d) return ok("贵人入宅", `贵人临地盘 ${d}，正是日支`);
    return ok("天乙入狱", `贵人临地盘 ${d}`);
  },
  48: (h) => ke(h.wx(h.guirenZhi), h.gw) && (h.guirenZhi === h.ganShang || h.guirenZhi === h.zhiShang)
    ? ok("鬼乘天乙", `贵人所乘 ${h.guirenZhi} 克日干，临${h.guirenZhi === h.ganShang ? "干" : "支"}上`) : null,
  51: (h) => h.chu === "戌" && h.diOf["戌"] === "亥" ? ok("魁度天门", "戌加亥发用") : null,
  52: (h) => h.tian["寅"] === "辰" ? ok("罡塞鬼户", "天盘辰加地盘寅") : null,
  55: (h) => h.ganShang === h.step(h.jigong, 1) && h.zhiShang === h.step(h.zhi, 1)
    ? ok("天罗地网", `干上 ${h.ganShang} 为寄宫前一辰，支上 ${h.zhiShang} 为日支前一辰`) : null,
  56: (h) => h.benming && h.ganShang === MU[h.gw] && h.benming === h.ganShang
    ? ok("天网自裹", `干上 ${h.ganShang} 为日墓覆日，本命又是 ${h.benming}`) : null,
  60: (h) => {
    if (h.zhiShang === h.yuejiang) return ok("太阳射宅", `支上 ${h.zhiShang} 即月将`);
    if (h.ganShang === h.yuejiang) return ok("太阳临身", `干上 ${h.ganShang} 即月将`);
    return null;
  },
  61: (h) => h.ganShang === MU[h.gw] && h.jiang(h.ganShang) === "白虎"
    ? ok("干乘墓虎", `干上 ${h.ganShang} 为日墓，乘白虎`) : null,
  62: (h) => {
    if (h.jiang(h.zhiShang) !== "白虎") return null;
    if (h.zhiShang === MU[h.gw]) return ok("支乘墓虎（干墓临支）", `支上 ${h.zhiShang} 为日干之墓，乘白虎`);
    if (h.zhiShang === MU[h.zw]) return ok("支乘墓虎（支墓临支）", `支上 ${h.zhiShang} 为日支之墓，乘白虎`);
    return null;
  },
  63: (h) => ke(h.wx(h.ganShang), h.gw) && ke(h.wx(h.zhiShang), h.zw)
    ? ok("彼此全伤", `干上 ${h.ganShang} 克日干，支上 ${h.zhiShang} 克日支`) : null,
  64: (h) => {
    if (ke(h.wx(h.zhiShang), h.gw) && ke(h.wx(h.ganShang), h.zw))
      return ok("芜淫卦", `支上 ${h.zhiShang} 克日干，干上 ${h.ganShang} 克日支`);
    if (ke(h.gw, h.wx(h.zhiShang)) && ke(h.zw, h.wx(h.ganShang)))
      return ok("解离卦", `日干克支上 ${h.zhiShang}，日支克干上 ${h.ganShang}`);
    return null;
  },
  69: (h) => {
    const x = Object.keys(h.jiangOf).find((z) => h.jiangOf[z] === "白虎");
    const g = x ? dunGan(h.dayGanZhi, x) : null;
    return x && g && ke(GAN_WUXING[g]!, h.gw) ? ok("虎乘遁鬼", `白虎乘 ${x}，其遁干 ${g} 克日干`) : null;
  },
  70: (h) => h.qin(h.zhiShang) === "官鬼" && h.qin(h.ke4) === "官鬼"
    ? ok("鬼临三四", `第三课 ${h.zhiShang}、第四课 ${h.ke4} 上神皆为官鬼`) : null,
  74: (h) => h.chuan.every((z) => h.isKong(z)) ? ok("空空如也", `三传 ${h.chuan.join("")} 皆旬空`) : null,
  75: (h) => h.keShang.every((z) => ZIXING.has(z)) ? ok("一字刑（自刑）", `四课上神 ${h.keShang.join("")} 全在辰午酉亥`) : null,
  77: (h) => {
    if (sheng(h.wx(h.ganShang), h.zw) && sheng(h.wx(h.zhiShang), h.gw))
      return ok("互生", `干上 ${h.ganShang} 生日支，支上 ${h.zhiShang} 生日干`);
    if (sheng(h.wx(h.ganShang), h.gw) && sheng(h.wx(h.zhiShang), h.zw))
      return ok("俱生", `干上 ${h.ganShang} 生日干，支上 ${h.zhiShang} 生日支`);
    return null;
  },
  81: (h) => h.zhong === MU[h.wx(h.chu)] ? ok("传墓入墓", `中传 ${h.zhong} 为初传 ${h.chu} 之墓`) : null,
  82: (h) => h.kongOrLuo(h.zhong) && h.kongOrLuo(h.mo) ? ok("不行传", `中传 ${h.zhong}、末传 ${h.mo} 皆空（旬空或坐空）`) : null,
  83: (h) => {
    const set = new Set<string>(h.chuan);
    const g = SANHE_PEI.find(([ju]) => set.size === 3 && ju.every((z) => set.has(z)));
    return g && (h.ganShang === g[1] || h.zhiShang === g[1])
      ? ok("三六合", `三传 ${g[0].join("")} 三合，${h.ganShang === g[1] ? "干" : "支"}上 ${g[1]} 与中神六合`) : null;
  },
  87: (h) => {
    if (h.diOf[h.jigong] === MU[h.gw] && h.diOf[h.zhi] === MU[h.zw])
      return ok("人宅坐墓", `天盘寄宫 ${h.jigong} 坐地盘日墓 ${MU[h.gw]}，天盘日支 ${h.zhi} 坐地盘支墓 ${MU[h.zw]}`);
    if (h.diOf[h.jigong] === MU[h.zw] && h.diOf[h.zhi] === MU[h.gw])
      return ok("互坐邱墓", `天盘寄宫 ${h.jigong} 坐支墓 ${MU[h.zw]}，天盘日支 ${h.zhi} 坐日墓 ${MU[h.gw]}`);
    return null;
  },
  88: (h) => {
    if (h.ganShang === MU[h.gw] && h.zhiShang === MU[h.zw])
      return ok("干支乘墓", `干上 ${h.ganShang} 为日墓，支上 ${h.zhiShang} 为支墓`);
    if (h.ganShang === MU[h.zw] && h.zhiShang === MU[h.gw])
      return ok("互乘墓神", `干上 ${h.ganShang} 为支墓，支上 ${h.zhiShang} 为日墓`);
    return null;
  },
  90: (h) => h.fanyin && h.chuan.every((z) => h.kongOrLuo(z))
    ? ok("来去俱空", `返吟，三传 ${h.chuan.join("")} 皆空（旬空或坐空）`) : null,
  91: (h) => h.qin(h.ganShang) === "官鬼" && h.jiang(h.ganShang) === "白虎"
    ? ok("虎临干鬼", `干上 ${h.ganShang} 为官鬼，乘白虎`) : null,
  95: (h) => {
    if (h.ju) return ok(`${h.qinWx(h.ju)}现卦`, `三传 ${h.chuan.join("")} 成${h.ju}局，皆为${h.qinWx(h.ju)}`);
    const q = h.chuan.map((z) => h.qin(z));
    return q.every((x) => x === q[0]) ? ok(`${q[0]}现卦`, `三传 ${h.chuan.join("")} 皆为${q[0]}`) : null;
  },
};

function dingIn(h: Helpers, ge: string) {
  const d = h.dingShen;
  const where: string[] = [];
  h.chuan.forEach((z, i) => { if (z === d) where.push(`${"初中末"[i]}传`); });
  if (h.ganShang === d) where.push("干上");
  if (h.zhiShang === d) where.push("支上");
  if (h.benming && h.tian[h.benming] === d) where.push("本命上");
  if (h.xingnianZhi && h.tian[h.xingnianZhi] === d) where.push("行年上");
  return where.length ? ok(ge, `旬丁 ${d} 见于${where.join("、")}`) : null;
}

/** 本课命中的毕法赋条目，按条序。 */
export function evalBifa(c: BifaCtx): BifaHit[] {
  const h = helpers(c);
  const out: BifaHit[] = [];
  for (const src of BIFA_SOURCES) {
    const r = RULES[src.n];
    if (!r) throw new Error(`毕法赋第 ${src.n} 条缺判定`);
    const hit = r(h);
    if (hit) out.push({ n: src.n, title: src.title, ...hit, src });
  }
  return out;
}

export { MU as MU_TABLE, chong };
