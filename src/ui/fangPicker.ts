/**
 * 定方位的小部件：手机指南针读数，或手选八方。指物起卦的下卦、方卦之应的来人方位共用。
 * 方位 → 卦按《八卦方位图》（engine/zhiwu.ts）。
 */
import { FANG, headingToFang } from "../engine/zhiwu.js";
import { startCompass, type CompassStop } from "./compass.js";
import { el, esc } from "./shared.js";

export interface FangValue {
  gua: string;
  dir: string;
  /** 人读的来历：指南针读数或手选 */
  note: string;
}

export function fangPicker(opts: {
  /** 选中后在下方显示的前缀，如「下卦」「来人方位」 */
  label: string;
  /** 指南针按钮上方的提示 */
  hint: string;
  value: FangValue | null;
  onPick: (v: FangValue | null) => void;
}): HTMLElement & { __stop?: () => void } {
  const box = el(`
    <div class="fangpicker">
      <p class="note" style="margin-top:0">${esc(opts.hint)}</p>
      <button class="inline fp-compass" type="button">🧭 用手机指南针定方位</button>
      <div class="compass" hidden>
        <div class="dial" aria-hidden="true"><span class="n">北</span><div class="needle"></div></div>
        <div class="read">正在读指南针…</div>
      </div>
      <button class="inline primary fp-lock" type="button" hidden>就用这个方位</button>
      <p class="note fp-why"></p>
      <select class="fp-sel" aria-label="手动选方位">
        <option value="">— 或手动选方位 —</option>
        ${FANG.map((f) => `<option value="${f.gua}"${opts.value?.gua === f.gua ? " selected" : ""}>${f.dir} · ${f.gua}</option>`).join("")}
      </select>
      <div class="picked fp-picked"></div>
    </div>`) as HTMLElement & { __stop?: () => void };
  const $ = <T extends HTMLElement>(s: string) => box.querySelector(s) as T;
  const comp = $<HTMLElement>(".compass");
  const read = $<HTMLElement>(".read");
  const needle = $<HTMLElement>(".needle");
  const lock = $<HTMLButtonElement>(".fp-lock");
  const why = $<HTMLElement>(".fp-why");
  const sel = $<HTMLSelectElement>(".fp-sel");
  const picked = $<HTMLElement>(".fp-picked");

  let cur = opts.value;
  const paint = () => {
    picked.innerHTML = cur ? `${esc(opts.label)}：<b>${esc(cur.gua)}</b>　${esc(cur.note)}` : "";
  };
  const set = (v: FangValue | null) => { cur = v; opts.onPick(v); paint(); };

  let stop: CompassStop | null = null;
  let last: ReturnType<typeof headingToFang> | null = null;
  $<HTMLButtonElement>(".fp-compass").onclick = async () => {
    stop?.();
    comp.hidden = false;
    why.textContent = "";
    read.textContent = "正在读指南针…";
    stop = await startCompass(
      (deg, acc) => {
        last = headingToFang(deg);
        needle.style.transform = `rotate(${-deg}deg)`;
        read.innerHTML = `${esc(last.dir)} · ${esc(last.gua)}<small>${Math.round(deg)}°${acc != null ? ` ±${Math.round(acc)}°` : ""}` +
          `${last.nearEdge ? " · 靠近两方交界，稍偏就换一卦" : ""}</small>`;
        lock.hidden = false;
      },
      (w) => { comp.hidden = true; lock.hidden = true; why.textContent = w; },
    );
  };
  lock.onclick = () => {
    if (!last) return;
    stop?.(); stop = null;
    sel.value = last.gua;
    lock.hidden = true;
    set({ gua: last.gua, dir: last.dir, note: `指南针 ${Math.round(last.deg)}°（磁北）→ ${last.dir}${last.nearEdge ? "，靠近交界" : ""}` });
  };
  sel.onchange = () => {
    stop?.(); stop = null;
    lock.hidden = true;
    const f = FANG.find((x) => x.gua === sel.value);
    set(f ? { gua: f.gua, dir: f.dir, note: `手选 ${f.dir}` } : null);
  };
  paint();
  box.__stop = () => stop?.();
  return box;
}
