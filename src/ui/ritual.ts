/**
 * 起卦的仪式感：静心默念 → 按住起卦 → 成卦动画。
 *
 * 只是演示，**不碰排盘**：结果在动画开始前已由引擎算定，动画按结果逐爻画出来；
 * 点一下就跳过，系统设了「减少动态效果」的直接跳过。
 *
 * 「按住」不是摆设：此刻起卦法的起卦时刻，取的就是按满的那一刻（原书以动念之时起卦）。
 */
import type { CastResult } from "../engine/result.js";
import type { LiurenResult } from "../engine/liuren/result.js";
import { DIZHI, zhiIndex, type Zhi } from "../engine/liuren/ganzhi.js";
import { el, esc } from "./shared.js";

const HOLD_MS = 1500;

const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const buzz = (ms: number): void => {
  try { navigator.vibrate?.(ms); } catch { /* 不支持就算了 */ }
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RitualOptions {
  /** 「起卦」或「起课」 */
  verb: string;
  /** 用户写的所问，空就不显示 */
  question: string;
  /** 静心页引一句原书（只梅花有；六壬不借梅花的话） */
  quote?: { text: string; from: string };
  /** 起卦时刻是否取按满那一刻（此刻起卦、六壬占时跟此刻时为 true） */
  timeFromHold: boolean;
}

/**
 * 静心页。返回按满那一刻的时间；用户取消返回 null。
 */
export function ritual(o: RitualOptions): Promise<Date | null> {
  return new Promise((resolve) => {
    const C = 2 * Math.PI * 46;
    const ov = el(`
      <div class="ritual" role="dialog" aria-modal="true" aria-label="静心${esc(o.verb)}">
        <div class="rit-inner">
          <div class="breath${reducedMotion() ? " still" : ""}" aria-hidden="true"><span>静</span></div>
          <p class="rit-line">先静下心。闭上眼，把要问的事在心里默念一遍。</p>
          ${o.question.trim() ? `<p class="rit-q">「${esc(o.question.trim())}」</p>` : ""}
          ${o.quote ? `<p class="rit-quote">「${esc(o.quote.text)}」<small>——${esc(o.quote.from)}</small></p>` : ""}
          <button class="hold" type="button" aria-label="按住一秒半${esc(o.verb)}">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle class="trk" cx="50" cy="50" r="46" />
              <circle class="bar" cx="50" cy="50" r="46" stroke-dasharray="${C}" stroke-dashoffset="${C}" />
            </svg>
            <span>默念好了<br />按住${esc(o.verb)}</span>
          </button>
          <p class="rit-hint">${o.timeFromHold ? `按满一秒半的那一刻，就是${esc(o.verb)}时刻` : "按满一秒半即成"}</p>
          <button class="ghost inline rit-cancel" type="button">先不${esc(o.verb)}</button>
        </div>
      </div>`);
    document.body.appendChild(ov);
    document.body.classList.add("noscroll");
    const bar = ov.querySelector(".bar") as SVGCircleElement;
    const hold = ov.querySelector(".hold") as HTMLButtonElement;
    let t0 = 0, raf = 0, timer = 0, pressing = false, done = false;

    const close = (v: Date | null) => {
      ov.classList.add("out");
      document.body.classList.remove("noscroll");
      setTimeout(() => ov.remove(), 260);
      resolve(v);
    };
    // 按满由计时器判定，进度环由动画帧画——页面在后台时动画帧会停，计时器不停
    const finish = () => {
      if (done || !pressing) return;
      done = true;
      cancelAnimationFrame(raf);
      const at = new Date();
      bar.setAttribute("stroke-dashoffset", "0");
      hold.classList.add("done");
      buzz(40);
      setTimeout(() => close(at), 220);
    };
    const paint = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD_MS);
      bar.setAttribute("stroke-dashoffset", String(C * (1 - p)));
      if (p < 1 && pressing) raf = requestAnimationFrame(paint);
    };
    const start = (e: Event) => {
      e.preventDefault();
      if (done || pressing) return;
      pressing = true;
      t0 = performance.now();
      hold.classList.add("pressing");
      buzz(10);
      raf = requestAnimationFrame(paint);
      timer = window.setTimeout(finish, HOLD_MS);
    };
    const cancel = () => {
      if (done || !pressing) return;
      pressing = false;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      hold.classList.remove("pressing");
      bar.setAttribute("stroke-dashoffset", String(C));
    };
    hold.addEventListener("pointerdown", start);
    hold.addEventListener("pointerup", cancel);
    hold.addEventListener("pointerleave", cancel);
    hold.addEventListener("pointercancel", cancel);
    hold.addEventListener("contextmenu", (e) => e.preventDefault());
    hold.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) start(e); });
    hold.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") cancel(); });
    (ov.querySelector(".rit-cancel") as HTMLElement).onclick = () => close(null);
    setTimeout(() => hold.focus(), 50);
  });
}

/** 动画外壳：点一下跳过；减少动态效果时直接跳过。 */
async function stage(build: (ov: HTMLElement, alive: () => boolean) => Promise<void>): Promise<void> {
  if (reducedMotion()) return;
  const ov = el(`<div class="castshow" role="status" aria-live="polite"><div class="cs-inner"></div>
    <p class="cs-skip">点一下跳过</p></div>`);
  document.body.appendChild(ov);
  document.body.classList.add("noscroll");
  let skipped = false;
  ov.onclick = () => { skipped = true; };
  await Promise.race([
    build(ov.querySelector(".cs-inner") as HTMLElement, () => !skipped),
    new Promise<void>((r) => ov.addEventListener("click", () => r(), { once: true })),
  ]);
  ov.classList.add("out");
  document.body.classList.remove("noscroll");
  await sleep(240);
  ov.remove();
}

const yaoHtml = (bit: number, extra = "") =>
  `<div class="yao ${bit === 1 ? "yang" : "yin"}${extra}">${bit === 1 ? "<i></i>" : "<i></i><i></i>"}</div>`;

/** 梅花：自下而上逐爻成卦 → 动爻闪动 → 翻成变卦。 */
export function castShowMeihua(r: CastResult): Promise<void> {
  return stage(async (box, alive) => {
    box.innerHTML = `
      <div class="cs-title">成卦</div>
      <div class="cs-hex"></div>
      <div class="cs-cap">&nbsp;</div>`;
    const hex = box.querySelector(".cs-hex") as HTMLElement;
    const cap = box.querySelector(".cs-cap") as HTMLElement;
    const title = box.querySelector(".cs-title") as HTMLElement;
    const rows: HTMLElement[] = [];
    for (let pos = 1; pos <= 6; pos++) {
      if (!alive()) return;
      const row = el(yaoHtml(r.ben_bits[pos - 1]!, " rise"));
      hex.prepend(row);          // 自下而上
      rows[pos] = row;
      buzz(12);
      if (pos === 3) cap.textContent = `下卦 ${r.xia_gua}`;
      if (pos === 6) cap.textContent = `上卦 ${r.shang_gua} · 下卦 ${r.xia_gua}`;
      await sleep(300);
    }
    title.textContent = r.ben_gua;
    await sleep(500);
    if (!alive()) return;
    const d = rows[r.dong_yao]!;
    d.classList.add("dong", "pulse");
    cap.textContent = `第 ${r.dong_yao} 爻动`;
    await sleep(900);
    if (!alive()) return;
    const flipped = el(yaoHtml(r.bian_bits[r.dong_yao - 1]!, " dong flipin"));
    d.replaceWith(flipped);
    title.textContent = r.bian_gua;
    cap.textContent = `${r.ben_gua} → ${r.bian_gua}`;
    buzz(30);
    await sleep(1100);
  });
}

/** 六壬：月将加占时——天盘转到位 → 三传逐一亮出。 */
export function castShowLiuren(r: LiurenResult): Promise<void> {
  return stage(async (box, alive) => {
    const R = 104;
    const ang = (z: string) => (zhiIndex(z as Zhi) - 6) * 30;   // 午在正上方，地支序顺时针
    const lab = (z: string, rot: number, cls: string) =>
      `<span class="${cls}" data-z="${z}" style="transform:rotate(${ang(z)}deg) translateY(-${cls === "di" ? R : R - 30}px) rotate(${-ang(z) - rot}deg)">${z}</span>`;
    box.innerHTML = `
      <div class="cs-title">月将 ${esc(r.yuejiang.zhi)} 加 占时 ${esc(r.input.zhanshi)}</div>
      <div class="ring">
        <div class="ring-di">${DIZHI.map((z) => lab(z, 0, "di")).join("")}</div>
        <div class="ring-tian">${DIZHI.map((z) => lab(z, 0, "tian")).join("")}</div>
      </div>
      <div class="cs-chuan"></div>
      <div class="cs-cap">外圈地盘，内圈天盘</div>`;
    const tian = box.querySelector(".ring-tian") as HTMLElement;
    const cap = box.querySelector(".cs-cap") as HTMLElement;
    const chuan = box.querySelector(".cs-chuan") as HTMLElement;
    await sleep(450);
    if (!alive()) return;
    // 天盘上月将那一支要落到地盘占时的位置：转 (占时 − 月将) 格，每格 30°
    const k = ((zhiIndex(r.input.zhanshi) - zhiIndex(r.yuejiang.zhi)) % 12 + 12) % 12;
    const rot = k * 30;
    tian.style.transform = `rotate(${rot}deg)`;
    tian.querySelectorAll<HTMLElement>("span").forEach((s) => {
      const z = s.dataset.z!;
      s.style.transform = `rotate(${ang(z)}deg) translateY(-${R - 30}px) rotate(${-ang(z) - rot}deg)`;
    });
    await sleep(1700);
    if (!alive()) return;
    // 过渡被节流（后台页、省电模式）时会停在半路：到点一律落到终态，免得高亮与位置对不上
    tian.style.transition = "none";
    tian.querySelectorAll<HTMLElement>("span").forEach((s) => { s.style.transition = "none"; });
    tian.querySelector(`span[data-z="${r.yuejiang.zhi}"]`)?.classList.add("hit");
    box.querySelector(`.ring-di span[data-z="${r.input.zhanshi}"]`)?.classList.add("hit");
    buzz(20);
    cap.textContent = r.sanchuan.keti;
    await sleep(500);
    for (const c of r.chuanDetail) {
      if (!alive()) return;
      chuan.appendChild(el(`<span class="chip rise">${esc(c.pos)} ${esc(c.zhi)}<small>${esc(c.jiang)}${c.kong ? "·空" : ""}</small></span>`));
      buzz(12);
      await sleep(420);
    }
    await sleep(900);
  });
}
