/**
 * 门派 / 规则决策表（CLAUDE.md §3 的单一事实源）。
 *
 * 移植自 plum/config/lineage.py，逐值等价翻译，不改任何口径。
 * 任何核心算法取规则口径必须从本模块取值，不得在别处各自硬编码。
 * 所有「声明性假设」（非原书所定）用 *_IS_SOFTWARE_CONVENTION 标记，供 UI 注明。
 */

// ── §3 #1 年数 / 时数取数：地支序数（子1 … 亥12）────────────────────────
// 重要：年用地支数，不是公历年数字、不是农历年数。例 2026=丙午年→年数=午=7。
export const DIZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export type Dizhi = (typeof DIZHI)[number];

export const DIZHI_NUM: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(DIZHI.map((name, i) => [name, i + 1])),
);

export const YEAR_NUMBER_RULE = "dizhi_ordinal";
export const HOUR_NUMBER_RULE = "dizhi_ordinal";

// ── §3 #2 月数 / 日数取数：农历本数 ─────────────────────────────────────
export const MONTH_NUMBER_RULE = "lunar_literal";
export const DAY_NUMBER_RULE = "lunar_literal";

// ── §3 #3 字占笔画：繁体 / 康熙笔画（Phase 2，先记录决策）─────────────────
export const ZIZHAN_STROKE_RULE = "kangxi_traditional";

// ── §3 #4 早晚子时换日：23:00 起算次日（早子时归次日）────────────────────
// ⚠ 声明性假设，非原书所定（原书用时辰、无现代钟点）。单一 flag，可翻转。
export const EARLY_ZISHI_ROLLS_TO_NEXT_DAY = true;
export const EARLY_ZISHI_IS_SOFTWARE_CONVENTION = true;

// ── §3 #5 农历 / 节气换算：用成熟历法库，口径以库为准 ────────────────────
// 移植说明：Python 版用 lunar_python，前端版改用同作者、同算法的 lunar-javascript。
export const CALENDAR_LIB = "lunar-javascript";
export const CALENDAR_LIB_IS_DEPENDENCY = true;

// ── §3 #6 多卦象分歧：不在引擎内裁决，作「显式分歧提示」呈现 ───────────────
export const RESOLVE_SCHOOL_CONFLICTS_IN_ENGINE = false;

// ── 起卦通用取数（§5）：卦数 = 总数 mod 8（余0取8）；动爻 = 总数 mod 6（余0取6）
export const GUA_MODULO = 8;
export const YAO_MODULO = 6;

// ── §5.4 五色 → 卦 映射 ────────────────────────────────────────────────
// 来源：L439「凡占色之青者属震，红紫赤者属离，黄色者属坤，白色者属兑，黑色者属坎」。
export const COLOR_TO_GUA: Readonly<Record<string, string>> = Object.freeze({
  青: "震", 绿: "震",
  红: "离", 紫: "离", 赤: "离",
  黄: "坤",
  白: "兑",
  黑: "坎",
});
export const COLOR_HUANG_NOTE = "黄→坤（依验色占 L439）；部分门派归艮，列为显式分歧提示。";

// ── 全网二次核对(2026-07-30)三处门派分歧：PM 决定「维持现状 + 显式声明」，均不改判 ──
//    报告：sources/web_crosscheck_report.md（网源=维基文库/ctext 双源逐字互证）

// ① 乾坤无互：原书互卦起例末「又云：乾坤无互，互其变卦」（TXT L160）。
//    本软件维持无条件 234/345 取互（乾互得乾、坤互得坤），仅 2/64 卦涉及；另一说作分歧提示。
export const QIANKUN_WU_HU = false;
export const QIANKUN_WU_HU_NOTE =
  "乾坤取互：本软件照常取 234/345（乾互乾、坤互坤）。原书『又云：乾坤无互，" +
  "互其变卦』（卷一·互卦起例 L160）为另一说，本软件不采，列为显式分歧提示。";

// ② 声音占取式：章文单式 vs 案例双声式。本软件采案例式（原书案例直证且黄金测试锁定）。
export const SOUND_RULE = "case_two_sounds";
export const SOUND_RULE_NOTE =
  "声音占：本软件采『借斧例式』——先响声数为上卦、后响声数为下卦，" +
  "动爻=(上卦数+下卦数+时数) mod 6（卷一·邻夜叩门借物占 L353，案例直证）。" +
  "卷一·十六章文另有单声式（声数起上卦、加时数配下卦），本软件不采，列为显式分歧提示。";

// ③ 吉凶分级词：原文只言方向，未言「大」。六档为本软件净评层综合分级，须在 UI 注明来源层级。
export const VERDICT_BANDS_ARE_SOFTWARE_GRADING = true;
export const VERDICT_BANDS_NOTE =
  "吉凶六档（大吉/吉/吉中有险/凶中有救/凶/大凶）为本软件净评层综合分级；" +
  "原书体用总诀只言方向（体克用诸事吉、用克体诸事凶、体生用有耗失之患、" +
  "用生体有进益之喜、体用比和百事顺遂），未作「大吉/大凶」之分级。";

/** UI 声明用：把本软件采用的规则口径汇成一份可展示的清单。 */
export function declarations(): Record<string, string> {
  return {
    "年数/时数": "地支序数（子1…亥12）",
    "月数/日数": "农历本数",
    早晚子时换日: EARLY_ZISHI_ROLLS_TO_NEXT_DAY
      ? "23:00 起算次日（软件约定，非原书所定）"
      : "以日界换日",
    "农历/节气": `依赖历法库 ${CALENDAR_LIB}`,
    多卦象分歧: "透明并列提示，不在引擎内裁决",
    字占笔画: "繁体/康熙笔画（Phase 2）",
    乾坤取互: QIANKUN_WU_HU_NOTE,
    声音占取式: SOUND_RULE_NOTE,
    吉凶分级: VERDICT_BANDS_NOTE,
  };
}
