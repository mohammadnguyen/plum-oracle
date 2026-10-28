/** lunar-javascript 无官方类型定义；此处只声明本项目用到的最小面。 */
declare module "lunar-javascript" {
  export interface SolarTime {
    toYmdHms(): string;
  }
  export interface JieQi {
    getName(): string;
    getSolar(): SolarTime;
  }
  export interface Lunar {
    getMonth(): number;
    getDay(): number;
    getYearZhi(): string;
    getTimeZhi(): string;
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    /** 以 23:00 起算次日的日干支（与 §3#4 同口径） */
    getDayInGanZhiExact(): string;
    getTimeInGanZhi(): string;
    /** 此刻之前最近的「中气」（不含节） */
    getPrevQi(): JieQi;
  }
  export interface SolarObj {
    getLunar(): Lunar;
  }
  export const Solar: {
    fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): SolarObj;
    fromDate(date: Date): SolarObj;
  };
}
