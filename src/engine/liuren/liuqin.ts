/**
 * 大六壬 · 六亲：以日干为我，按五行生克定名。引擎原已算出「与日干」的五种关系
 * （result.ts 的 relToGan），这里只是给它们换上原书的名目，并挂上出处：
 *
 *   生日干 → 父母　卷八「物類課」甲乙日例「子為父亥為母」（水生木）
 *   比和   → 兄弟　同例「發用為己身同類占寅為兄夘為弟」
 *   日干生 → 子孙　同例「午為男已為女」（木生火）；名目见同卷「占子孫要子孫出現」
 *   日干克 → 妻财　卷五「見火神發用為妻財」（壬癸日，水克火）
 *   克日干 → 官鬼　卷五「囚氣動者更克日為官鬼也」
 * 卷八只举甲乙日，其余日干「各倣此推」（同卷原文）。
 *
 * 「所指」只收原书逐字写出的：父母「父母長上及文書」、兄弟「已身兄弟及同類爭財事」、
 * 妻财「妻奴及婚姻財産事」（卷八 53a）。子孙、官鬼原书此处没有对应的一句，不补。
 */
import { DAQUAN_QUOTES as Q, type DaquanQuote } from "./daquan.js";

export type Liuqin = "父母" | "兄弟" | "子孙" | "妻财" | "官鬼";

const BY_REL: Readonly<Record<string, Liuqin>> = Object.freeze({
  生日干: "父母", 比和: "兄弟", 日干生: "子孙", 日干克: "妻财", 克日干: "官鬼",
});

export function liuqinOf(relToGan: string): Liuqin {
  const x = BY_REL[relToGan];
  if (!x) throw new Error(`无法定六亲：${relToGan}`);
  return x;
}

export interface LiuqinBasis {
  /** 定名的依据（原文逐字） */
  def: DaquanQuote;
  /** 原书举例时的说明 */
  defNote: string;
  /** 原书写出的所指；没有就是 null */
  zhi: DaquanQuote | null;
}

export const LIUQIN_BASIS: Readonly<Record<Liuqin, LiuqinBasis>> = Object.freeze({
  父母: { def: Q.fuMu, defNote: "甲乙日例，水生木：生日干者", zhi: Q.fuMuZhi },
  兄弟: { def: Q.xiongDi, defNote: "甲乙日例，同为木：与日干同类者", zhi: Q.xiongDiZhi },
  子孙: { def: Q.ziSun, defNote: "甲乙日例，木生火：日干所生者", zhi: null },
  妻财: { def: Q.qiCai, defNote: "壬癸日例，水克火：日干所克者", zhi: Q.qiCaiZhi },
  官鬼: { def: Q.guanGui, defNote: "克日干者", zhi: null },
});
