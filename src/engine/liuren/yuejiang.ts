/**
 * 大六壬 · 月将（太阳躔次）。
 *
 * 月将**按中气过宫**，不按节、不按农历月、不按公历月。
 * 雨水后日躔娵訾之次，月将登明（亥）；此后每过一个中气退一支。
 * 这是全盘的起点：月将错一支，天盘整个转错，四课三传全废。
 *
 * 口径依 CLAUDE.md §3#5「换算以历法库为准」：中气时刻取自 lunar-javascript，
 * 不自算节气。界面须注明所用库。
 */
import { Solar } from "lunar-javascript";
import type { Zhi } from "./ganzhi.js";

/** 十二月将的神名。地支 → 将名。 */
export const JIANG_NAME: Readonly<Record<string, string>> = Object.freeze({
  子: "神后", 丑: "大吉", 寅: "功曹", 卯: "太冲", 辰: "天罡", 巳: "太乙",
  午: "胜光", 未: "小吉", 申: "传送", 酉: "从魁", 戌: "河魁", 亥: "登明",
});

/**
 * 中气 → 月将。
 * 雨水→亥登明、春分→戌河魁、谷雨→酉从魁、小满→申传送、夏至→未小吉、大暑→午胜光、
 * 处暑→巳太乙、秋分→辰天罡、霜降→卯太冲、小雪→寅功曹、冬至→丑大吉、大寒→子神后。
 */
export const ZHONGQI_TO_JIANG: Readonly<Record<string, Zhi>> = Object.freeze({
  雨水: "亥", 春分: "戌", 谷雨: "酉", 小满: "申", 夏至: "未", 大暑: "午",
  处暑: "巳", 秋分: "辰", 霜降: "卯", 小雪: "寅", 冬至: "丑", 大寒: "子",
});

export interface YuejiangInfo {
  /** 月将地支 */
  zhi: Zhi;
  /** 将名，如「太冲」 */
  name: string;
  /** 所据中气名 */
  zhongqi: string;
  /** 该中气交节的公历时刻，供界面溯源 */
  zhongqiTime: string;
}

/**
 * 由某一时刻求月将。
 * 取该时刻**之前最近的中气**（lunar-javascript 的 getPrevQi 只返回中气），
 * 再查 ZHONGQI_TO_JIANG。
 */
export function yuejiangAt(at: Date): YuejiangInfo {
  const lunar = Solar.fromYmdHms(
    at.getFullYear(), at.getMonth() + 1, at.getDate(),
    at.getHours(), at.getMinutes(), at.getSeconds(),
  ).getLunar();
  const qi = lunar.getPrevQi();
  const name = qi.getName();
  const zhi = ZHONGQI_TO_JIANG[name];
  if (!zhi) {
    // getPrevQi 按定义只返回中气；若出现节名则是依赖行为变了，必须炸而不是猜。
    throw new Error(`历法库返回了非中气「${name}」，月将无法确定——请核对 lunar-javascript 版本`);
  }
  return { zhi, name, zhongqi: name, zhongqiTime: qi.getSolar().toYmdHms() };
}
