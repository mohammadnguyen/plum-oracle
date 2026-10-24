/**
 * 互卦 / 变卦（CLAUDE.md §6）。移植自 plum/core/transform.py。纯函数。
 *
 *   · 互卦：互下卦 = 本卦 2·3·4 爻；互上卦 = 本卦 3·4·5 爻（L159 互卦起例）。
 *     注：原书「又云：乾坤无互，互其变卦」为另一说，本软件不采（lineage.QIANKUN_WU_HU=false）。
 *   · 变卦：动爻阴阳翻转，重组六爻。
 * 逐例验证：革→互乾巽/初爻变咸；姤→互重乾/五爻变鼎、四爻变巽；师→互坤震/三爻变升。
 */
import { fromLines } from "./gua64.js";
import type { Bit } from "./bagua.js";

/** 本卦六爻 → [互卦全名, 互上卦名, 互下卦名]。互下=爻2,3,4；互上=爻3,4,5。 */
export function huGua(bits: readonly Bit[]): [string, string, string] {
  const huLower = bits.slice(1, 4); // 爻2·3·4
  const huUpper = bits.slice(2, 5); // 爻3·4·5
  return fromLines([...huLower, ...huUpper]);
}

/** 本卦六爻 + 动爻(1..6) → [变卦全名, 变上卦名, 变下卦名, 变卦bits]。 */
export function bianGua(
  bits: readonly Bit[],
  dongYao: number,
): [string, string, string, Bit[]] {
  const out = [...bits] as Bit[];
  const i = dongYao - 1;
  const cur = out[i];
  if (cur === undefined) throw new Error(`动爻越界：${dongYao}`);
  out[i] = (1 - cur) as Bit;
  const [name, upper, lower] = fromLines(out);
  return [name, upper, lower, out];
}
