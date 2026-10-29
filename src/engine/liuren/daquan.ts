/**
 * 《六壬大全》引文的出处钉（旺相休囚、六亲用）。
 *
 * 与天将类象表（tianjiangLeixiang.ts）同一来源、同一提交、同一办法：用户 2026-10-29 决定
 * 这几张表照天将表办理——**机器逐字核对原书，不经人工签收**（CLAUDE.md §0.3 ⑪）。
 *
 * 引文按「清洗后」的原文存：去掉 <pb:…> 分页、¶ 断行、换行、全角空格，以及注文的排版记号
 * 「(」「)」「/」（四库本双行小注在 Kanripo 里以括号与斜杠标出，斜杠会把一句话从中切开）。
 * 原书无标点、异体字照录（如「巳」作「已」、「卯」作「夘」）。
 * `npm run verify:liuren` 取回钉死的提交，逐条断言：在该卷清洗后的原文中出现、首次出现在所记的页。
 */

export const DAQUAN_PIN = Object.freeze({
  book: "六壬大全",
  edition: "四庫全書・文淵閣本",
  repo: "kanripo/KR3g0031",
  commit: "320cbc13a9048aa0f028d996ab32f8bf7b362ef7",
  status: "机器逐字核对通过，未经人工签收",
});

export interface DaquanQuote {
  /** 卷次文件号，如 "005" */
  juan: string;
  /** 页码（Kanripo 页标去掉前缀），如 "005-6b" */
  page: string;
  /** 清洗后的原文，逐字 */
  text: string;
  /**
   * 该句在本卷出现的次数。多数为 1；卷八「物類課」一段在同卷重出，相关几句为 2，
   * 核对时以首次出现的页为准。
   */
  count: number;
}

const q = (juan: string, page: string, text: string, count = 1): DaquanQuote =>
  Object.freeze({ juan, page, text, count });

/** 人读的出处：「《六壬大全》卷五第 6b 页」。 */
export function citeOf(x: DaquanQuote): string {
  const juan = "〇一二三四五六七八九十"[Number(x.juan)] ?? x.juan;
  return `《${DAQUAN_PIN.book}》卷${juan}第 ${x.page.split("-")[1]} 页`;
}

export function daquanUrl(juan: string): string {
  return `https://github.com/${DAQUAN_PIN.repo}/blob/${DAQUAN_PIN.commit}/KR3g0031_${juan}.txt`;
}

/** 本表全部引文，核对脚本逐条过。 */
export const DAQUAN_QUOTES = Object.freeze({
  // ── 旺相休囚死：卷五「元首課」心鏡注，四季逐一列出 ──
  wang: q("005", "005-6a", "春木旺夏火旺秋金旺冬水旺四季土旺"),
  xiang: q("005", "005-6a", "春火相夏土相秋水相冬木相季月金相"),
  si: q("005", "005-6b", "春土死夏金死秋木死冬火死"),
  qiu: q("005", "005-6b", "春金囚夏水囚秋火囚冬土囚季木囚"),
  xiu: q("005", "005-6b", "春水休夏木休秋土休冬金休季火休"),
  // 卷五没写季月何者为死；总则见卷七：时令所克者为死（季月土旺，土克水，水死）
  siRule: q("007", "007-42b", "我克者為死克我者為囚"),
  // 另一说：土只在四立前十八日旺
  tuShiba: q("008", "008-50a", "土守中宫分旺四季毎季前各旺十八日"),
  youqi: q("008", "008-52a", "旺相有氣"),
  wuqi: q("008", "008-52a", "休囚無氣"),

  // ── 六亲 ──
  guanGui: q("005", "005-6b", "囚氣動者更克日為官鬼也"),
  qiCai: q("005", "005-6a", "見火神發用為妻財"),
  // 卷八「物類課」以甲乙日（木）为例逐一列出亲属，并说其余日干「各倣此推」
  xiongDi: q("008", "008-51a", "發用為己身同類占寅為兄夘為弟", 2),
  fuMu: q("008", "008-51a", "子為父亥為母", 3),
  ziSun: q("008", "008-51a", "午為男已為女", 2),
  fangCi: q("008", "008-51b", "丙丁日火戊己日土庚辛日金壬癸日水六親之類各倣此推"),
  // 所指（同卷 53a，仍以甲乙日为例：见水神、木神、土神）
  fuMuZhi: q("008", "008-53a", "父母長上及文書"),
  xiongDiZhi: q("008", "008-53a", "已身兄弟及同類爭財事"),
  qiCaiZhi: q("008", "008-53a", "妻奴及婚姻財産事"),
});
