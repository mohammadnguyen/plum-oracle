/**
 * 大六壬 · 导出 Prompt 装配。
 *
 * 与梅花同一条规矩：**盘面在前，要求在后。** 盘面是别处拿不到的部分，
 * 契约随时能重发，盘面丢了这一课白排（梅花那边有 live 取证，见 CLAUDE.md §0.2 ①）。
 *
 * 本站不调用任何 LLM，这里只做确定性文本渲染。
 */
import { DIZHI } from "../engine/liuren/ganzhi.js";
import { CONFIDENCE } from "../engine/liuren/sanchuan.js";
import { JIANG_NAME } from "../engine/liuren/yuejiang.js";
import { sikeLabels, type LiurenResult } from "../engine/liuren/result.js";
import { LIUREN_REQUIREMENTS } from "./liurenRequirements.js";
import { LIUREN_CHAT_REQUIREMENTS } from "./liurenChatRequirements.js";
import { CALENDAR_LIB } from "../engine/lineage.js";
import { leixiangOf, TIANJIANG_SOURCE } from "../engine/liuren/tianjiangLeixiang.js";
import { backgroundLines, FOLLOWUP_LIUREN } from "./conversation.js";
import { citeOf, DAQUAN_QUOTES as DQ } from "../engine/liuren/daquan.js";
import { LIUQIN_BASIS } from "../engine/liuren/liuqin.js";
import { SEASON_NAME, statesLine } from "../engine/liuren/wangxiang.js";
import { GAN_WUXING } from "../engine/liuren/ganzhi.js";
import { LEISHEN_RULES } from "../engine/liuren/leishen.js";
import type { ZhiNote } from "../engine/liuren/result.js";

const CONF_CN: Readonly<Record<string, string>> = Object.freeze({
  confirmed: "已与两家独立排盘实现逐传核过",
  likely: "取法已核对，但其中一步各家仍有不同说法",
  disputed: "本步各家取法不同，下方已并列",
});

/** 盘面事实段：确定性产出，逐项可核。 */
export function liurenFactLines(r: LiurenResult): string[] {
  const L: string[] = [];
  const kong = r.kongwang.join("、");

  L.push(`【起课】${r.input.gregorian}　${r.input.note}`);
  L.push(
    `【月将】${r.yuejiang.zhi}（${r.yuejiang.jiangName}）——据${r.yuejiang.zhongqi}` +
    `（${r.yuejiang.zhongqiTime}）过宫，月将加占时得天地盘。历法换算依赖 ${CALENDAR_LIB}。`,
  );
  L.push(`【旬首】${r.xunshou}　【空亡】${kong}`);
  if (r.plate.fuyin) L.push("【伏吟】月将与占时同支，天地盘重叠。");
  if (r.plate.fanyin) L.push("【返吟】月将与占时相冲，天地盘对冲。");

  L.push("【天地盘】地盘 → 天盘（所乘天将；空=旬空）");
  for (const row of r.rows) {
    L.push(`  ${row.di} → ${row.tian}（${row.jiang}${row.kong ? "·空" : ""}）`);
  }

  L.push("【四课】（右起一课；一二课属日干＝你，三四课属日支＝对方/所问之事）");
  for (const s of sikeLabels(r).reverse()) L.push(`  ${s}`);
  L.push(`  日干 ${r.input.gan} 寄宫 ${r.sike.jigong}　日支 ${r.input.zhi}`);

  L.push(`【课体】${r.sanchuan.keti}（取传：${r.sanchuan.gate}）`);
  L.push("【发用推导】");
  for (const step of r.sanchuan.derivation) L.push(`  · ${step}`);

  L.push("【三传】初→中→末，即发端→经过→落脚");
  for (const c of r.chuanDetail) {
    L.push(
      `  ${c.pos}传 ${c.dun ?? "（旬空无遁干）"}${c.zhi}（${c.wuxing}）` +
      `　乘${c.jiang}${c.kong ? "　【空亡】" : ""}　与日干：${c.relToGan}（六亲：${c.liuqin}）　旺衰：${c.qi}`,
    );
  }

  // 旺相休囚：按月建定季，表与依据均出自《六壬大全》，见 engine/liuren/wangxiang.ts
  const wx = r.wangxiang;
  L.push(
    `【旺相休囚】月建 ${wx.yuejian}，${SEASON_NAME[wx.season]}：${statesLine(wx.states)}。` +
    `日干 ${r.input.gan}（${GAN_WUXING[r.input.gan]}）：${r.ganQi}。`,
  );
  L.push(
    `  依据：${citeOf(DQ.wang)}「${DQ.wang.text}」「${DQ.xiang.text}」，${citeOf(DQ.si)}「${DQ.si.text}」` +
    `「${DQ.qiu.text}」「${DQ.xiu.text}」；季月何者为死原文未列，按${citeOf(DQ.siRule)}「${DQ.siRule.text}」补（土克水，水死）。`,
  );
  L.push(
    `  旺、相即「${DQ.youqi.text}」，休、囚即「${DQ.wuqi.text}」（${citeOf(DQ.youqi)}）；` +
    "死，原书此句未举，本软件归在无气一边。",
  );

  // 六亲：三传里出现的几类，按出现顺序去重
  const seenQ = new Set<string>();
  const lqs = r.chuanDetail.map((c) => c.liuqin).filter((x) => (seenQ.has(x) ? false : (seenQ.add(x), true)));
  L.push(
    `【六亲·有出处】以日干为我定名，录自《六壬大全》（原书无标点，照录）。卷八只举甲乙日为例，` +
    `其余日干「${DQ.fangCi.text}」（${citeOf(DQ.fangCi)}）。`,
  );
  for (const x of lqs) {
    const b = LIUQIN_BASIS[x];
    L.push(
      `  · ${x}（${b.defNote}）：定名依据「${b.def.text}」（${citeOf(b.def)}）；` +
      (b.zhi ? `所指「${b.zhi.text}」（${citeOf(b.zhi)}，原书以甲乙日见此类神为例）。` : "原书此处未写所指。"),
    );
  }

  // 天将类象：只列三传所乘的那几位，按出现顺序去重。原文逐字照录（无标点），带页码与钉死的出处。
  const seen = new Set<string>();
  const lx = r.chuanDetail
    .map((c) => c.jiang)
    .filter((j) => (seen.has(j) ? false : (seen.add(j), true)))
    .map((j) => leixiangOf(j))
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (lx.length) {
    const S = TIANJIANG_SOURCE;
    L.push(
      `【天将类象·有出处】三传所乘天将的主事类象，录自《${S.book}》${S.section}（${S.edition}；` +
      `原书无标点，照录）。出处：${S.url}`,
    );
    for (const x of lx) {
      L.push(`  · ${x.jiang}：「${x.text}」（${x.page.replace(/^KR3g0031_WYG_002-/, "卷二第")}页）`);
    }
  }

  L.push(...leishenLines(r), ...nianmingLines(r), ...bifaLines(r));

  L.push(
    `【本盘所用规则的把握程度】${r.sanchuan.gate}：${CONF_CN[r.sanchuan.confidence] ?? r.sanchuan.confidence}`,
  );
  L.push("【门派分歧·并列呈现，不替问卦人裁决】");
  for (const d of r.disputes) L.push(`  · ${d}`);

  const q = (r.question ?? "").trim();
  if (q) L.push(`【所问之事（问卦人原话）】${q}`);
  return L;
}

/** 某支的旁注：乘将、与日干、六亲、旺衰、空亡。 */
function noteText(n: ZhiNote): string {
  return `乘${n.jiang}　与日干：${n.relToGan}（六亲：${n.liuqin}）　旺衰：${n.qi}${n.kong ? "　【空亡】" : ""}`;
}

/** 【类神·有出处】节。没取类神返回空数组。 */
export function leishenLines(r: LiurenResult): string[] {
  const ls = r.leishen;
  if (!ls) return [];
  const L = [
    `【类神·有出处】所问归为「${ls.cat.label}」（${ls.auto ? "程序按问句自动归类，问课人可改" : "问课人自选"}）。` +
    `口诀「${ls.cat.quote.text}」（${citeOf(ls.cat.quote)}；原书无标点，照录）。`,
  ];
  for (const h of ls.hits) {
    const picked = ls.chosen.includes(h) ? "【取用】" : "";
    if (!h.spots.length) {
      L.push(`  · ${h.name}${picked}：课传中没有。`);
      continue;
    }
    for (const s of h.spots) {
      const head = h.target.kind === "qin"
        ? `${h.name} ${s.zhi}`
        : h.target.kind === "shen" ? `${h.name}` : `${h.name}乘天盘 ${s.zhi}`;
      L.push(
        `  · ${head}${picked}：临地盘 ${s.seat}；${s.where.length ? `在${s.where.join("、")}` : "不在课传（局外）"}。` +
        `${s.zhi} ${noteText(r.noteOf(s.zhi))}`,
      );
    }
  }
  L.push(`  取用：${ls.why}。`);
  L.push(
    "  取用之法原文：" + LEISHEN_RULES.map((q) => `「${q.text}」`).join("") +
    `（${citeOf(LEISHEN_RULES[0]!)}至第 60b 页）。原文「德合」本站未算。`,
  );
  return L;
}

/** 【毕法赋·本课命中】节。一条都没中返回空数组。 */
export function bifaLines(r: LiurenResult): string[] {
  if (!r.bifa.length) return [];
  const L = [
    "【毕法赋·本课命中】《六壬大全》卷九、卷十「毕法赋」一百条，本站只判其中原书注文写清、引擎算得出的 46 条主格；" +
    "下列是本课成立的条目（赋文与定义句照录原文，无标点）。",
  ];
  for (const h of r.bifa) {
    const juan = h.src.juan === "009" ? "九" : "十";
    L.push(
      `  · 第${h.n}条「${h.title}」——本课成「${h.ge}」：${h.why}。原书：「${h.src.quote}」（卷${juan}第 ${h.src.page.split("-")[1]} 页）`,
    );
  }
  L.push("  原书第九十八条「非占現類勿言之」：赋文说的事与所问无关的，不必讲。");
  return L;
}

/** 【年命】节。没填返回空数组。 */
export function nianmingLines(r: LiurenResult): string[] {
  const nm = r.nianming;
  if (!nm) return [];
  const L = [
    `【年命】问课人填写：${nm.gender}，虚岁 ${nm.age}（按春节换岁，软件约定，非原书所定）。` +
    "看的是地盘本命位、行年位上的天盘神（上神）。",
  ];
  for (const s of nm.spots) {
    L.push(
      `  · ${s.role} ${s.label}：地盘 ${s.zhi} 上神 ${s.shang.zhi}，${noteText(s.shang)}；` +
      `${s.zhi}${s.inChuan ? "入三传" : "不入三传"}。`,
    );
  }
  L.push(
    `  依据：「${DQ.xnNan.text}」「${DQ.xnNv.text}」（${citeOf(DQ.xnNan)}，原书例「${DQ.xnNanLi.text}」「${DQ.xnNvLi.text}」）；` +
    `「${DQ.liuChu.text}」（${citeOf(DQ.liuChu)}）。`,
  );
  return L;
}

export interface LiurenExport {
  facts: string;
  /** 问课人自述的背景节（没写为空串；见 conversation.ts） */
  background: string;
  /** 盘面全部：facts + 背景。「只复制盘面」复制的是这个 */
  board: string;
  /** 追问规矩，附在每种导出的最后 */
  followup: string;
  /** 聊天版要求（默认，见 liurenChatRequirements.ts） */
  chat: string;
  /** 盘面 + 聊天版要求，界面默认复制这个 */
  chatFull: string;
  /** 详解版要求（每段标依据，见 liurenRequirements.ts） */
  requirements: string;
  /** 盘面 + 详解版要求 */
  full: string;
}

export function buildLiurenPrompt(r: LiurenResult, opts: { background?: string | null } = {}): LiurenExport {
  const head = "──────── 本课盘面（确定性排盘产出，请勿改动一个字）────────\n";
  const facts = liurenFactLines(r).join("\n");
  const background = backgroundLines(opts.background, "问课人").join("\n");
  const board = `${head}${facts}` + (background ? `\n\n${background}` : "");
  const tail = `\n\n${FOLLOWUP_LIUREN}`;
  return {
    facts,
    background,
    board,
    followup: FOLLOWUP_LIUREN,
    chat: LIUREN_CHAT_REQUIREMENTS,
    chatFull: `${board}\n\n${LIUREN_CHAT_REQUIREMENTS}${tail}`,
    requirements: LIUREN_REQUIREMENTS,
    full: `${board}\n\n${LIUREN_REQUIREMENTS}${tail}`,
  };
}

export { DIZHI, JIANG_NAME, CONFIDENCE };
