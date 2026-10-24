/**
 * 导出 Prompt 对拍 + 内容完整性（验收标准 #6）。
 *
 * 一、对拍：TS buildExportPrompt().facts 与 Python build_duanshi_prompt 的 user 段
 *     （盘面事实部分，截去「同门范例(gold)」块）逐字一致。夹具 112 组，覆盖四法、
 *     代表门类、所问之事、象义待核、封顶、大象化解、旺衰接线、pending 爻辞。
 * 二、完整性：对任取一卦，断言导出文本逐项包含验收清单要求的全部内容。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { divine } from "../src/engine/result.js";
import { duanshiFull } from "../src/engine/rules/netassess.js";
import { buildExportPrompt } from "../src/prompt/buildPrompt.js";
import { getYaoci, getGuaciInfo } from "../src/engine/corpus/guayaoci.js";
import type { CastMethod } from "../src/engine/cast.js";

interface PromptCase {
  method: CastMethod;
  inputs: Record<string, any>;
  men: number;
  question: string | null;
  posture: string | null;
  lunar_month: number | null;
  facts: string;
  gold_block_truncated: boolean;
  system: string;
}

const cases: PromptCase[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/prompt_cases.json", import.meta.url)), "utf-8"),
);

/**
 * 已知且**有意**的差异：门派声明里的历法库名。
 * CLAUDE.md §3#5 要求「换算口径在 UI 注明所用库与版本」——Python 版用 lunar_python，
 * 前端版用同作者、同算法的 lunar-javascript，故声明值必须随实际依赖改变，照抄 lunar_python 即谎报。
 * 对拍时把这一处库名归一，**其余文字仍逐字比对**（PM 2026-10-24 同 yingqi.note 口径）。
 */
function normalizeCalendarLib(s: string): string {
  return s.replace("依赖历法库 lunar_python", "依赖历法库 lunar-javascript");
}

/**
 * 已知差异 #2（PM 2026-10-24 裁定 B）：pending 爻辞的呈现。
 * 老 Flask server 组装 cited_specs 时把 pending 单元滤掉，prompt 显示「（本盘未引爻辞）」；
 * 新站保留该条目并标「[pending·屏蔽·不得引用]」——本卦确有动爻爻辞，只是尚未人工核定，
 * 如实标明比假装没有更符合 §4.5 pending 屏蔽机制与可溯源原则。正文仍不泄露（text 为 null）。
 * 对拍时把 Python 的「未引爻辞」占位替换为新站的 pending 行，**其余文字仍逐字比对**。
 */
function normalizePendingCite(s: string, r: ReturnType<typeof divine>): string {
  const e = getYaoci(r.ben_gua, r.dong_yao);
  if (!e?.pending) return s;
  const yt = e.yname || `第${e.yao}爻`;
  return s.replace(
    "【命中卦爻辞】（本盘未引爻辞）",
    `【命中卦爻辞】
  · ${e.gua_name}${yt}爻辞：[pending·屏蔽·不得引用]`,
  );
}

function build(c: PromptCase) {
  const r = divine(c.method, c.inputs);
  const full = duanshiFull(c.men, r, { posture: c.posture, lunarMonth: c.lunar_month });
  return { r, full, out: buildExportPrompt(r, full, { question: c.question }) };
}

describe("导出 Prompt 对拍：TypeScript vs Python build_duanshi_prompt", () => {
  it("夹具覆盖四法与多门类", () => {
    expect(cases.length).toBeGreaterThanOrEqual(100);
    expect([...new Set(cases.map((c) => c.method))].sort()).toEqual([
      "color", "object_direction", "sound", "time",
    ]);
  });

  it(`全部 ${cases.length} 组盘面事实段逐字一致`, () => {
    const failures: string[] = [];
    for (const c of cases) {
      const { out } = build(c);
      const expFacts = normalizePendingCite(normalizeCalendarLib(c.facts), build(c).r);
      if (out.facts !== expFacts) {
        // 定位首个差异行，便于人工裁定
        const a = expFacts.split("\n");
        const b = out.facts.split("\n");
        let i = 0;
        while (i < Math.max(a.length, b.length) && a[i] === b[i]) i++;
        failures.push(
          `【${c.method} ${JSON.stringify(c.inputs)} 门${c.men}】首个差异在第 ${i + 1} 行：\n` +
            `    Python: ${JSON.stringify(a[i])}\n    TS    : ${JSON.stringify(b[i])}`,
        );
      }
    }
    if (failures.length) {
      throw new Error(
        `导出 Prompt 差异 ${failures.length}/${cases.length} 组（须人工裁定）：\n` +
          failures.slice(0, 8).join("\n"),
      );
    }
    expect(failures.length).toBe(0);
  });

  it("契约段与 Python system 段一致（不含 gold few-shot）", () => {
    const c = cases[0]!;
    const { out } = build(c);
    // Python system = SYSTEM + DUANSHI_APPENDIX + 口吻范例 + 自检清单
    // TS 默认不附口吻范例（体积），故逐块核对而非整体比对
    expect(c.system.startsWith("你是梅花易数解读助手")).toBe(true);
    expect(out.contract.startsWith("你是梅花易数解读助手")).toBe(true);
    expect(c.system).toContain("【断事追加铁律（在上述规则之上）】");
    expect(out.contract).toContain("【断事追加铁律（在上述规则之上）】");
    expect(c.system).toContain("【输出前逐条自查");
    expect(out.contract).toContain("【输出前逐条自查");
    // 附带口吻范例时，与 Python 的 system 应完全一致
    const { out: withFs } = (() => {
      const r = divine(c.method, c.inputs);
      const full = duanshiFull(c.men, r, { posture: c.posture, lunarMonth: c.lunar_month });
      return { out: buildExportPrompt(r, full, { question: c.question, includeFewshot: true }) };
    })();
    expect(withFs.contract).toBe(c.system);   // system 段不含历法库名，可整体比对
  });
});

describe("导出内容完整性（验收标准 #6）", () => {
  it("任取一卦：导出文本逐项包含清单要求的全部内容", () => {
    // 泽地萃上六动·求财（本会话 live 实卦）；带所问之事
    const r = divine("object_direction", { object_gua: "兑", direction_gua: "坤", hour_dizhi: "子" });
    const full = duanshiFull(10, r, { lunarMonth: 7 });
    const q = "Baulkham Hills 那个报价今晚发过去，能谈下来吗？";
    const { facts, contract, full: whole } = buildExportPrompt(r, full, { question: q });

    // ① 本卦/互卦/变卦/动爻
    expect(facts).toContain(`【本卦】${r.ben_gua}`);
    expect(facts).toContain(`【动爻】第${r.dong_yao}爻`);
    expect(facts).toContain(`【变卦】${r.bian_gua}`);
    expect(facts).toContain(`【互卦】${r.hu_gua}`);
    // ② 体用及其五行
    expect(facts).toContain(`【体】${r.ti}(${r.ti_wuxing})`);
    expect(facts).toContain(`【用】${r.yong}(${r.yong_wuxing})`);
    // ③ 四卦对体的生克关系
    expect(r.shengke.relations).toHaveLength(4);
    for (const x of r.shengke.relations) expect(facts).toContain(x.phrase);
    // ④ 净评 d 值与档位
    expect(facts).toContain(`d=${full.net_d.d}`);
    expect(facts).toContain(`档:${full.net_d.band}`);
    // ⑤ 旺衰陈述
    expect(full.wangshuai_readable).toBeTruthy();
    expect(facts).toContain(full.wangshuai_readable!);
    // ⑥ 应期值与推导算式
    expect(facts).toContain("【应期·唯一喂入值");
    expect(facts).toContain(String(full.yingqi.derivation_chain));
    // ⑦ 门类查表结果及原文依据
    expect(facts).toContain("【门类查表】");
    expect(facts).toContain(String(full.domain_semantics.source_quote));
    expect(facts).toContain(`【最终极性 final_verdict:${full.final_verdict}】`);
    // ⑧ 动爻爻辞逐字原文
    const yao = getYaoci(r.ben_gua, r.dong_yao);
    expect(yao?.text).toBeTruthy();
    expect(facts).toContain(`「${yao!.text}」`);
    // ⑨ 本卦与变卦卦辞逐字原文
    for (const name of [r.ben_gua, r.bian_gua]) {
      const g = getGuaciInfo(name);
      if (g && !g.pending) expect(facts).toContain(`「${g.text}」`);
    }
    // ⑩ 化解条目（本卦触发）
    expect(full.huajie?.triggered).toBe(true);
    for (const it of full.huajie!.items) expect(facts).toContain(`「${it["逐字原文"]}」`);
    // ⑪ 所问之事
    expect(facts).toContain(`【所问之事(问卦人原话)】${q}`);
    // ⑫ 断语契约全文
    expect(contract).toContain("【断事追加铁律（在上述规则之上）】");
    expect(contract).toContain("6段式断语结构·强制");
    expect(contract).toContain("断法七要");
    expect(contract).toContain("术语→处境·当场翻译");
    expect(contract).toContain("【输出前逐条自查");
    // 合并段含两者
    expect(whole).toContain(facts);
    expect(whole).toContain(contract);
  });

  it("导出文本不含任何 LLM provider 痕迹", () => {
    const r = divine("object_direction", { object_gua: "乾", direction_gua: "震", hour_dizhi: "辰" });
    const full = duanshiFull(10, r, {});
    const { full: whole } = buildExportPrompt(r, full, {});
    for (const bad of ["openai", "OPENAI", "api_key", "apiKey", "sk-", "anthropic"]) {
      expect(whole.includes(bad), `导出文本含 ${bad}`).toBe(false);
    }
  });
});
