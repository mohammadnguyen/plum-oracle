/**
 * 外应选择卡：起卦时身边的所见所闻，按原书「复明某某之应」论卦象的条目点选。
 * 只给原书写了的条目，不收自由文本——「天很晴」对不对得上「天无云翳，明朗之际」，
 * 是用户自己看到的事，由用户自己点，程序不替他做同义判断。
 */
import { WAIYING, WAIYING_CATS } from "../engine/waiying.js";
import { el, esc, toast } from "./shared.js";

export const WAIYING_MAX = 3;

export function waiyingCard(picked: string[]): HTMLElement {
  const groups = WAIYING_CATS.map((cat) => {
    const items = WAIYING.filter((x) => x.cat === cat).map((x) =>
      `<button type="button" data-id="${x.id}" class="${picked.includes(x.id) ? "on" : ""}">${esc(x.label)}<small>${esc(x.gua.length ? x.gua.join("、") : "")}${x.gua.length ? "·" : ""}${esc(x.wuxing)}</small></button>`);
    return `<div class="wy-cat"><span class="wy-name">${esc(cat)}</span><div class="matches">${items.join("")}</div></div>`;
  });
  const card = el(`
    <div class="card">
      <details${picked.length ? " open" : ""}>
        <summary>起卦时身边有什么动静？（外应，选填，最多 ${WAIYING_MAX} 项）</summary>
        <p class="note">原书讲「十应」：起卦时眼见耳闻的事物也算一卦，与体卦比生克（卷二二十九 十应目论）。
          只列原书写明对应哪一卦的条目；看到、听到了就点上，没有就跳过。</p>
        ${groups.join("")}
        <p class="note">外应只作为盘面之外的一层参照，不改动本卦的吉凶档。</p>
      </details>
    </div>`);
  card.querySelectorAll<HTMLButtonElement>("button[data-id]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id!;
      const i = picked.indexOf(id);
      if (i >= 0) { picked.splice(i, 1); b.classList.remove("on"); return; }
      if (picked.length >= WAIYING_MAX) { toast(`外应最多选 ${WAIYING_MAX} 项`); return; }
      picked.push(id);
      b.classList.add("on");
    };
  });
  return card;
}
