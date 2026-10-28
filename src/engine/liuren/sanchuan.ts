/**
 * 大六壬 · 三传（九宗门发用）。
 *
 * **这是整个六壬最容易写错、也最看不出写错的地方。** 三传错了，盘面照样像模像样，
 * 用户的 AI 只会把错盘解得头头是道。所以本模块的每一条分支都单独成函数、单独标注
 * 把握程度，并由 `CONFIDENCE` 导出，供界面与对拍报告如实呈现。
 *
 * 发用次第（本软件采用的检查顺序）：
 *   伏吟 → 返吟 → 贼克（重审/元首）→ 比用（知一）→ 涉害 → 遥克（蒿矢/弹射）
 *   → 别责 → 八专 → 昴星
 *
 * 把握程度分三档：
 *   confirmed  —— 各家一致，且结构上不可能有别解
 *   likely     —— 通行法如此，但细节（方向、取法）尚待对拍确认
 *   disputed   —— 已知各家不同，必须在界面并列提示（§3#6）
 */
import {
  chong, dunGan, ganYang, mengZhongJi, SI_MENG, SI_ZHONG,
  zhiAt, zhiIndex, type Gan, type Zhi,
} from "./ganzhi.js";
import type { Ke, PlatePair, SiKe } from "./plate.js";

/** 每条宗门规则的把握程度，如实对外呈现，不含糊。 */
export const CONFIDENCE: Readonly<Record<string, "confirmed" | "likely" | "disputed">> =
  Object.freeze({
    贼克: "confirmed",
    元首: "confirmed",
    重审: "confirmed",
    比用: "confirmed",
    涉害: "disputed",   // 深浅的数法与方向，各家不同
    遥克: "likely",
    昴星: "likely",
    别责: "likely",
    八专: "disputed",   // 八专日的认定范围各家不同（寄宫同位 vs 干支同五行）
    伏吟: "likely",
    返吟: "likely",
  });

/** 三刑。辰午酉亥为自刑。 */
export const XING: Readonly<Record<string, Zhi>> = Object.freeze({
  子: "卯", 卯: "子",
  寅: "巳", 巳: "申", 申: "寅",
  丑: "戌", 戌: "未", 未: "丑",
  辰: "辰", 午: "午", 酉: "酉", 亥: "亥",
});
export const isZixing = (z: string): boolean => XING[z] === z;

/** 驿马：申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳。 */
export function yima(zhi: string): Zhi {
  const i = zhiIndex(zhi) % 4;
  return (["寅", "亥", "申", "巳"] as Zhi[])[i]!;
}

export interface ChuanItem {
  /** 传位：初 / 中 / 末 */
  pos: "初" | "中" | "末";
  zhi: Zhi;
  /** 本旬遁得的天干；逢旬空则 null */
  dun: Gan | null;
}

export interface SanchuanResult {
  chuan: [ChuanItem, ChuanItem, ChuanItem];
  /** 课体名，如「重审课」「涉害课·见机」 */
  keti: string;
  /** 所用宗门，对应 CONFIDENCE 的键 */
  gate: string;
  /** 这一步是怎么定下来的，逐句人话，供界面与导出直接引用 */
  derivation: string[];
  /** 本次用到的规则里把握最低的那一档 */
  confidence: "confirmed" | "likely" | "disputed";
  /** 若本盘踩中已知门派分歧，这里给出并列说明 */
  disputeNote: string | null;
}

const posOf = (i: number) => (["初", "中", "末"] as const)[i]!;

function mkChuan(zs: [Zhi, Zhi, Zhi], dayGanZhi: string): [ChuanItem, ChuanItem, ChuanItem] {
  return zs.map((z, i) => ({ pos: posOf(i), zhi: z, dun: dunGan(dayGanZhi, z) })) as
    [ChuanItem, ChuanItem, ChuanItem];
}

/** 自初传起，沿天盘连取三支（中传=初传的上神，末传=中传的上神）。 */
function chainFrom(plate: PlatePair, chu: Zhi): [Zhi, Zhi, Zhi] {
  const zhong = plate.tian[chu]!;
  const mo = plate.tian[zhong]!;
  return [chu, zhong, mo];
}

/** 与日干比：同阴阳为「比」。涉害、比用都用这个判。 */
const biWithGan = (gan: Gan, z: string) => ganYang(gan) === (zhiIndex(z) % 2 === 0);

/**
 * 涉害深浅。
 *
 * ⚠ **本项为已知分歧点，标 disputed。** 通行说法是「天盘之神涉历地盘之家，受克多者为用」：
 * 把该上神从它所乘的地盘位，数回它自己的地盘本家，沿途经过的地盘各支中，
 * 克它的有几个，即为「涉害深浅」。深者（受克多者）发用。
 * 各家分歧在：数的方向（顺行还是逆行）、起讫是否含两端、以及只数克它的还是连生它的一并计。
 * 本软件采「自所乘位逆行回本家、不含起点含终点、只数克它者」，待对拍修正。
 */
export function sheHaiDepth(plate: PlatePair, shang: Zhi): number {
  const seat = plate.diOf[shang]!;          // 该神所乘的地盘位
  const home = shang;                        // 它自己的地盘本家
  let depth = 0;
  let i = zhiIndex(seat);
  const end = zhiIndex(home);
  for (let step = 0; step < 12; step++) {
    i = ((i - 1) % 12 + 12) % 12;            // 逆行一位
    const z = zhiAt(i);
    if (zhiKeZhi(z, shang)) depth += 1;      // 途经之地克此神者计一
    if (i === end) break;
  }
  return depth;
}

import { ZHI_WUXING, ke as wuxingKe } from "./ganzhi.js";
const zhiKeZhi = (a: string, b: string) => wuxingKe(ZHI_WUXING[a]!, ZHI_WUXING[b]!);

/**
 * 多克取一：先比用，比用不决则涉害，涉害不决则孟仲季。
 * 返回选中的课与推导说明。
 */
function pickAmong(
  cands: Ke[], gan: Gan, plate: PlatePair,
): { picked: Ke; gate: string; keti: string; steps: string[]; dispute: string | null } {
  const steps: string[] = [];

  // 一、比用：取与日干同阴阳者
  const bi = cands.filter((k) => biWithGan(gan, k.shang));
  if (bi.length === 1) {
    steps.push(`多处相克，取与日干${ganYang(gan) ? "阳" : "阴"}性相同的 ${bi[0]!.shang} 发用（比用）`);
    return { picked: bi[0]!, gate: "比用", keti: "知一课（比用）", steps, dispute: null };
  }
  const pool = bi.length > 1 ? bi : cands;
  if (bi.length > 1) steps.push(`与日干同性者有 ${bi.length} 个，比用不决，转涉害`);
  else steps.push(`无一与日干同性，比用不决，转涉害`);

  // 二、涉害：受克深者发用
  const depths = pool.map((k) => ({ k, d: sheHaiDepth(plate, k.shang) }));
  const max = Math.max(...depths.map((x) => x.d));
  const deepest = depths.filter((x) => x.d === max);
  steps.push(
    "涉害深浅：" + depths.map((x) => `${x.k.shang} 历地受克 ${x.d}`).join("、") +
    `，最深 ${max}`,
  );
  if (deepest.length === 1) {
    return {
      picked: deepest[0]!.k, gate: "涉害", keti: "涉害课", steps,
      dispute: "涉害深浅的数法（方向、起讫、是否兼计生者）各家不同，本软件采逆行回本家、只计克者。",
    };
  }

  // 三、深浅相等：取**临孟**者（见机），无则取**临仲**者（察微）。
  // 要点：孟仲季看的是该神**所乘的地盘位**，不是神本身——涉害论的就是「历地」，
  // 立足之地才是关键。（2026-10-28 与现成排盘对拍时修正：原按神本身判，
  // 乙亥日未时一课即与各家不合。）
  const seatOf = (k: Ke) => plate.diOf[k.shang]!;
  const meng = deepest.filter((x) => (SI_MENG as readonly string[]).includes(seatOf(x.k)));
  if (meng.length) {
    const k = meng[0]!.k;
    steps.push(`深浅相等，取临四孟（${seatOf(k)}）的 ${k.shang} 发用（见机）`);
    return {
      picked: k, gate: "涉害", keti: "涉害课·见机", steps,
      dispute: "涉害深浅相等时的取法（见机/察微/复等）各家不同。",
    };
  }
  const zhong = deepest.filter((x) => (SI_ZHONG as readonly string[]).includes(seatOf(x.k)));
  if (zhong.length) {
    const k = zhong[0]!.k;
    steps.push(`深浅相等且无临孟者，取临四仲（${seatOf(k)}）的 ${k.shang} 发用（察微）`);
    return {
      picked: k, gate: "涉害", keti: "涉害课·察微", steps,
      dispute: "涉害深浅相等时的取法各家不同。",
    };
  }
  steps.push(`深浅相等且临孟临仲皆无，取课序在先的 ${deepest[0]!.k.shang} 发用`);
  return {
    picked: deepest[0]!.k, gate: "涉害", keti: "涉害课·复等", steps,
    dispute: "涉害复等（临孟临仲皆无）时的取法各家不同，本软件取课序在先者。",
  };
}

/** 伏吟课：天地盘重叠。 */
function fuyinSanchuan(sike: SiKe, plate: PlatePair, dayGanZhi: string): SanchuanResult {
  const steps = ["月将与占时同支，天地盘重叠，为伏吟课"];
  const zei = sike.ke.filter((k) => k.xiaZeiShang);
  const kelist = sike.ke.filter((k) => k.shangKeXia);
  let chu: Zhi;
  let keti: string;

  if (zei.length || kelist.length) {
    const cands = zei.length ? zei : kelist;
    if (cands.length === 1) {
      chu = cands[0]!.shang;
      steps.push(`伏吟有克，依贼克法取 ${chu} 发用`);
    } else {
      const r = pickAmong(cands, sike.gan, plate);
      chu = r.picked.shang;
      steps.push(...r.steps);
    }
    keti = "伏吟课（有克）";
  } else {
    const yang = ganYang(sike.gan);
    chu = yang ? sike.ganShang : sike.zhiShang;
    steps.push(`伏吟无克，${yang ? "刚（阳）日取干上神" : "柔（阴）日取支上神"} ${chu} 发用`);
    keti = yang ? "伏吟课·自任" : "伏吟课·自信";
  }

  // 中传取初传之刑；若初传自刑，阳日改取支上神、阴日改取干上神；末传取中传之刑，
  // 中传再自刑则取其冲。
  let zhong: Zhi;
  if (isZixing(chu)) {
    zhong = ganYang(sike.gan) ? sike.zhiShang : sike.ganShang;
    steps.push(`初传 ${chu} 自刑，中传改取${ganYang(sike.gan) ? "支" : "干"}上神 ${zhong}`);
  } else {
    zhong = XING[chu]!;
    steps.push(`中传取初传之刑：${chu} 刑 ${zhong}`);
  }
  const mo: Zhi = isZixing(zhong) ? chong(zhong) : XING[zhong]!;
  steps.push(isZixing(zhong) ? `中传 ${zhong} 自刑，末传取其冲 ${mo}` : `末传取中传之刑：${zhong} 刑 ${mo}`);

  return {
    chuan: mkChuan([chu, zhong, mo], dayGanZhi), keti, gate: "伏吟",
    derivation: steps, confidence: CONFIDENCE["伏吟"]!,
    disputeNote: "伏吟自刑时中末传的取法各家略异，本软件采「阳日取支上、阴日取干上，末取中之刑，中再自刑则取冲」。",
  };
}

/** 返吟课：天地盘对冲。 */
function fanyinSanchuan(sike: SiKe, plate: PlatePair, dayGanZhi: string): SanchuanResult {
  const steps = ["月将与占时相冲，天地盘对冲，为返吟课"];
  const zei = sike.ke.filter((k) => k.xiaZeiShang);
  const kelist = sike.ke.filter((k) => k.shangKeXia);
  const cands = zei.length ? zei : kelist;

  if (cands.length) {
    let chu: Zhi;
    if (cands.length === 1) {
      chu = cands[0]!.shang;
      steps.push(`返吟有克，依贼克法取 ${chu} 发用`);
    } else {
      const r = pickAmong(cands, sike.gan, plate);
      chu = r.picked.shang;
      steps.push(...r.steps);
    }
    const [c, z, m] = chainFrom(plate, chu);
    steps.push(`中末依天盘顺取：${c} → ${z} → ${m}`);
    return {
      chuan: mkChuan([c, z, m], dayGanZhi), keti: "返吟课（有克）", gate: "返吟",
      derivation: steps, confidence: CONFIDENCE["返吟"]!, disputeNote: null,
    };
  }

  // 无克：无依课（井栏射），取驿马发用
  const ma = yima(sike.zhi);
  steps.push(`返吟无克，取日支 ${sike.zhi} 的驿马 ${ma} 发用（无依课）`);
  steps.push(`中传取支上神 ${sike.zhiShang}，末传取干上神 ${sike.ganShang}`);
  return {
    chuan: mkChuan([ma, sike.zhiShang, sike.ganShang], dayGanZhi),
    keti: "返吟课·无依（井栏射）", gate: "返吟",
    derivation: steps, confidence: CONFIDENCE["返吟"]!,
    disputeNote: "返吟无克时的取法（驿马发用与中末次第）各家略异。",
  };
}

/**
 * 八专日：日干寄宫与日支同位，四课塌缩。
 * ⚠ 分歧：另有一说把干支同五行者（乙卯、戊戌、辛酉）也算八专，凑足「八专」之数。
 * 本软件只认寄宫同位这一结构性定义——因为只有它会真的使四课塌缩。
 */
export function isBazhuan(sike: SiKe): boolean {
  return sike.jigong === sike.zhi;
}

/** 主入口：由四课与天地盘求三传。 */
export function deriveSanchuan(
  sike: SiKe, plate: PlatePair, dayGanZhi: string,
): SanchuanResult {
  if (plate.fuyin) return fuyinSanchuan(sike, plate, dayGanZhi);
  if (plate.fanyin) return fanyinSanchuan(sike, plate, dayGanZhi);

  const steps: string[] = [];
  const zei = sike.ke.filter((k) => k.xiaZeiShang);
  const kelist = sike.ke.filter((k) => k.shangKeXia);

  // ── 一、贼克法 ──────────────────────────────────────────────────────
  if (zei.length || kelist.length) {
    const useZei = zei.length > 0;
    const cands = useZei ? zei : kelist;
    steps.push(
      useZei
        ? `四课中下贼上者 ${zei.length} 处：${zei.map((k) => k.label).join("、")}`
        : `四课无下贼上；上克下者 ${kelist.length} 处：${kelist.map((k) => k.label).join("、")}`,
    );
    if (cands.length === 1) {
      const chu = cands[0]!.shang;
      const keti = useZei ? "重审课" : "元首课";
      steps.push(`只此一处，取其上神 ${chu} 发用（${keti}）`);
      const [c, z, m] = chainFrom(plate, chu);
      steps.push(`中末依天盘顺取：${c} → ${z} → ${m}`);
      return {
        chuan: mkChuan([c, z, m], dayGanZhi), keti, gate: "贼克",
        derivation: steps, confidence: CONFIDENCE["贼克"]!, disputeNote: null,
      };
    }
    const r = pickAmong(cands, sike.gan, plate);
    steps.push(...r.steps);
    const [c, z, m] = chainFrom(plate, r.picked.shang);
    steps.push(`中末依天盘顺取：${c} → ${z} → ${m}`);
    return {
      chuan: mkChuan([c, z, m], dayGanZhi), keti: r.keti, gate: r.gate,
      derivation: steps, confidence: CONFIDENCE[r.gate] ?? "likely",
      disputeNote: r.dispute,
    };
  }

  // ── 二、遥克 ────────────────────────────────────────────────────────
  steps.push("四课上下无克");
  const ganWx = GAN_WX(sike.gan);
  const shangs = sike.ke.map((k) => k.shang);
  const haoshi = shangs.filter((s) => wuxingKe(ZHI_WUXING[s]!, ganWx));   // 上神克日干
  const tanshe = shangs.filter((s) => wuxingKe(ganWx, ZHI_WUXING[s]!));   // 日干克上神
  if (haoshi.length || tanshe.length) {
    const useHao = haoshi.length > 0;
    const pool = useHao ? haoshi : tanshe;
    steps.push(
      useHao
        ? `有上神遥克日干：${haoshi.join("、")}（蒿矢）`
        : `无上神克日干；日干遥克上神：${tanshe.join("、")}（弹射）`,
    );
    let chu = pool[0]!;
    if (pool.length > 1) {
      const bi = pool.filter((s) => biWithGan(sike.gan, s));
      chu = (bi.length ? bi : pool)[0]!;
      steps.push(`多处遥克，取与日干同性的 ${chu} 发用`);
    }
    const [c, z, m] = chainFrom(plate, chu);
    steps.push(`中末依天盘顺取：${c} → ${z} → ${m}`);
    return {
      chuan: mkChuan([c, z, m], dayGanZhi),
      keti: useHao ? "遥克课·蒿矢" : "遥克课·弹射", gate: "遥克",
      derivation: steps, confidence: CONFIDENCE["遥克"]!, disputeNote: null,
    };
  }

  // ── 三、别责（四课不备）────────────────────────────────────────────
  if (sike.bubei && !isBazhuan(sike)) {
    steps.push(`四课不备（实得 ${sike.distinct} 课），无克无遥克，为别责课`);
    const yang = ganYang(sike.gan);
    let chu: Zhi;
    if (yang) {
      const hegan = GAN_HE[sike.gan]!;
      chu = plate.tian[JIGONG_OF(hegan)]!;
      steps.push(`阳日取日干 ${sike.gan} 之合干 ${hegan}（寄${JIGONG_OF(hegan)}）的上神 ${chu} 发用`);
    } else {
      chu = zhiAt(zhiIndex(sike.zhi) + 4);
      steps.push(`阴日取日支 ${sike.zhi} 三合前一位 ${chu} 发用`);
    }
    steps.push(`中末俱取干上神 ${sike.ganShang}`);
    return {
      chuan: mkChuan([chu, sike.ganShang, sike.ganShang], dayGanZhi),
      keti: "别责课（芜淫）", gate: "别责",
      derivation: steps, confidence: CONFIDENCE["别责"]!,
      disputeNote: "别责发用（阳取干合上神、阴取支前三合）各家表述略异。",
    };
  }

  // ── 四、八专 ────────────────────────────────────────────────────────
  if (isBazhuan(sike)) {
    steps.push(`日干寄宫与日支同位（${sike.jigong}），四课塌缩，为八专课`);
    const yang = ganYang(sike.gan);
    let chu: Zhi;
    if (yang) {
      chu = zhiAt(zhiIndex(sike.ganShang) + 2);
      steps.push(`阳日自干上神 ${sike.ganShang} 顺数三位，取 ${chu} 发用`);
    } else {
      chu = zhiAt(zhiIndex(sike.ke[3]!.shang) - 2);
      steps.push(`阴日自第四课上神 ${sike.ke[3]!.shang} 逆数三位，取 ${chu} 发用`);
    }
    steps.push(`中末俱取干上神 ${sike.ganShang}`);
    return {
      chuan: mkChuan([chu, sike.ganShang, sike.ganShang], dayGanZhi),
      keti: "八专课（独足）", gate: "八专",
      derivation: steps, confidence: CONFIDENCE["八专"]!,
      disputeNote: "八专日的认定范围（寄宫同位 vs 兼取干支同五行）与发用数法，各家不同。",
    };
  }

  // ── 五、昴星 ────────────────────────────────────────────────────────
  steps.push("四课无克、无遥克，四课亦备，为昴星课");
  const yang = ganYang(sike.gan);
  let chu: Zhi;
  if (yang) {
    chu = plate.tian["酉"]!;
    steps.push(`阳日取地盘酉位上神 ${chu} 发用（虎视转蓬）`);
    steps.push(`中传取支上神 ${sike.zhiShang}，末传取干上神 ${sike.ganShang}`);
    return {
      chuan: mkChuan([chu, sike.zhiShang, sike.ganShang], dayGanZhi),
      keti: "昴星课·虎视转蓬", gate: "昴星",
      derivation: steps, confidence: CONFIDENCE["昴星"]!,
      disputeNote: "昴星取「酉上神/酉下神」的表述各家略异，须以对拍为准。",
    };
  }
  chu = plate.diOf["酉"]!;
  steps.push(`阴日取天盘酉所临地盘位 ${chu} 发用（冬蛇掩目）`);
  steps.push(`中传取干上神 ${sike.ganShang}，末传取支上神 ${sike.zhiShang}`);
  return {
    chuan: mkChuan([chu, sike.ganShang, sike.zhiShang], dayGanZhi),
    keti: "昴星课·冬蛇掩目", gate: "昴星",
    derivation: steps, confidence: CONFIDENCE["昴星"]!,
    disputeNote: "昴星取「酉上神/酉下神」的表述各家略异，须以对拍为准。",
  };
}

// ── 辅助 ────────────────────────────────────────────────────────────────
import { GAN_WUXING, JIGONG } from "./ganzhi.js";
const GAN_WX = (g: Gan) => GAN_WUXING[g]!;
const JIGONG_OF = (g: string) => JIGONG[g]!;
/** 天干五合：甲己、乙庚、丙辛、丁壬、戊癸。 */
export const GAN_HE: Readonly<Record<string, Gan>> = Object.freeze({
  甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛",
  辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊",
});

export { mengZhongJi };
