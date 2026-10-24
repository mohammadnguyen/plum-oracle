/**
 * 盘面直译（界面显示用）。
 *
 * **这不是解读，是翻译。** 把盘面上的术语按一张固定对照表换成处境话，
 * 一行一项，每行标明它翻的是盘面哪一项。没有任何推断、没有泛断、不调用任何 AI——
 * 同一张盘永远翻出同一段字。真正的解读仍由用户自己的 AI 据导出文本完成。
 *
 * 对照表取自原 Layer B 契约的「术语→处境·当场翻译」节（2026-08-16 依 PM 认可样本
 * ref_005 提炼，逐字沿用），不在此另创说法。
 */
import type { CastResult } from "../engine/result.js";
import type { DuanshiFull } from "../engine/rules/netassess.js";

/** 体用五关系 → 处境话（契约「术语→处境」节逐字）。 */
const REL_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  用生体: "有人往你这边送，顺水推舟之势。",
  体克用: "你能压住这件事，但要费力气、要花本钱。",
  体生用: "你在往外给，气是泄出去的；主动权在对方，你在让、在贴。",
  用克体: "有股外力压着你，不是你不想成，是被人卡住。",
  比和: "两边一个劲儿，谁也不欠谁——顺，但也没人推你一把。",
});

export interface PlainLine {
  /** 这一行翻的是盘面哪一项 */
  src: string;
  text: string;
}

/**
 * 旺衰串 → 力量对比话。
 * 引擎输出形如「旺衰土令:体坤土旺(当令得势)、用坎水衰」——「体」后面是**卦名+五行**再接旺/衰/平，
 * 所以不能只跨一个五行字符去取。
 */
function wangshuaiPlain(readable: string, ti: string, yong: string): string | null {
  const grab = (who: string) => {
    const m = readable.match(new RegExp(`${who}[^、，]{0,3}([旺衰平])`));
    return m ? m[1]! : null;
  };
  const t = grab("体");
  const y = grab("用");
  if (!t && !y) return null;
  const word = (s: string | null) => (s === "旺" ? "当令" : s === "衰" ? "不得势" : s === "平" ? "不旺不衰" : "—");
  if (t === "旺" && y === "衰") return `你这边当令、对方不得势——你强，对方弱（体${ti}旺、用${yong}衰）。`;
  if (t === "衰" && y === "旺") return `对方当令、你这边不得势——对方强，你弱（用${yong}旺、体${ti}衰）。`;
  return `力量对比：你这边${word(t)}，对方${word(y)}（体${ti}、用${yong}）。`;
}

/**
 * 生成直译行。
 * @param r 盘面
 * @param f 断事层产出
 */
export function plainRead(r: CastResult, f: DuanshiFull): PlainLine[] {
  const out: PlainLine[] = [];
  const ds = f.domain_semantics as Record<string, any>;

  // ① 谁是体、谁是用——先交代来由（契约「断法七要」㈠）
  out.push({
    src: `第${r.dong_yao}爻动`,
    text: `动爻在${r.dong_yao <= 3 ? "下" : "上"}卦，所以${r.yong}为「用」（对方、这件事本身），${r.ti}为「体」（你自己）。`,
  });

  // ② 体用关系直译
  const rel = ds.relation as string | undefined;
  if (rel && REL_PLAIN[rel]) {
    out.push({ src: `体用关系 ${rel}`, text: REL_PLAIN[rel]! });
  } else if (ds.type === "no_tiyong") {
    out.push({ src: `${ds.men_label}`, text: "这一门不分体用，按象法与爻辞推，不套体用吉凶。" });
  }

  // ③ 旺衰
  if (f.wangshuai_readable) {
    const w = wangshuaiPlain(f.wangshuai_readable, r.ti_wuxing, r.yong_wuxing);
    if (w) out.push({ src: "旺衰·占卦节令", text: w });
  }

  // ④ 净评计数：四个卦里几个帮你、几个压你
  const n = f.net_d;
  if (n) {
    const parts: string[] = [];
    if (n.sheng_ti) parts.push(`${n.sheng_ti} 个在帮你`);
    if (n.ke_ti) parts.push(`${n.ke_ti} 个在压你`);
    const tail = parts.length ? parts.join("、") : "没有一个明显帮你或压你";
    out.push({
      src: `净评 d=${n.d} → ${n.band}`,
      text: `用、互上、互下、变这四个卦里，${tail}，所以这一卦落在「${n.band}」这一档。`,
    });
  }

  // ⑤ 应期（照抄引擎值，不自算）
  const y = f.yingqi as any;
  if (y?.value) {
    const v = typeof y.value === "number"
      ? `约 ${Math.trunc(y.value)} 日内见分晓`
      : "分卦取日：" + y.value.map((x: any) => `${x.gua}${x.wuxing} ${x.tiangan_ri}日或${x.dizhi_ri}日`).join("；");
    out.push({ src: "应期", text: `${v}。` });
  }

  // ⑥ 门表断语模板（原书话，照引不改）。
  // 要点：门表只给**基础极性**，净评可以压过它。模板与最终极性不一致时必须把这层说清楚——
  // 否则「凶」字底下紧跟一句「有财」，读者只会以为程序前后矛盾。
  if (ds.duanyu_template) {
    const base = f.base_polarity;
    const fin = f.final_verdict;
    const overridden = Boolean(base && fin && !String(fin).includes(String(base)));
    out.push({
      src: `${ds.men_label}·门表${overridden ? " + 净评" : ""}`,
      text: overridden
        ? `书里对这组关系的断法是「${ds.duanyu_template}」（门表基础极性「${base}」）；` +
          `但本盘四卦生克算下来是「${fin}」，按净评优先，最终以「${fin}」为准。`
        : `书里对这组关系的断法是：「${ds.duanyu_template}」。`,
    });
  }

  return out;
}
