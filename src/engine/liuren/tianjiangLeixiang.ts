/**
 * 大六壬 · 十二天将类象（有出处）。
 *
 * 为什么要这张表：天将是大六壬「神」「将」两层里的一层，师傅解课必看。但本站原先没有喂入
 * 天将含义的原文，用户的 AI 只能凭记忆说——试解里严重的越界全出在这里（太常 → 暗答「能和好」，
 * 青龙 → 把病人的落空换成家属手续）。有了这张表，天将的含义就从「AI 凭记忆」变成
 * 「本站提供、有出处、可复现」。
 *
 * 出处：《六壬大全》卷二「神將釋」，四庫全書・文淵閣本，取自漢籍リポジトリ（Kanripo）的
 * GitHub 仓库 kanripo/KR3g0031，钉死在提交 320cbc13a9048aa0f028d996ab32f8bf7b362ef7，文件 KR3g0031_002.txt。
 * 原书无标点，照录；异体字照录（𤣥＝玄、隂＝陰之类）。
 *
 * 每位只收**一句**：本将论中「某将主……」那一句主事类象（贵人原书作「貴人專主」，
 * 螣蛇原书作「蛇主」；朱雀的「主」句是得地、失地两句对立的条件句，改收「朱雀羽蟲之長……之神」）。
 * 不收的：总义里的「吉將也／凶將也」（现成的吉凶断语，对比试解里评审称之为诱饵）；
 * 「其戾主……」与旺相休囚各句（要先知道得地失地、旺衰，引擎尚未算）；临十二支的赋（全是强断语）。
 *
 * **核对状态**：机器逐字核对——`scripts/verify-tianjiang.ts` 按钉死的提交取回原文，
 * 去掉分页标记 <pb:…>、断行符 ¶、换行与全角空格后，断言每句在原文中恰好出现一次、
 * 落在本将自己的「論」内、页码一致。**未经人工签收**：用户 2026-10-29 明确决定不走人工核对
 * （见 CLAUDE.md §0.3 ⑦）。机器核对能保证「一字不差」，保证不了「选哪一句」是否最恰当。
 */

export const TIANJIANG_SOURCE = Object.freeze({
  book: "六壬大全",
  edition: "四庫全書・文淵閣本",
  section: "卷二「神將釋」",
  repo: "kanripo/KR3g0031",
  commit: "320cbc13a9048aa0f028d996ab32f8bf7b362ef7",
  file: "KR3g0031_002.txt",
  url: "https://github.com/kanripo/KR3g0031/blob/320cbc13a9048aa0f028d996ab32f8bf7b362ef7/KR3g0031_002.txt",
  status: "机器逐字核对通过，未经人工签收",
});

export interface TianjiangLeixiang {
  /** 引擎里的天将名（简体） */
  jiang: string;
  /** 原书里的写法 */
  nameInSource: string;
  /** 原句，逐字照录，无标点 */
  text: string;
  /** Kanripo 分页标记（卷-页面） */
  page: string;
}

export const TIANJIANG_LEIXIANG: ReadonlyArray<TianjiangLeixiang> = Object.freeze([
  { jiang: "贵人", nameInSource: "貴人", text: "貴人專主錢財喜慶詔命之事", page: "KR3g0031_WYG_002-32b" },
  { jiang: "螣蛇", nameInSource: "螣蛇", text: "蛇主文字虚譽公信小財水火之交", page: "KR3g0031_WYG_002-35a" },
  { jiang: "朱雀", nameInSource: "朱雀", text: "朱雀羽蟲之長文書信息口舌刑戮之神", page: "KR3g0031_WYG_002-38a" },
  { jiang: "六合", nameInSource: "六合", text: "六合主婚姻喜慶信息求望交易胎産媒妁牙保陰私財物交契木植船車之象", page: "KR3g0031_WYG_002-40b" },
  { jiang: "勾陈", nameInSource: "勾陳", text: "勾陳主兵戈官訟公事印信虎符留連皮革或争田宅土舎財帛占望信息財帛出行俱主留滯", page: "KR3g0031_WYG_002-43b" },
  { jiang: "青龙", nameInSource: "青龍", text: "青龍主文字財帛舟車林木衣服書契官府陞遷僧道髙人婚姻喜慶媒妁胎産宴㑹果藥之屬", page: "KR3g0031_WYG_002-46b" },
  { jiang: "天空", nameInSource: "天空", text: "天空主奴婢公吏市井小人財帛言約私契", page: "KR3g0031_WYG_002-49a" },
  { jiang: "白虎", nameInSource: "白虎", text: "白虎主道路信息兵戈動衆威權財帛犬馬金銀寳物", page: "KR3g0031_WYG_002-52b" },
  { jiang: "太常", nameInSource: "太常", text: "太常主文章印綬公裳服飾信息交關酒食宴樂絹帛田地五榖之屬", page: "KR3g0031_WYG_002-55b" },
  { jiang: "玄武", nameInSource: "𤣥武", text: "𤣥武主聰明多智文章巧伎求望財物干謁貴人", page: "KR3g0031_WYG_002-57b" },
  { jiang: "太阴", nameInSource: "太隂", text: "太隂主婦女才帛金銀錢物陰私喜慶婚姻", page: "KR3g0031_WYG_002-60b" },
  { jiang: "天后", nameInSource: "天后", text: "天后主宫庭隂私喜慶婦人財物婚姻胎産與賞赦慶賀恩澤", page: "KR3g0031_WYG_002-63b" },
]);

export function leixiangOf(jiang: string): TianjiangLeixiang | undefined {
  return TIANJIANG_LEIXIANG.find((x) => x.jiang === jiang);
}
