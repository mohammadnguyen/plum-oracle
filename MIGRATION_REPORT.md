# 移植报告 · Python → 前端 TypeScript 静态站

> 2026-10-24。对应 CLAUDE.md §0.1 宪法修订（解读外包 + 纯前端静态站）。
> 本报告记录：改动基线、测试三分类、对拍结果、两处已知差异、以及尚未完成的部分。

---

## 一、基线与结果

| 项 | 改动前 | 改动后 |
|---|---|---|
| Python 测试 | 42 文件全绿 | **42 文件全绿（一字未删，Python 仓库整体保留）** |
| TS 测试 | — | **20 条全绿** |
| 产品路径 LLM 调用 | OpenAI gpt-4o（repair 流最多 4 次） | **零**（构建产物扫描 openai/anthropic/api_key/sk-/Bearer/process.env 全为 0） |
| 后端 | Flask :8138 | **无**（dist 仅 index.html + 1 js + 1 css，加载只发 3 个请求） |
| 构建体积 | — | JS 410.72 kB（gzip 162.52 kB）、CSS 4.26 kB（gzip 1.45 kB） |

打包数据 468 KB：`zhouyi_clean.json`（64 卦 384 爻，verified）+ 七张规则表（含取象表 216 KB）
+ `contract.json`（解读契约 27 KB，自 Python 侧提取，逐字不改）。

---

## 二、测试三分类（执行前经用户过目）

### (a) 必须移植 —— Layer A 与语料运行时，约 126 条

| Python 文件 | 条数 | TS 对应 |
|---|---|---|
| test_core_units | 9 | `tests/parity.test.ts`（等价对拍覆盖） |
| test_duanshi | 16 | `tests/duanshi-parity.test.ts` |
| test_net_assessment_backtest | 10（全 A） | `tests/duanshi-parity.test.ts` |
| test_gold_cases | 9 | `tests/golden.test.ts` |
| test_book_cases | 6 | `tests/golden.test.ts` |
| test_yingqi_book_cases | 11/13 | `tests/duanshi-parity.test.ts`（应期路由与推导链） |
| test_corpus_structure / candidate / probes | 12 | `tests/corpus.test.ts` |
| test_map_reconciliation | 4 | `tests/duanshi-parity.test.ts`（类象白名单） |
| test_lineage_crosscheck_decisions | 4 | `tests/parity.test.ts` + 门派声明断言 |
| test_huajie | 3 | `tests/duanshi-parity.test.ts`（化解选条） |
| test_golden_harness | 3 | `tests/golden.test.ts` |
| test_quxiang_assist | 11 | **未移植**（见第五节「未完成」） |
| 混合文件的 A 部分 | 28 | 并入上述对拍 |

**移植策略说明（重要）**：TS 侧没有逐条照抄 126 个断言，而是用**等价性对拍**覆盖——
用 Python 实现当标准答案，对 3,530 + 2,626 + 112 组输入逐字段比对。
这比逐条重写更严：原断言只检查作者当时想到的字段，对拍检查**全部**字段的**全部**组合。
黄金案例（§7 五案例）仍单独逐字段断言，因为那是不可退让的验收线。

### (b) 随 Layer B/C 不移植 —— 约 130 条

test_kouwen_struct 15、test_xiangyi_bogua 14、test_repair_flow 11、test_semantic_marks 9、
test_duanshi_layerb 8、test_gua_scan_patterns 7、test_live_deadlocks_0816 7、test_vocab_dynamic 6、
test_guardrail_pipeline 5、test_quote_verbatim_redline 5、test_sanitize_audit 4、test_question_feed 4，
加各混合文件的 B/C 部分约 35 条。

**全部留在 Python 仓库，一条未删。** 新站不含 Layer B/C，故不移植。

### (c) 治理机制，留 Python 仓库 —— 58 条

test_quxiang 15、test_finalize_rules 9、test_corpus_governance 9、test_signoff_packet 7、
test_directive_scan 7、test_registry_integrity 5、test_writers_guarded 3、test_review_checklist 3。

签收闸门、测试锁登记册、核对单、考据裁决——与新站运行时无关。

---

## 三、对拍结果

| 层 | 组数 | 覆盖 | 差异 |
|---|---|---|---|
| Layer A（`divine`） | 3,530 | object_direction 全枚举 768、time 2,160、sound 405、color 192、显式节令 5 | **0** |
| 断事层（`duanshiFull`） | 2,626 | 四法 × **全 19 门类** + posture 四档 + 农历十二月旺衰 + 三特例 | **0**（扣除已知差异 #1） |
| 导出 Prompt | 112 | 四法、代表门类、所问之事、象义待核、封顶、大象化解、旺衰接线、pending 爻辞 | **0**（扣除已知差异 #1 #2） |

比对字段：排盘全字段、体用及五行、四条生克关系（role/from/wuxing/rel/tone）、净评计数与档、
旺衰、平衡强制、化解选条、应期值与路由与推导链、类象白名单、卦辞参照、文本明诫封顶、门类查表。

**黄金案例**：观梅、牡丹、借斧、牛哀鸣、验色五案，排盘 + 体用 + **生克关系列表** + **净评计数**
逐字段复现，期望值直接读 `plum/eval/golden/*.json`，一字未改。

**语料**：64 卦 × 6 爻全覆盖断言（384 爻辞 + 64 卦辞），pending 单元必须屏蔽正文；
§4.5 冒烟校验「师卦六三：师或舆尸，凶。」逐字通过。

---

## 四、两处已知差异（均经用户逐一裁定）

### #1 `yingqi.note` 的空值/引号渲染（PM 裁定：保留 TS 形式）

应期不路由时的说明文案。Python 用 `repr`（`final_verdict='未归'` / `=None`），
TS 用 JSON 约定（`="未归"` / `=null`）。非判分字段；新站为 TS，不把 Python 的 `None`
带进用户界面。对拍时归一这两种约定，**归一后文案仍逐字比对**。

### #2 pending 爻辞的呈现（PM 裁定：保留 TS 行为）

```
Python : 【命中卦爻辞】（本盘未引爻辞）
TS     : 【命中卦爻辞】
           · 泽火革六二爻辞：[pending·屏蔽·不得引用]
```

成因是喂法不同：老 Flask server 组装 `cited_specs` 时把 pending 单元滤掉；新站保留条目并标明屏蔽。
该卦**确有**动爻爻辞，只是尚未人工核定——如实标注比假装没有更合 §4.5 pending 机制与可溯源原则，
且正文仍不泄露（`text` 为 `null`）。

### 另一处：历法库名（依 §3#5 必须随实际依赖改变）

`农历/节气=依赖历法库 lunar_python` → `lunar-javascript`（同作者、同算法）。
§3#5 要求「换算口径在 UI 注明所用库与版本」，照抄 `lunar_python` 即谎报，故此处必须不同。

---

## 五、尚未完成 / 已知缺口

1. **取象辅助（专家模式）未移植。** `quxiang_assist`（指物直查、五色块、八方位、两可并呈）
   及其 11 条测试未进新站。`quxiang_table.json` 已打包（216 KB），功能待补。
2. **历史记录、分享图未做。** 不在本次任务范围。
3. **Phase 2 起卦法**（字占/物数占/丈尺占）、错卦综卦：与 Python 侧同样未实现。
4. **部署未执行。** 构建产物已验证可用纯静态服务托管（本地 `python -m http.server dist` 验证 200、
   零控制台错误、仅 3 个请求），尚未推到 Cloudflare Pages / GitHub Pages。
5. **护栏退出带来的风险**见 CLAUDE.md §0.1「本次明确放弃的保障」三条，不在此重复淡化。

---

## 六、怎么跑

```bash
cd web
npm install
npm test        # 20 条：对拍 + 黄金案例 + 语料 + 导出完整性
npm run dev     # 本地开发（:5174）
npm run build   # 产出 dist/（纯静态）
```

重新生成对拍夹具（需 Python 环境，只读运行）：

```bash
python web/tests/fixtures/gen_parity.py
python web/tests/fixtures/gen_duanshi_parity.py
python web/tests/fixtures/gen_prompt_parity.py
```

---

## 七、2026-10-25 追加：导出可读性 + 输入自动化（宪法 §0.2）

用户实测线上站后报三项，逐项落地：

| 反馈 | 改动 | 文件 |
|---|---|---|
| 「解读的内容根本看不懂，跟乱码一样」 | ① 导出顺序反转为**盘面在前**（live 取证：契约在前时对方回「尚未提供已排好的盘」）；② 默认要求换成精简人话版，**去掉面向已退场护栏的严格 JSON 输出要求**与 26 项自检清单 | `prompt/buildPrompt.ts`、`prompt/plainRequirements.ts` |
| 「时辰日期请按手机日期，不要问用户」 | 年支/农历月/农历日/时支全部取设备时钟；§3#4 的 23:00 换日**显式推进日期**（旧界面默认值写死 1/1，不改就排错卦——同时是正确性修复） | `engine/now.ts` |
| 「不要让用户选门类，按问题自动选」 | 确定性关键词规则判 19 门，认不出落人事占；判定结果摆明面、一键可改 | `engine/rules/menDetect.ts` |

附带：结果页加「盘面直译」卡（固定对照表，非解读，无推断）；推演链里的 JSON `trace`
换成人读取数行；起卦流程由四屏缩为三屏。

**导出体积**：约 9,500 字 → 约 3,500 字（比特币实测盘；初稿误写 13,000，那是勾选口吻范例时的体积）。完整契约**一字未改**，界面勾选即可换回。

**测试**：20 → 38 条全绿。三组对拍零差异——`buildExportPrompt().facts` 与 `.contract`
逐字未变，本次改动只增加 `plain`/`plainFull` 两个字段并调整 `full` 的拼接顺序。

**本次新放弃的保障**：默认路径不再要求结构化 JSON，用户的 AI 漏标生机句/收口句不再有形式
痕迹可查（护栏已不存在，这层形式本就无人消费；若将来恢复机器校验，默认导出需同步改回）。

---

## 八、2026-10-25 追加：解读要求第二版

用户拿同一张盘分别给 ChatGPT、Claude 解，判决「更喜欢 Claude 的风格，但过于精简」。
`prompt/plainRequirements.ts` 由约 1,600 字扩到约 5,500 字；默认导出约 7,300 字，仍短于严格模式约 9,500 字。

| 轮次 | 盘 | 结果 |
|---|---|---|
| 拆解 + 两稿试解 | 地水师·求财·比特币（用户实测盘） | 两稿硬约束全过；胜出稿 风格 7.5 / 厚度 8 / 注水 3.5 |
| 换盘复测 | 乾为天·婚姻·吉 | 硬约束全过，11 处引文逐字命中；风格 7.5 / 厚度 7 / 注水 4 |
| 换盘复测 | 天火同人·疾病·凶中有救 | 硬约束全过，11 处引文逐字命中；风格 7 / 厚度 7 / 注水 3 |

吃进的评审意见与一处主动撤回的条文见 CLAUDE.md §0.2 ⑥。最后一轮修订后未再试解。

测试 38 → 42 条：签收水印不是屏蔽、示例不取自实测盘、示例不写死应期日子、复测补上的条文都在且撤回的条文不回来。


---

## 九、2026-10-29 追加：默认解读改为聊天版（宪法 §0.3）

用户要求「先给明确结论，再解释事情如何发展、哪里最危险、为什么，以及对实际决策有什么意义」，
口吻「像一个懂卦、但也懂现实的人，在面对面帮你分析」，不必每段报依据，但每个重要判断都要有卦象支撑。

- 新增 `src/prompt/chatRequirements.ts`（约 4,200 字），默认导出改用它；第二版改称「详解版」，一字未改。
- 导出卡改为三选一：聊天版（默认）／详解版／完整契约。
- 新增 `disputeLines`：程序按起卦法与本卦判定本盘涉及的门派分歧，在盘面之后单列一节。
  盘面事实里原本没有任何一行写明起卦法，AI 无从判断该不该写声音/报数取式之争。
  这一节**不在 `facts` 内**，三组对拍（3,530 + 2,626 + 112）不受影响。
- `menDetect` 补词：「男朋友对我是不是真心」原先落人事占，现落婚姻占；恋人称谓单列低权重，
  问别的事时让位（「男朋友买的股票会涨吗」仍落求财）。另补「回本」入求财。

试解三轮加一次定点复测，共 6 张盘、19 份解读，每份先过机械核查，再交严格评审。

| 轮次 | 份数 | 机械核查 | 结构/极性/应期 | 口吻（1–5） |
|---|---|---|---|---|
| 一 | 5 | 全过 | 全对 | 3–4 |
| 二 | 6 | 全过 | 全对；声音起卦漏分歧（根因在盘面，已由程序补） | 2.5–3 |
| 三 | 6 | 全过 | 全对，分歧写对 | 3–4 |
| 定点复测 | 2 | 全过 | 全对；第三轮两处严重未再现 | 3–3.5 |

第二轮的教训写在 `chatRequirements.ts` 文件头：条文加厚、规定具体说法，口吻反而变成逐条交差。
定稿分两层——【底线】只管对错，【怎么讲】只给方向。复测后又改了四处措辞，未再试解。

测试 93 → 102 条。

### 九之二、同日追加：六壬聊天版

- 新增 `src/prompt/liurenChatRequirements.ts`（约 4,000 字），六壬默认导出改用它；原六壬要求保留为「详解版」。
  六壬导出卡加风格切换（聊天版／详解版）。
- 六壬引擎不出吉凶档，聊天版第一句报「走向」：三处各对问课人是帮是压、哪一处落空，逐字翻自盘面。
- 引擎昼夜分歧说明更正：原「只影响贵人昼夜」低估范围，现写明贵人换位则十二天将整体跟着变。
- 试解三轮加一次定点复测（4 课、14 份）：没有一份端出吉凶档，术语与外泄记号为零，
  第一句给走向从 3/4 升到 4/4，口吻 3–4。残余风险集中在天将越界，见 CLAUDE.md §0.3 ⑥。
  定点复测后补的一条未再试解。

测试 102 → 111 条。
