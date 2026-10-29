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
      `　乘${c.jiang}${c.kong ? "　【空亡】" : ""}　与日干：${c.relToGan}`,
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

  L.push(
    `【本盘所用规则的把握程度】${r.sanchuan.gate}：${CONF_CN[r.sanchuan.confidence] ?? r.sanchuan.confidence}`,
  );
  L.push("【门派分歧·并列呈现，不替问卦人裁决】");
  for (const d of r.disputes) L.push(`  · ${d}`);

  const q = (r.question ?? "").trim();
  if (q) L.push(`【所问之事（问卦人原话）】${q}`);
  return L;
}

export interface LiurenExport {
  facts: string;
  /** 聊天版要求（默认，见 liurenChatRequirements.ts） */
  chat: string;
  /** 盘面 + 聊天版要求，界面默认复制这个 */
  chatFull: string;
  /** 详解版要求（每段标依据，见 liurenRequirements.ts） */
  requirements: string;
  /** 盘面 + 详解版要求 */
  full: string;
}

export function buildLiurenPrompt(r: LiurenResult): LiurenExport {
  const head = "──────── 本课盘面（确定性排盘产出，请勿改动一个字）────────\n";
  const facts = liurenFactLines(r).join("\n");
  return {
    facts,
    chat: LIUREN_CHAT_REQUIREMENTS,
    chatFull: `${head}${facts}\n\n${LIUREN_CHAT_REQUIREMENTS}`,
    requirements: LIUREN_REQUIREMENTS,
    full: `${head}${facts}\n\n${LIUREN_REQUIREMENTS}`,
  };
}

export { DIZHI, JIANG_NAME, CONFIDENCE };
