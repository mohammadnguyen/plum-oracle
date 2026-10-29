/**
 * 界面共用件。梅花与六壬两套流程共用同一个外壳：页眉、页脚、提示条、复制。
 * 抽出来是为了让两套界面长得像一个站，而不是两个拼起来的站。
 */

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function el(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
}

export function toast(msg: string): void {
  let t = document.querySelector(".toast") as HTMLElement | null;
  if (!t) {
    t = el('<div class="toast"></div>');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t!.classList.remove("show"), 1600);
}

/** 复制到剪贴板；不可用（权限/非安全上下文）时退回选中，由用户手动复制。 */
export async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(`已复制${what}（${text.length} 字）`);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    toast("复制受限，已选中文本，请手动复制");
    setTimeout(() => ta.remove(), 8000);
  }
}

/** 站头。`sub` 随当前体系变。 */
export function siteHeader(sub: string, badge: string): HTMLElement {
  return el(`
    <header class="site">
      <h1>象数排盘</h1>
      <div class="sub">${esc(sub)}</div>
      <div class="badge">${esc(badge)}</div>
    </header>`);
}

export function siteFooter(): HTMLElement {
  return el(`
    <footer class="site">
      本站呈现传统象数体系的内部透明推演，不作、不暗示任何科学预测效力。<br />
      解读由你自己的 AI 工具完成；本站只负责把盘排准、把依据摆全。<br />
      © 2026 本站作者 · 版权所有。禁止复制、转载、改作或搭建镜像；<br />
      禁止将本站内容用于训练 AI 模型或构建数据集。
    </footer>`);
}

/**
 * 「补充你的情况」选填框：两套体系共用。写了就作为【问卦人自述的背景】附在盘面之后，
 * 只作情境，不参与排盘（用法说明随导出文本一起给 AI，见 prompt/conversation.ts）。
 * 默认收起：大多数人只想问一句就走，不该因此多一道门槛。
 */
export function backgroundCard(value: string, max: number, onInput: (v: string) => void, xiang = "卦象"): HTMLElement {
  const card = el(`
    <div class="card">
      <details${value.trim() ? " open" : ""}>
        <summary>补充你的情况（选填）——写几句现状，解读会更贴近你的事</summary>
        <textarea maxlength="${max}" placeholder="例：已经谈过两轮，对方压价压得很厉害；我这边最晚月底要定。">${esc(value)}</textarea>
        <div class="note" style="text-align:right"><span class="bgn">0</span>/${max}</div>
        <p class="note">只用来让 AI 把${xiang}落到你的具体处境里；结论仍只从盘面来，不会因为你写了什么而变好或变坏。
          本站不保存、不上传，它只出现在你复制走的文本里。</p>
      </details>
    </div>`);
  const ta = card.querySelector("textarea") as HTMLTextAreaElement;
  const n = card.querySelector(".bgn") as HTMLElement;
  n.textContent = String(value.length);
  ta.oninput = () => { n.textContent = String(ta.value.length); onInput(ta.value); };
  return card;
}

/** 可复制文本卡：两套体系共用。 */
export function promptCardBase(opts: {
  title: string;
  note: string;
  /** [按钮文案, 取文本] */
  buttons: Array<[string, () => string]>;
  preview: () => string;
  /** 额外塞进卡里的节点（如高级选项） */
  extra?: HTMLElement | null;
}): HTMLElement {
  const card = el(`
    <div class="card">
      <div class="guaname" style="text-align:left;font-size:15px;color:var(--ink)">${esc(opts.title)}</div>
      <p class="note">${opts.note}</p>
      <div class="btnrow"></div>
      <div class="extraslot"></div>
      <details style="margin-top:6px"><summary>预览（<span class="len"></span> 字）</summary><pre class="prompt"></pre></details>
    </div>`);
  const row = card.querySelector(".btnrow") as HTMLElement;
  const pre = card.querySelector("pre.prompt") as HTMLElement;
  const len = card.querySelector(".len") as HTMLElement;

  const paint = () => {
    const t = opts.preview();
    pre.textContent = t;
    len.textContent = String(t.length);
  };
  opts.buttons.forEach(([label, get], i) => {
    const b = el(`<button class="inline${i === 0 ? " primary" : ""}">${esc(label)}</button>`);
    b.onclick = () => void copyText(get(), label.replace(/^复制/, "") || "全文");
    row.appendChild(b);
  });
  if (opts.extra) (card.querySelector(".extraslot") as HTMLElement).appendChild(opts.extra);
  paint();
  (card as any).__repaint = paint;
  return card;
}
