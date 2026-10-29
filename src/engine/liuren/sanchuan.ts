/**
 * 大六壬 · 三传（九宗门发用）。
 *
 * **这是整个六壬最容易写错、也最看不出写错的地方。** 三传错了，盘面照样像模像样，
 * 用户的 AI 只会把错盘解得头头是道。所以本模块的每一条分支都单独成函数、单独标注
 * 把握程度，并由 `CONFIDENCE` 导出，供界面与对拍报告如实呈现。
 *
 * 发用次第（本软件采用的检查顺序）：
 *   伏吟 → 返吟 → 贼克（重审/元首）→ 比用（知一）→ 涉害 → 八专（八专日无克即用）
 *   → 遥克（蒿矢/弹射）→ 别责 → 昴星
 *
 * 把握程度分三档：
 *   confirmed  —— 各家一致，且结构上不可能有别解
 *   likely     —— 通行法如此，但细节（方向、取法）尚待对拍确认
 *   disputed   —— 已知各家不同，必须在界面并列提示（§3#6）
 */
import {
  chong, dunGan, GAN_WUXING, ganYang, JIGONG, ke as wuxingKe, mengZhongJi, sheng, SI_MENG, SI_ZHONG,
  ZHI_WUXING, zhiAt, zhiIndex, type Gan, type Wuxing, type Zhi,
} from "./ganzhi.js";
import type { Ke, PlatePair, SiKe } from "./plate.js";

/**
 * 每条宗门规则的把握程度，如实对外呈现，不含糊。
 *
 * 评级口径（2026-10-28 两轮对拍后更新）：
 *   confirmed —— 已与外部独立实现逐传比对通过，且无悬而未决的问题
 *   likely    —— 取法已对上，但规则本身仍有未解的部分
 *   disputed  —— 已知各家不同，必须并列提示（§3#6）
 *
 * 九门现已全部被对拍覆盖（见 tests/liuren-crosscheck.test.ts 的覆盖断言）。
 */
export const CONFIDENCE: Readonly<Record<string, "confirmed" | "likely" | "disputed">> =
  Object.freeze({
    贼克: "confirmed",
    元首: "confirmed",
    重审: "confirmed",
    比用: "confirmed",
    // 2026-10-29 改从《六壬大全》卷五订讹（计深浅→孟→仲→复等），原书五例与两家网页三组皆合；
    // 但并列的孟仲季直取、比用格两说在部分课上取出不同三传——那些盘逐盘降为 disputed。
    涉害: "likely",
    遥克: "confirmed",
    昴星: "confirmed",
    别责: "confirmed",
    // 八专日五日、无克即取、不看遥克，皆依《六壬大全》卷五原例；
    // 同卷订讹另有「無克又無遥克」一注，八专日有遥克的盘逐盘降为 disputed。
    八专: "likely",
    伏吟: "confirmed",
    返吟: "confirmed",
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
  /** 并列各说若取出不同的三传，逐条写明（与本法相同则不列） */
  altNotes: string[];
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

/** 并列一说取出的三传，写成一句给盘面。 */
const altNote = (rule: string, cz: [Zhi, Zhi, Zhi]) =>
  `${rule}：按此说当取 ${cz[0]} 发用，三传 ${cz.join("→")}。`;

/** 与日干比：同阴阳为「比」。涉害、比用都用这个判。 */
const biWithGan = (gan: Gan, z: string) => ganYang(gan) === (zhiIndex(z) % 2 === 0);

/**
 * 涉害取法——**本软件从《六壬大全》卷五「訂訛」**（2026-10-29 用户决定，见 CLAUDE.md §0.3 ⑧）。
 *
 * 一、计深浅：自该神所乘地盘位起**顺行**，一路数到它的本家（地盘同名之位）为止，
 *     途经各位的地支与寄干，凡与本课克向相同者记一重，**起讫两端都不数**。
 *       下贼上 → 数克它的：「亥加丑土前行歴辰戊未巳戌土五重歸本家」
 *       上克下 → 数它所克的：「午加庚金前行歴酉辛金二重歸本家」
 *     受克重数最多者发用。
 * 二、深浅相等（「渉害俱深」）→ 取临四孟者（见机）→ 无孟取临四仲者（察微）。
 * 三、孟仲季又相等 → 复等（缀瑕）：阳日取干上先见者，阴日取支上先见者。
 *
 * 起讫两端不数，是从原书例子反推定下的：「丑加卯前行只歴辰中乙木一重」（所乘的卯不数），
 * 「辰加寅卯木一重歸本家辰位」（本家辰上寄的乙不数）。
 *
 * 原书逐例写明了重数，tests/liuren.test.ts 逐条锁定。
 * 2026-10-28 与两家网页实现对拍过的三组涉害课，按本法重算结论不变。
 *
 * 并列的两说（盘面「门派分歧」里写出，不替用户裁决）：
 *   · 不计深浅、直接按所乘地盘位孟仲季取——本软件 2026-10-29 之前的取法；
 *   · 《大全》同卷「比用格」：用神与日干相克者不取，改取生日干或与日干同五行者。
 *     原书此格与同卷订讹在庚子日一例上结论相反，本软件不采。
 */
export const SHEHAI_NOTE =
  "涉害按《六壬大全》卷五订讹取：各克神从所乘地盘位顺行归本家，途中受克重数多者发用；" +
  "深浅相等取临孟者（见机），无孟取临仲者（察微），再相等则阳日取干上、阴日取支上（复等）。";
export const SHEHAI_ALT_MENGZHONG =
  "另一说不计深浅，直接按所乘地盘位孟仲季取（本软件对拍过的两家网页排盘即用此法）";
export const SHEHAI_ALT_BIYONG =
  "《六壬大全》同卷另载「比用格」：用神与日干相克者不取，改取生日干或与日干同五行者。" +
  "原书此格与同卷订讹在庚子日一例上结论相反，本软件不采";

/** 地盘每一位上寄着哪些天干（巳寄丙戊、未寄丁己）。涉害计深浅要连它们一并数。 */
const JIGAN_AT: Readonly<Record<string, Gan[]>> = (() => {
  const m: Record<string, Gan[]> = {};
  for (const [g, z] of Object.entries(JIGONG)) (m[z] ??= []).push(g as Gan);
  return Object.freeze(m);
})();

export interface ShehaiDepth {
  /** 受克重数 */
  n: number;
  /** 记了重数的那些字，按途经次序 */
  hits: string[];
}

/** 涉害深浅：该克神从所乘地盘位顺行归本家，途中受克（或所克）几重。 */
export function shehaiDepth(k: Ke, plate: PlatePair): ShehaiDepth {
  const s = k.shang;
  const sw = ZHI_WUXING[s]!;
  const counts = (w: Wuxing) => (k.xiaZeiShang ? wuxingKe(w, sw) : wuxingKe(sw, w));
  const hits: string[] = [];
  const seat = zhiIndex(plate.diOf[s]!);
  for (let i = 1; i < 12; i++) {
    const pos = zhiAt(seat + i);
    if (pos === s) break;
    if (counts(ZHI_WUXING[pos]!)) hits.push(pos);
    for (const g of JIGAN_AT[pos] ?? []) if (counts(GAN_WUXING[g]!)) hits.push(g);
  }
  return { n: hits.length, hits };
}

const CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一"];
const describeDepth = (k: Ke, d: ShehaiDepth, plate: PlatePair) =>
  `${k.shang}临${plate.diOf[k.shang]}${d.n ? `历${d.hits.join("")}` : ""}${CN_NUM[d.n]}重`;

/** 复等：阳日取干上先见者（课序一二三四），阴日取支上先见者（课序三四一二）。 */
function fudengPick(ks: Ke[], gan: Gan): Ke {
  const order = ganYang(gan) ? [1, 2, 3, 4] : [3, 4, 1, 2];
  return [...ks].sort((a, b) => order.indexOf(a.index) - order.indexOf(b.index))[0]!;
}

const isMengSeat = (k: Ke, plate: PlatePair) => (SI_MENG as readonly string[]).includes(plate.diOf[k.shang]!);
const isZhongSeat = (k: Ke, plate: PlatePair) => (SI_ZHONG as readonly string[]).includes(plate.diOf[k.shang]!);

/** 不计深浅、直接按所乘地盘位孟仲季取（2026-10-29 之前的取法），只用来生成并列说明。 */
function pickByMengZhongOnly(pool: Ke[], plate: PlatePair): Ke {
  return pool.find((k) => isMengSeat(k, plate)) ?? pool.find((k) => isZhongSeat(k, plate)) ?? pool[0]!;
}

/** 《大全》比用格会改取哪一个；不改则 null。只用来生成并列说明。 */
function pickByBiyongGe(pool: Ke[], picked: Ke, gan: Gan): Ke | null {
  const gw = GAN_WUXING[gan]!;
  const w = ZHI_WUXING[picked.shang]!;
  if (!wuxingKe(w, gw) && !wuxingKe(gw, w)) return null;
  return pool.find((k) => {
    const kw = ZHI_WUXING[k.shang]!;
    return k.shang !== picked.shang && (kw === gw || sheng(kw, gw));
  }) ?? null;
}

export interface PickAlternative {
  rule: string;
  picked: Ke;
}

/**
 * 多克取一：先比用，比用不决则涉害（计深浅→孟→仲→复等）。
 * 返回选中的课与推导说明；`alternatives` 是并列两说各自会取的那一个（与本法相同则不列）。
 */
function pickAmong(
  cands: Ke[], gan: Gan, plate: PlatePair,
): {
  picked: Ke; gate: string; keti: string; steps: string[]; dispute: string | null;
  alternatives: PickAlternative[];
} {
  const steps: string[] = [];

  // 一、比用：取与日干同阴阳者
  const bi = cands.filter((k) => biWithGan(gan, k.shang));
  if (bi.length === 1) {
    steps.push(`多处相克，取与日干${ganYang(gan) ? "阳" : "阴"}性相同的 ${bi[0]!.shang} 发用（比用）`);
    return { picked: bi[0]!, gate: "比用", keti: "知一课（比用）", steps, dispute: null, alternatives: [] };
  }
  const pool = bi.length > 1 ? bi : cands;
  if (bi.length > 1) steps.push(`与日干同性者有 ${bi.length} 个，比用不决，转涉害`);
  else steps.push(`无一与日干同性，比用不决，转涉害`);

  // 二、涉害：计深浅
  const depths = pool.map((k) => ({ k, d: shehaiDepth(k, plate) }));
  steps.push(
    `各克神顺行归本家，数途中${pool[0]!.xiaZeiShang ? "受克" : "所克"}几重：` +
    depths.filter(({ k }, i) => depths.findIndex((x) => x.k.shang === k.shang) === i)
      .map(({ k, d }) => describeDepth(k, d, plate)).join("；"),
  );
  const max = Math.max(...depths.map(({ d }) => d.n));
  const deepest = depths.filter(({ d }) => d.n === max).map(({ k }) => k);
  // 同一神可能出现在两课（如一课、四课上神相同），说明里只列一次
  const names = (ks: Ke[]) => [...new Set(ks.map((k) => k.shang))].join("、");

  let picked: Ke;
  let keti: string;
  const distinct = (ks: Ke[]) => new Set(ks.map((k) => k.shang)).size;
  if (distinct(deepest) === 1) {
    picked = deepest[0]!;
    keti = "涉害课";
    steps.push(`${picked.shang} 最深（${CN_NUM[max]}重），取其发用`);
  } else {
    steps.push(
      `${names(deepest)} 深浅相等，再看所乘地盘位：` +
      [...new Set(deepest.map((k) => k.shang))]
        .map((z) => `${z}临${plate.diOf[z]}(${mengZhongJi(plate.diOf[z]!)})`).join("、"),
    );
    const meng = deepest.filter((k) => isMengSeat(k, plate));
    const zhong = deepest.filter((k) => isZhongSeat(k, plate));
    if (distinct(meng) === 1) {
      picked = meng[0]!;
      keti = "涉害课·见机";
      steps.push(`取临四孟（${plate.diOf[picked.shang]}）的 ${picked.shang} 发用（见机）`);
    } else if (!meng.length && distinct(zhong) === 1) {
      picked = zhong[0]!;
      keti = "涉害课·察微";
      steps.push(`无临孟者，取临四仲（${plate.diOf[picked.shang]}）的 ${picked.shang} 发用（察微）`);
    } else {
      const tied = meng.length ? meng : zhong.length ? zhong : deepest;
      picked = fudengPick(tied, gan);
      keti = "涉害课·复等";
      steps.push(
        `${names(tied)} 孟仲季又相等，为复等：` +
        `${ganYang(gan) ? "阳日取干上先见" : "阴日取支上先见"}的 ${picked.shang} 发用（第${CN_NUM[picked.index]}课）`,
      );
    }
  }

  const alternatives: PickAlternative[] = [];
  const old = pickByMengZhongOnly(pool, plate);
  if (old.shang !== picked.shang) alternatives.push({ rule: SHEHAI_ALT_MENGZHONG, picked: old });
  const by = pickByBiyongGe(pool, picked, gan);
  if (by) alternatives.push({ rule: SHEHAI_ALT_BIYONG, picked: by });

  return { picked, gate: "涉害", keti, steps, dispute: SHEHAI_NOTE, alternatives };
}

/**
 * 伏吟中末：中传取初传之刑；若初传自刑，改取干上神/支上神中**与初传不同**的那一个；
 * 末传取中传之刑，中传再自刑则取其冲。
 *
 * 为什么不照搬「刚日取支上、柔日取干上」那句口诀：那句话默认初传来自无克一路
 * （刚日初=干上、柔日初=支上），此时取另一个自然不重。但初传若由贼克法取出，
 * 可能正好就是口诀要你取的那一个，照搬就会排出「初＝中」的废传。
 * 2026-10-28 对拍实证：乙亥日丑时伏吟，初传辰（干上神）自刑，照搬口诀中传仍得辰；
 * 各家实际取支上神亥，末取亥之冲巳。故改为「取另一个」。
 */
function fuyinZhongMo(chu: Zhi, sike: SiKe): { zhong: Zhi; mo: Zhi; steps: string[] } {
  const steps: string[] = [];
  let zhong: Zhi;
  if (isZixing(chu)) {
    zhong = chu === sike.ganShang ? sike.zhiShang : sike.ganShang;
    steps.push(`初传 ${chu} 自刑，中传改取${chu === sike.ganShang ? "支" : "干"}上神 ${zhong}`);
  } else {
    zhong = XING[chu]!;
    steps.push(`中传取初传之刑：${chu} 刑 ${zhong}`);
  }
  const mo: Zhi = isZixing(zhong) ? chong(zhong) : XING[zhong]!;
  steps.push(isZixing(zhong) ? `中传 ${zhong} 自刑，末传取其冲 ${mo}` : `末传取中传之刑：${zhong} 刑 ${mo}`);
  return { zhong, mo, steps };
}

/** 伏吟课：天地盘重叠。 */
function fuyinSanchuan(sike: SiKe, plate: PlatePair, dayGanZhi: string): SanchuanResult {
  const steps = ["月将与占时同支，天地盘重叠，为伏吟课"];
  const zei = sike.keEff.filter((k) => k.xiaZeiShang);
  const kelist = sike.keEff.filter((k) => k.shangKeXia);
  let chu: Zhi;
  let keti: string;
  const altNotes: string[] = [];

  if (zei.length || kelist.length) {
    const cands = zei.length ? zei : kelist;
    if (cands.length === 1) {
      chu = cands[0]!.shang;
      steps.push(`伏吟有克，依贼克法取 ${chu} 发用`);
    } else {
      const r = pickAmong(cands, sike.gan, plate);
      chu = r.picked.shang;
      steps.push(...r.steps);
      for (const a of r.alternatives) {
        const zm = fuyinZhongMo(a.picked.shang, sike);
        altNotes.push(altNote(a.rule, [a.picked.shang, zm.zhong, zm.mo]));
      }
    }
    keti = "伏吟课（有克）";
  } else {
    const yang = ganYang(sike.gan);
    chu = yang ? sike.ganShang : sike.zhiShang;
    steps.push(`伏吟无克，${yang ? "刚（阳）日取干上神" : "柔（阴）日取支上神"} ${chu} 发用`);
    keti = yang ? "伏吟课·自任" : "伏吟课·自信";
  }

  const { zhong, mo, steps: zmSteps } = fuyinZhongMo(chu, sike);
  steps.push(...zmSteps);

  return {
    chuan: mkChuan([chu, zhong, mo], dayGanZhi), keti, gate: "伏吟",
    derivation: steps, confidence: CONFIDENCE["伏吟"]!,
    disputeNote: "伏吟自刑时中末传的取法各家略异，本软件采「阳日取支上、阴日取干上，末取中之刑，中再自刑则取冲」。",
    altNotes,
  };
}

/** 返吟课：天地盘对冲。 */
function fanyinSanchuan(sike: SiKe, plate: PlatePair, dayGanZhi: string): SanchuanResult {
  const steps = ["月将与占时相冲，天地盘对冲，为返吟课"];
  const zei = sike.keEff.filter((k) => k.xiaZeiShang);
  const kelist = sike.keEff.filter((k) => k.shangKeXia);
  const cands = zei.length ? zei : kelist;

  if (cands.length) {
    let chu: Zhi;
    const altNotes: string[] = [];
    if (cands.length === 1) {
      chu = cands[0]!.shang;
      steps.push(`返吟有克，依贼克法取 ${chu} 发用`);
    } else {
      const r = pickAmong(cands, sike.gan, plate);
      chu = r.picked.shang;
      steps.push(...r.steps);
      for (const a of r.alternatives) altNotes.push(altNote(a.rule, chainFrom(plate, a.picked.shang)));
    }
    const [c, z, m] = chainFrom(plate, chu);
    steps.push(`中末依天盘顺取：${c} → ${z} → ${m}`);
    return {
      chuan: mkChuan([c, z, m], dayGanZhi), keti: "返吟课（有克）", gate: "返吟",
      derivation: steps, confidence: CONFIDENCE["返吟"]!, disputeNote: null, altNotes,
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
    altNotes: [],
  };
}

/**
 * 八专日：日干寄宫与日支同位，四课塌缩。共五日：甲寅、丁未、己未、庚申、癸丑。
 * 《六壬大全》卷五两处明文：「八專日有五」，觀月經注「五日者癸丑甲寅丁未己未庚申是也」。
 * 癸丑日四课必有克，实际不会走到八专取法（原书「除癸丑日俱有克」）。
 * 另有一说把干支同五行者（乙卯、戊戌、辛酉）也算八专，盘面一并列出。
 */
export function isBazhuan(sike: SiKe): boolean {
  return sike.jigong === sike.zhi;
}

export const BAZHUAN_NOTE =
  "八专按《六壬大全》卷五取：八专日只有五日（甲寅、丁未、己未、庚申、癸丑），四课上下无克即取八专，" +
  "阳日自干上神顺数三位、阴日自第四课上神逆数三位发用，不看遥克。" +
  "另有一说把干支同五行的乙卯、戊戌、辛酉也算作八专日。";
export const BAZHUAN_ALT_YAOKE =
  "《六壬大全》同卷订讹一处注作「八專無克又無遥克」，即有遥克先取遥克（与该书所举甲寅、己未两例不合）";

/** 遥克：上神遥克日干（蒿矢）优先，无则日干遥克上神（弹射）；多处取与日干同性者。无遥克则 null。 */
function yaokeOf(sike: SiKe): { chu: Zhi; useHao: boolean; steps: string[] } | null {
  const ganWx = GAN_WX(sike.gan);
  const shangs = sike.ke.map((k) => k.shang);
  const haoshi = shangs.filter((s) => wuxingKe(ZHI_WUXING[s]!, ganWx));   // 上神克日干
  const tanshe = shangs.filter((s) => wuxingKe(ganWx, ZHI_WUXING[s]!));   // 日干克上神
  if (!haoshi.length && !tanshe.length) return null;
  const useHao = haoshi.length > 0;
  const pool = useHao ? haoshi : tanshe;
  const steps = [
    useHao
      ? `有上神遥克日干：${haoshi.join("、")}（蒿矢）`
      : `无上神克日干；日干遥克上神：${tanshe.join("、")}（弹射）`,
  ];
  let chu = pool[0]!;
  if (pool.length > 1) {
    const bi = pool.filter((s) => biWithGan(sike.gan, s));
    chu = (bi.length ? bi : pool)[0]!;
    steps.push(`多处遥克，取与日干同性的 ${chu} 发用`);
  }
  return { chu, useHao, steps };
}

/**
 * 主入口：由四课与天地盘求三传。
 * 并列各说若在本盘取出不同的三传（`altNotes` 非空），本盘的把握程度一律降为 disputed。
 */
/**
 * 卷十毕法赋第九十三条一说（2026-10-29）：与第一课同位的第二、四课应并入第一课、以日干论克。
 * 它批评的正是通行取法，本软件取通行法（见 plate.ts buildSiKe）；按此说取出不同三传时，并列写明。
 */
export const BIFA93_ALT =
  "《六壬大全》卷十毕法赋第九十三条另一说：与第一课同位的那一课应并入第一课、以日干论克" +
  "（原书「辛酉日干上亥既是辛日豈可便以亥加戌為初傳乎」，并斥之为「時師起三傳尚有錯誤」；" +
  "本软件依通行取法不并；卷一别责之数「戊辰戊午丙辰三剛日各一課辛未二課辛丑二課丁酉辛酉各一課」共九课，亦只在不并时成立）";

export function deriveSanchuan(
  sike: SiKe, plate: PlatePair, dayGanZhi: string,
): SanchuanResult {
  const r = deriveSanchuanByRule(sike, plate, dayGanZhi);
  if (sike.keMerged.length !== sike.keEff.length) {
    const alt = deriveSanchuanByRule({ ...sike, keEff: sike.keMerged }, plate, dayGanZhi);
    const a = alt.chuan.map((c) => c.zhi) as [Zhi, Zhi, Zhi];
    if (a.join("") !== r.chuan.map((c) => c.zhi).join("")) {
      r.altNotes = [...r.altNotes, altNote(BIFA93_ALT, a)];
    }
  }
  return r.altNotes.length ? { ...r, confidence: "disputed" } : r;
}

function deriveSanchuanByRule(
  sike: SiKe, plate: PlatePair, dayGanZhi: string,
): SanchuanResult {
  if (plate.fuyin) return fuyinSanchuan(sike, plate, dayGanZhi);
  if (plate.fanyin) return fanyinSanchuan(sike, plate, dayGanZhi);

  const steps: string[] = [];
  const zei = sike.keEff.filter((k) => k.xiaZeiShang);
  const kelist = sike.keEff.filter((k) => k.shangKeXia);

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
        derivation: steps, confidence: CONFIDENCE["贼克"]!, disputeNote: null, altNotes: [],
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
      altNotes: r.alternatives.map((a) => altNote(a.rule, chainFrom(plate, a.picked.shang))),
    };
  }

  steps.push("四课上下无克");

  // ── 二、八专（无克即用，不看遥克）────────────────────────────────────
  // 《六壬大全》卷五：「八專日有五除癸丑日俱有克無克者甲寅庚申剛日從陽……己未丁未柔日主退縮逆行」，
  // 所举四例（甲寅日辰時丑將、己未日未時酉將、觀月經 庚申日亥將申時、己未日亥將酉時）
  // 四课上下皆无克，却都有遥克可取，书中一律径取八专。故八专日上下无克即走八专，排在遥克之前。
  // 同卷订讹「帷簿不脩」条注作「八專無克又無遥克」，与它自己随后所举的甲寅、己未两例不合，列为分歧。
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
    const yk = yaokeOf(sike);
    if (yk) steps.push(`本课另有遥克（${yk.chu}），八专日不取`);
    return {
      chuan: mkChuan([chu, sike.ganShang, sike.ganShang], dayGanZhi),
      // 「凢八專課逆數到日中末相併為獨足格」：三传同归一神才叫独足
      keti: chu === sike.ganShang ? "八专课·独足" : "八专课", gate: "八专",
      derivation: steps, confidence: CONFIDENCE["八专"]!,
      disputeNote: BAZHUAN_NOTE,
      altNotes: yk ? [altNote(BAZHUAN_ALT_YAOKE, chainFrom(plate, yk.chu))] : [],
    };
  }

  // ── 三、遥克 ────────────────────────────────────────────────────────
  const yk = yaokeOf(sike);
  if (yk) {
    steps.push(...yk.steps);
    const [c, z, m] = chainFrom(plate, yk.chu);
    steps.push(`中末依天盘顺取：${c} → ${z} → ${m}`);
    return {
      chuan: mkChuan([c, z, m], dayGanZhi),
      keti: yk.useHao ? "遥克课·蒿矢" : "遥克课·弹射", gate: "遥克",
      derivation: steps, confidence: CONFIDENCE["遥克"]!, disputeNote: null, altNotes: [],
    };
  }

  // ── 四、别责（四课不备）────────────────────────────────────────────
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
      altNotes: [],
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
      altNotes: [],
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
    altNotes: [],
  };
}

// ── 辅助 ────────────────────────────────────────────────────────────────
const GAN_WX = (g: Gan) => GAN_WUXING[g]!;
const JIGONG_OF = (g: string) => JIGONG[g]!;
/** 天干五合：甲己、乙庚、丙辛、丁壬、戊癸。 */
export const GAN_HE: Readonly<Record<string, Gan>> = Object.freeze({
  甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛",
  辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊",
});

export { mengZhongJi };
