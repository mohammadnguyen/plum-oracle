/**
 * 「以此刻起卦」的取数（§3#1/#2/#4/#5 的单一落地点）。
 *
 * 用户不该被问农历几月几日——手机本来就知道。本模块把设备时钟换成
 * 排盘所需的四个量：年支、农历月、农历日、时支。
 *
 * 三个口径都来自 lineage，不在此另立：
 *   · 年支 = 农历年干支的地支（§3#1：年用地支数，不是公历年数字）
 *   · 月/日 = 农历本数（§3#2）
 *   · 23:00 起算次日（§3#4，**软件约定、非原书所定**）——换日时农历日与年支
 *     一并推进，不是只换时支；换月/换年当晚同样正确。
 *   · 农历换算一律走历法库（§3#5），不自算。
 */
import { Solar } from "lunar-javascript";
import { DIZHI, EARLY_ZISHI_ROLLS_TO_NEXT_DAY, CALENDAR_LIB } from "./lineage.js";

export interface NowTimeInputs {
  year_dizhi: string;
  lunar_month: number;
  lunar_day: number;
  hour_dizhi: string;
  /** 是否因 23:00 约定推进了一天 */
  rolled: boolean;
  /** 人读说明，供界面摆明「这几个数是怎么来的」 */
  note: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 时支：子时 23:00–00:59、丑 01:00–02:59 …（与历法库一致，此处只作兜底）。 */
function hourDizhiFallback(hour: number): string {
  return DIZHI[Math.floor(((hour + 1) % 24) / 2)]!;
}

/**
 * 由某一时刻（默认此刻）推出 time 法所需的四个取数。
 * @param at 设备本地时刻
 */
export function nowTimeInputs(at: Date = new Date()): NowTimeInputs {
  const h = at.getHours();
  const rolled = EARLY_ZISHI_ROLLS_TO_NEXT_DAY && h >= 23;

  // 时支按**原时刻**取（23 点就是子时）；月日年支按**换日后**的那一天取。
  const hourDizhi =
    Solar.fromYmdHms(at.getFullYear(), at.getMonth() + 1, at.getDate(), h, at.getMinutes(), 0)
      .getLunar()
      .getTimeZhi() || hourDizhiFallback(h);

  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate() + (rolled ? 1 : 0));
  // 固定取正午构造，避开库内部对子时的再处理——换日已在上一行显式完成，不可重复。
  const lunar = Solar.fromYmdHms(
    day.getFullYear(), day.getMonth() + 1, day.getDate(), 12, 0, 0,
  ).getLunar();

  const greg = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(h)}:${pad(at.getMinutes())}`;
  const rolledDay = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

  return {
    year_dizhi: lunar.getYearZhi(),
    lunar_month: Math.abs(lunar.getMonth()),
    lunar_day: lunar.getDay(),
    hour_dizhi: hourDizhi,
    rolled,
    note:
      `公历 ${greg} → ${lunar.getYearInGanZhi()}年 农历${Math.abs(lunar.getMonth())}月${lunar.getDay()}日 ${hourDizhi}时` +
      (rolled ? `（23 时起算次日，日期已推进至 ${rolledDay}——软件约定，非原书所定）` : "") +
      `｜换算：${CALENDAR_LIB}`,
  };
}

/** 非 time 法的旺衰节令用：此刻所在农历月（与上面同一套换日口径）。 */
export function currentLunarMonth(at: Date = new Date()): number {
  return nowTimeInputs(at).lunar_month;
}
