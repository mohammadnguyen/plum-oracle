/**
 * 指物 · 方位起卦的输入卡：写下看到的东西 → 按原书《八卦万物属类》查卦；
 * 方位用手机指南针读，或手选。查表与切方位都在 engine/zhiwu.ts，这里只管交互。
 */
import { FANG, FANG_SOURCE, matchObject, soleTopGua, WANWU_ITEMS, type ZhiwuMatch } from "../engine/zhiwu.js";
import { fangPicker } from "./fangPicker.js";
import { el, esc } from "./shared.js";

export interface ZhiwuState {
  objText: string;
  objGua: string | null;
  /** 人读的取卦依据，结果页显示 */
  objNote: string;
  dirGua: string | null;
  dirNote: string;
}

export function initZhiwuState(): ZhiwuState {
  return { objText: "", objGua: null, objNote: "", dirGua: null, dirNote: "" };
}

const GUA_ORDER = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"];

const matchLabel = (m: ZhiwuMatch) => `卷一四十五·${m.cat}「${m.text}」（L${m.line}）`;

export function zhiwuCard(st: ZhiwuState): HTMLElement {
  // 手选上卦时给每卦带几条原书条目，免得用户对着八个卦名发愣
  const sample = (g: string) => WANWU_ITEMS.filter((x) => x.gua === g && (x.cat === "动物" || x.cat === "静物"))
    .slice(0, 6).map((x) => x.text).join("、");
  const card = el(`
    <div class="card">
      <label for="f_objtxt">你看到了什么？（作上卦）</label>
      <input id="f_objtxt" type="text" maxlength="30" placeholder="例：牛、一只鸡、一面镜子" value="${esc(st.objText)}" />
      <div class="matches" id="objmatches"></div>
      <div class="picked" id="objpicked"></div>
      <details>
        <summary>查不到？按原书条目自己选</summary>
        <p class="note">原书收的多是古时之物。现代物件可按形状、质地、颜色找最接近的一条，
          比如圆物、长物、方物、金类、赤色之物、黄物。</p>
        <select id="f_obj">
          <option value="">— 选一卦 —</option>
          ${GUA_ORDER.map((g) => `<option value="${g}"${st.objGua === g ? " selected" : ""}>${g}：${esc(sample(g))}…</option>`).join("")}
        </select>
      </details>

      <label style="margin-top:16px">它在你哪个方向？（作下卦）</label>
      <div id="dirslot"></div>
      <p class="note">物卦按原书卷一四十五《八卦万物属类》查；方位按${esc(FANG_SOURCE)}。
        手机指南针读的是磁北，靠近两方交界时请核对一下。</p>
    </div>`);

  const $ = <T extends HTMLElement>(s: string) => card.querySelector(s) as T;
  const txt = $<HTMLInputElement>("#f_objtxt");
  const box = $<HTMLElement>("#objmatches");
  const objPicked = $<HTMLElement>("#objpicked");
  const objSel = $<HTMLSelectElement>("#f_obj");

  const paintObjPicked = () => {
    objPicked.innerHTML = st.objGua ? `上卦：<b>${esc(st.objGua)}</b>　${esc(st.objNote)}` : "";
  };

  const search = () => {
    st.objText = txt.value;
    const ms = matchObject(txt.value).slice(0, 8);
    box.innerHTML = "";
    if (!txt.value.trim()) { paintObjPicked(); return; }
    if (!ms.length) {
      box.appendChild(el(`<p class="note">原书《八卦万物属类》里没有「${esc(txt.value.trim())}」。请在下面按条目自己选。</p>`));
      (card.querySelector("details") as HTMLDetailsElement).open = true;
      return;
    }
    const sole = soleTopGua(ms);
    if (sole && !st.objGua) {
      const m = ms[0]!;
      st.objGua = m.gua; st.objNote = matchLabel(m);
    }
    if (!sole) box.appendChild(el(`<p class="note" style="width:100%;margin:0">原书几卦都有，按你看到的实际情形挑一个：</p>`));
    for (const m of ms) {
      const b = el(`<button type="button" class="${st.objGua === m.gua && st.objNote === matchLabel(m) ? "on" : ""}">
        ${esc(m.gua)} · ${esc(m.text)}<small>${esc(m.cat)} · L${m.line}</small></button>`);
      b.onclick = () => {
        st.objGua = m.gua; st.objNote = matchLabel(m);
        objSel.value = "";
        box.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        paintObjPicked();
      };
      box.appendChild(b);
    }
    paintObjPicked();
  };
  txt.oninput = () => { st.objGua = null; st.objNote = ""; search(); };
  objSel.onchange = () => {
    if (!objSel.value) return;
    st.objGua = objSel.value;
    st.objNote = "按原书条目手选";
    box.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    paintObjPicked();
  };

  // ── 方位：指南针或手选 ──
  const f0 = FANG.find((x) => x.gua === st.dirGua);
  const picker = fangPicker({
    label: "下卦",
    hint: "把手机顶端对着那件东西，点下面的按钮。",
    value: f0 ? { gua: f0.gua, dir: f0.dir, note: st.dirNote } : null,
    onPick: (v) => { st.dirGua = v?.gua ?? null; st.dirNote = v?.note ?? ""; },
  });
  $<HTMLElement>("#dirslot").appendChild(picker);

  if (st.objText) search(); else paintObjPicked();
  (card as any).__stop = () => picker.__stop?.();
  return card;
}
