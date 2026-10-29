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

### 九之三、同日追加：十二天将类象表

- 新增 `src/engine/liuren/tianjiangLeixiang.ts`：《六壬大全》卷二四库本，每将一句主事类象，
  钉死在 kanripo/KR3g0031@320cbc1。新增 `scripts/verify-tianjiang.ts`（`npm run verify:tianjiang`），
  联网取原文逐字核对，12/12 通过。未经人工签收（用户决定）。
- 六壬导出附【天将类象·有出处】（只列三传所乘天将）；两版六壬要求改为只许逐字截取表中原句。
- 两版六壬要求明写「这是大六壬（不是小六壬，也不是六壬金口诀）」。

### 九之十、同日追加：六壬毕法赋（宪法 §0.3 ⑭）

- `src/engine/liuren/bifa.ts`（46 条主格判定）、`bifaData.ts`（赋文与定义原句，脚本生成）；`result.ts` 带 `bifa`。
- 导出新增【毕法赋·本课命中】节；两版六壬要求加用法；界面结果页加毕法赋一栏。
- `daquan.ts` 新增墓、六合、自刑、三合四句；`verify:liuren` 共 98 条引文全过。
- 新增 `tests/liuren-bifa.test.ts`（含原书课例 409 例回归夹具）。全仓 186 条全绿。

### 九之九、同日追加：梅花方卦之应（宪法 §0.3 ⑬）

- `src/engine/waiying.ts` 新增 `FANGGUA_RULE`、`readFanggua`；外应合断纳入有定论的方卦之应。
- `src/ui/fangPicker.ts`：指南针 / 手选定方位的部件，指物下卦与来人方位共用。
- 导出【外应】节新增方卦一行；`tests/waiying.test.ts` 加 4 条（含原书两例）。全仓 181 条全绿。

### 九之八、同日追加：六壬类神、年命（宪法 §0.3 ⑫）

- `src/engine/liuren/leishen.ts`（卷八类神口诀 17 类 + 取用之法）、`nianming.ts`（本命、行年、虚岁）；
  `result.ts` 新增输入 `leishen`、`nianming`，结果带 `leishen`、`nianming`、`noteOf`。
- 导出新增【类神·有出处】【年命】两节；两版六壬要求各加用法与禁词。
- 界面：类神自动归类（可改、可不取）；年命选填卡（出生年、生肖、性别）。
- `daquan.ts` 新增 27 条引文，`verify:liuren` 共 45 条全过。新增 `tests/liuren-leishen.test.ts`（10 条），全仓 177 条全绿。

### 九之七、同日追加：六壬六亲、旺相休囚；梅花外应（宪法 §0.3 ⑪）

- `src/engine/liuren/daquan.ts`（引文出处钉）、`wangxiang.ts`（旺相休囚，从卷五原文解析）、`liuqin.ts`（六亲）；
  `result.ts` 的三传带 `liuqin`、`qi`，结果带 `wangxiang`、`ganQi`；季月前段并列卷八「十八日」一说。
- `src/engine/waiying.ts` + `src/ui/waiyingCard.ts`：外应 36 条（原书论卦象条目），外应为用、按体用生克表定吉凶，
  导出单列【外应】节（不在 facts 内），内外组合只摆 L1007 原句，不改最终极性。
- 核对脚本：`npm run verify:liuren`（18 条，联网取钉死提交）、`npm run verify:waiying`（42 条，读本地 TXT）。
- 新增 `tests/liuren-wangxiang.test.ts`（8 条）、`tests/waiying.test.ts`（7 条）。全仓 167 条全绿。

### 九之六、同日追加：起卦体验（宪法 §0.3 ⑩）

- `src/ui/ritual.ts`：静心页（按住 1.5 秒起卦，按满那一刻为起卦时刻）与成卦动画（梅花逐爻成卦、
  六壬天盘转位 + 三传）。动画只演示引擎已算定的结果，可跳过，尊重「减少动态效果」。
- `src/engine/zhiwu.ts` + `src/ui/zhiwuCard.ts`：指物按《八卦万物类象表》字面查卦（列原文与行号）；
  方位按《八卦方位图》，可用手机指南针（`src/ui/compass.ts`）或手选。
- 新增 `tests/zhiwu.test.ts`（8 条）。全仓 152 条全绿。

### 九之五、同日追加：问卦人自述的背景 + 追问规矩（宪法 §0.3 ⑨）

- 新增 `src/prompt/conversation.ts`：背景节（盘面之后、要求之前，不并入 facts）与梅花、六壬两版追问规矩
  （附在每种导出最后）。两套输入页加选填背景框（`ui/shared.ts` 的 `backgroundCard`）。
- 四份解读要求的「所问原话」一条改为同时指向背景节；`contract.json` 未动。
- 「只复制盘面」改为复制 facts + 门派分歧 + 背景。
- 新增 `tests/conversation.test.ts`（10 条）。全仓 144 条全绿；三组对拍零差异（facts 未变）。
- 首次跨模型试解（Claude / GPT 各 12 份，含施压与盘外追问），结果与两处修订见宪法 §0.3 ⑨。

### 九之四、同日追加：涉害、八专改从《六壬大全》卷五

- 古籍课例本地对拍（`Damongu/liuren-classics-lab`，只读不拷入）50/63；不过的 13 项逐条到 Kanripo 卷五原文核实，
  皆原书明文。用户选定全面对齐《大全》（宪法 §0.3 ⑧）。
- `src/engine/liuren/sanchuan.ts`：涉害改为计深浅（顺行归本家、地支连寄干、两端不数）→ 孟 → 仲 → 复等；
  八专日无克即取八专、排在遥克前；「独足」只给三传同归一神的课。并列的孟仲季直取、比用格、
  订讹「无克又无遥克」三说，在本盘取出不同三传时写进盘面并把把握程度降为 disputed（`altNotes`）。
- 新增 `tests/liuren-book.test.ts`（16 条），锁原书逐例的重数与三传。对拍改后 58/63，余 5 项皆比用格。
- 720 课中三传改变 24 课；此前 46 组网页对拍夹具全部仍中。全仓 134 条测试全绿。

