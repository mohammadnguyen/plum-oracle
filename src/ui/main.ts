/**
 * 界面（纯静态，无后端、无 LLM 调用）。
 *
 * 四步：起卦法 → 输入 → 门类 + 所问之事 → 结果（排盘 + 推演链 + 可复制解读 Prompt）。
 * 信息结构沿用旧 Flask 版：分步起卦、推演链折叠区、门派声明。
 */
import { divine, type CastResult } from "../engine/result.js";
import type { CastMethod } from "../engine/cast.js";
import { DIZHI, COLOR_TO_GUA, declarations } from "../engine/lineage.js";
import { TRIGRAM_ORDER } from "../engine/gua64.js";
import { duanshiFull, type DuanshiFull } from "../engine/rules/netassess.js";
import { allDoors } from "../engine/rules/duanshiLookup.js";
import { buildExportPrompt } from "../prompt/buildPrompt.js";
import { corpusInfo } from "../engine/corpus/guayaoci.js";
import { Solar } from "lunar-javascript";

// ── 状态 ────────────────────────────────────────────────────────────────
interface State {
  screen: 1 | 2 | 3 | 4;
  method: CastMethod | null;
  inputs: Record<string, any>;
  men: number | null;
  question: string;
  posture: string | null;
  includeFewshot: boolean;
}
const state: State = {
  screen: 1, method: null, inputs: {}, men: null, question: "", posture: null,
  includeFewshot: false,
};

const app = document.getElementById("app")!;
const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function el(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
}

function toast(msg: string): void {
  let t = document.querySelector(".toast") as HTMLElement | null;
  if (!t) {
    t = el('<div class="toast"></div>');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t!.classList.remove("show"), 1600);
}

/** 当前农历月（非 time 法的旺衰节令用，对应旧版 _cur_month）。 */
function currentLunarMonth(): number {
  const n = new Date();
  const l = Solar.fromYmdHms(
    n.getFullYear(), n.getMonth() + 1, n.getDate(), n.getHours(), 0, 0,
  ).getLunar();
  return Math.abs(l.getMonth());
}

/** 当前时辰地支（供输入默认值）。 */
function currentHourDizhi(): string {
  const h = new Date().getHours();
  // 子时 23–1，丑 1–3 …（早子时归次日为软件约定，见门派声明）
  const idx = Math.floor(((h + 1) % 24) / 2);
  return DIZHI[idx]!;
}

// ── 渲染 ────────────────────────────────────────────────────────────────
function render(): void {
  app.innerHTML = "";
  app.appendChild(el(`
    <header class="site">
      <h1>梅花易数</h1>
      <div class="sub">透明排盘 · 每步可查 · 本站不调用任何 AI</div>
      <div class="badge">象数 · 非占验</div>
    </header>`));

  ({ 1: s1, 2: s2, 3: s3, 4: s4 })[state.screen]();

  app.appendChild(el(`
    <footer class="site">
      本站呈现传统象数体系的内部透明推演，不作、不暗示任何科学预测效力。<br />
      解读由你自己的 AI 工具完成；本站只负责把盘排准、把依据摆全。<br />
      © 2026 本站作者 · 版权所有。禁止复制、转载、改作或搭建镜像；<br />
      禁止将本站内容用于训练 AI 模型或构建数据集。
    </footer>`));
}

function backBtn(to: State["screen"]): HTMLElement {
  const b = el(`<button class="ghost inline">← 返回</button>`);
  b.onclick = () => { state.screen = to; render(); };
  return b;
}

// 屏1：起卦法
function s1(): void {
  app.appendChild(el(`<div class="step">第 1/4 步 · 起卦法</div>`));
  const c = el(`<div class="card"></div>`);
  // UI 别名：「报数」在界面上是独立一法，算法与声音占同构（父法为物数占），
  // 故 methodUi 记 UI 选项、state.method 记引擎法名。
  type MethodUi = "time" | "number" | "object_direction" | "color";
  const METHODS: Array<[MethodUi, string, string]> = [
    ["time", "年月日时起卦", "原书法 · 卷一十四（L165）。以年支、农历月日与时支取数"],
    ["number", "报数起卦", "后世通行法 · 父法为物数占（卷一十五 L170-171）。报两个数"],
    ["object_direction", "指物 · 方位起卦", "原书法 · 端法后天起卦（L303）。所见之物为上卦、方位为下卦"],
    ["color", "验色 · 服色起卦", "原书法 · 卷一四十三（L438）。上衣色为上卦、下衣色为下卦"],
  ];
  for (const [m, name, hint] of METHODS) {
    const b = el(`<button>${esc(name)}<span class="hint">${esc(hint)}</span></button>`);
    b.onclick = () => {
      state.method = m === "number" ? "sound" : (m as CastMethod);
      (state as any).methodUi = m;
      state.inputs = {};
      state.screen = 2;
      render();
    };
    c.appendChild(b);
  }
  app.appendChild(c);
}

// 屏2：输入
function s2(): void {
  app.appendChild(el(`<div class="step">第 2/4 步 · 起卦输入</div>`));
  app.appendChild(backBtn(1));
  const ui = (state as any).methodUi as string;
  const c = el(`<div class="card"></div>`);
  const hour = currentHourDizhi();

  const dizhiSel = (id: string, label: string, def: string) => `
    <label>${esc(label)}</label>
    <select id="${id}">${DIZHI.map((d) => `<option value="${d}"${d === def ? " selected" : ""}>${d}</option>`).join("")}</select>`;

  if (ui === "time") {
    c.innerHTML = `
      ${dizhiSel("f_year", "年支（例 2026 年为丙午年 → 午）", "午")}
      <div class="row">
        <div><label>农历月（1–12）</label><input id="f_month" type="number" min="1" max="12" value="1" /></div>
        <div><label>农历日（1–30）</label><input id="f_day" type="number" min="1" max="30" value="1" /></div>
      </div>
      ${dizhiSel("f_hour", "时支", hour)}
      <p class="note">年数、时数取地支序数（子1…亥12）；月数、日数取农历本数。见底部门派声明。</p>`;
  } else if (ui === "number") {
    c.innerHTML = `
      <div class="row">
        <div><label>先报之数</label><input id="f_a" type="number" min="1" value="3" /></div>
        <div><label>后报之数</label><input id="f_b" type="number" min="1" value="7" /></div>
      </div>
      ${dizhiSel("f_hour", "时支", hour)}
      <p class="note">报数为后世通行法，原书无此例；本站以物数占（卷一十五）为父法，算法与声音占同构。</p>`;
  } else if (ui === "object_direction") {
    const opts = TRIGRAM_ORDER.map((g) => `<option value="${g}">${g}</option>`).join("");
    c.innerHTML = `
      <label>所见之物属卦（上卦）</label><select id="f_obj">${opts}</select>
      <label>方位属卦（下卦）</label><select id="f_dir">${opts}</select>
      ${dizhiSel("f_hour", "时支", hour)}`;
  } else {
    const colors = Object.keys(COLOR_TO_GUA);
    const opts = colors.map((x) => `<option value="${x}">${x}（${COLOR_TO_GUA[x]}）</option>`).join("");
    c.innerHTML = `
      <label>上衣颜色（上卦）</label><select id="f_uc">${opts}</select>
      <label>下衣颜色（下卦）</label><select id="f_lc">${opts}</select>
      ${dizhiSel("f_hour", "时支", hour)}`;
  }
  app.appendChild(c);

  const go = el(`<button class="primary">下一步 · 选所问门类</button>`);
  go.onclick = () => {
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value;
    if (ui === "time") {
      state.inputs = {
        year_dizhi: v("f_year"), lunar_month: Number(v("f_month")),
        lunar_day: Number(v("f_day")), hour_dizhi: v("f_hour"),
      };
    } else if (ui === "number") {
      state.inputs = { first_count: Number(v("f_a")), second_count: Number(v("f_b")), hour_dizhi: v("f_hour") };
    } else if (ui === "object_direction") {
      state.inputs = { object_gua: v("f_obj"), direction_gua: v("f_dir"), hour_dizhi: v("f_hour") };
    } else {
      state.inputs = { upper_color: v("f_uc"), lower_color: v("f_lc"), hour_dizhi: v("f_hour") };
    }
    state.screen = 3;
    render();
  };
  app.appendChild(go);
}

// 屏3：门类 + 所问之事
function s3(): void {
  app.appendChild(el(`<div class="step">第 3/4 步 · 所问何事</div>`));
  app.appendChild(backBtn(2));

  const qc = el(`
    <div class="card">
      <label>你想问什么？（可选，写得越具体，解读越贴你的事）</label>
      <textarea id="f_q" maxlength="300" placeholder="例：下周去杭州谈一单生意，能不能成？">${esc(state.question)}</textarea>
      <div class="note" style="text-align:right"><span id="qn">0</span>/300</div>
      <p class="note">所问只作解读情境，不参与排盘，也不改变任何吉凶判定。</p>
    </div>`);
  app.appendChild(qc);
  const ta = qc.querySelector("#f_q") as HTMLTextAreaElement;
  const qn = qc.querySelector("#qn") as HTMLElement;
  qn.textContent = String(state.question.length);
  ta.oninput = () => { state.question = ta.value; qn.textContent = String(ta.value.length); };

  const COMMON = [2, 3, 5, 10, 16, 12];
  const doors = [...allDoors()].sort((a: any, b: any) => {
    const ca = COMMON.includes(a.men_id) ? 0 : 1;
    const cb = COMMON.includes(b.men_id) ? 0 : 1;
    return ca - cb || a.men_id - b.men_id;
  });
  const c = el(`<div class="card"></div>`);
  for (const d of doors as any[]) {
    const star = COMMON.includes(d.men_id) ? "★ " : "";
    const b = el(`<button>${esc(star + d.men_label)}</button>`);
    b.onclick = () => { state.question = ta.value; state.men = d.men_id; state.screen = 4; render(); };
    c.appendChild(b);
  }
  app.appendChild(c);
}

// 屏4：结果
function s4(): void {
  app.appendChild(el(`<div class="step">第 4/4 步 · 盘面与解读 Prompt</div>`));
  const again = el(`<button class="ghost inline">← 重新起卦</button>`);
  again.onclick = () => { Object.assign(state, { screen: 1, method: null, inputs: {}, men: null }); render(); };
  app.appendChild(again);

  let r: CastResult;
  let full: DuanshiFull;
  try {
    r = divine(state.method!, state.inputs);
    full = duanshiFull(state.men!, r, { posture: state.posture, lunarMonth: currentLunarMonth() });
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
      <div class="meta">${esc(full.domain_semantics.men_label)} · ${esc(full.verdict_from ?? "")}</div>
      ${full.xiangyi_review_flag ? '<div class="flagline">⚠ 全比和 · 象义待核（据理而断通道）</div>' : ""}
      <div class="watermark">规则表 ${esc((full.domain as any).table_status)}</div>
    </div>`);
  head.insertBefore(hexDiagram(r), head.querySelector(".meta"));
  app.appendChild(head);

  if (state.question.trim()) {
    app.appendChild(el(`<div class="card">✍️ 所问：${esc(state.question.trim())}</div>`));
  }

  app.appendChild(chainCard(r, full));
  app.appendChild(promptCard(r, full));
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

/** 推演链折叠区。 */
function chainCard(r: CastResult, f: DuanshiFull): HTMLElement {
  const kv = (s: unknown) => `<div class="kv">${esc(s)}</div>`;
  const parts: string[] = [];

  parts.push(`<details open><summary>排盘</summary>
    ${kv(`上卦 ${r.shang_gua} / 下卦 ${r.xia_gua} → 本卦 ${r.ben_gua}（${r.ben_short}）`)}
    ${kv(`互卦 ${r.hu_gua}（上${r.hu_shang} 下${r.hu_xia}）`)}
    ${kv(`动爻 第${r.dong_yao}爻 → 变卦 ${r.bian_gua}`)}
    ${kv(`体 ${r.ti}(${r.ti_wuxing}) · 用 ${r.yong}(${r.yong_wuxing})（含动爻之卦为用）`)}
    ${kv(`起卦取数：${JSON.stringify(r.trace)}`)}
  </details>`);

  parts.push(`<details><summary>生克与净评</summary>
    ${r.shengke.relations.map((x) => kv(`${x.phrase}：${x.from}${x.wuxing} ${x.rel}（${x.tone}）`)).join("")}
    ${kv(`计数 生体${f.net_d.sheng_ti} − 克体${f.net_d.ke_ti} = d=${f.net_d.d} → 档：${f.net_d.band}`)}
    ${kv(`最终极性 ${f.final_verdict}（${f.verdict_from}）`)}
  </details>`);

  parts.push(`<details><summary>门类查表</summary>
    ${kv(`${f.domain_semantics.men_label} · 体用关系 ${f.domain_semantics.relation ?? "—"} → 基础极性 ${f.base_polarity ?? "—"}`)}
    ${f.domain_semantics.duanyu_template ? kv(`断语模板：${f.domain_semantics.duanyu_template}`) : ""}
    ${kv(`原文依据：「${f.domain_semantics.source_quote}」`)}
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

  return el(`<div class="card">${parts.join("")}</div>`);
}

/** 可复制解读 Prompt。 */
function promptCard(r: CastResult, f: DuanshiFull): HTMLElement {
  const render = () => buildExportPrompt(r, f, {
    question: state.question.trim() || null,
    includeFewshot: state.includeFewshot,
  });
  let out = render();

  const card = el(`
    <div class="card">
      <div class="guaname" style="text-align:left;font-size:15px;color:var(--ink)">把下面这段复制给你的 AI，它就能据此解读</div>
      <p class="note">本站不调用任何 AI。以下文本由确定性排盘产出：盘面事实 + 解读要求。两段可分开复制。</p>
      <label><input type="checkbox" id="f_fs" style="width:auto" /> 附带口吻范例（文本更长，解读风格更稳）</label>
      <div style="margin-top:10px">
        <button class="inline primary" id="b_all">复制全文</button>
        <button class="inline" id="b_facts">只复制「盘面与规则」</button>
        <button class="inline" id="b_contract">只复制「解读要求」</button>
      </div>
      <details open style="margin-top:6px"><summary>预览</summary><pre class="prompt" id="pv"></pre></details>
    </div>`);

  const pv = card.querySelector("#pv") as HTMLElement;
  const paint = () => { pv.textContent = out.full; };
  paint();

  (card.querySelector("#f_fs") as HTMLInputElement).onchange = (e) => {
    state.includeFewshot = (e.target as HTMLInputElement).checked;
    out = render();
    paint();
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`已复制${what}（${text.length} 字）`);
    } catch {
      // 剪贴板不可用（权限/非安全上下文）时退回选中，由用户手动复制
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      toast("复制受限，已选中文本，请手动复制");
      setTimeout(() => ta.remove(), 8000);
    }
  };
  (card.querySelector("#b_all") as HTMLElement).onclick = () => copy(out.full, "全文");
  (card.querySelector("#b_facts") as HTMLElement).onclick = () => copy(out.facts, "盘面与规则");
  (card.querySelector("#b_contract") as HTMLElement).onclick = () => copy(out.contract, "解读要求");
  return card;
}

render();
