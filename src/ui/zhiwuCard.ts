/**
 * 指物 · 方位起卦的输入卡：写下看到的东西 → 按原书《八卦万物属类》查卦；
 * 方位用手机指南针读，或手选。查表与切方位都在 engine/zhiwu.ts，这里只管交互。
 */
import { FANG, FANG_SOURCE, headingToFang, matchObject, soleTopGua, WANWU_ITEMS, type ZhiwuMatch } from "../engine/zhiwu.js";
import { startCompass, type CompassStop } from "./compass.js";
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
      <p class="note" style="margin-top:0">把手机顶端对着那件东西，点下面的按钮。</p>
      <button class="inline" id="b_compass" type="button">🧭 用手机指南针定方位</button>
      <div class="compass" id="compass" hidden>
        <div class="dial" aria-hidden="true"><span class="n">北</span><div class="needle"></div></div>
        <div class="read" id="cread">正在读指南针…</div>
      </div>
      <button class="inline primary" id="b_lock" type="button" hidden>就用这个方位</button>
      <p class="note" id="cnote"></p>
      <select id="f_dir" aria-label="手动选方位">
        <option value="">— 或手动选方位 —</option>
        ${FANG.map((f) => `<option value="${f.gua}"${st.dirGua === f.gua ? " selected" : ""}>${f.dir} · ${f.gua}</option>`).join("")}
      </select>
      <div class="picked" id="dirpicked"></div>
      <p class="note">物卦按原书卷一四十五《八卦万物属类》查；方位按${esc(FANG_SOURCE)}。
        手机指南针读的是磁北，靠近两方交界时请核对一下。</p>
    </div>`);

  const $ = <T extends HTMLElement>(s: string) => card.querySelector(s) as T;
  const txt = $<HTMLInputElement>("#f_objtxt");
  const box = $<HTMLElement>("#objmatches");
  const objPicked = $<HTMLElement>("#objpicked");
  const objSel = $<HTMLSelectElement>("#f_obj");
  const dirSel = $<HTMLSelectElement>("#f_dir");
  const dirPicked = $<HTMLElement>("#dirpicked");

  const paintObjPicked = () => {
    objPicked.innerHTML = st.objGua ? `上卦：<b>${esc(st.objGua)}</b>　${esc(st.objNote)}` : "";
  };
  const paintDirPicked = () => {
    dirPicked.innerHTML = st.dirGua ? `下卦：<b>${esc(st.dirGua)}</b>　${esc(st.dirNote)}` : "";
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

  // ── 指南针 ──
  let stop: CompassStop | null = null;
  let last: ReturnType<typeof headingToFang> | null = null;
  const comp = $<HTMLElement>("#compass");
  const read = $<HTMLElement>("#cread");
  const needle = $<HTMLElement>(".needle");
  const lock = $<HTMLButtonElement>("#b_lock");
  const cnote = $<HTMLElement>("#cnote");
  $<HTMLButtonElement>("#b_compass").onclick = async () => {
    stop?.();
    comp.hidden = false;
    cnote.textContent = "";
    read.textContent = "正在读指南针…";
    stop = await startCompass(
      (deg, acc) => {
        last = headingToFang(deg);
        needle.style.transform = `rotate(${-deg}deg)`;
        read.innerHTML = `${esc(last.dir)} · ${esc(last.gua)}<small>${Math.round(deg)}°${acc != null ? ` ±${Math.round(acc)}°` : ""}` +
          `${last.nearEdge ? " · 靠近两方交界，稍偏就换一卦" : ""}</small>`;
        lock.hidden = false;
      },
      (why) => {
        comp.hidden = true;
        lock.hidden = true;
        cnote.textContent = why;
      },
    );
  };
  lock.onclick = () => {
    if (!last) return;
    stop?.(); stop = null;
    st.dirGua = last.gua;
    st.dirNote = `指南针 ${Math.round(last.deg)}°（磁北）→ ${last.dir}${last.nearEdge ? "，靠近交界" : ""}`;
    dirSel.value = last.gua;
    lock.hidden = true;
    paintDirPicked();
  };
  dirSel.onchange = () => {
    stop?.(); stop = null;
    lock.hidden = true;
    const f = FANG.find((x) => x.gua === dirSel.value);
    st.dirGua = f ? f.gua : null;
    st.dirNote = f ? `手选 ${f.dir}` : "";
    paintDirPicked();
  };

  if (st.objText) search(); else paintObjPicked();
  paintDirPicked();
  (card as any).__stop = () => stop?.();
  return card;
}
