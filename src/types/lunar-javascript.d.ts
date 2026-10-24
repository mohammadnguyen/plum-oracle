/** lunar-javascript 无官方类型定义；此处只声明本项目用到的最小面。 */
declare module "lunar-javascript" {
  export interface Lunar {
    getMonth(): number;
    getDay(): number;
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
  }
  export interface SolarObj {
    getLunar(): Lunar;
  }
  export const Solar: {
    fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): SolarObj;
    fromDate(date: Date): SolarObj;
  };
}
