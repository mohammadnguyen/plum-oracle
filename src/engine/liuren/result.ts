/**
 * 大六壬 · 契约对象 LiurenResult。
 *
 * 与梅花的 CastResult 同一地位：确定性层的唯一产出，界面与导出 Prompt 都只消费它，
 * 不得在别处另算。所有中间量（月将、天地盘、四课、三传推导链、天将、空亡）全部带齐，
 * 一步都不省——「每一句解读挂靠盘面依据」要成立，盘面就得先把依据摆全。
 */
import { Solar } from "lunar-javascript";
import {
  DIZHI, JIGONG, ZHI_WUXING, GAN_WUXING, chong, xunKong, zhiIndex,
  type Gan, type Wuxing, type Zhi,
} from "./ganzhi.js";
import { buildPlate, buildSiKe, isZhou, ZHOU_YE_RULE, type PlatePair, type SiKe } from "./plate.js";
import { deriveSanchuan, type SanchuanResult } from "./sanchuan.js";
import { buildTianjiang, byDiPlate, DEFAULT_GUIREN_RULE, type GuirenRule, type TianjiangResult } from "./tianjiang.js";
import { yuejiangAt, JIANG_NAME, type YuejiangInfo } from "./yuejiang.js";

export interface LiurenInput {
  /** 起课时刻（默认此刻）。日干支按 §3#4 的 23:00 换日口径取。 */
  at: Date;
  /** 占时地支。默认取起课时刻所在时辰；可手改（原书「以来人报时为占时」）。 */
  zhanshi?: Zhi;
  /** 贵人起例，默认「甲戊庚牛羊」 */
  guirenRule?: GuirenRule;
  /** 问卦人原话 */
  question?: string | null;
}

export interface LiurenResult {
  /** 起课输入的人读摘要 */
  input: {
    gregorian: string;
    dayGanZhi: string;
    gan: Gan;
    zhi: Zhi;
    zhanshi: Zhi;
    zhouye: "昼" | "夜";
    rolled: boolean;
    note: string;
  };
  yuejiang: YuejiangInfo & { jiangName: string };
  plate: PlatePair;
  /** 地盘顺序的盘面行，界面直接渲染这一份 */
  rows: Array<{ di: Zhi; tian: Zhi; jiang: string; kong: boolean }>;
  sike: SiKe;
  sanchuan: SanchuanResult;
  tianjiang: TianjiangResult;
  /** 旬空二支 */
  kongwang: [Zhi, Zhi];
  xunshou: string;
  /** 三传的生克、空亡、天将旁注——断语要挂的依据都在这里 */
  chuanDetail: Array<{
    pos: "初" | "中" | "末";
    zhi: Zhi;
    wuxing: Wuxing;
    dun: Gan | null;
    jiang: string;
    kong: boolean;
    /** 与日干的关系：生干/克干/干生/干克/比和 */
    relToGan: string;
  }>;
  /** 本盘踩中的门派分歧，逐条并列，不替用户裁决 */
  disputes: string[];
  /** 本盘所用规则的把握程度（取最低一档） */
  confidence: "confirmed" | "likely" | "disputed";
  question: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 日干与某地支的关系，以日干为主（与梅花「以体为主」同一思路）。 */
function relToGan(gan: Gan, z: Zhi): string {
  const g = GAN_WUXING[gan]!;
  const v = ZHI_WUXING[z]!;
  const SHENG: Record<Wuxing, Wuxing> = { 金: "水", 水: "木", 木: "火", 火: "土", 土: "金" };
  const KE: Record<Wuxing, Wuxing> = { 金: "木", 木: "土", 土: "水", 水: "火", 火: "金" };
  if (v === g) return "比和";
  if (SHENG[v] === g) return "生日干";
  if (SHENG[g] === v) return "日干生";
  if (KE[v] === g) return "克日干";
  if (KE[g] === v) return "日干克";
  return "—";
}

const LEVEL = { confirmed: 0, likely: 1, disputed: 2 } as const;

/** 起课主入口。纯函数：同一输入永远同一盘。 */
export function divineLiuren(input: LiurenInput): LiurenResult {
  const at = input.at;
  const solar = Solar.fromYmdHms(
    at.getFullYear(), at.getMonth() + 1, at.getDate(),
    at.getHours(), at.getMinutes(), at.getSeconds(),
  );
  const lunar = solar.getLunar();

  // 日干支按 23:00 换日（§3#4，与梅花同一软件约定），库里 Exact 即此口径
  const dayGanZhi = lunar.getDayInGanZhiExact();
  const rolled = dayGanZhi !== lunar.getDayInGanZhi();
  const gan = dayGanZhi[0]! as Gan;
  const zhi = dayGanZhi.slice(1) as Zhi;

  const zhanshi = (input.zhanshi ?? lunar.getTimeZhi()) as Zhi;
  const yj = yuejiangAt(at);
  const plate = buildPlate(yj.zhi, zhanshi);
  const sike = buildSiKe(plate, gan, zhi);
  const sanchuan = deriveSanchuan(sike, plate, dayGanZhi);
  const zhou = isZhou(zhanshi);
  const tj = buildTianjiang(gan, zhou, plate, input.guirenRule ?? DEFAULT_GUIREN_RULE);
  const { xunshou, kongwang } = xunKong(dayGanZhi);

  const isKong = (z: string) => (kongwang as readonly string[]).includes(z);

  const rows = byDiPlate(plate, tj).map((r) => ({
    di: r.di, tian: r.tian, jiang: r.jiang as string, kong: isKong(r.tian),
  }));

  const chuanDetail = sanchuan.chuan.map((c) => ({
    pos: c.pos, zhi: c.zhi, wuxing: ZHI_WUXING[c.zhi]!, dun: c.dun,
    jiang: tj.byTian[c.zhi] as string, kong: isKong(c.zhi),
    relToGan: relToGan(gan, c.zhi),
  }));

  const disputes: string[] = [];
  if (sanchuan.disputeNote) disputes.push(sanchuan.disputeNote);
  if (tj.disputeNote) disputes.push(tj.disputeNote);
  disputes.push(
    `昼夜之分：本软件以「${ZHOU_YE_RULE}」为界（本盘为${zhou ? "昼" : "夜"}占）；` +
    "另一说以实际日出日入为界，随节令与纬度浮动。此项决定取昼贵还是夜贵：按另一说若本盘昼夜归属不同，" +
    "贵人随之换位，十二天将整体跟着变；天地盘与三传不变。",
  );

  const confidence = ([sanchuan.confidence] as const).reduce(
    (a, b) => (LEVEL[a] >= LEVEL[b] ? a : b),
    "confirmed" as "confirmed" | "likely" | "disputed",
  );

  return {
    input: {
      gregorian: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`,
      dayGanZhi, gan, zhi, zhanshi, zhouye: zhou ? "昼" : "夜", rolled,
      note:
        `日干支 ${dayGanZhi}` + (rolled ? "（23 时起算次日，软件约定，非原书所定）" : "") +
        `｜占时 ${zhanshi}｜${zhou ? "昼" : "夜"}占`,
    },
    yuejiang: { ...yj, jiangName: JIANG_NAME[yj.zhi]! },
    plate, rows, sike, sanchuan, tianjiang: tj,
    kongwang, xunshou, chuanDetail, disputes, confidence,
    question: (input.question ?? "").trim() || null,
  };
}

/** 四课的人读标签：右起一课，依原书书写次第。 */
export function sikeLabels(r: LiurenResult): string[] {
  return r.sike.ke.map((k) => {
    const xia = k.index === 1 ? `${k.xia}(寄${JIGONG[k.xia]!})` : k.xia;
    const rel = k.xiaZeiShang ? "下贼上" : k.shangKeXia ? "上克下" : "无克";
    return `第${["一", "二", "三", "四"][k.index - 1]}课 ${k.shang}/${xia}　${rel}`;
  });
}

/** 盘面冲合旁注，供取象用。 */
export function chongHe(z: Zhi): { chong: Zhi } {
  return { chong: chong(z) };
}

export { DIZHI, zhiIndex };
