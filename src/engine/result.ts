/**
 * CastResult 契约对象 + 全流程编排（CLAUDE.md §2 核心契约 / §4.6 运行时对应物）。
 * 移植自 plum/core/result.py。
 *
 * divine() 是单一入口：cast(§5) → 互/变(§6) → 体用(§6) → 生克(§4.3) → 旺衰(§4.4)
 * 全程纯函数、无网络、无 LLM。
 *
 * 字段名刻意保持与 Python 版 to_dict() 的 snake_case 一致，以便与 Python 实现逐字段对拍。
 */
import { wuxingOf, type Bit } from "./bagua.js";
import { cast, type CastMethod, type CastOutput } from "./cast.js";
import { linesOf, nameOf, shortNameOf } from "./gua64.js";
import { huGua, bianGua } from "./transform.js";
import { tiYong } from "./tiyong.js";
import { analyze, type ShengkeResult } from "./wuxing.js";
import { seasonOfLunarMonth, weigh, type WangShuai } from "./wangshuai.js";

export interface CastResult {
  method: string;
  inputs: Record<string, unknown>;
  // —— 排盘 ——
  shang_gua: string;
  xia_gua: string;
  ben_gua: string;
  ben_short: string;
  ben_bits: Bit[];
  dong_yao: number;
  bian_gua: string;
  bian_short: string;
  bian_bits: Bit[];
  hu_gua: string;
  hu_shang: string;
  hu_xia: string;
  // —— 体用 ——
  ti: string;
  yong: string;
  ti_wuxing: string;
  yong_wuxing: string;
  yong_position: string;
  // —— 生克（以体为主，含 用/互上/互下/变）——
  shengke: ShengkeResult;
  // —— 旺衰 ——
  wangshuai: WangShuai;
  // —— 追溯中间量 ——
  trace: Record<string, unknown>;
}

/** 映射到 §4.6 golden expected 的可判分字段（供 eval 精确匹配）。 */
export function toExpected(r: CastResult): Record<string, unknown> {
  return {
    shang_gua: r.shang_gua,
    xia_gua: r.xia_gua,
    ben_gua: r.ben_gua,
    dong_yao: r.dong_yao,
    bian_gua: r.bian_gua,
    hu_shang: r.hu_shang,
    hu_xia: r.hu_xia,
    ti: r.ti,
    yong: r.yong,
    ti_wuxing: r.ti_wuxing,
    yong_wuxing: r.yong_wuxing,
    shengke: r.shengke.relations.map((x) => ({
      role: x.role, from: x.from, wuxing: x.wuxing, rel: x.rel, tone: x.tone,
    })),
  };
}

/** 把一次起卦的结果补全为完整 CastResult。 */
export function assemble(castOut: CastOutput, season: string | null = null): CastResult {
  const shangGua = castOut.shang_gua;
  const xiaGua = castOut.xia_gua;
  const dongYao = castOut.dong_yao;

  // 本卦
  const benBits = linesOf(shangGua, xiaGua);
  const benGua = nameOf(shangGua, xiaGua);
  const benShort = shortNameOf(shangGua, xiaGua);

  // 互卦 / 变卦
  const [huName, huShang, huXia] = huGua(benBits);
  const [bianName, bianUpper, bianLower, bianBits] = bianGua(benBits, dongYao);
  const bianShort = shortNameOf(bianUpper, bianLower);

  // 体用
  const ty = tiYong(shangGua, xiaGua, dongYao);

  // 变卦中「用位」之卦（动爻所在卦变出者），供生克与体对比
  const bianYong = ty.yongPosition === "lower" ? bianLower : bianUpper;

  // 生克（以体为主）：用 / 互上 / 互下 / 变(用位)
  const shengke = analyze(ty.tiWuxing, [
    ["用", ty.yong, ty.yongWuxing],
    ["互上", huShang, wuxingOf(huShang)],
    ["互下", huXia, wuxingOf(huXia)],
    ["变", bianYong, wuxingOf(bianYong)],
  ]);

  // 旺衰：time 法可由农历月推季；其余法用显式传入的 season
  let useSeason = season;
  if (useSeason === null && castOut.method === "time") {
    useSeason = seasonOfLunarMonth(Number(castOut.inputs.lunar_month));
  }
  const ws = weigh(ty.tiWuxing, ty.yongWuxing, useSeason);

  return {
    method: castOut.method,
    inputs: castOut.inputs,
    shang_gua: shangGua,
    xia_gua: xiaGua,
    ben_gua: benGua,
    ben_short: benShort,
    ben_bits: benBits,
    dong_yao: dongYao,
    bian_gua: bianName,
    bian_short: bianShort,
    bian_bits: bianBits,
    hu_gua: huName,
    hu_shang: huShang,
    hu_xia: huXia,
    ti: ty.ti,
    yong: ty.yong,
    ti_wuxing: ty.tiWuxing,
    yong_wuxing: ty.yongWuxing,
    yong_position: ty.yongPosition,
    shengke,
    wangshuai: ws,
    trace: { ...castOut.trace, bian_yong: bianYong },
  };
}

/** 单一入口：起卦 → 排盘全流程 → 完整 CastResult。 */
export function divine(
  method: CastMethod,
  inputs: Record<string, unknown>,
  season: string | null = null,
): CastResult {
  return assemble(cast(method, inputs), season);
}
