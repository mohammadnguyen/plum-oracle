/**
 * 界面（纯静态，无后端、无 LLM 调用）。
 *
 * 站上有两套体系：**梅花易数**与**大六壬**，第 0 屏先选。
 * 两套共用同一个外壳（ui/shared.ts）与同一条导出规矩（盘面在前、要求在后），
 * 但各有各的引擎与解读要求——六壬的盘面结构与梅花完全不同（四课三传天将
 * vs 体用生克旺衰），那份人话版要求不能复用，见 prompt/liurenRequirements.ts。
 *
 * 梅花这一套三步：起卦法 → 输入（只问**非你不可**的东西）→ 结果。
 *   · 时辰、农历日期一律取设备时钟（§3#1/#2/#4/#5，见 engine/now.ts），不问用户；
 *     要补旧卦的，「改时刻」里可手填。
 *   · 所问门类由问句**确定性关键词规则**自动判（engine/rules/menDetect.ts），
 *     判定结果摆在明面上、一键可改——门类决定查哪张表的基础极性，不能默默替用户定。
 */
import { divine, type CastResult } from "../engine/result.js";
import type { CastMethod } from "../engine/cast.js";
import { DIZHI, COLOR_TO_GUA, declarations } from "../engine/lineage.js";
import { duanshiFull, type DuanshiFull } from "../engine/rules/netassess.js";
import { allDoors } from "../engine/rules/duanshiLookup.js";
import { detectMen, MEN_LABEL } from "../engine/rules/menDetect.js";
import { nowTimeInputs } from "../engine/now.js";
import { buildExportPrompt } from "../prompt/buildPrompt.js";
import { corpusInfo } from "../engine/corpus/guayaoci.js";
import { plainRead } from "./plainRead.js";
import { backgroundCard, el, esc, copyText, siteHeader, siteFooter, toast } from "./shared.js";
import { castShowMeihua, ritual } from "./ritual.js";
import { initZhiwuState, zhiwuCard, type ZhiwuState } from "./zhiwuCard.js";
import { BACKGROUND_MAX } from "../prompt/conversation.js";
import { initLiurenState, renderLiuren, type LiurenState } from "./liuren.js";

// ── 状态 ────────────────────────────────────────────────────────────────
type MethodUi = "time" | "number" | "object_direction" | "color";

type System = "meihua" | "liuren";

interface State {
  /** null = 还没选体系，停在第 0 屏 */
  system: System | null;
  liuren: LiurenState;
  screen: 1 | 2 | 3;
  method: CastMethod | null;
  methodUi: MethodUi | null;
  inputs: Record<string, any>;
  /** 自动判定的门；用户改过则 menOverridden=true */
  men: number | null;
  menOverridden: boolean;
  menMatched: string[];
  menFallback: boolean;
  question: string;
  /** 问卦人自述的背景（选填，只进导出文本） */
  background: string;
  /** 指物 · 方位起卦的输入（看到的东西、查到的卦、方位） */
  zhiwu: ZhiwuState;
  posture: string | null;
  /** 起卦所用时刻取数（默认此刻，可手改） */
  now: ReturnType<typeof nowTimeInputs>;
  timeEdited: boolean;
  /** 导出的解读要求：聊天版（默认）／详解版（每段标依据）／完整契约 */
  contractMode: "chat" | "plain" | "full";
  includeFewshot: boolean;
}
const state: State = {
  system: null, liuren: initLiurenState(),
  screen: 1, method: null, methodUi: null, inputs: {},
  men: null, menOverridden: false, menMatched: [], menFallback: true,
  question: "", background: "", zhiwu: initZhiwuState(), posture: null,
  now: nowTimeInputs(), timeEdited: false,
  contractMode: "chat", includeFewshot: false,
};

const app = document.getElementById("app")!;

/** 按问句重判门类；用户手动改过之后不再覆盖。 */
function syncMen(): void {
  if (state.menOverridden) return;
  const d = detectMen(state.question);
  state.men = d.menId;
  state.menMatched = d.matched;
  state.menFallback = d.fallback;
}

// ── 渲染 ────────────────────────────────────────────────────────────────
const SUB: Record<System, string> = {
  meihua: "梅花易数 · 透明排盘 · 每步可查 · 本站不调用任何 AI",
  liuren: "大六壬 · 透明起课 · 每步可查 · 本站不调用任何 AI",
};

function render(): void {
  app.innerHTML = "";
  app.appendChild(siteHeader(
    state.system ? SUB[state.system] : "梅花易数 · 大六壬 · 本站不调用任何 AI",
    "象数 · 非占验",
  ));

  if (!state.system) {
    s0();
  } else if (state.system === "liuren") {
    app.appendChild(switchBar());
    renderLiuren(app, state.liuren, render);
  } else {
    app.appendChild(switchBar());
    ({ 1: s1, 2: s2, 3: s3 })[state.screen]();
  }

  app.appendChild(siteFooter());
}

/** 顶部体系切换条：随时换一套，不用退到首屏。 */
function switchBar(): HTMLElement {
  const bar = el(`<div class="syswitch"></div>`);
  for (const [sys, name] of [["meihua", "梅花易数"], ["liuren", "大六壬"]] as Array<[System, string]>) {
    const b = el(`<button class="inline${state.system === sys ? " primary" : ""}">${esc(name)}</button>`);
    b.onclick = () => {
      if (state.system === sys) return;
      state.system = sys;
      render();
    };
    bar.appendChild(b);
  }
  return bar;
}

// 屏0：选体系
function s0(): void {
  app.appendChild(el(`<div class="step">先选一套体系</div>`));
  const c = el(`<div class="card"></div>`);
  const OPTS: Array<[System, string, string]> = [
    ["meihua", "梅花易数",
      "宋·邵雍一脉。起卦取数 → 本卦互卦变卦 → 体用生克旺衰 → 吉凶六档与应期。" +
      "规则与黄金案例全部可溯源到《梅花易数》原书行号。"],
    ["liuren", "大六壬",
      "三式之一。月将加占时 → 天地盘 → 四课 → 三传九宗门 → 十二天将。" +
      "方法保真靠与两家独立排盘实现逐传对拍，涉害、八专再按《六壬大全》原书课例逐条核对，把握程度逐条如实标注。"],
  ];
  for (const [sys, name, hint] of OPTS) {
    const b = el(`<button>${esc(name)}<span class="hint">${esc(hint)}</span></button>`);
    b.onclick = () => { state.system = sys; render(); };
    c.appendChild(b);
  }
  app.appendChild(c);
  app.appendChild(el(`<p class="note">两套都只排盘、不解读。解读由你自己的 AI 据导出文本完成。</p>`));
}

function backBtn(to: State["screen"]): HTMLElement {
  const b = el(`<button class="ghost inline">← 返回</button>`);
  b.onclick = () => { state.screen = to; render(); };
  return b;
}

// 屏1：起卦法
function s1(): void {
  app.appendChild(el(`<div class="step">第 1/3 步 · 怎么起卦</div>`));
  const c = el(`<div class="card"></div>`);
  // UI 别名：「报数」在界面上是独立一法，算法与声音占同构（父法为物数占），
  // 故 methodUi 记 UI 选项、state.method 记引擎法名。
  const METHODS: Array<[MethodUi, string, string]> = [
    ["time", "此刻起卦", "原书年月日时法（卷一十四 L165）。时间从你手机上取，什么都不用填"],
    ["number", "报数起卦", "后世通行法 · 父法为物数占（卷一十五 L170-171）。心里想两个数报上来"],
    ["object_direction", "指物 · 方位起卦", "原书端法后天起卦（L303）。你所见之物为上卦、所在方位为下卦"],
    ["color", "验色 · 服色起卦", "原书卷一四十三（L438）。来人上衣色为上卦、下衣色为下卦"],
  ];
  for (const [m, name, hint] of METHODS) {
    const b = el(`<button>${esc(name)}<span class="hint">${esc(hint)}</span></button>`);
    b.onclick = () => {
      state.method = m === "number" ? "sound" : (m as CastMethod);
      state.methodUi = m;
      state.inputs = {};
      if (!state.timeEdited) state.now = nowTimeInputs();
      state.screen = 2;
      render();
    };
    c.appendChild(b);
  }
  app.appendChild(c);
}

/** 时刻卡：默认只显示一行「此刻是…」，展开才给手填（补旧卦用）。 */
function timeCard(needDate: boolean): HTMLElement {
  const n = state.now;
  const dizhiSel = (id: string, label: string, def: string) => `
    <label>${esc(label)}</label>
    <select id="${id}">${DIZHI.map((d) => `<option value="${d}"${d === def ? " selected" : ""}>${d}</option>`).join("")}</select>`;

  const card = el(`
    <div class="card">
      <div class="kv">🕒 ${esc(n.note)}</div>
      <details>
        <summary>改时刻（补旧卦、或你知道确切农历日期时才用）</summary>
        ${needDate ? dizhiSel("f_year", "年支（例 2026 年丙午 → 午）", n.year_dizhi) : ""}
        ${needDate ? `<div class="row">
          <div><label>农历月（1–12）</label><input id="f_month" type="number" min="1" max="12" value="${n.lunar_month}" /></div>
          <div><label>农历日（1–30）</label><input id="f_day" type="number" min="1" max="30" value="${n.lunar_day}" /></div>
        </div>` : ""}
        ${dizhiSel("f_hour", "时支", n.hour_dizhi)}
        <p class="note">年数、时数取地支序数（子1…亥12）；月数、日数取农历本数。23 时起算次日为软件约定，非原书所定。</p>
      </details>
    </div>`);

  const grab = () => {
    const g = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value;
    const h = g("f_hour");
    const y = g("f_year");
    const m = g("f_month");
    const d = g("f_day");
    const changed =
      (h && h !== n.hour_dizhi) || (y && y !== n.year_dizhi) ||
      (m && Number(m) !== n.lunar_month) || (d && Number(d) !== n.lunar_day);
    if (changed) state.timeEdited = true;
    return {
      year_dizhi: y || n.year_dizhi,
      lunar_month: m ? Number(m) : n.lunar_month,
      lunar_day: d ? Number(d) : n.lunar_day,
      hour_dizhi: h || n.hour_dizhi,
    };
  };
  (card as any).__grab = grab;
  return card;
}

// 屏2：输入（只问非用户不可的东西 + 所问之事）
function s2(): void {
  app.appendChild(el(`<div class="step">第 2/3 步 · 你问什么</div>`));
  app.appendChild(backBtn(1));
  const ui = state.methodUi!;

  // 所问之事：既是解读情境，也是门类自动判定的唯一依据
  const qc = el(`
    <div class="card">
      <label>你想问什么？写一句就行</label>
      <textarea id="f_q" maxlength="300" placeholder="例：下周去杭州谈一单生意，能不能成？">${esc(state.question)}</textarea>
      <div class="note" style="text-align:right"><span id="qn">0</span>/300</div>
      <div class="kv" id="menline"></div>
      <p class="note">所问只作解读情境与门类判定，不参与排盘，也不改变任何吉凶判定。</p>
    </div>`);
  app.appendChild(qc);
  const ta = qc.querySelector("#f_q") as HTMLTextAreaElement;
  const qn = qc.querySelector("#qn") as HTMLElement;
  const menline = qc.querySelector("#menline") as HTMLElement;
  const paintMen = () => {
    syncMen();
    menline.textContent = state.menFallback
      ? "未认出门类 → 按「人事占」断（结果页可改）"
      : `已自动判为「${MEN_LABEL[state.men!]}」（认出：${state.menMatched.join("、")}）`;
  };
  qn.textContent = String(state.question.length);
  paintMen();
  ta.oninput = () => {
    state.question = ta.value;
    qn.textContent = String(ta.value.length);
    paintMen();
  };
  app.appendChild(backgroundCard(state.background, BACKGROUND_MAX, (v) => { state.background = v; }));

  // 起卦必需输入（只有确实非用户不可的那些）
  let inputCard: HTMLElement | null = null;
  if (ui === "number") {
    inputCard = el(`
      <div class="card">
        <div class="row">
          <div><label>先报之数</label><input id="f_a" type="number" min="1" value="3" /></div>
          <div><label>后报之数</label><input id="f_b" type="number" min="1" value="7" /></div>
        </div>
        <p class="note">报数为后世通行法，原书无此例；本站以物数占（卷一十五）为父法，算法与声音占同构。</p>
      </div>`);
  } else if (ui === "object_direction") {
    inputCard = zhiwuCard(state.zhiwu);
  } else if (ui === "color") {
    const opts = Object.keys(COLOR_TO_GUA)
      .map((x) => `<option value="${x}">${x}（${COLOR_TO_GUA[x]}）</option>`).join("");
    inputCard = el(`
      <div class="card">
        <label>上衣颜色（上卦）</label><select id="f_uc">${opts}</select>
        <label>下衣颜色（下卦）</label><select id="f_lc">${opts}</select>
      </div>`);
  }
  if (inputCard) app.appendChild(inputCard);

  const tc = timeCard(ui === "time");
  app.appendChild(tc);

  const go = el(`<button class="primary">静心起卦</button>`);
  go.onclick = async () => {
    state.question = ta.value;
    syncMen();
    if (ui === "object_direction" && (!state.zhiwu.objGua || !state.zhiwu.dirGua)) {
      toast(!state.zhiwu.objGua ? "先写下你看到的东西，或手选一卦" : "再定一下方位");
      return;
    }
    (inputCard as any)?.__stop?.();
    // 静心页：此刻起卦法的起卦时刻取按满那一刻（用户手改过时刻的除外）
    let t = (tc as any).__grab() as ReturnType<typeof nowTimeInputs>;
    const at = await ritual({
      verb: "起卦",
      question: state.question,
      quote: { text: "不动不占，不因事不占。", from: "《梅花易数》卷一 观梅占（L341）" },
      timeFromHold: !state.timeEdited,
    });
    if (!at) return;
    if (!state.timeEdited) {
      state.now = nowTimeInputs(at);
      t = state.now;
    }
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value;
    if (ui === "time") {
      state.inputs = {
        year_dizhi: t.year_dizhi, lunar_month: t.lunar_month,
        lunar_day: t.lunar_day, hour_dizhi: t.hour_dizhi,
      };
    } else if (ui === "number") {
      state.inputs = { first_count: Number(v("f_a")), second_count: Number(v("f_b")), hour_dizhi: t.hour_dizhi };
    } else if (ui === "object_direction") {
      state.inputs = { object_gua: state.zhiwu.objGua, direction_gua: state.zhiwu.dirGua, hour_dizhi: t.hour_dizhi };
    } else {
      state.inputs = { upper_color: v("f_uc"), lower_color: v("f_lc"), hour_dizhi: t.hour_dizhi };
    }
    state.inputs.__lunar_month = t.lunar_month;   // 旺衰节令用，不入排盘取数
    // 成卦动画：结果先算定，动画只是把它逐爻画出来
    try {
      const castInputs = { ...state.inputs };
      delete castInputs.__lunar_month;
      await castShowMeihua(divine(state.method!, castInputs));
    } catch { /* 输入无效留给结果页报错 */ }
    state.screen = 3;
    render();
    window.scrollTo(0, 0);
  };
  app.appendChild(go);
}

// 屏3：结果
function s3(): void {
  app.appendChild(el(`<div class="step">第 3/3 步 · 盘面与解读 Prompt</div>`));
  const again = el(`<button class="ghost inline">← 重新起卦</button>`);
  again.onclick = () => {
    Object.assign(state, {
      screen: 1, method: null, methodUi: null, inputs: {},
      menOverridden: false, timeEdited: false, now: nowTimeInputs(), zhiwu: initZhiwuState(),
    });
    render();
  };
  app.appendChild(again);

  const lunarMonth = state.inputs.__lunar_month ?? state.now.lunar_month;
  const castInputs = { ...state.inputs };
  delete castInputs.__lunar_month;

  let r: CastResult;
  let full: DuanshiFull;
  try {
    r = divine(state.method!, castInputs);
    full = duanshiFull(state.men!, r, { posture: state.posture, lunarMonth });
  } catch (e) {
    app.appendChild(el(`<div class="card">排盘输入无效：${esc((e as Error).message)}</div>`));
    return;
  }

  const fv = full.final_verdict ?? "—";
  const cls = /凶/.test(fv) ? "xiong" : /吉/.test(fv) ? "ji" : "";
  const head = el(`
    <div class="card">
      <div class="guaname">${esc(r.ben_gua)} · 第${r.dong_yao}爻动 → ${esc(r.bian_gua)}</div>
      <div class="verdict ${cls}">${esc(fv)}</div>
      <div class="meta">${esc((full.domain_semantics as any).men_label)} · ${esc(full.verdict_from ?? "")}</div>
      ${full.xiangyi_review_flag ? '<div class="flagline">⚠ 全比和 · 象义待核（据理而断通道）</div>' : ""}
      <div class="watermark">规则表 ${esc((full.domain as any).table_status)}</div>
    </div>`);
  head.insertBefore(hexDiagram(r), head.querySelector(".meta"));
  app.appendChild(head);

  if (state.question.trim()) {
    app.appendChild(el(`<div class="card">✍️ 所问：${esc(state.question.trim())}</div>`));
  }
  if (state.background.trim()) {
    app.appendChild(el(`<div class="card note">📝 你补充的情况已附在下方复制文本里（只作情境，不影响盘面）。</div>`));
  }
  if (state.method === "object_direction" && state.zhiwu.objGua) {
    app.appendChild(el(`<div class="card note">🧭 上卦 ${esc(state.zhiwu.objGua)}：${esc(state.zhiwu.objText.trim() && state.zhiwu.objNote !== "按原书条目手选" ? `所见「${state.zhiwu.objText.trim()}」→ ` : "")}${esc(state.zhiwu.objNote)}<br />
      下卦 ${esc(state.zhiwu.dirGua ?? "")}：${esc(state.zhiwu.dirNote)}</div>`));
  }

  app.appendChild(menCard());
  app.appendChild(plainCard(r, full));
  app.appendChild(promptCard(r, full));
  app.appendChild(chainCard(r, full));
}

/** 门类：自动判定摆明面 + 一键改。 */
function menCard(): HTMLElement {
  const why = state.menOverridden
    ? "你手动选的"
    : state.menFallback
      ? "问句里没认出门类关键词，按「人事占」兜底（原书十八占末「占者以类而推之可也」）"
      : `按问句里的「${state.menMatched.join("、")}」自动判定`;
  const card = el(`
    <div class="card">
      <div class="kv">所占门类：<b>${esc(MEN_LABEL[state.men!])}</b> —— ${esc(why)}</div>
      <details>
        <summary>不对？换一门（门类决定查哪张表的基础极性，会改变断语方向）</summary>
        <div id="men_list" class="doorgrid"></div>
      </details>
    </div>`);
  const list = card.querySelector("#men_list") as HTMLElement;
  for (const d of allDoors() as any[]) {
    const b = el(`<button class="inline${d.men_id === state.men ? " primary" : ""}">${esc(d.men_label)}</button>`);
    b.onclick = () => {
      state.men = d.men_id;
      state.menOverridden = true;
      render();
    };
    list.appendChild(b);
  }
  return card;
}

/** 盘面直译：固定对照表翻的人话，不是 AI 解读。 */
function plainCard(r: CastResult, f: DuanshiFull): HTMLElement {
  const lines = plainRead(r, f)
    .map((l) => `<div class="kv">${esc(l.text)}<span class="src">依据：${esc(l.src)}</span></div>`)
    .join("");
  return el(`
    <div class="card">
      <div class="guaname" style="text-align:left;font-size:15px;color:var(--ink)">这张盘在说什么</div>
      <p class="note">下面每行都是程序按固定对照表把术语换成人话，不是解读、不含推断——
        同一张盘永远翻出同一段字。成篇的解读请把下方 Prompt 复制给你自己的 AI。</p>
      ${lines}
    </div>`);
}

/** 六爻卦画：本卦 / 变卦，动爻高亮。bits 为 bottom→top，显示自上而下。 */
function hexDiagram(r: CastResult): HTMLElement {
  const one = (title: string, bits: readonly number[], dong: number | null) => {
    const rows: string[] = [];
    for (let pos = 6; pos >= 1; pos--) {
      const bit = bits[pos - 1];
      const isDong = dong === pos;
      const cl = `yao ${bit === 1 ? "yang" : "yin"}${isDong ? " dong" : ""}`;
      rows.push(bit === 1 ? `<div class="${cl}"><i></i></div>` : `<div class="${cl}"><i></i><i></i></div>`);
    }
    return `<div class="hex"><div class="nm">${esc(title)}</div>${rows.join("")}
      <div class="dongmark">${dong ? `第${dong}爻动` : ""}</div></div>`;
  };
  return el(`<div class="hexes">
    ${one(r.ben_gua, r.ben_bits, r.dong_yao)}
    ${one(r.bian_gua, r.bian_bits, null)}
  </div>`);
}

/** 起卦取数的人读版（替代原来直接打印 JSON trace）。未登记的键一律不显示。 */
const TRACE_NAME: Readonly<Record<string, string>> = Object.freeze({
  // 原始输入
  year_dizhi: "年支", lunar_month: "农历月", lunar_day: "农历日", hour_dizhi: "时支",
  first_count: "先报之数", second_count: "后报之数",
  object_gua: "所见之物属卦", direction_gua: "方位属卦",
  upper_color: "上衣色", lower_color: "下衣色",
  // 取数中间量
  year_num: "年数", month_num: "月数", day_num: "日数", hour_num: "时数",
  upper_total: "上卦总数", lower_total: "下卦总数",
  shang_num: "上卦数", xia_num: "下卦数",
});

function traceLine(r: CastResult): string {
  const pick = (o: Record<string, unknown>) =>
    Object.entries(o)
      .filter(([k, v]) => TRACE_NAME[k] !== undefined && v !== null && v !== undefined)
      .map(([k, v]) => `${TRACE_NAME[k]} ${v}`);
  return [...pick(r.inputs), ...pick(r.trace)].join(" · ");
}

/** 推演链折叠区（技术细节，默认全部收起）。 */
function chainCard(r: CastResult, f: DuanshiFull): HTMLElement {
  const kv = (s: unknown) => `<div class="kv">${esc(s)}</div>`;
  const parts: string[] = [];
  const ds = f.domain_semantics as any;

  parts.push(`<details><summary>排盘</summary>
    ${kv(`上卦 ${r.shang_gua} / 下卦 ${r.xia_gua} → 本卦 ${r.ben_gua}（${r.ben_short}）`)}
    ${kv(`互卦 ${r.hu_gua}（上${r.hu_shang} 下${r.hu_xia}）`)}
    ${kv(`动爻 第${r.dong_yao}爻 → 变卦 ${r.bian_gua}`)}
    ${kv(`体 ${r.ti}(${r.ti_wuxing}) · 用 ${r.yong}(${r.yong_wuxing})（含动爻之卦为用）`)}
    ${kv(`起卦取数：${traceLine(r)}`)}
  </details>`);

  parts.push(`<details><summary>生克与净评</summary>
    ${r.shengke.relations.map((x) => kv(`${x.phrase}：${x.from}${x.wuxing} ${x.rel}（${x.tone}）`)).join("")}
    ${kv(`计数 生体${f.net_d.sheng_ti} − 克体${f.net_d.ke_ti} = d=${f.net_d.d} → 档：${f.net_d.band}`)}
    ${kv(`最终极性 ${f.final_verdict}（${f.verdict_from}）`)}
  </details>`);

  parts.push(`<details><summary>门类查表</summary>
    ${kv(`${ds.men_label} · 体用关系 ${ds.relation ?? "—"} → 基础极性 ${f.base_polarity ?? "—"}`)}
    ${ds.duanyu_template ? kv(`断语模板：${ds.duanyu_template}`) : ""}
    ${kv(`原文依据：「${ds.source_quote}」`)}
  </details>`);

  if (f.wangshuai_readable) {
    parts.push(`<details><summary>旺衰</summary>${kv(f.wangshuai_readable)}${kv(`来源：${(f.wangshuai as any)?.source ?? ""}`)}</details>`);
  }

  const gr = f.guaci_refs;
  if (gr.ben || gr.bian) {
    const line = (tag: string, g: any) =>
      !g ? "" : g.pending ? kv(`${tag}${g.gua_name}卦辞：[pending·屏蔽·待人工核定]`) : kv(`${tag}${g.gua_name}卦辞：「${g.text}」`);
    parts.push(`<details><summary>卦辞参照（接法一）</summary>${line("本卦", gr.ben)}${line("变卦", gr.bian)}</details>`);
  }

  if (f.text_conflict.cap_note) {
    parts.push(`<details><summary>文本明诫（接法二）</summary>${kv(f.text_conflict.cap_note)}</details>`);
  }

  if (f.balance_required) {
    const b: any = f.balance_required;
    parts.push(`<details><summary>平衡强制</summary>${kv(`${b.type}：${(b.reasons || b.sheng_ti_gua || []).join("/") || "（无生体之卦）"}`)}${kv(`依据：${b["依据"]}`)}</details>`);
  }

  if (f.yingqi?.value) {
    const y: any = f.yingqi;
    const val = typeof y.value === "number"
      ? `${Math.trunc(y.value)} 日`
      : y.value.map((x: any) => `${x.gua}${x.wuxing}→${x.tiangan_ri}日/${x.dizhi_ri}日`).join("；");
    parts.push(`<details><summary>应期</summary>${kv(`应期值：${val}`)}${kv(`推导：${y.derivation_chain}`)}${kv(`路由依据：${y.route_basis ?? ""}`)}</details>`);
  }

  if (f.huajie?.triggered) {
    parts.push(`<details><summary>化解喂入条目（第七表）</summary>
      ${kv(`选条依据：${(f.huajie as any)["盘面挂靠"]}`)}
      ${f.huajie.items.map((it: any) => kv(`${it["出处篇目"]}「${it["逐字原文"]}」（${it["溯源级别"]}）`)).join("")}
    </details>`);
  }

  if (f.leixiang_whitelist.length) {
    parts.push(`<details><summary>类象白名单（${f.leixiang_whitelist.length} 条）</summary>
      ${f.leixiang_whitelist.map((e) => kv(`${e.gua}·${e.category}·L${e.line}：「${e.text}」`)).join("")}
    </details>`);
  }

  const d = declarations();
  parts.push(`<details><summary>门派声明与语料</summary>
    ${Object.entries(d).map(([k, v]) => kv(`${k}：${v}`)).join("")}
    ${kv(`语料：${corpusInfo().source}（verified=${corpusInfo().verified}，${corpusInfo().hexagrams} 卦）`)}
  </details>`);

  return el(`<div class="card">
    <div class="guaname" style="text-align:left;font-size:15px;color:var(--ink)">推演链 · 每一步都可查</div>
    ${parts.join("")}
  </div>`);
}

/** 可复制解读 Prompt。默认 = 盘面 + 聊天版要求。 */
function promptCard(r: CastResult, f: DuanshiFull): HTMLElement {
  const build = () => buildExportPrompt(r, f, {
    question: state.question.trim() || null,
    background: state.background.trim() || null,
    includeFewshot: state.includeFewshot,
  });
  let out = build();
  const pick = () =>
    state.contractMode === "full" ? out.full : state.contractMode === "plain" ? out.plainFull : out.chatFull;

  const card = el(`
    <div class="card">
      <div class="guaname" style="text-align:left;font-size:15px;color:var(--ink)">把这段复制给你的 AI，让它解这一卦</div>
      <p class="note">本站不调用任何 AI。文本由确定性排盘产出：<b>先盘面，后要求</b>——
        盘面是别处拿不到的部分，万一被截断，先保住它。</p>
      <div style="margin-top:10px">
        <button class="inline primary" id="b_all">复制（盘面 + 解读要求）</button>
        <button class="inline" id="b_facts">只复制盘面</button>
      </div>
      <details style="margin-top:8px">
        <summary>解读风格：<span id="modename"></span></summary>
        <label><input type="radio" name="f_mode" value="chat" style="width:auto" /> <b>聊天版</b>（默认）——像懂卦的朋友当面帮你分析：先结论，再讲怎么发展、哪里要小心、怎么做；少术语</label>
        <label><input type="radio" name="f_mode" value="plain" style="width:auto" /> <b>详解版</b>——逐句拆原文，每段标出依据，适合想核对推理的人</label>
        <label><input type="radio" name="f_mode" value="full" style="width:auto" /> <b>完整契约</b>（断事铁律 A–P + 自检清单，逐字原文；要求输出严格 JSON，最严但最难读）</label>
        <label><input type="checkbox" id="f_fs" style="width:auto" /> 附带口吻范例（仅在完整契约下有意义）</label>
      </details>
      <details style="margin-top:6px"><summary>预览（<span id="len"></span> 字）</summary><pre class="prompt" id="pv"></pre></details>
    </div>`);

  const pv = card.querySelector("#pv") as HTMLElement;
  const len = card.querySelector("#len") as HTMLElement;
  const modename = card.querySelector("#modename") as HTMLElement;
  const MODE_NAME = { chat: "聊天版", plain: "详解版", full: "完整契约" } as const;
  const paint = () => {
    const text = pick();
    pv.textContent = text;
    len.textContent = String(text.length);
    modename.textContent = MODE_NAME[state.contractMode];
  };
  paint();

  card.querySelectorAll<HTMLInputElement>('input[name="f_mode"]').forEach((radio) => {
    radio.checked = radio.value === state.contractMode;
    radio.onchange = () => {
      if (!radio.checked) return;
      state.contractMode = radio.value as State["contractMode"];
      paint();
    };
  });
  (card.querySelector("#f_fs") as HTMLInputElement).onchange = (e) => {
    state.includeFewshot = (e.target as HTMLInputElement).checked;
    out = build();
    paint();
  };

  (card.querySelector("#b_all") as HTMLElement).onclick = () => void copyText(pick(), "全文");
  (card.querySelector("#b_facts") as HTMLElement).onclick = () => void copyText(out.board, "盘面");
  return card;
}

render();
