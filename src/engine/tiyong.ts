/**
 * 体用判定（CLAUDE.md §6）。移植自 plum/core/tiyong.py。
 *
 * 铁律：**含动爻之卦为「用」，另一卦为「体」。**
 * 动爻在 1·2·3 → 在下卦；动爻在 4·5·6 → 在上卦。
 * 逐例验证：观梅动初爻(下离)→用离体兑；牡丹动五爻(上乾)→用乾体巽；
 *           牛哀鸣动三爻(下坎)→用坎体坤；借斧动四爻(上乾)→用乾体巽。
 */
import { wuxingOf } from "./bagua.js";

export interface TiYong {
  ti: string;
  yong: string;
  tiWuxing: string;
  yongWuxing: string;
  /** 用卦在本卦中的位置，供变卦取「用位变卦」用。 */
  yongPosition: "lower" | "upper";
}

/** 动爻是否落在下卦（爻1·2·3）。 */
export function yongInLower(dongYao: number): boolean {
  return dongYao === 1 || dongYao === 2 || dongYao === 3;
}

export function tiYong(shangGua: string, xiaGua: string, dongYao: number): TiYong {
  const inLower = yongInLower(dongYao);
  const yong = inLower ? xiaGua : shangGua;
  const ti = inLower ? shangGua : xiaGua;
  return {
    ti,
    yong,
    tiWuxing: wuxingOf(ti),
    yongWuxing: wuxingOf(yong),
    yongPosition: inLower ? "lower" : "upper",
  };
}
