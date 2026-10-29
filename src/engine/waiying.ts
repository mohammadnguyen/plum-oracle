/**
 * 梅花 · 外应（十应之「论卦象」一路）。2026-10-29 新建，用户决定照天将表办理：
 * **机器逐字核对原书，不经人工签收**（CLAUDE.md §0.3 ⑪）。
 *
 * 原书卷二二十九「十应目论」（L1007）：十应「并以体卦为主……而随其所应以为用也」——
 * 外应就是一个「用」，与体卦比生克。所以吉凶不另立规则，直接用已签收的体用生克表（wuxing.ts）。
 * 本表只做一件事：把所见所闻对到卦（或五行），条目全部取自原书各「复明某某之应」里「论卦象」的句子，
 * 每条带原文与行号；`npm run verify:waiying` 逐条断言原文是该行的子串。
 *
 * 不收：
 *   · 「不论卦象」的外应（乌鸦报灾、灵鹊报喜、枷锁防官灾、物圆事成……）——那是不经生克的直断，
 *     与天将表不收强断语同一考虑。
 *   · L1050「水之气属震、巽」——按上下文与白话释意当作「木之气」，TXT 疑有讹字，不据以入表。
 *   · 时令之应（引擎已有旺衰）、方卦之应（看来人方位与用卦，另一套算法）、言语、写字之应。
 *
 * 外应不改【最终极性】：原书 L1007 一面说「内外卦全吉，则断然吉」「内卦吉而外卦不吉，反破其吉」，
 * 一面又说「又须详理以断吉凶，慎不可胶柱鼓瑟也」。本站把内外是否一致和原书原话摆出来，档名不动。
 */
import { relate, TONE, type Relation } from "./wuxing.js";

export const WAIYING_FILE = "《梅花易数》.txt";

export type WaiyingCat = "天时" | "地理" | "人事" | "动物" | "静物" | "声音" | "五色";

export interface WaiyingEntry {
  id: string;
  cat: WaiyingCat;
  /** 界面上给用户点的说法（白话） */
  label: string;
  /** 原书所属的卦；五色只论五行，为空 */
  gua: readonly string[];
  wuxing: "金" | "木" | "水" | "火" | "土";
  /** 原文逐字（TXT 该行的子串） */
  quote: string;
  line: number;
  /** 原书篇目 */
  section: string;
}

const T = "卷二三十 复明天时之应";
const D = "卷二三十一 复明地理之应";
const R = "卷二三十二 复明人事之应";
const A = "卷二三十五 复明动物之应";
const J = "卷二三十六 复明静物之应";
const S = "卷二三十八 复明声音之应";
const C = "卷二三十九 复明五色之应";

const e = (
  id: string, cat: WaiyingCat, label: string, gua: string[], wuxing: WaiyingEntry["wuxing"],
  quote: string, line: number, section: string,
): WaiyingEntry => Object.freeze({ id, cat, label, gua: Object.freeze(gua), wuxing, quote, line, section });

export const WAIYING: readonly WaiyingEntry[] = Object.freeze([
  e("tq_qing", "天时", "天晴无云", ["乾"], "金", "如天无云翳，明朗之际，为乾之时", 1013, T),
  e("tq_ri", "天时", "晴天，日头正当中", ["离"], "火", "晴雯日中，为离之时", 1013, T),
  e("tq_yu", "天时", "下雨、下雪", ["坎"], "水", "雨雪为坎之时", 1013, T),
  e("tq_lei", "天时", "打雷、刮风", ["震", "巽"], "木", "雷风为震、巽之时", 1013, T),

  e("dl_shu", "地理", "茂盛的树林、竹子", ["震"], "木", "茂树秀竹，为震之地", 1018, D),
  e("dl_shui", "地理", "江、河、湖、溪边", ["坎"], "水", "江湖、河地、川泽、溪涧，为坎之地", 1018, D),
  e("dl_yao", "地理", "窑、灶、炉边", ["离"], "火", "窑灶之地为离", 1018, D),
  e("dl_yan", "地理", "山岩、洞穴", ["艮"], "土", "岩穴之地为艮", 1018, D),

  e("rs_laoren", "人事", "老人（男）", ["乾"], "金", "老人属乾", 1023, R),
  e("rs_laofu", "人事", "老妇人", ["坤"], "土", "老妇属坤", 1023, R),
  e("rs_shaonan", "人事", "少年男子", ["艮"], "土", "艮为少男", 1023, R),
  e("rs_shaonv", "人事", "少女", ["兑"], "金", "兑为少女", 1023, R),

  e("dw_ma", "动物", "马", ["乾"], "金", "乾为马", 1045, A),
  e("dw_niu", "动物", "牛", ["坤"], "土", "坤为牛", 1045, A),
  e("dw_long", "动物", "龙", ["震"], "木", "震为龙", 1045, A),
  e("dw_ji", "动物", "鸡", ["巽"], "木", "巽为鸡", 1045, A),
  e("dw_zhu", "动物", "猪", ["坎"], "水", "坎为豕", 1045, A),
  e("dw_zhi", "动物", "野鸡（雉）", ["离"], "火", "离为雉", 1045, A),
  e("dw_gou", "动物", "狗", ["艮"], "土", "艮为狗", 1045, A),
  e("dw_yang", "动物", "羊", ["兑"], "金", "兑为羊", 1045, A),
  e("dw_luo", "动物", "螺、蚌、龟、鳖", ["离"], "火", "螺蚌龟鳖，为离之象", 1045, A),
  e("dw_yu", "动物", "鱼", ["坎"], "水", "鱼类为坎之属", 1045, A),

  e("jw_shui", "静物", "水", ["坎"], "水", "如水属坎", 1050, J),
  e("jw_huo", "静物", "火", ["离"], "火", "火属离", 1050, J),
  e("jw_jin", "静物", "金属器物", ["乾", "兑"], "金", "金之气属乾、兑", 1050, J),
  e("jw_tu", "静物", "土石器物", ["坤", "艮"], "土", "土之气属坤、艮", 1050, J),

  e("sy_lei", "声音", "雷声", ["震"], "木", "雷为震", 1061, S),
  e("sy_feng", "声音", "风声", ["巽"], "木", "风声为巽", 1061, S),
  e("sy_shui", "声音", "水声", ["坎"], "水", "水声为坎", 1061, S),
  e("sy_mu", "声音", "敲木头的声音（鼓、拍板等）", ["震", "巽"], "木", "鼓拍槌檄之声出于木者，皆属震、巽", 1061, S),
  e("sy_jin", "声音", "金属声（钟、磬、铃、铙）", ["乾", "兑"], "金", "钟馨铃铙之声出于金者，皆属于乾、兑", 1061, S),

  e("ws_qing", "五色", "青、碧、绿色", [], "木", "青碧绿色属木", 1067, C),
  e("ws_hong", "五色", "红、紫、赤色", [], "火", "红紫赤色属火", 1067, C),
  e("ws_bai", "五色", "白色", [], "金", "白属金", 1067, C),
  e("ws_hei", "五色", "黑色", [], "水", "黑属水", 1067, C),
  e("ws_huang", "五色", "黄色", [], "土", "黄属土", 1067, C),
]);

export const WAIYING_CATS: readonly WaiyingCat[] = ["天时", "地理", "人事", "动物", "静物", "声音", "五色"];

/** 十应目论原句（L1007）：外应为用、内外合断。 */
export const SHIYING_RULE = Object.freeze({
  line: 1007,
  asYong: "并以体卦为主，而随其所应以为用也",
  neiXiongWaiJi: "内卦不吉而外卦又吉，可以解其不吉",
  neiJiWaiXiong: "内卦吉而外卦不吉，反破其吉",
  quanJi: "若内外卦全吉，则断然吉",
  quanXiong: "全凶则断然凶",
  xiangLi: "其内吉外凶，内凶外吉，又须详理以断吉凶，慎不可胶柱鼓瑟也",
});

export interface WaiyingHit {
  entry: WaiyingEntry;
  rel: Relation;
  tone: string;
  /** 按体用生克表：生体、比和、体克为吉一边；体生、克体为不吉一边 */
  ji: boolean;
}

export interface WaiyingReading {
  hits: WaiyingHit[];
  /** 外卦合起来：全吉、全不吉、有吉有不吉 */
  wai: "吉" | "不吉" | "有吉有不吉";
  /** 内卦（本盘最终极性）偏哪边 */
  nei: "吉" | "不吉";
  /** 原书对这一种内外组合的原话（L1007 逐字），可能不止一句 */
  rule: string[];
}

const JI_SIDE: ReadonlySet<Relation> = new Set<Relation>(["生体", "比和", "体克"]);

/** 最终极性归边：大吉、吉、吉中有险为吉；凶中有救、凶、大凶为不吉。 */
export function neiSide(finalVerdict: string): "吉" | "不吉" {
  return /凶/.test(finalVerdict) ? "不吉" : "吉";
}

export function readWaiying(ids: readonly string[], tiWuxing: string, finalVerdict: string): WaiyingReading | null {
  const hits = ids
    .map((id) => WAIYING.find((x) => x.id === id))
    .filter((x): x is WaiyingEntry => !!x)
    .map((entry) => {
      const rel = relate(tiWuxing, entry.wuxing);
      return { entry, rel, tone: TONE[rel]!, ji: JI_SIDE.has(rel) };
    });
  if (!hits.length) return null;
  const nJi = hits.filter((h) => h.ji).length;
  const wai = nJi === hits.length ? "吉" : nJi === 0 ? "不吉" : "有吉有不吉";
  const nei = neiSide(finalVerdict);
  const Rr = SHIYING_RULE;
  const rule =
    wai === "有吉有不吉" ? [Rr.xiangLi]
      : nei === "吉" && wai === "吉" ? [Rr.quanJi]
        : nei === "不吉" && wai === "不吉" ? [Rr.quanXiong]
          : nei === "不吉" ? [Rr.neiXiongWaiJi, Rr.xiangLi]
            : [Rr.neiJiWaiXiong, Rr.xiangLi];
  return { hits, wai, nei, rule };
}
