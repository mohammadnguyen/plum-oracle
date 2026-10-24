/**
 * 起卦（CLAUDE.md §5）。移植自 plum/core/cast.py。
 * v1 四法 = 五案例所涉：time / sound / objectDirection / color。
 *
 * 通用：卦数 = 总数 mod 8（余0取8）；动爻 = 总数 mod 6（余0取6）。
 * 取数口径全部取自 lineage（地支序数、农历本数、五色映射），不在此另行硬编码。
 * 字占 / 物数占 / 丈尺占列 Phase 2，未实现。
 */
import { DIZHI_NUM, COLOR_TO_GUA, GUA_MODULO, YAO_MODULO } from "./lineage.js";
import { byXiantian, NAME_TO_XIANTIAN } from "./bagua.js";

export type CastMethod = "time" | "sound" | "object_direction" | "color";

export interface CastTrace {
  year_num?: number;
  month_num?: number;
  day_num?: number;
  hour_num?: number;
  upper_total?: number;
  lower_total?: number;
  first_count?: number;
  second_count?: number;
  shang_num?: number;
  xia_num?: number;
}

export interface CastOutput {
  method: CastMethod;
  inputs: Record<string, string | number>;
  shang_gua: string;
  xia_gua: string;
  dong_yao: number;
  trace: CastTrace;
}

/** 总数 → 卦数（1..8），余0取8。 */
function modGua(total: number): number {
  const r = total % GUA_MODULO;
  return r !== 0 ? r : GUA_MODULO;
}

/** 总数 → 动爻（1..6），余0取6。 */
function modYao(total: number): number {
  const r = total % YAO_MODULO;
  return r !== 0 ? r : YAO_MODULO;
}

function dizhiNum(name: string): number {
  const n = DIZHI_NUM[name];
  if (n === undefined) throw new Error(`无此地支：${name}`);
  return n;
}

function xiantianOf(guaName: string): number {
  const n = NAME_TO_XIANTIAN[guaName];
  if (n === undefined) throw new Error(`无此卦名：${guaName}`);
  return n;
}

function result(
  method: CastMethod,
  inputs: Record<string, string | number>,
  shangGua: string,
  xiaGua: string,
  dongYao: number,
  trace: CastTrace,
): CastOutput {
  return { method, inputs, shang_gua: shangGua, xia_gua: xiaGua, dong_yao: dongYao, trace };
}

/**
 * 年月日时起卦（§5.1）。
 * 上卦 = (年数+月数+日数) mod 8；下卦 = (年数+月数+日数+时数) mod 8；
 * 动爻 = (年数+月数+日数+时数) mod 6。年数/时数 = 地支序数；月数/日数 = 农历本数。
 */
export function castTime(
  yearDizhi: string,
  lunarMonth: number,
  lunarDay: number,
  hourDizhi: string,
): CastOutput {
  const yearNum = dizhiNum(yearDizhi);
  const hourNum = dizhiNum(hourDizhi);
  const upperTotal = yearNum + lunarMonth + lunarDay;
  const lowerTotal = upperTotal + hourNum;
  const shangNum = modGua(upperTotal);
  const xiaNum = modGua(lowerTotal);
  const dongYao = modYao(lowerTotal);
  return result(
    "time",
    { year_dizhi: yearDizhi, lunar_month: lunarMonth, lunar_day: lunarDay, hour_dizhi: hourDizhi },
    byXiantian(shangNum).name,
    byXiantian(xiaNum).name,
    dongYao,
    {
      year_num: yearNum, month_num: lunarMonth, day_num: lunarDay, hour_num: hourNum,
      upper_total: upperTotal, lower_total: lowerTotal, shang_num: shangNum, xia_num: xiaNum,
    },
  );
}

/**
 * 声音起卦（§5.2）。先响声数→上卦，后响声数→下卦（声数→先天数→卦）。
 * 动爻 = (上卦数 + 下卦数 + 时数) mod 6。
 * 口径说明见 lineage.SOUND_RULE（本软件采借斧例式，章文单式列为分歧提示）。
 */
export function castSound(firstCount: number, secondCount: number, hourDizhi: string): CastOutput {
  const hourNum = dizhiNum(hourDizhi);
  const shangNum = modGua(firstCount);
  const xiaNum = modGua(secondCount);
  const dongYao = modYao(shangNum + xiaNum + hourNum);
  return result(
    "sound",
    { first_count: firstCount, second_count: secondCount, hour_dizhi: hourDizhi },
    byXiantian(shangNum).name,
    byXiantian(xiaNum).name,
    dongYao,
    { first_count: firstCount, second_count: secondCount, hour_num: hourNum, shang_num: shangNum, xia_num: xiaNum },
  );
}

/**
 * 指物 / 方位起卦（§5.3）。所指物之卦象→上卦；方位之卦→下卦。
 * 动爻 = (上卦数 + 下卦数 + 时数) mod 6。
 */
export function castObjectDirection(
  objectGua: string,
  directionGua: string,
  hourDizhi: string,
): CastOutput {
  const hourNum = dizhiNum(hourDizhi);
  const shangNum = xiantianOf(objectGua);
  const xiaNum = xiantianOf(directionGua);
  const dongYao = modYao(shangNum + xiaNum + hourNum);
  return result(
    "object_direction",
    { object_gua: objectGua, direction_gua: directionGua, hour_dizhi: hourDizhi },
    objectGua,
    directionGua,
    dongYao,
    { hour_num: hourNum, shang_num: shangNum, xia_num: xiaNum },
  );
}

/**
 * 验色 / 服色起卦（§5.4）。上衣色→上卦，下衣色→下卦；五色映射见 lineage。
 * 动爻 = (上卦数 + 下卦数 + 时数) mod 6。
 */
export function castColor(upperColor: string, lowerColor: string, hourDizhi: string): CastOutput {
  const hourNum = dizhiNum(hourDizhi);
  const shangGua = COLOR_TO_GUA[upperColor];
  const xiaGua = COLOR_TO_GUA[lowerColor];
  if (!shangGua || !xiaGua) throw new Error(`无此颜色：${upperColor}/${lowerColor}`);
  const shangNum = xiantianOf(shangGua);
  const xiaNum = xiantianOf(xiaGua);
  const dongYao = modYao(shangNum + xiaNum + hourNum);
  return result(
    "color",
    { upper_color: upperColor, lower_color: lowerColor, hour_dizhi: hourDizhi },
    shangGua,
    xiaGua,
    dongYao,
    { hour_num: hourNum, shang_num: shangNum, xia_num: xiaNum },
  );
}

/** 按 method 分派到对应起卦函数。参数名与 Python 版 inputs 键一致。 */
export function cast(method: CastMethod, inputs: Record<string, any>): CastOutput {
  switch (method) {
    case "time":
      return castTime(inputs.year_dizhi, inputs.lunar_month, inputs.lunar_day, inputs.hour_dizhi);
    case "sound":
      return castSound(inputs.first_count, inputs.second_count, inputs.hour_dizhi);
    case "object_direction":
      return castObjectDirection(inputs.object_gua, inputs.direction_gua, inputs.hour_dizhi);
    case "color":
      return castColor(inputs.upper_color, inputs.lower_color, inputs.hour_dizhi);
    default:
      throw new Error(`未知起卦法: ${method}`);
  }
}
