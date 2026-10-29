/**
 * 大六壬 · 界面。
 *
 * 两屏：所问 → 课盘。与梅花同一条 UX 规矩：**只问非用户不可的东西**。
 * 六壬起课除了时刻什么都不用填，所以第一屏只要一句所问；占时默认取设备时钟，
 * 展开才给手改（原书「以来人报时为占时」，来人报的时辰未必是此刻）。
 */
import { divineLiuren, sikeLabels, type LiurenResult } from "../engine/liuren/result.js";
import { DIZHI, type Zhi } from "../engine/liuren/ganzhi.js";
import { TIANJIANG } from "../engine/liuren/tianjiang.js";
import { buildLiurenPrompt } from "../prompt/buildLiurenPrompt.js";
import { leixiangOf, TIANJIANG_SOURCE } from "../engine/liuren/tianjiangLeixiang.js";
import { CALENDAR_LIB } from "../engine/lineage.js";
import { backgroundCard, el, esc, promptCardBase } from "./shared.js";
import { BACKGROUND_MAX } from "../prompt/conversation.js";

export interface LiurenState {
  screen: 1 | 2;
  question: string;
  /** 问课人自述的背景（选填，只进导出文本） */
  background: string;
  /** 手选的占时；null = 跟设备时钟 */
  zhanshi: Zhi | null;
  at: Date;
  /** 导出的解读要求：聊天版（默认）／详解版（每段标依据） */
  style: "chat" | "plain";
}

export function initLiurenState(): LiurenState {
  return { screen: 1, question: "", background: "", zhanshi: null, at: new Date(), style: "chat" };
}

/** 天将简称，盘面格子里用一个字更好认。 */
const SHORT: Readonly<Record<string, string>> = Object.freeze({
  贵人: "贵", 螣蛇: "蛇", 朱雀: "雀", 六合: "合", 勾陈: "勾", 青龙: "龙",
  天空: "空", 白虎: "虎", 太常: "常", 玄武: "玄", 太阴: "阴", 天后: "后",
});

/** 地盘十二支在 4×4 方阵中的位置（传统排法：巳午未申 / 辰·酉 / 卯·戌 / 寅丑子亥）。 */
const RING_POS: ReadonlyArray<[Zhi, number, number]> = Object.freeze([
  ["巳", 1, 1], ["午", 1, 2], ["未", 1, 3], ["申", 1, 4],
  ["辰", 2, 1], ["酉", 2, 4],
  ["卯", 3, 1], ["戌", 3, 4],
  ["寅", 4, 1], ["丑", 4, 2], ["子", 4, 3], ["亥", 4, 4],
] as Array<[Zhi, number, number]>);

/** 天地盘方阵。中央 2×2 写日干支、占时、月将。 */
function plateGrid(r: LiurenResult): HTMLElement {
  const byDi = new Map(r.rows.map((x) => [x.di, x]));
  const chuanOf = new Map(r.chuanDetail.map((c) => [c.zhi, c.pos]));
  const cells: string[] = [];
  for (const [di, row, col] of RING_POS) {
    const x = byDi.get(di)!;
    const mark = chuanOf.get(x.tian);     // 该天盘支是否为三传之一
    cells.push(`
      <div class="lrcell${x.kong ? " kong" : ""}${mark ? " chuan" : ""}"
           style="grid-row:${row};grid-column:${col}">
        <span class="jiang">${esc(SHORT[x.jiang] ?? x.jiang)}</span>
        <span class="tian">${esc(x.tian)}</span>
        <span class="di">${esc(di)}</span>
        ${mark ? `<span class="cmark">${esc(mark)}</span>` : ""}
      </div>`);
  }
  return el(`
    <div class="lrplate">
      ${cells.join("")}
      <div class="lrcenter" style="grid-row:2/4;grid-column:2/4">
        <div class="c1">${esc(r.input.dayGanZhi)}日</div>
        <div class="c2">${esc(r.input.zhanshi)}时 · ${esc(r.input.zhouye)}占</div>
        <div class="c2">月将 ${esc(r.yuejiang.zhi)}（${esc(r.yuejiang.jiangName)}）</div>
        <div class="c3">空亡 ${esc(r.kongwang.join("、"))}</div>
      </div>
    </div>`);
}

/** 四课。右起一课，与原书书写次第一致。 */
function sikeRow(r: LiurenResult): HTMLElement {
  const ke = [...r.sike.ke].reverse();   // 显示从第四课到第一课
  const cells = ke.map((k) => {
    const rel = k.xiaZeiShang ? "下贼上" : k.shangKeXia ? "上克下" : "—";
    const jiang = r.tianjiang.byTian[k.shang] ?? "";
    const xia = k.index === 1 ? `${k.xia}` : k.xia;
    return `
      <div class="sike-ke">
        <div class="kn">第${["一", "二", "三", "四"][k.index - 1]}课</div>
        <div class="kj">${esc(SHORT[jiang] ?? "")}</div>
        <div class="ks">${esc(k.shang)}</div>
        <div class="kx">${esc(xia)}</div>
        <div class="kr${rel === "—" ? " none" : ""}">${esc(rel)}</div>
      </div>`;
  });
  return el(`<div class="sike">${cells.join("")}</div>`);
}

/** 三传。 */
function chuanRow(r: LiurenResult): HTMLElement {
  const rows = r.chuanDetail.map((c) => `
    <div class="chuan-row${c.kong ? " kong" : ""}">
      <span class="cp">${esc(c.pos)}传</span>
      <span class="cz">${esc(c.dun ?? "〇")}${esc(c.zhi)}</span>
      <span class="cj">${esc(c.jiang)}</span>
      <span class="cr">${esc(c.relToGan)}</span>
      ${c.kong ? '<span class="ck">空亡</span>' : ""}
    </div>`);
  return el(`<div class="chuan">${rows.join("")}</div>`);
}

/** 屏1：所问 + 占时。 */
function screenQuestion(app: HTMLElement, st: LiurenState, rerender: () => void): void {
  app.appendChild(el(`<div class="step">第 1/2 步 · 你问什么</div>`));

  const now = divineLiuren({ at: st.at });
  const qc = el(`
    <div class="card">
      <label>你想问什么？写一句就行</label>
      <textarea id="lr_q" maxlength="300" placeholder="例：这件事能不能成？">${esc(st.question)}</textarea>
      <div class="note" style="text-align:right"><span id="lr_qn">0</span>/300</div>
      <p class="note">所问只作解读情境，不参与起课，也不改变课上任何一项。</p>
    </div>`);
  app.appendChild(qc);
  const ta = qc.querySelector("#lr_q") as HTMLTextAreaElement;
  const qn = qc.querySelector("#lr_qn") as HTMLElement;
  qn.textContent = String(st.question.length);
  ta.oninput = () => { st.question = ta.value; qn.textContent = String(ta.value.length); };
  app.appendChild(backgroundCard(st.background, BACKGROUND_MAX, (v) => { st.background = v; }, "课象"));

  const tc = el(`
    <div class="card">
      <div class="kv">🕒 ${esc(now.input.gregorian)}　${esc(now.input.dayGanZhi)}日　占时 ${esc(st.zhanshi ?? now.input.zhanshi)}　月将 ${esc(now.yuejiang.zhi)}（${esc(now.yuejiang.jiangName)}）</div>
      <details>
        <summary>改占时（原书以来人报时为占时，未必是此刻）</summary>
        <label>占时</label>
        <select id="lr_shi">
          <option value=""${st.zhanshi ? "" : " selected"}>跟此刻（${esc(now.input.zhanshi)}）</option>
          ${DIZHI.map((d) => `<option value="${d}"${st.zhanshi === d ? " selected" : ""}>${d}时</option>`).join("")}
        </select>
        <p class="note">月将按中气过宫，由起课日期决定，不随占时改；换算依赖 ${esc(CALENDAR_LIB)}。
          日干支按 23 时起算次日（软件约定，非原书所定）。</p>
      </details>
    </div>`);
  app.appendChild(tc);

  const go = el(`<button class="primary">起课</button>`);
  go.onclick = () => {
    st.question = ta.value;
    const v = (tc.querySelector("#lr_shi") as HTMLSelectElement).value;
    st.zhanshi = v ? (v as Zhi) : null;
    st.at = new Date();
    st.screen = 2;
    rerender();
  };
  app.appendChild(go);
}

const CONF_BADGE: Readonly<Record<string, string>> = Object.freeze({
  confirmed: "本课取传法已与两家独立排盘实现逐传核过",
  likely: "本课取传法已核对，但其中一步各家仍有不同说法",
  disputed: "本课取传法各家不同，下方已并列两说",
});

/** 屏2：课盘。 */
function screenResult(app: HTMLElement, st: LiurenState, rerender: () => void): void {
  app.appendChild(el(`<div class="step">第 2/2 步 · 课盘与解读 Prompt</div>`));
  const again = el(`<button class="ghost inline">← 重新起课</button>`);
  again.onclick = () => { st.screen = 1; st.at = new Date(); rerender(); };
  app.appendChild(again);

  let r: LiurenResult;
  try {
    r = divineLiuren({ at: st.at, zhanshi: st.zhanshi ?? undefined, question: st.question });
  } catch (e) {
    app.appendChild(el(`<div class="card">起课失败：${esc((e as Error).message)}</div>`));
    return;
  }

  const head = el(`
    <div class="card">
      <div class="guaname">${esc(r.sanchuan.keti)}</div>
      <div class="meta">${esc(r.input.dayGanZhi)}日 · 占时${esc(r.input.zhanshi)} · ${esc(r.input.zhouye)}占 · 月将${esc(r.yuejiang.zhi)}</div>
      <div class="conf ${esc(r.sanchuan.confidence)}">${esc(CONF_BADGE[r.sanchuan.confidence] ?? r.sanchuan.confidence)}</div>
    </div>`);
  head.insertBefore(plateGrid(r), head.querySelector(".meta"));
  app.appendChild(head);

  if (r.question) {
    app.appendChild(el(`<div class="card">✍️ 所问：${esc(r.question)}</div>`));
  }
  if (st.background.trim()) {
    app.appendChild(el(`<div class="card note">📝 你补充的情况已附在下方复制文本里（只作情境，不影响课盘）。</div>`));
  }

  const sc = el(`<div class="card"><div class="guaname" style="text-align:left;font-size:15px;color:var(--ink)">四课三传</div></div>`);
  sc.appendChild(sikeRow(r));
  sc.appendChild(el(`<div class="note" style="margin-top:8px">一二课属日干（你），三四课属日支（对方／所问之事）。初传是发端，中传是经过，末传是落脚。</div>`));
  sc.appendChild(chuanRow(r));
  app.appendChild(sc);

  app.appendChild(chainCard(r));
  app.appendChild(promptCard(r, st));
}

function chainCard(r: LiurenResult): HTMLElement {
  const kv = (s: unknown) => `<div class="kv">${esc(s)}</div>`;
  const parts: string[] = [];

  parts.push(`<details open><summary>发用推导（三传是怎么取出来的）</summary>
    ${r.sanchuan.derivation.map((x) => kv(x)).join("")}
    ${kv(`课体：${r.sanchuan.keti}　取传：${r.sanchuan.gate}`)}
  </details>`);

  parts.push(`<details><summary>起课</summary>
    ${kv(`${r.input.gregorian}　${r.input.note}`)}
    ${kv(`月将 ${r.yuejiang.zhi}（${r.yuejiang.jiangName}）——据${r.yuejiang.zhongqi} ${r.yuejiang.zhongqiTime} 过宫`)}
    ${kv(`日干 ${r.input.gan} 寄宫 ${r.sike.jigong}　日支 ${r.input.zhi}`)}
    ${kv(`旬首 ${r.xunshou}　空亡 ${r.kongwang.join("、")}`)}
    ${r.plate.fuyin ? kv("伏吟：月将与占时同支，天地盘重叠") : ""}
    ${r.plate.fanyin ? kv("返吟：月将与占时相冲，天地盘对冲") : ""}
  </details>`);

  parts.push(`<details><summary>四课逐课</summary>
    ${sikeLabels(r).reverse().map((s) => kv(s)).join("")}
  </details>`);

  parts.push(`<details><summary>天地盘十二格</summary>
    ${r.rows.map((x) => kv(`${x.di} → ${x.tian}（${x.jiang}${x.kong ? "·空" : ""}）`)).join("")}
  </details>`);

  parts.push(`<details><summary>十二天将</summary>
    ${r.tianjiang.derivation.map((x) => kv(x)).join("")}
  </details>`);

  const lxSeen = new Set<string>();
  const lx = r.chuanDetail
    .map((c) => c.jiang)
    .filter((j) => (lxSeen.has(j) ? false : (lxSeen.add(j), true)))
    .map((j) => leixiangOf(j))
    .filter((x): x is NonNullable<typeof x> => !!x);
  parts.push(`<details><summary>天将类象（《${TIANJIANG_SOURCE.book}》原句）</summary>
    ${lx.map((x) => kv(`${x.jiang}：「${x.text}」`)).join("")}
    <div class="kv" style="color:var(--ink2)">录自${esc(TIANJIANG_SOURCE.section)}，${esc(TIANJIANG_SOURCE.edition)}，原书无标点，照录。
      <a href="${esc(TIANJIANG_SOURCE.url)}" target="_blank" rel="noopener">查看原文</a>（${esc(TIANJIANG_SOURCE.status)}）</div>
  </details>`);

  parts.push(`<details><summary>门派分歧（并列提示，不替你裁决）</summary>
    ${r.disputes.map((d) => kv(d)).join("")}
  </details>`);

  return el(`<div class="card">
    <div class="guaname" style="text-align:left;font-size:15px;color:var(--ink)">推演链 · 每一步都可查</div>
    ${parts.join("")}
  </div>`);
}

function promptCard(r: LiurenResult, st: LiurenState): HTMLElement {
  const out = buildLiurenPrompt(r, { background: st.background.trim() || null });
  const pick = () => (st.style === "plain" ? out.full : out.chatFull);
  const MODE_NAME = { chat: "聊天版", plain: "详解版" } as const;
  const extra = el(`
    <details style="margin-top:8px">
      <summary>解读风格：<span class="modename"></span></summary>
      <label><input type="radio" name="lr_mode" value="chat" style="width:auto" /> <b>聊天版</b>（默认）——像懂大六壬的朋友当面帮你分析：先说走向，再讲怎么发展、哪里要小心、怎么做；少术语</label>
      <label><input type="radio" name="lr_mode" value="plain" style="width:auto" /> <b>详解版</b>——逐步讲起课来由，每段标出依据，适合想核对推理的人</label>
    </details>`);
  const card = promptCardBase({
    title: "把这段复制给你的 AI，让它解这一课",
    note: "本站不调用任何 AI。文本由确定性排盘产出：<b>先盘面，后要求</b>——" +
      "盘面是别处拿不到的部分，万一被截断，先保住它。",
    buttons: [["复制（盘面 + 解读要求）", pick], ["只复制盘面", () => out.board]],
    preview: pick,
    extra,
  });
  const modename = extra.querySelector(".modename") as HTMLElement;
  const sync = () => {
    modename.textContent = MODE_NAME[st.style];
    (card as any).__repaint();
  };
  extra.querySelectorAll<HTMLInputElement>('input[name="lr_mode"]').forEach((radio) => {
    radio.checked = radio.value === st.style;
    radio.onchange = () => {
      if (!radio.checked) return;
      st.style = radio.value as LiurenState["style"];
      sync();
    };
  });
  sync();
  return card;
}

/** 由 main 调用：把六壬这一套渲染进 #app。 */
export function renderLiuren(app: HTMLElement, st: LiurenState, rerender: () => void): void {
  if (st.screen === 1) screenQuestion(app, st, rerender);
  else screenResult(app, st, rerender);
}

export { TIANJIANG };
