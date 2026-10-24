/**
 * 所问门类自动判定（**确定性关键词规则，零 LLM**）。
 *
 * 这不是排盘的一部分，是输入环节的便利：从问卦人原话里认出该查哪一门。
 * 设计约束：
 *   1. 纯规则、可复现、可审查——不调用任何模型。
 *   2. **判定结果必须在界面上显式呈现，并且一键可改。** 门类决定查哪张表的基础极性，
 *      选错会改变断语方向，所以不能默默替用户决定。
 *   3. 认不出来时落到「人事占」——原书十八占结尾「占者以类而推之可也」的兜底，
 *      并在界面标明「未识别·按人事占」。
 *
 * 词表取自各门的本义，不含任何推测性扩张；一词只归一门，命中多门时按权重与词长取最高。
 */

export interface MenDetectResult {
  /** 判定的门 id */
  menId: number;
  /** 命中的关键词（空数组 = 未识别，落兜底门） */
  matched: string[];
  /** 是否为兜底（未识别） */
  fallback: boolean;
}

/** 兜底门：人事占。 */
export const FALLBACK_MEN = 2;

/**
 * 词表。权重用于消歧：词越专指权重越高。
 * 同一问句命中多门时，取 (权重 × 词长) 最大者。
 */
const RULES: ReadonlyArray<{ menId: number; weight: number; words: readonly string[] }> = [
  // 天时（不分体用）
  { menId: 1, weight: 3, words: ["天气", "下雨", "会不会下雨", "晴天", "放晴", "台风", "下雪", "气候", "阴晴"] },
  // 家宅 / 屋舍
  { menId: 3, weight: 3, words: ["家宅", "家里", "家中", "风水", "家人平安", "宅子"] },
  { menId: 4, weight: 3, words: ["租房", "买房", "搬家", "换房", "房子", "住处", "装修", "屋子", "这套房"] },
  // 婚姻 / 生产
  { menId: 5, weight: 4, words: ["结婚", "婚姻", "订婚", "相亲", "求婚", "离婚", "复合", "感情", "对象", "恋爱", "表白", "在一起", "这段关系"] },
  { menId: 6, weight: 4, words: ["生产", "怀孕", "生孩子", "临盆", "备孕", "顺产", "剖腹"] },
  // 饮食
  { menId: 7, weight: 3, words: ["吃什么", "饮食", "聚餐", "这顿饭", "点外卖", "这家店好吃"] },
  // 求谋 / 求名
  { menId: 8, weight: 2, words: ["谋划", "这件事能不能成", "计划", "打算", "想做的事", "这个方案", "能否办成"] },
  { menId: 9, weight: 4, words: ["考试", "面试", "升职", "求职", "offer", "录取", "考公", "考研", "晋升", "评职称", "这份工作", "应聘", "投简历"] },
  // 求财 / 交易
  { menId: 10, weight: 4, words: ["求财", "赚钱", "收入", "财运", "投资", "股票", "比特币", "加密货币", "基金", "报价", "涨", "跌", "行情", "盈利", "亏损", "能不能赚", "生意", "接这个项目", "工资", "分红"] },
  { menId: 11, weight: 4, words: ["交易", "买卖", "成交", "出手", "卖掉", "出货", "签单", "合同能不能签", "谈成"] },
  // 出行 / 行人
  { menId: 12, weight: 4, words: ["出行", "出差", "旅行", "旅游", "自驾", "坐飞机", "这趟行程", "要不要去", "路上顺不顺"] },
  { menId: 13, weight: 4, words: ["什么时候回来", "何时归", "回不回来", "失联", "联系不上", "走了还会回来吗", "人在哪"] },
  // 谒见
  { menId: 14, weight: 4, words: ["见面", "拜访", "约见", "能不能见到", "求见", "引荐"] },
  // 失物
  { menId: 15, weight: 4, words: ["丢了", "找不到", "遗失", "失物", "被偷", "掉了", "能不能找回"] },
  // 疾病
  { menId: 16, weight: 5, words: ["生病", "病情", "身体", "住院", "手术", "化验", "检查结果", "咳嗽", "疼", "康复", "吃药", "能不能好"] },
  // 官讼
  { menId: 17, weight: 5, words: ["打官司", "诉讼", "官司", "起诉", "开庭", "法院", "纠纷", "仲裁", "赔偿", "律师"] },
  // 坟墓
  { menId: 18, weight: 5, words: ["坟", "墓地", "下葬", "安葬", "迁坟", "祖坟"] },
];

/** 门 id → 人读标签（与规则表 men_label 一致，供界面显示）。 */
export const MEN_LABEL: Readonly<Record<number, string>> = Object.freeze({
  0: "物占/杂占(扩展)", 1: "天时占", 2: "人事占", 3: "家宅占", 4: "屋舍占",
  5: "婚姻占", 6: "生产占", 7: "饮食占", 8: "求谋占", 9: "求名占",
  10: "求财占", 11: "交易占", 12: "出行占", 13: "行人占", 14: "谒见占",
  15: "失物占", 16: "疾病占", 17: "官讼占", 18: "坟墓占",
});

/**
 * 从问卦人原话判门。
 * 空问句 → 兜底门（人事占），fallback=true。
 */
export function detectMen(question: string): MenDetectResult {
  const q = (question || "").trim();
  if (!q) return { menId: FALLBACK_MEN, matched: [], fallback: true };

  let best: { menId: number; score: number; words: string[] } | null = null;
  for (const rule of RULES) {
    const hits = rule.words.filter((w) => q.includes(w));
    if (!hits.length) continue;
    // 分数 = 权重 × 最长命中词的长度（长词更专指，优先于短词巧合）
    const longest = hits.reduce((a, b) => ([...a].length >= [...b].length ? a : b));
    const score = rule.weight * [...longest].length;
    if (!best || score > best.score) best = { menId: rule.menId, score, words: hits };
  }

  return best
    ? { menId: best.menId, matched: best.words, fallback: false }
    : { menId: FALLBACK_MEN, matched: [], fallback: true };
}
