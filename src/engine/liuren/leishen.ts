/**
 * 大六壬 · 类神：所问之事（或所问之人）在课上看哪一个。2026-10-29，照天将表办理（机器逐字核对，不经人工签收）。
 *
 * 依据《六壬大全》卷八 59b–60b 一段口诀（逐字见 daquan.ts）：
 *   人：母天后；妻天后、财爻、神后；兄弟姊妹太阴、兄弟爻；子孙六合、子孙爻、太冲、登明；
 *       奴河魁、天空；婢从魁、太阴；朋友六合。
 *   事：求官青龙、太常、官星；求名文书朱雀；干贵贵人；婚天后；求财青龙、财爻；衣服酒食太常；
 *       雨青龙；晴天空；田土勾陈；路白虎。
 * 取用：「名人事類神兼二三以入傳課為取用」「若是皆入皆不入不用兼神責將神」（例：「如妻止去責天后財爻神后不須論」）；
 *       「不在課傳為局外所臨地位看原因」「有氣亦遠無氣難旺相德合終可親」。
 *
 * 不做：
 *   · 父——原书取「生氣」「日本」「德神」，引擎未算这几个神煞，不硬凑；口诀里「父母生氣與日本」也一并不取。
 *   · 疾病、官讼——这段口诀没有列；卷八另有「八身類神」按干支配脏腑，那等于替人定病位，不收。
 *
 * 「課」取四课上神，「傳」取三传。「爻」指课传里与日干成该六亲关系的支；不在课传就是没有这一爻。
 * 判定是确定性的；问句自动归类只是给用户一个默认，界面明示、一键可改（同梅花门类判定的规矩）。
 */
import { DAQUAN_QUOTES as Q, type DaquanQuote } from "./daquan.js";
import { JIANG_NAME } from "./yuejiang.js";
import type { Liuqin } from "./liuqin.js";
import type { Zhi } from "./ganzhi.js";

export type LsTarget =
  | { kind: "jiang"; name: string }
  | { kind: "qin"; name: Liuqin; label: string }
  | { kind: "shen"; zhi: Zhi };

export interface LeishenCat {
  id: string;
  label: string;
  group: "人" | "事";
  targets: readonly LsTarget[];
  quote: DaquanQuote;
  /** 问句里出现这些词就默认归这一类（只作默认，界面可改） */
  keywords: readonly string[];
}

const J = (name: string): LsTarget => ({ kind: "jiang", name });
const QIN = (name: Liuqin, label: string): LsTarget => ({ kind: "qin", name, label });
const S = (zhi: Zhi): LsTarget => ({ kind: "shen", zhi });

/** 顺序即自动归类的优先次序：事在前、人在后；同组内越具体越靠前。 */
export const LEISHEN: readonly LeishenCat[] = Object.freeze([
  { id: "qiuguan", label: "求官（升职、仕途）", group: "事", targets: [J("青龙"), J("太常"), QIN("官鬼", "官星")], quote: Q.lsQiuGuan,
    keywords: ["升职", "升官", "提拔", "晋升", "仕途", "当官", "考公", "公务员", "编制", "调岗"] },
  { id: "qiuming", label: "求名、文书（考试、证照、文件）", group: "事", targets: [J("朱雀")], quote: Q.lsQiuMing,
    keywords: ["考试", "面试", "录取", "考研", "高考", "中考", "证书", "论文", "文书", "批文", "审批", "合同", "名次", "比赛"] },
  { id: "gangui", label: "干谒贵人（求见、托人办事）", group: "事", targets: [J("贵人")], quote: Q.lsGanGui,
    keywords: ["求见", "拜见", "见领导", "托人", "托关系", "找关系", "求人", "贵人"] },
  { id: "hun", label: "婚姻", group: "事", targets: [J("天后")], quote: Q.lsHun,
    keywords: ["婚", "嫁", "娶", "相亲", "提亲", "订婚", "对象", "恋爱", "男朋友", "女朋友", "男友", "女友", "复合", "和好", "分手", "感情"] },
  { id: "qiucai", label: "求财", group: "事", targets: [J("青龙"), QIN("妻财", "财爻")], quote: Q.lsQiuCai,
    keywords: ["钱", "财", "赚", "收款", "货款", "回本", "投资", "生意", "股票", "基金", "买卖", "工资", "奖金", "借款", "欠款", "盈利", "亏"] },
  { id: "yishi", label: "衣服酒食", group: "事", targets: [J("太常")], quote: Q.lsYiShi,
    keywords: ["吃饭", "饭局", "宴", "酒席", "喝酒", "衣服"] },
  { id: "yu", label: "下雨", group: "事", targets: [J("青龙")], quote: Q.lsYu, keywords: ["下雨", "雨"] },
  { id: "qing", label: "天晴", group: "事", targets: [J("天空")], quote: Q.lsQing, keywords: ["天晴", "晴"] },
  { id: "tiantu", label: "田土（房屋、土地）", group: "事", targets: [J("勾陈")], quote: Q.lsTianTu,
    keywords: ["房子", "买房", "卖房", "房产", "土地", "田地", "宅基地"] },
  { id: "lu", label: "道路（出行）", group: "事", targets: [J("白虎")], quote: Q.lsLu,
    keywords: ["出行", "出门", "出差", "旅行", "旅游", "路上", "开车", "自驾", "远行"] },

  { id: "qi", label: "妻子", group: "人", targets: [J("天后"), QIN("妻财", "财爻"), S("子")], quote: Q.lsQi,
    keywords: ["老婆", "妻子", "太太", "媳妇", "爱人"] },
  { id: "mu", label: "母亲", group: "人", targets: [J("天后")], quote: Q.lsFuMu, keywords: ["妈", "母亲", "娘"] },
  { id: "xiongdi", label: "兄弟姊妹", group: "人", targets: [J("太阴"), QIN("兄弟", "兄弟爻")], quote: Q.lsXiongDi,
    keywords: ["哥", "弟", "姐", "妹", "兄弟", "姊妹"] },
  { id: "zisun", label: "子孙", group: "人", targets: [J("六合"), QIN("子孙", "子孙爻"), S("卯"), S("亥")], quote: Q.lsZiSun,
    keywords: ["孩子", "儿子", "女儿", "子女", "孙", "小孩"] },
  { id: "pengyou", label: "朋友", group: "人", targets: [J("六合")], quote: Q.lsPengYou, keywords: ["朋友", "同学", "闺蜜", "兄弟们"] },
  { id: "nu", label: "奴（仆役）", group: "人", targets: [S("戌"), J("天空")], quote: Q.lsNu, keywords: [] },
  { id: "bi", label: "婢（女仆）", group: "人", targets: [S("酉"), J("太阴")], quote: Q.lsBi, keywords: [] },
] as LeishenCat[]);

/** 问句 → 默认类神（第一个命中的）；没命中返回 null，即不取类神。 */
export function detectLeishen(question: string): LeishenCat | null {
  const q = question.replace(/\s/g, "");
  if (!q) return null;
  return LEISHEN.find((c) => c.keywords.some((k) => q.includes(k))) ?? null;
}

export const LEISHEN_RULES: readonly DaquanQuote[] = Object.freeze([Q.lsQuYong, Q.lsJiangShen, Q.lsQiLi, Q.lsJuWai, Q.lsYouQi]);

export function targetName(t: LsTarget): string {
  return t.kind === "jiang" ? t.name : t.kind === "qin" ? t.label : `${JIANG_NAME[t.zhi]}（${t.zhi}）`;
}

/** 课上的一处位置 */
export interface LsSpot {
  zhi: Zhi;
  /** 所临地盘位 */
  seat: Zhi;
  /** 在课传中的位置，如「初传」「第二课上神」；不在为空 */
  where: string[];
}

export interface LsTargetHit {
  target: LsTarget;
  name: string;
  /** 这一类神在课上的位置（将神、神：一处；爻：课传中所有该六亲的支） */
  spots: LsSpot[];
  inKeChuan: boolean;
}

export interface LeishenReading {
  cat: LeishenCat;
  hits: LsTargetHit[];
  /** 按取用之法选中的那几个 */
  chosen: LsTargetHit[];
  /** 取用的理由（人读） */
  why: string;
}

export interface LsBoard {
  /** 地盘位 → 天盘支 */
  tian: Readonly<Record<string, Zhi>>;
  /** 天盘支 → 地盘位 */
  diOf: Readonly<Record<string, Zhi>>;
  /** 天盘支 → 天将 */
  jiangOf: Readonly<Record<string, string>>;
  /** 四课上神（课序 1–4） */
  keShang: readonly Zhi[];
  /** 三传（初中末） */
  chuan: readonly Zhi[];
  /** 某支对日干的六亲 */
  liuqinOf: (z: Zhi) => Liuqin;
}

function whereOf(b: LsBoard, z: Zhi): string[] {
  const w: string[] = [];
  b.chuan.forEach((c, i) => { if (c === z) w.push(`${"初中末"[i]}传`); });
  b.keShang.forEach((s, i) => { if (s === z) w.push(`第${"一二三四"[i]}课上神`); });
  return w;
}

export function readLeishen(cat: LeishenCat, b: LsBoard): LeishenReading {
  const hits: LsTargetHit[] = cat.targets.map((t) => {
    let zs: Zhi[] = [];
    if (t.kind === "jiang") {
      const z = Object.keys(b.jiangOf).find((k) => b.jiangOf[k] === t.name) as Zhi | undefined;
      zs = z ? [z] : [];
    } else if (t.kind === "shen") {
      zs = [t.zhi];
    } else {
      const inKC = new Set<Zhi>([...b.chuan, ...b.keShang]);
      zs = [...inKC].filter((z) => b.liuqinOf(z) === t.name);
    }
    const spots = zs.map((zhi) => ({ zhi, seat: b.diOf[zhi]!, where: whereOf(b, zhi) }));
    return { target: t, name: targetName(t), spots, inKeChuan: spots.some((s) => s.where.length > 0) };
  });
  if (hits.length === 1) return { cat, hits, chosen: hits, why: "此类只列一神，即取之" };
  const inN = hits.filter((h) => h.inKeChuan).length;
  if (inN > 0 && inN < hits.length) {
    return { cat, hits, chosen: hits.filter((h) => h.inKeChuan), why: "所列几神中只取入课传的（「以入傳課為取用」）" };
  }
  const jiang = hits.filter((h) => h.target.kind === "jiang");
  return {
    cat, hits, chosen: jiang,
    why: `所列几神${inN ? "都入" : "都不入"}课传，不用兼神、只取将神（「皆入皆不入不用兼神責將神」）`,
  };
}
