/**
 * 解读 Prompt 装配（移植自 plum/interpreter/prompt.py 的 build_prompt + duanshi_fact_lines
 * + build_duanshi_prompt）。
 *
 * **本站不调用任何 LLM。** 本模块只把盘面确定性事实与解读契约渲染成文本，
 * 供用户复制到自己的 AI 工具中获得解读（产品方向变更 2026-10-24）。
 *
 * 分两段输出：
 *   · 第一段「盘面与规则」= 确定性事实（排盘、门类查表、净评推导、旺衰、应期推导、
 *     卦爻辞逐字、化解条目、类象白名单、所问之事）
 *   · 第二段「解读要求」三选一：聊天版（默认）／详解版／完整契约
 *     （SYSTEM + 断事铁律 A–P + 口吻范例 + 自检清单）
 */
import contract from "../data/contract.json";
import { declarations, QIANKUN_WU_HU_NOTE, SOUND_RULE_NOTE, COLOR_HUANG_NOTE } from "../engine/lineage.js";
import type { CastResult } from "../engine/result.js";
import type { DuanshiFull } from "../engine/rules/netassess.js";
import { boardFacts } from "../engine/rules/netassess.js";
import { getYaoci, type YaociInfo } from "../engine/corpus/guayaoci.js";
import { PLAIN_REQUIREMENTS } from "./plainRequirements.js";
import { CHAT_REQUIREMENTS } from "./chatRequirements.js";
import { backgroundLines, FOLLOWUP_MEIHUA } from "./conversation.js";
import { FANGGUA_RULE, readWaiying, SHIYING_RULE, WAIYING_FILE } from "../engine/waiying.js";

const C = contract as { DUANSHI_APPENDIX: string; KOUWEN_FEWSHOT: string; SELF_CHECKLIST: string };

export const SYSTEM = `你是梅花易数解读助手。给你一张【已排好的盘】和【命中的卦爻辞】【生克规则】【门派声明】。
你的任务：把这张盘【怎么推出来的】串成人话。严格遵守：
1. 只解释推导链，不重算卦象，不下盘外独立断语。
2. 【可用卦象白名单·硬约束】解读中出现的任何八卦(乾/兑/离/震/巽/坎/艮/坤)，必须在下方【可用卦象】清单内；
   清单外八卦一个都不许出现。宁可少说，不可提盘外卦。
3. 【爻≠卦·防幻觉】爻是阴阳爻位(第1…6爻)，不是卦。禁止说「第N爻是X卦」「某爻变成X卦」。
   变卦=动爻阴阳翻转后整卦重组，不是某爻变成另一卦——说变卦只讲「本卦→变卦」两个卦名。
4. 【逐句挂靠】每句话末尾用【依据：…】标注它挂靠盘面的哪一项(体X/用Y/某条生克/第N爻动/某命中爻辞)；
   挂不到盘面任何依据的话，不要写。
5. 引爻辞只能逐字引下方【命中卦爻辞】给出的；禁改字、禁凭记忆另引；标 pending 者不得引用。
6. 禁无依据泛断(「近期有变动」「贵人相助」「提防小人」「运势」等放谁身上都对的话)。
7. 遇门派分歧按「A派…B派…」并列，不替用户裁决。
8. 不暗示任何科学预测效力，只呈现传统象数体系内部推演。`;

/** 应期路由 id 中文化：英文 id 不进喂入文本。 */
const ROUTE_CN: Readonly<Record<string, string>> = Object.freeze({
  xiantian_guaqi: "先天卦气",
  "houtian_guashu+dongjing": "后天卦数+动静",
  houtian_guashu: "后天卦数",
});

/** 命中爻辞（动爻）。pending 单元带标识，正文已被语料层屏蔽。 */
export function gatherCited(r: CastResult): YaociInfo[] {
  const e = getYaoci(r.ben_gua, r.dong_yao);
  return e ? [e] : [];
}

/** 第一段的排盘基础节（对应 Python build_prompt 的 user）。 */
export function boardLines(r: CastResult, cited: YaociInfo[]): string[] {
  const bf = boardFacts(r);
  const dangua = [...bf.allowed_gua].sort().join("、");
  const quanming = [`本卦${bf.ben_gua}`, `变卦${bf.bian_gua}`, `互卦${bf.hu_gua}`].join("、");
  const lines: string[] = [
    `【本卦】${bf.ben_gua}  【动爻】第${bf.dong_yao}爻  【变卦】${bf.bian_gua}  【互卦】${bf.hu_gua}`,
    `【体】${bf.ti}(${bf.ti_wuxing})  【用】${bf.yong}(${bf.yong_wuxing})`,
    `【可用卦象·仅限这些，清单外八卦禁止出现】单卦：${dangua}；全名：${quanming}`,
    "【生克关系(以体为主)】",
  ];
  for (const x of bf.relations) {
    lines.push(`  · ${x.phrase}：${x.from}${x.wuxing} ${x.rel}（${x.tone}）`);
  }
  lines.push(`【净评】${bf.net.overall}`);
  lines.push("【命中卦爻辞】" + (cited.length ? "" : "（本盘未引爻辞）"));
  for (const c of cited) {
    const yt = c.yname || `第${c.yao}爻`;
    lines.push(
      c.pending
        ? `  · ${c.gua_name}${yt}爻辞：[pending·屏蔽·不得引用]`
        : `  · ${c.gua_name}${yt}爻辞：「${c.text}」`,
    );
  }
  const decl = declarations();
  lines.push("【门派声明】" + Object.entries(decl).map(([k, v]) => `${k}=${v}`).join("；"));
  return lines;
}

/**
 * 断事确定性事实节（移植自 duanshi_fact_lines）。
 * 与界面推演链同源——此处改动即界面改动，二者定义上不可漂移。
 */
export function duanshiFactLines(dl: Record<string, any>): string[] {
  const lines: string[] = ["", `【所占门类】${dl.men_label}(men_id=${dl.men_id})`, "【门类查表】"];

  if (dl.type === "no_tiyong" || (dl.type === "xiangfa_only" && !dl.net_applicable)) {
    lines.push(`  类型:${dl.type}——${dl.note}`);
  } else {
    if (dl.relation) {
      lines.push(
        `  体用关系:${dl.relation} → 门表基础极性:${dl.base_polarity || dl.door_verdict || "-"}` +
          (dl.duanyu_template ? ` · 断语模板:${dl.duanyu_template}` : ""),
      );
    }
    if (dl.source_quote) {
      lines.push(`  原文依据:「${dl.source_quote}」(${(dl.source_refs || []).join("；")})`);
    }
    const net = dl.net;
    if (net) {
      const cnt = (net.detail || [])
        .map((x: any) => `${x.role}${x.gua}${x.wuxing}(${x.count > 0 ? "+1" : x.count < 0 ? "-1" : "0"})`)
        .join("、");
      lines.push(`  净评推导:计数[${cnt}] → 生体${net.sheng_ti}−克体${net.ke_ti} = d=${net.d} → 档:${net.band}`);
      lines.push(`  【最终极性 final_verdict:${dl.verdict}】(叠加规则:净评优先,冲突以 d 为准——断语必须在此框架内)`);
    } else {
      lines.push(`  verdict:${dl.verdict}`);
    }
    if (dl.xiangyi_review) {
      lines.push("  ⚠ 全比和·象义待核:公式不裁,如象义与所占对象冲突须人工复核(据理而断通道)");
      lines.push(
        "【象义待核·张力必处理】本盘体用互变俱比和(极性由门表维持),但卦名义可能与之相悖。" +
          "断语**必须**扣本卦卦辞逐字指出这层张力并说明何以仍判此档——不得回避、不得仅报极性、" +
          "不得翻转极性。西林寺先例(卦断遗论):「如起例中西林寺额得山地剥，体用互变，俱比和，" +
          "则为吉，而乃不吉，何也？盖寺者，纯阳人居之地，而纯阴爻象，则群阴剥阳之义显然也。" +
          "此理甚明，不必拘体用也」——本软件不改判(phase2),但张力必须呈现给问卦人。",
      );
    }
    if (dl.note) lines.push(`  注:${dl.note}`);
  }

  const tc = dl.text_conflict || {};
  if (tc.capped) {
    lines.push(`  【接法二·文本明诫封顶】${tc.cap_note}`);
    lines.push(
      "   → final 已封顶为「吉中有险」;断语**必须呈明诫**(引触发卦辞明诫+给出仍属吉的盘面理由)," +
        "不得回避、不得断作全吉、亦不得断作纯凶。",
    );
  }

  const gr = dl.guaci_refs || {};
  if (gr.ben || gr.bian) {
    lines.push("【卦辞参照(verified 语料·接法一:仅参照与调和,不动极性)】");
    for (const [tag, key] of [["本卦", "ben"], ["变卦", "bian"]] as const) {
      const g = gr[key];
      if (!g) continue;
      lines.push(
        g.pending
          ? `  · ${tag}${g.gua_name}卦辞:[pending·屏蔽·不得引用]`
          : `  · ${tag}${g.gua_name}卦辞(seq${g.seq}):「${(g.text || "").trim()}」`,
      );
    }
  }

  if (dl.wangshuai_readable) {
    const ws = dl.wangshuai || {};
    lines.push(`【旺衰·占卦节令(引擎确定性输出,照抄禁自算)】${dl.wangshuai_readable}(来源:${ws.source || ""})`);
  }

  const bal = dl.balance_required;
  if (bal) {
    if (bal.type === "盛极将转") {
      lines.push(`【平衡强制·盛极将转】触发:${(bal.reasons || []).join("/")}——断语第⑤段必接盛极将转警示。依据:${bal["依据"]}`);
    } else {
      const sheng = (bal.sheng_ti_gua || []).length
        ? bal.sheng_ti_gua.join("/")
        : "(无——如实说无救,措辞留余地)";
      lines.push(`【平衡强制·凶中生机】生体之卦:${sheng}——断语第⑤段必指生机。依据:${bal["依据"]}`);
    }
  }

  const hj = dl.huajie;
  if (hj && hj.triggered) {
    lines.push(`【化解·喂入条目(仅可用这些,${hj.mode};选条依据:${hj["盘面挂靠"]})】`);
    for (const it of hj.items) {
      lines.push(`  · ${it["出处篇目"]}「${it["逐字原文"]}」(${it["溯源级别"]})`);
    }
    lines.push(`  [table_status=${hj.table_status}·第七表待签收]`);
  }

  const wl = dl.leixiang_whitelist;
  if (wl && wl.length) {
    lines.push("【类象白名单·取象仅限下列条目,每处必须挂标签【取象：卦·类目·L行】,清单外取象=违规】");
    for (const e of wl) {
      lines.push(`  · ${e.gua}·${e.category}·L${e.line}(${e.source_level}):「${e.text}」`);
    }
  }

  const yq = dl.yingqi;
  if (yq && yq.value) {
    lines.push("【应期·唯一喂入值,断语陈述应期必须逐字采用此值并引依据,禁止自算】");
    lines.push(`  路由:${ROUTE_CN[yq.route] ?? yq.route}(${yq.route_basis || ""})`);
    if (yq.target_basis) lines.push(`  分取:${yq.target_basis}`);
    lines.push(`  推导:${yq.derivation_chain}`);
    if (typeof yq.value === "number") {
      lines.push(`  应期值:${Math.trunc(yq.value)} 日`);
    } else {
      lines.push(
        "  应期值:" +
          (yq.value as any[])
            .map((x) => `${x.gua}${x.wuxing}→${x.tiangan_ri}日/${x.dizhi_ri}日`)
            .join("；"),
      );
    }
  }

  const ts = dl.table_status;
  lines.push(`  [table_status=${ts}·${ts === "signed" ? "规则表已人工签收" : "规则表待人工签收"}]`);

  const q = String(dl.question || "").trim();
  if (q) lines.push(`【所问之事(问卦人原话)】${q}`);
  return lines;
}

/**
 * 本盘涉及的门派分歧（程序判定）。
 *
 * 为什么单列：解读要求只让 AI 在三种情形写门派分歧（乾坤取互、声音/报数取式、服色黄），
 * 但盘面事实里**没有任何一行写明起卦法**——【门派声明】把所有分歧一律列出，与本盘无关；
 * 应期路由只写「非time法」，指物、服色也是这三个字。聊天版第二轮试解里声音起卦的盘因此
 * 漏写分歧，评审追到的根因正在这里。判定是确定性的，就该由程序做，不让 AI 猜。
 *
 * 不并入 `facts`：facts 与 Python 参考实现逐字对拍（112 组），这一节是新站新增的派生信息。
 */
export function disputeLines(r: CastResult): string[] {
  const hits: string[] = [];
  if (r.ben_gua === "乾为天" || r.ben_gua === "坤为地") hits.push(QIANKUN_WU_HU_NOTE);
  if (r.method === "sound") hits.push(SOUND_RULE_NOTE);
  if (r.method === "color" && [r.inputs.upper_color, r.inputs.lower_color].includes("黄")) {
    hits.push(`服色起卦：${COLOR_HUANG_NOTE}`);
  }
  return [
    "【本盘涉及的门派分歧（程序按起卦法与本卦判定；解读时并列呈现，不替问卦人裁决）】",
    ...(hits.length ? hits.map((h) => `  · ${h}`) : ["  （本盘不涉及需要并列的门派分歧）"]),
  ];
}

/** 外应与体的关系，换成不会读反的说法（relate 的「体生」指体生外应）。 */
const WAIYING_REL: Readonly<Record<string, string>> = Object.freeze({
  生体: "外应生体", 比和: "外应与体比和", 体克: "体克外应", 体生: "体生外应（泄）", 克体: "外应克体",
});

/**
 * 外应节（程序判定，不在 facts 内）。没选外应返回空数组。
 * 外应即一个「用」，吉凶用已签收的体用生克表；内外合断只摆原书 L1007 的原话，不改最终极性。
 */
export function waiyingLines(
  r: CastResult, finalVerdict: string, ids: readonly string[], fang?: { gua: string; dir: string } | null,
): string[] {
  const w = readWaiying(ids, r.ti_wuxing, finalVerdict, fang ? { ...fang, yong: r.yong } : null);
  if (!w) return [];
  const L = [
    `【外应（起卦时问卦人身边的所见所闻；程序按原书十应「论卦象」一路对卦，「${SHIYING_RULE.asYong}」）】`,
  ];
  for (const h of w.hits) {
    const x = h.entry;
    L.push(
      `  · ${x.label} → ${x.gua.length ? `${x.gua.join("、")}（${x.wuxing}）` : `${x.wuxing}`}：原书「${x.quote}」` +
      `（${x.section}·L${x.line}）。与体 ${r.ti}（${r.ti_wuxing}）：${WAIYING_REL[h.rel]}（${h.tone}）`,
    );
  }
  if (w.fang) {
    const F = FANGGUA_RULE;
    L.push(
      `  · 方卦之应：来问之人站在占者的${w.fang.dir}（${w.fang.fangGua}方），用卦为${w.fang.yong}——${w.fang.verdict}：${w.fang.why}。` +
      `原书「${F.kan}」「${F.rule}」（${F.section}·L${F.line}）`,
    );
  }
  L.push(
    w.wai === "无从合断"
      ? "  外应合起来：方卦这一项原书未论，无从合断。"
      : `  外应合起来：${w.wai}；本盘最终极性在${w.nei}的一边。原书十应目论：` +
        w.rule.map((s) => `「${s}」`).join("") + `（${WAIYING_FILE} L${SHIYING_RULE.line}）`,
  );
  L.push(
    "  用法：外应不改【最终极性】的档名。和结论同一边，就说外面的兆头也是这样；方向相反，照上面原书的话把这层拧着的地方说出来，" +
    "不替问卦人判哪边压过哪边。外应只用这里列的，不从所问原话或背景里另找；原书「不论卦象」的那类外应（鸦、鹊之类直断吉凶的）本站不收，不要自己加。",
  );
  return L;
}

export interface ExportedPrompt {
  /** 第一段：盘面与规则（确定性事实）。**不可替代**——别处拿不到。 */
  facts: string;
  /** 本盘涉及的门派分歧（程序判定，不在 facts 内，见 disputeLines） */
  disputes: string;
  /** 问卦人自述的背景节（没写背景为空串；不在 facts 内，见 conversation.ts） */
  background: string;
  /** 外应节（没选外应为空串；不在 facts 内） */
  waiying: string;
  /** 盘面全部：facts + 门派分歧 + 外应 + 背景。「只复制盘面」复制的是这个 */
  board: string;
  /** 追问规矩，附在每种导出的最后（见 conversation.ts） */
  followup: string;
  /** 完整解读契约（SYSTEM + 断事铁律 A–P + 自检清单，§0.1 要求逐字保留） */
  contract: string;
  /** 聊天版解读要求（面对面说话的口吻，默认导出用，见 chatRequirements.ts） */
  chat: string;
  /** 盘面 + 聊天版要求（**界面默认复制的就是这个**） */
  chatFull: string;
  /** 详解版解读要求（每段标依据、逐句拆字，见 plainRequirements.ts） */
  plain: string;
  /** 盘面 + 详解版要求 */
  plainFull: string;
  /** 盘面 + 完整契约（严格模式；盘面在前，契约在后） */
  full: string;
}

export interface ExportOptions {
  /** 是否附带口吻范例（体积较大，默认不附） */
  includeFewshot?: boolean;
  /** 问卦人原话 */
  question?: string | null;
  /** 问卦人自述的背景（选填；只作情境，见 conversation.ts） */
  background?: string | null;
  /** 外应条目 id（选填，见 engine/waiying.ts） */
  waiying?: readonly string[];
  /** 方卦之应：来问之人站在占者何方（选填） */
  laiFang?: { gua: string; dir: string } | null;
}

/** 装配可复制的解读 Prompt。**不调用任何 LLM，纯文本渲染。** */
export function buildExportPrompt(
  r: CastResult,
  full: DuanshiFull,
  opts: ExportOptions = {},
): ExportedPrompt {
  const dom: Record<string, any> = { ...full.domain };
  const q = (opts.question ?? "").trim();
  if (q) dom.question = q;

  const cited = gatherCited(r);
  // 拼接方式与 Python 一致：base user 直接接 fact lines 的 join
  //（后者首元素为空串，本身充当分隔换行）。用数组整体 join 会多出一个空行。
  const facts = boardLines(r, cited).join("\n") + duanshiFactLines(dom).join("\n");

  // 同样与 Python 一致：各段自带开头换行，直接拼接，不另加分隔符。
  const contractParts = [SYSTEM, C.DUANSHI_APPENDIX];
  if (opts.includeFewshot) contractParts.push(C.KOUWEN_FEWSHOT);
  contractParts.push(C.SELF_CHECKLIST);
  const contractText = contractParts.join("");

  // 盘面在前、要求在后。顺序是认真的：盘面是别处拿不到的部分，
  // 契约万一被截断还能重发，盘面被截断这一卦就白排了（live 实测：契约在前时
  // 用户粘过去，对方回「尚未提供已排好的盘」）。
  const head =
    "──────── 本卦盘面与规则（确定性排盘产出，请勿改动一个字）────────\n";
  const disputes = disputeLines(r).join("\n");
  const background = backgroundLines(opts.background, "问卦人").join("\n");
  const waiying = waiyingLines(r, String(full.final_verdict ?? ""), opts.waiying ?? [], opts.laiFang).join("\n");
  const board = `${head}${facts}\n\n${disputes}` +
    (waiying ? `\n\n${waiying}` : "") + (background ? `\n\n${background}` : "");
  // 追问规矩放最后：截断时先丢它，代价最小
  const tail = `\n\n${FOLLOWUP_MEIHUA}`;
  return {
    facts,
    disputes,
    background,
    waiying,
    board,
    followup: FOLLOWUP_MEIHUA,
    contract: contractText,
    chat: CHAT_REQUIREMENTS,
    chatFull: `${board}\n\n${CHAT_REQUIREMENTS}${tail}`,
    plain: PLAIN_REQUIREMENTS,
    plainFull: `${board}\n\n${PLAIN_REQUIREMENTS}${tail}`,
    full: `${board}\n\n${contractText}${tail}`,
  };
}
